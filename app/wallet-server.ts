import {
  normalizeBootstrapState,
  type PublicGameState,
} from "./game-server.ts";
import { amountToAtomic } from "./conversion-rules.ts";
import { formatAtomic } from "./game-rules.ts";
import {
  applyCryptoDepositBalances,
  parseDecimalAtomic,
  settlementAssetDecimals,
} from "./deposit-rules.ts";
import { readBoundedJsonArray, readBoundedJsonObject } from "./external-json.ts";
import {
  isNowPaymentsAsset,
  normalizeNowPaymentsStatus,
  parseNowPaymentsMinimumUsd,
  readNowPaymentsConfig,
  safeNowPaymentsMinimumUsd,
  validNowPaymentsCheckoutUrl,
  verifyNowPaymentsPayload,
} from "./nowpayments-rules.ts";
import {
  ccpaymentApiVersion,
  ccpaymentFeeAtomic,
  createCCPaymentHeaders,
  grossUpCCPaymentAtomic,
  normalizeCCPaymentStatus,
  readCCPaymentConfig,
  validCCPaymentCheckoutUrl,
} from "./ccpayment-rules.ts";

type WalletEnvironment = {
  COINGECKO_API_KEY?: string;
  /** Active crypto deposit provider. Defaults to NOWPayments for legacy environments. */
  PAYMENT_PROVIDER?: string;
  CRYPTO_DEPOSITS_ENABLED?: string;
  CRYPTO_LIVE_DEPOSITS_ENABLED?: string;
  CRYPTO_LIVE_DEPOSITS_OWNER_ONLY?: string;
  CRYPTO_SANDBOX_ENABLED?: string;
  MANUAL_WITHDRAWALS_ENABLED?: string;
  NOWPAYMENTS_API_BASE_URL?: string;
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
  NOWPAYMENTS_SETTLEMENT_ASSET?: string;
  CCPAYMENT_ENABLED?: string;
  CCPAYMENT_API_BASE_URL?: string;
  CCPAYMENT_CHECKOUT_ENDPOINT?: string;
  CCPAYMENT_CHECKOUT_ENABLED?: string;
  CCPAYMENT_CUSTOMER_FEE_BPS?: string;
  CCPAYMENT_APP_ID?: string;
  CCPAYMENT_APP_SECRET?: string;
  CCPAYMENT_TESTNET_ENABLED?: string;
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
  checkout_url: string | null;
  created_at: number;
  expires_at: number | null;
  id: string;
  provider: string;
  requested_usd_micros: number;
  received_atomic: number;
  credited_cma_micros: number;
  settlement_asset: string | null;
  settlement_atomic: number;
  status: string;
  transaction_hash: string | null;
};

type WithdrawalIntentRow = {
  account_id?: string;
  asset: string;
  created_at: number;
  destination_address?: string | null;
  destination_preview?: string;
  display_name?: string | null;
  email?: string | null;
  id: string;
  payout_brl_cents?: number;
  provider?: string;
  requested_atomic: number;
  resolved_at?: number | null;
  review_note?: string | null;
  status: string;
  transaction_hash?: string | null;
  updated_at?: number;
};

export type WalletSandboxAsset = "BTC" | "DOGE" | "LTC";
export type DepositProvider = "nowpayments" | "ccpayment";

type WalletProviderReadiness = {
  activationRequested: boolean;
  depositsEnabled: boolean;
  liveActivationRequested: boolean;
  provider: DepositProvider;
  providerReady: boolean;
  providerSandbox: boolean;
  ccpayment?: {
    enabled: boolean;
    webhookReady: boolean;
    checkoutReady: boolean;
    checkoutEnabled: boolean;
    customerFeeBps: number;
    testnet: boolean;
  };
  missingSetup: Array<"api_key" | "ipn_secret" | "public_url">;
  mode: "disabled" | "live" | "sandbox";
  sandboxEnabled: boolean;
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
    ltcAtomic: number;
  };
  deposits: {
    assets: ["BTC", "DOGE", "LTC"];
    enabled: boolean;
    accessAllowed: boolean;
    ownerOnly: boolean;
    activationRequested: boolean;
    liveActivationRequested: boolean;
    provider: DepositProvider;
    providerReady: boolean;
    providerSandbox: boolean;
    ccpayment?: {
      enabled: boolean;
      webhookReady: boolean;
      checkoutReady: boolean;
      checkoutEnabled: boolean;
      customerFeeBps: number;
      testnet: boolean;
    };
    missingSetup: Array<"api_key" | "ipn_secret" | "public_url">;
    mode: "disabled" | "live" | "sandbox";
    sandboxEnabled: boolean;
    recent: Array<{
      asset: string;
      blockchainUrl: string | null;
      checkoutUrl: string | null;
      createdAt: number;
      expiresAt: number | null;
      id: string;
      invoiceReference: string | null;
      provider: string;
      requestedUsd: number;
      receivedAtomic: number;
      settlementAsset: string | null;
      status: string;
      transactionHash: string | null;
    }>;
  };
  withdrawals: {
    enabled: boolean;
    assets: ["BTC", "DOGE", "LTC"];
    brlFeeBps: number;
    brlMinimumCents: number;
    cryptoMinimumBrlCents: number;
    minimumAtomic: Record<WalletSandboxAsset, number>;
    ratesAvailable: boolean;
    ratesObservedAt: number | null;
    recent: Array<{
      amountAtomic: number;
      asset: string;
      createdAt: number;
      destinationPreview: string;
      id: string;
      payoutAsset: "BRL" | "CRYPTO";
      payoutBrlCents: number;
      resolvedAt: number | null;
      reviewNote: string | null;
      status: string;
      transactionReference: string | null;
      updatedAt: number;
    }>;
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

export type AdminWithdrawalOverview = {
  counts: {
    paid: number;
    rejected: number;
    requested: number;
    reviewing: number;
  };
  enabled: boolean;
  requests: Array<{
    accountId: string;
    amountAtomic: number;
    asset: WalletSandboxAsset;
    createdAt: number;
    destinationAddress: string;
    displayName: string;
    email: string;
    id: string;
    payoutAsset: "BRL" | "CRYPTO";
    payoutBrlCents: number;
    provider: "manual" | "manual_pix";
    resolvedAt: number | null;
    reviewNote: string | null;
    status: string;
    transactionReference: string | null;
    updatedAt: number;
  }>;
};

export const MANUAL_WITHDRAWAL_MINIMUM_ATOMIC: Record<
  WalletSandboxAsset,
  number
> = {
  BTC: 10_000,
  DOGE: 1_000_000_000,
  LTC: 1_000_000,
};

export const CRYPTO_WITHDRAWAL_MINIMUM_BRL_CENTS = 5_000;
export const PIX_WITHDRAWAL_MINIMUM_BRL_CENTS = 2_000;
export const PIX_WITHDRAWAL_FEE_BPS = 250;

const BRL_RATE_CACHE_MS = 60 * 1000;
const BRL_RATE_MAX_STALE_MS = 2 * 60 * 60 * 1000;
const BRL_WITHDRAWAL_QUOTE_TTL_MS = 2 * 60 * 1000;

type BrlRateRow = {
  asset: string;
  brl_price_micros: number;
  observed_at: number;
};

type BrlWithdrawalQuoteRow = {
  account_id: string;
  brl_price_micros: number;
  created_at: number;
  expires_at: number;
  fee_bps: number;
  gross_brl_cents: number;
  id: string;
  net_brl_cents: number;
  source_asset: string;
  source_atomic: number;
  status: string;
};

const PLAYER_INVOICE_HISTORY_DAYS = 30;
const OPERATIONAL_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const WALLET_CREDITING_STALE_MS = 90 * 1000;

const MANUAL_WITHDRAWAL_MAXIMUM_ATOMIC: Record<WalletSandboxAsset, number> = {
  BTC: 100_000_000,
  DOGE: 10_000_000_000_000,
  LTC: 1_000_000_000_000,
};

function cleanEnvironment(environment: unknown) {
  return (environment ?? {}) as WalletEnvironment;
}

function selectedDepositProvider(environment: unknown): DepositProvider {
  const value = cleanEnvironment(environment).PAYMENT_PROVIDER
    ?.trim()
    .toLowerCase();
  return "ccpayment"; // Changed per user request to force CCPayment
}

export function manualWithdrawalsEnabled(environment: unknown) {
  return cleanEnvironment(environment).MANUAL_WITHDRAWALS_ENABLED
    ?.trim()
    .toLowerCase() === "true";
}

function liveDepositsOwnerOnly(environment: unknown) {
  return cleanEnvironment(environment).CRYPTO_LIVE_DEPOSITS_OWNER_ONLY
    ?.trim()
    .toLowerCase() === "true";
}

async function accountMayCreateLiveDeposit(
  db: D1Database,
  accountId: string,
  environment: unknown,
) {
  const provider = selectedDepositProvider(environment);
  const providerSandbox = provider === "ccpayment"
    ? readCCPaymentConfig(environment).testnet
    : readNowPaymentsConfig(environment).sandbox;
  if (providerSandbox || !liveDepositsOwnerOnly(environment)) return true;
  try {
    const owner = await db
      .prepare(`SELECT account_id FROM admin_owners WHERE singleton_id = 1`)
      .first<{ account_id: string }>();
    return owner?.account_id === accountId;
  } catch {
    return false;
  }
}

export function walletProviderReadiness(environment: unknown): WalletProviderReadiness {
  const source = cleanEnvironment(environment);
  const nowPayments = readNowPaymentsConfig(source);
  const ccpayment = readCCPaymentConfig(source);
  const ccpaymentConfigured = Object.keys(source).some((key) =>
    key.startsWith("CCPAYMENT_"),
  );
  const provider = selectedDepositProvider(source);
  if (provider === "ccpayment") {
    return {
      activationRequested: ccpayment.enabled,
      depositsEnabled: ccpayment.checkoutEnabled,
      liveActivationRequested: ccpayment.enabled && !ccpayment.testnet,
      provider,
      providerReady: ccpayment.providerReady,
      providerSandbox: ccpayment.testnet,
      ccpayment: {
        enabled: ccpayment.enabled,
        webhookReady: ccpayment.webhookReady,
        checkoutReady: ccpayment.providerReady,
        checkoutEnabled: ccpayment.checkoutEnabled,
        customerFeeBps: ccpayment.customerFeeBps,
        testnet: ccpayment.testnet,
      },
      missingSetup: [],
      mode: !ccpayment.enabled
        ? "disabled"
        : ccpayment.testnet
          ? "sandbox"
          : "live",
      sandboxEnabled: source.CRYPTO_SANDBOX_ENABLED?.trim().toLowerCase() === "true",
    };
  }
  return {
    activationRequested: nowPayments.depositsEnabled,
    depositsEnabled: nowPayments.depositsEnabled,
    liveActivationRequested: nowPayments.depositsEnabled && !nowPayments.sandbox,
    provider: "nowpayments",
    providerReady: nowPayments.providerReady,
    providerSandbox: nowPayments.sandbox,
    ...(ccpaymentConfigured
      ? {
          ccpayment: {
            enabled: ccpayment.enabled,
            webhookReady: ccpayment.webhookReady,
            checkoutReady: ccpayment.providerReady,
            checkoutEnabled: ccpayment.checkoutEnabled,
            customerFeeBps: ccpayment.customerFeeBps,
            testnet: ccpayment.testnet,
          },
        }
      : {}),
    missingSetup: [
      ...(!nowPayments.apiKeyConfigured ? (["api_key"] as const) : []),
      ...(!nowPayments.ipnSecretConfigured ? (["ipn_secret"] as const) : []),
      ...(!nowPayments.publicBaseUrlConfigured ? (["public_url"] as const) : []),
    ],
    mode: nowPayments.depositsEnabled
      ? nowPayments.sandbox
        ? "sandbox"
        : "live"
      : "disabled",
    sandboxEnabled: source.CRYPTO_SANDBOX_ENABLED?.trim().toLowerCase() === "true",
  };
}

const walletSchemaReadyByDatabase = new WeakMap<object, Promise<void>>();

export function ensureWalletSchema(db: D1Database) {
  const cached = walletSchemaReadyByDatabase.get(db);
  if (cached) return cached;

  const ready = (async () => {
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
      settlement_asset TEXT,
      settlement_atomic INTEGER DEFAULT 0 NOT NULL,
      credited_cma_micros INTEGER DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'awaiting_provider' NOT NULL,
      transaction_hash TEXT,
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
      destination_address TEXT,
      destination_preview TEXT NOT NULL,
      payout_brl_cents INTEGER DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'simulation_only' NOT NULL,
      review_note TEXT,
      transaction_hash TEXT,
      resolved_at INTEGER,
      resolved_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_withdrawal_intents_account_created_idx
      ON wallet_withdrawal_intents (account_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_withdrawal_intents_status_created_idx
      ON wallet_withdrawal_intents (status, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wallet_brl_rate_snapshots (
      asset TEXT PRIMARY KEY NOT NULL,
      brl_price_micros INTEGER NOT NULL,
      observed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wallet_brl_withdrawal_quotes (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      source_asset TEXT NOT NULL,
      source_atomic INTEGER NOT NULL,
      brl_price_micros INTEGER NOT NULL,
      gross_brl_cents INTEGER NOT NULL,
      fee_bps INTEGER NOT NULL,
      net_brl_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'preview' NOT NULL,
      consumed_at INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_brl_withdrawal_quotes_account_created_idx
      ON wallet_brl_withdrawal_quotes (account_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_brl_withdrawal_quotes_status_expiry_idx
      ON wallet_brl_withdrawal_quotes (status, expires_at)`),
  ]);

  const withdrawalColumns = await db
    .prepare(`PRAGMA table_info(wallet_withdrawal_intents)`)
    .all<{ name: string }>();
  if (!(withdrawalColumns.results ?? []).some((column) => column.name === "payout_brl_cents")) {
    await db
      .prepare(`ALTER TABLE wallet_withdrawal_intents
        ADD COLUMN payout_brl_cents INTEGER DEFAULT 0 NOT NULL`)
      .run();
  }
  const depositColumns = await db
    .prepare(`PRAGMA table_info(wallet_deposit_intents)`)
    .all<{ name: string }>();
  if (!(depositColumns.results ?? []).some((column) => column.name === "transaction_hash")) {
    await db
      .prepare(`ALTER TABLE wallet_deposit_intents
        ADD COLUMN transaction_hash TEXT`)
      .run();
  }
  })().catch((error) => {
    walletSchemaReadyByDatabase.delete(db);
    throw error;
  });
  walletSchemaReadyByDatabase.set(db, ready);
  return ready;
}

/**
 * Mantém apenas 30 dias de filas operacionais resolvidas. O livro-razão e os
 * registros de auditoria permanecem intactos para reconciliação e suporte.
 */
export async function pruneWalletOperationalHistory(
  db: D1Database,
  now = Date.now(),
) {
  const cutoff = now - OPERATIONAL_HISTORY_RETENTION_MS;
  await ensureWalletSchema(db);
  return db.batch([
    db.prepare(`UPDATE wallet_deposit_intents SET status = 'expired', updated_at = ?
      WHERE provider = 'nowpayments' AND expires_at IS NOT NULL AND expires_at <= ?
        AND status IN ('creating', 'waiting', 'confirming', 'confirmed', 'sending')`)
      .bind(now, now),
    db.prepare(`UPDATE wallet_deposit_intents SET status = 'expired', updated_at = ?
      WHERE provider = 'nowpayments' AND created_at < ?
        AND status IN ('creating', 'waiting', 'confirming', 'confirmed', 'sending')`)
      .bind(now, cutoff),
    db.prepare(`DELETE FROM wallet_deposit_intents
      WHERE created_at < ? AND status IN
        ('credited', 'expired', 'provider_failed', 'review_required', 'pending_account', 'finished')`)
      .bind(cutoff),
    db.prepare(`DELETE FROM wallet_withdrawal_intents
      WHERE resolved_at IS NOT NULL AND resolved_at < ?
        AND status IN ('paid', 'rejected')`)
      .bind(cutoff),
    db.prepare(`DELETE FROM wallet_brl_withdrawal_quotes
      WHERE created_at < ? AND status <> 'preview'`)
      .bind(cutoff),
    db.prepare(`DELETE FROM wallet_provider_events
      WHERE created_at < ? AND status = 'processed'`)
      .bind(cutoff),
    db.prepare(`UPDATE wallet_deposit_intents SET status = 'finished', updated_at = ?
      WHERE status = 'crediting' AND updated_at <= ?
        AND NOT EXISTS (SELECT 1 FROM ledger_entries
          WHERE idempotency_key = 'deposit:' || wallet_deposit_intents.id)`)
      .bind(now, now - WALLET_CREDITING_STALE_MS),
    ]);
}

function validSandboxAsset(value: unknown): value is WalletSandboxAsset {
  return value === "BTC" || value === "DOGE" || value === "LTC";
}

const brlAssetIds: Record<WalletSandboxAsset, string> = {
  BTC: "bitcoin",
  DOGE: "dogecoin",
  LTC: "litecoin",
};

export function minimumAtomicForBrl(
  asset: WalletSandboxAsset,
  brlPrice: number,
  minimumBrlCents = CRYPTO_WITHDRAWAL_MINIMUM_BRL_CENTS,
) {
  if (!Number.isFinite(brlPrice) || brlPrice <= 0) return 0;
  const atomic = Math.ceil((minimumBrlCents / 100 / brlPrice) * 100_000_000);
  return Number.isSafeInteger(atomic) && atomic > 0
    ? Math.min(atomic, MANUAL_WITHDRAWAL_MAXIMUM_ATOMIC[asset])
    : 0;
}

async function readMercadoBitcoinBrlRates(now: number) {
  const assets: WalletSandboxAsset[] = ["BTC", "DOGE", "LTC"];
  const symbols = assets.map((asset) => `${asset}-BRL`).join(",");
  const response = await fetch(
    `https://api.mercadobitcoin.net/api/v4/tickers?symbols=${symbols}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) throw new Error("fallback_rate_unavailable");
  const body = await readBoundedJsonArray(response);
  return assets.map((asset) => {
    const result = body.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as { pair?: unknown }).pair === `${asset}-BRL`,
    ) as { last?: unknown; date?: unknown } | undefined;
    const brlPrice = Number(result?.last);
    const observedAt = Number(result?.date) ? Number(result?.date) * 1000 : now;
    if (
      !Number.isFinite(brlPrice) ||
      brlPrice <= 0 ||
      observedAt > now + 60_000 ||
      now - observedAt > BRL_RATE_MAX_STALE_MS
    ) {
      throw new Error(`fallback_rate_invalid_${asset}`);
    }
    return { asset, brlPrice, observedAt };
  });
}

async function readBrlRates(
  db: D1Database,
  environment: unknown,
  now = Date.now(),
) {
  await ensureWalletSchema(db);
  const cachedRows = await db
    .prepare(`SELECT asset, brl_price_micros, observed_at
      FROM wallet_brl_rate_snapshots`)
    .all<BrlRateRow>();
  const cached = new Map(
    (cachedRows.results ?? [])
      .filter((row) => validSandboxAsset(row.asset))
      .map((row) => [row.asset as WalletSandboxAsset, row]),
  );
  const assets: WalletSandboxAsset[] = ["BTC", "DOGE", "LTC"];
  const allFresh = assets.every(
    (asset) => now - Number(cached.get(asset)?.observed_at ?? 0) <= BRL_RATE_CACHE_MS,
  );
  if (allFresh) {
    return assets.map((asset) => ({
      asset,
      brlPrice: cached.get(asset)!.brl_price_micros / 1_000_000,
      observedAt: cached.get(asset)!.observed_at,
    }));
  }

  try {
    const source = cleanEnvironment(environment);
    const ids = assets.map((asset) => brlAssetIds[asset]).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl&include_last_updated_at=true`,
      {
        headers: {
          Accept: "application/json",
          ...(source.COINGECKO_API_KEY?.trim()
            ? { "x-cg-demo-api-key": source.COINGECKO_API_KEY.trim() }
            : {}),
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) throw new Error("Cotação em real temporariamente indisponível.");
    const body = await readBoundedJsonObject(response);
    const rates = assets.map((asset) => {
      const result = body[brlAssetIds[asset]] as
        | { brl?: number; last_updated_at?: number }
        | undefined;
      const brlPrice = Number(result?.brl);
      const observedAt = Number(result?.last_updated_at)
        ? Number(result?.last_updated_at) * 1000
        : now;
      if (
        !Number.isFinite(brlPrice) ||
        brlPrice <= 0 ||
        observedAt > now + 60_000 ||
        now - observedAt > BRL_RATE_MAX_STALE_MS
      ) {
        throw new Error(`Cotação de ${asset} em real indisponível.`);
      }
      return { asset, brlPrice, observedAt };
    });
    await db.batch(
      rates.map((rate) =>
        db
          .prepare(`INSERT INTO wallet_brl_rate_snapshots (
            asset, brl_price_micros, observed_at, updated_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(asset) DO UPDATE SET
            brl_price_micros = excluded.brl_price_micros,
            observed_at = excluded.observed_at,
            updated_at = excluded.updated_at`)
          .bind(
            rate.asset,
            Math.round(rate.brlPrice * 1_000_000),
            rate.observedAt,
            now,
          ),
      ),
    );
    return rates;
  } catch (error) {
    try {
      // Keep the fallback name aligned with the provider implemented above.
      // A stale/failed primary quote must not turn into a ReferenceError here;
      // otherwise every account loses its dynamic withdrawal minimum until a
      // cached snapshot happens to exist.
      const liveFallback = await readMercadoBitcoinBrlRates(now);
      await db.batch(
        liveFallback.map((rate) =>
          db
            .prepare(`INSERT INTO wallet_brl_rate_snapshots (
              asset, brl_price_micros, observed_at, updated_at
            ) VALUES (?, ?, ?, ?)
            ON CONFLICT(asset) DO UPDATE SET
              brl_price_micros = excluded.brl_price_micros,
              observed_at = excluded.observed_at,
              updated_at = excluded.updated_at`)
            .bind(
              rate.asset,
              Math.round(rate.brlPrice * 1_000_000),
              rate.observedAt,
              now,
            ),
        ),
      );
      return liveFallback;
    } catch {
      // The last known validated quote remains usable for a short safe window.
    }
    const fallbackAvailable = assets.every(
      (asset) =>
        now - Number(cached.get(asset)?.observed_at ?? 0) <= BRL_RATE_MAX_STALE_MS,
    );
    if (!fallbackAvailable) throw error;
    return assets.map((asset) => ({
      asset,
      brlPrice: cached.get(asset)!.brl_price_micros / 1_000_000,
      observedAt: cached.get(asset)!.observed_at,
    }));
  }
}

function parseBrlCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) return 0;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : 0;
}

export async function createBrlWithdrawalQuote(input: {
  accountId: string;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
  targetBrl: unknown;
}) {
  if (!manualWithdrawalsEnabled(input.environment)) {
    throw new Error("A fila de saques ainda não está liberada.");
  }
  if (!validSandboxAsset(input.asset)) {
    throw new Error("Escolha BTC, DOGE ou LTC como origem do saque.");
  }
  const netBrlCents = parseBrlCents(input.targetBrl);
  if (netBrlCents < PIX_WITHDRAWAL_MINIMUM_BRL_CENTS || netBrlCents > 5_000_000) {
    throw new Error("Escolha um saque Pix entre R$ 20,00 e R$ 50.000,00.");
  }
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  const recent = await input.db
    .prepare(`SELECT COUNT(*) AS total FROM wallet_brl_withdrawal_quotes
      WHERE account_id = ? AND created_at >= ?`)
    .bind(input.accountId, now - 10 * 60 * 1000)
    .first<{ total: number }>();
  if (Number(recent?.total ?? 0) >= 20) {
    throw new Error("Muitas cotações em sequência. Aguarde alguns minutos.");
  }
  const rates = await readBrlRates(input.db, input.environment, now);
  const rate = rates.find((item) => item.asset === input.asset)!;
  const grossBrlCents = Math.ceil(
    (netBrlCents * 10_000) / (10_000 - PIX_WITHDRAWAL_FEE_BPS),
  );
  const sourceAtomic = Math.ceil(
    (grossBrlCents / 100 / rate.brlPrice) * 100_000_000,
  );
  if (
    !Number.isSafeInteger(sourceAtomic) ||
    sourceAtomic <= 0 ||
    sourceAtomic > MANUAL_WITHDRAWAL_MAXIMUM_ATOMIC[input.asset]
  ) {
    throw new Error("A quantidade calculada excede o limite seguro da carteira.");
  }
  const id = `brl-quote-${crypto.randomUUID()}`;
  const expiresAt = now + BRL_WITHDRAWAL_QUOTE_TTL_MS;
  await input.db
    .prepare(`INSERT INTO wallet_brl_withdrawal_quotes (
      id, account_id, source_asset, source_atomic, brl_price_micros,
      gross_brl_cents, fee_bps, net_brl_cents, status, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'preview', ?, ?)`)
    .bind(
      id,
      input.accountId,
      input.asset,
      sourceAtomic,
      Math.round(rate.brlPrice * 1_000_000),
      grossBrlCents,
      PIX_WITHDRAWAL_FEE_BPS,
      netBrlCents,
      expiresAt,
      now,
    )
    .run();
  return {
    asset: input.asset,
    brlPrice: rate.brlPrice,
    expiresAt,
    feeBrl: (grossBrlCents - netBrlCents) / 100,
    feeBps: PIX_WITHDRAWAL_FEE_BPS,
    grossBrl: grossBrlCents / 100,
    id,
    netBrl: netBrlCents / 100,
    observedAt: rate.observedAt,
    sourceAmount: sourceAtomic / 100_000_000,
    sourceAtomic,
  };
}

type NowPaymentsIpnPayload = {
  actually_paid?: number | string;
  invoice_id?: number | string;
  order_id?: string;
  outcome_amount?: number | string;
  outcome_currency?: string;
  pay_amount?: number | string;
  pay_currency?: string;
  payin_hash?: string;
  payin_txid?: string;
  payment_id?: number | string;
  payment_status?: string;
  price_amount?: number | string;
  price_currency?: string;
  transaction_hash?: string;
  tx_hash?: string;
};

type ProviderDepositIntentRow = DepositIntentRow & {
  account_id: string;
  provider_reference: string | null;
  received_atomic: number;
};

function cleanProviderValue(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function blockchainExplorerUrl(asset: string, transactionHash: string | null) {
  if (!transactionHash) return null;
  // Provider record IDs are not necessarily blockchain transaction hashes.
  // Only expose an explorer link when the value has the expected 64-hex form;
  // this avoids sending users to misleading URLs for invoice/order IDs.
  const normalizedHash = transactionHash.trim().replace(/^0x/i, "");
  if (!/^[a-f0-9]{64}$/i.test(normalizedHash)) return null;
  const normalizedAsset = asset.toUpperCase();
  const baseByAsset: Record<string, string> = {
    BTC: "https://mempool.space/tx/",
    DOGE: "https://dogechain.info/tx/",
    LTC: "https://blockchair.com/litecoin/transaction/",
  };
  const base = baseByAsset[normalizedAsset];
  return base ? `${base}${encodeURIComponent(transactionHash.trim())}` : null;
}

/**
 * CCPayment wraps list responses differently between API revisions and
 * merchant configurations. Keep the extraction tolerant without exposing the
 * provider payload to the client or logs.
 */
function providerRecordList(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    );
  }
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of [
    "coins",
    "coinList",
    "fiats",
    "fiatList",
    "items",
    "list",
    "records",
    "rows",
    "data",
  ]) {
    const nested = object[key];
    const records = providerRecordList(nested);
    if (records.length) return records;
  }
  return [];
}

function providerField(record: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = cleanProviderValue(record[name]);
    if (value) return value;
  }
  return "";
}

type CCPaymentConfig = ReturnType<typeof readCCPaymentConfig>;

/**
 * Calls the signed CCPayment v2 merchant API and fails closed when the
 * provider serves its HTML console instead of the JSON API.  Webhooks only
 * carry the record/reference identifiers, so the credit path uses this helper
 * to fetch the authoritative amount and asset before touching the ledger.
 */
async function requestCCPaymentApi(input: {
  config: CCPaymentConfig;
  path: string;
  payload?: Record<string, unknown>;
  now?: number;
  maxResponseBytes?: number;
}) {
  const apiVersion = ccpaymentApiVersion(input.config.apiBaseUrl);
  if (apiVersion !== "v2") {
    throw new Error("A API CCPayment precisa estar configurada no endpoint v2.");
  }
  const body = input.payload === undefined ? "{}" : JSON.stringify(input.payload);
  const headers = await createCCPaymentHeaders({
    appId: input.config.appId,
    appSecret: input.config.appSecret,
    body,
    nowMs: input.now,
    version: apiVersion,
  });
  const response = await fetch(`${input.config.apiBaseUrl}${input.path}`, {
    method: "POST",
    headers: {
      ...headers,
      Accept: "application/json",
      "User-Agent": "CryptoMinerArcadia-Staging/1.0",
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  let result: Record<string, unknown>;
  try {
    // The provider has returned valid JSON with text/html in the past.  Parse
    // the bounded body while still rejecting an actual HTML console page.
    const contentType = response.headers.get("content-type") ?? "";
    const responseForJson = contentType.toLowerCase().includes("application/json")
      ? response
      : new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers({
            ...Object.fromEntries(response.headers.entries()),
            "content-type": "application/json",
          }),
        });
    result = await readBoundedJsonObject(responseForJson, input.maxResponseBytes ?? 128_000);
  } catch {
    throw new Error(
      `O CCPayment não retornou JSON válido para ${input.path} (HTTP ${response.status}).`,
    );
  }
  const responseCode = result.code === undefined ? null : Number(result.code);
  if (!response.ok || (responseCode !== null && responseCode !== 10000)) {
    const message = cleanProviderValue(result.msg ?? result.message);
    throw new Error(
      message
        ? `O CCPayment recusou a consulta: ${message.slice(0, 180)}`
        : "O CCPayment recusou a consulta do depósito.",
    );
  }
  return result;
}

function ccpaymentRecordList(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const object = value as Record<string, unknown>;
  const direct = object.record;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return [direct as Record<string, unknown>];
  }
  const records = object.records;
  if (Array.isArray(records)) {
    return records.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    );
  }
  return providerRecordList(value);
}

function ccpaymentWebhookMessage(payload: Record<string, unknown>) {
  const nested = payload.msg;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : payload;
}

function normalizeProviderDepositAsset(value: unknown) {
  const asset = cleanProviderValue(value).toUpperCase();
  if (!isNowPaymentsAsset(asset)) {
    throw new Error("Moeda de depósito não suportada. Use BTC, DOGE ou LTC.");
  }
  return asset;
}

export async function readProviderDepositMinimum(input: {
  asset: unknown;
  environment: unknown;
}) {
  if (selectedDepositProvider(input.environment) !== "nowpayments") {
    throw new Error("NOWPayments está desativado; use o checkout CCPayment.");
  }
  const asset = normalizeProviderDepositAsset(input.asset);
  const config = readNowPaymentsConfig(input.environment);
  if (!config.providerReady) {
    throw new Error("O provedor de depósitos ainda não está configurado.");
  }
  const query = new URLSearchParams({
    currency_from: asset.toLowerCase(),
    currency_to: asset.toLowerCase(),
    fiat_equivalent: "usd",
    is_fee_paid_by_user: "true",
    is_fixed_rate: "false",
  });
  const response = await fetch(`${config.apiBaseUrl}/min-amount?${query}`, {
    headers: { "x-api-key": config.apiKey },
    signal: AbortSignal.timeout(8_000),
  });
  const result = await readBoundedJsonObject(response);
  const providerMinimumUsd = parseNowPaymentsMinimumUsd(result);
  const minimumUsd =
    providerMinimumUsd === null
      ? null
      : safeNowPaymentsMinimumUsd(providerMinimumUsd);
  if (!response.ok || minimumUsd === null) {
    throw new Error(
      "Não foi possível confirmar o mínimo atual dessa rede. Tente novamente em instantes.",
    );
  }
  return {
    asset,
    minimumUsd,
    observedAt: Date.now(),
    settlementAsset: asset,
  };
}

export async function createProviderDepositIntent(input: {
  accountId: string;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
  usdAmount: unknown;
}) {
  if (selectedDepositProvider(input.environment) !== "nowpayments") {
    throw new Error("NOWPayments está desativado; use o checkout CCPayment.");
  }
  const config = readNowPaymentsConfig(input.environment);
  if (!config.depositsEnabled) {
    throw new Error("Depósitos reais ainda aguardam a conta comercial do provedor.");
  }
  if (!(await accountMayCreateLiveDeposit(input.db, input.accountId, input.environment))) {
    throw new Error("Depósitos reais estão em homologação exclusiva da conta fundadora.");
  }
  const asset = normalizeProviderDepositAsset(input.asset);
  const providerMinimum = await readProviderDepositMinimum({
    asset,
    environment: input.environment,
  });
  const rawUsdAmount = Number(input.usdAmount);
  const usdAmount = Math.round(rawUsdAmount * 100) / 100;
  if (
    !Number.isFinite(rawUsdAmount) ||
    usdAmount < providerMinimum.minimumUsd ||
    usdAmount > 1_000
  ) {
    throw new Error(
      `O mínimo atual para ${asset} é US$ ${providerMinimum.minimumUsd.toFixed(2)}. O máximo local é US$ 1.000.`,
    );
  }
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  const recent = await input.db
    .prepare(`SELECT COUNT(*) AS total FROM wallet_deposit_intents
      WHERE account_id = ? AND provider = 'nowpayments' AND created_at >= ?`)
    .bind(input.accountId, now - 60 * 60 * 1000)
    .first<{ total: number }>();
  if (Number(recent?.total ?? 0) >= 5) {
    throw new Error("Limite de cinco faturas por hora alcançado.");
  }

  const id = `deposit-${crypto.randomUUID()}`;
  const expiresAt = now + 30 * 60 * 1000;
  await input.db
    .prepare(`INSERT INTO wallet_deposit_intents (
      id, account_id, asset, provider, provider_reference, checkout_url,
      deposit_address, requested_usd_micros, received_atomic, status,
      expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'nowpayments', NULL, NULL, NULL, ?, 0,
      'creating', ?, ?, ?)`)
    .bind(
      id,
      input.accountId,
      asset,
      Math.round(usdAmount * 1_000_000),
      expiresAt,
      now,
      now,
    )
    .run();

  try {
    const response = await fetch(`${config.apiBaseUrl}/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        cancel_url: `${config.publicBaseUrl}/?view=wallet&deposit=cancelled`,
        ipn_callback_url: `${config.publicBaseUrl}/api/wallet/nowpayments`,
        is_fee_paid_by_user: true,
        is_fixed_rate: false,
        order_description: "Crédito de saldo no Crypto Miner Arcadia",
        order_id: id,
        pay_currency: asset.toLowerCase(),
        price_amount: usdAmount,
        price_currency: "usd",
        success_url: `${config.publicBaseUrl}/?view=wallet&deposit=received`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await readBoundedJsonObject(response);
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "A chave cadastrada não foi aceita pelo sandbox da NOWPayments. Use uma credencial de sandbox separada.",
      );
    }
    const providerReference = cleanProviderValue(result.id);
    const checkoutUrl = validNowPaymentsCheckoutUrl(result.invoice_url);
    if (!response.ok || !providerReference || !checkoutUrl) {
      const providerMessage = cleanProviderValue(result.message);
      throw new Error(
        providerMessage
          ? `O provedor recusou a fatura: ${providerMessage.slice(0, 180)}`
          : "O provedor não criou uma fatura válida.",
      );
    }
    await input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET provider_reference = ?, checkout_url = ?, status = 'waiting',
            updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'creating'`)
      .bind(providerReference, checkoutUrl, now, id, input.accountId)
      .run();
    return {
      asset,
      checkoutUrl,
      expiresAt,
      id,
      provider: "nowpayments" as const,
      requestedUsd: usdAmount,
      status: "waiting" as const,
    };
  } catch (error) {
    await input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'provider_failed', updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'creating'`)
      .bind(Date.now(), id, input.accountId)
      .run();
    throw error;
  }
}

/**
 * Creates a hosted CCPayment checkout order.
 *
 * This path is deliberately gated by CCPAYMENT_CHECKOUT_ENABLED.  Having the
 * endpoint and signed webhook configured is not enough to start moving real
 * funds; staging must explicitly opt in after the merchant has validated the
 * checkout account and callback URL.
 */
export async function createCCPaymentDepositIntent(input: {
  accountId: string;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
  amount: unknown;
}) {
  if (selectedDepositProvider(input.environment) !== "ccpayment") {
    throw new Error("CCPayment ainda não é o provedor ativo neste ambiente.");
  }
  const config = readCCPaymentConfig(input.environment);
  if (!config.providerReady) {
    throw new Error("O checkout CCPayment ainda não está configurado.");
  }
  if (!config.checkoutEnabled) {
    throw new Error(
      "O checkout CCPayment está configurado, mas permanece pausado até a ativação segura no staging.",
    );
  }
  const asset = normalizeProviderDepositAsset(input.asset);
  const decimals = settlementAssetDecimals(asset);
  // The UI accepts both Portuguese comma decimals and API-style dot decimals.
  // Normalize before parsing so values such as `0,0001` are not rejected.
  const normalizedAmount = typeof input.amount === "string"
    ? input.amount.trim().replace(",", ".")
    : input.amount;
  const requestedAtomic = parseDecimalAtomic(normalizedAmount, decimals);
  const checkoutAtomic = requestedAtomic === null
    ? null
    : grossUpCCPaymentAtomic(requestedAtomic, config.customerFeeBps);
  const customerFeeAtomic = requestedAtomic === null || checkoutAtomic === null
    ? null
    : ccpaymentFeeAtomic(checkoutAtomic, requestedAtomic);
  if (
    requestedAtomic === null ||
    checkoutAtomic === null ||
    customerFeeAtomic === null
  ) {
    throw new Error(
      `Informe uma quantidade válida de ${asset} com até ${decimals} casas decimais.`,
    );
  }
  const requestedAmount = formatAtomic(BigInt(requestedAtomic), decimals);
  const checkoutAmount = formatAtomic(BigInt(checkoutAtomic), decimals);
  const customerFeeAmount = formatAtomic(BigInt(customerFeeAtomic), decimals);

  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  const recent = await input.db
    .prepare(`SELECT COUNT(*) AS total FROM wallet_deposit_intents
      WHERE account_id = ? AND provider = 'ccpayment' AND created_at >= ?
        AND status IN ('creating', 'waiting')`)
    .bind(input.accountId, now - 60 * 60 * 1000)
    .first<{ total: number }>();
  if (Number(recent?.total ?? 0) >= 5) {
    throw new Error("Limite de cinco faturas CCPayment por hora alcançado.");
  }

  const id = `deposit-${crypto.randomUUID()}`;
  const expiresAt = now + 30 * 60 * 1000;
  await input.db
    .prepare(`INSERT INTO wallet_deposit_intents (
      id, account_id, asset, provider, provider_reference, checkout_url,
      deposit_address, requested_usd_micros, received_atomic, status,
      expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'ccpayment', NULL, NULL, NULL, ?, 0,
      'creating', ?, ?, ?)`)
    .bind(
      id,
      input.accountId,
      asset,
      0,
      expiresAt,
      now,
      now,
    )
    .run();

  try {
    const apiVersion = ccpaymentApiVersion(config.apiBaseUrl);
    if (apiVersion !== "v2") {
      throw new Error(
        "A API v1 do CCPayment não está disponível para este comerciante; atualize o endpoint para v2.",
      );
    }

    async function requestCCPayment(
      path: string,
      payload?: Record<string, unknown>,
      maxResponseBytes = 64_000,
    ) {
      // CCPayment's v2 SDK sends an empty JSON object for endpoints without
      // request fields (for example getCoinList/getFiatList). Sending an
      // actual JSON body keeps the signature and content type aligned with
      // the provider's API router; an empty HTTP body can be routed to the
      // public web handler, which returns HTML with status 200.
      const body = payload === undefined ? "{}" : JSON.stringify(payload);
      const headers = await createCCPaymentHeaders({
        appId: config.appId,
        appSecret: config.appSecret,
        body,
        nowMs: now,
        version: apiVersion,
      });
      const response = await fetch(`${config.apiBaseUrl}${path}`, {
        method: "POST",
        headers: {
          ...headers,
          Accept: "application/json",
          "User-Agent": "CryptoMinerArcadia-Staging/1.0",
        },
        body,
        // An API endpoint must never silently follow a redirect to the
        // CCPayment website: that produces an HTML 200 response and hides the
        // real integration/configuration error.
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      // Keep provider diagnostics bounded and credential-free. This is useful
      // when an upstream edge serves its HTML website instead of the JSON API.
      console.error("ccpayment_request", {
        apiPath: new URL(config.apiBaseUrl).pathname,
        path,
        apiVersion,
        bodyBytes: new TextEncoder().encode(body).byteLength,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        responseUrl: response.url ? new URL(response.url).pathname : "",
      });
      let result: Record<string, unknown>;
      try {
        // CCPayment's edge sometimes returns a valid JSON envelope with the
        // incorrect `text/html; charset=UTF-8` media type.  Do not reject a
        // bounded JSON body solely because that header is wrong; still parse
        // the body strictly and fail closed for an actual HTML page.
        const contentType = response.headers.get("content-type") ?? "";
        const responseForJson = contentType.toLowerCase().includes("application/json")
          ? response
          : new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: new Headers({
                ...Object.fromEntries(response.headers.entries()),
                "content-type": "application/json",
              }),
            });
        result = await readBoundedJsonObject(responseForJson, maxResponseBytes);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        if (reason.includes("excedeu o limite seguro")) {
          throw new Error("A resposta do CCPayment excedeu o limite permitido.");
        }
        const contentType = response.headers.get("content-type") ?? "desconhecido";
        if (response.status >= 300 && response.status < 400) {
          throw new Error(
            `O CCPayment redirecionou a solicitação em ${path}; verifique o endpoint da API v2.`,
          );
        }
        throw new Error(
          `O CCPayment retornou uma resposta inválida em ${path} (HTTP ${response.status}, ${contentType}).`,
        );
      }
      const responseCode = result.code === undefined ? null : Number(result.code);
      if (!response.ok || (responseCode !== null && responseCode !== 10000)) {
        const message = cleanProviderValue(result.msg ?? result.message);
        throw new Error(
          message
            ? `O CCPayment recusou a solicitação: ${message.slice(0, 180)}`
            : "O CCPayment recusou a solicitação.",
        );
      }
      return result;
    }

    // The coin catalog includes network metadata for every asset and can be
    // larger than the normal 64 KiB response budget. Keep the bounded parser,
    // but allow a catalog-sized response without buffering an unbounded body.
    const coinResponse = await requestCCPayment("/getCoinList", undefined, 512_000);
    const coins = providerRecordList(coinResponse.data);
    // CCPayment's v1/v2 responses use `crypto` for the ticker (the older
    // SDK documents this shape as `data.list[].crypto`).  Keep the aliases
    // tolerant so enabling a coin in the merchant panel is reflected here
    // regardless of which API revision is serving the request.
    const coin = coins.find((entry) => {
      return providerField(
        entry,
        "symbol",
        "crypto",
        "coinSymbol",
        "coin_symbol",
        "code",
      ).toUpperCase() === asset;
    });
    const coinId = Number(
      providerField(coin ?? {}, "coinId", "coin_id", "tokenId", "token_id", "id"),
    );
    if (!Number.isSafeInteger(coinId) || coinId <= 0) {
      throw new Error(`O CCPayment não disponibilizou a moeda ${asset} para este comerciante.`);
    }
    // Some revisions call the supported-chain list `tokens`; newer ones use
    // `networks`/`chains`.  A native coin such as DOGE has no child list, so
    // the asset ticker itself remains the safe chain fallback below.
    const networks = coin?.networks ?? coin?.network ?? coin?.chains ?? coin?.tokens;
    const networkEntries = Array.isArray(networks)
      ? networks.map((entry, index) => [String(index), entry] as const)
      : networks && typeof networks === "object"
        ? Object.entries(networks as Record<string, unknown>)
        : [];
    const selectedNetwork = networkEntries.find(([key, value]) => {
      const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const networkName = providerField(
        record,
        "chain",
        "network",
        "chainName",
        "chain_name",
        "symbol",
        "name",
      ).toUpperCase();
      return (
        key.toUpperCase() === asset ||
        networkName === asset
      );
    });
    const chain = cleanProviderValue(
      selectedNetwork?.[1] && typeof selectedNetwork[1] === "object"
        ? providerField(
            selectedNetwork[1] as Record<string, unknown>,
            "chain",
            "network",
            "chainName",
            "chain_name",
            "symbol",
            "name",
          ) || selectedNetwork[0]
        : selectedNetwork?.[0] ?? asset,
    );
    if (!chain) throw new Error(`O CCPayment não disponibilizou uma rede para ${asset}.`);

    const result = await requestCCPayment(config.checkoutEndpoint, {
      orderId: id,
      coinId,
      chain,
      // O checkout é denominado diretamente na cripto escolhida. O fiatId é
      // omitido de propósito para que o CCPayment não faça conversão cambial.
      // O valor bruto inclui a taxa de 0,5% paga pelo cliente.
      price: checkoutAmount,
      expiredAt: Math.floor(expiresAt / 1000),
      generateCheckoutURL: true,
      product: `Crédito de saldo Arcadia · ${asset}`,
      returnUrl: `${config.publicBaseUrl}/?view=wallet&deposit=received`,
    });
    const rawData = result.data;
    const data =
      rawData && typeof rawData === "object" && !Array.isArray(rawData)
        ? (rawData as Record<string, unknown>)
        : result;
    const providerReference = cleanProviderValue(
      data.order_id ??
        data.orderId ??
        data.payment_id ??
        data.paymentId ??
        result.order_id ??
        id,
    );
    const checkoutUrl = validCCPaymentCheckoutUrl(
      data.payment_url ??
        data.paymentUrl ??
        data.checkout_url ??
        data.checkoutUrl ??
        result.payment_url ??
        result.paymentUrl,
    );
    if (
      !providerReference ||
      !checkoutUrl
    ) {
      const providerMessage = cleanProviderValue(
        result.msg ?? result.message ?? data.msg ?? data.message,
      );
      throw new Error(
        providerMessage
          ? `O CCPayment recusou o checkout: ${providerMessage.slice(0, 180)}`
          : "O CCPayment não retornou um checkout válido.",
      );
    }
    await input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET provider_reference = ?, checkout_url = ?, status = 'waiting',
            updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'creating'`)
      .bind(providerReference, checkoutUrl, now, id, input.accountId)
      .run();
    return {
      asset,
      checkoutUrl,
      expiresAt,
      id,
      provider: "ccpayment" as const,
      requestedUsd: 0,
      checkoutUsd: 0,
      requestedAmount,
      checkoutAmount,
      customerFeeAmount,
      decimals,
      customerFeeBps: config.customerFeeBps,
      customerFeeUsd: 0,
      status: "waiting" as const,
    };
  } catch (error) {
    await input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'provider_failed', updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'creating'`)
      .bind(Date.now(), id, input.accountId)
      .run();
    throw error;
  }
}

async function providerEventHash(payload: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function processNowPaymentsIpn(input: {
  db: D1Database;
  environment: unknown;
  payload: unknown;
  signature: string;
  now?: number;
}) {
  const config = readNowPaymentsConfig(input.environment);
  if (!config.providerReady) {
    throw new Error("Provedor de depósitos não configurado.");
  }
  if (
    !(await verifyNowPaymentsPayload({
      payload: input.payload,
      secret: config.ipnSecret,
      signature: input.signature,
    }))
  ) {
    throw new Error("Assinatura do provedor inválida.");
  }
  if (!input.payload || typeof input.payload !== "object") {
    throw new Error("Evento do provedor inválido.");
  }
  const payload = input.payload as NowPaymentsIpnPayload;
  const intentId = cleanProviderValue(payload.order_id);
  const paymentReference = cleanProviderValue(
    payload.payment_id ?? payload.invoice_id,
  );
  const invoiceReference = cleanProviderValue(payload.invoice_id);
  const transactionHash = cleanProviderValue(
    payload.payin_hash ?? payload.payin_txid ?? payload.transaction_hash ?? payload.tx_hash,
  );
  const status = normalizeNowPaymentsStatus(payload.payment_status);
  if (!/^deposit-[0-9a-f-]{36}$/i.test(intentId) || !paymentReference) {
    throw new Error("Evento sem referência de depósito.");
  }
  await ensureWalletSchema(input.db);
  await pruneWalletOperationalHistory(input.db, input.now ?? Date.now());
  const intent = await input.db
    .prepare(`SELECT id, account_id, asset, provider, provider_reference,
      checkout_url, requested_usd_micros, received_atomic, status,
      expires_at, created_at
      FROM wallet_deposit_intents
      WHERE id = ? AND provider = 'nowpayments'`)
    .bind(intentId)
    .first<ProviderDepositIntentRow>();
  if (!intent) return { accepted: true as const, status: "unknown_intent" as const };
  const now = input.now ?? Date.now();
  const payloadHash = await providerEventHash(input.payload);
  const eventId = `nowpayments-${paymentReference}-${status}-${payloadHash.slice(0, 16)}`;
  await input.db
    .prepare(`INSERT OR IGNORE INTO wallet_provider_events (
      id, provider, provider_event_id, deposit_intent_id, payload_hash,
      status, created_at
    ) VALUES (?, 'nowpayments', ?, ?, ?, 'received', ?)`)
    .bind(eventId, eventId, intent.id, payloadHash, now)
    .run();

  if (intent.status === "credited") {
    return { accepted: true as const, status: "credited" as const };
  }
  if (status !== "finished") {
    await input.db.batch([
      input.db
        .prepare(`UPDATE wallet_deposit_intents
          SET status = ?, updated_at = ?
          WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
        .bind(status, now, intent.id),
      input.db
        .prepare(`UPDATE wallet_provider_events SET status = 'processed'
          WHERE id = ?`)
        .bind(eventId),
    ]);
    return { accepted: true as const, status };
  }

  const eventAsset = cleanProviderValue(payload.pay_currency).toUpperCase();
  const paidAmount = cleanProviderValue(
    payload.actually_paid ?? payload.pay_amount,
  );
  const priceCurrency = cleanProviderValue(payload.price_currency).toUpperCase();
  const priceAmountMicros = parseDecimalAtomic(payload.price_amount, 6);
  const settlementAsset = cleanProviderValue(payload.outcome_currency).toUpperCase();
  const settlementAtomic = parseDecimalAtomic(
    payload.outcome_amount,
    settlementAssetDecimals(settlementAsset),
  );
  if (eventAsset !== intent.asset || !isNowPaymentsAsset(eventAsset)) {
    throw new Error("Moeda recebida não corresponde à fatura.");
  }
  if (
    !invoiceReference ||
    !intent.provider_reference ||
    invoiceReference !== intent.provider_reference
  ) {
    throw new Error("Fatura recebida não corresponde à referência do provedor.");
  }
  if (
    priceCurrency !== "USD" ||
    priceAmountMicros !== intent.requested_usd_micros
  ) {
    throw new Error("Valor confirmado não corresponde à fatura.");
  }
  const receivedAtomic = amountToAtomic(paidAmount, eventAsset);
  if (!receivedAtomic) throw new Error("Quantidade recebida inválida.");
  const configuredSettlementAsset = config.settlementAsset.toUpperCase();
  const nativeSettlement = settlementAsset === eventAsset;
  const configuredSettlement = settlementAsset === configuredSettlementAsset;
  if ((!nativeSettlement && !configuredSettlement) || !settlementAtomic) {
    await input.db.batch([
      input.db
        .prepare(`UPDATE wallet_deposit_intents
          SET status = 'review_required', received_atomic = ?,
              settlement_asset = ?, settlement_atomic = ?, updated_at = ?
          WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
        .bind(
          receivedAtomic,
          settlementAsset || null,
          settlementAtomic ?? 0,
          now,
          intent.id,
        ),
      input.db
        .prepare(`UPDATE wallet_provider_events SET status = 'processed'
          WHERE id = ?`)
        .bind(eventId),
    ]);
    return { accepted: true as const, status: "review_required" as const };
  }
  const stateRow = await input.db
    .prepare(`SELECT state_json, version FROM game_states WHERE account_id = ?`)
    .bind(intent.account_id)
    .first<{ state_json: string; version: number }>();
  if (!stateRow) {
    await input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'pending_account', updated_at = ? WHERE id = ?`)
      .bind(now, intent.id)
      .run();
    return { accepted: true as const, status: "pending_account" as const };
  }

  const state = normalizeBootstrapState(JSON.parse(stateRow.state_json), now);
  const balances = applyCryptoDepositBalances({
    asset: eventAsset,
    btcBalanceAtomic: state.btcBalanceAtomic,
    dogeBalanceAtomic: state.dogeBalanceAtomic,
    ltcBalanceAtomic: state.ltcBalanceAtomic,
    receivedAtomic,
  });
  state.btcBalanceAtomic = balances.btcBalanceAtomic;
  state.dogeBalanceAtomic = balances.dogeBalanceAtomic;
  state.ltcBalanceAtomic = balances.ltcBalanceAtomic;
  state.displayedBalanceSymbol = eventAsset;
  const nextVersion = stateRow.version + 1;
  const nextStateJson = JSON.stringify(state);
  const idempotencyKey = `deposit:${intent.id}`;
  const ledgerId = crypto.randomUUID();
  const metadataJson = JSON.stringify({
    creditedAsset: eventAsset,
    creditedAtomic: receivedAtomic,
    invoiceUsdMicros: intent.requested_usd_micros,
    manualConversionRequired: true,
    paidAsset: eventAsset,
    provider: "nowpayments",
    providerReference: paymentReference,
    receivedAtomic,
    settlementAsset,
    settlementAtomic,
  });
  const results = await input.db.batch([
    input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'crediting', received_atomic = ?, settlement_asset = ?,
            transaction_hash = COALESCE(?, transaction_hash),
            settlement_atomic = ?, credited_cma_micros = ?, updated_at = ?
        WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
      .bind(
        receivedAtomic,
        settlementAsset,
        transactionHash || null,
        settlementAtomic,
        0,
        now,
        intent.id,
      ),
    input.db
      .prepare(`UPDATE game_states
        SET state_json = ?, version = ?, updated_at = ?
        WHERE account_id = ? AND version = ?
          AND EXISTS (SELECT 1 FROM wallet_deposit_intents
            WHERE id = ? AND status = 'crediting')`)
      .bind(
        nextStateJson,
        nextVersion,
        now,
        intent.account_id,
        stateRow.version,
        intent.id,
      ),
    input.db
      .prepare(`INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) SELECT ?, ?, 'credit_crypto_deposit', ?, ?, 0, ?, ?
        WHERE EXISTS (SELECT 1 FROM game_states
          WHERE account_id = ? AND version = ? AND state_json = ?)
          AND EXISTS (SELECT 1 FROM wallet_deposit_intents
            WHERE id = ? AND status = 'crediting')`)
      .bind(
        ledgerId,
        intent.account_id,
        idempotencyKey,
        nextVersion,
        metadataJson,
        now,
        intent.account_id,
        nextVersion,
        nextStateJson,
        intent.id,
      ),
    input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'credited', received_atomic = ?, settlement_asset = ?,
            settlement_atomic = ?, credited_cma_micros = ?, updated_at = ?
        WHERE id = ? AND status = 'crediting'
          AND EXISTS (SELECT 1 FROM ledger_entries
            WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(
        receivedAtomic,
        settlementAsset,
        settlementAtomic,
        0,
        now,
        intent.id,
        intent.account_id,
        idempotencyKey,
      ),
    input.db
      .prepare(`UPDATE wallet_provider_events SET status = 'processed'
        WHERE id = ?`)
      .bind(eventId),
  ]);
  if (Number(results[3]?.meta.changes ?? 0) !== 1) {
    await input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'finished', updated_at = ?
        WHERE id = ? AND status = 'crediting'
          AND NOT EXISTS (SELECT 1 FROM ledger_entries
            WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(now, intent.id, intent.account_id, idempotencyKey)
      .run();
    throw new Error("Conta atualizada em outra sessão; o crédito será reprocessado.");
  }
  return {
    accepted: true as const,
    asset: eventAsset,
    creditedAtomic: receivedAtomic,
    receivedAtomic,
    settlementAsset,
    settlementAtomic,
    status: "credited" as const,
  };
}

type CCPaymentDepositIntentRow = ProviderDepositIntentRow;

/**
 * Processes the signed CCPayment v2 deposit webhook.
 *
 * CCPayment sends an envelope (`{ type, msg }`) whose `msg` contains the
 * `referenceId`/`recordId`, not the paid amount.  The amount is fetched from
 * the signed merchant API before the same idempotent crypto ledger flow used
 * by NOWPayments is executed.
 */
export async function processCCPaymentWebhook(input: {
  db: D1Database;
  environment: unknown;
  payload: unknown;
  now?: number;
}) {
  const config = readCCPaymentConfig(input.environment);
  if (!config.webhookReady) throw new Error("CCPayment não está configurado.");
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new Error("Evento CCPayment inválido.");
  }
  const payload = input.payload as Record<string, unknown>;
  const message = ccpaymentWebhookMessage(payload);
  const intentId = cleanProviderValue(
    message.referenceId ??
      message.reference_id ??
      message.orderId ??
      message.order_id ??
      payload.referenceId ??
      payload.orderId,
  );
  const providerReference = cleanProviderValue(
    message.recordId ??
      message.record_id ??
      message.paymentId ??
      message.payment_id ??
      payload.recordId ??
      payload.paymentId,
  );
  const status = normalizeCCPaymentStatus(
    message.status ?? payload.status ?? payload.paymentStatus ?? payload.payment_status,
  );
  // Keep webhook diagnostics credential-free.  CCPayment has sent a few
  // envelope variants during activation, so the key names are more useful
  // than logging the payload itself when a callback cannot be correlated.
  console.log("ccpayment_webhook_received", {
    topKeys: Object.keys(payload).slice(0, 24),
    messageKeys: Object.keys(message).slice(0, 24),
    intentPrefix: intentId ? intentId.slice(0, 24) : null,
    providerPrefix: providerReference ? providerReference.slice(0, 24) : null,
    status,
  });
  if (!intentId && !providerReference) {
    throw new Error("Evento CCPayment sem referência de depósito.");
  }

  await ensureWalletSchema(input.db);
  await pruneWalletOperationalHistory(input.db, input.now ?? Date.now());
  const now = input.now ?? Date.now();
  const payloadHash = await providerEventHash(input.payload);
  const eventReference = providerReference || intentId || `payload-${payloadHash}`;
  const eventId = `ccpayment-${eventReference}-${status}`;
  const intent = intentId || providerReference
    ? await input.db
        .prepare(`SELECT id, account_id, asset, provider, provider_reference,
          checkout_url, requested_usd_micros, received_atomic, status,
          settlement_asset, settlement_atomic, credited_cma_micros,
          expires_at, created_at
          FROM wallet_deposit_intents
          WHERE provider = 'ccpayment'
            AND (id = ? OR provider_reference = ?)`)
        .bind(intentId || providerReference, providerReference || intentId)
        .first<CCPaymentDepositIntentRow>()
    : null;

  await input.db
    .prepare(`INSERT OR IGNORE INTO wallet_provider_events (
      id, provider, provider_event_id, deposit_intent_id, payload_hash,
      status, created_at
    ) VALUES (?, 'ccpayment', ?, ?, ?, 'received', ?)`)
    .bind(eventId, eventId, intent?.id ?? null, payloadHash, now)
    .run();

  // A provider retry for an already credited order must remain harmless.
  if (!intent) {
    await input.db
      .prepare(`UPDATE wallet_provider_events SET status = 'unknown_intent'
        WHERE id = ?`)
      .bind(eventId)
      .run();
    return { accepted: true as const, status: "unknown_intent" as const };
  }
  if (intent.status === "credited") {
    await input.db
      .prepare(`UPDATE wallet_provider_events SET status = 'processed'
        WHERE id = ?`)
      .bind(eventId)
      .run();
    return { accepted: true as const, status: "credited" as const };
  }
  if (status === "failed") {
    await input.db.batch([
      input.db
        .prepare(`UPDATE wallet_deposit_intents SET status = 'provider_failed', updated_at = ?
          WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
        .bind(now, intent.id),
      input.db
        .prepare(`UPDATE wallet_provider_events SET status = 'processed' WHERE id = ?`)
        .bind(eventId),
    ]);
    return { accepted: true as const, status: "failed" as const };
  }
  if (status !== "finished") {
    await input.db.batch([
      input.db
        .prepare(`UPDATE wallet_deposit_intents SET status = 'waiting', updated_at = ?
          WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
        .bind(now, intent.id),
      input.db
        .prepare(`UPDATE wallet_provider_events SET status = 'processed' WHERE id = ?`)
        .bind(eventId),
    ]);
    return { accepted: true as const, status: "pending" as const };
  }

  let records: Array<Record<string, unknown>> = [];
  if (providerReference) {
    try {
      const response = await requestCCPaymentApi({
        config,
        path: "/getAppDepositRecord",
        payload: { recordId: providerReference },
        now,
      });
      records = ccpaymentRecordList(response.data ?? response);
    } catch {
      // A webhook may contain referenceId in the recordId position on older
      // revisions.  Fall back to the order/reference list query below.
      records = [];
    }
  }
  if (!records.length) {
    const identifiers = [intent.id, intent.provider_reference]
      .filter((value): value is string => Boolean(value));
    const queries: Array<Record<string, unknown>> = [];
    const endAt = Math.floor(now / 1000);
    const startAt = Math.max(1, endAt - 90 * 24 * 60 * 60);
    for (const identifier of identifiers) {
      // CCPayment's v2 API documents both the scalar and array filters.  Some
      // merchant accounts reject the array form with `invalid argument`, so
      // try the scalar filters first and keep the array form as a fallback.
      const scope = { startAt, endAt, limit: 100 };
      queries.push({ ...scope, orderId: identifier });
      queries.push({ ...scope, referenceId: identifier });
      queries.push({ ...scope, recordIds: [identifier] });
      queries.push({ ...scope, referenceIds: [identifier] });
      queries.push({ ...scope, orderIds: [identifier] });
    }
    for (const query of queries) {
      try {
        const response = await requestCCPaymentApi({
          config,
          path: "/getAppDepositRecordList",
          payload: query,
          now,
        });
        records = ccpaymentRecordList(response.data ?? response);
        if (records.length) break;
      } catch {
        // Keep trying the alternate identifier form.
      }
    }
  }
  const record = records.find((candidate) => {
    const recordId = providerField(candidate, "recordId", "record_id");
    const referenceId = providerField(candidate, "referenceId", "reference_id", "orderId", "order_id");
    return (
      (!providerReference || !recordId || recordId === providerReference) &&
      (!referenceId || referenceId === intent.id || referenceId === intent.provider_reference)
    );
  }) ?? records[0];
  if (!record) {
    // Do not lose the event when the provider is still indexing the payment;
    // returning a retryable error makes CCPayment send the callback again.
    throw new Error("O CCPayment ainda não disponibilizou o registro do depósito.");
  }

  const recordStatus = normalizeCCPaymentStatus(
    providerField(record, "status", "paymentStatus", "payment_status") || status,
  );
  if (recordStatus === "failed") {
    await input.db.batch([
      input.db
        .prepare(`UPDATE wallet_deposit_intents SET status = 'provider_failed', updated_at = ?
          WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
        .bind(now, intent.id),
      input.db
        .prepare(`UPDATE wallet_provider_events SET status = 'processed' WHERE id = ?`)
        .bind(eventId),
    ]);
    return { accepted: true as const, status: "failed" as const };
  }
  if (recordStatus !== "finished") {
    await input.db
      .prepare(`UPDATE wallet_provider_events SET status = 'processed' WHERE id = ?`)
      .bind(eventId)
      .run();
    return { accepted: true as const, status: "pending" as const };
  }

  const eventAsset = cleanProviderValue(
    providerField(record, "coinSymbol", "coin_symbol", "symbol", "crypto") ||
      providerField(message, "coinSymbol", "coin_symbol", "symbol", "crypto") ||
      intent.asset,
  ).toUpperCase();
  if (eventAsset !== intent.asset || !isNowPaymentsAsset(eventAsset)) {
    throw new Error("Moeda recebida não corresponde ao pedido CCPayment.");
  }
  const paidAmount = providerField(
    record,
    "amount",
    "paidAmount",
    "paid_amount",
    "orderAmount",
    "order_amount",
  );
  const receivedAtomic = amountToAtomic(paidAmount, eventAsset);
  if (!receivedAtomic) throw new Error("Quantidade recebida pelo CCPayment inválida.");

  const stateRow = await input.db
    .prepare(`SELECT state_json, version FROM game_states WHERE account_id = ?`)
    .bind(intent.account_id)
    .first<{ state_json: string; version: number }>();
  if (!stateRow) {
    await input.db
      .prepare(`UPDATE wallet_deposit_intents SET status = 'pending_account', updated_at = ?
        WHERE id = ?`)
      .bind(now, intent.id)
      .run();
    return { accepted: true as const, status: "pending_account" as const };
  }

  const state = normalizeBootstrapState(JSON.parse(stateRow.state_json), now);
  const balances = applyCryptoDepositBalances({
    asset: eventAsset,
    btcBalanceAtomic: state.btcBalanceAtomic,
    dogeBalanceAtomic: state.dogeBalanceAtomic,
    ltcBalanceAtomic: state.ltcBalanceAtomic,
    receivedAtomic,
  });
  state.btcBalanceAtomic = balances.btcBalanceAtomic;
  state.dogeBalanceAtomic = balances.dogeBalanceAtomic;
  state.ltcBalanceAtomic = balances.ltcBalanceAtomic;
  state.displayedBalanceSymbol = eventAsset;
  const nextVersion = stateRow.version + 1;
  const nextStateJson = JSON.stringify(state);
  const idempotencyKey = `deposit:${intent.id}`;
  const ledgerId = crypto.randomUUID();
  const recordId = providerField(record, "recordId", "record_id") || providerReference;
  const txId = providerField(
    record,
    "txHash",
    "tx_hash",
    "transactionHash",
    "transaction_hash",
    "txId",
    "tx_id",
    "transactionId",
    "transaction_id",
  );
  const metadataJson = JSON.stringify({
    creditedAsset: eventAsset,
    creditedAtomic: receivedAtomic,
    manualConversionRequired: true,
    paidAsset: eventAsset,
    provider: "ccpayment",
    providerReference: recordId,
    receivedAtomic,
    transactionId: txId || null,
  });
  const results = await input.db.batch([
    input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'crediting', received_atomic = ?, settlement_asset = ?,
            transaction_hash = COALESCE(?, transaction_hash),
            settlement_atomic = ?, credited_cma_micros = 0, updated_at = ?
        WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
      .bind(receivedAtomic, eventAsset, txId || null, receivedAtomic, now, intent.id),
    input.db
      .prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
        WHERE account_id = ? AND version = ?
          AND EXISTS (SELECT 1 FROM wallet_deposit_intents
            WHERE id = ? AND status = 'crediting')`)
      .bind(nextStateJson, nextVersion, now, intent.account_id, stateRow.version, intent.id),
    input.db
      .prepare(`INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) SELECT ?, ?, 'credit_crypto_deposit', ?, ?, 0, ?, ?
        WHERE EXISTS (SELECT 1 FROM game_states
          WHERE account_id = ? AND version = ? AND state_json = ?)
          AND EXISTS (SELECT 1 FROM wallet_deposit_intents
            WHERE id = ? AND status = 'crediting')`)
      .bind(
        ledgerId,
        intent.account_id,
        idempotencyKey,
        nextVersion,
        metadataJson,
        now,
        intent.account_id,
        nextVersion,
        nextStateJson,
        intent.id,
      ),
    input.db
      .prepare(`UPDATE wallet_deposit_intents SET status = 'credited',
        received_atomic = ?, settlement_asset = ?, settlement_atomic = ?,
        credited_cma_micros = 0, updated_at = ?
        WHERE id = ? AND status = 'crediting'
          AND EXISTS (SELECT 1 FROM ledger_entries
            WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(
        receivedAtomic,
        eventAsset,
        receivedAtomic,
        now,
        intent.id,
        intent.account_id,
        idempotencyKey,
      ),
    input.db
      .prepare(`UPDATE wallet_provider_events SET status = 'processed'
        WHERE id = ?`)
      .bind(eventId),
  ]);
  if (Number(results[3]?.meta.changes ?? 0) !== 1) {
    await input.db
      .prepare(`UPDATE wallet_deposit_intents SET status = 'finished', updated_at = ?
        WHERE id = ? AND status = 'crediting'
          AND NOT EXISTS (SELECT 1 FROM ledger_entries
            WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(now, intent.id, intent.account_id, idempotencyKey)
      .run();
    throw new Error("Conta atualizada em outra sessão; o crédito será reprocessado.");
  }
  return {
    accepted: true as const,
    asset: eventAsset,
    creditedAtomic: receivedAtomic,
    receivedAtomic,
    status: "credited" as const,
    transactionId: txId || null,
  };
}

/**
 * Reconciles a few pending CCPayment intents on wallet reads.  This recovers
 * payments whose callback arrived while the old staging handler only recorded
 * the event, while remaining bounded and scoped to the authenticated account.
 */
async function reconcileCCPaymentDeposits(input: {
  accountId: string;
  db: D1Database;
  environment: unknown;
  now: number;
}) {
  const config = readCCPaymentConfig(input.environment);
  if (!config.providerReady || !config.checkoutEnabled) return;
  const pending = await input.db
    .prepare(`SELECT id FROM wallet_deposit_intents
      WHERE account_id = ? AND provider = 'ccpayment'
        AND status IN ('creating', 'waiting', 'pending')
      ORDER BY created_at DESC LIMIT 3`)
    .bind(input.accountId)
    .all<{ id: string }>();
  console.log("ccpayment_reconcile_start", {
    account: input.accountId.slice(0, 12),
    pending: pending.results?.length ?? 0,
  });
  for (const row of pending.results ?? []) {
    let queryAttempts = 0;
    let queryFailures = 0;
    try {
      let records: Array<Record<string, unknown>> = [];
      // The provider documentation defines these values as Unix seconds and
      // some merchant accounts reject an otherwise valid list request unless
      // the time window is explicit. Keep the window bounded to the period in
      // which a checkout can still be paid, while retaining a final recent
      // history fallback for older API revisions.
      const endAt = Math.floor(input.now / 1000);
      const startAt = Math.max(1, endAt - 90 * 24 * 60 * 60);
      const scoped = { startAt, endAt, limit: 100 };
      // The v2 documentation exposes both `orderId` and `orderIds`.  The
      // scalar form is accepted by older CCPayment merchant accounts, while
      // the array form can return `invalid argument` there.
      for (const payload of [
        { ...scoped, orderId: row.id },
        { ...scoped, referenceId: row.id },
        { ...scoped, recordIds: [row.id] },
        { ...scoped, referenceIds: [row.id] },
        { ...scoped, orderIds: [row.id] },
        // A few CCPayment merchant accounts reject all identifier filters.
        // The unfiltered list is still bounded by the provider's default
        // recent-history window; we match the local order before processing.
        scoped,
      ]) {
        queryAttempts += 1;
        try {
          const response = await requestCCPaymentApi({
            config,
            path: "/getAppDepositRecordList",
            payload,
            now: input.now,
          });
          const candidateRecords = ccpaymentRecordList(response.data ?? response);
          const matchingCandidates = candidateRecords.filter((record) => {
            const identifiers = [
              providerField(record, "recordId", "record_id"),
              providerField(record, "orderId", "order_id"),
              providerField(record, "referenceId", "reference_id"),
            ].filter(Boolean);
            return identifiers.includes(row.id);
          });
          console.log("ccpayment_reconcile_query", {
            intent: row.id.slice(0, 16),
            keys: Object.keys(payload),
            candidates: candidateRecords.length,
            matches: matchingCandidates.length,
          });
          if (matchingCandidates.length) {
            records = matchingCandidates;
            break;
          }
        } catch (error) {
          queryFailures += 1;
          console.warn("ccpayment_reconcile_query_failed", {
            intent: row.id.slice(0, 16),
            keys: Object.keys(payload),
            reason: error instanceof Error ? error.message.slice(0, 180) : "unknown_error",
          });
          // Try the next documented filter shape.
        }
      }
      console.log("ccpayment_reconcile_result", {
        intent: row.id.slice(0, 16),
        attempts: queryAttempts,
        failures: queryFailures,
        records: records.length,
      });
      for (const record of records.slice(0, 3)) {
        await processCCPaymentWebhook({
          db: input.db,
          environment: input.environment,
          now: input.now,
          payload: { type: "reconcileDeposit", msg: record },
        });
      }
    } catch (error) {
      console.error("ccpayment_reconcile_failed", {
        reason: error instanceof Error ? error.message.slice(0, 180) : "unknown_error",
      });
    }
  }
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
    throw new Error("Escolha BTC, DOGE ou LTC para a simulação.");
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
    throw new Error("Informe BTC, DOGE ou LTC e uma quantidade válida.");
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

function validWithdrawalAddress(asset: WalletSandboxAsset, value: unknown) {
  if (typeof value !== "string") return null;
  const address = value.trim();
  if (address.length > 96 || /\s/.test(address)) return null;
  if (asset === "BTC") {
    const valid =
      /^(?:bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
        address,
      );
    return valid ? address : null;
  }
  if (asset === "LTC") {
    const valid = /^(?:ltc1[ac-hj-np-z02-9]{11,71}|[LM][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
      address,
    );
    return valid ? address : null;
  }
  const valid = /^(?:D[5-9A-HJ-NP-Ua-km-z]{24,33}|[A9][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(
    address,
  );
  return valid ? address : null;
}

function withdrawalDestinationPreview(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function withdrawalBalance(state: PublicGameState, asset: WalletSandboxAsset) {
  if (asset === "BTC") return state.btcBalanceAtomic;
  if (asset === "DOGE") return state.dogeBalanceAtomic;
  return state.ltcBalanceAtomic;
}

function setWithdrawalBalance(
  state: PublicGameState,
  asset: WalletSandboxAsset,
  atomic: number,
) {
  if (asset === "BTC") state.btcBalanceAtomic = atomic;
  else if (asset === "DOGE") state.dogeBalanceAtomic = atomic;
  else state.ltcBalanceAtomic = atomic;
}

type PixKeyType = "cpf_cnpj" | "email" | "phone" | "random";

function validPixKey(type: unknown, value: unknown) {
  if (
    (type !== "cpf_cnpj" && type !== "email" && type !== "phone" && type !== "random") ||
    typeof value !== "string"
  ) {
    return null;
  }
  const key = value.trim();
  if (key.length < 5 || key.length > 120 || /[\r\n\t]/.test(key)) return null;
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return null;
  if (type === "phone" && !/^\+?\d{10,15}$/.test(key.replace(/[ ()-]/g, ""))) return null;
  if (type === "cpf_cnpj" && !/^(?:\d{11}|\d{14})$/.test(key.replace(/\D/g, ""))) return null;
  if (type === "random" && !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(key)) return null;
  return { key, type: type as PixKeyType };
}

function pixKeyPreview(key: string) {
  if (key.includes("@")) {
    const [name, domain] = key.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export async function createBrlWithdrawalRequest(input: {
  accountId: string;
  db: D1Database;
  environment: unknown;
  expectedVersion: unknown;
  idempotencyKey: unknown;
  now?: number;
  pixKey: unknown;
  pixKeyType: unknown;
  quoteId: unknown;
}) {
  if (!manualWithdrawalsEnabled(input.environment)) {
    throw new Error("A fila de saques ainda não está liberada.");
  }
  if (
    typeof input.expectedVersion !== "number" ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    typeof input.idempotencyKey !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(input.idempotencyKey) ||
    typeof input.quoteId !== "string" ||
    !/^brl-quote-[0-9a-f-]{36}$/i.test(input.quoteId)
  ) {
    throw new Error("Atualize a carteira e gere uma nova cotação.");
  }
  const pix = validPixKey(input.pixKeyType, input.pixKey);
  if (!pix) throw new Error("Confira o tipo e o valor da chave Pix.");
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  const id = `withdrawal-${input.idempotencyKey}`;
  const existing = await input.db
    .prepare(`SELECT id, asset, requested_atomic, destination_preview,
      payout_brl_cents, status FROM wallet_withdrawal_intents
      WHERE id = ? AND account_id = ?`)
    .bind(id, input.accountId)
    .first<WithdrawalIntentRow>();
  if (existing) {
    return {
      alreadyProcessed: true as const,
      asset: existing.asset,
      destinationPreview: existing.destination_preview ?? "",
      id: existing.id,
      netBrl: Number(existing.payout_brl_cents ?? 0) / 100,
      sourceAtomic: existing.requested_atomic,
      status: existing.status,
    };
  }
  const quote = await input.db
    .prepare(`SELECT id, account_id, source_asset, source_atomic,
      brl_price_micros, gross_brl_cents, fee_bps, net_brl_cents,
      status, expires_at, created_at
      FROM wallet_brl_withdrawal_quotes WHERE id = ? AND account_id = ?`)
    .bind(input.quoteId, input.accountId)
    .first<BrlWithdrawalQuoteRow>();
  if (
    !quote ||
    !validSandboxAsset(quote.source_asset) ||
    quote.status !== "preview" ||
    quote.expires_at <= now
  ) {
    throw new Error("A cotação expirou. Gere uma nova antes de confirmar.");
  }
  const limits = await input.db
    .prepare(`SELECT
      SUM(CASE WHEN status IN ('requested', 'reviewing') THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS daily_count
      FROM wallet_withdrawal_intents
      WHERE account_id = ? AND provider IN ('manual', 'manual_pix')`)
    .bind(now - 24 * 60 * 60 * 1000, input.accountId)
    .first<{ daily_count: number | null; open_count: number | null }>();
  if (Number(limits?.open_count ?? 0) >= 3) {
    throw new Error("Conclua seus pedidos em análise antes de abrir outro saque.");
  }
  if (Number(limits?.daily_count ?? 0) >= 5) {
    throw new Error("Limite de cinco solicitações em 24 horas alcançado.");
  }
  const row = await input.db
    .prepare(`SELECT state_json, version FROM game_states WHERE account_id = ?`)
    .bind(input.accountId)
    .first<{ state_json: string; version: number }>();
  if (!row || row.version !== input.expectedVersion) {
    throw new Error("Seu saldo mudou. Atualize a carteira e gere outra cotação.");
  }
  const state = normalizeBootstrapState(JSON.parse(row.state_json), now);
  const sourceAsset = quote.source_asset;
  const available = withdrawalBalance(state, sourceAsset);
  if (available < quote.source_atomic) {
    throw new Error(`Saldo ${sourceAsset} insuficiente para este saque em real.`);
  }
  setWithdrawalBalance(state, sourceAsset, available - quote.source_atomic);
  const nextVersion = row.version + 1;
  const nextStateJson = JSON.stringify(state);
  const preview = pixKeyPreview(pix.key);
  const ledgerId = crypto.randomUUID();
  const results = await input.db.batch([
    input.db
      .prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
        WHERE account_id = ? AND version = ?`)
      .bind(nextStateJson, nextVersion, now, input.accountId, row.version),
    input.db
      .prepare(`UPDATE wallet_brl_withdrawal_quotes
        SET status = 'consumed', consumed_at = ?
        WHERE id = ? AND account_id = ? AND status = 'preview' AND expires_at > ?`)
      .bind(now, quote.id, input.accountId, now),
    input.db
      .prepare(`INSERT INTO wallet_withdrawal_intents (
        id, account_id, asset, provider, requested_atomic, destination_address,
        destination_preview, payout_brl_cents, status, created_at, updated_at
      ) SELECT ?, ?, ?, 'manual_pix', ?, ?, ?, ?, 'requested', ?, ?
        WHERE EXISTS (SELECT 1 FROM game_states
          WHERE account_id = ? AND version = ? AND state_json = ?)
          AND EXISTS (SELECT 1 FROM wallet_brl_withdrawal_quotes
            WHERE id = ? AND account_id = ? AND status = 'consumed')`)
      .bind(
        id,
        input.accountId,
        sourceAsset,
        quote.source_atomic,
        pix.key,
        preview,
        quote.net_brl_cents,
        now,
        now,
        input.accountId,
        nextVersion,
        nextStateJson,
        quote.id,
        input.accountId,
      ),
    input.db
      .prepare(`INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) SELECT ?, ?, 'reserve_brl_withdrawal', ?, ?, 0, ?, ?
        WHERE EXISTS (SELECT 1 FROM wallet_withdrawal_intents
          WHERE id = ? AND account_id = ? AND status = 'requested')`)
      .bind(
        ledgerId,
        input.accountId,
        `withdrawal-reserve:${input.idempotencyKey}`,
        nextVersion,
        JSON.stringify({
          feeBps: quote.fee_bps,
          grossBrlCents: quote.gross_brl_cents,
          netBrlCents: quote.net_brl_cents,
          pixKeyType: pix.type,
          quoteId: quote.id,
          sourceAsset,
          sourceAtomic: quote.source_atomic,
          withdrawalId: id,
        }),
        now,
        id,
        input.accountId,
      ),
  ]);
  if (
    Number(results[0]?.meta.changes ?? 0) !== 1 ||
    Number(results[1]?.meta.changes ?? 0) !== 1 ||
    Number(results[2]?.meta.changes ?? 0) !== 1 ||
    Number(results[3]?.meta.changes ?? 0) !== 1
  ) {
    await input.db.batch([
      input.db
        .prepare(`DELETE FROM ledger_entries
          WHERE account_id = ? AND idempotency_key = ?`)
        .bind(input.accountId, `withdrawal-reserve:${input.idempotencyKey}`),
      input.db
        .prepare(`DELETE FROM wallet_withdrawal_intents
          WHERE id = ? AND account_id = ? AND status = 'requested'`)
        .bind(id, input.accountId),
      input.db
        .prepare(`UPDATE wallet_brl_withdrawal_quotes
          SET status = 'preview', consumed_at = NULL
          WHERE id = ? AND account_id = ? AND status = 'consumed'`)
        .bind(quote.id, input.accountId),
      input.db
        .prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
          WHERE account_id = ? AND version = ? AND state_json = ?`)
        .bind(
          row.state_json,
          row.version,
          now,
          input.accountId,
          nextVersion,
          nextStateJson,
        ),
    ]);
    throw new Error("A conta mudou durante a reserva. Atualize e tente novamente.");
  }
  return {
    alreadyProcessed: false as const,
    asset: sourceAsset,
    destinationPreview: preview,
    id,
    netBrl: quote.net_brl_cents / 100,
    sourceAtomic: quote.source_atomic,
    status: "requested" as const,
  };
}

export async function createManualWithdrawalRequest(input: {
  accountId: string;
  amount: unknown;
  asset: unknown;
  db: D1Database;
  destinationAddress: unknown;
  environment: unknown;
  expectedVersion: unknown;
  idempotencyKey: unknown;
  now?: number;
}) {
  if (!manualWithdrawalsEnabled(input.environment)) {
    throw new Error("A fila de saques ainda não está liberada.");
  }
  if (!validSandboxAsset(input.asset) || typeof input.amount !== "string") {
    throw new Error("Escolha BTC, DOGE ou LTC e informe uma quantidade válida.");
  }
  if (
    typeof input.expectedVersion !== "number" ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    typeof input.idempotencyKey !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)
  ) {
    throw new Error("Atualize a carteira e tente solicitar novamente.");
  }
  const destinationAddress = validWithdrawalAddress(
    input.asset,
    input.destinationAddress,
  );
  if (!destinationAddress) {
    throw new Error(`O endereço de ${input.asset} não passou na validação básica.`);
  }
  const requestedAtomic = amountToAtomic(input.amount, input.asset);
  const withdrawalRates = await readBrlRates(
    input.db,
    input.environment,
    input.now ?? Date.now(),
  );
  const currentRate = withdrawalRates.find((item) => item.asset === input.asset)!;
  const dynamicMinimumAtomic = minimumAtomicForBrl(
    input.asset,
    currentRate.brlPrice,
  );
  if (
    !requestedAtomic ||
    requestedAtomic < dynamicMinimumAtomic ||
    requestedAtomic > MANUAL_WITHDRAWAL_MAXIMUM_ATOMIC[input.asset]
  ) {
    const minimum = dynamicMinimumAtomic / 100_000_000;
    throw new Error(
      `O saque mínimo de ${input.asset} equivale a R$ 50,00 agora: ${minimum.toLocaleString("pt-BR", {
        maximumFractionDigits: 8,
      })} ${input.asset}.`,
    );
  }
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  const id = `withdrawal-${input.idempotencyKey}`;
  const existing = await input.db
    .prepare(`SELECT id, asset, requested_atomic, destination_preview, status,
      review_note, transaction_hash, resolved_at, created_at, updated_at
      FROM wallet_withdrawal_intents WHERE id = ? AND account_id = ?`)
    .bind(id, input.accountId)
    .first<WithdrawalIntentRow>();
  if (existing) {
    return {
      alreadyProcessed: true as const,
      amountAtomic: existing.requested_atomic,
      asset: existing.asset,
      destinationPreview: existing.destination_preview ?? "",
      id: existing.id,
      status: existing.status,
    };
  }
  const limits = await input.db
    .prepare(`SELECT
      SUM(CASE WHEN status IN ('requested', 'reviewing') THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS daily_count
      FROM wallet_withdrawal_intents
      WHERE account_id = ? AND provider IN ('manual', 'manual_pix')`)
    .bind(now - 24 * 60 * 60 * 1000, input.accountId)
    .first<{ daily_count: number | null; open_count: number | null }>();
  if (Number(limits?.open_count ?? 0) >= 3) {
    throw new Error("Conclua seus pedidos em análise antes de abrir outro saque.");
  }
  if (Number(limits?.daily_count ?? 0) >= 5) {
    throw new Error("Limite de cinco solicitações em 24 horas alcançado.");
  }
  const row = await input.db
    .prepare(`SELECT state_json, version FROM game_states WHERE account_id = ?`)
    .bind(input.accountId)
    .first<{ state_json: string; version: number }>();
  if (!row) throw new Error("Abra a conta de jogo antes de solicitar um saque.");
  if (row.version !== input.expectedVersion) {
    throw new Error("Seu saldo mudou. Atualize a carteira e tente novamente.");
  }
  const state = normalizeBootstrapState(JSON.parse(row.state_json), now);
  const available = withdrawalBalance(state, input.asset);
  if (available < requestedAtomic) {
    throw new Error(`Saldo ${input.asset} insuficiente para este saque.`);
  }
  setWithdrawalBalance(state, input.asset, available - requestedAtomic);
  const nextVersion = row.version + 1;
  const nextStateJson = JSON.stringify(state);
  const preview = withdrawalDestinationPreview(destinationAddress);
  const ledgerId = crypto.randomUUID();
  const metadataJson = JSON.stringify({
    asset: input.asset,
    destinationPreview: preview,
    requestedAtomic,
    reservation: true,
    withdrawalId: id,
  });
  const results = await input.db.batch([
    input.db
      .prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
        WHERE account_id = ? AND version = ?`)
      .bind(nextStateJson, nextVersion, now, input.accountId, row.version),
    input.db
      .prepare(`INSERT INTO wallet_withdrawal_intents (
        id, account_id, asset, provider, requested_atomic, destination_address,
        destination_preview, status, created_at, updated_at
      ) SELECT ?, ?, ?, 'manual', ?, ?, ?, 'requested', ?, ?
        WHERE EXISTS (SELECT 1 FROM game_states
          WHERE account_id = ? AND version = ? AND state_json = ?)`)
      .bind(
        id,
        input.accountId,
        input.asset,
        requestedAtomic,
        destinationAddress,
        preview,
        now,
        now,
        input.accountId,
        nextVersion,
        nextStateJson,
      ),
    input.db
      .prepare(`INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) SELECT ?, ?, 'reserve_crypto_withdrawal', ?, ?, 0, ?, ?
        WHERE EXISTS (SELECT 1 FROM wallet_withdrawal_intents
          WHERE id = ? AND account_id = ? AND status = 'requested')`)
      .bind(
        ledgerId,
        input.accountId,
        `withdrawal-reserve:${input.idempotencyKey}`,
        nextVersion,
        metadataJson,
        now,
        id,
        input.accountId,
      ),
  ]);
  const stateChanged = Number(results[0]?.meta.changes ?? 0) === 1;
  const requestChanged = Number(results[1]?.meta.changes ?? 0) === 1;
  const ledgerChanged = Number(results[2]?.meta.changes ?? 0) === 1;
  if (!stateChanged || !requestChanged || !ledgerChanged) {
    if (stateChanged) {
      await input.db.batch([
        input.db
          .prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
            WHERE account_id = ? AND version = ? AND state_json = ?`)
          .bind(row.state_json, row.version, now, input.accountId, nextVersion, nextStateJson),
        input.db
          .prepare(`DELETE FROM wallet_withdrawal_intents
            WHERE id = ? AND account_id = ? AND status = 'requested'
              AND NOT EXISTS (SELECT 1 FROM ledger_entries
                WHERE account_id = ? AND idempotency_key = ?)`)
          .bind(
            id,
            input.accountId,
            input.accountId,
            `withdrawal-reserve:${input.idempotencyKey}`,
          ),
      ]);
    }
    throw new Error("Seu saldo mudou durante a solicitação. Atualize e tente novamente.");
  }
  return {
    alreadyProcessed: false as const,
    amountAtomic: requestedAtomic,
    asset: input.asset,
    destinationPreview: preview,
    id,
    status: "requested" as const,
  };
}

export async function readAdminWithdrawalOverview(input: {
  db: D1Database;
  environment: unknown;
}) : Promise<AdminWithdrawalOverview> {
  await ensureWalletSchema(input.db);
  await pruneWalletOperationalHistory(input.db);
  const result = await input.db
    .prepare(`SELECT withdrawals.id, withdrawals.account_id, withdrawals.asset,
      withdrawals.provider, withdrawals.payout_brl_cents,
      withdrawals.requested_atomic, withdrawals.destination_address,
      withdrawals.status, withdrawals.review_note, withdrawals.transaction_hash,
      withdrawals.resolved_at, withdrawals.created_at, withdrawals.updated_at,
      states.display_name, states.email
      FROM wallet_withdrawal_intents withdrawals
      LEFT JOIN game_states states ON states.account_id = withdrawals.account_id
      WHERE withdrawals.provider IN ('manual', 'manual_pix')
      ORDER BY CASE withdrawals.status
        WHEN 'requested' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
        withdrawals.created_at DESC
      LIMIT 100`)
    .all<WithdrawalIntentRow>();
  const requests = (result.results ?? []).map((row) => ({
    accountId: row.account_id ?? "",
    amountAtomic: row.requested_atomic,
    asset: row.asset as WalletSandboxAsset,
    createdAt: row.created_at,
    destinationAddress: row.destination_address ?? "",
    displayName: row.display_name || "Operador",
    email: row.email || "",
    id: row.id,
    payoutAsset: row.provider === "manual_pix" ? ("BRL" as const) : ("CRYPTO" as const),
    payoutBrlCents: Number(row.payout_brl_cents ?? 0),
    provider: row.provider === "manual_pix" ? ("manual_pix" as const) : ("manual" as const),
    resolvedAt: row.resolved_at ?? null,
    reviewNote: row.review_note ?? null,
    status: row.status,
    transactionReference: row.transaction_hash ?? null,
    updatedAt: row.updated_at ?? row.created_at,
  }));
  return {
    counts: {
      paid: requests.filter((item) => item.status === "paid").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
      requested: requests.filter((item) => item.status === "requested").length,
      reviewing: requests.filter((item) => item.status === "reviewing").length,
    },
    enabled: manualWithdrawalsEnabled(input.environment),
    requests,
  };
}

/** Lightweight operational view used by the founder cockpit alert feed. */
export async function readAdminCryptoDeposits(db: D1Database) {
  const now = Date.now();
  await ensureWalletSchema(db);
  await pruneWalletOperationalHistory(db, now);
  const result = await db
    .prepare(`SELECT deposits.id, deposits.asset, deposits.provider,
      deposits.provider_reference, deposits.status, deposits.requested_usd_micros,
      deposits.received_atomic, deposits.settlement_asset, deposits.settlement_atomic,
      deposits.created_at, deposits.updated_at, states.display_name
      FROM wallet_deposit_intents deposits
      LEFT JOIN game_states states ON states.account_id = deposits.account_id
      WHERE deposits.provider = 'nowpayments'
      ORDER BY deposits.created_at DESC
      LIMIT 100`)
    .all<{
      asset: string;
      created_at: number;
      display_name: string | null;
      id: string;
      provider_reference: string | null;
      received_atomic: number;
      requested_usd_micros: number;
      settlement_asset: string | null;
      settlement_atomic: number;
      status: string;
      updated_at: number;
    }>();
  return (result.results ?? []).map((row) => ({
    asset: row.asset,
    amount: row.requested_usd_micros > 0
      ? `$${(row.requested_usd_micros / 1_000_000).toFixed(2)}`
      : "",
    createdAt: Number(row.created_at),
    displayName: row.display_name ?? "Operador",
    id: row.id,
    reference: row.provider_reference ?? undefined,
    received: formatAtomicValue(row.received_atomic, row.asset),
    status: row.status,
    settlement: formatAtomicValue(row.settlement_atomic, row.settlement_asset),
    settlementAsset: row.settlement_asset ?? undefined,
    updatedAt: Number(row.updated_at || row.created_at),
  }));
}

function formatAtomicValue(value: number, asset: string | null) {
  if (!asset || !Number.isSafeInteger(value) || value <= 0) return "";
  try {
    return formatAtomic(BigInt(value), settlementAssetDecimals(asset));
  } catch {
    return "";
  }
}

export async function reviewManualWithdrawal(input: {
  action: "review" | "pay" | "reject";
  actorAccountId: string;
  db: D1Database;
  environment: unknown;
  note: unknown;
  now?: number;
  requestId: unknown;
  transactionReference: unknown;
}) {
  if (!manualWithdrawalsEnabled(input.environment)) {
    throw new Error("A fila manual está desativada.");
  }
  if (
    typeof input.requestId !== "string" ||
    !/^withdrawal-[0-9a-f-]{36}$/i.test(input.requestId)
  ) {
    throw new Error("Solicitação de saque inválida.");
  }
  const now = input.now ?? Date.now();
  await ensureWalletSchema(input.db);
  const intent = await input.db
    .prepare(`SELECT id, account_id, asset, provider, requested_atomic, destination_address,
      payout_brl_cents,
      destination_preview, status, review_note, transaction_hash, resolved_at,
      created_at, updated_at FROM wallet_withdrawal_intents
      WHERE id = ? AND provider IN ('manual', 'manual_pix')`)
    .bind(input.requestId)
    .first<WithdrawalIntentRow>();
  if (!intent || !validSandboxAsset(intent.asset)) {
    throw new Error("Solicitação de saque não encontrada.");
  }
  if (input.action === "review") {
    if (intent.status === "reviewing") return { status: "reviewing" as const };
    if (intent.status !== "requested") {
      throw new Error("Este saque não pode mais entrar em análise.");
    }
    await input.db
      .prepare(`UPDATE wallet_withdrawal_intents
        SET status = 'reviewing', updated_at = ?
        WHERE id = ? AND status = 'requested'`)
      .bind(now, intent.id)
      .run();
    return { status: "reviewing" as const };
  }
  if (input.action === "pay") {
    const reference =
      typeof input.transactionReference === "string"
        ? input.transactionReference.trim()
        : "";
    if (!/^[A-Za-z0-9:_-]{6,128}$/.test(reference)) {
      throw new Error("Informe o hash ou identificador real do pagamento.");
    }
    if (intent.status === "paid") return { status: "paid" as const };
    if (!['requested', 'reviewing'].includes(intent.status)) {
      throw new Error("Este saque não pode ser marcado como pago.");
    }
    const changed = await input.db
      .prepare(`UPDATE wallet_withdrawal_intents SET status = 'paid',
        transaction_hash = ?, resolved_at = ?, resolved_by = ?, updated_at = ?
        WHERE id = ? AND status IN ('requested', 'reviewing')`)
      .bind(reference, now, input.actorAccountId, now, intent.id)
      .run();
    if (Number(changed.meta.changes ?? 0) !== 1) {
      throw new Error("O saque mudou em outra sessão. Atualize a fila.");
    }
    return { status: "paid" as const };
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length < 8 || note.length > 500) {
    throw new Error("Explique o motivo da recusa em 8 a 500 caracteres.");
  }
  if (intent.status === "rejected") return { status: "rejected" as const };
  if (!['requested', 'reviewing'].includes(intent.status)) {
    throw new Error("Este saque não pode ser recusado.");
  }
  const stateRow = await input.db
    .prepare(`SELECT state_json, version FROM game_states WHERE account_id = ?`)
    .bind(intent.account_id)
    .first<{ state_json: string; version: number }>();
  if (!stateRow) throw new Error("A conta do jogador não foi encontrada.");
  const state = normalizeBootstrapState(JSON.parse(stateRow.state_json), now);
  const refunded = withdrawalBalance(state, intent.asset) + intent.requested_atomic;
  if (!Number.isSafeInteger(refunded)) {
    throw new Error("O estorno excede o limite seguro da carteira.");
  }
  setWithdrawalBalance(state, intent.asset, refunded);
  const nextVersion = stateRow.version + 1;
  const nextStateJson = JSON.stringify(state);
  const ledgerId = crypto.randomUUID();
  const results = await input.db.batch([
    input.db
      .prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
        WHERE account_id = ? AND version = ?`)
      .bind(nextStateJson, nextVersion, now, intent.account_id, stateRow.version),
    input.db
      .prepare(`UPDATE wallet_withdrawal_intents SET status = 'rejected',
        review_note = ?, resolved_at = ?, resolved_by = ?, updated_at = ?
        WHERE id = ? AND status IN ('requested', 'reviewing')
          AND EXISTS (SELECT 1 FROM game_states
            WHERE account_id = ? AND version = ? AND state_json = ?)`)
      .bind(
        note,
        now,
        input.actorAccountId,
        now,
        intent.id,
        intent.account_id,
        nextVersion,
        nextStateJson,
      ),
    input.db
      .prepare(`INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) SELECT ?, ?, 'refund_crypto_withdrawal', ?, ?, 0, ?, ?
        WHERE EXISTS (SELECT 1 FROM wallet_withdrawal_intents
          WHERE id = ? AND status = 'rejected')`)
      .bind(
        ledgerId,
        intent.account_id,
        `withdrawal-refund:${intent.id}`,
        nextVersion,
        JSON.stringify({
          asset: intent.asset,
          refundedAtomic: intent.requested_atomic,
          withdrawalId: intent.id,
        }),
        now,
        intent.id,
      ),
  ]);
  const stateChanged = Number(results[0]?.meta.changes ?? 0) === 1;
  const intentChanged = Number(results[1]?.meta.changes ?? 0) === 1;
  const ledgerChanged = Number(results[2]?.meta.changes ?? 0) === 1;
  if (!stateChanged || !intentChanged || !ledgerChanged) {
    if (stateChanged) {
      await input.db.batch([
        input.db
          .prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
            WHERE account_id = ? AND version = ? AND state_json = ?`)
          .bind(
            stateRow.state_json,
            stateRow.version,
            now,
            intent.account_id,
            nextVersion,
            nextStateJson,
          ),
        input.db
          .prepare(`UPDATE wallet_withdrawal_intents SET status = ?,
            review_note = ?, resolved_at = NULL, resolved_by = NULL, updated_at = ?
            WHERE id = ? AND status = 'rejected'
              AND NOT EXISTS (SELECT 1 FROM ledger_entries
                WHERE account_id = ? AND idempotency_key = ?)`)
          .bind(
            intent.status,
            intent.review_note ?? null,
            now,
            intent.id,
            intent.account_id,
            `withdrawal-refund:${intent.id}`,
          ),
      ]);
    }
    throw new Error("A conta mudou durante o estorno. Atualize a fila e tente novamente.");
  }
  return { status: "rejected" as const };
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
  if (!row) return { btcAtomic: 0, cma: 0, dogeAtomic: 0, ltcAtomic: 0 };
  try {
    const state = JSON.parse(row.state_json) as Partial<PublicGameState>;
    return {
      btcAtomic: Math.max(0, Math.floor(Number(state.btcBalanceAtomic) || 0)),
      cma: Math.max(0, Number(state.cmaBalance) || 0),
      dogeAtomic: Math.max(0, Math.floor(Number(state.dogeBalanceAtomic) || 0)),
      ltcAtomic: Math.max(0, Math.floor(Number(state.ltcBalanceAtomic) || 0)),
    };
  } catch {
    return { btcAtomic: 0, cma: 0, dogeAtomic: 0, ltcAtomic: 0 };
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
  await pruneWalletOperationalHistory(input.db, now);
  await reconcileCCPaymentDeposits({
    accountId: input.accountId,
    db: input.db,
    environment: input.environment,
    now,
  }).catch(() => undefined);
  await input.db
    .prepare(`UPDATE wallet_deposit_intents
      SET status = 'expired', updated_at = ?
      WHERE account_id = ? AND provider = 'nowpayments'
        AND expires_at IS NOT NULL AND expires_at <= ?
        AND status IN ('creating', 'waiting', 'confirming', 'confirmed', 'sending')`)
    .bind(now, input.accountId, now)
    .run();
  const readiness = walletProviderReadiness(input.environment);
  const accessAllowed = await accountMayCreateLiveDeposit(
    input.db,
    input.accountId,
    input.environment,
  );
  const brlRates = await readBrlRates(input.db, input.environment, now).catch(
    () => null,
  );
  const minimumAtomic = brlRates
    ? Object.fromEntries(
        brlRates.map((rate) => [
          rate.asset,
          minimumAtomicForBrl(rate.asset, rate.brlPrice),
        ]),
      ) as Record<WalletSandboxAsset, number>
    : MANUAL_WITHDRAWAL_MINIMUM_ATOMIC;
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
      .prepare(`SELECT id, asset, provider, provider_reference, checkout_url,
        requested_usd_micros, received_atomic, credited_cma_micros, settlement_asset,
        settlement_atomic, status, transaction_hash, expires_at, created_at
        FROM wallet_deposit_intents
        WHERE account_id = ? AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 8`)
      .bind(
        input.accountId,
        now - PLAYER_INVOICE_HISTORY_DAYS * 24 * 60 * 60 * 1000,
      )
      .all<DepositIntentRow>(),
    input.db
      .prepare(`SELECT id, asset, provider, requested_atomic, destination_preview,
        payout_brl_cents,
        status, review_note, transaction_hash, resolved_at, created_at, updated_at
        FROM wallet_withdrawal_intents
        WHERE account_id = ?
        ORDER BY created_at DESC
        LIMIT 20`)
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
      assets: ["BTC", "DOGE", "LTC"],
      activationRequested: readiness.activationRequested,
      accessAllowed,
      enabled: readiness.depositsEnabled && accessAllowed,
      liveActivationRequested: readiness.liveActivationRequested,
      mode: readiness.mode,
      provider: readiness.provider,
      providerReady: readiness.providerReady,
      providerSandbox: readiness.providerSandbox,
      ccpayment: readiness.ccpayment,
      ownerOnly: liveDepositsOwnerOnly(input.environment),
      missingSetup: readiness.missingSetup,
      sandboxEnabled: readiness.sandboxEnabled,
      recent: (intents.results ?? []).map((intent) => ({
        asset: intent.asset,
        blockchainUrl: blockchainExplorerUrl(intent.asset, intent.transaction_hash),
        checkoutUrl:
          intent.checkout_url &&
          intent.status !== "expired" &&
          (!intent.expires_at || intent.expires_at > now)
            ? intent.checkout_url
            : null,
        createdAt: intent.created_at,
        expiresAt: intent.expires_at,
        id: intent.id,
        invoiceReference: intent.provider_reference ?? null,
        provider: intent.provider,
        requestedUsd: intent.requested_usd_micros / 1_000_000,
        receivedAtomic: intent.received_atomic,
        settlementAsset: intent.settlement_asset,
        status: intent.status,
        transactionHash: intent.transaction_hash ?? null,
      })),
    },
    withdrawals: {
      assets: ["BTC", "DOGE", "LTC"],
      brlFeeBps: PIX_WITHDRAWAL_FEE_BPS,
      brlMinimumCents: PIX_WITHDRAWAL_MINIMUM_BRL_CENTS,
      cryptoMinimumBrlCents: CRYPTO_WITHDRAWAL_MINIMUM_BRL_CENTS,
      enabled: manualWithdrawalsEnabled(input.environment),
      minimumAtomic,
      ratesAvailable: Boolean(brlRates),
      ratesObservedAt: brlRates
        ? Math.min(...brlRates.map((rate) => rate.observedAt))
        : null,
      recent: (withdrawals.results ?? [])
        .filter((intent) => intent.provider === "manual" || intent.provider === "manual_pix")
        .slice(0, 10)
        .map((intent) => ({
          amountAtomic: intent.requested_atomic,
          asset: intent.asset,
          createdAt: intent.created_at,
          destinationPreview: intent.destination_preview ?? "",
          id: intent.id,
          payoutAsset: intent.provider === "manual_pix" ? ("BRL" as const) : ("CRYPTO" as const),
          payoutBrlCents: Number(intent.payout_brl_cents ?? 0),
          resolvedAt: intent.resolved_at ?? null,
          reviewNote: intent.review_note ?? null,
          status: intent.status,
          transactionReference: intent.transaction_hash ?? null,
          updatedAt: intent.updated_at ?? intent.created_at,
        })),
      recentSandbox: (withdrawals.results ?? [])
        .filter((intent) => intent.provider === "sandbox")
        .map((intent) => ({
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
