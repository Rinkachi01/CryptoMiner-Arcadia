"use client";

import { useEffect, useState } from "react";
import type {
  PublicSeason,
  SeasonLeaderboardEntry,
} from "./season-server";

type SeasonResponse = {
  competitiveOnly: boolean;
  currentPlayer: SeasonLeaderboardEntry | null;
  error?: string;
  leaderboard: SeasonLeaderboardEntry[];
  rewardNotice: string;
  season: PublicSeason | null;
  serverTime: number;
};

function remainingLabel(endsAt: number, now: number) {
  const remaining = Math.max(0, endsAt - now);
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining / (60 * 60 * 1000)) % 24);
  return days > 0 ? `${days}d ${hours}h restantes` : `${hours}h restantes`;
}

export function SeasonPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<SeasonResponse | null>(null);
  const [message, setMessage] = useState("Carregando temporada...");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/season", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as SeasonResponse;
        if (!response.ok) {
          throw new Error(result.error ?? "Temporada indisponível.");
        }
        setData(result);
        setMessage("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a temporada.",
        );
      });
    return () => controller.abort();
  }, [refreshKey]);

  if (!data?.season) {
    return (
      <section className="season-panel loading" aria-live="polite">
        {message || "Aguardando a próxima temporada."}
      </section>
    );
  }

  const season = data.season;
  return (
    <section className={`season-panel ${season.status}`}>
      <div className="season-summary-card">
        <span>
          {season.status === "active"
            ? "TEMPORADA ATIVA"
            : "TEMPORADA ENCERRADA"}
        </span>
        <h3>{season.name}</h3>
        <p>
          Dispute posições completando partidas validadas. Vitórias e
          dificuldade aumentam a pontuação competitiva.
        </p>
        <div className="season-progress">
          <i>
            <em style={{ width: `${season.progressPercent}%` }} />
          </i>
          <span>{season.progressPercent}% do ciclo</span>
          <strong>
            {season.status === "active"
              ? remainingLabel(season.endsAt, data.serverTime)
              : "Ciclo finalizado"}
          </strong>
        </div>
        <div className="season-player-rank">
          <span>SUA POSIÇÃO</span>
          <strong>
            {data.currentPlayer ? `#${data.currentPlayer.rank}` : "—"}
          </strong>
          <div>
            <b>
              {data.currentPlayer?.score.toLocaleString("pt-BR") ?? 0} pontos
            </b>
            <small>
              {data.currentPlayer
                ? `${data.currentPlayer.wins} vitórias em ${data.currentPlayer.plays} partidas`
                : "Complete uma partida para entrar no ranking"}
            </small>
          </div>
        </div>
        <small className="season-no-reward">{data.rewardNotice}</small>
      </div>

      <div className="season-ranking-card">
        <div>
          <span>RANKING COMPETITIVO</span>
          <small>Atualizado pelo servidor</small>
        </div>
        <section>
          {data.leaderboard.length === 0 ? (
            <p>Nenhuma partida concluída nesta temporada.</p>
          ) : (
            data.leaderboard.slice(0, 8).map((entry) => (
              <article
                className={
                  data.currentPlayer?.accountId === entry.accountId
                    ? "current"
                    : ""
                }
                key={entry.accountId}
              >
                <b>{String(entry.rank).padStart(2, "0")}</b>
                <div>
                  <strong>{entry.displayName}</strong>
                  <small>
                    {entry.wins} vitórias · dificuldade {entry.highestDifficulty}
                  </small>
                </div>
                <span>{entry.score.toLocaleString("pt-BR")} pts</span>
              </article>
            ))
          )}
        </section>
      </div>
    </section>
  );
}
