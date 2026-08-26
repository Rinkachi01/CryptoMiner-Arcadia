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
