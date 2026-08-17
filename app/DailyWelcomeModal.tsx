"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useArcadiaLanguage } from "./i18n";
import type { PublicSeason, SeasonPlayerProgress } from "./season-server";
import type { SeasonResponse } from "./SeasonPanel";

type DailyWelcomeModalProps = {
  onClose: () => void;
  /**
   * The game bootstraps the authoritative session asynchronously.  Waiting
   * for that signal avoids a one-shot 401 request that used to make the
   * welcome dialog disappear for the rest of the session.
   */
  enabled?: boolean;
};

export function DailyWelcomeModal({
  onClose,
  enabled = true,
}: DailyWelcomeModalProps) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const [data, setData] = useState<{
    season: PublicSeason | null;
    playerProgress: SeasonPlayerProgress | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let retryTimer: number | undefined;

    const load = async (attempt = 0): Promise<void> => {
      try {
        const response = await fetch("/api/season", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as
          | (SeasonResponse & { error?: string })
          | null;
        if (!response.ok) {
          throw new Error(result?.error ?? (english ? "Season unavailable." : "Temporada indisponível."));
        }
        if (!cancelled && result) setData(result);
      } catch {
        // Session cookies can arrive a moment after the game shell. Retry a
        // few times so a transient auth/network race cannot hide the dialog.
        if (!cancelled && attempt < 3) {
          retryTimer = window.setTimeout(
            () => void load(attempt + 1),
            450 * (attempt + 1),
          );
        }
      }
    };

    void load();

    const refreshOnFocus = () => void load();
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [enabled, english]);

  if (typeof document === "undefined") return null;
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
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (response.ok) {
        setMessage(result.message ?? (english ? "XP claimed!" : "XP resgatado!"));
        setTimeout(() => {
          setClosed(true);
          onClose();
        }, 1500);
      } else {
        setMessage(result.error ?? (english ? "Claim failed." : "Erro ao resgatar."));
      }
    } catch {
      setMessage(english ? "Connection error." : "Erro de conexão.");
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
            <h2>{english ? "Daily Login Bonus" : "Bônus de Acesso Diário"}</h2>
          </div>
          <button type="button" className="close-btn" onClick={() => { setClosed(true); onClose(); }} disabled={busy}>
            &times;
          </button>
        </header>
        <div className="daily-welcome-body">
          <p className="subtitle">
            {english
              ? "Log in on consecutive days to earn more XP each time!"
              : "Acesse todos os dias consecutivos para ganhar cada vez mais XP!"}
          </p>

          <div className="discord-callout">
            <span className="discord-callout-icon" aria-hidden="true">◈</span>
            <div>
              <strong>
                {english ? "Stay ahead of special events" : "Fique por dentro dos eventos especiais"}
              </strong>
              <small>
                {english
                  ? "Block boosts and limited rewards are announced on Discord."
                  : "Acelerações de blocos e recompensas especiais são anunciadas no Discord."}
              </small>
            </div>
            <a
              href="https://discord.gg/XGW4JzrTP"
              target="_blank"
              rel="noopener noreferrer"
            >
              {english ? "JOIN DISCORD" : "ENTRAR NO DISCORD"}
            </a>
          </div>
          
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
                  <span className="day-label">{english ? "DAY" : "DIA"} {day}</span>
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
                {busy
                  ? english ? "CLAIMING..." : "RESGATANDO..."
                  : english ? "CLAIM REWARD" : "COLETAR RECOMPENSA"}
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
        .discord-callout {
          width: 100%;
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto;
          align-items: center;
          gap: 11px;
          padding: 11px 13px;
          margin: -12px 0 27px;
          border: 1px solid rgba(88, 122, 255, 0.5);
          border-radius: 10px;
          background: linear-gradient(100deg, rgba(65, 74, 156, 0.28), rgba(30, 34, 67, 0.5));
          text-align: left;
        }
        .discord-callout-icon {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border-radius: 8px;
          background: #5865f2;
          color: #fff;
          font-weight: 900;
        }
        .discord-callout div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .discord-callout strong {
          color: #edf0ff;
          font-size: 12px;
          letter-spacing: 0.2px;
        }
        .discord-callout small {
          color: #b7b9d5;
          font-size: 11px;
          line-height: 1.35;
        }
        .discord-callout a {
          padding: 8px 10px;
          border: 1px solid rgba(137, 149, 255, 0.8);
          border-radius: 7px;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.5px;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .discord-callout a:hover,
        .discord-callout a:focus-visible {
          border-color: #fff;
          background: rgba(88, 101, 242, 0.7);
          outline: none;
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
          .discord-callout {
            grid-template-columns: 30px minmax(0, 1fr);
          }
          .discord-callout a {
            grid-column: 2;
            justify-self: start;
          }
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
