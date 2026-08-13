import { useMemo, useState, useEffect } from "react";
import { type GameSummaryResult } from "./api/games/summary/route";
import { assetsManifest } from "./assets.manifest";
import { ARCADE_POWER_DAYS_BY_LEVEL } from "./arcade-progression-rules";

export function PCStatusPanel({
  refreshKey,
}: {
  refreshKey?: number;
}) {
  const [summary, setSummary] = useState<GameSummaryResult | null>(null);

  useEffect(() => {
    void fetch("/api/games/summary", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSummary(data as GameSummaryResult))
      .catch(() => {});
  }, [refreshKey]);

  const highestLevel = useMemo(() => {
    if (!summary?.games?.length) return 1;
    return summary.games.reduce(
      (highest, game) => Math.max(highest, game.level),
      1,
    );
  }, [summary]);

  const winsToday = (summary as any)?.totals?.winsToday ?? 0;
  
  // Calculate next PC level requirements
  const nextLevelWins = highestLevel === 1 ? 10 : highestLevel === 2 ? 30 : highestLevel === 3 ? 60 : 60;
  const progress = Math.min(100, Math.floor((winsToday / nextLevelWins) * 100));

  const powerDays = ARCADE_POWER_DAYS_BY_LEVEL[highestLevel] || 1;
  const pcEmoji =
    highestLevel === 4
      ? "🖥️" // Max Level PC
      : highestLevel === 3
        ? "💻" // Laptop
        : highestLevel === 2
          ? "📟" // Old PC
          : "📱"; // Basic device

  return (
    <div className="pc-status-panel">
      <div className="pc-info">
        <h3>Seu PC</h3>
        <p className="pc-level">Nível {highestLevel}</p>
        <p className="power-duration">
          Energia válida por: <strong>{powerDays} dia{powerDays > 1 ? "s" : ""}</strong>
        </p>
      </div>
      
      <div className="pc-visual">
        <span className="pc-emoji">{pcEmoji}</span>
      </div>

      <div className="pc-progress">
        {highestLevel < 4 ? (
          <>
            <div className="progress-text">
              Vença {nextLevelWins - winsToday > 0 ? nextLevelWins - winsToday : 0} jogos para um novo PC
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </>
        ) : (
          <div className="progress-text">PC Nível Máximo Alcançado!</div>
        )}
      </div>

      <style jsx>{`
        .pc-status-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          color: white;
          width: 100%;
          margin-bottom: 20px;
        }
        .pc-info {
          text-align: center;
          margin-bottom: 12px;
        }
        .pc-info h3 {
          margin: 0;
          font-size: 16px;
          color: #888;
          text-transform: uppercase;
        }
        .pc-level {
          font-size: 20px;
          font-weight: bold;
          margin: 4px 0;
          color: #a9ff3f;
        }
        .power-duration {
          font-size: 12px;
          margin: 0;
          color: #888;
        }
        .power-duration strong {
          color: #ccc;
        }
        .pc-visual {
          font-size: 72px;
          line-height: 1;
          margin-bottom: 16px;
        }
        .pc-progress {
          width: 100%;
        }
        .progress-text {
          font-size: 12px;
          text-align: center;
          margin-bottom: 8px;
          color: #888;
        }
        .progress-bar-bg {
          background: rgba(255, 255, 255, 0.1);
          height: 6px;
          border-radius: 4px;
          overflow: hidden;
          width: 100%;
        }
        .progress-bar-fill {
          background: #a9ff3f;
          height: 100%;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}
