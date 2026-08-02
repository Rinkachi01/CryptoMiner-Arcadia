import {
  CONVERSION_FEE_BPS,
  CONVERSION_MIN_USD,
  CONVERSION_QUOTE_TTL_MS,
  amountToAtomic,
  calculateConversionQuote,
  conversionAssets,
  getConversionAsset,
  isConversionAsset,
  type ConversionAssetId,
} from "./conversion-rules.ts";

const PRICE_CACHE_MS = 60 * 1000;
const MAX_STALE_PRICE_MS = 15 * 60 * 1000;
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

export type MarketRate = {
  asset: ConversionAssetId;
  observedAt: number;
  provider: "coingecko";
  stale: boolean;
  usdPrice: number;
};

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
};

export type ConversionOverview = {
  accounts24h: number;
  conversionEnabled: false;
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
    },
  );
  if (!response.ok) throw new Error(`Cotação externa indisponível (${response.status}).`);
  const body = (await response.json()) as Record<
    string,
    { last_updated_at?: number; usd?: number }
  >;
  return conversionAssets.map((asset) => {
    const result = body[asset.coingeckoId];
    if (!result || !Number.isFinite(result.usd) || Number(result.usd) <= 0) {
      throw new Error(`Cotação de ${asset.id} indisponível.`);
    }
    return {
      asset: asset.id,
      observedAt:
        Number.isFinite(result.last_updated_at) && Number(result.last_updated_at) > 0
          ? Number(result.last_updated_at) * 1000
          : now,
      provider: "coingecko" as const,
      stale: false,
      usdPrice: Number(result.usd),
    };
  });
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
        provider: "coingecko" as const,
        stale: false,
        usdPrice: row.usd_price_micros / 1_000_000,
      };
    });
  }

  try {
    const rates = await fetchCoinGeckoRates(environment, now);
    await db.batch(
      rates.map((rate) =>
        db
          .prepare(`INSERT INTO market_price_snapshots (
            asset, usd_price_micros, provider, observed_at, updated_at
          ) VALUES (?, ?, 'coingecko', ?, ?)
          ON CONFLICT(asset) DO UPDATE SET
            usd_price_micros = excluded.usd_price_micros,
            provider = excluded.provider,
            observed_at = excluded.observed_at,
            updated_at = excluded.updated_at`)
          .bind(
            rate.asset,
            Math.round(rate.usdPrice * 1_000_000),
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
        provider: "coingecko" as const,
        stale: true,
        usdPrice: row.usd_price_micros / 1_000_000,
      };
    });
  }
}

export async function createConversionQuote(input: {
  accountId: string;
  amount: string;
  asset: unknown;
  db: D1Database;
  environment: unknown;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  await ensureConversionSchema(input.db);
  if (!isConversionAsset(input.asset)) {
    throw new Error("Moeda de conversão inválida.");
  }
  const amountAtomic = amountToAtomic(input.amount, input.asset);
  if (!amountAtomic) throw new Error("Informe uma quantidade válida, com até 8 casas decimais.");

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
  const calculated = calculateConversionQuote(
    input.asset,
    amountAtomic,
    rate.usdPrice,
  );
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
  };
  return quote;
}

export async function readConversionOverview(
  db: D1Database,
  now = Date.now(),
): Promise<ConversionOverview> {
  await ensureConversionSchema(db);
  const [quotes, accounts, cached] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM conversion_quotes
      WHERE created_at >= ?`).bind(now - 24 * 60 * 60 * 1000).first<{ total: number }>(),
    db.prepare(`SELECT COUNT(DISTINCT account_id) AS total FROM conversion_quotes
      WHERE created_at >= ?`).bind(now - 24 * 60 * 60 * 1000).first<{ total: number }>(),
    readCachedRates(db),
  ]);
  return {
    accounts24h: Number(accounts?.total ?? 0),
    conversionEnabled: false,
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
