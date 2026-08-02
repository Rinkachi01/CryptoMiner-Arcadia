export const CMA_USD_REFERENCE = 1;
export const CONVERSION_FEE_BPS = 300;
export const CONVERSION_MIN_USD = 1;
export const CONVERSION_QUOTE_TTL_MS = 5 * 60 * 1000;

export type ConversionAssetId = "BTC" | "DOGE" | "LTC";

export type ConversionAsset = {
  atomicScale: number;
  coingeckoId: string;
  id: ConversionAssetId;
  name: string;
};

export const conversionAssets: ConversionAsset[] = [
  {
    atomicScale: 100_000_000,
    coingeckoId: "bitcoin",
    id: "BTC",
    name: "Bitcoin",
  },
  {
    atomicScale: 100_000_000,
    coingeckoId: "dogecoin",
    id: "DOGE",
    name: "Dogecoin",
  },
  {
    atomicScale: 100_000_000,
    coingeckoId: "litecoin",
    id: "LTC",
    name: "Litecoin",
  },
];

export function isConversionAsset(value: unknown): value is ConversionAssetId {
  return conversionAssets.some((asset) => asset.id === value);
}

export function getConversionAsset(id: ConversionAssetId) {
  return conversionAssets.find((asset) => asset.id === id)!;
}

export function amountToAtomic(value: string, assetId: ConversionAssetId) {
  const asset = getConversionAsset(assetId);
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  const atomic = Math.round(amount * asset.atomicScale);
  return Number.isSafeInteger(atomic) && atomic > 0 ? atomic : null;
}

export function calculateConversionQuote(
  assetId: ConversionAssetId,
  amountAtomic: number,
  usdRate: number,
) {
  const asset = getConversionAsset(assetId);
  const assetAmount = amountAtomic / asset.atomicScale;
  const grossUsd = assetAmount * usdRate;
  const grossCma = grossUsd / CMA_USD_REFERENCE;
  const feeCma = grossCma * (CONVERSION_FEE_BPS / 10_000);
  const netCma = Math.max(0, grossCma - feeCma);
  return {
    assetAmount,
    eligible: grossUsd >= CONVERSION_MIN_USD,
    feeCma,
    grossCma,
    grossUsd,
    netCma,
  };
}

export function applyInternalConversionBalances(input: {
  asset: "BTC" | "DOGE";
  assetAmountAtomic: number;
  btcBalanceAtomic: number;
  cmaBalance: number;
  dogeBalanceAtomic: number;
  netCmaMicros: number;
}) {
  if (
    !Number.isSafeInteger(input.assetAmountAtomic) ||
    input.assetAmountAtomic <= 0 ||
    !Number.isSafeInteger(input.netCmaMicros) ||
    input.netCmaMicros <= 0
  ) {
    throw new Error("Conversão interna inválida.");
  }
  const available =
    input.asset === "BTC" ? input.btcBalanceAtomic : input.dogeBalanceAtomic;
  if (available < input.assetAmountAtomic) {
    throw new Error(`Saldo ${input.asset} insuficiente para esta conversão.`);
  }
  const currentCmaMicros = Math.round(input.cmaBalance * 1_000_000);
  return {
    btcBalanceAtomic:
      input.asset === "BTC"
        ? input.btcBalanceAtomic - input.assetAmountAtomic
        : input.btcBalanceAtomic,
    cmaBalance: (currentCmaMicros + input.netCmaMicros) / 1_000_000,
    dogeBalanceAtomic:
      input.asset === "DOGE"
        ? input.dogeBalanceAtomic - input.assetAmountAtomic
        : input.dogeBalanceAtomic,
  };
}
