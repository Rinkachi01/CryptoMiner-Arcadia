const ARCADE_PASS_MS = 4 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const ACTION_LIMITS = {
  start: 10,
  submit: 160,
  verify: 6,
} as const;

type ArcadeAction = keyof typeof ACTION_LIMITS;

type SecurityEnvironment = {
  TURNSTILE_HOSTNAME?: string;
  TURNSTILE_REQUIRED?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
};

type TurnstileResult = {
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  success?: boolean;
  "error-codes"?: string[];
};

export type ArcadeSecurityStatus = {
  configured: boolean;
  passExpiresAt: number | null;
  required: boolean;
  siteKey: string | null;
  verified: boolean;
};

export type SecurityOverview = {
  activePasses: number;
  automationEvents24h: number;
  blockedAccounts24h: number;
  configured: boolean;
  events24h: number;
  rateLimitEvents24h: number;
  recentEvents: Array<{
    accountId: string;
    category: string;
    createdAt: number;
    reason: string;
  }>;
  required: boolean;
  status: "attention" | "critical" | "stable";
  turnstileFailures24h: number;
};

function textSetting(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readSecurityConfig(value: unknown) {
  const source = (value ?? {}) as SecurityEnvironment;
  const siteKey = textSetting(source.TURNSTILE_SITE_KEY);
  const secret = textSetting(source.TURNSTILE_SECRET);
  const hostname = textSetting(source.TURNSTILE_HOSTNAME);
  return {
    configured: Boolean(siteKey && secret),
    hostname: hostname || null,
    required: textSetting(source.TURNSTILE_REQUIRED).toLowerCase() === "true",
    secret,
    siteKey,
  };
}

export async function ensureSecuritySchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS arcade_security_passes (
      account_id TEXT PRIMARY KEY NOT NULL,
      verified_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS arcade_security_passes_expiry_idx
      ON arcade_security_passes (expires_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS security_rate_windows (
      account_id TEXT NOT NULL,
      action TEXT NOT NULL,
      window_key TEXT NOT NULL,
      count INTEGER DEFAULT 0 NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS security_rate_window_unique
      ON security_rate_windows (account_id, action, window_key)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS security_rate_windows_expiry_idx
      ON security_rate_windows (expires_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      category TEXT NOT NULL,
      reason TEXT NOT NULL,
      metadata_json TEXT DEFAULT '{}' NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS security_events_created_at_idx
      ON security_events (created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS security_events_account_created_idx
      ON security_events (account_id, created_at)`),
  ]);
}

async function writeSecurityEvent(
  db: D1Database,
  accountId: string,
  category: string,
  reason: string,
  metadata: Record<string, string | number | boolean | null>,
  now: number,
) {
  await db
    .prepare(`INSERT INTO security_events (
      id, account_id, category, reason, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      accountId,
      category,
      reason.slice(0, 240),
      JSON.stringify(metadata),
      now,
    )
    .run();
}

export async function readArcadeSecurityStatus(
  db: D1Database,
  accountId: string,
  environment: unknown,
  now = Date.now(),
): Promise<ArcadeSecurityStatus> {
  await ensureSecuritySchema(db);
  const config = readSecurityConfig(environment);
  const pass = await db
    .prepare(`SELECT expires_at FROM arcade_security_passes
      WHERE account_id = ? AND expires_at > ?`)
    .bind(accountId, now)
    .first<{ expires_at: number }>();
  return {
    configured: config.configured,
    passExpiresAt: pass?.expires_at ?? null,
    required: config.required,
    siteKey: config.configured ? config.siteKey : null,
    verified: !config.required || Number(pass?.expires_at ?? 0) > now,
  };
}

export async function verifyTurnstileAndCreatePass(
  db: D1Database,
  accountId: string,
  token: string,
  environment: unknown,
  requestContext?: { expectedHostname?: string | null; remoteIp?: string | null },
  now = Date.now(),
) {
  await ensureSecuritySchema(db);
  const config = readSecurityConfig(environment);
  if (!config.configured) {
    return { ok: false as const, error: "Proteção humana ainda não configurada." };
  }
  if (!token || token.length > 2_048) {
    return { ok: false as const, error: "Resposta de verificação inválida." };
  }

  let response: Response;
  let result: TurnstileResult | null;
  try {
    response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          remoteip: requestContext?.remoteIp || undefined,
          response: token,
          secret: config.secret,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(8_000),
      },
    );
    result = (await response.json().catch(() => null)) as TurnstileResult | null;
  } catch {
    await writeSecurityEvent(
      db,
      accountId,
      "turnstile_unavailable",
      "Serviço de verificação humana indisponível.",
      {},
      now,
    );
    return {
      ok: false as const,
      error: "A verificação humana demorou demais. Tente novamente.",
    };
  }
  const expectedHostname =
    config.hostname || requestContext?.expectedHostname || null;
  const valid = Boolean(
    response.ok &&
      result?.success &&
      result.action === "arcade_access" &&
      (!expectedHostname || result.hostname === expectedHostname),
  );
  if (!valid) {
    await writeSecurityEvent(
      db,
      accountId,
      "turnstile_failed",
      "Verificação humana recusada.",
      {
        codes: (result?.["error-codes"] ?? []).slice(0, 4).join(","),
        expectedHostname,
        receivedAction: result?.action ?? null,
        receivedHostname: result?.hostname ?? null,
      },
      now,
    );
    return { ok: false as const, error: "Não foi possível confirmar a verificação humana." };
  }

  const expiresAt = now + ARCADE_PASS_MS;
  await db
    .prepare(`INSERT INTO arcade_security_passes (
      account_id, verified_at, expires_at
    ) VALUES (?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      verified_at = excluded.verified_at,
      expires_at = excluded.expires_at`)
    .bind(accountId, now, expiresAt)
    .run();
  return { ok: true as const, expiresAt };
}

export async function guardArcadeAction(
  db: D1Database,
  accountId: string,
  action: ArcadeAction,
  environment: unknown,
  now = Date.now(),
) {
  await ensureSecuritySchema(db);
  if (action === "start" || action === "verify") {
    await db.batch([
      db.prepare(`DELETE FROM arcade_security_passes WHERE expires_at <= ?`).bind(now),
      db.prepare(`DELETE FROM security_rate_windows WHERE expires_at <= ?`).bind(now),
      db.prepare(`DELETE FROM security_events WHERE created_at < ?`).bind(
        now - 30 * 24 * 60 * 60 * 1000,
      ),
    ]);
  }
  const config = readSecurityConfig(environment);
  if (action === "start" && config.required) {
    if (!config.configured) {
      return {
        allowed: false as const,
        challengeRequired: true,
        error: "O Arcade está pausado até a proteção humana ser configurada.",
        status: 503,
      };
    }
    const pass = await db
      .prepare(`SELECT expires_at FROM arcade_security_passes
        WHERE account_id = ? AND expires_at > ?`)
      .bind(accountId, now)
      .first<{ expires_at: number }>();
    if (!pass) {
      return {
        allowed: false as const,
        challengeRequired: true,
        error: "Confirme que você é humano antes de iniciar.",
        status: 403,
      };
    }
  }

  const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const windowKey = String(windowStart);
  const expiresAt = windowStart + RATE_WINDOW_MS;
  await db
    .prepare(`INSERT OR IGNORE INTO security_rate_windows (
      account_id, action, window_key, count, expires_at, updated_at
    ) VALUES (?, ?, ?, 0, ?, ?)`)
    .bind(accountId, action, windowKey, expiresAt, now)
    .run();
  const update = await db
    .prepare(`UPDATE security_rate_windows
      SET count = count + 1, updated_at = ?
      WHERE account_id = ? AND action = ? AND window_key = ? AND count < ?`)
    .bind(now, accountId, action, windowKey, ACTION_LIMITS[action])
    .run();
  if ((update.meta.changes ?? 0) !== 1) {
    await writeSecurityEvent(
      db,
      accountId,
      "rate_limit",
      "Limite global do Arcade alcançado.",
      { action, limit: ACTION_LIMITS[action], retryAt: expiresAt },
      now,
    );
    return {
      allowed: false as const,
      challengeRequired: false,
      error: "Muitas ações no Arcade. Tente novamente em alguns minutos.",
      retryAt: expiresAt,
      status: 429,
    };
  }
  return { allowed: true as const };
}

export function detectAutomationPattern(eventTimes: number[]) {
  if (eventTimes.length < 3) return null;
  const gaps = eventTimes.slice(1).map((time, index) => time - eventTimes[index]);
  if (gaps.some((gap) => gap < 0)) {
    return "Sequência de eventos fora da ordem esperada.";
  }
  if (gaps.filter((gap) => gap >= 0 && gap < 45).length >= 2) {
    return "Sequência de cliques rápida demais para interação humana.";
  }
  if (gaps.length >= 6) {
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const nearAverage = gaps.filter((gap) => Math.abs(gap - average) <= 2).length;
    if (nearAverage / gaps.length >= 0.9) {
      return "Sequência de cliques com intervalo artificialmente uniforme.";
    }
  }
  return null;
}

export async function rejectAutomatedSession(
  db: D1Database,
  accountId: string,
  sessionId: string,
  durationMs: number,
  reason: string,
  now = Date.now(),
) {
  await db
    .prepare(`UPDATE game_sessions
      SET status = 'rejected', completed_at = ?, duration_ms = ?,
          score = 0, reward_power_gh = 0, risk_level = 'review', review_reason = ?
      WHERE id = ? AND account_id = ? AND status = 'active'`)
    .bind(now, Math.max(0, Math.floor(durationMs)), reason, sessionId, accountId)
    .run();
  await writeSecurityEvent(
    db,
    accountId,
    "automation_pattern",
    reason,
    { sessionId },
    now,
  );
}

export async function readSecurityOverview(
  db: D1Database,
  environment: unknown,
  now = Date.now(),
): Promise<SecurityOverview> {
  await ensureSecuritySchema(db);
  const config = readSecurityConfig(environment);
  const [passes, events, accounts, categories, recent] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM arcade_security_passes
      WHERE expires_at > ?`).bind(now).first<{ total: number }>(),
    db.prepare(`SELECT COUNT(*) AS total FROM security_events
      WHERE created_at >= ?`).bind(now - 24 * 60 * 60 * 1000).first<{ total: number }>(),
    db.prepare(`SELECT COUNT(DISTINCT account_id) AS total FROM security_events
      WHERE created_at >= ?`).bind(now - 24 * 60 * 60 * 1000).first<{ total: number }>(),
    db.prepare(`SELECT
        SUM(CASE WHEN category = 'automation_pattern' THEN 1 ELSE 0 END) AS automation_total,
        SUM(CASE WHEN category = 'rate_limit' THEN 1 ELSE 0 END) AS rate_limit_total,
        SUM(CASE WHEN category IN ('turnstile_failed', 'turnstile_unavailable')
          THEN 1 ELSE 0 END) AS turnstile_total
      FROM security_events WHERE created_at >= ?`)
      .bind(now - 24 * 60 * 60 * 1000)
      .first<{
        automation_total: number;
        rate_limit_total: number;
        turnstile_total: number;
      }>(),
    db.prepare(`SELECT account_id, category, reason, created_at
      FROM security_events ORDER BY created_at DESC LIMIT 12`).all<{
        account_id: string;
        category: string;
        reason: string;
        created_at: number;
      }>(),
  ]);
  const automationEvents24h = Number(categories?.automation_total ?? 0);
  const rateLimitEvents24h = Number(categories?.rate_limit_total ?? 0);
  const turnstileFailures24h = Number(categories?.turnstile_total ?? 0);
  const events24h = Number(events?.total ?? 0);
  const status =
    automationEvents24h >= 5 ||
    rateLimitEvents24h >= 50 ||
    turnstileFailures24h >= 25
      ? "critical"
      : events24h >= 5 ||
          automationEvents24h > 0 ||
          rateLimitEvents24h > 0 ||
          turnstileFailures24h > 0
        ? "attention"
        : "stable";
  return {
    activePasses: Number(passes?.total ?? 0),
    automationEvents24h,
    blockedAccounts24h: Number(accounts?.total ?? 0),
    configured: config.configured,
    events24h,
    rateLimitEvents24h,
    recentEvents: recent.results.map((row) => ({
      accountId: row.account_id,
      category: row.category,
      createdAt: row.created_at,
      reason: row.reason,
    })),
    required: config.required,
    status,
    turnstileFailures24h,
  };
}
