import type { PublicGameState } from "./game-server.ts";

const REFERRAL_CODE_LENGTH = 10;
export const REFERRAL_CMA_SHARE_BPS = 800;
export const REFERRAL_CRYPTO_SHARE_BPS = 500;
// Anti-abuse qualification is kept separate from the payout amount. Once an
// account is validated, every settled block can generate its proportional
// referral bonus; there is no accumulated balance or per-referrer payout cap.
export const REFERRAL_MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;
export const REFERRAL_MIN_COMPLETED_GAMES = 3;

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
    db.prepare(
      `CREATE TABLE IF NOT EXISTS mining_settlements (
        account_id TEXT NOT NULL,
        settled_block INTEGER NOT NULL,
        settled_blocks INTEGER NOT NULL,
        rewards_json TEXT DEFAULT '{}' NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, settled_block)
      )`,
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
      cmaRewardPercent: REFERRAL_CMA_SHARE_BPS / 100,
      cryptoRewardPercent: REFERRAL_CRYPTO_SHARE_BPS / 100,
      eligibilityHours: REFERRAL_MIN_ACCOUNT_AGE_MS / (60 * 60 * 1000),
      minimumCompletedGames: REFERRAL_MIN_COMPLETED_GAMES,
      payoutMode: "per_validated_block" as const,
      hasPayoutCap: false,
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
    cma: Math.floor(positiveInteger(rewards.cma) * REFERRAL_CMA_SHARE_BPS / 10_000),
    btc: Math.floor(positiveInteger(rewards.btc) * REFERRAL_CRYPTO_SHARE_BPS / 10_000),
    doge: Math.floor(positiveInteger(rewards.doge) * REFERRAL_CRYPTO_SHARE_BPS / 10_000),
    ltc: Math.floor(positiveInteger(rewards.ltc) * REFERRAL_CRYPTO_SHARE_BPS / 10_000),
  };
}

function hasShare(share: MiningRewards) {
  return share.cma > 0 || share.btc > 0 || share.doge > 0 || share.ltc > 0;
}

function settlementBlockFromKey(settlementKey: string) {
  const match = /^blocks:(\d+)$/.exec(settlementKey);
  return match ? Number(match[1]) : null;
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
 * Credits a referral bonus for each validated block. The invited operator
 * keeps the full block reward; the bonus is an explicit promotional emission
 * recorded in the ledger. CMA uses 8%; BTC, DOGE and LTC use 5%.
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

  const share = referralShare(rewards);
  if (!hasShare(share)) return { applied: false, conflict: false };

  const settlementBlock = settlementBlockFromKey(settlementKey);
  if (settlementBlock === null) {
    // Referral payouts must always be tied to the same canonical settlement
    // boundary as the referred operator's block credit.
    return { applied: false, conflict: false };
  }

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
  // The invited operator receives the complete validated block reward. The
  // referral bonus is additional and only affects the referrer's balance.
  const nextReferredState = referredState;
  const nextReferrerState = addRewards(referrerState, share);
  const referredJson = JSON.stringify(nextReferredState);
  const referrerJson = JSON.stringify(nextReferrerState);
  const metadata = JSON.stringify({
    cmaShareBps: REFERRAL_CMA_SHARE_BPS,
    cryptoShareBps: REFERRAL_CRYPTO_SHARE_BPS,
    cmaSharePercent: REFERRAL_CMA_SHARE_BPS / 100,
    cryptoSharePercent: REFERRAL_CRYPTO_SHARE_BPS / 100,
    sharePercent: REFERRAL_CRYPTO_SHARE_BPS / 100,
    payoutMode: "per_validated_block",
    additionalEmission: true,
    referredAccountId,
    referrerAccountId: referrerRow.account_id,
    rewards,
    share,
    settlementKey,
  });
  const settledBlocks = Math.max(
    1,
    Math.floor(
      Number(
        (primaryLedger.metadata as Record<string, unknown>).settledBlocks ?? 1,
      ),
    ),
  );

  const results = await db.batch([
    db.prepare(
      `UPDATE game_states
       SET state_json = ?, version = ?, display_name = ?, updated_at = ?
       WHERE account_id = ? AND version = ?
         AND NOT EXISTS (
           SELECT 1 FROM mining_settlements
           WHERE account_id = ? AND settled_block = ?
         )
         AND EXISTS (
           SELECT 1 FROM game_states
           WHERE account_id = ? AND version = ?
         )`,
    ).bind(
      referredJson,
      referredNextVersion,
      referredRow.display_name,
      now,
      referredAccountId,
      referredRow.version,
      referredAccountId,
      settlementBlock,
      referrerRow.account_id,
      referrerRow.version,
    ),
    db.prepare(
      `UPDATE game_states
       SET state_json = ?, version = ?, display_name = ?, updated_at = ?
       WHERE account_id = ? AND version = ?
         AND EXISTS (
           SELECT 1 FROM game_states
           WHERE account_id = ? AND version = ? AND state_json = ?
         )`,
    ).bind(
      referrerJson,
      referrerNextVersion,
      referrerRow.display_name,
      now,
      referrerRow.account_id,
      referrerRow.version,
      referredAccountId,
      referredNextVersion,
      referredJson,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO mining_settlements (
        account_id, settled_block, settled_blocks, rewards_json, created_at
      )
      SELECT ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM game_states
        WHERE account_id = ? AND version = ? AND state_json = ?
      ) AND EXISTS (
        SELECT 1 FROM game_states
        WHERE account_id = ? AND version = ? AND state_json = ?
      )`,
    ).bind(
      referredAccountId,
      settlementBlock,
      settledBlocks,
      JSON.stringify(rewards),
      now,
      referredAccountId,
      referredNextVersion,
      referredJson,
      referrerRow.account_id,
      referrerNextVersion,
      referrerJson,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO ledger_entries (
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
      SELECT ?, ?, 'referral_mining_bonus_source', ?, ?, ?, ?, ?
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
      0,
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
      SELECT ?, ?, 'referral_mining_bonus_in', ?, ?, ?, ?, ?
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
    ![0, 1].includes(Number(results[3]?.meta.changes ?? 0)) ||
    Number(results[4]?.meta.changes ?? 0) !== 1 ||
    Number(results[5]?.meta.changes ?? 0) !== 1 ||
    Number(results[6]?.meta.changes ?? 0) !== 1
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
