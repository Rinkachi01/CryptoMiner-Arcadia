import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  readDailyGamePowerBudget,
  reserveDailyGamePower,
} from "../../../game-emission-budget";
import {
  MAX_GAME_DIFFICULTY,
  PACKET_CATCH_DAILY_LIMIT,
  PACKET_CATCH_DURATION_MS,
  PACKET_CATCH_HOURLY_LIMIT,
  PACKET_CATCH_POWER_DURATION_HOURS,
  PACKET_CATCH_STARTING_LIVES,
  createPacketTargets,
  gameCooldownSeconds,
  missedPacketCoins,
  packetCatchRewardPower,
  scorePacketCatch,
  thirdPacketMissAt,
  type PacketCatchEvent,
} from "../../../packet-catch-rules";

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
  win_streak: number;
  next_play_at: number;
  total_plays: number;
  total_wins: number;
};

async function accountIdFor(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_nonce_unique
      ON game_sessions (nonce)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS game_sessions_account_started_idx
      ON game_sessions (account_id, started_at)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS game_sessions_review_idx
      ON game_sessions (risk_level, started_at)
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
      CREATE INDEX IF NOT EXISTS game_progress_next_play_idx
      ON game_progress (game_id, next_play_at)
    `),
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
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS temporary_power_source_unique
      ON temporary_power_grants (source_session_id)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS temporary_power_account_expiry_idx
      ON temporary_power_grants (account_id, expires_at)
    `),
  ]);
}

async function context() {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (!env.DB) throw new Error("Banco autoritativo indisponível.");
  await ensureSchema(env.DB);
  return {
    db: env.DB,
    accountId: await accountIdFor(user.email),
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

async function usage(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS hour_count,
         SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS day_count
       FROM game_sessions
       WHERE account_id = ? AND game_id = 'packet-catch'`,
    )
    .bind(now - 60 * 60 * 1000, now - 24 * 60 * 60 * 1000, accountId)
    .first<{ hour_count: number | null; day_count: number | null }>();
  const hourCount = Number(row?.hour_count ?? 0);
  const dayCount = Number(row?.day_count ?? 0);
  return {
    hourRemaining: Math.max(0, PACKET_CATCH_HOURLY_LIMIT - hourCount),
    dayRemaining: Math.max(0, PACKET_CATCH_DAILY_LIMIT - dayCount),
  };
}

async function progress(
  db: D1Database,
  accountId: string,
  now: number,
) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_progress (
        account_id, game_id, level, win_streak, next_play_at,
        total_plays, total_wins, updated_at
      ) VALUES (?, 'packet-catch', 1, 0, 0, 0, 0, ?)`,
    )
    .bind(accountId, now)
    .run();
  return db
    .prepare(
      `SELECT level, win_streak, next_play_at, total_plays, total_wins
       FROM game_progress
       WHERE account_id = ? AND game_id = 'packet-catch'`,
    )
    .bind(accountId)
    .first<ProgressRow>();
}

export async function GET() {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const now = Date.now();
  const gameProgress = await progress(current.db, current.accountId, now);
  return json({
    serverTime: now,
    limits: await usage(current.db, current.accountId, now),
    difficulty: gameProgress?.level ?? 1,
    nextPlayAt: gameProgress?.next_play_at ?? 0,
    temporaryPowerGh: await activeTemporaryPower(
      current.db,
      current.accountId,
      now,
    ),
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
        durationMs?: unknown;
        endReason?: unknown;
        events?: unknown;
      }
    | null;
  if (!body || (body.action !== "start" && body.action !== "finish")) {
    return json({ error: "Ação de minigame inválida." }, 400);
  }

  const now = Date.now();
  if (body.action === "start") {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'expired', review_reason = 'Prazo da sessão encerrado.'
         WHERE account_id = ? AND game_id = 'packet-catch'
           AND status = 'active' AND expires_at <= ?`,
      )
      .bind(current.accountId, now)
      .run();
    const active = await current.db
      .prepare(
        `SELECT id FROM game_sessions
         WHERE account_id = ? AND game_id = 'packet-catch'
           AND status = 'active' AND expires_at > ?`,
      )
      .bind(current.accountId, now)
      .first<{ id: string }>();
    if (active) {
      return json(
        { error: "Já existe uma partida ativa. Aguarde o prazo encerrar." },
        409,
      );
    }

    const gameProgress = await progress(current.db, current.accountId, now);
    if (gameProgress && gameProgress.next_play_at > now) {
      return json(
        {
          error: "O sistema ainda está resfriando para a próxima partida.",
          difficulty: gameProgress.level,
          nextPlayAt: gameProgress.next_play_at,
        },
        429,
      );
    }

    const limits = await usage(current.db, current.accountId, now);
    if (limits.hourRemaining === 0 || limits.dayRemaining === 0) {
      return json(
        { error: "Limite seguro de partidas alcançado.", limits },
        429,
      );
    }

    const difficulty = gameProgress?.level ?? 1;
    const sessionId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const seed = crypto.randomUUID();
    const expiresAt = now + 75_000;
    await current.db.batch([
      current.db
        .prepare(
          `INSERT INTO game_sessions (
            id, account_id, game_id, nonce, seed, status,
            started_at, expires_at, proof_json, difficulty
          ) VALUES (?, ?, 'packet-catch', ?, ?, 'active', ?, ?, '{}', ?)`,
        )
        .bind(
          sessionId,
          current.accountId,
          nonce,
          seed,
          now,
          expiresAt,
          difficulty,
        ),
      current.db
        .prepare(
          `UPDATE game_progress
           SET total_plays = total_plays + 1, updated_at = ?
           WHERE account_id = ? AND game_id = 'packet-catch'`,
        )
        .bind(now, current.accountId),
    ]);

    return json({
      sessionId,
      nonce,
      startedAt: now,
      expiresAt,
      durationMs: PACKET_CATCH_DURATION_MS,
      difficulty,
      targets: createPacketTargets(seed, difficulty),
      limits: {
        hourRemaining: limits.hourRemaining - 1,
        dayRemaining: limits.dayRemaining - 1,
      },
    });
  }

  if (
    typeof body.sessionId !== "string" ||
    typeof body.nonce !== "string" ||
    typeof body.durationMs !== "number" ||
    (body.endReason !== "complete" &&
      body.endReason !== "bomb" &&
      body.endReason !== "lives") ||
    !Array.isArray(body.events) ||
    body.events.length > 48
  ) {
    return json({ error: "Comprovante da partida inválido." }, 400);
  }

  const session = await current.db
    .prepare(
      `SELECT id, nonce, seed, status, started_at, expires_at, difficulty
       FROM game_sessions
       WHERE id = ? AND account_id = ? AND game_id = 'packet-catch'`,
    )
    .bind(body.sessionId, current.accountId)
    .first<SessionRow>();
  if (
    !session ||
    session.status !== "active" ||
    session.nonce !== body.nonce ||
    now > session.expires_at
  ) {
    return json({ error: "Sessão expirada, encerrada ou inválida." }, 409);
  }

  const events = body.events.filter(
    (event): event is PacketCatchEvent =>
      Boolean(
        event &&
          typeof event === "object" &&
          typeof (event as PacketCatchEvent).targetId === "string" &&
          typeof (event as PacketCatchEvent).atMs === "number",
      ),
  );
  if (events.length !== body.events.length) {
    return json({ error: "Eventos da partida inválidos." }, 400);
  }

  const scoreResult = scorePacketCatch(
    session.seed,
    session.difficulty,
    events,
  );
  if (!scoreResult.valid) {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'rejected', completed_at = ?, duration_ms = ?,
             risk_level = 'review', review_reason = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(now, Math.floor(body.durationMs), scoreResult.reason, session.id)
      .run();
    return json({ error: scoreResult.reason }, 400);
  }

  const durationMs = Math.floor(body.durationMs);
  const serverElapsed = now - session.started_at;
  const missedCoins = missedPacketCoins(
    session.seed,
    session.difficulty,
    events,
    durationMs,
  );
  const thirdMissAt = thirdPacketMissAt(
    session.seed,
    session.difficulty,
    events,
  );
  const validBombFinish =
    scoreResult.bombHit &&
    body.endReason === "bomb" &&
    durationMs >= Math.max(400, scoreResult.lastEventAt - 200) &&
    durationMs <= scoreResult.lastEventAt + 900 &&
    serverElapsed >= durationMs - 1_500;
  const validCompleteFinish =
    !scoreResult.bombHit &&
    body.endReason === "complete" &&
    missedCoins.length < PACKET_CATCH_STARTING_LIVES &&
    durationMs >= PACKET_CATCH_DURATION_MS - 1_200 &&
    durationMs <= PACKET_CATCH_DURATION_MS + 3_000 &&
    serverElapsed >= PACKET_CATCH_DURATION_MS - 2_000;
  const validLivesFinish =
    !scoreResult.bombHit &&
    body.endReason === "lives" &&
    thirdMissAt !== null &&
    missedCoins.length >= PACKET_CATCH_STARTING_LIVES &&
    durationMs >= thirdMissAt - 250 &&
    durationMs <= thirdMissAt + 1_100 &&
    serverElapsed >= durationMs - 1_500;
  if (!validBombFinish && !validCompleteFinish && !validLivesFinish) {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'rejected', completed_at = ?, duration_ms = ?,
             risk_level = 'review', review_reason = 'Encerramento incompatível.'
         WHERE id = ? AND status = 'active'`,
      )
      .bind(now, durationMs, session.id)
      .run();
    return json({ error: "Encerramento da partida incompatível." }, 400);
  }

  const survived = validCompleteFinish;
  const requestedRewardPowerGh = packetCatchRewardPower(
    scoreResult.score,
    session.difficulty,
    !survived,
  );
  const update = await current.db
    .prepare(
      `UPDATE game_sessions
       SET status = ?, completed_at = ?, duration_ms = ?,
           score = ?, reward_power_gh = ?, proof_json = ?
       WHERE id = ? AND status = 'active'`,
    )
    .bind(
      survived ? "completed" : "failed",
      now,
      durationMs,
      survived ? scoreResult.score : 0,
      0,
      JSON.stringify({
        events,
        coinHits: scoreResult.coinHits,
        bombHit: scoreResult.bombHit,
        missedCoins: missedCoins.map((coin) => coin.id),
      }),
      session.id,
    )
    .run();
  if ((update.meta.changes ?? 0) !== 1) {
    return json({ error: "Esta partida já foi processada." }, 409);
  }
  const emissionBudget = survived
    ? await reserveDailyGamePower(
        current.db,
        current.accountId,
        requestedRewardPowerGh,
        now,
      )
    : await readDailyGamePowerBudget(current.db, current.accountId, now);
  const rewardPowerGh = emissionBudget.awardedPowerGh;
  if (survived) {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET reward_power_gh = ?
         WHERE id = ? AND status = 'completed'`,
      )
      .bind(rewardPowerGh, session.id)
      .run();
  }

  const wins = await current.db
    .prepare(
      `SELECT COUNT(*) AS total FROM game_sessions
       WHERE account_id = ? AND game_id = 'packet-catch'
         AND status = 'completed' AND completed_at >= ?`,
    )
    .bind(current.accountId, now - 24 * 60 * 60 * 1000)
    .first<{ total: number }>();
  const cooldownSeconds = survived
    ? gameCooldownSeconds(Number(wins?.total ?? 0), session.difficulty)
    : 45 + (session.difficulty - 1) * 5;
  const nextPlayAt = now + cooldownSeconds * 1000;
  const nextDifficulty = survived
    ? Math.min(MAX_GAME_DIFFICULTY, session.difficulty + 1)
    : session.difficulty;
  await current.db
    .prepare(
      `UPDATE game_progress
       SET level = ?,
           win_streak = CASE WHEN ? = 1 THEN win_streak + 1 ELSE 0 END,
           next_play_at = ?, total_wins = total_wins + ?,
           updated_at = ?
       WHERE account_id = ? AND game_id = 'packet-catch'`,
    )
    .bind(
      nextDifficulty,
      survived ? 1 : 0,
      nextPlayAt,
      survived ? 1 : 0,
      now,
      current.accountId,
    )
    .run();

  const powerExpiresAt =
    now + PACKET_CATCH_POWER_DURATION_HOURS * 60 * 60 * 1000;
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
    outcome: survived
      ? "completed"
      : scoreResult.bombHit
        ? "bomb"
        : "lives",
    score: survived ? scoreResult.score : 0,
    coinHits: survived ? scoreResult.coinHits : 0,
    rewardPowerGh,
    emissionBudget,
    powerExpiresAt: rewardPowerGh > 0 ? powerExpiresAt : null,
    temporaryPowerGh: await activeTemporaryPower(
      current.db,
      current.accountId,
      now,
    ),
    limits: await usage(current.db, current.accountId, now),
    difficulty: session.difficulty,
    nextDifficulty,
    nextPlayAt,
    cooldownSeconds,
    message: survived
      ? emissionBudget.limited
        ? `Nível ${session.difficulty} concluído. O orçamento diário limitou parte do poder.`
        : `Nível ${session.difficulty} concluído. A próxima rodada será mais difícil.`
      : scoreResult.bombHit
        ? "Bomba atingida: partida encerrada sem pontos e sem poder."
        : "Três moedas tocaram o chão: vidas esgotadas e rodada encerrada.",
  });
}
