import type { PublicGameState } from "./game-server.ts";

const REFERRAL_CODE_LENGTH = 10;
export const REFERRAL_MINING_SHARE_BPS = 500;
// Referral mining is intentionally bounded so a group of throwaway accounts
// cannot turn the program into an unbounded CMA faucet.
export const REFERRAL_MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;
export const REFERRAL_MIN_COMPLETED_GAMES = 3;
export const REFERRAL_MAX_CMA_PER_REFERRAL_MICROS = 250_000; // 0.25 CMA
export const REFERRAL_WEEKLY_CMA_CAP_MICROS = 1_000_000; // 1 CMA / UTC week

type MiningRewards = {
  cma: number;
  btc: number;
  doge: number;
  ltc: number;
};

type StoredGameStateRow = {
  account_id: string;
  display_name: string;
  state_json: string;
  version: number;
  created_at?: number;
};

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
    db.prepare(
      `CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        action TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        state_version INTEGER NOT NULL,
        delta_cma_micros INTEGER DEFAULT 0 NOT NULL,
        metadata_json TEXT DEFAULT '{}' NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_idempotency_unique
       ON ledger_entries (account_id, idempotency_key)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS ledger_entries_referral_in_idx
       ON ledger_entries (account_id, action, created_at)`,
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
      miningRewardPercent: REFERRAL_MINING_SHARE_BPS / 100,
      eligibilityHours: REFERRAL_MIN_ACCOUNT_AGE_MS / (60 * 60 * 1000),
      minimumCompletedGames: REFERRAL_MIN_COMPLETED_GAMES,
      perReferralCapCma: REFERRAL_MAX_CMA_PER_REFERRAL_MICROS / 1_000_000,
      weeklyCapCma: REFERRAL_WEEKLY_CMA_CAP_MICROS / 1_000_000,
      status: "active" as const,
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
      0,
    )
    .run();
  return {
    accepted: Number(result.meta.changes ?? 0) === 1,
    reason: Number(result.meta.changes ?? 0) === 1 ? "tracked" as const : "existing" as const,
  };
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function referralShare(rewards: MiningRewards): MiningRewards {
  return {
    cma: Math.floor(positiveInteger(rewards.cma) * REFERRAL_MINING_SHARE_BPS / 10_000),
    btc: Math.floor(positiveInteger(rewards.btc) * REFERRAL_MINING_SHARE_BPS / 10_000),
    doge: Math.floor(positiveInteger(rewards.doge) * REFERRAL_MINING_SHARE_BPS / 10_000),
    ltc: Math.floor(positiveInteger(rewards.ltc) * REFERRAL_MINING_SHARE_BPS / 10_000),
  };
}

function utcWeekStart(now: number) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.getTime();
}

async function readReferralCmaUsage(
  db: D1Database,
  referrerAccountId: string,
  referredAccountId: string,
  now: number,
) {
  const usage = await db
    .prepare(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN json_valid(metadata_json)
              AND json_extract(metadata_json, '$.referredAccountId') = ?
              AND delta_cma_micros > 0
             THEN delta_cma_micros ELSE 0
           END
         ), 0) AS lifetime_cma_micros,
         COALESCE(SUM(
           CASE WHEN created_at >= ? AND delta_cma_micros > 0
             THEN delta_cma_micros ELSE 0 END
         ), 0) AS weekly_cma_micros
       FROM ledger_entries
       WHERE account_id = ? AND action = 'referral_mining_share_in'`,
    )
    .bind(referredAccountId, utcWeekStart(now), referrerAccountId)
    .first<{ lifetime_cma_micros: number; weekly_cma_micros: number }>();
  return {
    lifetimeCmaMicros: Math.max(0, Number(usage?.lifetime_cma_micros ?? 0)),
    weeklyCmaMicros: Math.max(0, Number(usage?.weekly_cma_micros ?? 0)),
  };
}

function hasShare(share: MiningRewards) {
  return share.cma > 0 || share.btc > 0 || share.doge > 0 || share.ltc > 0;
}

function addRewards(state: PublicGameState, rewards: MiningRewards, sign = 1) {
  return {
    ...state,
    cmaBalance: Math.max(0, state.cmaBalance + sign * rewards.cma / 1_000_000),
    btcBalanceAtomic: Math.max(0, state.btcBalanceAtomic + sign * rewards.btc),
    dogeBalanceAtomic: Math.max(0, state.dogeBalanceAtomic + sign * rewards.doge),
    ltcBalanceAtomic: Math.max(0, state.ltcBalanceAtomic + sign * rewards.ltc),
  } satisfies PublicGameState;
}

export type PrimaryMiningLedger = {
  action: string;
  idempotencyKey: string;
  deltaCmaMicros: number;
  metadata: Record<string, unknown>;
};

export type ReferralSettlementResult =
  | {
      applied: true;
      conflict: false;
      nextReferredState: PublicGameState;
      nextReferredVersion: number;
      referrerAccountId: string;
      share: MiningRewards;
    }
  | { applied: false; conflict: true; share: MiningRewards }
  | {
      applied: false;
      conflict: false;
      alreadyPaid?: boolean;
      share?: MiningRewards;
    };

/**
 * Transfers 5% of a referred operator's validated mining reward to the
 * referrer. The amount is taken from the referred reward before persistence,
 * so it never increases a pool's fixed block emission.
 */
export async function settleReferralMiningShare(
  db: D1Database,
  referredAccountId: string,
  referredRow: StoredGameStateRow,
  referredState: PublicGameState,
  rewards: MiningRewards,
  settlementKey: string,
  primaryLedger: PrimaryMiningLedger,
  now: number,
): Promise<ReferralSettlementResult> {
  await ensureReferralSchema(db);
  const attribution = await db
    .prepare(
      `SELECT referrer_account_id
       FROM referral_attributions
       WHERE referred_account_id = ?
         AND status IN ('tracked', 'validated')
         AND (expires_at = 0 OR expires_at > ?)
       LIMIT 1`,
    )
    .bind(referredAccountId, now)
    .first<{ referrer_account_id: string }>();
  if (!attribution || attribution.referrer_account_id === referredAccountId) {
    return { applied: false, conflict: false };
  }

  // Do not release mining referral rewards immediately to a fresh account.
  // This protects the fixed CMA emission from signup farms while keeping the
  // program useful for genuine operators.
  const accountAge = now - Number(referredRow.created_at ?? now);
  if (accountAge < REFERRAL_MIN_ACCOUNT_AGE_MS) {
    return { applied: false, conflict: false };
  }
  const completedGames = await db
    .prepare(
      `SELECT COUNT(*) AS wins
       FROM game_sessions
       WHERE account_id = ? AND status = 'completed'`,
    )
    .bind(referredAccountId)
    .first<{ wins: number }>();
  if (Number(completedGames?.wins ?? 0) < REFERRAL_MIN_COMPLETED_GAMES) {
    return { applied: false, conflict: false };
  }

  const rawShare = referralShare(rewards);
  const usage = await readReferralCmaUsage(
    db,
    attribution.referrer_account_id,
    referredAccountId,
    now,
  );
  const remainingPerReferral = Math.max(
    0,
    REFERRAL_MAX_CMA_PER_REFERRAL_MICROS - usage.lifetimeCmaMicros,
  );
  const remainingWeekly = Math.max(
    0,
    REFERRAL_WEEKLY_CMA_CAP_MICROS - usage.weeklyCmaMicros,
  );
  const share: MiningRewards = {
    ...rawShare,
    cma: Math.min(rawShare.cma, remainingPerReferral, remainingWeekly),
  };
  if (!hasShare(share)) return { applied: false, conflict: false };

  const payoutKey = `referral-mining:${referredAccountId}:${settlementKey}`;
  const alreadyPaid = await db
    .prepare(
      `SELECT id FROM ledger_entries
       WHERE account_id = ? AND idempotency_key = ? LIMIT 1`,
    )
    .bind(attribution.referrer_account_id, payoutKey)
    .first<{ id: string }>();
  if (alreadyPaid) return { applied: false, conflict: false, alreadyPaid: true, share };

  const referrerRow = await db
    .prepare(
      `SELECT account_id, display_name, state_json, version
       FROM game_states WHERE account_id = ?`,
    )
    .bind(attribution.referrer_account_id)
    .first<StoredGameStateRow>();
  if (!referrerRow) return { applied: false, conflict: false };

  let referrerState: PublicGameState;
  try {
    referrerState = JSON.parse(referrerRow.state_json) as PublicGameState;
  } catch {
    return { applied: false, conflict: false };
  }

  const referredNextVersion = referredRow.version + 1;
  const referrerNextVersion = referrerRow.version + 1;
  const nextReferredState = addRewards(referredState, share, -1);
  const nextReferrerState = addRewards(referrerState, share);
  const referredJson = JSON.stringify(nextReferredState);
  const referrerJson = JSON.stringify(nextReferrerState);
  const metadata = JSON.stringify({
    shareBps: REFERRAL_MINING_SHARE_BPS,
    sharePercent: REFERRAL_MINING_SHARE_BPS / 100,
    referredAccountId,
    referrerAccountId: referrerRow.account_id,
    rewards,
    share,
    settlementKey,
  });

  const results = await db.batch([
    db.prepare(
      `UPDATE game_states
       SET state_json = ?, version = ?, display_name = ?, updated_at = ?
       WHERE account_id = ? AND version = ?`,
    ).bind(
      referredJson,
      referredNextVersion,
      referredRow.display_name,
      now,
      referredAccountId,
      referredRow.version,
    ),
    db.prepare(
      `UPDATE game_states
       SET state_json = ?, version = ?, display_name = ?, updated_at = ?
       WHERE account_id = ? AND version = ?`,
    ).bind(
      referrerJson,
      referrerNextVersion,
      referrerRow.display_name,
      now,
      referrerRow.account_id,
      referrerRow.version,
    ),
    db.prepare(
      `INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM game_states
        WHERE account_id = ? AND version = ? AND state_json = ?
      ) AND EXISTS (
        SELECT 1 FROM game_states
        WHERE account_id = ? AND version = ? AND state_json = ?
      )`,
    ).bind(
      crypto.randomUUID(),
      referredAccountId,
      primaryLedger.action,
      primaryLedger.idempotencyKey,
      referredNextVersion,
      primaryLedger.deltaCmaMicros,
      JSON.stringify({ ...primaryLedger.metadata, referralShare: share }),
      now,
      referredAccountId,
      referredNextVersion,
      referredJson,
      referrerRow.account_id,
      referrerNextVersion,
      referrerJson,
    ),
    db.prepare(
      `INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      )
      SELECT ?, ?, 'referral_mining_share_out', ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM game_states
        WHERE account_id = ? AND version = ? AND state_json = ?
      ) AND EXISTS (
        SELECT 1 FROM game_states
        WHERE account_id = ? AND version = ? AND state_json = ?
      )`,
    ).bind(
      crypto.randomUUID(),
      referredAccountId,
      payoutKey,
      referredNextVersion,
      -share.cma,
      metadata,
      now,
      referredAccountId,
      referredNextVersion,
      referredJson,
      referrerRow.account_id,
      referrerNextVersion,
      referrerJson,
    ),
    db.prepare(
      `INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      )
      SELECT ?, ?, 'referral_mining_share_in', ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM game_states
        WHERE account_id = ? AND version = ? AND state_json = ?
      )`,
    ).bind(
      crypto.randomUUID(),
      referrerRow.account_id,
      payoutKey,
      referrerNextVersion,
      share.cma,
      metadata,
      now,
      referrerRow.account_id,
      referrerNextVersion,
      referrerJson,
    ),
    db.prepare(
      `UPDATE referral_attributions
       SET status = 'validated', validated_at = COALESCE(validated_at, ?), expires_at = 0
       WHERE referred_account_id = ? AND referrer_account_id = ?`,
    ).bind(now, referredAccountId, referrerRow.account_id),
  ]);

  if (
    Number(results[0]?.meta.changes ?? 0) !== 1 ||
    Number(results[1]?.meta.changes ?? 0) !== 1 ||
    Number(results[2]?.meta.changes ?? 0) !== 1 ||
    Number(results[3]?.meta.changes ?? 0) !== 1 ||
    Number(results[4]?.meta.changes ?? 0) !== 1
  ) {
    return { applied: false, conflict: true, share };
  }
  return {
    applied: true,
    conflict: false,
    nextReferredState,
    nextReferredVersion: referredNextVersion,
    referrerAccountId: referrerRow.account_id,
    share,
  };
}
