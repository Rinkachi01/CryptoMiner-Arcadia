"use client";

import { useCallback, useEffect, useState } from "react";

type Summary = {
  operator: {
    level: number;
    rank: string;
    league: {
      name: string;
      nextName: string | null;
      currentXp: number;
      targetXp: number;
      progressPercent: number;
    };
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
  missions: Array<{
    id: string;
    label: string;
    current: number;
    target: number;
    eligible?: boolean;
    claimed?: boolean;
    claimable?: boolean;
    resetAt?: number;
    reward?: {
      type: "battery";
      amount: number;
    };
  }>;
  achievements: Array<{
    id: string;
    label: string;
    description: string;
    current: number;
    target: number;
  }>;
};

const gameNames: Record<string, string> = {
  "packet-catch": "Packet Catch",
  "hash-match": "Hash Match",
  "circuit-rush": "Circuit Rush",
};

// Tour diário do Arcade agora usa a meta de 10 partidas e entrega +12h.

// MISSÕES DIÁRIAS continuam no domínio de progresso; RESGATAR 1 BATERIA agora é tratado pelo ciclo de 9h da sala.
export function OperatorProgressPanel({
  refreshKey,
  section = "overview",
}: {
  refreshKey: number;
  section?: "overview" | "missions";
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("Carregando progresso...");

  const loadSummary = useCallback(() => {
    let active = true;
    void fetch("/api/games/summary", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as Summary & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Resumo indisponível.");
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
              : "Não foi possível carregar o progresso.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
        <span>NÍVEL DO OPERADOR</span>
        <strong>{String(summary.operator.level).padStart(2, "0")}</strong>
        <div>
          <b>{summary.operator.rank}</b>
          <small>{summary.operator.xp.toLocaleString("pt-BR")} XP total</small>
          <i>
            <em style={{ width: `${summary.operator.progressPercent}%` }} />
          </i>
          <small>
            {summary.operator.nextLevelXp - summary.operator.xp} XP para o
            próximo nível
          </small>
        </div>
      </div>

      <div className="operator-game-stats">
        {summary.games.map((game) => (
          <article key={game.id}>
            <span>{gameNames[game.id] ?? game.id}</span>
            <strong>NÍVEL {game.level}</strong>
            <small>
              {game.totalWins}/{game.totalPlays} vitórias · {game.winRate}%
            </small>
            <em>{game.winStreak} sequência atual</em>
          </article>
        ))}
      </div>

      <div className={`economy-guard-panel ${summary.emission.status}`}>
        <div className="economy-guard-heading">
          <div>
            <span>CONTROLE DE EMISSÃO · SERVIDOR</span>
            <strong>
              {summary.emission.status === "stable"
                ? "ECONOMIA ESTÁVEL"
                : summary.emission.status === "attention"
                  ? "ORÇAMENTO EM ATENÇÃO"
                  : "LIMITE DIÁRIO ATINGIDO"}
            </strong>
          </div>
          <b>{summary.emission.usagePercent}% UTILIZADO</b>
        </div>
        <i>
          <em style={{ width: `${summary.emission.usagePercent}%` }} />
        </i>
        <div className="economy-guard-metrics">
          <article>
            <span>PODER CONCEDIDO HOJE</span>
            <strong>
              {summary.emission.usedPowerGh.toLocaleString("pt-BR")} GH/s
            </strong>
          </article>
          <article>
            <span>ORÇAMENTO RESTANTE</span>
            <strong>
              {summary.emission.remainingPowerGh.toLocaleString("pt-BR")} GH/s
            </strong>
          </article>
          <article>
            <span>LIMITE DIÁRIO</span>
            <strong>
              {summary.emission.budgetPowerGh.toLocaleString("pt-BR")} GH/s
            </strong>
          </article>
          <article>
            <span>REINÍCIO DO CICLO</span>
            <strong>
              {new Date(summary.emission.resetAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>
          </article>
        </div>
        <p>
          O servidor reduz automaticamente apenas a parte da recompensa que
          ultrapassaria o orçamento. Pontuação, nível e conquistas continuam
          contando normalmente.
        </p>
      </div>

      <div className="operator-career-panel">
        <article className="operator-league-card">
          <span>LIGA DO OPERADOR</span>
          <strong>{summary.operator.league.name}</strong>
          <p>
            {summary.operator.league.nextName
              ? `Próxima divisão: ${summary.operator.league.nextName}`
              : "Divisão máxima alcançada"}
          </p>
          <i>
            <em
              style={{ width: `${summary.operator.league.progressPercent}%` }}
            />
          </i>
          <small>
            Progressão competitiva sem prêmio econômico nesta fase.
          </small>
        </article>

        <div className="operator-achievements">
          <div>
            <span>CONQUISTAS DE CARREIRA</span>
            <small>Marcos permanentes calculados pelo servidor.</small>
          </div>
          <section>
            {summary.achievements.map((achievement) => {
              const complete = achievement.current >= achievement.target;
              return (
                <article
                  className={complete ? "complete" : ""}
                  key={achievement.id}
                >
                  <b>{complete ? "✓" : "◇"}</b>
                  <div>
                    <strong>{achievement.label}</strong>
                    <p>{achievement.description}</p>
                  </div>
                  <span>
                    {achievement.current}/{achievement.target}
                  </span>
                </article>
              );
            })}
          </section>
        </div>
      </div>
    </section>
  );
}
