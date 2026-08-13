"use client";

import { useEffect, useState } from "react";
import type { SeasonPlayerProgress, PublicSeason } from "./season-server";

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
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/season", { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
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
      const result = await response.json();
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
  
  // Calculate cycle key based on current time (rough client-side approximation for passing back, server will validate)
  const now = Date.now();
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

      <style jsx>{`
        .quests-panel {
          background: #111;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 30px;
          color: #fff;
        }
        .quests-panel.empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: #888;
        }
        .quests-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 30px;
          border-bottom: 1px solid #333;
          padding-bottom: 20px;
        }
        .quests-header h2 {
          font-size: 24px;
          color: #fff;
          margin: 0 0 5px 0;
        }
        .quests-header p {
          color: #aaa;
          margin: 0;
          font-size: 14px;
        }
        .tabs {
          display: flex;
          gap: 10px;
        }
        .tabs button {
          background: #222;
          color: #aaa;
          border: 1px solid #444;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
          text-transform: uppercase;
          transition: all 0.2s;
        }
        .tabs button:hover {
          background: #333;
          color: #fff;
        }
        .tabs button.active {
          background: #00ff88;
          color: #000;
          border-color: #00ff88;
        }
        .message-banner {
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid #00ff88;
          color: #00ff88;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: bold;
        }
        .quests-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .quest-card {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s;
        }
        .quest-card:hover {
          border-color: #444;
          background: #222;
        }
        .quest-card.completed:not(.claimed) {
          border-color: #00ff88;
          box-shadow: 0 0 10px rgba(0, 255, 136, 0.1);
        }
        .quest-card.claimed {
          opacity: 0.6;
        }
        .quest-info {
          flex: 1;
          padding-right: 20px;
        }
        .quest-info h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #eee;
        }
        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .progress-bar {
          flex: 1;
          height: 8px;
          background: #333;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #00ff88;
          transition: width 0.3s ease;
        }
        .quest-card.claimed .progress-fill {
          background: #666;
        }
        .progress-text {
          font-size: 12px;
          color: #aaa;
          min-width: 60px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .quest-action {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          min-width: 140px;
        }
        .xp-reward {
          color: #00ff88;
          font-weight: 900;
          font-size: 18px;
        }
        .quest-card.claimed .xp-reward {
          color: #666;
        }
        .action-button {
          background: #333;
          color: #888;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 12px;
          cursor: not-allowed;
          width: 100%;
          text-transform: uppercase;
          transition: all 0.2s;
        }
        .quest-card.completed:not(.claimed) .action-button {
          background: #00ff88;
          color: #000;
          cursor: pointer;
        }
        .quest-card.completed:not(.claimed) .action-button:hover:not(:disabled) {
          background: #00cc6a;
          transform: translateY(-1px);
        }
        @media (max-width: 600px) {
          .quests-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }
          .quest-card {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }
          .quest-info {
            padding-right: 0;
          }
          .quest-action {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
          .action-button {
            width: auto;
          }
        }
      `}</style>
    </section>
  );
}
