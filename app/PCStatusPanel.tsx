import { useMemo, useState, useEffect } from "react";
import { type GameSummaryResult } from "./api/games/summary/route";
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
      (highest: number, game: { level: number }) => Math.max(highest, game.level),
      1,
    );
  }, [summary]);

  const winsToday = summary?.totals?.winsToday ?? 0;
  
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

    </div>
  );
}
