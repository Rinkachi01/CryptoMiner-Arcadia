"use client";

import { useEffect, useState } from "react";

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

export function OperatorProgressPanel({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("Carregando progresso...");

  useEffect(() => {
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
  }, [refreshKey]);

  if (!summary) {
    return (
      <section className="operator-progress-panel loading" aria-live="polite">
        {message}
      </section>
    );
  }

  return (
    <section className="operator-progress-panel">
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

      <div className="daily-mission-panel">
        <div>
          <span>MISSÕES DE TELEMETRIA · 24H</span>
          <small>Sem prêmio econômico durante a calibração.</small>
        </div>
        {summary.missions.map((mission) => {
          const complete = mission.current >= mission.target;
          return (
            <article className={complete ? "complete" : ""} key={mission.id}>
              <span>{complete ? "✓" : "○"}</span>
              <div>
                <strong>{mission.label}</strong>
                <i>
                  <em
                    style={{
                      width: `${Math.min(
                        100,
                        (mission.current / mission.target) * 100,
                      )}%`,
                    }}
                  />
                </i>
              </div>
              <b>
                {mission.current}/{mission.target}
              </b>
            </article>
          );
        })}
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
