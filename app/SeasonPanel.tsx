"use client";

import { useEffect, useState } from "react";
import { useArcadiaLanguage } from "./i18n";
import {
  seasonPremiumMaxPriceCma,
  seasonXpRequiredForLevel,
  isSeasonRewardUnlocked,
  isSeasonTrackUnlocked,
  seasonLevelsForCampaign,
  seasonPricePolicyForCampaign,
  type SeasonReward,
} from "./season-rules";
import { dailyWindowIndex, dailyWindowKey } from "./daily-reset-rules";
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
  welcomePass?: boolean;
};

function remainingLabel(endsAt: number, now: number, english = false) {
  const remaining = Math.max(0, endsAt - now);
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining / (60 * 60 * 1000)) % 24);
  return days > 0
    ? `${days}d ${hours}h ${english ? "left" : "restantes"}`
    : `${hours}h ${english ? "left" : "restantes"}`;
}

// The API keeps durationDays for compatibility with existing season snapshots;
// the welcome-pass UI intentionally hides the countdown for this campaign.

export function SeasonPanel({
  onRefreshAccount,
  refreshKey,
  stagingVisuals = false,
}: {
  onRefreshAccount: () => Promise<boolean>;
  refreshKey: number;
  stagingVisuals?: boolean;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const [data, setData] = useState<SeasonResponse | null>(null);
  const [message, setMessage] = useState(english ? "Loading season..." : "Carregando temporada...");
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
          throw new Error(result.error ?? (english ? "Season unavailable." : "Temporada indisponível."));
        }
        return result;
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
            : english ? "Unable to load the season." : "Não foi possível carregar a temporada.",
        );
      });
    return () => controller.abort();
  }, [refreshKey, english]);

  async function runAction(
    id: string,
    body: {
      action: string;
      level?: number;
      track?: "free" | "premium";
      questId?: string;
      cycleKey?: string;
    },
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
      if (!response.ok) throw new Error(result.error ?? (english ? "Action rejected." : "Ação recusada."));
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
      setMessage(result.message ?? (english ? "Season updated." : "Temporada atualizada."));
      if (body.action !== "daily-login") await onRefreshAccount();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : english ? "Unable to complete the action." : "Não foi possível concluir.",
      );
    } finally {
      setBusyAction("");
    }
  }

  // The player view must follow the active season. Drafts are founder previews
  // and must never replace an active campaign in the public pass UI.
  const presentedSeason = data?.season ?? null;

  if (!data || !presentedSeason) {
    return (
      <section className="season-panel loading" aria-live="polite">
        {message || (english ? "Waiting for the next season." : "Aguardando a próxima temporada.")}
      </section>
    );
  }

  const season = presentedSeason;
  const isSpaceRace = season.campaignSlug === "space-race-01";
  // Production keeps the welcome pass enabled even if an older cached API
  // response omits the optional flag. Staging still follows the API exactly.
  const welcomePass = Boolean(data.welcomePass || (isSpaceRace && !stagingVisuals));
  const seasonLevels = season.levels ?? seasonLevelsForCampaign(season.campaignSlug);
  const progress: SeasonPlayerProgress = data.playerProgress ?? {
    claimedRewardKeys: [],
    level: 1,
    maxUnlocked: false,
    nextLevelXp: seasonXpRequiredForLevel(2),
    premiumUnlocked: false,
    welcomeBundleClaimed: false,
    dailyLogin: {
      claimedToday: false,
      cycleDay: 1,
      nextXp: 20,
      schedule: [20, 30, 40, 50, 60, 80, 100],
      streakDays: 0,
    },
    sources: { bonus: 0, games: 0, logins: 0, missions: 0, spending: 0 },
    quests: { daily: [], weekly: [] },
    xp: 0,
  };
  const rewards = data.rewards ?? [];
  const rewardCount = rewards.filter((reward) => welcomePass ? true : reward.track === "free").length;
  const currentLevelStart = seasonXpRequiredForLevel(progress.level || 1, seasonLevels);
  const levelProgress =
    progress.level >= seasonLevels
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

  const dailyCycleKey = `daily_${dailyWindowKey(data.serverTime)}`;
  const seasonStartDay = dailyWindowIndex(season.startsAt);
  const currentDay = dailyWindowIndex(data.serverTime);
  const weeklyCycleKey = `weekly_${Math.floor((currentDay - seasonStartDay) / 7)}`;
  const weeklyQuests = progress.quests?.weekly ?? [];
  const featuredWeeklyQuest =
    weeklyQuests.find((entry) => !entry.claimed) ?? weeklyQuests[0] ?? null;
  const featuredWeeklyPercent = featuredWeeklyQuest
    ? Math.min(
        100,
        Math.round(
          (featuredWeeklyQuest.progress /
            Math.max(1, featuredWeeklyQuest.quest.requirement)) *
            100,
        ),
      )
    : 0;
  const campaignLabel = isSpaceRace
    ? english ? "SEASON 01 · SPACE RACE" : "TEMPORADA 01 · CORRIDA ESPACIAL"
    : season.name.toUpperCase();
  const campaignHeadline = welcomePass
    ? english ? "Play, progress and claim the welcome rewards" : "Jogue, avance e resgate as recompensas de boas-vindas"
    : isSpaceRace
      ? english ? "Validated progress in Deep Space" : "Progresso validado no Espaço Profundo"
      : season.name;
  const campaignDescription = isSpaceRace
    ? english
      ? "Validated rounds, missions and limited CMA spending generate XP."
      : "Partidas validadas, missões e gastos limitados em CMA geram XP."
    : english
      ? "Validated rounds and missions advance your seasonal rewards."
      : "Partidas e missões validadas fazem você avançar nas recompensas da temporada.";

  return (
    <section className={`season-panel space-race-season${stagingVisuals ? " season-panel-staging" : ""}`}>
      <div className="season-banner-shell">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="season-banner-image"
          src={season.bannerPath || "/assets/seasons/alchemy/banner.png"}
          alt={season.name}
          loading="eager"
          decoding="async"
        />
      </div>
      <header className="space-race-hero">
        <div>
          <span>{welcomePass ? english ? "WELCOME PASS" : "PASSE DE BOAS-VINDAS" : campaignLabel}</span>
          <h3>{campaignHeadline}</h3>
          <p>{campaignDescription}</p>
        </div>
        <aside>
          <strong>{english ? "LEVEL" : "NÍVEL"} {progress.level}</strong>
          <span>{progress.xp.toLocaleString("pt-BR")} XP</span>
          {welcomePass ? <small>{english ? "Limited welcome campaign" : "Campanha de boas-vindas limitada"}</small> : <small>{remainingLabel(season.endsAt, data.serverTime, english)}</small>}
        </aside>
      </header>

      <div className="space-race-progress">
        <div><span>{english ? "LEVEL PROGRESS" : "PROGRESSO DO NÍVEL"}</span><strong>{levelProgress}%</strong></div>
        <i><em style={{ width: `${levelProgress}%` }} /></i>
        <small>{progress.level >= seasonLevels ? english ? "Track complete" : "Trilha concluída" : `${Math.max(0, progress.nextLevelXp - progress.xp).toLocaleString(english ? "en-US" : "pt-BR")} XP ${english ? "to the next level" : "até o próximo nível"}`}</small>
      </div>

      {welcomePass && (
        <section className="season-welcome-xp-card" aria-label={english ? "Welcome XP bundle" : "Bundle XP de boas-vindas"}>
          <div>
            <span>{english ? "WELCOME BUNDLE" : "BUNDLE DE BOAS-VINDAS"}</span>
            <strong>{english ? "+300 XP for this pass" : "+300 XP para este passe"}</strong>
            <small>{english ? "One claim per account. It is linked only to the current welcome season." : "Um resgate por conta. Vinculado somente a esta temporada de boas-vindas."}</small>
          </div>
          <button
            type="button"
            disabled={progress.welcomeBundleClaimed || Boolean(busyAction)}
            onClick={() => void runAction("claim-welcome-xp", { action: "claim-welcome-xp" })}
          >
            {progress.welcomeBundleClaimed
              ? english ? "CLAIMED" : "RESGATADO"
              : english ? "CLAIM BUNDLE" : "RESGATAR BUNDLE"}
          </button>
        </section>
      )}

      {/* MISSÕES DIÁRIAS and weekly quests remain the XP source; only the old battery claim was removed. */}
      {/* Giveaways semanais are intentionally not part of the season economy. */}
      {/* RANKING DE XP stays out of the player-facing season interface by design. */}
      <section className="season-track-card">
        <header>
          <div><span>{welcomePass ? english ? "WELCOME REWARDS" : "RECOMPENSAS DE BOAS-VINDAS" : english ? "SEASON REWARDS" : "RECOMPENSAS DA TEMPORADA"}</span><h4>{welcomePass ? english ? `Free pass · ${rewardCount} rewards` : `Passe gratuito · ${rewardCount} recompensas` : english ? "Free + Premium" : "Gratuita + Premium"}</h4></div>
          <div className="season-pass-purchase-actions">
            {error && <span style={{ color: "#ef4444", fontSize: "0.75rem", maxWidth: "200px", textAlign: "right", lineHeight: 1.2 }}>{error}</span>}
            {welcomePass ? (
              <strong className="season-premium-owned">{english ? "WELCOME PASS · FREE" : "PASSE DE BOAS-VINDAS · GRATUITO"}</strong>
            ) : progress.maxUnlocked ? (
              <strong className="season-max-owned">{english ? "ORBIT PASS MAX ACTIVE" : "ORBIT PASS MAX ATIVO"}</strong>
            ) : progress.premiumUnlocked ? (
              <strong className="season-premium-owned">{english ? "PREMIUM UNLOCKED" : "PREMIUM LIBERADO"}</strong>
            ) : (
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => void runAction("buy-premium", { action: "buy-premium" })}
                style={{ background: "#2a3845", color: "#e2e8f0" }}
              >
                {`${english ? "BASIC" : "BÁSICO"} · ${season.premiumPriceCma} CMA`}
              </button>
            )}
            {!welcomePass && !progress.maxUnlocked && (() => {
              const dynamicPrice = seasonPremiumMaxPriceCma(
                progress.level,
                progress.premiumUnlocked,
                seasonPricePolicyForCampaign(season.campaignSlug),
                seasonLevels,
              );
              return (
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => void runAction("buy-premium-max", { action: "buy-premium-max" })}
                  className="btn-max-upgrade"
                >
                  {progress.premiumUnlocked
                    ? `${english ? "UPGRADE MAX" : "UPGRADE MAX"} · ${dynamicPrice} CMA`
                    : `${english ? "MAX · FULL TRACK" : "MAX · TRILHA COMPLETA"} · ${dynamicPrice} CMA`}
                </button>
              );
            })()}
          </div>
        </header>
        <div className="season-pass-lanes">
          {(welcomePass ? ["welcome"] : ["free", "premium"] as const).map((track) => (
            <section className={`season-pass-lane ${track}`} key={track}>
              <header>
                <span>{track === "welcome" ? english ? "WELCOME PASS · FREE" : "PASSE DE BOAS-VINDAS · GRATUITO" : track === "premium" ? `${isSpaceRace ? "ORBIT PASS" : season.name} · PREMIUM` : english ? "FREE PASS" : "FREE PASS · GRATUITO"}</span>
                <small>{track === "welcome" ? english ? `All ${rewardCount} rewards are available to every operator.` : `As ${rewardCount} recompensas estão disponíveis para todos os operadores.` : track === "premium" ? english ? "Rare miners and more temporary power" : "Mineradores raros e maior poder temporário" : english ? "Essential rewards for everyone" : "Recompensas essenciais para todos"}</small>
              </header>
              <div className="season-reward-grid">
                {rewards.filter((reward) => track === "welcome" || reward.track === track).map((reward) => {
                  const key = `${reward.claimTrack ?? reward.track}:${reward.claimLevel ?? reward.level}`;
                  const claimed = progress.claimedRewardKeys?.includes(key) ?? false;
                  const unlocked = isSeasonRewardUnlocked(
                    progress.level || 1,
                    reward.level,
                    progress.maxUnlocked,
                  );
                  const premiumBlocked = welcomePass
                    ? false
                    : !isSeasonTrackUnlocked(reward.track, progress.premiumUnlocked, progress.maxUnlocked);
                  return (
                    <article className={`${reward.track} ${reward.reward.type} ${unlocked ? "unlocked" : "locked"}`} key={key}>
                      <span>{english ? "LEVEL" : "NÍVEL"} {reward.level}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reward.asset} alt="" />
                      <strong>{reward.title}</strong>
                      <small>{reward.reward.type === "miner" ? english ? "MINER" : "MINERADOR" : reward.reward.type === "battery" ? english ? "BATTERY" : "BATERIA" : reward.reward.type === "rack" ? "RACK" : reward.reward.type === "parts" ? english ? "PARTS" : "PEÇAS" : reward.reward.type === "season_currency" ? "AMC" : english ? "TEMPORARY POWER" : "PODER TEMPORÁRIO"}</small>
                      <button
                        type="button"
                        disabled={claimed || !unlocked || premiumBlocked || Boolean(busyAction)}
                        onClick={() => void runAction(`claim-${key}`, { action: "claim-reward", level: reward.level, track: reward.track })}
                      >
                        {claimed
                          ? english ? "CLAIMED" : "RESGATADO"
                          : premiumBlocked
                            ? "PREMIUM"
                            : unlocked
                              ? progress.maxUnlocked && progress.level < reward.level
                                ? english ? "CLAIM · MAX" : "RESGATAR · MAX"
                                : english ? "CLAIM" : "RESGATAR"
                              : `${english ? "LEVEL" : "NÍVEL"} ${reward.level}`}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="season-weekly-challenge-card" aria-label={english ? "Weekly challenge" : "Desafio semanal"}>
        <div className="season-weekly-challenge-copy">
          <span>{english ? "WEEKLY SIGNAL" : "DESAFIO SEMANAL"}</span>
          <h4>{english ? "One focused objective" : "Um objetivo em destaque"}</h4>
          <p>
            {english
              ? "Complete the highlighted mission before the weekly reset. XP is server-validated and shared by both tracks."
              : "Conclua a missao em destaque antes da virada semanal. O XP e validado pelo servidor e vale para as duas trilhas."}
          </p>
        </div>
        {featuredWeeklyQuest ? (
          <div className="season-weekly-challenge-progress">
            <strong>{featuredWeeklyQuest.quest.title}</strong>
            <small>
              {featuredWeeklyQuest.progress}/{featuredWeeklyQuest.quest.requirement} · +{featuredWeeklyQuest.quest.xp} XP
            </small>
            <i aria-hidden="true"><em style={{ width: `${featuredWeeklyPercent}%` }} /></i>
            <button
              type="button"
              disabled={!featuredWeeklyQuest.completed || featuredWeeklyQuest.claimed || Boolean(busyAction)}
              onClick={() => void runAction(`featured-${featuredWeeklyQuest.quest.id}`, {
                action: "claim-quest",
                questId: featuredWeeklyQuest.quest.id,
                cycleKey: weeklyCycleKey,
              })}
            >
              {featuredWeeklyQuest.claimed
                ? english ? "CLAIMED" : "RESGATADO"
                : featuredWeeklyQuest.completed
                  ? english ? "CLAIM XP" : "RESGATAR XP"
                  : english ? "IN PROGRESS" : "EM PROGRESSO"}
            </button>
          </div>
        ) : (
          <strong className="season-weekly-challenge-empty">
            {english ? "New signal soon" : "Novo desafio em breve"}
          </strong>
        )}
      </section>

      <section id="season-missions" className="season-quests-card" aria-label={english ? "Season missions" : "Missões da temporada"}>
        <header>
          <div>
            <span>{english ? "SEASON MISSIONS" : "MISSÕES DA TEMPORADA"}</span>
            <h4>{english ? "Play, progress and claim XP" : "Jogue, avance e resgate XP"}</h4>
          </div>
          <small>{english ? "XP is shared between the free and premium tracks." : "O XP é compartilhado entre as trilhas gratuita e premium."}</small>
        </header>
        <div className="season-quests-grid">
          {(["daily", "weekly"] as const).map((period) => {
            const quests = progress.quests?.[period] ?? [];
            const cycleKey = period === "daily" ? dailyCycleKey : weeklyCycleKey;
            return (
              <section className="season-quest-group" key={period}>
                <div className="season-quest-group-heading">
                  <strong>{period === "daily" ? english ? "DAILY" : "DIÁRIAS" : english ? "WEEKLY" : "SEMANAIS"}</strong>
                  <small>{period === "daily" ? english ? "Resets every day" : "Reinicia a cada dia" : english ? "Resets every week" : "Reinicia a cada semana"}</small>
                </div>
                {quests.map((entry) => {
                  const percent = Math.min(100, Math.round((entry.progress / Math.max(1, entry.quest.requirement)) * 100));
                  const busy = busyAction === `quest-${entry.quest.id}`;
                  return (
                    <article className={entry.completed ? "complete" : ""} key={entry.quest.id}>
                      <div className="season-quest-copy">
                        <strong>{entry.quest.title}</strong>
                        <small>{entry.progress}/{entry.quest.requirement} · +{entry.quest.xp} XP</small>
                        <i><em style={{ width: `${percent}%` }} /></i>
                      </div>
                      <button
                        type="button"
                        disabled={!entry.completed || entry.claimed || Boolean(busyAction)}
                        onClick={() => void runAction(`quest-${entry.quest.id}`, { action: "claim-quest", questId: entry.quest.id, cycleKey })}
                      >
                        {entry.claimed ? english ? "CLAIMED" : "RESGATADO" : busy ? english ? "VALIDATING..." : "VALIDANDO..." : entry.completed ? english ? "CLAIM XP" : "RESGATAR XP" : english ? "IN PROGRESS" : "EM PROGRESSO"}
                      </button>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </section>


      {message && <p className="season-action-success" role="status">{message}</p>}
    </section>
  );
}
