import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { reserveDailyGamePower } from "../../../game-emission-budget";
import {
  HASH_MATCH_DAILY_LIMIT,
  HASH_MATCH_HOURLY_LIMIT,
  HASH_MATCH_POWER_DURATION_HOURS,
  createHashMatchProof,
  gameCooldownSeconds,
  hashMatchDurationMs,
  hashMatchPairCount,
  hashMatchRewardPower,
  revealHashCard,
  type HashMatchProof,
} from "../../../hash-match-rules";
import { MAX_GAME_DIFFICULTY } from "../../../packet-catch-rules";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  nonce: string;
  status: string;
  started_at: number;
  expires_at: number;
  difficulty: number;
  proof_json: string;
};

type ProgressRow = {
  level: number;
  next_play_at: number;
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
      ) VALUES (?, 'hash-match', 1, 0, 0, 0, 0, ?)`,
    )
    .bind(accountId, now)
    .run();
  return db
    .prepare(
      `SELECT level, next_play_at FROM game_progress
       WHERE account_id = ? AND game_id = 'hash-match'`,
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
       WHERE account_id = ? AND game_id = 'hash-match'`,
    )
    .bind(now - 60 * 60 * 1000, now - 24 * 60 * 60 * 1000, accountId)
    .first<{ hour_count: number | null; day_count: number | null }>();
  return {
    hourRemaining: Math.max(
      0,
      HASH_MATCH_HOURLY_LIMIT - Number(row?.hour_count ?? 0),
    ),
    dayRemaining: Math.max(
      0,
      HASH_MATCH_DAILY_LIMIT - Number(row?.day_count ?? 0),
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
        cardId?: unknown;
      }
    | null;
  if (
    !body ||
    (body.action !== "start" &&
      body.action !== "flip" &&
      body.action !== "timeout")
  ) {
    return json({ error: "Ação de memória inválida." }, 400);
  }

  const now = Date.now();
  if (body.action === "start") {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'expired', review_reason = 'Tempo do tabuleiro encerrado.'
         WHERE account_id = ? AND game_id = 'hash-match'
           AND status = 'active' AND expires_at <= ?`,
      )
      .bind(current.accountId, now)
      .run();
    const active = await current.db
      .prepare(
        `SELECT id FROM game_sessions
         WHERE account_id = ? AND game_id = 'hash-match'
           AND status = 'active' AND expires_at > ?`,
      )
      .bind(current.accountId, now)
      .first<{ id: string }>();
    if (active) {
      return json({ error: "Já existe um tabuleiro ativo." }, 409);
    }

    const gameProgress = await progress(current.db, current.accountId, now);
    if (gameProgress && gameProgress.next_play_at > now) {
      return json(
        {
          error: "O Hash Match ainda está em recarga.",
          difficulty: gameProgress.level,
          nextPlayAt: gameProgress.next_play_at,
        },
        429,
      );
    }
    const limits = await usage(current.db, current.accountId, now);
    if (limits.hourRemaining === 0 || limits.dayRemaining === 0) {
      return json({ error: "Limite seguro do Hash Match alcançado.", limits }, 429);
    }

    const difficulty = gameProgress?.level ?? 1;
    const durationMs = hashMatchDurationMs(difficulty);
    const seed = crypto.randomUUID();
    const proof = createHashMatchProof(seed, difficulty);
    const sessionId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    await current.db.batch([
      current.db
        .prepare(
          `INSERT INTO game_sessions (
            id, account_id, game_id, nonce, seed, status,
            started_at, expires_at, proof_json, difficulty
          ) VALUES (?, ?, 'hash-match', ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .bind(
          sessionId,
          current.accountId,
          nonce,
          seed,
          now,
          now + durationMs + 25_000,
          JSON.stringify(proof),
          difficulty,
        ),
      current.db
        .prepare(
          `UPDATE game_progress
           SET total_plays = total_plays + 1, updated_at = ?
           WHERE account_id = ? AND game_id = 'hash-match'`,
        )
        .bind(now, current.accountId),
    ]);

    return json({
      sessionId,
      nonce,
      difficulty,
      durationMs,
      cards: proof.deck.map((card) => ({ id: card.id })),
      limits: {
        hourRemaining: limits.hourRemaining - 1,
        dayRemaining: limits.dayRemaining - 1,
      },
    });
  }

  if (
    typeof body.sessionId !== "string" ||
    typeof body.nonce !== "string"
  ) {
    return json({ error: "Sessão de memória inválida." }, 400);
  }
  const session = await current.db
    .prepare(
      `SELECT id, nonce, status, started_at, expires_at, difficulty, proof_json
       FROM game_sessions
       WHERE id = ? AND account_id = ? AND game_id = 'hash-match'`,
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

  if (body.action === "timeout") {
    const durationMs = hashMatchDurationMs(session.difficulty);
    if (now - session.started_at < durationMs - 1_500) {
      return json({ error: "O tabuleiro ainda possui tempo." }, 400);
    }
    const nextPlayAt = now + 45_000;
    await current.db.batch([
      current.db
        .prepare(
          `UPDATE game_sessions
           SET status = 'failed', completed_at = ?, duration_ms = ?,
               score = 0, reward_power_gh = 0,
               review_reason = 'Tempo esgotado.'
           WHERE id = ? AND status = 'active'`,
        )
        .bind(now, durationMs, session.id),
      current.db
        .prepare(
          `UPDATE game_progress
           SET win_streak = 0, next_play_at = ?, updated_at = ?
           WHERE account_id = ? AND game_id = 'hash-match'`,
        )
        .bind(nextPlayAt, now, current.accountId),
    ]);
    return json({
      outcome: "timeout",
      rewardPowerGh: 0,
      nextPlayAt,
      message: "Tempo esgotado. O tabuleiro não concedeu poder.",
    });
  }

  if (typeof body.cardId !== "string") {
    return json({ error: "Carta inválida." }, 400);
  }
  const proof = JSON.parse(session.proof_json) as HashMatchProof;
  const originalProofJson = session.proof_json;
  if (
    now - proof.lastFlipAt < 90 ||
    proof.matchedCardIds.includes(body.cardId) ||
    proof.openCardId === body.cardId
  ) {
    return json({ error: "Virada de carta recusada." }, 400);
  }
  const revealed = revealHashCard(proof, body.cardId);
  if (!revealed) return json({ error: "Carta não pertence ao tabuleiro." }, 400);
  proof.lastFlipAt = now;

  if (!proof.openCardId) {
    proof.openCardId = body.cardId;
    const update = await current.db
      .prepare(
        `UPDATE game_sessions SET proof_json = ?
         WHERE id = ? AND status = 'active' AND proof_json = ?`,
      )
      .bind(JSON.stringify(proof), session.id, originalProofJson)
      .run();
    if ((update.meta.changes ?? 0) !== 1) {
      return json({ error: "Outra carta foi processada primeiro." }, 409);
    }
    return json({
      reveals: [revealed],
      matched: false,
      completed: false,
      moves: proof.moves,
    });
  }

  const firstReveal = revealHashCard(proof, proof.openCardId);
  if (!firstReveal) return json({ error: "Estado do tabuleiro inválido." }, 500);
  const isMatch = firstReveal.coinId === revealed.coinId;
  proof.moves += 1;
  if (isMatch) {
    proof.matchedCardIds.push(firstReveal.cardId, revealed.cardId);
  }
  proof.openCardId = null;
  const completed = proof.matchedCardIds.length === proof.deck.length;

  if (!completed) {
    const update = await current.db
      .prepare(
        `UPDATE game_sessions SET proof_json = ?
         WHERE id = ? AND status = 'active' AND proof_json = ?`,
      )
      .bind(JSON.stringify(proof), session.id, originalProofJson)
      .run();
    if ((update.meta.changes ?? 0) !== 1) {
      return json({ error: "Outra carta foi processada primeiro." }, 409);
    }
    return json({
      reveals: [firstReveal, revealed],
      matched: isMatch,
      matchedCardIds: isMatch ? [firstReveal.cardId, revealed.cardId] : [],
      completed: false,
      moves: proof.moves,
    });
  }

  const pairs = hashMatchPairCount(session.difficulty);
  const score = Math.max(0, pairs * 100 - Math.max(0, proof.moves - pairs) * 15);
  const requestedRewardPowerGh = hashMatchRewardPower(
    session.difficulty,
    pairs,
    proof.moves,
  );
  const update = await current.db
    .prepare(
      `UPDATE game_sessions
       SET status = 'completed', completed_at = ?, duration_ms = ?,
           score = ?, reward_power_gh = ?, proof_json = ?
       WHERE id = ? AND status = 'active' AND proof_json = ?`,
    )
    .bind(
      now,
      now - session.started_at,
      score,
      0,
      JSON.stringify(proof),
      session.id,
      originalProofJson,
    )
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
    .prepare(
      `UPDATE game_sessions
       SET reward_power_gh = ?
       WHERE id = ? AND status = 'completed'`,
    )
    .bind(rewardPowerGh, session.id)
    .run();

  const wins = await current.db
    .prepare(
      `SELECT COUNT(*) AS total FROM game_sessions
       WHERE account_id = ? AND game_id = 'hash-match'
         AND status = 'completed' AND completed_at >= ?`,
    )
    .bind(current.accountId, now - 24 * 60 * 60 * 1000)
    .first<{ total: number }>();
  const cooldownSeconds = gameCooldownSeconds(
    Number(wins?.total ?? 0),
    session.difficulty,
  );
  const nextPlayAt = now + cooldownSeconds * 1000;
  const nextDifficulty = Math.min(
    MAX_GAME_DIFFICULTY,
    session.difficulty + 1,
  );
  const powerExpiresAt =
    now + HASH_MATCH_POWER_DURATION_HOURS * 60 * 60 * 1000;
  await current.db
    .prepare(
      `UPDATE game_progress
       SET level = ?, win_streak = win_streak + 1,
           next_play_at = ?, total_wins = total_wins + 1, updated_at = ?
       WHERE account_id = ? AND game_id = 'hash-match'`,
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
    reveals: [firstReveal, revealed],
    matched: true,
    matchedCardIds: [firstReveal.cardId, revealed.cardId],
    completed: true,
    score,
    moves: proof.moves,
    rewardPowerGh,
    emissionBudget,
    temporaryPowerGh: await activeTemporaryPower(
      current.db,
      current.accountId,
      now,
    ),
    difficulty: session.difficulty,
    nextDifficulty,
    nextPlayAt,
    cooldownSeconds,
    message: emissionBudget.paused
      ? `Hash Match nível ${session.difficulty} concluído. O poder temporário está pausado pelo operador.`
      : emissionBudget.limited
      ? `Hash Match nível ${session.difficulty} concluído. O orçamento diário limitou parte do poder.`
      : `Hash Match nível ${session.difficulty} concluído.`,
  });
}
