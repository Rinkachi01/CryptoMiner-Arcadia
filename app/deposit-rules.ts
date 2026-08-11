export function settlementAssetDecimals(asset: string) {
  const normalized = asset.trim().toUpperCase();
  if (normalized.startsWith("USDT") || normalized.startsWith("USDC")) return 6;
  return 8;
}

export function applyCryptoDepositBalances(input: {
  asset: "BTC" | "DOGE" | "LTC";
  btcBalanceAtomic: number;
  dogeBalanceAtomic: number;
  ltcBalanceAtomic: number;
  receivedAtomic: number;
}) {
  if (
    !Number.isSafeInteger(input.btcBalanceAtomic) ||
    !Number.isSafeInteger(input.dogeBalanceAtomic) ||
    !Number.isSafeInteger(input.ltcBalanceAtomic) ||
    !Number.isSafeInteger(input.receivedAtomic) ||
    input.btcBalanceAtomic < 0 ||
    input.dogeBalanceAtomic < 0 ||
    input.ltcBalanceAtomic < 0 ||
    input.receivedAtomic <= 0
  ) {
    throw new Error("Crédito de depósito inválido.");
  }
  const btcBalanceAtomic =
    input.asset === "BTC"
      ? input.btcBalanceAtomic + input.receivedAtomic
      : input.btcBalanceAtomic;
  const dogeBalanceAtomic =
    input.asset === "DOGE"
      ? input.dogeBalanceAtomic + input.receivedAtomic
      : input.dogeBalanceAtomic;
  const ltcBalanceAtomic =
    input.asset === "LTC"
      ? input.ltcBalanceAtomic + input.receivedAtomic
      : input.ltcBalanceAtomic;
  if (
    !Number.isSafeInteger(btcBalanceAtomic) ||
    !Number.isSafeInteger(dogeBalanceAtomic) ||
    !Number.isSafeInteger(ltcBalanceAtomic)
  ) {
    throw new Error("Saldo recebido excede o limite seguro.");
  }
  return { btcBalanceAtomic, dogeBalanceAtomic, ltcBalanceAtomic };
}

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
