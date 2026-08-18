"use client";

import { useCallback, useEffect, useState } from "react";
import { useArcadiaLanguage } from "./i18n";

type Summary = {
  operator: {
    level: number;
    rank: string;
    xp: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPercent: number;
  };
  totals: {
    totalPlays: number;
    totalWins: number;
    playsToday: number;
    winsToday: number;
    powerToday: number;
    flaggedSessions: number;
  };
  emission: {
    budgetPowerGh: number;
    limited: boolean;
    remainingPowerGh: number;
    resetAt: number;
    rollingPower24h: number;
    status: "stable" | "attention" | "limited";
    usagePercent: number;
    usedPowerGh: number;
  };
  games: Array<{
    id: string;
    level: number;
    winStreak: number;
    totalPlays: number;
    totalWins: number;
    winRate: number;
  }>;
};

const gameNames: Record<string, string> = {
  "packet-catch": "Packet Catch",
  "hash-match": "Hash Match",
  "circuit-rush": "Circuit Rush",
};

export function OperatorProgressPanel({
  refreshKey,
  section = "overview",
}: {
  refreshKey: number;
  section?: "overview";
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const spanish = locale === "es";
  const numberLocale = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";
  const copy = {
    loading: english ? "Loading progress…" : spanish ? "Cargando progreso…" : "Carregando progresso...",
    unavailable: english ? "Summary unavailable." : spanish ? "Resumen no disponible." : "Resumo indisponível.",
    failed: english ? "We could not load your progress." : spanish ? "No se pudo cargar tu progreso." : "Não foi possível carregar o progresso.",
    level: english ? "OPERATOR LEVEL" : spanish ? "NIVEL DEL OPERADOR" : "NÍVEL DO OPERADOR",
    totalXp: english ? "total XP" : spanish ? "XP total" : "XP total",
    nextLevel: english ? "XP to next level" : spanish ? "XP para el siguiente nivel" : "XP para o próximo nível",
    currentStreak: english ? "current streak" : spanish ? "racha actual" : "sequência atual",
    wins: english ? "wins" : spanish ? "victorias" : "vitórias",
    emission: english ? "EMISSION CONTROL · SERVER" : spanish ? "CONTROL DE EMISIÓN · SERVIDOR" : "CONTROLE DE EMISSÃO · SERVIDOR",
    stable: english ? "STABLE ECONOMY" : spanish ? "ECONOMÍA ESTABLE" : "ECONOMIA ESTÁVEL",
    attention: english ? "BUDGET NEEDS ATTENTION" : spanish ? "PRESUPUESTO EN ATENCIÓN" : "ORÇAMENTO EM ATENÇÃO",
    limited: english ? "DAILY LIMIT REACHED" : spanish ? "LÍMITE DIARIO ALCANZADO" : "LIMITE DIÁRIO ATINGIDO",
    used: english ? "USED" : spanish ? "UTILIZADO" : "UTILIZADO",
    grantedToday: english ? "POWER GRANTED TODAY" : spanish ? "PODER OTORGADO HOY" : "PODER CONCEDIDO HOJE",
    available: english ? "POWER AVAILABLE FOR MINIGAMES" : spanish ? "PODER DISPONIBLE PARA MINIJUEGOS" : "PODER DISPONÍVEL PARA MINIGAMES",
    dailyLimit: english ? "DAILY LIMIT" : spanish ? "LÍMITE DIARIO" : "LIMITE DIÁRIO",
    cycleReset: english ? "CYCLE RESET" : spanish ? "REINICIO DEL CICLO" : "REINÍCIO DO CICLO",
    emissionNote: english
      ? "The server only limits temporary power granted by minigames when the cycle budget is reached."
      : spanish
        ? "El servidor solo limita el poder temporal otorgado por los minijuegos cuando se alcanza el presupuesto del ciclo."
        : "O servidor limita apenas o poder temporário concedido pelos minigames quando o orçamento do ciclo é atingido.",
  };
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState(copy.loading);

  const loadSummary = useCallback(() => {
    let active = true;
    void fetch("/api/games/summary", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as Summary & { error?: string };
        if (!response.ok) throw new Error(data.error ?? copy.unavailable);
        if (active) {
          setSummary(data);
          setMessage("");
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : copy.failed,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [copy.failed, copy.unavailable]);

  useEffect(() => loadSummary(), [loadSummary, refreshKey]);

  if (!summary) {
    return (
      <section className="operator-progress-panel loading" aria-live="polite">
        {message}
      </section>
    );
  }

  return (
    <section className={`operator-progress-panel show-${section}`}>
      <div className="operator-level-card">
        <span>{copy.level}</span>
        <strong>{String(summary.operator.level).padStart(2, "0")}</strong>
        <div>
          <b>{summary.operator.rank}</b>
          <small>{summary.operator.xp.toLocaleString(numberLocale)} {copy.totalXp}</small>
          <i>
            <em style={{ width: `${summary.operator.progressPercent}%` }} />
          </i>
          <small>
            {Math.max(0, summary.operator.nextLevelXp - summary.operator.xp).toLocaleString(numberLocale)} {copy.nextLevel}
          </small>
        </div>
      </div>

      <div className="operator-game-stats">
        {summary.games.map((game) => (
          <article key={game.id}>
            <span>{gameNames[game.id] ?? game.id}</span>
            <strong>NÍVEL {game.level}</strong>
            <small>
              {game.totalWins}/{game.totalPlays} {copy.wins} · {game.winRate}%
            </small>
            <em>{game.winStreak} {copy.currentStreak}</em>
          </article>
        ))}
      </div>

      <div className={`economy-guard-panel ${summary.emission.status}`}>
        <div className="economy-guard-heading">
          <div>
            <span>{copy.emission}</span>
            <strong>
              {summary.emission.status === "stable"
                ? copy.stable
                : summary.emission.status === "attention"
                  ? copy.attention
                  : copy.limited}
          </strong>
          </div>
          <b>{summary.emission.usagePercent}% {copy.used}</b>
        </div>
        <i>
          <em style={{ width: `${summary.emission.usagePercent}%` }} />
        </i>
        <div className="economy-guard-metrics">
          <article>
            <span>{copy.grantedToday}</span>
            <strong>
              {summary.emission.usedPowerGh.toLocaleString(numberLocale)} GH/s
            </strong>
          </article>
          <article>
            <span>{copy.available}</span>
            <strong>
              {summary.emission.remainingPowerGh.toLocaleString(numberLocale)} GH/s
            </strong>
          </article>
          <article>
            <span>{copy.dailyLimit}</span>
            <strong>
              {summary.emission.budgetPowerGh.toLocaleString(numberLocale)} GH/s
            </strong>
          </article>
          <article>
            <span>{copy.cycleReset}</span>
            <strong>
              {new Date(summary.emission.resetAt).toLocaleTimeString(numberLocale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>
          </article>
        </div>
        <p>{copy.emissionNote}</p>
      </div>

    </section>
  );
}
