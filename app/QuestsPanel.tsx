"use client";

import { useEffect, useState } from "react";
import type { SeasonPlayerProgress, PublicSeason } from "./season-server";
import type { SeasonResponse } from "./SeasonPanel";

export function QuestsPanel({
  onRefreshAccount,
  refreshKey,
}: {
  onRefreshAccount: () => Promise<boolean>;
  refreshKey: number;
}) {
  const [data, setData] = useState<{
    playerProgress: SeasonPlayerProgress | null;
    season: PublicSeason | null;
    serverTime: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/season", { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((result: unknown) => {
        if (!controller.signal.aborted) {
          const payload = result as SeasonResponse;
          setData({
            playerProgress: payload.playerProgress,
            season: payload.season,
            serverTime: payload.serverTime,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [refreshKey]);

  async function handleClaimQuest(questId: string, cycleKey: string) {
    setBusyAction(questId);
    setMessage("");
    try {
      const response = await fetch("/api/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim-quest",
          questId,
          cycleKey,
        }),
      });
      const result = (await response.json()) as SeasonResponse & {
        error?: string;
        message?: string;
      };
      if (response.ok) {
        setMessage(result.message ?? "Quest concluída!");
        setData(result);
        await onRefreshAccount();
      } else {
        setMessage(result.error ?? "Erro ao resgatar quest.");
      }
    } catch {
      setMessage("Erro de conexão.");
    } finally {
      setBusyAction("");
    }
  }

  if (!data || !data.season || data.season.status !== "active") {
    return (
      <section className="quests-panel empty">
        <p>Carregando missões da temporada...</p>
      </section>
    );
  }

  const quests = data.playerProgress?.quests;
  if (!quests) {
    return (
      <section className="quests-panel empty">
        <p>As missões não estão disponíveis no momento.</p>
      </section>
    );
  }

  const activeQuests = (activeTab === "daily" ? quests?.daily : quests?.weekly) || [];
  
  // Use the server clock returned with the season payload to avoid client drift.
  const now = data.serverTime;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const cycleKey = activeTab === "daily" 
    ? `daily_${Math.floor(now / DAY_MS)}` 
    : `weekly_${Math.floor(now / (7 * DAY_MS))}`;

  return (
    <section className="quests-panel">
      <header className="quests-header">
        <div>
          <h2>Quests e Missões</h2>
          <p>Complete tarefas para ganhar XP extra para o seu Passe de Temporada.</p>
        </div>
        <div className="tabs">
          <button
            type="button"
            className={activeTab === "daily" ? "active" : ""}
            onClick={() => setActiveTab("daily")}
          >
            Diárias
          </button>
          <button
            type="button"
            className={activeTab === "weekly" ? "active" : ""}
            onClick={() => setActiveTab("weekly")}
          >
            Semanais
          </button>
        </div>
      </header>

      {message && (
        <div className="message-banner">
          {message}
        </div>
      )}

      <div className="quests-list">
        {activeQuests.map((q, idx) => {
          const { quest, progress, completed, claimed } = q || {};
          if (!quest) return null;
          const percent = Math.min(100, Math.round(((progress || 0) / (quest.requirement || 1)) * 100));
          
          return (
            <article key={quest.id || idx} className={`quest-card ${claimed ? "claimed" : completed ? "completed" : ""}`}>
              <div className="quest-info">
                <h3>{quest.title}</h3>
                <div className="progress-bar-container">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="progress-text">
                    {progress || 0} / {quest.requirement}
                  </span>
                </div>
              </div>
              <div className="quest-action">
                <div className="xp-reward">+{quest.xp} XP</div>
                <button
                  type="button"
                  className="action-button"
                  disabled={claimed || !completed || Boolean(busyAction)}
                  onClick={() => void handleClaimQuest(quest.id, cycleKey)}
                >
                  {claimed ? "RESGATADO" : completed ? "COLETAR" : "INCOMPLETA"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

    </section>
  );
}
