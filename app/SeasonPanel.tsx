"use client";

import { useEffect, useState } from "react";
import {
  seasonPremiumMaxPriceCma,
  seasonXpRequiredForLevel,
  spaceRaceRewards,
  type SeasonReward,
} from "./season-rules";
import type {
  PublicSeason,
  PowerLeaderboardEntry,
  SeasonLeaderboardEntry,
  SeasonPlayerProgress,
} from "./season-server";

export type SeasonResponse = {
  competitiveOnly: boolean;
  currentPlayer: SeasonLeaderboardEntry | null;
  draft?: PublicSeason | null;
  error?: string;
  leaderboard: SeasonLeaderboardEntry[];
  message?: string;
  playerProgress: SeasonPlayerProgress | null;
  powerLeaderboard: PowerLeaderboardEntry[];
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
        return {
          ...result,
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
      </section>
    );
  }
  const progress: SeasonPlayerProgress = data.playerProgress ?? {
    claimedRewardKeys: [],
    level: 1,
    maxUnlocked: false,
    nextLevelXp: seasonXpRequiredForLevel(2),
    premiumUnlocked: false,
    dailyLogin: {
      claimedToday: false,
      cycleDay: 1,
      nextXp: 20,
      schedule: [20, 30, 40, 50, 60, 80, 100],
      streakDays: 0,
    },
    sources: { games: 0, logins: 0, missions: 0, spending: 0 },
    quests: { daily: [], weekly: [] },
    xp: 0,
  };
  const rewards = (data.rewards && data.rewards.length > 0) ? data.rewards : spaceRaceRewards;
  const currentLevelStart = seasonXpRequiredForLevel(progress.level || 1);
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
          <p>Login, partidas validadas, missões e gastos limitados em CMA geram XP.</p>
        </div>
        <aside>
          <strong>NÍVEL {progress.level}</strong>
          <span>{progress.xp.toLocaleString("pt-BR")} XP</span>
          <small>{remainingLabel(season.endsAt, data.serverTime)}</small>
        </aside>
      </header>

      <div className="space-race-progress">
        <div><span>PROGRESSO DO NÍVEL</span><strong>{levelProgress}%</strong></div>
        <i><em style={{ width: `${levelProgress}%` }} /></i>
        <small>{progress.level >= 50 ? "Trilha concluída" : `${Math.max(0, progress.nextLevelXp - progress.xp).toLocaleString("pt-BR")} XP até o próximo nível`}</small>
      </div>

      <section className="season-daily-login">
        <header>
          <div><span>LOGIN DIÁRIO</span><h4>Resgate seu XP</h4></div>
          <strong>DIA {progress.dailyLogin.cycleDay} / 7</strong>
        </header>
        <ol className="season-daily-schedule">
          {progress.dailyLogin.schedule.map((xp, index) => {
            const dayNum = index + 1;
            const alreadyClaimed = dayNum < progress.dailyLogin.cycleDay || (dayNum === progress.dailyLogin.cycleDay && progress.dailyLogin.claimedToday);
            const isToday = dayNum === progress.dailyLogin.cycleDay && !progress.dailyLogin.claimedToday;
            return (
              <li key={dayNum} className={`${alreadyClaimed ? "claimed" : ""} ${isToday ? "current" : ""}`}>
                <small>DIA {dayNum}</small>
                <strong>+{xp}</strong>
                <span>XP</span>
              </li>
            );
          })}
        </ol>
        <div className="season-daily-actions">
          <span>Sequência: {progress.dailyLogin.streakDays} {progress.dailyLogin.streakDays === 1 ? "dia" : "dias"} seguidos</span>
          <button
            type="button"
            disabled={progress.dailyLogin.claimedToday || Boolean(busyAction)}
            onClick={() => void runAction("daily-login", { action: "daily-login" })}
          >
            {progress.dailyLogin.claimedToday ? "XP DO DIA RESGATADO ✓" : `RESGATAR +${progress.dailyLogin.nextXp} XP`}
          </button>
        </div>
      </section>

      <section className="season-track-card">
        <header>
          <div><span>TRILHA DE RECOMPENSAS</span><h4>Gratuita + Premium</h4></div>
          <div className="season-pass-purchase-actions">
            {error && <span style={{ color: "#ef4444", fontSize: "0.75rem", maxWidth: "200px", textAlign: "right", lineHeight: 1.2 }}>{error}</span>}
            {progress.maxUnlocked ? (
              <strong className="season-max-owned">ORBIT PASS MAX ATIVO</strong>
            ) : progress.premiumUnlocked ? (
              <strong className="season-premium-owned">PREMIUM LIBERADO</strong>
            ) : (
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => void runAction("buy-premium", { action: "buy-premium" })}
                style={{ background: "#2a3845", color: "#e2e8f0" }}
              >
                {`BÁSICO · ${season.premiumPriceCma} CMA`}
              </button>
            )}
            {!progress.maxUnlocked && (() => {
              const dynamicPrice = seasonPremiumMaxPriceCma(
                progress.level,
                progress.premiumUnlocked,
              );
              return (
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => void runAction("buy-premium-max", { action: "buy-premium-max" })}
                  className="btn-max-upgrade"
                >
                  {progress.premiumUnlocked
                    ? `UPGRADE MAX · ${dynamicPrice} CMA`
                    : `MAX · TRILHA COMPLETA · ${dynamicPrice} CMA`}
                </button>
              );
            })()}
          </div>
        </header>
        <div className="season-pass-lanes">
          {(["premium", "free"] as const).map((track) => (
            <section className={`season-pass-lane ${track}`} key={track}>
              <header>
                <span>{track === "premium" ? "ORBIT PASS · PREMIUM" : "FREE PASS · GRATUITO"}</span>
                <small>{track === "premium" ? "Mineradores raros e maior poder temporário" : "Recompensas essenciais para todos"}</small>
              </header>
              <div className="season-reward-grid">
                {rewards.filter((reward) => reward.track === track).map((reward) => {
                  const key = `${reward.track}:${reward.level}`;
                  const claimed = progress.claimedRewardKeys?.includes(key) ?? false;
                  const unlocked =
                    (progress.level || 1) >= reward.level ||
                    (reward.track === "premium" && progress.maxUnlocked);
                  const premiumBlocked =
                    reward.track === "premium" &&
                    !progress.premiumUnlocked &&
                    !progress.maxUnlocked;
                  return (
                    <article className={`${reward.track} ${reward.reward.type} ${unlocked ? "unlocked" : "locked"}`} key={key}>
                      <span>NÍVEL {reward.level}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reward.asset} alt="" />
                      <strong>{reward.title}</strong>
                      <small>{reward.reward.type === "miner" ? "MINERADOR" : reward.reward.type === "battery" ? "BATERIA" : "ENERGIA TEMPORÁRIA"}</small>
                      <button
                        type="button"
                        disabled={claimed || !unlocked || premiumBlocked || Boolean(busyAction)}
                        onClick={() => void runAction(`claim-${key}`, { action: "claim-reward", level: reward.level, track: reward.track })}
                      >
                        {claimed
                          ? "RESGATADO"
                          : premiumBlocked
                            ? "PREMIUM"
                            : unlocked
                              ? progress.maxUnlocked && reward.track === "premium" && progress.level < reward.level
                                ? "RESGATAR · MAX"
                                : "RESGATAR"
                              : `NÍVEL ${reward.level}`}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="season-community-grid">
        <article className="season-ranking-card">
          <header>
            <div><span>RANKING DE XP</span><h4>Operadores da temporada</h4></div>
            <small>{data.currentPlayer ? `SUA POSIÇÃO · #${data.currentPlayer.rank}` : "ENTRE JOGANDO"}</small>
          </header>
          <ol>
            {data.leaderboard.length === 0 ? (
              <li className="empty">O ranking começa na primeira atividade validada.</li>
            ) : data.leaderboard.slice(0, 5).map((entry) => (
              <li key={entry.accountId}>
                <b>{String(entry.rank).padStart(2, "0")}</b>
                <span>{entry.displayName}</span>
                <strong>{entry.score.toLocaleString("pt-BR")} XP</strong>
              </li>
            ))}
          </ol>
        </article>
        <article className="season-giveaway-card">
          <header>
            <div><span>GIVEAWAYS SEMANAIS</span><h4>Sorteios da comunidade</h4></div>
            <small>SEM ALTERAR BLOCOS</small>
          </header>
          <p>
            Participações futuras serão vinculadas à atividade legítima da semana.
            Nenhum sorteio aumenta a emissão de CMA, BTC, DOGE ou LTC.
          </p>
          <div>
            <span>PRÓXIMA JANELA</span>
            <strong>DOMINGO · 23:59 UTC</strong>
          </div>
        </article>
      </section>


      {message && <p className="season-action-success" role="status">{message}</p>}
    </section>
  );
}
