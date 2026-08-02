import type { PublicGameState } from "./game-server.ts";

type WalletEnvironment = {
  BITPAY_TOKEN?: string;
  CRYPTO_DEPOSITS_ENABLED?: string;
  PUBLIC_BASE_URL?: string;
};

type WalletAccountRow = {
  account_id: string;
  created_at: number;
  custody_mode: string;
  deposit_status: string;
  ledger_model: string;
  updated_at: number;
};

type WalletGameRow = {
  state_json: string;
};

type DepositIntentRow = {
  asset: string;
  created_at: number;
  expires_at: number | null;
  id: string;
  provider: string;
  requested_usd_micros: number;
  status: string;
};

export type WalletOverview = {
  account: {
    custodyMode: "provider_invoice";
    depositStatus: "awaiting_provider" | "ready";
    ledgerModel: "individual";
  };
  balances: {
    btcAtomic: number;
    cma: number;
    dogeAtomic: number;
  };
  deposits: {
    assets: ["BTC", "DOGE"];
    enabled: boolean;
    provider: "bitpay";
    providerReady: boolean;
    recent: Array<{
      asset: string;
      createdAt: number;
      expiresAt: number | null;
      id: string;
      requestedUsd: number;
      status: string;
    }>;
  };
};

function cleanEnvironment(environment: unknown) {
  return (environment ?? {}) as WalletEnvironment;
}

export function walletProviderReadiness(environment: unknown) {
  const source = cleanEnvironment(environment);
  const token = typeof source.BITPAY_TOKEN === "string" && source.BITPAY_TOKEN.trim();
  const publicBaseUrl =
    typeof source.PUBLIC_BASE_URL === "string" &&
    /^https:\/\//.test(source.PUBLIC_BASE_URL.trim());
  const providerReady = Boolean(token && publicBaseUrl);
  return {
    depositsEnabled:
      providerReady && source.CRYPTO_DEPOSITS_ENABLED?.trim().toLowerCase() === "true",
    provider: "bitpay" as const,
    providerReady,
  };
}

export async function ensureWalletSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS player_wallet_accounts (
      account_id TEXT PRIMARY KEY NOT NULL,
      ledger_model TEXT DEFAULT 'individual' NOT NULL,
      custody_mode TEXT DEFAULT 'provider_invoice' NOT NULL,
      deposit_status TEXT DEFAULT 'awaiting_provider' NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS player_wallet_accounts_deposit_status_idx
      ON player_wallet_accounts (deposit_status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wallet_deposit_intents (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      asset TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_reference TEXT,
      checkout_url TEXT,
      deposit_address TEXT,
      requested_usd_micros INTEGER NOT NULL,
      received_atomic INTEGER DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'awaiting_provider' NOT NULL,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_deposit_intents_account_created_idx
      ON wallet_deposit_intents (account_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_deposit_intents_provider_reference_idx
      ON wallet_deposit_intents (provider, provider_reference)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_deposit_intents_status_expiry_idx
      ON wallet_deposit_intents (status, expires_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wallet_provider_events (
      id TEXT PRIMARY KEY NOT NULL,
      provider TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      deposit_intent_id TEXT,
      payload_hash TEXT NOT NULL,
      status TEXT DEFAULT 'received' NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS wallet_provider_events_provider_event_unique
      ON wallet_provider_events (provider, provider_event_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_provider_events_intent_created_idx
      ON wallet_provider_events (deposit_intent_id, created_at)`),
  ]);
}

export async function ensurePlayerWalletAccount(
  db: D1Database,
  accountId: string,
  depositsEnabled: boolean,
  now: number,
) {
  const status = depositsEnabled ? "ready" : "awaiting_provider";
  await db
    .prepare(`INSERT INTO player_wallet_accounts (
      account_id, ledger_model, custody_mode, deposit_status, created_at, updated_at
    ) VALUES (?, 'individual', 'provider_invoice', ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      deposit_status = excluded.deposit_status,
      updated_at = excluded.updated_at`)
    .bind(accountId, status, now, now)
    .run();
  return db
    .prepare(`SELECT account_id, ledger_model, custody_mode, deposit_status,
      created_at, updated_at FROM player_wallet_accounts WHERE account_id = ?`)
    .bind(accountId)
    .first<WalletAccountRow>();
}

function parseBalances(row: WalletGameRow | null) {
  if (!row) return { btcAtomic: 0, cma: 0, dogeAtomic: 0 };
  try {
    const state = JSON.parse(row.state_json) as Partial<PublicGameState>;
    return {
      btcAtomic: Math.max(0, Math.floor(Number(state.btcBalanceAtomic) || 0)),
      cma: Math.max(0, Number(state.cmaBalance) || 0),
      dogeAtomic: Math.max(0, Math.floor(Number(state.dogeBalanceAtomic) || 0)),
    };
  } catch {
    return { btcAtomic: 0, cma: 0, dogeAtomic: 0 };
  }
}

export async function readWalletOverview(input: {
  accountId: string;
  db: D1Database;
  environment: unknown;
  now?: number;
}): Promise<WalletOverview> {
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  const readiness = walletProviderReadiness(input.environment);
  const [account, game, intents] = await Promise.all([
    ensurePlayerWalletAccount(
      input.db,
      input.accountId,
      readiness.depositsEnabled,
      now,
    ),
    input.db
      .prepare(`SELECT state_json FROM game_states WHERE account_id = ?`)
      .bind(input.accountId)
      .first<WalletGameRow>(),
    input.db
      .prepare(`SELECT id, asset, provider, requested_usd_micros, status,
        expires_at, created_at
        FROM wallet_deposit_intents
        WHERE account_id = ?
        ORDER BY created_at DESC
        LIMIT 8`)
      .bind(input.accountId)
      .all<DepositIntentRow>(),
  ]);
  if (!account) throw new Error("Não foi possível preparar a carteira.");
  return {
    account: {
      custodyMode: "provider_invoice",
      depositStatus: readiness.depositsEnabled ? "ready" : "awaiting_provider",
      ledgerModel: "individual",
    },
    balances: parseBalances(game),
    deposits: {
      assets: ["BTC", "DOGE"],
      enabled: readiness.depositsEnabled,
      provider: readiness.provider,
      providerReady: readiness.providerReady,
      recent: (intents.results ?? []).map((intent) => ({
        asset: intent.asset,
        createdAt: intent.created_at,
        expiresAt: intent.expires_at,
        id: intent.id,
        requestedUsd: intent.requested_usd_micros / 1_000_000,
        status: intent.status,
      })),
    },
  };
}
