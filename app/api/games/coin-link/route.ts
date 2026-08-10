import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../../identity-server";
import { reserveDailyGamePower } from "../../../game-emission-budget";
import {
  COIN_LINK_DAILY_LIMIT,
  COIN_LINK_HOURLY_LIMIT,
  COIN_LINK_MAX_MOVES,
  COIN_LINK_POWER_DURATION_HOURS,
  coinLinkDurationMs,
  coinLinkRewardPower,
  coinLinkTargetScore,
  createCoinLinkBoard,
  gameCooldownSeconds,
  validateCoinLink,
  type CoinLinkMove,
} from "../../../coin-link-rules";
import { MAX_GAME_DIFFICULTY } from "../../../packet-catch-rules";
import {
  detectAutomationPattern,
  guardArcadeAction,
  rejectAutomatedSession,
} from "../../../security-server";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  nonce: string;
  seed: string;
  status: string;
  started_at: number;
  expires_at: number;
  difficulty: number;
};

type ProgressRow = {
  level: number;
  next_play_at: number;
};

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function ensureSchema(db: D1Database) {
  await db.batch([
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
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_nonce_unique
      ON game_sessions (nonce)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS game_sessions_account_started_idx
      ON game_sessions (account_id, started_at)`),
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
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS game_progress_account_game_unique
      ON game_progress (account_id, game_id)`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS temporary_power_grants (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        source_session_id TEXT NOT NULL,
        power_gh INTEGER NOT NULL,
        starts_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS temporary_power_source_unique
      ON temporary_power_grants (source_session_id)`),
  ]);
}

async function context() {
  const user = await getArcadiaUser();
  if (!user) return null;
  if (!env.DB) throw new Error("Banco autoritativo indisponível.");
  await ensureSchema(env.DB);
  return { db: env.DB, accountId: await accountIdForUser(user) };
}

async function progress(db: D1Database, accountId: string, now: number) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_progress (
        account_id, game_id, level, win_streak, next_play_at,
        total_plays, total_wins, updated_at
      ) VALUES (?, 'coin-link', 1, 0, 0, 0, 0, ?)`,
    )
    .bind(accountId, now)
    .run();
  return db
    .prepare(
      `SELECT level, next_play_at FROM game_progress
       WHERE account_id = ? AND game_id = 'coin-link'`,
    )
    .bind(accountId)
    .first<ProgressRow>();
}

async function usage(db: D1Database, accountId: string, now: number) {
  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS hour_count,
         SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS day_count
       FROM game_sessions
       WHERE account_id = ? AND game_id = 'coin-link'`,
    )
    .bind(now - 60 * 60 * 1000, now - 24 * 60 * 60 * 1000, accountId)
    .first<{ hour_count: number | null; day_count: number | null }>();
  return {
    hourRemaining: Math.max(
      0,
      COIN_LINK_HOURLY_LIMIT - Number(row?.hour_count ?? 0),
    ),
    dayRemaining: Math.max(
      0,
      COIN_LINK_DAILY_LIMIT - Number(row?.day_count ?? 0),
    ),
  };
}

async function activeTemporaryPower(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(power_gh), 0) AS total
       FROM temporary_power_grants
       WHERE account_id = ? AND starts_at <= ? AND expires_at > ?`,
    )
    .bind(accountId, now, now)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function GET() {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const now = Date.now();
  const gameProgress = await progress(current.db, current.accountId, now);
  return json({
    serverTime: now,
    difficulty: gameProgress?.level ?? 1,
    nextPlayAt: gameProgress?.next_play_at ?? 0,
    limits: await usage(current.db, current.accountId, now),
  });
}

export async function POST(request: Request) {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        sessionId?: unknown;
        nonce?: unknown;
        outcome?: unknown;
        events?: unknown;
        durationMs?: unknown;
      }
    | null;
  if (!body || (body.action !== "start" && body.action !== "finish")) {
    return json({ error: "Ação do Coin Cascade inválida." }, 400);
  }

  const now = Date.now();
  const gate = await guardArcadeAction(
    current.db,
    current.accountId,
    body.action === "start" ? "start" : "submit",
    env,
    now,
  );
  if (!gate.allowed) return json(gate, gate.status);

  if (body.action === "start") {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'expired', review_reason = 'Tempo do tabuleiro encerrado.'
         WHERE account_id = ? AND game_id = 'coin-link'
           AND status = 'active' AND expires_at <= ?`,
      )
      .bind(current.accountId, now)
      .run();
    const active = await current.db
      .prepare(
        `SELECT id FROM game_sessions
         WHERE account_id = ? AND game_id = 'coin-link'
           AND status = 'active' AND expires_at > ?`,
      )
      .bind(current.accountId, now)
      .first<{ id: string }>();
    if (active) return json({ error: "Já existe um tabuleiro ativo." }, 409);

    const gameProgress = await progress(current.db, current.accountId, now);
    if (gameProgress && gameProgress.next_play_at > now) {
      return json(
        {
          error: "O Coin Cascade ainda está em recarga.",
          difficulty: gameProgress.level,
          nextPlayAt: gameProgress.next_play_at,
        },
        429,
      );
    }
    const limits = await usage(current.db, current.accountId, now);
    if (limits.hourRemaining === 0 || limits.dayRemaining === 0) {
      return json({ error: "Limite seguro do Coin Cascade alcançado.", limits }, 429);
    }

    const difficulty = gameProgress?.level ?? 1;
    const durationMs = coinLinkDurationMs(difficulty);
    const seed = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const board = createCoinLinkBoard(seed, difficulty);
    await current.db.batch([
      current.db
        .prepare(
          `INSERT INTO game_sessions (
            id, account_id, game_id, nonce, seed, status,
            started_at, expires_at, proof_json, difficulty
          ) VALUES (?, ?, 'coin-link', ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .bind(
          sessionId,
          current.accountId,
          nonce,
          seed,
          now,
          now + durationMs + 20_000,
          JSON.stringify({ targetScore: coinLinkTargetScore(difficulty) }),
          difficulty,
        ),
      current.db
        .prepare(
          `UPDATE game_progress SET total_plays = total_plays + 1, updated_at = ?
           WHERE account_id = ? AND game_id = 'coin-link'`,
        )
        .bind(now, current.accountId),
    ]);
    return json({
      sessionId,
      nonce,
      seed,
      difficulty,
      durationMs,
      targetScore: coinLinkTargetScore(difficulty),
      board,
      limits: {
        hourRemaining: limits.hourRemaining - 1,
        dayRemaining: limits.dayRemaining - 1,
      },
    });
  }

  if (
    typeof body.sessionId !== "string" ||
    typeof body.nonce !== "string" ||
    !Array.isArray(body.events) ||
    body.events.length > COIN_LINK_MAX_MOVES ||
    !Number.isInteger(body.durationMs) ||
    (body.outcome !== "complete" &&
      body.outcome !== "timeout" &&
      body.outcome !== "exhausted")
  ) {
    return json({ error: "Resultado de combinação inválido." }, 400);
  }

  const session = await current.db
    .prepare(
      `SELECT id, nonce, seed, status, started_at, expires_at, difficulty
       FROM game_sessions
       WHERE id = ? AND account_id = ? AND game_id = 'coin-link'`,
    )
    .bind(body.sessionId, current.accountId)
    .first<SessionRow>();
  if (
    !session ||
    session.status !== "active" ||
    session.nonce !== body.nonce ||
    now > session.expires_at
  ) {
    return json({ error: "Tabuleiro expirado ou já encerrado." }, 409);
  }

  const durationLimit = coinLinkDurationMs(session.difficulty);
  const durationMs = Number(body.durationMs);
  if (durationMs < 0 || durationMs > durationLimit + 1_500) {
    return json({ error: "Duração da rodada inválida." }, 400);
  }
  const events = body.events as CoinLinkMove[];
  const result = validateCoinLink(session.seed, session.difficulty, events);
  if (!result.valid) return json({ error: result.reason }, 400);
  const automationReason = detectAutomationPattern(
    events.map((event) => event.atMs),
  );
  if (automationReason) {
    await rejectAutomatedSession(
      current.db,
      current.accountId,
      session.id,
      durationMs,
      automationReason,
      now,
    );
    return json({ error: automationReason, review: true }, 400);
  }
  if (result.lastEventAt > durationMs + 250) {
    return json({ error: "O relógio não corresponde às trocas enviadas." }, 400);
  }

  const timedOut = body.outcome === "timeout";
  const exhausted = body.outcome === "exhausted";
  if (timedOut && now - session.started_at < durationLimit - 1_500) {
    return json({ error: "O tabuleiro ainda possui tempo." }, 400);
  }
  if (exhausted && events.length < COIN_LINK_MAX_MOVES) {
    return json({ error: "A rodada ainda possui jogadas." }, 400);
  }
  const completed = body.outcome === "complete" && result.completed;
  const failed = (timedOut || exhausted) && !result.completed;
  if (!completed && !failed) {
    return json({ error: "O resultado não corresponde ao tabuleiro." }, 400);
  }
  const verifiedDurationMs = Math.max(
    durationMs,
    Math.min(durationLimit, now - session.started_at),
  );

  if (failed) {
    const nextPlayAt = now + 45_000;
    const update = await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'failed', completed_at = ?, duration_ms = ?,
             score = ?, reward_power_gh = 0, review_reason = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(
        now,
        verifiedDurationMs,
        result.score,
        timedOut ? "Tempo esgotado." : "Jogadas esgotadas.",
        session.id,
      )
      .run();
    if ((update.meta.changes ?? 0) !== 1) {
      return json({ error: "Resultado já processado." }, 409);
    }
    await current.db
      .prepare(
        `UPDATE game_progress SET win_streak = 0, next_play_at = ?, updated_at = ?
         WHERE account_id = ? AND game_id = 'coin-link'`,
      )
      .bind(nextPlayAt, now, current.accountId)
      .run();
    return json({
      outcome: timedOut ? "timeout" : "exhausted",
      score: result.score,
      rewardPowerGh: 0,
      nextDifficulty: session.difficulty,
      nextPlayAt,
      limits: await usage(current.db, current.accountId, now),
      message: `${timedOut ? "Tempo" : "Jogadas"} esgotado. Faltaram ${Math.max(
        0,
        coinLinkTargetScore(session.difficulty) - result.score,
      )} pontos para a meta.`,
    });
  }

  const requestedRewardPowerGh = coinLinkRewardPower(
    session.difficulty,
    result.score,
  );
  const update = await current.db
    .prepare(
      `UPDATE game_sessions
       SET status = 'completed', completed_at = ?, duration_ms = ?,
           score = ?, reward_power_gh = 0
       WHERE id = ? AND status = 'active'`,
    )
    .bind(now, verifiedDurationMs, result.score, session.id)
    .run();
  if ((update.meta.changes ?? 0) !== 1) {
    return json({ error: "Conclusão já processada." }, 409);
  }
  const emissionBudget = await reserveDailyGamePower(
    current.db,
    current.accountId,
    requestedRewardPowerGh,
    now,
  );
  const rewardPowerGh = emissionBudget.awardedPowerGh;
  await current.db
    .prepare(`UPDATE game_sessions SET reward_power_gh = ? WHERE id = ?`)
    .bind(rewardPowerGh, session.id)
    .run();

  const wins = await current.db
    .prepare(
      `SELECT COUNT(*) AS total FROM game_sessions
       WHERE account_id = ? AND game_id = 'coin-link'
         AND status = 'completed' AND completed_at >= ?`,
    )
    .bind(current.accountId, now - 24 * 60 * 60 * 1000)
    .first<{ total: number }>();
  const cooldownSeconds = gameCooldownSeconds(
    Number(wins?.total ?? 0),
    session.difficulty,
  );
  const nextPlayAt = now + cooldownSeconds * 1000;
  const nextDifficulty = Math.min(MAX_GAME_DIFFICULTY, session.difficulty + 1);
  const powerExpiresAt =
    now + COIN_LINK_POWER_DURATION_HOURS * 60 * 60 * 1000;
  await current.db
    .prepare(
      `UPDATE game_progress
       SET level = ?, win_streak = win_streak + 1, next_play_at = ?,
           total_wins = total_wins + 1, updated_at = ?
       WHERE account_id = ? AND game_id = 'coin-link'`,
    )
    .bind(nextDifficulty, nextPlayAt, now, current.accountId)
    .run();
  if (rewardPowerGh > 0) {
    await current.db
      .prepare(
        `INSERT INTO temporary_power_grants (
          id, account_id, source_session_id, power_gh,
          starts_at, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        current.accountId,
        session.id,
        rewardPowerGh,
        now,
        powerExpiresAt,
        now,
      )
      .run();
  }

  return json({
    outcome: "completed",
    score: result.score,
    rewardPowerGh,
    emissionBudget,
    temporaryPowerGh: await activeTemporaryPower(current.db, current.accountId, now),
    nextDifficulty,
    nextPlayAt,
    cooldownSeconds,
    limits: await usage(current.db, current.accountId, now),
    message: emissionBudget.paused
      ? `Meta concluída. O poder temporário está pausado pelo operador.`
      : emissionBudget.limited
        ? `Meta concluída. O orçamento diário limitou parte do poder.`
        : `Coin Cascade nível ${session.difficulty} concluído.`,
  });
}
