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
  const english = locale !== "pt-BR";
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
      
    </section>
  );

  return createPortal(content, document.body);
}
