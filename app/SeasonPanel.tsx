"use client";

import { useEffect, useState } from "react";
import {
  seasonXpRequiredForLevel,
  spaceRaceRewards,
  type SeasonReward,
} from "./season-rules";
import type {
  PublicSeason,
  SeasonLeaderboardEntry,
  SeasonPlayerProgress,
} from "./season-server";

type SeasonResponse = {
  competitiveOnly: boolean;
  currentPlayer: SeasonLeaderboardEntry | null;
  draft?: PublicSeason | null;
  error?: string;
  leaderboard: SeasonLeaderboardEntry[];
  message?: string;
  playerProgress: SeasonPlayerProgress | null;
  rewardNotice: string;
  rewards: SeasonReward[];
  season: PublicSeason | null;
  serverTime: number;
};

function remainingLabel(endsAt: number, now: number) {
  const remaining = Math.max(0, endsAt - now);
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining / (60 * 60 * 1000)) % 24);
  return days > 0 ? `${days}d ${hours}h restantes` : `${hours}h restantes`;
}

export function SeasonPanel({
  onRefreshAccount,
  refreshKey,
}: {
  onRefreshAccount: () => Promise<boolean>;
  refreshKey: number;
}) {
  const [data, setData] = useState<SeasonResponse | null>(null);
  const [message, setMessage] = useState("Carregando temporada...");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

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
        if (
          result.season?.campaignSlug !== "space-race-01" ||
          result.season.status !== "active"
        ) return result;
        const loginResponse = await fetch("/api/season", {
          body: JSON.stringify({ action: "daily-login" }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const loginResult = (await loginResponse.json()) as SeasonResponse;
        if (!loginResponse.ok) {
          throw new Error(loginResult.error ?? "O XP diário não foi registrado.");
        }
        return {
          ...result,
          ...loginResult,
          competitiveOnly: false,
          rewardNotice: result.rewardNotice,
        };
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setMessage("");
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setMessage(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar a temporada.",
        );
      });
    return () => controller.abort();
  }, [refreshKey]);

  async function runAction(
    id: string,
    body: { action: string; level?: number; track?: "free" | "premium" },
  ) {
    setBusyAction(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/season", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as SeasonResponse;
      if (!response.ok) throw new Error(result.error ?? "Ação recusada.");
      setData((current) =>
        current
          ? {
              ...current,
              ...result,
              competitiveOnly: false,
              rewardNotice: current.rewardNotice,
            }
          : result,
      );
      setMessage(result.message ?? "Temporada atualizada.");
      if (body.action !== "daily-login") await onRefreshAccount();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível concluir.",
      );
    } finally {
      setBusyAction("");
    }
  }

  const presentedSeason =
    data?.season?.campaignSlug === "space-race-01"
      ? data.season
      : data?.draft ?? data?.season ?? null;

  if (!data || !presentedSeason) {
    return (
      <section className="season-panel loading" aria-live="polite">
        {message || "Aguardando a próxima temporada."}
      </section>
    );
  }

  const season = presentedSeason;
  const isSpaceRace = season.campaignSlug === "space-race-01";
  if (!isSpaceRace) {
    return (
      <section className={`season-panel ${season.status}`}>
        <div className="season-summary-card">
          <span>{season.status === "active" ? "TEMPORADA ATIVA" : "TEMPORADA ENCERRADA"}</span>
          <h3>{season.name}</h3>
          <p>Dispute posições completando partidas validadas pelo servidor.</p>
          <div className="season-progress">
            <i><em style={{ width: `${season.progressPercent}%` }} /></i>
            <span>{season.progressPercent}% do ciclo</span>
            <strong>{season.status === "active" ? remainingLabel(season.endsAt, data.serverTime) : "Ciclo finalizado"}</strong>
          </div>
          <div className="season-player-rank">
            <span>SUA POSIÇÃO</span>
            <strong>{data.currentPlayer ? `#${data.currentPlayer.rank}` : "—"}</strong>
            <div>
              <b>{data.currentPlayer?.score.toLocaleString("pt-BR") ?? 0} pontos</b>
              <small>{data.currentPlayer ? `${data.currentPlayer.wins} vitórias em ${data.currentPlayer.plays} partidas` : "Complete uma partida para entrar no ranking"}</small>
            </div>
          </div>
          <small className="season-no-reward">{data.rewardNotice}</small>
        </div>
        <SeasonRanking data={data} />
      </section>
    );
  }

  const isPreview = season.status === "draft";
  const progress: SeasonPlayerProgress = data.playerProgress ?? {
    claimedRewardKeys: [],
    level: 1,
    nextLevelXp: seasonXpRequiredForLevel(2),
    premiumUnlocked: false,
    sources: { games: 0, logins: 0, missions: 0, spending: 0 },
    xp: 0,
  };
  const rewards = data.rewards.length > 0 ? data.rewards : spaceRaceRewards;
  const currentLevelStart = seasonXpRequiredForLevel(progress.level);
  const levelProgress =
    progress.level >= 50
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((progress.xp - currentLevelStart) /
                Math.max(1, progress.nextLevelXp - currentLevelStart)) *
                100,
            ),
          ),
        );

  return (
    <section className="season-panel space-race-season">
      <header className="space-race-hero">
        <div>
          <span>TEMPORADA 01 · CORRIDA ESPACIAL</span>
          <h3>{season.durationDays} dias para alcançar o Espaço Profundo</h3>
          <p>Login, partidas validadas, missões e gastos limitados em CMA geram XP. Sorteios semanais complementam a trilha sem alterar o valor dos blocos.</p>
        </div>
        <aside>
          <strong>{isPreview ? "PROGRAMADA" : `NÍVEL ${progress.level}`}</strong>
          <span>{isPreview ? "50 NÍVEIS" : `${progress.xp.toLocaleString("pt-BR")} XP`}</span>
          <small>{isPreview ? `${season.durationDays} dias após a ativação` : remainingLabel(season.endsAt, data.serverTime)}</small>
        </aside>
      </header>

      <div className="space-race-progress">
        <div><span>PROGRESSO DO NÍVEL</span><strong>{levelProgress}%</strong></div>
        <i><em style={{ width: `${levelProgress}%` }} /></i>
        <small>{isPreview ? "O XP começa somente quando o fundador ativar a temporada" : progress.level >= 50 ? "Trilha concluída" : `${Math.max(0, progress.nextLevelXp - progress.xp).toLocaleString("pt-BR")} XP até o próximo nível`}</small>
      </div>

      <div className="season-xp-sources">
        <article><span>LOGIN</span><strong>{progress.sources.logins} XP</strong><small>50 por dia</small></article>
        <article><span>MINIGAMES</span><strong>{progress.sources.games} XP</strong><small>até 5 por dia</small></article>
        <article><span>MISSÕES</span><strong>{progress.sources.missions} XP</strong><small>marcos diários e semanais</small></article>
        <article><span>LOJA</span><strong>{progress.sources.spending} XP</strong><small>limite de 50 XP/dia</small></article>
      </div>

      <section className="season-giveaway-card">
        <header>
          <div><span>SORTEIOS DA TEMPORADA</span><h4>Giveaways semanais</h4></div>
          <strong>{isPreview ? "ABREM COM A TEMPORADA" : "RODADA SEMANAL"}</strong>
        </header>
        <div>
          <article><b>01</b><strong>Jogue</strong><span>1 bilhete a cada 5 minigames concluídos no dia.</span></article>
          <article><b>02</b><strong>Mantenha a sequência</strong><span>7 logins seguidos liberam um bilhete adicional.</span></article>
          <article><b>03</b><strong>Prêmios da rodada</strong><span>Minerador sazonal, baterias e poder temporário.</span></article>
        </div>
        <small>Bilhetes são pessoais, expiram ao fim de cada rodada e não têm valor de saque.</small>
      </section>

      <section className="season-track-card">
        <header>
          <div><span>TRILHA DE RECOMPENSAS</span><h4>Gratuita + Premium</h4></div>
          {progress.premiumUnlocked ? (
            <strong className="season-premium-owned">PREMIUM LIBERADO</strong>
          ) : (
            <button
              type="button"
              disabled={isPreview || Boolean(busyAction)}
              onClick={() => void runAction("buy-premium", { action: "buy-premium" })}
            >
              {isPreview ? `PREMIUM · ${season.premiumPriceCma} CMA` : `LIBERAR PREMIUM · ${season.premiumPriceCma} CMA`}
            </button>
          )}
        </header>
        <div className="season-reward-grid">
          {rewards.map((reward) => {
            const key = `${reward.track}:${reward.level}`;
            const claimed = progress.claimedRewardKeys.includes(key);
            const unlocked = progress.level >= reward.level;
            const premiumBlocked = reward.track === "premium" && !progress.premiumUnlocked;
            return (
              <article className={`${reward.track} ${unlocked ? "unlocked" : "locked"}`} key={key}>
                <span>NÍVEL {reward.level}</span>
                {/* Seasonal rewards are animated GIF sprites and bypass image optimization intentionally. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reward.asset} alt="" />
                <strong>{reward.title}</strong>
                <small>{reward.track === "free" ? "GRÁTIS" : "PREMIUM"}</small>
                <button
                  type="button"
                  disabled={isPreview || claimed || !unlocked || premiumBlocked || Boolean(busyAction)}
                  onClick={() => void runAction(`claim-${key}`, { action: "claim-reward", level: reward.level, track: reward.track })}
                >
                  {isPreview ? `NÍVEL ${reward.level}` : claimed ? "RESGATADO" : premiumBlocked ? "PREMIUM" : unlocked ? "RESGATAR" : `NÍVEL ${reward.level}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {error && <p className="season-action-error" role="alert">{error}</p>}
      {message && <p className="season-action-success" role="status">{message}</p>}
      {isPreview ? (
        <div className="season-preview-note">
          <strong>CONTAGEM REGRESSIVA SOB CONTROLE DO FUNDADOR</strong>
          <span>Nenhum XP, bilhete, compra Premium ou resgate foi iniciado.</span>
        </div>
      ) : <SeasonRanking data={data} />}
    </section>
  );
}

function SeasonRanking({ data }: { data: SeasonResponse }) {
  return (
    <div className="season-ranking-card">
      <div><span>RANKING DE OPERADORES</span><small>Atualizado pelo servidor</small></div>
      <section>
        {data.leaderboard.length === 0 ? (
          <p>Nenhum operador pontuou neste ciclo.</p>
        ) : (
          data.leaderboard.slice(0, 10).map((entry) => (
            <article className={data.currentPlayer?.accountId === entry.accountId ? "current" : ""} key={entry.accountId}>
              <b>{String(entry.rank).padStart(2, "0")}</b>
              <div><strong>{entry.displayName}</strong><small>Nível {entry.level} · {entry.wins} conclusões</small></div>
              <span>{(entry.xp || entry.score).toLocaleString("pt-BR")} XP</span>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
