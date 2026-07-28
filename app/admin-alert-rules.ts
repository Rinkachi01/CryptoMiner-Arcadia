import type { AdminRuntimeSettings } from "./admin-settings.ts";

export type AdminAlert = {
  current: number;
  id: string;
  label: string;
  message: string;
  severity: "attention" | "critical" | "stable";
  threshold: number;
  unit: string;
};

export type AdminAlertMetrics = {
  crateOpens24h: number;
  minerConcentrationPercent: number;
  openReviews: number;
  powerGranted24h: number;
};

export function evaluateAdminAlerts(
  metrics: AdminAlertMetrics,
  settings: AdminRuntimeSettings,
): AdminAlert[] {
  const definitions = [
    {
      id: "power-emission",
      label: "Emissão de poder",
      current: metrics.powerGranted24h,
      threshold: settings.powerAlertGh,
      unit: "GH/s",
      message: "Poder temporário concedido nas últimas 24 horas.",
    },
    {
      id: "open-reviews",
      label: "Fila antifraude",
      current: metrics.openReviews,
      threshold: settings.openReviewAlertCount,
      unit: "sessões",
      message: "Partidas sinalizadas que ainda aguardam decisão.",
    },
    {
      id: "crate-volume",
      label: "Volume de caixas",
      current: metrics.crateOpens24h,
      threshold: settings.crateAlertCount,
      unit: "aberturas",
      message: "Caixas Arcadia abertas nas últimas 24 horas.",
    },
    {
      id: "miner-concentration",
      label: "Concentração de minerador",
      current: metrics.minerConcentrationPercent,
      threshold: settings.minerConcentrationAlertPercent,
      unit: "%",
      message: "Participação do modelo de minerador mais comum no estoque.",
    },
  ];

  return definitions.map((definition) => {
    const ratio =
      definition.threshold > 0
        ? definition.current / definition.threshold
        : 0;
    return {
      ...definition,
      severity:
        ratio >= 1.25 ? "critical" : ratio >= 1 ? "attention" : "stable",
    };
  });
}
