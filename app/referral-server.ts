const REFERRAL_CODE_LENGTH = 10;

type ReferralCodeRow = {
  code: string;
};

type ReferralSummaryRow = {
  invited: number;
};

export async function ensureReferralSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS referral_codes (
        account_id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS referral_attributions (
        referred_account_id TEXT PRIMARY KEY,
        referrer_account_id TEXT NOT NULL,
        referral_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'tracked',
        attributed_at INTEGER NOT NULL,
        validated_at INTEGER,
        expires_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS referral_attributions_referrer_idx
       ON referral_attributions (referrer_account_id, attributed_at)`,
    ),
  ]);
}

function randomReferralCode() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, REFERRAL_CODE_LENGTH).toUpperCase();
}

export async function ensureReferralCode(
  db: D1Database,
  accountId: string,
  now: number,
) {
  await ensureReferralSchema(db);
  const current = await db
    .prepare("SELECT code FROM referral_codes WHERE account_id = ?")
    .bind(accountId)
    .first<ReferralCodeRow>();
  if (current?.code) return current.code;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = randomReferralCode();
    try {
      await db
        .prepare(
          `INSERT INTO referral_codes (account_id, code, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(accountId, code, now, now)
        .run();
      return code;
    } catch (error) {
      const wonRace = await db
        .prepare("SELECT code FROM referral_codes WHERE account_id = ?")
        .bind(accountId)
        .first<ReferralCodeRow>();
      if (wonRace?.code) return wonRace.code;
      if (attempt === 3) throw error;
    }
  }
  throw new Error("Não foi possível criar o código de indicação.");
}

export async function readReferralOverview(
  db: D1Database,
  accountId: string,
  origin: string,
  now: number,
) {
  const code = await ensureReferralCode(db, accountId, now);
  const summary = await db
    .prepare(
      `SELECT COUNT(*) AS invited
       FROM referral_attributions
       WHERE referrer_account_id = ?`,
    )
    .bind(accountId)
    .first<ReferralSummaryRow>();
  return {
    code,
    invited: Number(summary?.invited ?? 0),
    link: `${origin}/auth?mode=signup&ref=${encodeURIComponent(code)}`,
    proposal: {
      eligibleSpendPercent: 2,
      weeklyCapCma: 2,
      validationDays: 14,
      earningWindowDays: 60,
      status: "tracking" as const,
    },
  };
}

export async function claimReferral(
  db: D1Database,
  referredAccountId: string,
  code: string,
  now: number,
) {
  await ensureReferralSchema(db);
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8,16}$/.test(normalized)) {
    return { accepted: false, reason: "invalid" as const };
  }
  const referrer = await db
    .prepare("SELECT account_id FROM referral_codes WHERE code = ?")
    .bind(normalized)
    .first<{ account_id: string }>();
  if (!referrer || referrer.account_id === referredAccountId) {
    return { accepted: false, reason: "invalid" as const };
  }
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO referral_attributions (
        referred_account_id, referrer_account_id, referral_code, status,
        attributed_at, validated_at, expires_at
      ) VALUES (?, ?, ?, 'tracked', ?, NULL, ?)`,
    )
    .bind(
      referredAccountId,
      referrer.account_id,
      normalized,
      now,
      now + 60 * 24 * 60 * 60 * 1000,
    )
    .run();
  return {
    accepted: Number(result.meta.changes ?? 0) === 1,
    reason: Number(result.meta.changes ?? 0) === 1 ? "tracked" as const : "existing" as const,
  };
}
