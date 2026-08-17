/* eslint-disable @next/next/no-img-element */

import { Fragment, useEffect, useState } from "react";
import { assetsManifest } from "./assets.manifest";

type LeaderboardRow = {
  rank: number;
  accountId: string;
  displayName: string;
  mainRoomAsset: string;
  mainRoomMinerCount: number;
  mainRoomName: string;
  mainRoomRackCount: number;
  powerGh: number;
};

type LeaderboardResponse = {
  generatedAt: number;
  leaderboard: LeaderboardRow[];
};

type PublicRoom = {
  accountId: string;
  displayName: string;
  room: {
    name: string;
    asset: string;
    racks: Array<{
      id: string;
      positionIndex: number;
      usedSlots: number;
      miners: Array<{
        instanceId: string;
        slotIndex: number;
        miner: {
          name: string;
          asset: string;
          alt: string;
          slotSize: number;
          powerGh: number;
          rarity: string;
        };
      }>;
    }>;
    rackCount: number;
    minerCount: number;
  };
  power: { minerGh: number; minigameGh: number; totalGh: number };
  energy: { active: boolean; expiresAt: number | null };
};

const publicRoomRackPositions = [
  { left: 1.2, top: 45, width: 14.8, height: 25, zIndex: 12 },
  { left: 17.7, top: 45, width: 14.8, height: 25, zIndex: 12 },
  { left: 34.2, top: 45, width: 14.8, height: 25, zIndex: 12 },
  { left: 50.7, top: 45, width: 14.8, height: 25, zIndex: 12 },
  { left: 67.2, top: 45, width: 14.8, height: 25, zIndex: 12 },
  { left: 83.7, top: 45, width: 14.8, height: 25, zIndex: 12 },
  { left: 1.2, top: 71, width: 14.8, height: 25, zIndex: 14 },
  { left: 17.7, top: 71, width: 14.8, height: 25, zIndex: 14 },
  { left: 34.2, top: 71, width: 14.8, height: 25, zIndex: 14 },
  { left: 50.7, top: 71, width: 14.8, height: 25, zIndex: 14 },
  { left: 67.2, top: 71, width: 14.8, height: 25, zIndex: 14 },
  { left: 83.7, top: 71, width: 14.8, height: 25, zIndex: 14 },
] as const;

function publicRackMinerPosition(slotIndex: number) {
  const row = Math.floor(slotIndex / 2);
  const column = slotIndex % 2;
  return {
    left: `${31 + column * 21.5}%`,
    top: `${row * 23}%`,
  };
}

export function LeaderboardPanel() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [openRoomAccount, setOpenRoomAccount] = useState<string | null>(null);
  const [publicRoom, setPublicRoom] = useState<PublicRoom | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const response = await fetch("/api/network/leaderboard", {
          signal: controller.signal,
        });
        const result = (await response.json()) as LeaderboardResponse & { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? "Não foi possível carregar o ranking.");
        }
        setLeaderboard(result.leaderboard || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Erro desconhecido.");
        }
      } finally {
        setLoading(false);
      }
    }

    void fetchLeaderboard();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!openRoomAccount) {
      return;
    }
    const controller = new AbortController();
    async function fetchRoom() {
      try {
        setRoomLoading(true);
        setRoomError("");
        setPublicRoom(null);
        const response = await fetch(
          `/api/network/leaderboard/room?accountId=${encodeURIComponent(openRoomAccount)}`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as { room?: PublicRoom; error?: string };
        if (!response.ok || !result.room) {
          throw new Error(result.error ?? "Não foi possível abrir a sala pública.");
        }
        setPublicRoom(result.room);
      } catch (err) {
        if (!controller.signal.aborted) {
          setRoomError(err instanceof Error ? err.message : "Erro ao carregar a sala.");
        }
      } finally {
        if (!controller.signal.aborted) setRoomLoading(false);
      }
    }
    void fetchRoom();
    return () => controller.abort();
  }, [openRoomAccount]);

  return (
    <div className="leaderboard-panel arcadia-panel">
      <header className="panel-header">
        <h2>Ranking de Poder</h2>
        <p>Top 15 operadores por poder total na rede Arcadia.</p>
      </header>

      <div className="panel-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Sincronizando com a rede...</p>
          </div>
        ) : error ? (
          <p className="error-state">{error}</p>
        ) : leaderboard.length === 0 ? (
          <p className="empty-state">O ranking está vazio no momento.</p>
        ) : (
          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="col-rank">Posição</th>
                  <th className="col-name">Operador</th>
                  <th className="col-power">Poder Total</th>
                  <th className="col-room">Sala principal</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <Fragment key={row.accountId}>
                  <tr className={`leaderboard-row rank-${row.rank}`}>
                    <td className="col-rank">
                      <span className="rank-badge">#{row.rank}</span>
                    </td>
                    <td className="col-name">
                      <button
                        type="button"
                        className="leaderboard-name-button"
                        aria-expanded={openRoomAccount === row.accountId}
                        onClick={() =>
                          setOpenRoomAccount((current) =>
                            current === row.accountId ? null : row.accountId,
                          )
                        }
                      >
                        <span className="operator-avatar" aria-hidden="true">
                          {row.displayName.trim().slice(0, 1).toUpperCase() || "?"}
                        </span>
                        <strong>{row.displayName}</strong>
                      </button>
                    </td>
                    <td className="col-power">
                      <span className="power-value">{formatPower(row.powerGh)}</span>
                    </td>
                    <td className="col-room">
                      <button
                        type="button"
                        className="room-preview-trigger"
                        aria-expanded={openRoomAccount === row.accountId}
                        onClick={() =>
                          setOpenRoomAccount((current) =>
                            current === row.accountId ? null : row.accountId,
                          )
                        }
                      >
                        {openRoomAccount === row.accountId ? "Ocultar sala" : "Ver sala"}
                      </button>
                    </td>
                  </tr>
                  {openRoomAccount === row.accountId && (
                    <tr className="room-preview-row">
                      <td colSpan={4}>
                        {roomLoading ? (
                          <div className="room-preview-status">Abrindo a sala pública…</div>
                        ) : roomError ? (
                          <div className="room-preview-status error">{roomError}</div>
                        ) : publicRoom ? (
                          <PublicRoomCard room={publicRoom} />
                        ) : (
                          <div className="room-preview-status">Sala pública indisponível.</div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .leaderboard-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 30px;
        }
        .panel-header {
          margin-bottom: 30px;
          text-align: center;
        }
        .panel-header h2 {
          font-size: 32px;
          color: #fff;
          margin-bottom: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
        }
        .panel-header p {
          color: #aaa;
          font-size: 14px;
        }
        .panel-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #222;
          border-radius: 12px;
          overflow: hidden;
        }
        .leaderboard-table-container {
          overflow-y: auto;
          flex: 1;
        }
        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .leaderboard-table th {
          background: #111;
          color: #888;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 15px 20px;
          border-bottom: 1px solid #333;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .leaderboard-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #222;
          vertical-align: middle;
        }
        .leaderboard-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .col-rank {
          width: 100px;
          text-align: center;
        }
        .col-power {
          text-align: right;
        }
        .col-room { width: 140px; text-align: right; }
        .room-preview-trigger {
          border: 1px solid rgba(0, 255, 136, 0.35);
          border-radius: 7px;
          padding: 7px 9px;
          color: #a8ff3f;
          background: rgba(0, 255, 136, 0.07);
          font: 800 11px/1 var(--font-ui);
          cursor: pointer;
        }
        .room-preview-trigger:hover { background: rgba(0, 255, 136, 0.15); }
        .room-preview-row td { padding: 0 20px 16px; border-bottom: 1px solid #222; }
        .room-preview-card { display: flex; align-items: center; gap: 16px; padding: 12px; border: 1px solid rgba(0, 255, 136, 0.18); border-radius: 10px; background: rgba(6, 19, 25, 0.9); }
        .room-preview-card img { width: min(260px, 42vw); aspect-ratio: 724 / 543; border-radius: 7px; object-fit: cover; }
        .room-preview-card div { display: grid; gap: 5px; }
        .room-preview-card span { color: #71ddf0; font: 800 10px/1.2 var(--font-mono); letter-spacing: .08em; }
        .room-preview-card strong { color: #eef9f7; font-size: 16px; }
        .room-preview-card p { margin: 0; color: #a8ff3f; font-weight: 750; }
        .room-preview-card small { color: #81949d; }
        .room-preview-status { padding: 18px; border: 1px solid rgba(113, 221, 240, .2); border-radius: 10px; color: #a6c4cc; background: rgba(6, 19, 25, .86); }
        .room-preview-status.error { color: #ffb4a8; border-color: rgba(255, 116, 96, .35); }
        .leaderboard-name-button { display: inline-flex; align-items: center; gap: 10px; border: 0; padding: 0; color: inherit; background: transparent; cursor: pointer; text-align: left; }
        .leaderboard-name-button:hover strong, .leaderboard-name-button:focus-visible strong { color: #a8ff3f; }
        .operator-avatar { display: inline-grid; place-items: center; width: 30px; height: 30px; border: 1px solid rgba(113, 221, 240, .45); border-radius: 50%; color: #71ddf0; background: linear-gradient(145deg, rgba(23, 67, 76, .9), rgba(9, 18, 27, .9)); font: 800 13px/1 var(--font-mono); }
        .public-room-card { display: grid; gap: 16px; padding: 14px; border: 1px solid rgba(0, 255, 136, .2); border-radius: 12px; background: rgba(6, 19, 25, .95); }
        .public-room-heading { display: grid; grid-template-columns: minmax(220px, 300px) 1fr; gap: 16px; align-items: stretch; }
        .public-room-scene { position: relative; overflow: hidden; width: 100%; aspect-ratio: 724 / 543; border: 1px solid rgba(113, 221, 240, .22); border-radius: 8px; background: #080d12; }
        .public-room-scene-background { display: block; width: 100%; height: 100%; object-fit: cover; }
        .public-room-scene-racks { position: absolute; inset: 0; }
        .public-room-scene-rack { position: absolute; display: block; }
        .public-room-scene-rack-frame { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; object-fit: fill; filter: drop-shadow(0 5px 5px rgba(0, 0, 0, .65)); }
        .public-room-scene-miner { position: absolute; z-index: 2; display: block; width: 17.5%; height: 15.5%; object-fit: contain; filter: drop-shadow(0 3px 2px rgba(0, 0, 0, .8)); }
        .public-room-scene-miner.size-2 { width: 39.5%; }
        .public-room-scene-badge { position: absolute; z-index: 16; right: 8px; bottom: 8px; padding: 5px 7px; border: 1px solid rgba(169, 255, 63, .45); border-radius: 5px; color: #a8ff3f; background: rgba(6, 15, 20, .82); font: 800 9px/1 var(--font-mono); letter-spacing: .08em; }
        .public-room-heading-copy { display: grid; align-content: center; gap: 7px; }
        .public-room-heading-copy span { color: #71ddf0; font: 800 10px/1.2 var(--font-mono); letter-spacing: .1em; }
        .public-room-heading-copy strong { color: #eef9f7; font-size: 20px; }
        .public-room-heading-copy small { color: #81949d; }
        .public-room-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .public-room-stat { display: grid; gap: 4px; padding: 10px; border: 1px solid rgba(113, 221, 240, .16); border-radius: 8px; background: rgba(11, 28, 36, .8); }
        .public-room-stat span { color: #81949d; font: 700 9px/1.2 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
        .public-room-stat strong { color: #a8ff3f; font-size: 14px; }
        .public-room-racks { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
        .public-room-rack { display: grid; gap: 9px; padding: 12px; border: 1px solid rgba(113, 221, 240, .15); border-radius: 9px; background: rgba(9, 22, 29, .9); }
        .public-room-rack header { display: flex; justify-content: space-between; color: #a6c4cc; font: 800 10px/1.2 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
        .public-room-miners { display: grid; gap: 7px; }
        .public-room-miner { display: grid; grid-template-columns: 46px 1fr auto; gap: 8px; align-items: center; padding: 6px; border-radius: 7px; background: rgba(0, 0, 0, .2); }
        .public-room-miner img { width: 46px; height: 30px; object-fit: contain; image-rendering: pixelated; }
        .public-room-miner strong { color: #e6f3f1; font-size: 12px; }
        .public-room-miner small { display: block; color: #81949d; font-size: 10px; }
        .public-room-miner em { color: #a8ff3f; font: 800 10px/1 var(--font-mono); font-style: normal; }
        .public-room-privacy { margin: 0; color: #81949d; font-size: 11px; }
        .rank-badge {
          display: inline-block;
          font-size: 14px;
          font-weight: bold;
          color: #888;
          background: #222;
          padding: 4px 12px;
          border-radius: 20px;
          min-width: 50px;
        }
        .col-name strong {
          color: #e0e0e0;
          font-size: 15px;
          letter-spacing: 0.5px;
        }
        .power-value {
          color: #00ff88;
          font-weight: bold;
          font-size: 15px;
          font-family: monospace;
          background: rgba(0, 255, 136, 0.1);
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(0, 255, 136, 0.2);
        }
        @media (max-width: 720px) {
          .leaderboard-table th, .leaderboard-table td { padding-inline: 10px; }
          .col-room { width: auto; }
          .room-preview-card { align-items: stretch; flex-direction: column; }
          .room-preview-card img { width: 100%; max-width: none; }
          .public-room-heading { grid-template-columns: 1fr; }
          .public-room-scene { max-height: none; }
          .public-room-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        /* Top 3 Styling */
        .rank-1 .rank-badge {
          background: linear-gradient(135deg, #ffd700, #ffaa00);
          color: #000;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
        }
        .rank-2 .rank-badge {
          background: linear-gradient(135deg, #e0e0e0, #999);
          color: #000;
          box-shadow: 0 0 10px rgba(224, 224, 224, 0.4);
        }
        .rank-3 .rank-badge {
          background: linear-gradient(135deg, #cd7f32, #8b4513);
          color: #fff;
          box-shadow: 0 0 10px rgba(205, 127, 50, 0.4);
        }
        .rank-1 .col-name strong { color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,0.3); }
        .rank-2 .col-name strong { color: #e0e0e0; }
        .rank-3 .col-name strong { color: #cd7f32; }

        .loading-state, .error-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #888;
          font-size: 15px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0,255,136,0.1);
          border-top-color: #00ff88;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function PublicRoomCard({ room }: { room: PublicRoom }) {
  return (
    <section className="public-room-card" aria-label={`Sala pública de ${room.displayName}`}>
      <div className="public-room-heading">
        <div className="public-room-scene" aria-label={`Sala principal de ${room.displayName} com racks visíveis`}>
          <img
            className="public-room-scene-background"
            src={room.room.asset}
            alt={`Sala principal de ${room.displayName}`}
            decoding="async"
          />
          <div className="public-room-scene-racks" aria-hidden="true">
            {room.room.racks.map((rack) => {
              const position = publicRoomRackPositions[rack.positionIndex];
              if (!position) return null;
              return (
                <span
                  className="public-room-scene-rack"
                  key={rack.id}
                  style={{
                    left: `${position.left}%`,
                    top: `${position.top}%`,
                    width: `${position.width}%`,
                    height: `${position.height}%`,
                    zIndex: position.zIndex,
                  }}
                >
                  <img
                    className="public-room-scene-rack-frame"
                    src={assetsManifest.rackBasic.path}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  {rack.miners.map((placement) => (
                    <img
                      className={`public-room-scene-miner ${placement.miner.slotSize === 2 ? "size-2" : ""}`}
                      key={placement.instanceId}
                      src={placement.miner.asset}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={publicRackMinerPosition(placement.slotIndex)}
                    />
                  ))}
                </span>
              );
            })}
          </div>
          <span className="public-room-scene-badge">RACKS · {room.room.rackCount}</span>
        </div>
        <div className="public-room-heading-copy">
          <span>SALA PRINCIPAL · VISÃO PÚBLICA</span>
          <strong>{room.room.name}</strong>
          <small>{room.displayName} · somente leitura</small>
          <small>Racks e mineradores aparecem diretamente no cenário.</small>
        </div>
      </div>

      <div className="public-room-stat-grid">
        <div className="public-room-stat"><span>Poder total</span><strong>{formatPower(room.power.totalGh)}</strong></div>
        <div className="public-room-stat"><span>Mineradores</span><strong>{formatPower(room.power.minerGh)}</strong></div>
        <div className="public-room-stat"><span>Arcade</span><strong>{formatPower(room.power.minigameGh)}</strong></div>
        <div className="public-room-stat"><span>Energia</span><strong>{room.energy.active ? formatEnergyUntil(room.energy.expiresAt) : "Pausada"}</strong></div>
      </div>

      <div className="public-room-racks">
        {room.room.racks.length === 0 ? (
          <p className="public-room-privacy">Nenhum rack instalado na sala principal.</p>
        ) : (
          room.room.racks.map((rack) => (
            <article className="public-room-rack" key={rack.id}>
              <header><span>Rack {String(rack.positionIndex + 1).padStart(2, "0")}</span><span>{rack.usedSlots}/8 slots</span></header>
              <div className="public-room-miners">
                {rack.miners.length === 0 ? (
                  <small className="public-room-privacy">Rack livre</small>
                ) : (
                  rack.miners.map((placement) => (
                    <div className="public-room-miner" key={placement.instanceId}>
                      <img src={placement.miner.asset} alt={placement.miner.alt} />
                      <span><strong>{placement.miner.name}</strong><small>{placement.miner.rarity} · {placement.miner.slotSize} slot(s)</small></span>
                      <em>{formatPower(placement.miner.powerGh)}</em>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))
        )}
      </div>
      <p className="public-room-privacy">Saldo, carteiras, pools e controles de edição permanecem privados.</p>
    </section>
  );
}

function formatEnergyUntil(expiresAt: number | null) {
  if (!expiresAt) return "Pausada";
  const remainingMinutes = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
  if (remainingMinutes <= 0) return "Pausada";
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatPower(powerGh: number) {
  if (powerGh >= 1_000_000) {
    return `${(powerGh / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} PH/s`;
  }
  if (powerGh >= 1000) {
    return `${(powerGh / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} TH/s`;
  }
  return `${powerGh.toLocaleString("pt-BR")} GH/s`;
}
