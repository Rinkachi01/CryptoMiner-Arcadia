import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../../identity-server";
import { readDailyGamePowerBudget, reserveDailyGamePower } from "../../../game-emission-budget";
import { BONUS_POWER_DROP_REQUEST_GH, shouldAwardBonusPower } from "../../../game-power-bonus";
import {
  arcadeDifficultyAfterInactivity,
  arcadePowerDurationDays,
  arcadePowerExpiresAt,
  nextArcadeDifficulty,
} from "../../../arcade-progression-rules";
import { readActivePcLevel } from "../../../pc-progression-server";
import { detectAutomationPattern, guardArcadeAction, rejectAutomatedSession } from "../../../security-server";
import {
  createCrypto2048Board,
  crypto2048CooldownSeconds,
  crypto2048DurationMs,
  crypto2048RewardPower,
  crypto2048TargetScore,
  CRYPTO_2048_DAILY_LIMIT,
  CRYPTO_2048_HOURLY_LIMIT,
  CRYPTO_2048_MAX_EVENTS,
  replayCrypto2048,
  type Crypto2048Move,
} from "../../../crypto-2048-rules";

export const dynamic = "force-dynamic";

const GAME_ID = "crypto-2048";

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
  updated_at: number;
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
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_nonce_unique ON game_sessions (nonce)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS game_sessions_account_started_idx ON game_sessions (account_id, started_at)`),
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
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS game_progress_account_game_unique ON game_progress (account_id, game_id)`),
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
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS temporary_power_source_unique ON temporary_power_grants (source_session_id)`),
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
  await readActivePcLevel(db, accountId, now);
  await db.prepare(`
    INSERT OR IGNORE INTO game_progress (
      account_id, game_id, level, win_streak, next_play_at,
      total_plays, total_wins, updated_at
    ) VALUES (?, ?, 1, 0, 0, 0, 0, ?)
  `).bind(accountId, GAME_ID, now).run();
  const stored = await db.prepare(`
    SELECT level, next_play_at, updated_at FROM game_progress
    WHERE account_id = ? AND game_id = ?
  `).bind(accountId, GAME_ID).first<ProgressRow>();
  if (!stored) return null;
  const effectiveLevel = arcadeDifficultyAfterInactivity(stored.level, stored.updated_at, now);
  if (effectiveLevel !== stored.level) {
    await db.prepare(`UPDATE game_progress SET level = ?, win_streak = 0, updated_at = ? WHERE account_id = ? AND game_id = ?`)
      .bind(effectiveLevel, now, accountId, GAME_ID).run();
  }
  return { ...stored, level: effectiveLevel, updated_at: now };
}

async function usage(db: D1Database, accountId: string, now: number) {
  const row = await db.prepare(`
    SELECT
      SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS hour_count,
      SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS day_count
    FROM game_sessions WHERE account_id = ? AND game_id = ?
  `).bind(now - 60 * 60 * 1000, now - 24 * 60 * 60 * 1000, accountId, GAME_ID)
    .first<{ hour_count: number | null; day_count: number | null }>();
  return {
    hourRemaining: Math.max(0, CRYPTO_2048_HOURLY_LIMIT - Number(row?.hour_count ?? 0)),
    dayRemaining: Math.max(0, CRYPTO_2048_DAILY_LIMIT - Number(row?.day_count ?? 0)),
  };
}

async function activeTemporaryPower(db: D1Database, accountId: string, now: number) {
  const row = await db.prepare(`
    SELECT COALESCE(SUM(power_gh), 0) AS total FROM temporary_power_grants
    WHERE account_id = ? AND starts_at <= ? AND expires_at > ?
  `).bind(accountId, now, now).first<{ total: number }>();
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
    targetScore: crypto2048TargetScore(gameProgress?.level ?? 1),
  });
}

export async function POST(request: Request) {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    sessionId?: unknown;
    nonce?: unknown;
    outcome?: unknown;
    events?: unknown;
    durationMs?: unknown;
  } | null;
  if (!body || (body.action !== "start" && body.action !== "finish")) {
    return json({ error: "Ação do Crypto 2048 inválida." }, 400);
  }

  const now = Date.now();
  const gate = await guardArcadeAction(current.db, current.accountId, body.action === "start" ? "start" : "submit", env, now);
  if (!gate.allowed) return json(gate, gate.status);

  if (body.action === "start") {
    await current.db.prepare(`
      UPDATE game_sessions SET status = 'expired', review_reason = 'Tempo do Crypto 2048 encerrado.'
      WHERE account_id = ? AND game_id = ? AND status = 'active' AND expires_at <= ?
    `).bind(current.accountId, GAME_ID, now).run();
    const active = await current.db.prepare(`
      SELECT id FROM game_sessions WHERE account_id = ? AND game_id = ?
      AND status = 'active' AND expires_at > ?
    `).bind(current.accountId, GAME_ID, now).first<{ id: string }>();
    if (active) return json({ error: "Já existe uma partida Crypto 2048 ativa." }, 409);
    const gameProgress = await progress(current.db, current.accountId, now);
    if (gameProgress && gameProgress.next_play_at > now) {
      return json({ error: "O Crypto 2048 ainda está em recarga.", difficulty: gameProgress.level, nextPlayAt: gameProgress.next_play_at }, 429);
    }
    const limits = await usage(current.db, current.accountId, now);
    if (limits.hourRemaining === 0 || limits.dayRemaining === 0) {
      return json({ error: "Limite seguro do Crypto 2048 alcançado.", limits }, 429);
    }
    const difficulty = gameProgress?.level ?? 1;
    const durationMs = crypto2048DurationMs(difficulty);
    const seed = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const board = createCrypto2048Board(seed, difficulty);
    await current.db.batch([
      current.db.prepare(`
        INSERT INTO game_sessions (id, account_id, game_id, nonce, seed, status,
          started_at, expires_at, proof_json, difficulty)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).bind(sessionId, current.accountId, GAME_ID, nonce, seed, now,
        now + durationMs + 20_000, JSON.stringify({ boardSize: 4 }), difficulty),
      current.db.prepare(`
        UPDATE game_progress SET total_plays = total_plays + 1, updated_at = ?
        WHERE account_id = ? AND game_id = ?
      `).bind(now, current.accountId, GAME_ID),
    ]);
    return json({
      sessionId,
      nonce,
      seed,
      difficulty,
      durationMs,
      board,
      targetScore: crypto2048TargetScore(difficulty),
      limits: { hourRemaining: limits.hourRemaining - 1, dayRemaining: limits.dayRemaining - 1 },
    });
  }

  if (typeof body.sessionId !== "string" || typeof body.nonce !== "string" ||
      !Array.isArray(body.events) || body.events.length > CRYPTO_2048_MAX_EVENTS ||
      !Number.isInteger(body.durationMs) ||
      (body.outcome !== "complete" && body.outcome !== "gameover" && body.outcome !== "timeout")) {
    return json({ error: "Resultado do Crypto 2048 inválido." }, 400);
  }
  const session = await current.db.prepare(`
    SELECT id, nonce, seed, status, started_at, expires_at, difficulty
    FROM game_sessions WHERE id = ? AND account_id = ? AND game_id = ?
  `).bind(body.sessionId, current.accountId, GAME_ID).first<SessionRow>();
  if (!session || session.status !== "active" || session.nonce !== body.nonce || now > session.expires_at) {
    return json({ error: "Partida expirada ou já encerrada." }, 409);
  }
  const durationLimit = crypto2048DurationMs(session.difficulty);
  const durationMs = Number(body.durationMs);
  if (durationMs < 0 || durationMs > durationLimit + 1_500) return json({ error: "Duração da partida inválida." }, 400);
  const serverElapsed = Math.max(0, now - session.started_at);
  if (durationMs > serverElapsed + 1_500) return json({ error: "O relógio informa um tempo futuro." }, 400);
  const events = body.events as Crypto2048Move[];
  const replay = replayCrypto2048(session.seed, session.difficulty, events);
  if (!replay.valid) return json({ error: replay.reason ?? "Replay inválido." }, 400);
  if (replay.lastMoveAt > durationMs + 250) return json({ error: "O relógio não corresponde aos movimentos enviados." }, 400);
  const automationReason = detectAutomationPattern(events.map((event) => event.atMs));
  if (automationReason && events.length > 3) {
    await rejectAutomatedSession(current.db, current.accountId, session.id, durationMs, automationReason, now);
    return json({ error: automationReason, review: true }, 400);
  }
  const complete = body.outcome === "complete";
  const timeout = body.outcome === "timeout";
  const targetScore = crypto2048TargetScore(session.difficulty);
  if (complete && replay.score < targetScore) {
    return json({ error: `A meta de ${targetScore} pontos ainda não foi alcançada.` }, 400);
  }
  if (timeout && durationMs < durationLimit - 1_500) {
    return json({ error: "O cronômetro ainda não terminou." }, 400);
  }
  if (!complete && !timeout && !replay.gameOver) {
    return json({ error: "O tabuleiro ainda possui movimentos possíveis." }, 400);
  }
  const verifiedDurationMs = Math.max(durationMs, Math.min(durationLimit, serverElapsed));
  const nextPlayAtOnFailure = now + 45_000;
  if (!complete) {
    const update = await current.db.prepare(`
      UPDATE game_sessions SET status = 'failed', completed_at = ?, duration_ms = ?, score = ?,
        reward_power_gh = 0, review_reason = ?
      WHERE id = ? AND status = 'active'
    `).bind(now, verifiedDurationMs, replay.score,
      timeout ? "Tempo esgotado antes da meta." : "Tabuleiro sem movimentos.", session.id).run();
    if ((update.meta.changes ?? 0) !== 1) return json({ error: "Resultado já processado." }, 409);
    await current.db.prepare(`UPDATE game_progress SET win_streak = 0, next_play_at = ?, updated_at = ? WHERE account_id = ? AND game_id = ?`)
      .bind(nextPlayAtOnFailure, now, current.accountId, GAME_ID).run();
    return json({
      outcome: timeout ? "timeout" : "gameover",
      score: replay.score,
      maxRank: replay.maxRank,
      targetScore,
      rewardPowerGh: 0,
      nextDifficulty: session.difficulty,
      nextPlayAt: nextPlayAtOnFailure,
      limits: await usage(current.db, current.accountId, now),
      message: timeout
        ? `Tempo esgotado antes da meta de ${targetScore} pontos. Nenhum poder foi concedido.`
        : "Tabuleiro bloqueado. Nenhum poder foi concedido.",
    });
  }

  const requestedRewardPowerGh = crypto2048RewardPower(replay.score, session.difficulty, replay.maxRank);
  const update = await current.db.prepare(`
    UPDATE game_sessions SET status = 'completed', completed_at = ?, duration_ms = ?, score = ?, reward_power_gh = 0
    WHERE id = ? AND status = 'active'
  `).bind(now, verifiedDurationMs, replay.score, session.id).run();
  if ((update.meta.changes ?? 0) !== 1) return json({ error: "Conclusão já processada." }, 409);
  let emissionBudget = await reserveDailyGamePower(current.db, current.accountId, requestedRewardPowerGh, now);
  let rewardPowerGh = emissionBudget.awardedPowerGh;
  let drop = null;
  if (shouldAwardBonusPower()) {
    const dropBudget = await reserveDailyGamePower(current.db, current.accountId, BONUS_POWER_DROP_REQUEST_GH, now);
    rewardPowerGh += dropBudget.awardedPowerGh;
    if (dropBudget.awardedPowerGh > 0) drop = { type: "power", quantity: dropBudget.awardedPowerGh };
    emissionBudget = await readDailyGamePowerBudget(current.db, current.accountId, now);
  }
  await current.db.prepare(`UPDATE game_sessions SET reward_power_gh = ? WHERE id = ?`).bind(rewardPowerGh, session.id).run();
  const wins = await current.db.prepare(`
    SELECT COUNT(*) AS total FROM game_sessions
    WHERE account_id = ? AND game_id = ? AND status = 'completed' AND completed_at >= ?
  `).bind(current.accountId, GAME_ID, now - 24 * 60 * 60 * 1000).first<{ total: number }>();
  const cooldownSeconds = crypto2048CooldownSeconds(Number(wins?.total ?? 0), session.difficulty);
  const nextPlayAt = now + cooldownSeconds * 1000;
  const nextDifficulty = nextArcadeDifficulty(session.difficulty);
  const pcLevel = await readActivePcLevel(current.db, current.accountId, now);
  const powerExpiresAt = arcadePowerExpiresAt(now, pcLevel);
  const powerDurationDays = arcadePowerDurationDays(pcLevel);
  await current.db.prepare(`
    UPDATE game_progress SET level = ?, win_streak = win_streak + 1, next_play_at = ?,
      total_wins = total_wins + 1, updated_at = ?
    WHERE account_id = ? AND game_id = ?
  `).bind(nextDifficulty, nextPlayAt, now, current.accountId, GAME_ID).run();
  if (rewardPowerGh > 0) {
    await current.db.prepare(`INSERT INTO temporary_power_grants
      (id, account_id, source_session_id, power_gh, starts_at, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), current.accountId, session.id, rewardPowerGh, now, powerExpiresAt, now).run();
  }
  return json({
    outcome: "completed",
    score: replay.score,
    maxRank: replay.maxRank,
    targetScore,
    rewardPowerGh,
    drop,
    emissionBudget,
    temporaryPowerGh: await activeTemporaryPower(current.db, current.accountId, now),
    nextDifficulty,
    powerDurationDays,
    nextPlayAt,
    cooldownSeconds,
    limits: await usage(current.db, current.accountId, now),
    message: emissionBudget.paused
      ? "Crypto 2048 concluído. O poder temporário está pausado pelo operador."
      : emissionBudget.limited
        ? "Crypto 2048 concluído. O orçamento diário limitou parte do poder."
        : `Crypto 2048 nível ${session.difficulty} concluído.`,
  });
}
