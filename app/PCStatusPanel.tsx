"use client";

import { useEffect, useState } from "react";
import { type GameSummaryResult } from "./api/games/summary/route";
import { ARCADE_POWER_DAYS_BY_LEVEL } from "./arcade-progression-rules";
import {
  pcLevelForPlays,
  pcNextPlayTarget,
  pcProgressPercent,
} from "./pc-progression-rules";

export function PCStatusPanel({
  refreshKey,
  temporaryPowerGh = 0,
}: {
  refreshKey?: number;
  temporaryPowerGh?: number;
}) {
  const [summary, setSummary] = useState<GameSummaryResult | null>(null);

  useEffect(() => {
    void fetch("/api/games/summary", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSummary(data as GameSummaryResult))
      .catch(() => {});
  }, [refreshKey]);

  const totalPlays = summary?.totals?.totalPlays ?? 0;
  const pcLevel = pcLevelForPlays(totalPlays);
  const nextPlayTarget = pcNextPlayTarget(pcLevel + 1);
  const progress = pcProgressPercent(totalPlays, pcLevel);
  const powerDays = ARCADE_POWER_DAYS_BY_LEVEL[pcLevel] ?? 0;
  const pcEmoji = pcLevel >= 5 ? "🖥️" : pcLevel >= 3 ? "💻" : pcLevel >= 1 ? "📟" : "📱";

  return (
    <section className="pc-status-panel" aria-label="Progresso do PC">
      <div className="pc-info">
        <h3>Seu PC</h3>
        <p className="pc-level">Nível {pcLevel}</p>
        <p className="power-duration">
          {powerDays > 0 ? (
            <>Bônus de energia válido por: <strong>{powerDays} dia{powerDays > 1 ? "s" : ""}</strong></>
          ) : (
            <>Jogue 10 partidas para liberar o primeiro bônus.</>
          )}
        </p>
        {temporaryPowerGh > 0 && (
          <p className="pc-active-bonus">
            +{temporaryPowerGh.toLocaleString("pt-BR")} GH/s ativo
          </p>
        )}
      </div>

      <div className="pc-visual" aria-hidden="true">
        <span className="pc-emoji">{pcEmoji}</span>
      </div>

      <div className="pc-progress">
        {pcLevel < 5 ? (
          <>
            <div className="progress-text">
              {Math.max(0, nextPlayTarget - totalPlays)} partida(s) para o próximo PC
            </div>
            <div className="progress-bar-bg" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <small className="pc-play-count">{totalPlays} partidas jogadas</small>
          </>
        ) : (
          <div className="progress-text">PC nível máximo alcançado!</div>
        )}
      </div>

      <div className="pc-power-ladder" aria-label="Duração do poder por nível">
        <span>PROGRESSÃO DO PC</span>
        <strong>Quanto maior o nível, mais tempo dura o poder</strong>
        <ol>
          {ARCADE_POWER_DAYS_BY_LEVEL.slice(1).map((days, index) => (
            <li key={days} className={pcLevel === index + 1 ? "current" : ""}>
              <b>N{index + 1}</b>
              <small>{days} {days === 1 ? "dia" : "dias"}</small>
            </li>
          ))}
        </ol>
        <small className="pc-ladder-note">Um nível é perdido após um dia completo sem jogar.</small>
      </div>
    </section>
  );
}
