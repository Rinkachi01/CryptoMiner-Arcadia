import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import { readAdminRuntimeSettings } from "../../admin-settings";
import { BLOCK_INTERVAL_SECONDS } from "../../game-rules";
import {
  applyGameAction,
  applySupplyCratePurchase,
  createInitialGameState,
  normalizePoolAllocations,
  nextBlockAt,
  settleMiningBlocks,
  type GameActionName,
  type PublicGameState,
} from "../../game-server";
import { getSupplyCrate } from "../../supply-crate-rules";
import { getMinerOffer, type MinerOffer } from "../../miner-offers-rules";
import {
  readNetworkPowerSnapshot,
  syncAccountNetworkPower,
  type NetworkPowerSnapshot,
} from "../../network-server";
import { STARTER_KIT_VERSION } from "../../onboarding-rules";
import {
  ensurePlayerWalletAccount,
  ensureWalletSchema,
  walletProviderReadiness,
} from "../../wallet-server";
import {
  settleReferralMiningShare,
  type ReferralSettlementResult,
} from "../../referral-server";

export const dynamic = "force-dynamic";

// These actions were originally isolated to staging while the Season 2
// mechanics were being validated.  Promotion is now controlled explicitly by
// ARCADIA_EXTENDED_GAMEPLAY_ENABLED so production can receive the same rules
// without sharing the staging database or its balances.
const EXTENDED_GAMEPLAY_ACTIONS = new Set([
  "open_luck_crate",
  "open_part_case",
  "open_season_box",
  "buy_miner_offer",
  "merge_part",
  "merge_miner",
]);

function isStagingRequest(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "staging.cryptominerarcadia.com" || hostname.includes("staging");
}

function extendedGameplayEnabled(request: Request) {
  if (isStagingRequest(request)) return true;
  const configured = (env as unknown as Record<string, unknown>)
    .ARCADIA_EXTENDED_GAMEPLAY_ENABLED;
  return String(configured ?? "").toLowerCase() === "true";
}

type StoredRow = {
  account_id: string;
  email: string;
  display_name: string;
  state_json: string;
  version: number;
  created_at: number;
  updated_at: number;
};

type ReservedMinerOffer = {
  offer: MinerOffer;
  quantity: number;
};

function json(
  value: unknown,
  status = 200,
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS game_states (
        account_id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        state_json TEXT NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS game_states_email_unique
      ON game_states (email)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS game_states_updated_at_idx
      ON game_states (updated_at)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        action TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        state_version INTEGER NOT NULL,
        delta_cma_micros INTEGER DEFAULT 0 NOT NULL,
        metadata_json TEXT DEFAULT '{}' NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_idempotency_unique
      ON ledger_entries (account_id, idempotency_key)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS ledger_entries_account_created_idx
      ON ledger_entries (account_id, created_at)
    `),
    // Offer lots are server-wide inventory, not a per-account allowance.
    // The account state still keeps a local purchase history for compatibility,
    // while this table is the authoritative shared stock counter.
    db.prepare(`
      CREATE TABLE IF NOT EXISTS miner_offer_stock (
        offer_id TEXT PRIMARY KEY NOT NULL,
        rotation_key TEXT NOT NULL,
        purchased INTEGER DEFAULT 0 NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS miner_offer_stock_rotation_idx
      ON miner_offer_stock (rotation_key)
    `),
    // One authoritative record per account and settled server block.  The
    // game state version check already protects the balance, while this
    // ledger makes the settlement boundary idempotent across GET refreshes,
    // action POSTs and concurrent sessions.
    db.prepare(`
      CREATE TABLE IF NOT EXISTS mining_settlements (
        account_id TEXT NOT NULL,
        settled_block INTEGER NOT NULL,
        settled_blocks INTEGER NOT NULL,
        rewards_json TEXT DEFAULT '{}' NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, settled_block)
      )
    `),
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

async function reserveMinerOfferStock(
  db: D1Database,
  offer: MinerOffer,
  quantity: number,
  now: number,
) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO miner_offer_stock (
        offer_id, rotation_key, purchased, updated_at
      ) VALUES (?, ?, 0, ?)`,
    )
    .bind(offer.id, offer.rotationKey, now)
    .run();
  const result = await db
    .prepare(
      `UPDATE miner_offer_stock
       SET purchased = purchased + ?, updated_at = ?
       WHERE offer_id = ? AND rotation_key = ?
         AND purchased + ? <= ?`,
    )
    .bind(
      quantity,
      now,
      offer.id,
      offer.rotationKey,
      quantity,
      offer.lotSize,
    )
    .run();
  return Number(result.meta.changes ?? 0) === 1;
}

async function releaseMinerOfferStock(
  db: D1Database,
  offer: MinerOffer,
  quantity: number,
  now: number,
) {
  await db
    .prepare(
      `UPDATE miner_offer_stock
       SET purchased = MAX(0, purchased - ?), updated_at = ?
       WHERE offer_id = ? AND rotation_key = ? AND purchased >= ?`,
    )
    .bind(quantity, now, offer.id, offer.rotationKey, quantity)
    .run();
}

async function readState(db: D1Database, accountId: string) {
  return db
    .prepare(
      `SELECT account_id, email, display_name, state_json, version,
              created_at, updated_at
       FROM game_states
       WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<StoredRow>();
}

function parseState(row: StoredRow): PublicGameState {
  const parsed = JSON.parse(row.state_json) as Record<string, unknown>;
  const currentAllocations = normalizePoolAllocations(parsed.poolAllocations);
  const legacyAllocations = normalizePoolAllocations(
    parsed.gamePoolAllocations,
  );

  // During the three-pool rollout, some rows kept the user's distribution in
  // `gamePoolAllocations` while `poolAllocations` remained at its initial 100%
  // CMA value. Prefer that legacy value only when the current value is still
  // the untouched default; otherwise preserve the current authoritative value.
  const isDefaultCmaAllocation =
    currentAllocations?.cma === 100 &&
    currentAllocations.btc === 0 &&
    currentAllocations.doge === 0 &&
    currentAllocations.ltc === 0;
  if (legacyAllocations && (!currentAllocations || isDefaultCmaAllocation)) {
    parsed.poolAllocations = legacyAllocations;
  } else if (currentAllocations) {
    parsed.poolAllocations = currentAllocations;
  } else {
    parsed.poolAllocations = { cma: 100, btc: 0, doge: 0, ltc: 0 };
  }
  delete parsed.gamePoolAllocations;
  return parsed as PublicGameState;
}

function settlementKeyFor(settled: {
  settledBlocks: number;
  state: Pick<PublicGameState, "lastSettledBlock">;
}) {
  return settled.settledBlocks > 0
    ? `blocks:${String(settled.state.lastSettledBlock)}`
    : null;
}

function settlementBlockForKey(key: string | null) {
  if (!key) return null;
  const match = /^blocks:(\d+)$/.exec(key);
  return match ? Number(match[1]) : null;
}

function secureRandomUnit() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 4_294_967_296;
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

async function activeTemporaryPowerSummary(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(power_gh), 0) AS total,
         COUNT(*) AS active_grants,
         COALESCE(MIN(expires_at), 0) AS next_expiry
       FROM temporary_power_grants
       WHERE account_id = ? AND starts_at <= ? AND expires_at > ?`,
    )
    .bind(accountId, now, now)
    .first<{
      total: number;
      active_grants: number;
      next_expiry: number;
    }>();
  return {
    totalGh: Math.max(0, Number(row?.total ?? 0)),
    activeGrantCount: Math.max(0, Number(row?.active_grants ?? 0)),
    nextExpiryAt: Math.max(0, Number(row?.next_expiry ?? 0)),
  };
}

async function settlementTemporaryPower(
  db: D1Database,
  accountId: string,
  state: PublicGameState,
  now: number,
) {
  const firstUnsettledBlockAt =
    (state.lastSettledBlock + 1) * BLOCK_INTERVAL_SECONDS * 1000;
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(power_gh), 0) AS total
       FROM temporary_power_grants
       WHERE account_id = ? AND starts_at <= ? AND expires_at > ?`,
    )
    .bind(accountId, firstUnsettledBlockAt, now)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function createAccount(
  db: D1Database,
  accountId: string,
  email: string,
  displayName: string,
  now: number,
) {
  await ensureWalletSchema(db);
  const state = createInitialGameState(now);
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_states (
        account_id, email, display_name, state_json, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      accountId,
      email,
      displayName,
      JSON.stringify(state),
      now,
      now,
    )
    .run();
  await ensurePlayerWalletAccount(
    db,
    accountId,
    walletProviderReadiness(env).depositsEnabled,
    now,
  );
  await db
    .prepare(
      `INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'account_initialized', ?, 1, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `bootstrap:${accountId}`,
      JSON.stringify({
        importedLocalState: false,
        starterKitVersion: STARTER_KIT_VERSION,
      }),
      now,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'starter_kit_granted', ?, 1, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `starter-kit:${STARTER_KIT_VERSION}:${accountId}`,
      JSON.stringify({
        version: STARTER_KIT_VERSION,
        rack: { id: "rack-01", roomId: "room-1", positionIndex: 0 },
        miner: { minerId: "byte-spark", quantity: 1, installed: false },
      }),
      now,
    )
    .run();
  const persisted = await readState(db, accountId);
  if (!persisted) throw new Error("Não foi possível criar a conta.");
  await syncAccountNetworkPower(db, accountId, state, now);
  return persisted;
}

async function authenticatedContext() {
  const user = await getArcadiaUser();
  if (!user) return null;
  const db = env.DB;
  if (!db) throw new Error("Banco autoritativo indisponível.");
  await ensureSchema(db);
  return {
    db,
    user,
    accountId: await accountIdForUser(user),
  };
}

function responsePayload(
  row: StoredRow,
  state: PublicGameState,
  now: number,
  message: string,
  temporaryPowerGh = 0,
  temporaryPowerSummary = {
    totalGh: Math.max(0, temporaryPowerGh),
    activeGrantCount: 0,
    nextExpiryAt: 0,
  },
  network?: NetworkPowerSnapshot,
) {
  return {
    state,
    version: row.version,
    serverTime: now,
    nextBlockAt: nextBlockAt(now),
    temporaryPowerGh,
    temporaryPowerSummary,
    network,
    message,
    account: {
      displayName: row.display_name,
      email: row.email,
    },
  };
}

export async function GET() {
  const context = await authenticatedContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  const now = Date.now();
  let row = await readState(context.db, context.accountId);
  if (!row) {
    row = await createAccount(
      context.db,
      context.accountId,
      context.user.email,
      context.user.displayName,
      now,
    );
  }
  if (!row) {
    return json({ error: "Estado da conta indisponível." }, 503);
  }

  const temporaryPowerGh = await activeTemporaryPower(
    context.db,
    context.accountId,
    now,
  );
  const temporaryPowerSummary = await activeTemporaryPowerSummary(
    context.db,
    context.accountId,
    now,
  );
  const state = parseState(row);
  await syncAccountNetworkPower(
    context.db,
    context.accountId,
    state,
    now,
  );
  const network = await readNetworkPowerSnapshot(context.db, now);
  const eligibleTemporaryPowerGh = await settlementTemporaryPower(
    context.db,
    context.accountId,
    state,
    now,
  );
  const settled = settleMiningBlocks(
    state,
    now,
    eligibleTemporaryPowerGh,
    network.playerPowerGh,
    network.blockRewardAtomic,
  );
  let responseState = settled.state;
  let settledBlockCount = settled.settledBlocks;
  if (settled.settledBlocks > 0) {
    const settlementKey = settlementKeyFor(settled);
    const settlementBlock = settlementBlockForKey(settlementKey);
    if (!settlementKey || settlementBlock === null) {
      return json(
        responsePayload(
          row,
          parseState(row),
          now,
          "Liquidação aguardando validação do servidor.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
        409,
      );
    }
    const settlementMetadata = {
      settledBlocks: settled.settledBlocks,
      rewards: settled.rewards,
      blockRewardAtomic: network.blockRewardAtomic,
      bonusBps: network.bonusBps,
      networkPowerGh: network.playerPowerGh,
    };
    const referralResult = await settleReferralMiningShare(
      context.db,
      context.accountId,
      row,
      settled.state,
      settled.rewards,
      settlementKey,
      {
        action: "block_settlement",
        idempotencyKey: settlementKey,
        deltaCmaMicros: settled.rewards.cma,
        metadata: settlementMetadata,
      },
      now,
    );
    if (referralResult.applied) {
      responseState = referralResult.nextReferredState;
      row = {
        ...row,
        state_json: JSON.stringify(referralResult.nextReferredState),
        version: referralResult.nextReferredVersion,
        updated_at: now,
      };
    } else if (referralResult.conflict) {
      const latest = await readState(context.db, context.accountId);
      if (latest) {
        row = latest;
        responseState = parseState(latest);
        settledBlockCount = 0;
      }
    } else {
      const nextVersion = row.version + 1;
      // Keep the state transition, settlement boundary and audit row in one
      // D1 batch. If any part fails, none of the writes is committed, so a
      // retry cannot advance the cursor without recording the reward.
      const settlementResults = await context.db.batch([
        context.db.prepare(
          `UPDATE game_states
           SET state_json = ?, version = ?, display_name = ?, updated_at = ?
           WHERE account_id = ? AND version = ?
             AND NOT EXISTS (
               SELECT 1 FROM mining_settlements
               WHERE account_id = ? AND settled_block = ?
             )`,
        ).bind(
          JSON.stringify(settled.state),
          nextVersion,
          context.user.displayName,
          now,
          context.accountId,
          row.version,
          context.accountId,
          settlementBlock,
        ),
        context.db.prepare(
          `INSERT OR IGNORE INTO mining_settlements (
            account_id, settled_block, settled_blocks, rewards_json, created_at
          )
          SELECT ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM game_states
            WHERE account_id = ? AND version = ? AND state_json = ?
          )`,
        ).bind(
          context.accountId,
          settlementBlock,
          settled.settledBlocks,
          JSON.stringify(settled.rewards),
          now,
          context.accountId,
          nextVersion,
          JSON.stringify(settled.state),
        ),
        context.db.prepare(
          `INSERT OR IGNORE INTO ledger_entries (
            id, account_id, action, idempotency_key, state_version,
            delta_cma_micros, metadata_json, created_at
          )
          SELECT ?, ?, 'block_settlement', ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM game_states
            WHERE account_id = ? AND version = ? AND state_json = ?
          )`,
        ).bind(
          crypto.randomUUID(),
          context.accountId,
          settlementKey,
          nextVersion,
          settled.rewards.cma,
          JSON.stringify(settlementMetadata),
          now,
          context.accountId,
          nextVersion,
          JSON.stringify(settled.state),
        ),
      ]);

      if (
        Number(settlementResults[0]?.meta.changes ?? 0) === 1 &&
        Number(settlementResults[1]?.meta.changes ?? 0) === 1 &&
        Number(settlementResults[2]?.meta.changes ?? 0) === 1
      ) {
        row = {
          ...row,
          state_json: JSON.stringify(settled.state),
          version: nextVersion,
          updated_at: now,
        };
      } else {
        const latest = await readState(context.db, context.accountId);
        if (latest) {
          row = latest;
          responseState = parseState(latest);
          settledBlockCount = 0;
        }
      }
    }
  }

  return json(
    responsePayload(
      row,
      responseState,
      now,
      settledBlockCount > 0
        ? `${settledBlockCount} bloco(s) processado(s).`
      : "Conta sincronizada.",
      temporaryPowerGh,
      temporaryPowerSummary,
      network,
    ),
  );
}

export async function POST(request: Request) {
  const context = await authenticatedContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);

  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        payload?: unknown;
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        bootstrapState?: unknown;
      }
    | null;
  if (!body || typeof body.action !== "string") {
    return json({ error: "Ação inválida." }, 400);
  }

  if (
    EXTENDED_GAMEPLAY_ACTIONS.has(body.action) &&
    !extendedGameplayEnabled(request)
  ) {
    return json(
      {
        error: "Esta ação está temporariamente indisponível.",
      },
      403,
    );
  }

  const now = Date.now();
  let row = await readState(context.db, context.accountId);
  if (!row) {
    row = await createAccount(
      context.db,
      context.accountId,
      context.user.email,
      context.user.displayName,
      now,
    );
  }
  if (!row) {
    return json({ error: "Estado da conta indisponível." }, 503);
  }
  const temporaryPowerGh = await activeTemporaryPower(
    context.db,
    context.accountId,
    now,
  );
  const temporaryPowerSummary = await activeTemporaryPowerSummary(
    context.db,
    context.accountId,
    now,
  );
  const eligibleTemporaryPowerGh = await settlementTemporaryPower(
    context.db,
    context.accountId,
    parseState(row),
    now,
  );
  await syncAccountNetworkPower(
    context.db,
    context.accountId,
    parseState(row),
    now,
  );
  let network = await readNetworkPowerSnapshot(context.db, now);
  const settlementPreview = settleMiningBlocks(
    parseState(row),
    now,
    eligibleTemporaryPowerGh,
    network.playerPowerGh,
    network.blockRewardAtomic,
  );
  const settlementKey = settlementKeyFor(settlementPreview);
  const settlementBlock = settlementBlockForKey(settlementKey);

  if (body.action === "bootstrap") {
    return json(
      responsePayload(
        row,
        parseState(row),
        now,
        "Conta autoritativa pronta.",
        temporaryPowerGh,
        temporaryPowerSummary,
        network,
      ),
    );
  }

  if (
    typeof body.idempotencyKey !== "string" ||
    body.idempotencyKey.length < 8 ||
    body.idempotencyKey.length > 100
  ) {
    return json({ error: "Identificador da ação inválido." }, 400);
  }

  const priorAction = await context.db
    .prepare(
      `SELECT id FROM ledger_entries
       WHERE account_id = ? AND idempotency_key = ?`,
    )
    .bind(context.accountId, body.idempotencyKey)
    .first<{ id: string }>();
  if (priorAction) {
    const latest = (await readState(context.db, context.accountId)) ?? row;
    return json(
      responsePayload(
        latest,
        parseState(latest),
        now,
        "Ação já processada anteriormente.",
        temporaryPowerGh,
        temporaryPowerSummary,
        network,
      ),
    );
  }

  if (
    typeof body.expectedVersion !== "number" ||
    body.expectedVersion !== row.version
  ) {
    return json(
      {
        ...responsePayload(
          row,
          parseState(row),
          now,
          "Seu estado foi atualizado em outra sessão.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
        error: "Versão desatualizada. O estado mais recente foi restaurado.",
      },
      409,
    );
  }

  let reservedMinerOffer: ReservedMinerOffer | null = null;
  if (body.action === "buy_miner_offer") {
    const actionPayload =
      body.payload && typeof body.payload === "object"
        ? body.payload as Record<string, unknown>
        : {};
    const offer = getMinerOffer(actionPayload.offerId, now);
    const quantity = Number(actionPayload.quantity);
    if (
      !offer ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 3
    ) {
      return json(
        {
          ...responsePayload(
            row,
            parseState(row),
            now,
            "Oferta de minerador indisponível.",
            temporaryPowerGh,
            temporaryPowerSummary,
            network,
          ),
          error: "Oferta de minerador inválida ou indisponível.",
        },
        400,
      );
    }
    const reserved = await reserveMinerOfferStock(
      context.db,
      offer,
      quantity,
      now,
    );
    if (!reserved) {
      return json(
        {
          ...responsePayload(
            row,
            parseState(row),
            now,
            "Esta oferta esgotou o lote global do servidor.",
            temporaryPowerGh,
            temporaryPowerSummary,
            network,
          ),
          error: `Oferta esgotada: o lote global de ${offer.lotSize} unidades já foi reservado.`,
        },
        409,
      );
    }
    reservedMinerOffer = { offer, quantity };
  }

  let result;
  try {
    const crateId =
      body.action === "open_supply_crate" &&
      body.payload &&
      typeof body.payload === "object"
        ? (body.payload as Record<string, unknown>).crateId
        : undefined;
    const crate = getSupplyCrate(crateId);
    if (body.action === "open_supply_crate") {
      const settings = await readAdminRuntimeSettings(context.db);
      if (!settings.cratesEnabled) {
        throw new Error(
          "As Caixas Arcadia estão pausadas temporariamente pelo operador.",
        );
      }
    }
    const actionPayload =
      body.payload && typeof body.payload === "object"
        ? { ...(body.payload as Record<string, unknown>) }
        : {};
    // Outcomes must be generated at the edge, never trusted from the browser.
    // The pure reducer still accepts an explicit roll for deterministic tests,
    // while live luck/season openings always receive fresh server entropy.
    if (body.action === "open_luck_crate" || body.action === "open_season_box") {
      actionPayload.roll = secureRandomUnit();
    }
    result =
      body.action === "open_supply_crate" && crate
        ? applySupplyCratePurchase(
            parseState(row),
            crate.id,
            secureRandomUnit(),
            now,
            eligibleTemporaryPowerGh,
            network.playerPowerGh,
            network.blockRewardAtomic,
          )
        : applyGameAction(
            parseState(row),
            body.action as GameActionName,
            actionPayload,
            now,
            eligibleTemporaryPowerGh,
            network.playerPowerGh,
            network.blockRewardAtomic,
          );
  } catch (error) {
    if (reservedMinerOffer) {
      await releaseMinerOfferStock(
        context.db,
        reservedMinerOffer.offer,
        reservedMinerOffer.quantity,
        now,
      );
    }
    return json(
      {
        error:
          error instanceof Error ? error.message : "Não foi possível concluir.",
        ...responsePayload(
          row,
          parseState(row),
          now,
          "Ação recusada.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
      },
      400,
    );
  }

  const primaryMetadata: Record<string, unknown> = { ...result.metadata };
  if (reservedMinerOffer) {
    const stock = await context.db
      .prepare(
        `SELECT purchased FROM miner_offer_stock WHERE offer_id = ? AND rotation_key = ?`,
      )
      .bind(
        reservedMinerOffer.offer.id,
        reservedMinerOffer.offer.rotationKey,
      )
      .first<{ purchased: number }>();
    const offerMetadata =
      primaryMetadata.minerOffer && typeof primaryMetadata.minerOffer === "object"
        ? primaryMetadata.minerOffer as Record<string, unknown>
        : {};
    primaryMetadata.minerOffer = {
      ...offerMetadata,
      globalPurchased: Number(stock?.purchased ?? reservedMinerOffer.quantity),
      globalRemaining: Math.max(
        0,
        reservedMinerOffer.offer.lotSize - Number(stock?.purchased ?? reservedMinerOffer.quantity),
      ),
      stockScope: "server",
    };
  }
  if (settlementPreview.settledBlocks > 0) {
    if (!Object.prototype.hasOwnProperty.call(primaryMetadata, "rewards")) {
      Object.assign(primaryMetadata, {
        settledBlocks: settlementPreview.settledBlocks,
        rewards: settlementPreview.rewards,
        blockRewardAtomic: network.blockRewardAtomic,
        bonusBps: network.bonusBps,
        networkPowerGh: network.playerPowerGh,
      });
    }
    primaryMetadata.settlementKey = settlementKey;
    if (body.action === "sync") {
      // The canonical block row below is the only mining activity entry. The
      // sync row remains solely as the request idempotency marker.
      primaryMetadata.settlementRecordedSeparately = true;
    }
  }
  const primaryDeltaCmaMicros =
    body.action === "sync"
      ? settlementPreview.settledBlocks > 0
        ? 0
        : result.deltaCmaMicros
      : result.deltaCmaMicros + settlementPreview.rewards.cma;
  const referralResult: ReferralSettlementResult =
    settlementPreview.settledBlocks > 0
      ? await settleReferralMiningShare(
          context.db,
          context.accountId,
          row,
          result.state,
          settlementPreview.rewards,
          settlementKey ?? body.idempotencyKey,
          {
            action: body.action,
            idempotencyKey: body.idempotencyKey,
            deltaCmaMicros: primaryDeltaCmaMicros,
            // The referral transaction writes the primary action and the
            // referral bonus together. Keep the sync row as the single
            // visible mining event in that branch; the no-referral branch
            // records a separate canonical block row below.
            metadata:
              body.action === "sync"
                ? { ...primaryMetadata, settlementRecordedSeparately: false }
                : primaryMetadata,
          },
          now,
        )
      : { applied: false, conflict: false };
  if (referralResult.conflict) {
    if (reservedMinerOffer) {
      await releaseMinerOfferStock(
        context.db,
        reservedMinerOffer.offer,
        reservedMinerOffer.quantity,
        now,
      );
    }
    const latest = (await readState(context.db, context.accountId)) ?? row;
    return json(
      {
        ...responsePayload(
          latest,
          parseState(latest),
          now,
          "Outra sessao concluiu uma acao primeiro.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
        error: "Estado atualizado em outra sessao. Tente novamente.",
      },
      409,
    );
  }
  if (referralResult.applied) {
    const updatedRow: StoredRow = {
      ...row,
      display_name: context.user.displayName,
      state_json: JSON.stringify(referralResult.nextReferredState),
      version: referralResult.nextReferredVersion,
      updated_at: now,
    };
    await syncAccountNetworkPower(
      context.db,
      context.accountId,
      referralResult.nextReferredState,
      now,
    );
    network = await readNetworkPowerSnapshot(context.db, now);
    return json({
      ...responsePayload(
        updatedRow,
        referralResult.nextReferredState,
        now,
        result.message,
        temporaryPowerGh,
        temporaryPowerSummary,
        network,
      ),
      actionResult: primaryMetadata,
    });
  }

  const nextVersion = row.version + 1;
  const ledgerStatements: D1PreparedStatement[] = [];
  let settlementStatementCount = 0;
  if (settlementBlock !== null && settlementKey) {
    settlementStatementCount = 1;
    ledgerStatements.push(
      context.db.prepare(
        `INSERT OR IGNORE INTO mining_settlements (
          account_id, settled_block, settled_blocks, rewards_json, created_at
        )
        SELECT ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM game_states
          WHERE account_id = ? AND version = ? AND state_json = ?
        )`,
      ).bind(
        context.accountId,
        settlementBlock,
        settlementPreview.settledBlocks,
        JSON.stringify(settlementPreview.rewards),
        now,
        context.accountId,
        nextVersion,
        JSON.stringify(result.state),
      ),
    );
  }
  ledgerStatements.push(
    context.db
      .prepare(
        `INSERT INTO ledger_entries (
          id, account_id, action, idempotency_key, state_version,
          delta_cma_micros, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        context.accountId,
        body.action,
        body.idempotencyKey,
        nextVersion,
        primaryDeltaCmaMicros,
        JSON.stringify(primaryMetadata),
        now,
      ),
  );
  let stateAndLedgerResults;
  try {
    stateAndLedgerResults = await context.db.batch([
      context.db
        .prepare(
          `UPDATE game_states
           SET state_json = ?, version = ?, display_name = ?, updated_at = ?
           WHERE account_id = ? AND version = ?
             AND (
               ? IS NULL OR NOT EXISTS (
                 SELECT 1 FROM mining_settlements
                 WHERE account_id = ? AND settled_block = ?
               )
             )`,
        )
        .bind(
          JSON.stringify(result.state),
          nextVersion,
          context.user.displayName,
          now,
          context.accountId,
          row.version,
          settlementBlock,
          context.accountId,
          settlementBlock,
        ),
      ...ledgerStatements,
    ]);
  } catch (error) {
    if (reservedMinerOffer) {
      await releaseMinerOfferStock(
        context.db,
        reservedMinerOffer.offer,
        reservedMinerOffer.quantity,
        now,
      );
    }
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível persistir a compra.",
      },
      500,
    );
  }
  const stateWriteSucceeded =
    Number(stateAndLedgerResults[0]?.meta.changes ?? 0) === 1;
  const settlementWriteSucceeded =
    settlementStatementCount === 0 ||
    Number(stateAndLedgerResults[1]?.meta.changes ?? 0) === 1;
  const actionLedgerIndex = settlementStatementCount + 1;
  const actionLedgerSucceeded =
    Number(stateAndLedgerResults[actionLedgerIndex]?.meta.changes ?? 0) === 1;
  if (!stateWriteSucceeded || !settlementWriteSucceeded || !actionLedgerSucceeded) {
    if (reservedMinerOffer) {
      await releaseMinerOfferStock(
        context.db,
        reservedMinerOffer.offer,
        reservedMinerOffer.quantity,
        now,
      );
    }
    const latest = (await readState(context.db, context.accountId)) ?? row;
    return json(
      {
        ...responsePayload(
          latest,
          parseState(latest),
          now,
          "Outra sessão concluiu uma ação primeiro.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
        error: "Estado atualizado em outra sessão. Tente novamente.",
      },
      409,
    );
  }

  const updatedRow: StoredRow = {
    ...row,
    display_name: context.user.displayName,
    state_json: JSON.stringify(result.state),
    version: nextVersion,
    updated_at: now,
  };
  await syncAccountNetworkPower(
    context.db,
    context.accountId,
    result.state,
    now,
  );
  network = await readNetworkPowerSnapshot(context.db, now);
  return json({
    ...responsePayload(
      updatedRow,
      result.state,
      now,
      result.message,
      temporaryPowerGh,
      temporaryPowerSummary,
      network,
    ),
    actionResult: primaryMetadata,
  });
}
