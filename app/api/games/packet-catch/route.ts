import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  PACKET_CATCH_DAILY_LIMIT,
  PACKET_CATCH_DURATION_MS,
  PACKET_CATCH_HOURLY_LIMIT,
  PACKET_CATCH_POWER_DURATION_HOURS,
  createPacketTargets,
  packetCatchRewardPower,
  scorePacketCatch,
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

async function ensurePacketCatchSchema(db: D1Database) {
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
        proof_json TEXT DEFAULT '{}' NOT NULL
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
  await ensurePacketCatchSchema(env.DB);
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
  const hourStart = now - 60 * 60 * 1000;
  const dayStart = now - 24 * 60 * 60 * 1000;
  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS hour_count,
         SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS day_count
       FROM game_sessions
       WHERE account_id = ? AND game_id = 'packet-catch'`,
    )
    .bind(hourStart, dayStart, accountId)
    .first<{ hour_count: number | null; day_count: number | null }>();
  const hourCount = Number(row?.hour_count ?? 0);
  const dayCount = Number(row?.day_count ?? 0);
  return {
    hourCount,
    dayCount,
    hourRemaining: Math.max(0, PACKET_CATCH_HOURLY_LIMIT - hourCount),
    dayRemaining: Math.max(0, PACKET_CATCH_DAILY_LIMIT - dayCount),
  };
}

export async function GET() {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const now = Date.now();
  return json({
    serverTime: now,
    limits: await usage(current.db, current.accountId, now),
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

    const limits = await usage(current.db, current.accountId, now);
    if (limits.hourRemaining === 0 || limits.dayRemaining === 0) {
      return json(
        {
          error: "Limite seguro de partidas alcançado.",
          limits,
        },
        429,
      );
    }

    const sessionId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const seed = crypto.randomUUID();
    const expiresAt = now + 70_000;
    await current.db
      .prepare(
        `INSERT INTO game_sessions (
          id, account_id, game_id, nonce, seed, status,
          started_at, expires_at, proof_json
        ) VALUES (?, ?, 'packet-catch', ?, ?, 'active', ?, ?, '{}')`,
      )
      .bind(
        sessionId,
        current.accountId,
        nonce,
        seed,
        now,
        expiresAt,
      )
      .run();

    return json({
      sessionId,
      nonce,
      startedAt: now,
      expiresAt,
      durationMs: PACKET_CATCH_DURATION_MS,
      targets: createPacketTargets(seed),
      limits: {
        ...limits,
        hourRemaining: limits.hourRemaining - 1,
        dayRemaining: limits.dayRemaining - 1,
      },
    });
  }

  if (
    typeof body.sessionId !== "string" ||
    typeof body.nonce !== "string" ||
    typeof body.durationMs !== "number" ||
    !Array.isArray(body.events) ||
    body.events.length > 18
  ) {
    return json({ error: "Comprovante da partida inválido." }, 400);
  }

  const session = await current.db
    .prepare(
      `SELECT id, nonce, seed, status, started_at, expires_at
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

  const durationMs = Math.floor(body.durationMs);
  const serverElapsed = now - session.started_at;
  if (
    durationMs < 28_000 ||
    durationMs > 40_000 ||
    serverElapsed < 26_000 ||
    serverElapsed > 70_000
  ) {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'rejected', completed_at = ?, duration_ms = ?,
             risk_level = 'review', review_reason = 'Duração incompatível.'
         WHERE id = ? AND status = 'active'`,
      )
      .bind(now, durationMs, session.id)
      .run();
    return json({ error: "Duração da partida incompatível." }, 400);
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

  const scoreResult = scorePacketCatch(session.seed, events);
  if (!scoreResult.valid) {
    await current.db
      .prepare(
        `UPDATE game_sessions
         SET status = 'rejected', completed_at = ?, duration_ms = ?,
             risk_level = 'review', review_reason = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(now, durationMs, scoreResult.reason, session.id)
      .run();
    return json({ error: scoreResult.reason }, 400);
  }

  const rewardPowerGh = packetCatchRewardPower(scoreResult.score);
  const update = await current.db
    .prepare(
      `UPDATE game_sessions
       SET status = 'completed', completed_at = ?, duration_ms = ?,
           score = ?, reward_power_gh = ?, proof_json = ?
       WHERE id = ? AND status = 'active'`,
    )
    .bind(
      now,
      durationMs,
      scoreResult.score,
      rewardPowerGh,
      JSON.stringify({ events, validHits: scoreResult.validHits }),
      session.id,
    )
    .run();
  if ((update.meta.changes ?? 0) !== 1) {
    return json({ error: "Esta partida já foi processada." }, 409);
  }

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
    score: scoreResult.score,
    validHits: scoreResult.validHits,
    corruptHits: scoreResult.corruptHits,
    rewardPowerGh,
    powerExpiresAt: rewardPowerGh > 0 ? powerExpiresAt : null,
    temporaryPowerGh: await activeTemporaryPower(
      current.db,
      current.accountId,
      now,
    ),
    limits: await usage(current.db, current.accountId, now),
    message:
      rewardPowerGh > 0
        ? `Partida validada: +${rewardPowerGh} GH/s por 6 horas.`
        : "Partida validada. Alcance 40 pontos para ganhar poder temporário.",
  });
}
