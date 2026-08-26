export function formatPower(powerGh: number) {
  if (powerGh >= 1_000_000) return (powerGh / 1_000_000).toFixed(2) + " EH/s";
  if (powerGh >= 1_000) return (powerGh / 1_000).toFixed(2) + " TH/s";
  return powerGh.toFixed(2) + " GH/s";
}

export function formatCma(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}