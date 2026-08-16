import { normalizeBootstrapState } from "./game-server.ts";
import { readBoundedJsonObject } from "./external-json.ts";
import {
  readMercadoPagoConfig,
  verifyMercadoPagoWebhook,
} from "./mercadopago-rules.ts";

const PTAX_CACHE_MS = 30 * 60 * 1000;
const PTAX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PIX_QUOTE_TTL_MS = 10 * 60 * 1000;
const PIX_CREDITING_STALE_MS = 90 * 1000;
const PIX_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type PtaxRow = {
  observed_at: number;
  usd_price_micros: number;
};

type PixIntentRow = {
  account_id: string;
  brl_cents: number;
  cma_units: number;
  credited_at: number | null;
  created_at: number;
  expires_at: number;
  id: string;
  margin_bps: number;
  provider_reference: string | null;
  qr_code: string | null;
  status: string;
  ticket_url: string | null;
  updated_at: number;
  usd_brl_micros: number;
};

type MercadoPagoOrder = Record<string, unknown>;

export async function ensurePixSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS market_price_snapshots (
      asset TEXT PRIMARY KEY NOT NULL,
      usd_price_micros INTEGER NOT NULL,
      provider TEXT NOT NULL,
      observed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wallet_pix_deposit_intents (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      provider_reference TEXT,
      cma_units INTEGER NOT NULL,
      brl_cents INTEGER NOT NULL,
      usd_brl_micros INTEGER NOT NULL,
      margin_bps INTEGER NOT NULL,
      status TEXT DEFAULT 'creating' NOT NULL,
      ticket_url TEXT,
      qr_code TEXT,
      credited_at INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_pix_deposit_account_created_idx
      ON wallet_pix_deposit_intents (account_id, created_at)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS wallet_pix_deposit_provider_reference_unique
      ON wallet_pix_deposit_intents (provider_reference)
      WHERE provider_reference IS NOT NULL`),
    db.prepare(`CREATE INDEX IF NOT EXISTS wallet_pix_deposit_status_expiry_idx
      ON wallet_pix_deposit_intents (status, expires_at)`),
  ]);
}

export async function prunePixHistory(db: D1Database, now = Date.now()) {
  await ensurePixSchema(db);
  return db
    .prepare(`DELETE FROM wallet_pix_deposit_intents
      WHERE created_at < ? AND (
        credited_at IS NOT NULL OR status = 'provider_failed' OR
        status LIKE 'canceled:%' OR status LIKE 'expired:%' OR
        status LIKE 'rejected:%'
      )`)
    .bind(now - PIX_HISTORY_RETENTION_MS)
    .run();
}

function cleanString(value: unknown, max = 512) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isPendingPixStatus(status: string) {
  return (
    !["credited", "provider_failed"].includes(status) &&
    !status.startsWith("canceled:") &&
    !status.startsWith("expired:") &&
    !status.startsWith("rejected:")
  );
}

function validTicketUrl(value: unknown) {
  const candidate = cleanString(value, 2_048);
  try {
    const url = new URL(candidate);
    const allowed =
      url.hostname === "mercadopago.com" ||
      url.hostname.endsWith(".mercadopago.com") ||
      url.hostname === "mercadopago.com.br" ||
      url.hostname.endsWith(".mercadopago.com.br");
    return url.protocol === "https:" && allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatBcbDate(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}-${date.getUTCFullYear()}`;
}

async function fetchPtax(now: number) {
  const start = new Date(now - 10 * 24 * 60 * 60 * 1000);
  const end = new Date(now);
  const endpoint = new URL(
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)",
  );
  endpoint.searchParams.set("@dataInicial", `'${formatBcbDate(start)}'`);
  endpoint.searchParams.set("@dataFinalCotacao", `'${formatBcbDate(end)}'`);
  endpoint.searchParams.set("$format", "json");
  endpoint.searchParams.set("$select", "cotacaoVenda,dataHoraCotacao");
  endpoint.searchParams.set("$top", "100");
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6_000),
  });
  const body = await readBoundedJsonObject(response);
  if (!response.ok || !Array.isArray(body.value)) {
    throw new Error("Cotação oficial USD/BRL indisponível.");
  }
  const quotes = body.value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rate = Number(Reflect.get(item, "cotacaoVenda"));
    const observedAt = Date.parse(String(Reflect.get(item, "dataHoraCotacao") ?? ""));
    return Number.isFinite(rate) && rate > 0 && Number.isFinite(observedAt)
      ? [{ observedAt, rate }]
      : [];
  });
  const latest = quotes.sort((left, right) => right.observedAt - left.observedAt)[0];
  if (!latest || now - latest.observedAt > PTAX_MAX_AGE_MS) {
    throw new Error("Cotação oficial USD/BRL desatualizada.");
  }
  return latest;
}

export async function readUsdBrlRate(db: D1Database, now = Date.now()) {
  const cached = await db
    .prepare(`SELECT usd_price_micros, observed_at FROM market_price_snapshots
      WHERE asset = 'USD_BRL'`)
    .first<PtaxRow>();
  if (cached && now - cached.observed_at <= PTAX_CACHE_MS) {
    return { observedAt: cached.observed_at, provider: "bcb_ptax" as const, rate: cached.usd_price_micros / 1_000_000 };
  }
  try {
    const latest = await fetchPtax(now);
    await db
      .prepare(`INSERT INTO market_price_snapshots (
        asset, usd_price_micros, provider, observed_at, updated_at
      ) VALUES ('USD_BRL', ?, 'bcb_ptax', ?, ?)
      ON CONFLICT(asset) DO UPDATE SET usd_price_micros = excluded.usd_price_micros,
        provider = excluded.provider, observed_at = excluded.observed_at,
        updated_at = excluded.updated_at`)
      .bind(Math.round(latest.rate * 1_000_000), latest.observedAt, now)
      .run();
    return { ...latest, provider: "bcb_ptax" as const };
  } catch (error) {
    if (cached && now - cached.observed_at <= PTAX_MAX_AGE_MS) {
      return { observedAt: cached.observed_at, provider: "bcb_ptax" as const, rate: cached.usd_price_micros / 1_000_000 };
    }
    throw error;
  }
}

function cmaUnits(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? ""));
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1_000 ? parsed : null;
}

export async function quotePixDeposit(input: {
  db: D1Database;
  environment: unknown;
  now?: number;
  targetCma: unknown;
}) {
  const targetCma = cmaUnits(input.targetCma);
  if (!targetCma) throw new Error("Escolha de 1 a 1.000 CMA, sempre em unidades inteiras.");
  const now = input.now ?? Date.now();
  await ensurePixSchema(input.db);
  const config = readMercadoPagoConfig(input.environment);
  const ptax = await readUsdBrlRate(input.db, now);
  const brlCents = Math.ceil(
    targetCma * ptax.rate * (1 + config.operationalMarginBps / 10_000) * 100,
  );
  return {
    brlAmount: brlCents / 100,
    brlCents,
    expiresAt: now + PIX_QUOTE_TTL_MS,
    marginBps: config.operationalMarginBps,
    observedAt: ptax.observedAt,
    provider: ptax.provider,
    targetCma,
    usdBrl: ptax.rate,
  };
}

function paymentFromOrder(order: MercadoPagoOrder) {
  const transactions = order.transactions;
  if (!transactions || typeof transactions !== "object") return null;
  const payments = Reflect.get(transactions, "payments");
  if (!Array.isArray(payments) || !payments[0] || typeof payments[0] !== "object") return null;
  return payments[0] as Record<string, unknown>;
}

function paymentMethod(payment: Record<string, unknown>) {
  const method = payment.payment_method;
  return method && typeof method === "object" ? (method as Record<string, unknown>) : null;
}

export async function readPixOverview(input: {
  accountId: string;
  db: D1Database;
  environment: unknown;
}) {
  await ensurePixSchema(input.db);
  const config = readMercadoPagoConfig(input.environment);
  const recent = await input.db
    .prepare(`SELECT id, account_id, provider_reference, cma_units, brl_cents,
      usd_brl_micros, margin_bps, status, ticket_url, qr_code, expires_at,
      credited_at, created_at, updated_at FROM wallet_pix_deposit_intents
      WHERE account_id = ? ORDER BY created_at DESC LIMIT 8`)
    .bind(input.accountId)
    .all<PixIntentRow>();
  return {
    enabled: config.enabled,
    missingSetup: [
      ...(!config.accessTokenConfigured ? (["access_token"] as const) : []),
      ...(!config.webhookSecretConfigured ? (["webhook_secret"] as const) : []),
      ...(!config.publicBaseUrlConfigured ? (["public_url"] as const) : []),
    ],
    mode: config.mode,
    operationalMarginBps: config.operationalMarginBps,
    provider: "mercadopago" as const,
    providerReady: config.providerReady,
    requested: config.requested,
    recent: (recent.results ?? []).map((row) => ({
      brlAmount: row.brl_cents / 100,
      cmaUnits: row.cma_units,
      creditedAt: row.credited_at,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      id: row.id,
      status: row.status,
      ticketUrl: row.ticket_url,
      updatedAt: row.updated_at,
    })),
  };
}

export async function createPixDeposit(input: {
  accountEmail: string;
  accountId: string;
  db: D1Database;
  environment: unknown;
  now?: number;
  targetCma: unknown;
}) {
  const config = readMercadoPagoConfig(input.environment);
  if (!config.enabled) throw new Error("Pix não está habilitado neste ambiente.");
  const now = input.now ?? Date.now();
  await ensurePixSchema(input.db);
  const recent = await input.db
    .prepare(`SELECT COUNT(*) AS total FROM wallet_pix_deposit_intents
      WHERE account_id = ? AND created_at >= ?`)
    .bind(input.accountId, now - 60 * 60 * 1000)
    .first<{ total: number }>();
  if (Number(recent?.total ?? 0) >= 5) {
    throw new Error("Limite de cinco cobranças Pix por hora alcançado.");
  }
  const quote = await quotePixDeposit({
    db: input.db,
    environment: input.environment,
    now,
    targetCma: input.targetCma,
  });
  const idempotencyKey = crypto.randomUUID();
  const id = `pix-${idempotencyKey}`;
  const expiresAt = now + 30 * 60 * 1000;
  await input.db
    .prepare(`INSERT INTO wallet_pix_deposit_intents (
      id, account_id, provider_reference, cma_units, brl_cents,
      usd_brl_micros, margin_bps, status, expires_at, created_at, updated_at
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, 'creating', ?, ?, ?)`)
    .bind(
      id,
      input.accountId,
      quote.targetCma,
      quote.brlCents,
      Math.round(quote.usdBrl * 1_000_000),
      quote.marginBps,
      expiresAt,
      now,
      now,
    )
    .run();
  try {
    const amount = quote.brlAmount.toFixed(2);
    const response = await fetch(`${config.apiBaseUrl}/v1/orders`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        external_reference: id,
        payer: {
          email: input.accountEmail,
          ...(config.mode === "test" ? { first_name: "APRO" } : {}),
        },
        processing_mode: "automatic",
        total_amount: amount,
        transactions: {
          payments: [
            {
              amount,
              expiration_time: "PT30M",
              payment_method: { id: "pix", type: "bank_transfer" },
            },
          ],
        },
        type: "online",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const order = await readBoundedJsonObject(response, 256_000);
    const payment = paymentFromOrder(order);
    const method = payment ? paymentMethod(payment) : null;
    const providerReference = cleanString(order.id, 128);
    const ticketUrl = method ? validTicketUrl(method.ticket_url) : null;
    const qrCode = method ? cleanString(method.qr_code, 4_096) : "";
    if (!response.ok || !providerReference || !ticketUrl || qrCode.length < 40) {
      const message = cleanString(order.message, 180);
      throw new Error(message ? `Mercado Pago recusou a order: ${message}` : "Mercado Pago não criou um Pix válido.");
    }
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET provider_reference = ?,
        status = 'waiting_transfer', ticket_url = ?, qr_code = ?, updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'creating'`)
      .bind(providerReference, ticketUrl, qrCode, now, id, input.accountId)
      .run();
    return {
      ...quote,
      expiresAt,
      id,
      providerReference,
      qrCode,
      status: "waiting_transfer" as const,
      ticketUrl,
    };
  } catch (error) {
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'provider_failed',
        updated_at = ? WHERE id = ? AND status = 'creating'`)
      .bind(Date.now(), id)
      .run();
    throw error;
  }
}

function orderAmountCents(order: MercadoPagoOrder, payment: Record<string, unknown>) {
  const candidate = Number(order.total_paid_amount ?? order.total_amount ?? payment.paid_amount ?? payment.amount);
  return Number.isFinite(candidate) ? Math.round(candidate * 100) : 0;
}

async function reconcileMercadoPagoOrder(input: {
  accountId?: string;
  dataId: string;
  db: D1Database;
  environment: unknown;
  now?: number;
}) {
  const config = readMercadoPagoConfig(input.environment);
  if (!config.providerReady) throw new Error("Mercado Pago não configurado.");
  await ensurePixSchema(input.db);
  const response = await fetch(`${config.apiBaseUrl}/v1/orders/${encodeURIComponent(input.dataId)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${config.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  const order = await readBoundedJsonObject(response, 128_000);
  if (!response.ok || cleanString(order.id, 128).toLowerCase() !== input.dataId.toLowerCase()) {
    throw new Error("Order Mercado Pago não pôde ser confirmada.");
  }
  const intentId = cleanString(order.external_reference, 128);
  const intent = await input.db
    .prepare(`SELECT id, account_id, provider_reference, cma_units, brl_cents,
      usd_brl_micros, margin_bps, status, ticket_url, qr_code, expires_at,
      credited_at, created_at, updated_at FROM wallet_pix_deposit_intents
      WHERE id = ? AND provider_reference = ?`)
    .bind(intentId, input.dataId)
    .first<PixIntentRow>();
  if (!intent || (input.accountId && intent.account_id !== input.accountId)) {
    return { accepted: true as const, status: "unknown_intent" as const };
  }
  if (intent.status === "credited") return { accepted: true as const, status: "credited" as const };
  const payment = paymentFromOrder(order);
  const method = payment ? paymentMethod(payment) : null;
  const status = cleanString(order.status, 64);
  const statusDetail = cleanString(order.status_detail, 64);
  const paid =
    payment &&
    method &&
    status === "processed" &&
    statusDetail === "accredited" &&
    cleanString(payment.status, 64) === "processed" &&
    cleanString(payment.status_detail, 64) === "accredited" &&
    cleanString(method.id, 32) === "pix" &&
    cleanString(method.type, 32) === "bank_transfer" &&
    orderAmountCents(order, payment) === intent.brl_cents;
  const now = input.now ?? Date.now();
  if (!paid) {
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET status = ?, updated_at = ?
        WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
      .bind(`${status || "unknown"}:${statusDetail || "unknown"}`.slice(0, 120), now, intent.id)
      .run();
    return { accepted: true as const, status: "pending" as const };
  }
  const idempotencyKey = `pix-credit:${intent.id}`;
  if (intent.status === "crediting") {
    const existingLedger = await input.db
      .prepare(`SELECT id FROM ledger_entries WHERE account_id = ? AND idempotency_key = ?`)
      .bind(intent.account_id, idempotencyKey)
      .first<{ id: string }>();
    if (existingLedger) {
      await input.db
        .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'credited',
          credited_at = COALESCE(credited_at, ?), updated_at = ?
          WHERE id = ? AND status = 'crediting'`)
        .bind(now, now, intent.id)
        .run();
      return { accepted: true as const, cmaUnits: intent.cma_units, status: "credited" as const };
    }
    throw new Error("Crédito Pix em processamento; tente o webhook novamente.");
  }
  const claimed = await input.db
    .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'crediting', updated_at = ?
      WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
    .bind(now, intent.id)
    .run();
  if (Number(claimed.meta.changes ?? 0) !== 1) {
    throw new Error("Crédito Pix concorreu com outro processamento; tente novamente.");
  }
  const stateRow = await input.db
    .prepare(`SELECT state_json, version FROM game_states WHERE account_id = ?`)
    .bind(intent.account_id)
    .first<{ state_json: string; version: number }>();
  if (!stateRow) throw new Error("Conta do pagamento não encontrada.");
  const state = normalizeBootstrapState(JSON.parse(stateRow.state_json), now);
  const nextCmaMicros = Math.round(state.cmaBalance * 1_000_000) + intent.cma_units * 1_000_000;
  if (!Number.isSafeInteger(nextCmaMicros)) throw new Error("Saldo CMA excede o limite seguro.");
  state.cmaBalance = nextCmaMicros / 1_000_000;
  state.displayedBalanceSymbol = "CMA";
  const nextVersion = stateRow.version + 1;
  const nextStateJson = JSON.stringify(state);
  const results = await input.db.batch([
    input.db.prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
      WHERE account_id = ? AND version = ? AND EXISTS (
        SELECT 1 FROM wallet_pix_deposit_intents WHERE id = ? AND status = 'crediting'
      )`).bind(nextStateJson, nextVersion, now, intent.account_id, stateRow.version, intent.id),
    input.db.prepare(`INSERT OR IGNORE INTO ledger_entries (
      id, account_id, action, idempotency_key, state_version,
      delta_cma_micros, metadata_json, created_at
    ) SELECT ?, ?, 'credit_pix_cma', ?, ?, ?, ?, ? WHERE EXISTS (
      SELECT 1 FROM game_states WHERE account_id = ? AND version = ? AND state_json = ?
    )`).bind(
      crypto.randomUUID(), intent.account_id, idempotencyKey, nextVersion,
      intent.cma_units * 1_000_000,
      JSON.stringify({ brlCents: intent.brl_cents, cmaUnits: intent.cma_units, provider: "mercadopago", providerReference: input.dataId }),
      now, intent.account_id, nextVersion, nextStateJson,
    ),
    input.db.prepare(`UPDATE wallet_pix_deposit_intents SET status = 'credited',
      credited_at = ?, updated_at = ? WHERE id = ? AND status = 'crediting'
      AND EXISTS (SELECT 1 FROM ledger_entries WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(now, now, intent.id, intent.account_id, idempotencyKey),
  ]);
  if (Number(results[2]?.meta.changes ?? 0) !== 1) {
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'waiting_transfer',
        updated_at = ? WHERE id = ? AND status = 'crediting'
        AND NOT EXISTS (SELECT 1 FROM ledger_entries WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(Date.now(), intent.id, intent.account_id, idempotencyKey)
      .run();
    throw new Error("Crédito Pix concorreu com outra atualização; reprocessamento necessário.");
  }
  return { accepted: true as const, cmaUnits: intent.cma_units, status: "credited" as const };
}

export async function processMercadoPagoWebhook(input: {
  dataId: string;
  db: D1Database;
  environment: unknown;
  now?: number;
  requestId: string;
  signatureHeader: string;
}) {
  const config = readMercadoPagoConfig(input.environment);
  if (!config.providerReady) throw new Error("Mercado Pago não configurado.");
  const verified = await verifyMercadoPagoWebhook({
    dataId: input.dataId,
    requestId: input.requestId,
    secret: config.webhookSecret,
    signatureHeader: input.signatureHeader,
  });
  if (!verified) throw new Error("Assinatura Mercado Pago inválida.");
  return reconcileMercadoPagoOrder(input);
}

export async function reconcilePendingPixDeposits(input: {
  accountId: string;
  db: D1Database;
  environment: unknown;
  now?: number;
}) {
  await ensurePixSchema(input.db);
  await prunePixHistory(input.db);
  const now = input.now ?? Date.now();
  // Libera uma reserva que ficou presa por uma interrupção do Worker antes do
  // batch final. O lançamento continua protegido pela chave idempotente.
  await input.db
    .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'waiting_transfer', updated_at = ?
      WHERE account_id = ? AND status = 'crediting' AND updated_at <= ?`)
    .bind(now, input.accountId, now - PIX_CREDITING_STALE_MS)
    .run();
  const pending = await input.db
    .prepare(`SELECT id, provider_reference FROM wallet_pix_deposit_intents
      WHERE account_id = ? AND provider_reference IS NOT NULL
      AND status NOT IN ('credited', 'provider_failed')
      AND status NOT LIKE 'canceled:%'
      ORDER BY created_at DESC LIMIT 8`)
    .bind(input.accountId)
    .all<{ id: string; provider_reference: string }>();
  let checked = 0;
  let credited = 0;
  let unavailable = 0;
  for (const row of pending.results ?? []) {
    try {
      const result = await reconcileMercadoPagoOrder({
        accountId: input.accountId,
        dataId: row.provider_reference,
        db: input.db,
        environment: input.environment,
        now,
      });
      checked += 1;
      if (result.status === "credited") credited += 1;
    } catch (error) {
      // Se o Worker falhar depois de reservar a cobrança, não deixe o Pix
      // travado em "crediting". A chave idempotente protege o próximo retry.
      await input.db
        .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'waiting_transfer', updated_at = ?
          WHERE account_id = ? AND provider_reference = ? AND status = 'crediting'
          AND NOT EXISTS (SELECT 1 FROM ledger_entries WHERE account_id = ?
            AND idempotency_key = ?)`)
        .bind(
          Date.now(),
          input.accountId,
          row.provider_reference,
          input.accountId,
          `pix-credit:${row.id}`,
        )
        .run()
        .catch((resetError) => console.error(
          "pix_reconciliation_reset_failed",
          resetError instanceof Error ? resetError.message : "unknown_error",
        ));
      unavailable += 1;
      console.error(
        "pix_reconciliation_failed",
        error instanceof Error ? error.message : "unknown_error",
      );
    }
  }
  return { checked, credited, unavailable };
}

export async function readAdminPixDeposits(db: D1Database) {
  await ensurePixSchema(db);
  await prunePixHistory(db);
  const rows = await db
    .prepare(`SELECT pix.id, pix.account_id, pix.provider_reference,
      pix.cma_units, pix.brl_cents, pix.status, pix.credited_at,
      pix.created_at, pix.updated_at, states.display_name, states.email
      FROM wallet_pix_deposit_intents pix
      LEFT JOIN game_states states ON states.account_id = pix.account_id
      ORDER BY pix.created_at DESC LIMIT 100`)
    .all<{
      account_id: string;
      brl_cents: number;
      cma_units: number;
      created_at: number;
      credited_at: number | null;
      display_name: string | null;
      email: string | null;
      id: string;
      provider_reference: string | null;
      status: string;
      updated_at: number;
    }>();
  const deposits = (rows.results ?? []).map((row) => ({
    accountId: row.account_id,
    brlAmount: row.brl_cents / 100,
    cmaUnits: row.cma_units,
    createdAt: row.created_at,
    creditedAt: row.credited_at,
    displayName: row.display_name ?? row.email ?? "Operador Arcadia",
    email: row.email ?? "",
    id: row.id,
    providerReference: row.provider_reference,
    status: row.status,
    updatedAt: row.updated_at,
  }));
  return {
    creditedCount: deposits.filter((deposit) => deposit.status === "credited").length,
    deposits,
    pendingCount: deposits.filter((deposit) => isPendingPixStatus(deposit.status)).length,
  };
}

export async function manuallyCreditPixDeposit(input: {
  db: D1Database;
  intentId: string;
  now?: number;
  ownerAccountId: string;
  reason: string;
}) {
  const reason = input.reason.trim().replace(/\s+/g, " ").slice(0, 300);
  if (reason.length < 10) throw new Error("Informe um motivo com pelo menos 10 caracteres.");
  await ensurePixSchema(input.db);
  const intent = await input.db
    .prepare(`SELECT id, account_id, provider_reference, cma_units, brl_cents,
      usd_brl_micros, margin_bps, status, ticket_url, qr_code, expires_at,
      credited_at, created_at, updated_at FROM wallet_pix_deposit_intents
      WHERE id = ?`)
    .bind(input.intentId)
    .first<PixIntentRow>();
  if (!intent) throw new Error("Cobrança Pix não encontrada.");
  if (!intent.provider_reference) {
    throw new Error("A cobrança não possui referência confirmada no Mercado Pago.");
  }
  if (intent.status === "credited") {
    return { alreadyCredited: true, cmaUnits: intent.cma_units, intentId: intent.id };
  }
  const now = input.now ?? Date.now();
  const manualKey = `pix-manual-credit:${intent.id}`;
  const providerKey = `pix-credit:${intent.id}`;
  const existing = await input.db
    .prepare(`SELECT id FROM ledger_entries WHERE account_id = ?
      AND idempotency_key IN (?, ?) LIMIT 1`)
    .bind(intent.account_id, manualKey, providerKey)
    .first<{ id: string }>();
  if (existing) {
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'credited',
        credited_at = COALESCE(credited_at, ?), updated_at = ? WHERE id = ?`)
      .bind(now, now, intent.id)
      .run();
    return { alreadyCredited: true, cmaUnits: intent.cma_units, intentId: intent.id };
  }
  const claimed = await input.db
    .prepare(`UPDATE wallet_pix_deposit_intents SET status = 'crediting', updated_at = ?
      WHERE id = ? AND status NOT IN ('credited', 'crediting')`)
    .bind(now, intent.id)
    .run();
  if (Number(claimed.meta.changes ?? 0) !== 1) {
    throw new Error("A cobrança está sendo processada; atualize o painel e tente novamente.");
  }
  const stateRow = await input.db
    .prepare(`SELECT state_json, version FROM game_states WHERE account_id = ?`)
    .bind(intent.account_id)
    .first<{ state_json: string; version: number }>();
  if (!stateRow) {
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET status = ?, updated_at = ?
        WHERE id = ? AND status = 'crediting'`)
      .bind(intent.status, now, intent.id)
      .run();
    throw new Error("Conta vinculada à cobrança não encontrada.");
  }
  const state = normalizeBootstrapState(JSON.parse(stateRow.state_json), now);
  const nextCmaMicros = Math.round(state.cmaBalance * 1_000_000) + intent.cma_units * 1_000_000;
  if (!Number.isSafeInteger(nextCmaMicros)) {
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET status = ?, updated_at = ?
        WHERE id = ? AND status = 'crediting'`)
      .bind(intent.status, now, intent.id)
      .run();
    throw new Error("Saldo CMA excede o limite seguro.");
  }
  state.cmaBalance = nextCmaMicros / 1_000_000;
  state.displayedBalanceSymbol = "CMA";
  const nextVersion = stateRow.version + 1;
  const nextStateJson = JSON.stringify(state);
  const results = await input.db.batch([
    input.db.prepare(`UPDATE game_states SET state_json = ?, version = ?, updated_at = ?
      WHERE account_id = ? AND version = ? AND EXISTS (
        SELECT 1 FROM wallet_pix_deposit_intents WHERE id = ? AND status = 'crediting'
      )`).bind(nextStateJson, nextVersion, now, intent.account_id, stateRow.version, intent.id),
    input.db.prepare(`INSERT OR IGNORE INTO ledger_entries (
      id, account_id, action, idempotency_key, state_version,
      delta_cma_micros, metadata_json, created_at
    ) SELECT ?, ?, 'manual_credit_pix_cma', ?, ?, ?, ?, ? WHERE EXISTS (
      SELECT 1 FROM game_states WHERE account_id = ? AND version = ? AND state_json = ?
    )`).bind(
      crypto.randomUUID(), intent.account_id, manualKey, nextVersion,
      intent.cma_units * 1_000_000,
      JSON.stringify({
        brlCents: intent.brl_cents,
        cmaUnits: intent.cma_units,
        manual: true,
        ownerAccountId: input.ownerAccountId,
        provider: "mercadopago",
        providerReference: intent.provider_reference,
        reason,
      }),
      now, intent.account_id, nextVersion, nextStateJson,
    ),
    input.db.prepare(`UPDATE wallet_pix_deposit_intents SET status = 'credited',
      credited_at = ?, updated_at = ? WHERE id = ? AND status = 'crediting'
      AND EXISTS (SELECT 1 FROM ledger_entries WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(now, now, intent.id, intent.account_id, manualKey),
  ]);
  if (Number(results[2]?.meta.changes ?? 0) !== 1) {
    await input.db
      .prepare(`UPDATE wallet_pix_deposit_intents SET status = ?, updated_at = ?
        WHERE id = ? AND status = 'crediting'
        AND NOT EXISTS (SELECT 1 FROM ledger_entries WHERE account_id = ? AND idempotency_key = ?)`)
      .bind(intent.status, Date.now(), intent.id, intent.account_id, manualKey)
      .run();
    throw new Error("A conta mudou durante o crédito; atualize o painel e tente novamente.");
  }
  return {
    accountId: intent.account_id,
    alreadyCredited: false,
    brlAmount: intent.brl_cents / 100,
    cmaUnits: intent.cma_units,
    intentId: intent.id,
  };
}
