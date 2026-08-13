"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicSeason, SeasonPlayerProgress } from "./season-server";
import type { SeasonResponse } from "./SeasonPanel";

export function DailyWelcomeModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<{
    season: PublicSeason | null;
    playerProgress: SeasonPlayerProgress | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMounted(true);
    fetch("/api/season", { cache: "no-store" })
      .then((res) => res.json())
      .then((result: unknown) => setData(result as SeasonResponse))
      .catch(() => {});
  }, []);

  if (!mounted) return null;
  if (closed || !data || !data.season || data.season.status !== "active") return null;
  if (data.playerProgress?.dailyLogin?.claimedToday) return null;

  const loginData = data.playerProgress?.dailyLogin;
  if (!loginData) return null;

  async function handleClaim() {
    setBusy(true);
    try {
      const response = await fetch("/api/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "daily-login" }),
      });
      const result: any = await response.json();
      if (response.ok) {
        setMessage(result.message ?? "XP resgatado!");
        setTimeout(() => {
          setClosed(true);
          onClose();
        }, 1500);
      } else {
        setMessage(result.error ?? "Erro ao resgatar.");
      }
    } catch {
      setMessage("Erro de conexão.");
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <section className="modal-overlay">
      <div className="modal-content daily-welcome">
        <div className="daily-welcome-glow" />
        <header>
          <div className="header-title">
            <span className="gift-icon">🎁</span>
            <h2>Bônus de Acesso Diário</h2>
          </div>
          <button type="button" className="close-btn" onClick={() => { setClosed(true); onClose(); }} disabled={busy}>
            &times;
          </button>
        </header>
        <div className="daily-welcome-body">
          <p className="subtitle">
            Acesse todos os dias consecutivos para ganhar cada vez mais XP!
          </p>
          
          <div className="daily-track">
            {loginData.schedule.map((xp, index) => {
              const day = index + 1;
              let state = "upcoming"; // "claimed", "current", "upcoming"
              if (day < loginData.cycleDay || (day === loginData.cycleDay && loginData.claimedToday)) {
                state = "claimed";
              } else if (day === loginData.cycleDay && !loginData.claimedToday) {
                state = "current";
              }

              return (
                <div key={day} className={`daily-card ${state}`}>
                  <span className="day-label">DIA {day}</span>
                  <div className="reward-icon">
                    {state === "claimed" ? "✓" : `+${xp}`}
                  </div>
                  <span className="xp-label">XP</span>
                </div>
              );
            })}
          </div>

          <div className="action-row">
            {message ? (
              <strong className="success-message">{message}</strong>
            ) : (
              <button 
                type="button" 
                className="claim-button" 
                onClick={handleClaim} 
                disabled={busy}
              >
                {busy ? "RESGATANDO..." : "COLETAR RECOMPENSA"}
              </button>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(8px);
          padding: 20px;
        }
        .daily-welcome {
          max-width: 680px;
          width: 100%;
          background: linear-gradient(180deg, #1e1e2d 0%, #14141d 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,255,136,0.15) inset;
          position: relative;
          overflow: hidden;
        }
        .daily-welcome-glow {
          position: absolute;
          top: -50px;
          left: 50%;
          transform: translateX(-50%);
          width: 300px;
          height: 100px;
          background: rgba(0, 255, 136, 0.25);
          filter: blur(50px);
          pointer-events: none;
        }
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 30px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(255, 255, 255, 0.02);
          position: relative;
          z-index: 1;
        }
        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .gift-icon {
          font-size: 22px;
        }
        header h2 {
          color: #fff;
          font-size: 16px;
          margin: 0;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          background: linear-gradient(90deg, #fff, #ccc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .close-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #aaa;
          font-size: 20px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          transform: scale(1.05);
        }
        .daily-welcome-body {
          padding: 40px 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 1;
        }
        .subtitle {
          color: #999;
          font-size: 15px;
          margin-bottom: 35px;
          text-align: center;
        }
        .daily-track {
          display: flex;
          gap: 12px;
          width: 100%;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }
        .daily-card {
          flex: 1;
          min-width: 72px;
          max-width: 85px;
          background: linear-gradient(180deg, #232336 0%, #1a1a28 100%);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 6px;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .daily-card.claimed {
          border-color: rgba(0, 255, 136, 0.3);
          background: linear-gradient(180deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 255, 136, 0.05) 100%);
          opacity: 0.85;
        }
        .daily-card.current {
          border-color: #00ff88;
          background: linear-gradient(180deg, #253330 0%, #172421 100%);
          box-shadow: 0 0 25px rgba(0, 255, 136, 0.25), 0 0 0 1px #00ff88 inset;
          transform: translateY(-4px) scale(1.03);
          z-index: 2;
        }
        .daily-card.upcoming {
          opacity: 0.5;
        }
        .day-label {
          font-size: 11px;
          color: #ccc;
          font-weight: 700;
          margin-bottom: 12px;
          letter-spacing: 0.5px;
        }
        .current .day-label {
          color: #fff;
        }
        .reward-icon {
          font-size: 22px;
          font-weight: 900;
          color: #00ff88;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .daily-card.claimed .reward-icon {
          font-size: 26px;
          text-shadow: 0 0 10px rgba(0,255,136,0.5);
        }
        .xp-label {
          font-size: 10px;
          color: #777;
          margin-top: 8px;
          font-weight: 600;
        }
        .current .xp-label {
          color: #00ff88;
        }
        .action-row {
          height: 65px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .claim-button {
          background: linear-gradient(135deg, #00ff88 0%, #00b35e 100%);
          color: #002211;
          font-weight: 900;
          font-size: 16px;
          border: none;
          padding: 16px 45px;
          border-radius: 50px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          box-shadow: 0 8px 25px rgba(0, 255, 136, 0.4), inset 0 2px 0 rgba(255,255,255,0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          width: 80%;
          max-width: 400px;
        }
        .claim-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(0, 255, 136, 0.5), inset 0 2px 0 rgba(255,255,255,0.5);
          filter: brightness(1.1);
        }
        .claim-button:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
        }
        .claim-button:disabled {
          background: #333;
          color: #666;
          box-shadow: none;
          cursor: not-allowed;
          transform: none;
        }
        .success-message {
          color: #00ff88;
          font-size: 22px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-shadow: 0 0 15px rgba(0,255,136,0.5);
          animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 600px) {
          .daily-card {
            min-width: calc(25% - 10px);
            padding: 10px 4px;
          }
          .claim-button {
            width: 100%;
          }
          .daily-welcome-body {
            padding: 25px 20px;
          }
          header {
            padding: 18px 20px;
          }
        }
      `}</style>
    </section>
  );

  return createPortal(content, document.body);
}
