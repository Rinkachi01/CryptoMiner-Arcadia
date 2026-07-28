"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  AdminRuntimeSettings,
  AdminSettingKey,
} from "./admin-settings";

type AdminOverview = {
  audit: Array<{
    action: string;
    createdAt: number;
    metadata: Record<string, unknown>;
  }>;
  games: Array<{
    gameId: string;
    plays: number;
    power: number;
    wins: number;
  }>;
  inventory: {
    batteriesInInventory: number;
    installedRacks: number;
    playersWithEnergy: number;
    topMiners: Array<{
      count: number;
      minerId: string;
      name: string;
    }>;
  };
  ledger: Array<{
    action: string;
    cmaDelta: number;
    count: number;
  }>;
  metrics: {
    activePlayers24h: number;
    batteryClaims24h: number;
    crateOpens24h: number;
    games24h: number;
    openReviews: number;
    powerGranted24h: number;
    totalPlayers: number;
    wins24h: number;
  };
  owner: {
    claimedAt: number;
    displayName: string;
    email: string;
  };
  recentCrates: Array<{
    crateId: string;
    createdAt: number;
    displayName: string;
    id: string;
    pityTriggered: boolean;
    rarity: string;
    reward: string;
  }>;
  serverTime: number;
  settings: AdminRuntimeSettings;
  suspiciousSessions: Array<{
    completedAt: number | null;
    difficulty: number;
    displayName: string;
    gameId: string;
    id: string;
    resolution: string | null;
    reviewNote: string | null;
    reviewReason: string;
    reviewedAt: number | null;
    riskLevel: string;
    score: number;
    startedAt: number;
    status: string;
  }>;
};

type AdminDashboardProps = {
  signOutPath: string;
  user: {
    displayName: string;
    email: string;
  };
};

const gameLabels: Record<string, string> = {
  "circuit-rush": "Circuit Rush",
  "hash-match": "Hash Match",
  "packet-catch": "Packet Catch",
};

const actionLabels: Record<string, string> = {
  buy_batteries: "Baterias compradas",
  buy_miners: "Mineradores comprados",
  buy_racks: "Racks comprados",
  buy_room: "Salas compradas",
  daily_mission_battery: "Baterias diárias",
  claim_energy: "Energia resgatada",
  open_supply_crate: "Caixas abertas",
  use_battery: "Baterias utilizadas",
};

const controlDefinitions: Array<{
  description: string;
  key: AdminSettingKey;
  label: string;
  short: string;
}> = [
  {
    key: "cratesEnabled",
    label: "Caixas Arcadia",
    short: "CAIXAS",
    description:
      "Pausa novas compras e sorteios sem alterar caixas já abertas ou itens.",
  },
  {
    key: "minigamePowerEnabled",
    label: "Poder dos minigames",
    short: "PODER",
    description:
      "As partidas continuam funcionando, mas nenhum GH/s temporário é emitido.",
  },
  {
    key: "dailyBatteryEnabled",
    label: "Bateria diária",
    short: "ENERGIA",
    description:
      "Impede novos resgates do Tour do Arcade sem remover baterias existentes.",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, value));
}

function formatDate(value: number | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatCma(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Math.abs(value))} CMA`;
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export function AdminDashboard({
  signOutPath,
  user,
}: AdminDashboardProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const loadOverview = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const data = (await response.json()) as AdminOverview & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Painel indisponível.");
      setOverview(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar o painel.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as AdminOverview & {
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Painel indisponível.");
        if (active) setOverview(data);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o painel.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const maxGamePlays = useMemo(
    () => Math.max(1, ...(overview?.games.map((game) => game.plays) ?? [1])),
    [overview?.games],
  );

  async function runAdminAction(
    id: string,
    body: Record<string, unknown>,
  ) {
    setBusyAction(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        settings?: AdminRuntimeSettings;
      };
      if (!response.ok) throw new Error(data.error ?? "Ação recusada.");
      if (data.settings) {
        setOverview((current) =>
          current ? { ...current, settings: data.settings! } : current,
        );
      }
      setMessage(data.message ?? "Ação concluída.");
      await loadOverview();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível concluir.",
      );
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return (
      <main className="admin-loading-shell">
        <div className="admin-loader" />
        <span>CARREGANDO CENTRAL DO PROPRIETÁRIO</span>
      </main>
    );
  }

  if (error && !overview) {
    return (
      <main className="admin-access-shell">
        <section>
          <span>ACESSO RESTRITO</span>
          <h1>Central do proprietário</h1>
          <p>{error}</p>
          <Link href="/">VOLTAR AO JOGO</Link>
        </section>
      </main>
    );
  }

  if (!overview) return null;

  const reviewedCount = overview.suspiciousSessions.filter(
    (session) => session.resolution,
  ).length;
  const spentCma = overview.ledger.reduce(
    (total, entry) => total + Math.min(0, entry.cmaDelta),
    0,
  );

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link className="admin-brand" href="/">
          <b>CMA</b>
          <span>
            <small>CRYPTO MINER</small>
            <strong>ARCADIA CONTROL</strong>
          </span>
        </Link>
        <div className="admin-owner-lock">
          <i />
          <span>
            <small>OWNER LOCK ATIVO</small>
            <strong>{overview.owner.displayName}</strong>
          </span>
        </div>
        <nav>
          <button type="button" onClick={() => void loadOverview()}>
            ATUALIZAR
          </button>
          <Link href="/">VOLTAR AO JOGO</Link>
          <a href={signOutPath}>SAIR</a>
        </nav>
      </header>

      <section className="admin-hero">
        <div>
          <span>CENTRAL DE OPERAÇÕES · ÚLTIMAS 24 HORAS</span>
          <h1>Saúde econômica e revisão</h1>
          <p>
            Observe emissão, caixas, energia e alertas sem alterar diretamente o
            inventário dos jogadores.
          </p>
        </div>
        <aside>
          <small>SINCRONIZAÇÃO DO SERVIDOR</small>
          <strong>{formatDate(overview.serverTime)}</strong>
          <span>Dados autoritativos · atualização manual</span>
        </aside>
      </section>

      {(message || error) && (
        <div className={`admin-feedback ${error ? "error" : "success"}`}>
          <span>{error ? "!" : "✓"}</span>
          {error || message}
        </div>
      )}

      <section className="admin-metric-grid">
        <article>
          <span>JOGADORES</span>
          <strong>{formatNumber(overview.metrics.totalPlayers)}</strong>
          <small>{overview.metrics.activePlayers24h} ativos em 24h</small>
        </article>
        <article>
          <span>PARTIDAS 24H</span>
          <strong>{formatNumber(overview.metrics.games24h)}</strong>
          <small>{overview.metrics.wins24h} concluídas</small>
        </article>
        <article>
          <span>PODER EMITIDO</span>
          <strong>{formatNumber(overview.metrics.powerGranted24h)} GH/s</strong>
          <small>temporário nas últimas 24h</small>
        </article>
        <article className={overview.metrics.openReviews > 0 ? "warning" : ""}>
          <span>REVISÕES ABERTAS</span>
          <strong>{formatNumber(overview.metrics.openReviews)}</strong>
          <small>{reviewedCount} já analisadas no histórico</small>
        </article>
        <article>
          <span>CAIXAS 24H</span>
          <strong>{formatNumber(overview.metrics.crateOpens24h)}</strong>
          <small>{formatCma(spentCma)} em sumidouros</small>
        </article>
        <article>
          <span>BATERIAS DIÁRIAS</span>
          <strong>{formatNumber(overview.metrics.batteryClaims24h)}</strong>
          <small>{overview.inventory.playersWithEnergy} contas energizadas</small>
        </article>
      </section>

      <section className="admin-layout">
        <div className="admin-main-column">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span>CHAVES ECONÔMICAS</span>
                <h2>Controles de emergência</h2>
              </div>
              <small>ALTERAÇÕES AUDITADAS</small>
            </div>
            <div className="admin-control-grid">
              {controlDefinitions.map((control) => {
                const enabled = overview.settings[control.key];
                const busy = busyAction === control.key;
                return (
                  <article className={enabled ? "enabled" : "paused"} key={control.key}>
                    <div className="admin-control-icon">{control.short.slice(0, 1)}</div>
                    <div>
                      <span>{control.short}</span>
                      <h3>{control.label}</h3>
                      <p>{control.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() =>
                        void runAdminAction(control.key, {
                          action: "update-setting",
                          enabled: !enabled,
                          setting: control.key,
                        })
                      }
                    >
                      <i />
                      {busy
                        ? "APLICANDO"
                        : enabled
                          ? "ATIVO · PAUSAR"
                          : "PAUSADO · REATIVAR"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span>FILA ANTIFRAUDE</span>
                <h2>Partidas sinalizadas</h2>
              </div>
              <small>{overview.metrics.openReviews} PENDENTES</small>
            </div>
            <div className="admin-review-list">
              {overview.suspiciousSessions.length === 0 ? (
                <div className="admin-empty-state">
                  <b>✓</b>
                  <strong>Nenhum alerta registrado</strong>
                  <p>As sessões fora do padrão aparecerão aqui para revisão.</p>
                </div>
              ) : (
                overview.suspiciousSessions.map((session) => (
                  <article
                    className={session.resolution ? "reviewed" : ""}
                    key={session.id}
                  >
                    <div className="admin-review-summary">
                      <span className="admin-risk-badge">
                        {session.resolution
                          ? session.resolution === "cleared"
                            ? "LIBERADA"
                            : "CONFIRMADA"
                          : "REVISAR"}
                      </span>
                      <div>
                        <strong>{session.displayName}</strong>
                        <small>
                          {gameLabels[session.gameId] ?? session.gameId} · nível{" "}
                          {session.difficulty} · {shortId(session.id)}
                        </small>
                      </div>
                      <time>{formatDate(session.startedAt)}</time>
                    </div>
                    <p>{session.reviewReason}</p>
                    <dl>
                      <div>
                        <dt>STATUS</dt>
                        <dd>{session.status.toUpperCase()}</dd>
                      </div>
                      <div>
                        <dt>PONTOS</dt>
                        <dd>{formatNumber(session.score)}</dd>
                      </div>
                      <div>
                        <dt>RISCO</dt>
                        <dd>{session.riskLevel.toUpperCase()}</dd>
                      </div>
                    </dl>
                    {session.resolution ? (
                      <div className="admin-reviewed-note">
                        <span>REVISADA EM {formatDate(session.reviewedAt)}</span>
                        <p>{session.reviewNote || "Sem observação adicional."}</p>
                      </div>
                    ) : (
                      <div className="admin-review-actions">
                        <input
                          aria-label={`Observação para ${session.displayName}`}
                          maxLength={280}
                          placeholder="Observação opcional da revisão"
                          value={reviewNotes[session.id] ?? ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
                              [session.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            void runAdminAction(`clear-${session.id}`, {
                              action: "review-session",
                              note: reviewNotes[session.id] ?? "",
                              resolution: "cleared",
                              sessionId: session.id,
                            })
                          }
                        >
                          LIBERAR
                        </button>
                        <button
                          className="danger"
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            void runAdminAction(`confirm-${session.id}`, {
                              action: "review-session",
                              note: reviewNotes[session.id] ?? "",
                              resolution: "confirmed",
                              sessionId: session.id,
                            })
                          }
                        >
                          CONFIRMAR ALERTA
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="admin-side-column">
          <section className="admin-panel">
            <div className="admin-panel-heading compact">
              <div>
                <span>ARCADE 24H</span>
                <h2>Desempenho</h2>
              </div>
            </div>
            <div className="admin-game-bars">
              {overview.games.length === 0 ? (
                <p className="admin-inline-empty">Nenhuma partida no período.</p>
              ) : (
                overview.games.map((game) => {
                  const winRate =
                    game.plays > 0 ? Math.round((game.wins / game.plays) * 100) : 0;
                  return (
                    <article key={game.gameId}>
                      <div>
                        <strong>{gameLabels[game.gameId] ?? game.gameId}</strong>
                        <span>{winRate}% conclusão</span>
                      </div>
                      <i>
                        <em
                          style={{
                            width: `${Math.max(4, (game.plays / maxGamePlays) * 100)}%`,
                          }}
                        />
                      </i>
                      <small>
                        {game.plays} partidas · {formatNumber(game.power)} GH/s
                      </small>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading compact">
              <div>
                <span>DISTRIBUIÇÃO</span>
                <h2>Estoque do jogo</h2>
              </div>
            </div>
            <div className="admin-stock-summary">
              <div>
                <span>BATERIAS</span>
                <strong>{formatNumber(overview.inventory.batteriesInInventory)}</strong>
              </div>
              <div>
                <span>RACKS INSTALADOS</span>
                <strong>{formatNumber(overview.inventory.installedRacks)}</strong>
              </div>
            </div>
            <div className="admin-miner-ranking">
              {overview.inventory.topMiners.map((miner, index) => (
                <div key={miner.minerId}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span>{miner.name}</span>
                  <strong>{miner.count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading compact">
              <div>
                <span>ÚLTIMAS ABERTURAS</span>
                <h2>Caixas Arcadia</h2>
              </div>
            </div>
            <div className="admin-crate-feed">
              {overview.recentCrates.length === 0 ? (
                <p className="admin-inline-empty">Nenhuma caixa aberta ainda.</p>
              ) : (
                overview.recentCrates.slice(0, 8).map((crate) => (
                  <article key={crate.id}>
                    <b className={crate.rarity}>{crate.rarity.slice(0, 1)}</b>
                    <div>
                      <strong>{crate.reward}</strong>
                      <span>
                        {crate.displayName} · {formatDate(crate.createdAt)}
                      </span>
                    </div>
                    {crate.pityTriggered && <em>PROTEGIDA</em>}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading compact">
              <div>
                <span>SUMIDOUROS 24H</span>
                <h2>Movimento CMA</h2>
              </div>
            </div>
            <div className="admin-ledger-list">
              {overview.ledger
                .filter((entry) => entry.count > 0)
                .slice(0, 8)
                .map((entry) => (
                  <div key={entry.action}>
                    <span>
                      {actionLabels[entry.action] ??
                        entry.action.replaceAll("_", " ")}
                    </span>
                    <strong>{entry.count}</strong>
                    <em
                      className={
                        entry.cmaDelta < 0
                          ? "sink"
                          : entry.cmaDelta > 0
                            ? "source"
                            : ""
                      }
                    >
                      {entry.cmaDelta === 0
                        ? "—"
                        : `${entry.cmaDelta > 0 ? "+" : "−"}${formatCma(entry.cmaDelta)}`}
                    </em>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </section>

      <footer className="admin-footer">
        <span>SIMULAÇÃO VIRTUAL · SEM DEPÓSITO OU SAQUE</span>
        <small>
          Proprietário registrado em {formatDate(overview.owner.claimedAt)} ·{" "}
          {user.email}
        </small>
      </footer>
    </main>
  );
}
