import {
  normalizeBootstrapState,
  type PublicGameState,
} from "./game-server.ts";
import { amountToAtomic } from "./conversion-rules.ts";
import {
  isNowPaymentsAsset,
  normalizeNowPaymentsStatus,
  readNowPaymentsConfig,
  validNowPaymentsCheckoutUrl,
  verifyNowPaymentsPayload,
} from "./nowpayments-rules.ts";

type WalletEnvironment = {
  CRYPTO_DEPOSITS_ENABLED?: string;
  CRYPTO_SANDBOX_ENABLED?: string;
  NOWPAYMENTS_API_BASE_URL?: string;
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
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
    provider: "nowpayments";
    providerReady: boolean;
    sandboxEnabled: boolean;
    recent: Array<{
      asset: string;
      checkoutUrl: string | null;
      createdAt: number;
      expiresAt: number | null;
      id: string;
      provider: string;
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
  const config = readNowPaymentsConfig(source);
  return {
    depositsEnabled: config.depositsEnabled,
    provider: "nowpayments" as const,
    providerReady: config.providerReady,
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

type NowPaymentsIpnPayload = {
  actually_paid?: number | string;
  invoice_id?: number | string;
  order_id?: string;
  outcome_amount?: number | string;
  pay_amount?: number | string;
  pay_currency?: string;
  payment_id?: number | string;
  payment_status?: string;
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

async function boundedProviderJson(response: Response) {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 64_000) throw new Error("Resposta do provedor excedeu o limite seguro.");
  return (await response.json()) as Record<string, unknown>;
}

export async function createProviderDepositIntent(input: {
  accountId: string;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
  usdAmount: unknown;
}) {
  const config = readNowPaymentsConfig(input.environment);
  if (!config.depositsEnabled) {
    throw new Error("Depósitos reais ainda aguardam a conta comercial do provedor.");
  }
  if (!isNowPaymentsAsset(input.asset)) {
    throw new Error("Escolha BTC ou DOGE para o depósito.");
  }
  const usdAmount = Number(input.usdAmount);
  if (!Number.isFinite(usdAmount) || usdAmount < 5 || usdAmount > 1_000) {
    throw new Error("Use um valor entre US$ 5 e US$ 1.000.");
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
      input.asset,
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
        is_fixed_rate: true,
        order_description: "Crédito de saldo no Crypto Miner Arcadia",
        order_id: id,
        pay_currency: input.asset.toLowerCase(),
        price_amount: usdAmount.toFixed(2),
        price_currency: "usd",
        success_url: `${config.publicBaseUrl}/?view=wallet&deposit=received`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await boundedProviderJson(response);
    const providerReference = cleanProviderValue(result.id);
    const checkoutUrl = validNowPaymentsCheckoutUrl(result.invoice_url);
    if (!response.ok || !providerReference || !checkoutUrl) {
      throw new Error("O provedor não criou uma fatura válida.");
    }
    await input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET provider_reference = ?, checkout_url = ?, status = 'waiting',
            updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'creating'`)
      .bind(providerReference, checkoutUrl, now, id, input.accountId)
      .run();
    return {
      asset: input.asset,
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
  const status = normalizeNowPaymentsStatus(payload.payment_status);
  if (!/^deposit-[0-9a-f-]{36}$/i.test(intentId) || !paymentReference) {
    throw new Error("Evento sem referência de depósito.");
  }
  await ensureWalletSchema(input.db);
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
    payload.actually_paid ?? payload.pay_amount ?? payload.outcome_amount,
  );
  if (eventAsset !== intent.asset || !isNowPaymentsAsset(eventAsset)) {
    throw new Error("Moeda recebida não corresponde à fatura.");
  }
  const receivedAtomic = amountToAtomic(paidAmount, eventAsset);
  if (!receivedAtomic) throw new Error("Quantidade recebida inválida.");

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
  if (eventAsset === "BTC") state.btcBalanceAtomic += receivedAtomic;
  else state.dogeBalanceAtomic += receivedAtomic;
  if (
    !Number.isSafeInteger(state.btcBalanceAtomic) ||
    !Number.isSafeInteger(state.dogeBalanceAtomic)
  ) {
    throw new Error("Saldo recebido excede o limite seguro.");
  }
  const nextVersion = stateRow.version + 1;
  const nextStateJson = JSON.stringify(state);
  const idempotencyKey = `deposit:${intent.id}`;
  const ledgerId = crypto.randomUUID();
  const metadataJson = JSON.stringify({
    asset: eventAsset,
    provider: "nowpayments",
    providerReference: paymentReference,
    receivedAtomic,
  });
  const results = await input.db.batch([
    input.db
      .prepare(`UPDATE wallet_deposit_intents
        SET status = 'crediting', received_atomic = ?, updated_at = ?
        WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
      .bind(receivedAtomic, now, intent.id),
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
        SET status = 'credited', received_atomic = ?, updated_at = ?
        WHERE id = ? AND status = 'crediting'
          AND EXISTS (SELECT 1 FROM ledger_entries
            WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(receivedAtomic, now, intent.id, intent.account_id, idempotencyKey),
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
    receivedAtomic,
    status: "credited" as const,
  };
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
      .prepare(`SELECT id, asset, provider, checkout_url,
        requested_usd_micros, status, expires_at, created_at
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
        checkoutUrl: intent.checkout_url,
        createdAt: intent.created_at,
        expiresAt: intent.expires_at,
        id: intent.id,
        provider: intent.provider,
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
