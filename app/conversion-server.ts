import {
  CONVERSION_FEE_BPS,
  CONVERSION_MIN_USD,
  CONVERSION_QUOTE_TTL_MS,
  applyInternalConversionBalances,
  calculateCmaPurchaseQuote,
  cmaUnitsFromInput,
  conversionAssets,
  getConversionAsset,
  isConversionAsset,
  type ConversionAssetId,
} from "./conversion-rules.ts";
import {
  normalizeBootstrapState,
  type PublicGameState,
} from "./game-server.ts";
import { readBoundedJsonObject } from "./external-json.ts";

const PRICE_CACHE_MS = 60 * 1000;
const MAX_STALE_PRICE_MS = 15 * 60 * 1000;
const PRICE_FETCH_TIMEOUT_MS = 5 * 1000;
const QUOTE_LIMIT_10_MIN = 30;

type ConversionEnvironment = {
  COINGECKO_API_KEY?: string;
};

type PriceRow = {
  asset: string;
  observed_at: number;
  provider: string;
  usd_price_micros: number;
};

type ConversionQuoteRow = {
  account_id: string;
  asset: string;
  asset_amount_atomic: number;
  consumption_key: string | null;
  consumed_at: number | null;
  created_at: number;
  expires_at: number;
  fee_bps: number;
  fee_cma_micros: number;
  gross_cma_micros: number;
  id: string;
  net_cma_micros: number;
  state_version: number | null;
  status: string;
  usd_rate_micros: number;
};

type GameStateRow = {
  display_name: string;
  state_json: string;
  version: number;
};

export class ConversionExecutionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ConversionExecutionError";
    this.status = status;
  }
}

export type MarketRate = {
  asset: ConversionAssetId;
  observedAt: number;
  provider: "coinbase" | "coingecko";
  stale: boolean;
  usdPrice: number;
};

function marketProvider(value: string): MarketRate["provider"] {
  return value === "coinbase" ? "coinbase" : "coingecko";
}

export type ConversionQuote = {
  asset: ConversionAssetId;
  assetAmount: number;
  assetAmountAtomic: number;
  createdAt: number;
  eligible: boolean;
  expiresAt: number;
  feeBps: number;
  feeCma: number;
  grossCma: number;
  grossUsd: number;
  id: string;
  netCma: number;
  rateUsd: number;
  status: "preview";
  targetCma: number;
};

export type ConversionOverview = {
  accounts24h: number;
  conversionEnabled: true;
  conversions24h: number;
  netCma24h: number;
  previews24h: number;
  rates: Array<{
    asset: ConversionAssetId;
    observedAt: number;
    usdPrice: number;
  }>;
};

function apiKey(value: unknown) {
  const source = (value ?? {}) as ConversionEnvironment;
  return typeof source.COINGECKO_API_KEY === "string"
    ? source.COINGECKO_API_KEY.trim()
    : "";
}

export async function ensureConversionSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS market_price_snapshots (
      asset TEXT PRIMARY KEY NOT NULL,
      usd_price_micros INTEGER NOT NULL,
      provider TEXT NOT NULL,
      observed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS market_price_snapshots_observed_idx
      ON market_price_snapshots (observed_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS conversion_quotes (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      asset TEXT NOT NULL,
      asset_amount_atomic INTEGER NOT NULL,
      usd_rate_micros INTEGER NOT NULL,
      gross_cma_micros INTEGER NOT NULL,
      fee_bps INTEGER NOT NULL,
      fee_cma_micros INTEGER NOT NULL,
      net_cma_micros INTEGER NOT NULL,
      status TEXT DEFAULT 'preview' NOT NULL,
      consumption_key TEXT,
      consumed_at INTEGER,
      state_version INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS conversion_quotes_account_created_idx
      ON conversion_quotes (account_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS conversion_quotes_status_expiry_idx
      ON conversion_quotes (status, expires_at)`),
  ]);
}

async function readCachedRates(db: D1Database) {
  const rows = await db
    .prepare(`SELECT asset, usd_price_micros, provider, observed_at
      FROM market_price_snapshots`)
    .all<PriceRow>();
  return new Map(
    rows.results
      .filter((row) => isConversionAsset(row.asset))
      .map((row) => [row.asset as ConversionAssetId, row]),
  );
}

async function fetchCoinGeckoRates(environment: unknown, now: number) {
  const ids = conversionAssets.map((asset) => asset.coingeckoId).join(",");
  const key = apiKey(environment);
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`,
    {
      headers: {
        Accept: "application/json",
        ...(key ? { "x-cg-demo-api-key": key } : {}),
      },
      signal: AbortSignal.timeout(PRICE_FETCH_TIMEOUT_MS),
    },
  );
  if (!response.ok) throw new Error(`Cotação externa indisponível (${response.status}).`);
  const body = await readBoundedJsonObject(response);
  return conversionAssets.flatMap((asset) => {
    const result = body[asset.coingeckoId] as
      | { last_updated_at?: number; usd?: number }
      | undefined;
    if (!result || !Number.isFinite(result.usd) || Number(result.usd) <= 0) {
      return [];
    }
    const observedAt =
      Number.isFinite(result.last_updated_at) && Number(result.last_updated_at) > 0
        ? Number(result.last_updated_at) * 1000
        : now;
    if (observedAt > now + 60_000 || now - observedAt > MAX_STALE_PRICE_MS) {
      return [];
    }
    return [{
      asset: asset.id,
      observedAt,
      provider: "coingecko" as const,
      stale: false,
      usdPrice: Number(result.usd),
    }];
  });
}

async function fetchCoinbaseRate(
  asset: (typeof conversionAssets)[number],
  now: number,
): Promise<MarketRate> {
  const response = await fetch(
    `https://api.coinbase.com/v2/exchange-rates?currency=${asset.id}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(PRICE_FETCH_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Cotação alternativa indisponível (${response.status}).`);
  }
  const body = await readBoundedJsonObject(response);
  const data = body.data;
  if (!data || typeof data !== "object") {
    throw new Error(`Cotação alternativa de ${asset.id} inválida.`);
  }
  const currency = String(Reflect.get(data, "currency") ?? "").toUpperCase();
  const rates = Reflect.get(data, "rates");
  const usd =
    rates && typeof rates === "object"
      ? Number(Reflect.get(rates, "USD"))
      : Number.NaN;
  if (currency !== asset.id || !Number.isFinite(usd) || usd <= 0) {
    throw new Error(`Cotação alternativa de ${asset.id} indisponível.`);
  }
  return {
    asset: asset.id,
    observedAt: now,
    provider: "coinbase",
    stale: false,
    usdPrice: usd,
  };
}

async function fetchCoinbaseRates(now: number): Promise<MarketRate[]> {
  return Promise.all(conversionAssets.map((asset) => fetchCoinbaseRate(asset, now)));
}

async function fetchFreshRates(
  environment: unknown,
  now: number,
  cached: Map<ConversionAssetId, PriceRow>,
) {
  const byAsset = new Map<ConversionAssetId, MarketRate>();
  try {
    for (const rate of await fetchCoinGeckoRates(environment, now)) {
      byAsset.set(rate.asset, rate);
    }
  } catch {
    // A provider outage for one source must not prevent the other sources
    // from supplying the assets they still cover.
  }

  const missing = conversionAssets.filter((asset) => !byAsset.has(asset.id));
  const fallbackRates = await Promise.all(
    missing.map(async (asset) => {
      try {
        return await fetchCoinbaseRate(asset, now);
      } catch {
        return null;
      }
    }),
  );
  for (const rate of fallbackRates) {
    if (rate) byAsset.set(rate.asset, rate);
  }

  for (const asset of conversionAssets) {
    if (byAsset.has(asset.id)) continue;
    const row = cached.get(asset.id);
    if (!row || now - row.observed_at > MAX_STALE_PRICE_MS) continue;
    byAsset.set(asset.id, {
      asset: asset.id,
      observedAt: row.observed_at,
      provider: marketProvider(row.provider),
      stale: true,
      usdPrice: row.usd_price_micros / 1_000_000,
    });
  }

  if (byAsset.size !== conversionAssets.length) {
    throw new Error("Cotação externa indisponível para uma ou mais moedas.");
  }
  return conversionAssets.map((asset) => byAsset.get(asset.id)!);
}

export async function readMarketRates(
  db: D1Database,
  environment: unknown,
  now = Date.now(),
) {
  await ensureConversionSchema(db);
  const cached = await readCachedRates(db);
  const fresh = conversionAssets.every(
    (asset) => now - Number(cached.get(asset.id)?.observed_at ?? 0) <= PRICE_CACHE_MS,
  );
  if (fresh) {
    return conversionAssets.map((asset) => {
      const row = cached.get(asset.id)!;
      return {
        asset: asset.id,
        observedAt: row.observed_at,
        provider: marketProvider(row.provider),
        stale: false,
        usdPrice: row.usd_price_micros / 1_000_000,
      };
    });
  }

  try {
    const rates = await fetchFreshRates(environment, now, cached);
    await db.batch(
      rates.filter((rate) => !rate.stale).map((rate) =>
        db
          .prepare(`INSERT INTO market_price_snapshots (
            asset, usd_price_micros, provider, observed_at, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(asset) DO UPDATE SET
            usd_price_micros = excluded.usd_price_micros,
            provider = excluded.provider,
            observed_at = excluded.observed_at,
            updated_at = excluded.updated_at`)
          .bind(
            rate.asset,
            Math.round(rate.usdPrice * 1_000_000),
            rate.provider,
            rate.observedAt,
            now,
          ),
      ),
    );
    return rates;
  } catch (error) {
    const usableFallback = conversionAssets.every(
      (asset) =>
        now - Number(cached.get(asset.id)?.observed_at ?? 0) <= MAX_STALE_PRICE_MS,
    );
    if (!usableFallback) throw error;
    return conversionAssets.map((asset) => {
      const row = cached.get(asset.id)!;
      return {
        asset: asset.id,
        observedAt: row.observed_at,
        provider: marketProvider(row.provider),
        stale: true,
        usdPrice: row.usd_price_micros / 1_000_000,
      };
    });
  }
}

export async function createConversionQuote(input: {
  accountId: string;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
  targetCma: unknown;
}) {
  const now = input.now ?? Date.now();
  await ensureConversionSchema(input.db);
  if (!isConversionAsset(input.asset)) {
    throw new Error("Moeda de conversão inválida.");
  }
  const targetCma = cmaUnitsFromInput(input.targetCma);
  if (!targetCma) throw new Error("Escolha uma quantidade inteira de CMA, a partir de 1.");

  const recent = await input.db
    .prepare(`SELECT COUNT(*) AS total FROM conversion_quotes
      WHERE account_id = ? AND created_at >= ?`)
    .bind(input.accountId, now - 10 * 60 * 1000)
    .first<{ total: number }>();
  if (Number(recent?.total ?? 0) >= QUOTE_LIMIT_10_MIN) {
    throw new Error("Muitas cotações em sequência. Aguarde alguns minutos.");
  }
  await input.db
    .prepare(`DELETE FROM conversion_quotes WHERE created_at < ?`)
    .bind(now - 30 * 24 * 60 * 60 * 1000)
    .run();

  const rates = await readMarketRates(input.db, input.environment, now);
  const rate = rates.find((item) => item.asset === input.asset)!;
  if (rate.stale) {
    throw new Error("Cotação atual indisponível. Aguarde alguns instantes e tente novamente.");
  }
  const calculated = calculateCmaPurchaseQuote(
    input.asset,
    targetCma,
    rate.usdPrice,
  );
  const amountAtomic = calculated.assetAmountAtomic;
  const id = crypto.randomUUID();
  const expiresAt = now + CONVERSION_QUOTE_TTL_MS;
  await input.db
    .prepare(`INSERT INTO conversion_quotes (
      id, account_id, asset, asset_amount_atomic, usd_rate_micros,
      gross_cma_micros, fee_bps, fee_cma_micros, net_cma_micros,
      status, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'preview', ?, ?)`)
    .bind(
      id,
      input.accountId,
      input.asset,
      amountAtomic,
      Math.round(rate.usdPrice * 1_000_000),
      Math.round(calculated.grossCma * 1_000_000),
      CONVERSION_FEE_BPS,
      Math.round(calculated.feeCma * 1_000_000),
      Math.round(calculated.netCma * 1_000_000),
      expiresAt,
      now,
    )
    .run();

  const asset = getConversionAsset(input.asset);
  const quote: ConversionQuote = {
    asset: input.asset,
    assetAmount: amountAtomic / asset.atomicScale,
    assetAmountAtomic: amountAtomic,
    createdAt: now,
    eligible: calculated.grossUsd >= CONVERSION_MIN_USD,
    expiresAt,
    feeBps: CONVERSION_FEE_BPS,
    feeCma: calculated.feeCma,
    grossCma: calculated.grossCma,
    grossUsd: calculated.grossUsd,
    id,
    netCma: calculated.netCma,
    rateUsd: rate.usdPrice,
    status: "preview",
    targetCma,
  };
  return quote;
}

function parseGameState(value: string) {
  try {
    return JSON.parse(value) as PublicGameState;
  } catch {
    throw new ConversionExecutionError("A carteira da conta está inconsistente.", 500);
  }
}

function applyQuotedConversion(
  state: PublicGameState,
  quote: ConversionQuoteRow,
  asset: ConversionAssetId,
) {
  const next = structuredClone(state);
  let balances;
  try {
    balances = applyInternalConversionBalances({
      asset,
      assetAmountAtomic: quote.asset_amount_atomic,
      btcBalanceAtomic: next.btcBalanceAtomic,
      cmaBalance: next.cmaBalance,
      dogeBalanceAtomic: next.dogeBalanceAtomic,
      ltcBalanceAtomic: next.ltcBalanceAtomic,
      netCmaMicros: quote.net_cma_micros,
    });
  } catch (error) {
    throw new ConversionExecutionError(
      error instanceof Error ? error.message : "Conversão interna inválida.",
    );
  }
  next.btcBalanceAtomic = balances.btcBalanceAtomic;
  next.cmaBalance = balances.cmaBalance;
  next.dogeBalanceAtomic = balances.dogeBalanceAtomic;
  next.ltcBalanceAtomic = balances.ltcBalanceAtomic;
  next.displayedBalanceSymbol = "CMA";
  return next;
}

async function readGameState(db: D1Database, accountId: string) {
  return db
    .prepare(`SELECT display_name, state_json, version
      FROM game_states WHERE account_id = ?`)
    .bind(accountId)
    .first<GameStateRow>();
}

async function readExecutionByKey(
  db: D1Database,
  accountId: string,
  idempotencyKey: string,
) {
  return db
    .prepare(`SELECT state_version FROM ledger_entries
      WHERE account_id = ? AND idempotency_key = ? AND action = 'convert_crypto_to_cma'`)
    .bind(accountId, idempotencyKey)
    .first<{ state_version: number }>();
}

export async function executeConversionQuote(input: {
  accountId: string;
  db: D1Database;
  expectedVersion: number;
  idempotencyKey: string;
  now?: number;
  quoteId: string;
}) {
  const now = input.now ?? Date.now();
  await ensureConversionSchema(input.db);
  if (
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    input.idempotencyKey.length < 8 ||
    input.idempotencyKey.length > 100 ||
    input.quoteId.length < 8 ||
    input.quoteId.length > 100
  ) {
    throw new ConversionExecutionError("Dados de confirmação inválidos.");
  }

  const prior = await readExecutionByKey(
    input.db,
    input.accountId,
    input.idempotencyKey,
  );
  if (prior) {
    const latest = await readGameState(input.db, input.accountId);
    if (!latest) throw new ConversionExecutionError("Conta não encontrada.", 404);
    return {
      alreadyProcessed: true,
      message: "Conversão já processada anteriormente.",
      state: parseGameState(latest.state_json),
      version: latest.version,
    };
  }

  const quote = await input.db
    .prepare(`SELECT id, account_id, asset, asset_amount_atomic, usd_rate_micros,
      gross_cma_micros, fee_bps, fee_cma_micros, net_cma_micros, status,
      consumption_key, consumed_at, state_version, expires_at, created_at
      FROM conversion_quotes WHERE id = ? AND account_id = ?`)
    .bind(input.quoteId, input.accountId)
    .first<ConversionQuoteRow>();
  if (!quote) throw new ConversionExecutionError("Cotação não encontrada.", 404);
  if (quote.status !== "preview") {
    throw new ConversionExecutionError("Esta cotação já foi utilizada.", 409);
  }
  if (quote.expires_at < now) {
    throw new ConversionExecutionError("A cotação expirou. Gere uma nova.", 409);
  }
  if (!isConversionAsset(quote.asset)) {
    throw new ConversionExecutionError("Moeda de conversão inválida.");
  }
  if (
    quote.net_cma_micros < CONVERSION_MIN_USD * 1_000_000 ||
    quote.net_cma_micros % 1_000_000 !== 0
  ) {
    throw new ConversionExecutionError("A conversão está abaixo do mínimo econômico.");
  }

  const row = await readGameState(input.db, input.accountId);
  if (!row) throw new ConversionExecutionError("Abra sua conta de jogo antes de converter.", 404);
  if (row.version !== input.expectedVersion) {
    throw new ConversionExecutionError(
      "Sua carteira mudou em outra sessão. Atualize a conta e gere uma nova cotação.",
      409,
    );
  }

  const asset = quote.asset;
  const nextState = applyQuotedConversion(
    normalizeBootstrapState(parseGameState(row.state_json), now),
    quote,
    asset,
  );
  const nextVersion = row.version + 1;
  const nextStateJson = JSON.stringify(nextState);
  const ledgerId = crypto.randomUUID();
  const metadataJson = JSON.stringify({
    asset,
    assetAmountAtomic: quote.asset_amount_atomic,
    feeBps: quote.fee_bps,
    feeCmaMicros: quote.fee_cma_micros,
    grossCmaMicros: quote.gross_cma_micros,
    netCmaMicros: quote.net_cma_micros,
    targetCma: quote.net_cma_micros / 1_000_000,
    oneWayOnly: true,
    quoteId: quote.id,
    source: "internal_wallet",
    usdRateMicros: quote.usd_rate_micros,
  });

  const results = await input.db.batch([
    input.db
      .prepare(`UPDATE conversion_quotes
        SET status = 'consumed', consumption_key = ?, consumed_at = ?, state_version = ?
        WHERE id = ? AND account_id = ? AND status = 'preview' AND expires_at >= ?`)
      .bind(
        input.idempotencyKey,
        now,
        nextVersion,
        quote.id,
        input.accountId,
        now,
      ),
    input.db
      .prepare(`UPDATE game_states
        SET state_json = ?, version = ?, updated_at = ?
        WHERE account_id = ? AND version = ?
          AND EXISTS (
            SELECT 1 FROM conversion_quotes
            WHERE id = ? AND account_id = ? AND consumption_key = ?
          )`)
      .bind(
        nextStateJson,
        nextVersion,
        now,
        input.accountId,
        row.version,
        quote.id,
        input.accountId,
        input.idempotencyKey,
      ),
    input.db
      .prepare(`INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) SELECT ?, ?, 'convert_crypto_to_cma', ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM conversion_quotes
          WHERE id = ? AND account_id = ? AND consumption_key = ?
        ) AND EXISTS (
          SELECT 1 FROM game_states
          WHERE account_id = ? AND version = ? AND state_json = ?
        )`)
      .bind(
        ledgerId,
        input.accountId,
        input.idempotencyKey,
        nextVersion,
        quote.net_cma_micros,
        metadataJson,
        now,
        quote.id,
        input.accountId,
        input.idempotencyKey,
        input.accountId,
        nextVersion,
        nextStateJson,
      ),
  ]);

  const quoteChanged = Number(results[0]?.meta.changes ?? 0) === 1;
  const stateChanged = Number(results[1]?.meta.changes ?? 0) === 1;
  const ledgerChanged = Number(results[2]?.meta.changes ?? 0) === 1;
  if (!quoteChanged || !stateChanged || !ledgerChanged) {
    if (quoteChanged && !stateChanged) {
      await input.db
        .prepare(`UPDATE conversion_quotes
          SET status = 'preview', consumption_key = NULL, consumed_at = NULL, state_version = NULL
          WHERE id = ? AND account_id = ? AND consumption_key = ?
            AND NOT EXISTS (
              SELECT 1 FROM ledger_entries
              WHERE account_id = ? AND idempotency_key = ?
            )`)
        .bind(
          quote.id,
          input.accountId,
          input.idempotencyKey,
          input.accountId,
          input.idempotencyKey,
        )
        .run();
    }
    throw new ConversionExecutionError(
      "A carteira mudou enquanto você confirmava. Atualize e tente novamente.",
      409,
    );
  }

  return {
    alreadyProcessed: false,
    conversion: {
      asset,
      assetAmountAtomic: quote.asset_amount_atomic,
      feeCma: quote.fee_cma_micros / 1_000_000,
      netCma: quote.net_cma_micros / 1_000_000,
      quoteId: quote.id,
    },
    message: `${quote.net_cma_micros / 1_000_000} CMA creditado na carteira.`,
    state: nextState,
    version: nextVersion,
  };
}

export async function readConversionOverview(
  db: D1Database,
  now = Date.now(),
): Promise<ConversionOverview> {
  await ensureConversionSchema(db);
  const [quotes, accounts, conversions, cached] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM conversion_quotes
      WHERE created_at >= ?`).bind(now - 24 * 60 * 60 * 1000).first<{ total: number }>(),
    db.prepare(`SELECT COUNT(DISTINCT account_id) AS total FROM conversion_quotes
      WHERE created_at >= ?`).bind(now - 24 * 60 * 60 * 1000).first<{ total: number }>(),
    db.prepare(`SELECT COUNT(*) AS total,
        COALESCE(SUM(net_cma_micros), 0) AS net_cma_micros
      FROM conversion_quotes
      WHERE status = 'consumed' AND consumed_at >= ?`)
      .bind(now - 24 * 60 * 60 * 1000)
      .first<{ net_cma_micros: number; total: number }>(),
    readCachedRates(db),
  ]);
  return {
    accounts24h: Number(accounts?.total ?? 0),
    conversionEnabled: true,
    conversions24h: Number(conversions?.total ?? 0),
    netCma24h: Number(conversions?.net_cma_micros ?? 0) / 1_000_000,
    previews24h: Number(quotes?.total ?? 0),
    rates: conversionAssets.flatMap((asset) => {
      const row = cached.get(asset.id);
      return row
        ? [{
            asset: asset.id,
            observedAt: row.observed_at,
            usdPrice: row.usd_price_micros / 1_000_000,
          }]
        : [];
    }),
  };
}
