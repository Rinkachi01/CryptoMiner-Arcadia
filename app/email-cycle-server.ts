import { dailyResetWindow, dailyWindowKey } from "./daily-reset-rules.ts";
import {
  deliverEmailCycleCode,
  readSupportEmailConfig,
} from "./support-email-server.ts";

export const EMAIL_CYCLE_CODE_TTL_MS = 10 * 60_000;
export const EMAIL_CYCLE_RESEND_COOLDOWN_MS = 60_000;
export const EMAIL_CYCLE_MAX_ATTEMPTS = 5;

type EmailCycleEnvironment = {
  DB?: D1Database;
  EMAIL_CYCLE_SECRET?: string;
  GOOGLE_MAIL_WEBHOOK_SECRET?: string;
  EMAIL_CYCLE_VERIFICATION_REQUIRED?: string;
  [key: string]: unknown;
};

type EmailCycleRow = {
  account_id: string;
  cycle_key: string;
  verified_at: number | null;
  requested_at: number | null;
  attempts: number;
  code_hash: string | null;
  code_expires_at: number | null;
  updated_at: number;
};

function setting(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function secretFor(environment: unknown) {
  const source = (environment ?? {}) as EmailCycleEnvironment;
  return setting(source.EMAIL_CYCLE_SECRET) || setting(source.GOOGLE_MAIL_WEBHOOK_SECRET);
}

export function emailCycleIsEnabled(environment: unknown) {
  const source = (environment ?? {}) as EmailCycleEnvironment;
  const requested = setting(source.EMAIL_CYCLE_VERIFICATION_REQUIRED).toLowerCase() === "true";
  const email = readSupportEmailConfig(source);
  return requested && Boolean(secretFor(source)) && email.enabled;
}

export async function ensureEmailCycleSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS email_cycle_verifications (
        account_id TEXT PRIMARY KEY,
        cycle_key TEXT NOT NULL,
        verified_at INTEGER,
        requested_at INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        code_hash TEXT,
        code_expires_at INTEGER,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_email_cycle_verifications_cycle ON email_cycle_verifications(cycle_key)",
    ),
  ]);
}

function safeNow(now: number) {
  return Number.isFinite(now) ? now : Date.now();
}

async function rowFor(db: D1Database, accountId: string) {
  return db
    .prepare(
      `SELECT account_id, cycle_key, verified_at, requested_at, attempts,
              code_hash, code_expires_at, updated_at
         FROM email_cycle_verifications
        WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<EmailCycleRow>();
}

export async function readEmailCycleStatus(
  db: D1Database,
  accountId: string,
  now = Date.now(),
) {
  const current = safeNow(now);
  const window = dailyResetWindow(current);
  const row = await rowFor(db, accountId);
  const verified = row?.cycle_key === window.windowKey && Boolean(row.verified_at);
  const requestedAt = row?.cycle_key === window.windowKey ? row.requested_at : null;
  return {
    cycleKey: window.windowKey,
    resetAt: window.resetAt,
    verified,
    requestedAt,
    retryAt: requestedAt ? requestedAt + EMAIL_CYCLE_RESEND_COOLDOWN_MS : null,
  };
}

async function hashCode(
  secret: string,
  accountId: string,
  cycleKey: string,
  code: string,
) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}\u0000${accountId}\u0000${cycleKey}\u0000${code}`),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function randomCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export async function requestEmailCycleCode(
  db: D1Database,
  accountId: string,
  email: string,
  environment: unknown,
  now = Date.now(),
) {
  const current = safeNow(now);
  const cycleKey = dailyWindowKey(current);
  const row = await rowFor(db, accountId);
  if (row?.cycle_key === cycleKey && row.verified_at) {
    return { ok: true as const, status: "verified" as const, cycleKey };
  }
  if (
    row?.cycle_key === cycleKey &&
    row.requested_at &&
    current - row.requested_at < EMAIL_CYCLE_RESEND_COOLDOWN_MS
  ) {
    return {
      ok: false as const,
      status: "cooldown" as const,
      cycleKey,
      retryAt: row.requested_at + EMAIL_CYCLE_RESEND_COOLDOWN_MS,
    };
  }

  const secret = secretFor(environment);
  if (!secret || !emailCycleIsEnabled(environment)) {
    return { ok: false as const, status: "configuration_pending" as const };
  }

  const code = randomCode();
  const codeHash = await hashCode(secret, accountId, cycleKey, code);
  const expiresAt = current + EMAIL_CYCLE_CODE_TTL_MS;
  await db
    .prepare(
      `INSERT INTO email_cycle_verifications
        (account_id, cycle_key, verified_at, requested_at, attempts, code_hash, code_expires_at, updated_at)
       VALUES (?, ?, NULL, ?, 0, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         cycle_key = excluded.cycle_key,
         verified_at = NULL,
         requested_at = excluded.requested_at,
         attempts = 0,
         code_hash = excluded.code_hash,
         code_expires_at = excluded.code_expires_at,
         updated_at = excluded.updated_at`,
    )
    .bind(accountId, cycleKey, current, codeHash, expiresAt, current)
    .run();

  const delivery = await deliverEmailCycleCode(environment, {
    accountId,
    code,
    email,
    expiresAt,
    cycleKey,
  });
  if (delivery.status !== "sent") {
    await db
      .prepare(
        `UPDATE email_cycle_verifications
            SET requested_at = NULL, code_hash = NULL, code_expires_at = NULL,
                attempts = 0, updated_at = ?
          WHERE account_id = ? AND cycle_key = ?`,
      )
      .bind(current, accountId, cycleKey)
      .run();
    return { ok: false as const, status: delivery.status };
  }
  return {
    ok: true as const,
    status: "sent" as const,
    cycleKey,
    expiresAt,
    retryAt: current + EMAIL_CYCLE_RESEND_COOLDOWN_MS,
  };
}

export async function verifyEmailCycleCode(
  db: D1Database,
  accountId: string,
  code: string,
  environment: unknown,
  now = Date.now(),
) {
  const current = safeNow(now);
  const cycleKey = dailyWindowKey(current);
  const row = await rowFor(db, accountId);
  if (row?.cycle_key === cycleKey && row.verified_at) {
    return { ok: true as const, status: "verified" as const, cycleKey };
  }
  if (
    !row ||
    row.cycle_key !== cycleKey ||
    !row.code_hash ||
    !row.code_expires_at ||
    row.code_expires_at <= current
  ) {
    return { ok: false as const, status: "invalid_or_expired" as const };
  }
  if (row.attempts >= EMAIL_CYCLE_MAX_ATTEMPTS) {
    return { ok: false as const, status: "too_many_attempts" as const };
  }
  await db
    .prepare(
      "UPDATE email_cycle_verifications SET attempts = attempts + 1, updated_at = ? WHERE account_id = ? AND cycle_key = ?",
    )
    .bind(current, accountId, cycleKey)
    .run();

  const secret = secretFor(environment);
  if (!secret || !/^\d{6}$/.test(code)) {
    return { ok: false as const, status: "invalid_or_expired" as const };
  }
  const expected = await hashCode(secret, accountId, cycleKey, code);
  if (expected !== row.code_hash) {
    return {
      ok: false as const,
      status:
        row.attempts + 1 >= EMAIL_CYCLE_MAX_ATTEMPTS
          ? ("too_many_attempts" as const)
          : ("invalid_code" as const),
    };
  }
  await db
    .prepare(
      `UPDATE email_cycle_verifications
          SET verified_at = ?, code_hash = NULL, code_expires_at = NULL,
              requested_at = NULL, attempts = 0, updated_at = ?
        WHERE account_id = ? AND cycle_key = ?`,
    )
    .bind(current, current, accountId, cycleKey)
    .run();
  return { ok: true as const, status: "verified" as const, cycleKey };
}
