import type { PublicGameState } from "./game-server.ts";
import { amountToAtomic } from "./conversion-rules.ts";

type WalletEnvironment = {
  BITPAY_TOKEN?: string;
  CRYPTO_DEPOSITS_ENABLED?: string;
  CRYPTO_SANDBOX_ENABLED?: string;
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

type WithdrawalIntentRow = {
  asset: string;
  created_at: number;
  id: string;
  requested_atomic: number;
  status: string;
};

export type WalletSandboxAsset = "BTC" | "DOGE";

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
    sandboxEnabled: boolean;
    recent: Array<{
      asset: string;
      createdAt: number;
      expiresAt: number | null;
      id: string;
      requestedUsd: number;
      status: string;
    }>;
  };
  withdrawals: {
    enabled: false;
    recentSandbox: Array<{
      amountAtomic: number;
      asset: string;
      createdAt: number;
      id: string;
      status: string;
    }>;
    sandboxEnabled: boolean;
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
    sandboxEnabled:
      source.CRYPTO_SANDBOX_ENABLED?.trim().toLowerCase() === "true",
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
    db.prepare(`CREATE TABLE IF NOT EXISTS wallet_withdrawal_intents (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      asset TEXT NOT NULL,
      provider TEXT NOT NULL,
      requested_atomic INTEGER NOT NULL,
      destination_preview TEXT NOT NULL,
      status TEXT DEFAULT 'simulation_only' NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_withdrawal_intents_account_created_idx
      ON wallet_withdrawal_intents (account_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_withdrawal_intents_status_created_idx
      ON wallet_withdrawal_intents (status, created_at)`),
  ]);
}

function validSandboxAsset(value: unknown): value is WalletSandboxAsset {
  return value === "BTC" || value === "DOGE";
}

async function enforceSandboxRateLimit(
  db: D1Database,
  accountId: string,
  table: "wallet_deposit_intents" | "wallet_withdrawal_intents",
  now: number,
) {
  const recent = await db
    .prepare(`SELECT COUNT(*) AS total FROM ${table}
      WHERE account_id = ? AND provider = 'sandbox' AND created_at >= ?`)
    .bind(accountId, now - 60 * 60 * 1000)
    .first<{ total: number }>();
  if (Number(recent?.total ?? 0) >= 5) {
    throw new Error("Limite de cinco simulações por hora alcançado.");
  }
}

export async function createSandboxDepositIntent(input: {
  accountId: string;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
  usdAmount: unknown;
}) {
  const readiness = walletProviderReadiness(input.environment);
  if (!readiness.sandboxEnabled) {
    throw new Error("Laboratório financeiro indisponível.");
  }
  if (!validSandboxAsset(input.asset)) {
    throw new Error("Escolha BTC ou DOGE para a simulação.");
  }
  const usdAmount = Number(input.usdAmount);
  if (!Number.isFinite(usdAmount) || usdAmount < 1 || usdAmount > 1_000) {
    throw new Error("Use um valor simulado entre US$ 1 e US$ 1.000.");
  }
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  await enforceSandboxRateLimit(
    input.db,
    input.accountId,
    "wallet_deposit_intents",
    now,
  );
  const id = `sandbox-deposit-${crypto.randomUUID()}`;
  const expiresAt = now + 15 * 60 * 1000;
  await input.db
    .prepare(`INSERT INTO wallet_deposit_intents (
      id, account_id, asset, provider, provider_reference, checkout_url,
      deposit_address, requested_usd_micros, received_atomic, status,
      expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'sandbox', ?, NULL, NULL, ?, 0,
      'simulation_only', ?, ?, ?)`)
    .bind(
      id,
      input.accountId,
      input.asset,
      `SANDBOX-${crypto.randomUUID()}`,
      Math.round(usdAmount * 1_000_000),
      expiresAt,
      now,
      now,
    )
    .run();
  return {
    asset: input.asset,
    expiresAt,
    id,
    noFundsMoved: true as const,
    requestedUsd: usdAmount,
    status: "simulation_only" as const,
  };
}

export async function createSandboxWithdrawalIntent(input: {
  accountId: string;
  amount: unknown;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
}) {
  const readiness = walletProviderReadiness(input.environment);
  if (!readiness.sandboxEnabled) {
    throw new Error("Laboratório financeiro indisponível.");
  }
  if (!validSandboxAsset(input.asset) || typeof input.amount !== "string") {
    throw new Error("Informe BTC ou DOGE e uma quantidade válida.");
  }
  const requestedAtomic = amountToAtomic(input.amount, input.asset);
  if (!requestedAtomic) {
    throw new Error("Quantidade simulada inválida.");
  }
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  await enforceSandboxRateLimit(
    input.db,
    input.accountId,
    "wallet_withdrawal_intents",
    now,
  );
  const id = `sandbox-withdrawal-${crypto.randomUUID()}`;
  await input.db
    .prepare(`INSERT INTO wallet_withdrawal_intents (
      id, account_id, asset, provider, requested_atomic,
      destination_preview, status, created_at, updated_at
    ) VALUES (?, ?, ?, 'sandbox', ?, 'ENDERECO-DE-TESTE',
      'simulation_only', ?, ?)`)
    .bind(id, input.accountId, input.asset, requestedAtomic, now, now)
    .run();
  return {
    amountAtomic: requestedAtomic,
    asset: input.asset,
    id,
    noBalanceChanged: true as const,
    status: "simulation_only" as const,
  };
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
  const [account, game, intents, withdrawals] = await Promise.all([
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
    input.db
      .prepare(`SELECT id, asset, requested_atomic, status, created_at
        FROM wallet_withdrawal_intents
        WHERE account_id = ? AND provider = 'sandbox'
        ORDER BY created_at DESC
        LIMIT 8`)
      .bind(input.accountId)
      .all<WithdrawalIntentRow>(),
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
      sandboxEnabled: readiness.sandboxEnabled,
      recent: (intents.results ?? []).map((intent) => ({
        asset: intent.asset,
        createdAt: intent.created_at,
        expiresAt: intent.expires_at,
        id: intent.id,
        requestedUsd: intent.requested_usd_micros / 1_000_000,
        status: intent.status,
      })),
    },
    withdrawals: {
      enabled: false,
      recentSandbox: (withdrawals.results ?? []).map((intent) => ({
        amountAtomic: intent.requested_atomic,
        asset: intent.asset,
        createdAt: intent.created_at,
        id: intent.id,
        status: intent.status,
      })),
      sandboxEnabled: readiness.sandboxEnabled,
    },
  };
}
