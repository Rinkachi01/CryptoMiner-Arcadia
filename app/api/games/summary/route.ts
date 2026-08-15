import { env } from "cloudflare:workers";
import {
  accountIdForUser,
  getArcadiaUser,
} from "../../../identity-server";
import { readAdminRuntimeSettings } from "../../../admin-settings";
import {
  DAILY_ARCADE_BATTERY_REWARD,
  DAILY_ARCADE_GAMES,
  DAILY_ARCADE_MISSION_ID,
  DAILY_ARCADE_PLAY_TARGET,
  completedDailyArcadeGames,
  dailyMissionIdempotencyKey,
  dailyMissionWindow,
} from "../../../daily-mission-rules";
import { readDailyGamePowerBudget } from "../../../game-emission-budget";
import {
  createInitialGameState,
  type PublicGameState,
} from "../../../game-server";
import { STARTER_KIT_VERSION } from "../../../onboarding-rules";
import { calculateOperatorProgress } from "../../../operator-progress-rules";
import { pcLevelAfterInactivity } from "../../../pc-progression-rules";

export const dynamic = "force-dynamic";

const gameIds = DAILY_ARCADE_GAMES;

type ProgressRow = {
  game_id: string;
  level: number;
  win_streak: number;
  next_play_at: number;
  total_plays: number;
  total_wins: number;
  updated_at: number;
};

type TodayRow = {
  game_id: string;
  plays_today: number;
  wins_today: number;
  power_today: number;
};

type StoredGameRow = {
  state_json: string;
  version: number;
};

type ClaimRow = {
  status: string;
  state_version_after: number | null;
};

export type GameSummaryResult = {
  serverTime: number;
  operator: ReturnType<typeof calculateOperatorProgress>;
  totals: {
    totalPlays: number;
    totalWins: number;
    playsToday: number;
    winsToday: number;
    powerToday: number;
    flaggedSessions: number;
  };
  pc: {
    level: number;
    lastActivityAt: number;
    resetAt: number;
  };
  emission: Awaited<ReturnType<typeof readDailyGamePowerBudget>> & {
    rollingPower24h: number;
    status: "limited" | "attention" | "stable";
  };
  games: {
    id: string;
    level: number;
    winStreak: number;
    nextPlayAt: number;
    totalPlays: number;
    totalWins: number;
    winRate: number;
    playsToday: number;
    winsToday: number;
  }[];
  missions: {
    id: string;
    label: string;
    current: number;
    target: number;
    eligible?: boolean;
    claimed?: boolean;
    claimable?: boolean;
    reward?: {
      type: string;
      amount: number;
    };
  }[];
};

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseGameState(row: StoredGameRow): PublicGameState {
  const state = JSON.parse(row.state_json) as PublicGameState;
  return {
    ...state,
    dailyMissionClaims:
      state.dailyMissionClaims &&
      typeof state.dailyMissionClaims === "object" &&
      !Array.isArray(state.dailyMissionClaims)
        ? state.dailyMissionClaims
        : {},
  };
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS game_states (
        account_id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        state_json TEXT NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        action TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        state_version INTEGER NOT NULL,
        delta_cma_micros INTEGER DEFAULT 0 NOT NULL,
        metadata_json TEXT DEFAULT '{}' NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_idempotency_unique
      ON ledger_entries (account_id, idempotency_key)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        nonce TEXT NOT NULL,
        seed TEXT NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        started_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        score INTEGER,
        reward_power_gh INTEGER DEFAULT 0 NOT NULL,
        risk_level TEXT DEFAULT 'normal' NOT NULL,
        review_reason TEXT,
        proof_json TEXT DEFAULT '{}' NOT NULL,
        difficulty INTEGER DEFAULT 1 NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS game_progress (
        account_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        level INTEGER DEFAULT 1 NOT NULL,
        win_streak INTEGER DEFAULT 0 NOT NULL,
        next_play_at INTEGER DEFAULT 0 NOT NULL,
        total_plays INTEGER DEFAULT 0 NOT NULL,
        total_wins INTEGER DEFAULT 0 NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS game_progress_account_game_unique
      ON game_progress (account_id, game_id)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS daily_mission_claims (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        window_key TEXT NOT NULL,
        status TEXT DEFAULT 'reserved' NOT NULL,
        battery_reward INTEGER DEFAULT 1 NOT NULL,
        state_version_before INTEGER NOT NULL,
        state_version_after INTEGER,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS daily_mission_claims_account_window_unique
      ON daily_mission_claims (account_id, mission_id, window_key)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS daily_mission_claims_account_created_idx
      ON daily_mission_claims (account_id, created_at)
    `),
  ]);
}

async function ensureGameState(
  db: D1Database,
  accountId: string,
  email: string,
  displayName: string,
  now: number,
) {
  const state = createInitialGameState(now);
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_states (
        account_id, email, display_name, state_json, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      accountId,
      email,
      displayName,
      JSON.stringify(state),
      now,
      now,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'account_initialized', ?, 1, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `bootstrap:${accountId}`,
      JSON.stringify({
        importedLocalState: false,
        starterKitVersion: STARTER_KIT_VERSION,
      }),
      now,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'starter_kit_granted', ?, 1, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `starter-kit:${STARTER_KIT_VERSION}:${accountId}`,
      JSON.stringify({
        version: STARTER_KIT_VERSION,
        rack: { id: "rack-01", roomId: "room-1", positionIndex: 0 },
        miner: { minerId: "byte-spark", quantity: 1, installed: false },
      }),
      now,
    )
    .run();
  return readGameState(db, accountId);
}

async function readGameState(db: D1Database, accountId: string) {
  return db
    .prepare(
      `SELECT state_json, version
       FROM game_states
       WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<StoredGameRow>();
}

async function completedGamesInWindow(
  db: D1Database,
  accountId: string,
  startsAt: number,
  resetAt: number,
) {
  const result = await db
    .prepare(
      `SELECT DISTINCT game_id
       FROM game_sessions
       WHERE account_id = ?
         AND completed_at >= ? AND completed_at < ?
         AND status IN ('completed', 'failed')`,
    )
    .bind(accountId, startsAt, resetAt)
    .all<{ game_id: string }>();
  return completedDailyArcadeGames(
    (result.results ?? []).map((row) => row.game_id),
  );
}

async function completedGamesCountInWindow(
  db: D1Database,
  accountId: string,
  startsAt: number,
  resetAt: number,
) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM game_sessions
       WHERE account_id = ?
         AND completed_at >= ? AND completed_at < ?
         AND status IN ('completed', 'failed')`,
    )
    .bind(accountId, startsAt, resetAt)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function readClaim(
  db: D1Database,
  accountId: string,
  windowKey: string,
) {
  return db
    .prepare(
      `SELECT status, state_version_after
       FROM daily_mission_claims
       WHERE account_id = ? AND mission_id = ? AND window_key = ?`,
    )
    .bind(accountId, DAILY_ARCADE_MISSION_ID, windowKey)
    .first<ClaimRow>();
}

async function finalizeClaim(
  db: D1Database,
  accountId: string,
  windowKey: string,
  stateVersion: number,
  now: number,
) {
  await db.batch([
    db
      .prepare(
        `UPDATE daily_mission_claims
         SET status = 'completed', state_version_after = ?, completed_at = ?
         WHERE account_id = ? AND mission_id = ? AND window_key = ?`,
      )
      .bind(
        stateVersion,
        now,
        accountId,
        DAILY_ARCADE_MISSION_ID,
        windowKey,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO ledger_entries (
          id, account_id, action, idempotency_key, state_version,
          delta_cma_micros, metadata_json, created_at
        ) VALUES (?, ?, 'daily_mission_battery', ?, ?, 0, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        accountId,
        dailyMissionIdempotencyKey(windowKey),
        stateVersion,
        JSON.stringify({
          missionId: DAILY_ARCADE_MISSION_ID,
          windowKey,
          batteryReward: DAILY_ARCADE_BATTERY_REWARD,
        }),
        now,
      ),
  ]);
}

export async function GET() {
  const user = await getArcadiaUser();
  if (!user) return json({ error: "Faça login para continuar." }, 401);
  const db = env.DB;
  if (!db) return json({ error: "Telemetria indisponível." }, 503);

  const now = Date.now();
  const accountId = await accountIdForUser(user);
  const { resetAt, startsAt, windowKey } = dailyMissionWindow(now);
  await ensureSchema(db);
  const settings = await readAdminRuntimeSettings(db);
  if (!settings.dailyBatteryEnabled) {
    return json(
      { error: "A bateria diária está pausada temporariamente pelo operador." },
      503,
    );
  }
  const emissionBudget = await readDailyGamePowerBudget(db, accountId, now);
  await db.batch(
    gameIds.map((gameId) =>
      db.prepare(
        `INSERT OR IGNORE INTO game_progress (
          account_id, game_id, level, win_streak, next_play_at,
          total_plays, total_wins, updated_at
        ) VALUES (?, ?, 1, 0, 0, 0, 0, ?)`,
      ).bind(accountId, gameId, now),
    ),
  );
  const gameStateRow = await ensureGameState(
    db,
    accountId,
    user.email,
    user.displayName,
    now,
  );
  if (!gameStateRow) {
    return json({ error: "Conta de mineração indisponível." }, 503);
  }
  const gameState = parseGameState(gameStateRow);

  const [progressResult, todayResult, flaggedRow, rollingPowerRow, claimRow] =
    await Promise.all([
      db.prepare(
        `SELECT game_id, level, win_streak, next_play_at,
                total_plays, total_wins, updated_at
         FROM game_progress
         WHERE account_id = ?
         ORDER BY game_id`,
      )
        .bind(accountId)
        .all<ProgressRow>(),
      db.prepare(
        `SELECT game_id,
                COUNT(*) AS plays_today,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS wins_today,
                COALESCE(SUM(CASE WHEN status = 'completed'
                  THEN reward_power_gh ELSE 0 END), 0) AS power_today
         FROM game_sessions
         WHERE account_id = ?
           AND completed_at >= ? AND completed_at < ?
           AND status IN ('completed', 'failed')
         GROUP BY game_id`,
      )
        .bind(accountId, startsAt, resetAt)
        .all<TodayRow>(),
      db.prepare(
        `SELECT COUNT(*) AS total
         FROM game_sessions
         WHERE account_id = ? AND risk_level != 'normal'`,
      )
        .bind(accountId)
        .first<{ total: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(reward_power_gh), 0) AS total
         FROM game_sessions
         WHERE account_id = ? AND status = 'completed'
           AND completed_at >= ?`,
      )
        .bind(accountId, now - 24 * 60 * 60 * 1000)
        .first<{ total: number }>(),
      readClaim(db, accountId, windowKey),
    ]);

  const progressRows = progressResult.results ?? [];
  const todayRows = new Map(
    (todayResult.results ?? []).map((row) => [row.game_id, row]),
  );
  const totalPlays = progressRows.reduce(
    (sum, row) => sum + Number(row.total_plays),
    0,
  );
  const totalWins = progressRows.reduce(
    (sum, row) => sum + Number(row.total_wins),
    0,
  );
  const lastActivityAt = progressRows.reduce(
    (latest, row) => Math.max(latest, Number(row.updated_at ?? 0)),
    0,
  );
  const pcLevel = pcLevelAfterInactivity(totalPlays, lastActivityAt, now);
  const playsToday = [...todayRows.values()].reduce(
    (sum, row) => sum + Number(row.plays_today),
    0,
  );
  const winsToday = [...todayRows.values()].reduce(
    (sum, row) => sum + Number(row.wins_today),
    0,
  );
  const gamesWon = gameIds.filter((gameId) => {
    const progress = progressRows.find((row) => row.game_id === gameId);
    return Number(progress?.total_wins ?? 0) > 0;
  }).length;
  const highestGameLevel = progressRows.reduce(
    (highest, row) => Math.max(highest, Number(row.level)),
    1,
  );
  const missionClaimed =
    gameState.dailyMissionClaims[DAILY_ARCADE_MISSION_ID] === windowKey ||
    claimRow?.status === "completed";
  const missionEligible = playsToday >= DAILY_ARCADE_PLAY_TARGET;
  return json({
    serverTime: now,
    operator: calculateOperatorProgress(totalPlays, totalWins),
    totals: {
      totalPlays,
      totalWins,
      playsToday,
      winsToday,
      powerToday: emissionBudget.usedPowerGh,
      flaggedSessions: Number(flaggedRow?.total ?? 0),
    },
    pc: {
      level: pcLevel,
      lastActivityAt,
      resetAt,
    },
    emission: {
      ...emissionBudget,
      rollingPower24h: Number(rollingPowerRow?.total ?? 0),
      status:
        emissionBudget.usagePercent >= 100
          ? "limited"
          : emissionBudget.usagePercent >= 75
            ? "attention"
            : "stable",
    },
    games: gameIds.map((gameId) => {
      const progress = progressRows.find((row) => row.game_id === gameId);
      const today = todayRows.get(gameId);
      const plays = Number(progress?.total_plays ?? 0);
      const wins = Number(progress?.total_wins ?? 0);
      return {
        id: gameId,
        level: Number(progress?.level ?? 1),
        winStreak: Number(progress?.win_streak ?? 0),
        nextPlayAt: Number(progress?.next_play_at ?? 0),
        totalPlays: plays,
        totalWins: wins,
        winRate: plays > 0 ? Math.round((wins / plays) * 100) : 0,
        playsToday: Number(today?.plays_today ?? 0),
        winsToday: Number(today?.wins_today ?? 0),
      };
    }),
    missions: [
      {
        id: "play-three",
        label: "Jogue 3 partidas",
        current: Math.min(3, playsToday),
        target: 3,
      },
      {
        id: "win-two",
        label: "Vença 2 partidas",
        current: Math.min(2, winsToday),
        target: 2,
      },
      {
        id: DAILY_ARCADE_MISSION_ID,
        label: "Jogue 10 minijogos",
        current: Math.min(DAILY_ARCADE_PLAY_TARGET, playsToday),
        target: DAILY_ARCADE_PLAY_TARGET,
        eligible: missionEligible,
        claimed: missionClaimed,
        claimable: missionEligible && !missionClaimed,
        reward: {
          type: "battery",
          amount: DAILY_ARCADE_BATTERY_REWARD,
        },
        resetAt,
      },
    ],
    achievements: [
      {
        id: "first-win",
        label: "Primeiro bloco de treino",
        description: "Conquiste sua primeira vitória no Arcade.",
        current: Math.min(1, totalWins),
        target: 1,
      },
      {
        id: "arcade-operator",
        label: "Operador versátil",
        description: "Vença ao menos uma vez em cada minigame.",
        current: gamesWon,
        target: 3,
      },
      {
        id: "twenty-five-runs",
        label: "Rotina de mineração",
        description: "Complete 25 tentativas validadas pelo servidor.",
        current: Math.min(25, totalPlays),
        target: 25,
      },
      {
        id: "ten-wins",
        label: "Precisão comprovada",
        description: "Alcance 10 vitórias no Arcade.",
        current: Math.min(10, totalWins),
        target: 10,
      },
      {
        id: "game-level-five",
        label: "Especialista de sistema",
        description: "Chegue ao nível 5 em qualquer minigame.",
        current: Math.min(5, highestGameLevel),
        target: 5,
      },
    ],
  });
}

export async function POST(request: Request) {
  const user = await getArcadiaUser();
  if (!user) return json({ error: "Faça login para continuar." }, 401);
  const db = env.DB;
  if (!db) return json({ error: "Recompensas indisponíveis." }, 503);
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;
  if (body?.action !== "claim-daily-battery") {
    return json({ error: "Resgate inválido." }, 400);
  }

  const now = Date.now();
  const accountId = await accountIdForUser(user);
  const { resetAt, startsAt, windowKey } = dailyMissionWindow(now);
  await ensureSchema(db);
  const playedGames = await completedGamesInWindow(
    db,
    accountId,
    startsAt,
    resetAt,
  );
  const completedPlayCount = await completedGamesCountInWindow(
    db,
    accountId,
    startsAt,
    resetAt,
  );
  if (completedPlayCount < DAILY_ARCADE_PLAY_TARGET) {
    return json(
      {
        error: "Jogue 10 minijogos antes de resgatar a bateria (+12h).",
        current: completedPlayCount,
        target: DAILY_ARCADE_PLAY_TARGET,
        games: playedGames,
      },
      409,
    );
  }

  let row = await ensureGameState(
    db,
    accountId,
    user.email,
    user.displayName,
    now,
  );
  if (!row) return json({ error: "Conta de mineração indisponível." }, 503);

  await db
    .prepare(
      `INSERT OR IGNORE INTO daily_mission_claims (
        id, account_id, mission_id, window_key, status, battery_reward,
        state_version_before, created_at
      ) VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      DAILY_ARCADE_MISSION_ID,
      windowKey,
      DAILY_ARCADE_BATTERY_REWARD,
      row.version,
      now,
    )
    .run();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = parseGameState(row);
    if (state.dailyMissionClaims[DAILY_ARCADE_MISSION_ID] === windowKey) {
      await finalizeClaim(db, accountId, windowKey, row.version, now);
      return json({
        claimed: true,
        alreadyClaimed: true,
        batteryCount: state.batteryCount,
        message: "A bateria diária já está no seu inventário.",
      });
    }
    const nextState: PublicGameState = {
      ...state,
      batteryCount: state.batteryCount + DAILY_ARCADE_BATTERY_REWARD,
      dailyMissionClaims: {
        ...state.dailyMissionClaims,
        [DAILY_ARCADE_MISSION_ID]: windowKey,
      },
    };
    const nextVersion = row.version + 1;
    const update = await db
      .prepare(
        `UPDATE game_states
         SET state_json = ?, version = ?, display_name = ?, updated_at = ?
         WHERE account_id = ? AND version = ?`,
      )
      .bind(
        JSON.stringify(nextState),
        nextVersion,
        user.displayName,
        now,
        accountId,
        row.version,
      )
      .run();

    if ((update.meta.changes ?? 0) === 1) {
      await finalizeClaim(db, accountId, windowKey, nextVersion, now);
      return json({
        claimed: true,
        alreadyClaimed: false,
        batteryCount: nextState.batteryCount,
        reward: {
          type: "battery",
          amount: DAILY_ARCADE_BATTERY_REWARD,
        },
        message: "Missão concluída: 1 bateria adicionada ao inventário.",
      });
    }

    const latest = await readGameState(db, accountId);
    if (!latest) {
      return json({ error: "Conta de mineração indisponível." }, 503);
    }
    row = latest;
  }

  return json(
    { error: "Seu progresso mudou em outra sessão. Tente novamente." },
    409,
  );
}
