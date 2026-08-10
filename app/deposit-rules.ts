import { CONVERSION_FEE_BPS } from "./conversion-rules.ts";

export const DEPOSIT_SETTLEMENT_ASSET = "USDTTRC20" as const;
export const DEPOSIT_SETTLEMENT_DECIMALS = 6;

export function parseDecimalAtomic(value: unknown, decimals: number) {
  if ((typeof value !== "string" && typeof value !== "number") ||
      !Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
    return null;
  }
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, rawFraction = ""] = normalized.split(".");
  const keptFraction = rawFraction.slice(0, decimals);
  const discardedFraction = rawFraction.slice(decimals);
  if (discardedFraction && /[1-9]/.test(discardedFraction)) return null;
  try {
    const scale = 10n ** BigInt(decimals);
    const atomic =
      BigInt(whole) * scale +
      BigInt((keptFraction + "0".repeat(decimals)).slice(0, decimals) || "0");
    if (atomic <= 0n || atomic > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(atomic);
  } catch {
    return null;
  }
}

export function calculateDirectCmaDeposit(
  requestedUsdMicros: number,
  settlementUsdtMicros: number,
) {
  if (
    !Number.isSafeInteger(requestedUsdMicros) ||
    !Number.isSafeInteger(settlementUsdtMicros) ||
    requestedUsdMicros <= 0 ||
    settlementUsdtMicros <= 0
  ) {
    throw new Error("Valores de depósito inválidos.");
  }
  const feeCmaMicros = Math.ceil(
    (requestedUsdMicros * CONVERSION_FEE_BPS) / 10_000,
  );
  const creditedCmaMicros = requestedUsdMicros - feeCmaMicros;
  if (!Number.isSafeInteger(creditedCmaMicros) || creditedCmaMicros <= 0) {
    throw new Error("Crédito CMA calculado inválido.");
  }
  return {
    creditedCmaMicros,
    feeBps: CONVERSION_FEE_BPS,
    feeCmaMicros,
    grossCmaMicros: requestedUsdMicros,
    reserveCovered: settlementUsdtMicros >= creditedCmaMicros,
  };
}
