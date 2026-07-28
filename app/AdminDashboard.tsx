"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  AdminRuntimeSettings,
  AdminSettingKey,
  AdminThresholdKey,
} from "./admin-settings";
import type { AdminAlert } from "./admin-alert-rules";
import {
  DEFAULT_SIMULATION_INPUT,
  simulateEconomy,
  type EconomySimulationInput,
} from "./economy-simulator";
import type {
  PublicSeason,
  SeasonLeaderboardEntry,
  SeasonSnapshot,
} from "./season-server";
import type { NetworkPowerSnapshot } from "./network-server";

type AdminOverview = {
  alerts: AdminAlert[];
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
    minerConcentrationPercent: number;
    playersWithEnergy: number;
    totalMiners: number;
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
  network: NetworkPowerSnapshot;
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
  season: {
    currentPlayer: SeasonLeaderboardEntry | null;
    leaderboard: SeasonLeaderboardEntry[];
    season: PublicSeason | null;
    snapshots: SeasonSnapshot[];
  };
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

type TextScale = "comfortable" | "large" | "extra";

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
  admin_test_cma_grant: "Crédito CMA de teste",
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

const thresholdDefinitions: Array<{
  key: AdminThresholdKey;
  label: string;
  maximum: number;
  minimum: number;
  suffix: string;
}> = [
  {
    key: "powerAlertGh",
    label: "Poder em 24h",
    minimum: 100,
    maximum: 100_000,
    suffix: "GH/s",
  },
  {
    key: "openReviewAlertCount",
    label: "Revisões abertas",
    minimum: 1,
    maximum: 500,
    suffix: "sessões",
  },
  {
    key: "crateAlertCount",
    label: "Caixas em 24h",
    minimum: 1,
    maximum: 1_000,
    suffix: "aberturas",
  },
  {
    key: "minerConcentrationAlertPercent",
    label: "Concentração",
    minimum: 5,
    maximum: 100,
    suffix: "%",
  },
];

const simulatorControls: Array<{
  key: keyof EconomySimulationInput;
  label: string;
  maximum: number;
  minimum: number;
}> = [
  {
    key: "minerPricePercent",
    label: "Preço dos mineradores",
    minimum: 50,
    maximum: 200,
  },
  {
    key: "cratePricePercent",
    label: "Preço das caixas",
    minimum: 50,
    maximum: 200,
  },
  {
    key: "networkDifficultyPercent",
    label: "Dificuldade da rede",
    minimum: 60,
    maximum: 240,
  },
  {
    key: "minigamePowerPercent",
    label: "Poder dos minigames",
    minimum: 0,
    maximum: 150,
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

function formatPower(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} PH/s`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} TH/s`;
  }
  return `${value.toLocaleString("pt-BR")} GH/s`;
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function formatSeasonRemaining(endsAt: number, now: number) {
  const remaining = Math.max(0, endsAt - now);
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining / (60 * 60 * 1000)) % 24);
  return days > 0 ? `${days} dias e ${hours}h` : `${hours} horas`;
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
  const [thresholdDrafts, setThresholdDrafts] = useState<
    Partial<Record<AdminThresholdKey, number>>
  >({});
  const [simulationInput, setSimulationInput] =
    useState<EconomySimulationInput>(DEFAULT_SIMULATION_INPUT);
  const [seasonName, setSeasonName] = useState("Temporada Beta");
  const [seasonDurationDays, setSeasonDurationDays] = useState(30);
  const [textScale, setTextScale] =
    useState<TextScale>("comfortable");

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("arcadia-text-scale");
      if (saved === "large" || saved === "extra") {
        setTextScale(saved);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const maxGamePlays = useMemo(
    () => Math.max(1, ...(overview?.games.map((game) => game.plays) ?? [1])),
    [overview?.games],
  );
  const simulation = useMemo(
    () => simulateEconomy(simulationInput),
    [simulationInput],
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

  function cycleTextScale() {
    const next: TextScale =
      textScale === "comfortable"
        ? "large"
        : textScale === "large"
          ? "extra"
          : "comfortable";
    setTextScale(next);
    window.localStorage.setItem("arcadia-text-scale", next);
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
  const activeAlertCount = overview.alerts.filter(
    (alert) => alert.severity !== "stable",
  ).length;

  return (
    <main className={`admin-shell text-scale-${textScale}`}>
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
          <button
            type="button"
            aria-label={`Tamanho do texto: ${
              textScale === "comfortable"
                ? "confortável"
                : textScale === "large"
                  ? "grande"
                  : "extra grande"
            }. Clique para alterar.`}
            onClick={cycleTextScale}
          >
            TEXTO{" "}
            {textScale === "comfortable"
              ? "A+"
              : textScale === "large"
                ? "A++"
                : "A"}
          </button>
          <button type="button" onClick={() => void loadOverview()}>
            ATUALIZAR
          </button>
          <a href="/api/admin/export" download>
            EXPORTAR CSV
          </a>
          <Link href="/">VOLTAR AO JOGO</Link>
          <a href={signOutPath}>SAIR</a>
        </nav>
      </header>

      <section className="admin-hero">
        <div>
          <span>CENTRAL DE OPERAÇÕES · ÚLTIMAS 24 HORAS</span>
          <h1>Saúde econômica e revisão</h1>
          <p>
            Observe emissão, caixas, energia e alertas. Ajustes de teste do
            proprietário são limitados, reversíveis e registrados.
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

      <section className="admin-panel admin-network-lab">
        <div className="admin-panel-heading">
          <div>
            <span>LABORATÓRIO ECONÔMICO · CLOSED BETA</span>
            <h2>Rede viva e carteira de teste</h2>
          </div>
          <small className={overview.network.testMode ? "test-active" : ""}>
            {overview.network.testMode ? "BASE ZERADA" : "BASE DE REFERÊNCIA"}
          </small>
        </div>

        <div className="admin-network-lab-copy">
          <div>
            <strong>Faça seu equipamento construir a rede</strong>
            <p>
              Preparar o teste completa sua carteira até 10.000 CMA e remove
              somente o poder artificial. Mineradores energizados aparecem
              imediatamente no total vivo.
            </p>
          </div>
          <aside>
            <span>PROTEÇÃO ECONÔMICA</span>
            <strong>Piso de dificuldade preservado</strong>
            <p>
              Mesmo com a rede visual zerada, o primeiro minerador não recebe
              100% do bloco. Se a rede real superar o piso, a recompensa é
              diluída automaticamente.
            </p>
          </aside>
        </div>

        <div className="admin-network-grid">
          {(["cma", "btc", "doge"] as const).map((poolId) => (
            <article key={poolId}>
              <span>{poolId.toUpperCase()} · REDE VIVA</span>
              <strong>
                {formatPower(overview.network.totalPowerGh[poolId])}
              </strong>
              <dl>
                <div>
                  <dt>Jogadores</dt>
                  <dd>{formatPower(overview.network.playerPowerGh[poolId])}</dd>
                </div>
                <div>
                  <dt>Base simulada</dt>
                  <dd>{formatPower(overview.network.basePowerGh[poolId])}</dd>
                </div>
                <div>
                  <dt>Piso econômico</dt>
                  <dd>
                    {formatPower(overview.network.economicFloorGh[poolId])}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="admin-network-actions">
          <button
            type="button"
            disabled={busyAction === "prepare-economic-test"}
            onClick={() =>
              void runAdminAction("prepare-economic-test", {
                action: "prepare-economic-test",
              })
            }
          >
            {busyAction === "prepare-economic-test"
              ? "PREPARANDO..."
              : "PREPARAR TESTE · SALDO 10.000 CMA"}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={busyAction === "restore-network-reference"}
            onClick={() =>
              void runAdminAction("restore-network-reference", {
                action: "restore-network-reference",
              })
            }
          >
            RESTAURAR PODER-BASE
          </button>
          <small>
            Nenhum saldo real ou saque é criado. Cada alteração entra no ledger
            pessoal e na auditoria administrativa.
          </small>
        </div>
      </section>

      <section className="admin-layout">
        <div className="admin-main-column">
          <section className="admin-panel admin-season-panel">
            <div className="admin-panel-heading">
              <div>
                <span>CICLOS COMPETITIVOS</span>
                <h2>Temporadas e snapshots</h2>
              </div>
              <small>SEM PRÊMIO FINANCEIRO</small>
            </div>

            {overview.season.season ? (
              <>
                <div className="admin-season-overview">
                  <article>
                    <span>
                      {overview.season.season.status === "active"
                        ? "TEMPORADA ATIVA"
                        : "ÚLTIMA TEMPORADA"}
                    </span>
                    <h3>{overview.season.season.name}</h3>
                    <p>
                      Ranking por partidas, vitórias e dificuldade validada pelo
                      servidor. A classificação não concede CMA, saque ou
                      vantagem econômica.
                    </p>
                    <i>
                      <em
                        style={{
                          width: `${overview.season.season.progressPercent}%`,
                        }}
                      />
                    </i>
                    <div>
                      <strong>
                        {overview.season.season.progressPercent}% do ciclo
                      </strong>
                      <span>
                        {overview.season.season.status === "active"
                          ? formatSeasonRemaining(
                              overview.season.season.endsAt,
                              overview.serverTime,
                            )
                          : "Ciclo encerrado"}
                      </span>
                    </div>
                    {overview.season.season.status === "active" && (
                      <div className="admin-season-actions">
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            void runAdminAction("snapshot-season", {
                              action: "snapshot-season",
                            })
                          }
                        >
                          REGISTRAR SNAPSHOT
                        </button>
                        <button
                          className="danger"
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            void runAdminAction("close-season", {
                              action: "close-season",
                            })
                          }
                        >
                          ENCERRAR TEMPORADA
                        </button>
                      </div>
                    )}
                  </article>

                  <section className="admin-season-ranking">
                    <div>
                      <span>TOP OPERADORES</span>
                      <small>{overview.season.leaderboard.length} ranqueados</small>
                    </div>
                    {overview.season.leaderboard.length === 0 ? (
                      <p className="admin-inline-empty">
                        O ranking começa na primeira partida concluída.
                      </p>
                    ) : (
                      overview.season.leaderboard.slice(0, 6).map((entry) => (
                        <article key={entry.accountId}>
                          <b>{String(entry.rank).padStart(2, "0")}</b>
                          <div>
                            <strong>{entry.displayName}</strong>
                            <small>
                              {entry.wins} vitórias · {entry.plays} partidas
                            </small>
                          </div>
                          <span>{formatNumber(entry.score)} pts</span>
                        </article>
                      ))
                    )}
                  </section>
                </div>

                <div className="admin-snapshot-strip">
                  <div>
                    <span>HISTÓRICO ECONÔMICO</span>
                    <strong>
                      {overview.season.snapshots.length} snapshots preservados
                    </strong>
                  </div>
                  {overview.season.snapshots.length === 0 ? (
                    <p>Registre o primeiro ponto de comparação desta temporada.</p>
                  ) : (
                    overview.season.snapshots.slice(0, 4).map((snapshot) => (
                      <article key={snapshot.id}>
                        <span>{formatDate(snapshot.createdAt)}</span>
                        <strong>
                          {formatNumber(snapshot.metrics.totalPlayers ?? 0)}{" "}
                          jogadores
                        </strong>
                        <small>
                          {formatNumber(snapshot.metrics.powerGranted24h ?? 0)}{" "}
                          GH/s · {formatNumber(snapshot.metrics.games24h ?? 0)}{" "}
                          partidas
                        </small>
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="admin-inline-empty">
                Nenhuma temporada registrada.
              </p>
            )}

            {overview.season.season?.status !== "active" && (
              <div className="admin-season-create">
                <label>
                  <span>NOME DA PRÓXIMA TEMPORADA</span>
                  <input
                    maxLength={72}
                    value={seasonName}
                    onChange={(event) => setSeasonName(event.target.value)}
                  />
                </label>
                <label>
                  <span>DURAÇÃO</span>
                  <select
                    value={seasonDurationDays}
                    onChange={(event) =>
                      setSeasonDurationDays(Number(event.target.value))
                    }
                  >
                    <option value={14}>14 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={60}>60 dias</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={Boolean(busyAction) || !seasonName.trim()}
                  onClick={() =>
                    void runAdminAction("create-season", {
                      action: "create-season",
                      durationDays: seasonDurationDays,
                      name: seasonName,
                    })
                  }
                >
                  INICIAR NOVA TEMPORADA
                </button>
              </div>
            )}
          </section>

          <section className="admin-panel admin-alerts-panel">
            <div className="admin-panel-heading">
              <div>
                <span>MONITORAMENTO AUTOMÁTICO</span>
                <h2>Alertas econômicos</h2>
              </div>
              <small>
                {activeAlertCount === 0
                  ? "TODOS ESTÁVEIS"
                  : `${activeAlertCount} EXIGEM ATENÇÃO`}
              </small>
            </div>
            <div className="admin-alert-grid">
              {thresholdDefinitions.map((definition) => {
                const alert = overview.alerts.find(
                  (item) =>
                    (definition.key === "powerAlertGh" &&
                      item.id === "power-emission") ||
                    (definition.key === "openReviewAlertCount" &&
                      item.id === "open-reviews") ||
                    (definition.key === "crateAlertCount" &&
                      item.id === "crate-volume") ||
                    (definition.key === "minerConcentrationAlertPercent" &&
                      item.id === "miner-concentration"),
                );
                if (!alert) return null;
                const draftValue =
                  thresholdDrafts[definition.key] ??
                  overview.settings[definition.key];
                const progress = Math.min(
                  100,
                  Math.round((alert.current / Math.max(1, alert.threshold)) * 100),
                );
                return (
                  <article className={alert.severity} key={alert.id}>
                    <div className="admin-alert-status">
                      <i />
                      <span>
                        {alert.severity === "stable"
                          ? "ESTÁVEL"
                          : alert.severity === "critical"
                            ? "CRÍTICO"
                            : "ATENÇÃO"}
                      </span>
                    </div>
                    <h3>{alert.label}</h3>
                    <p>{alert.message}</p>
                    <div className="admin-alert-value">
                      <strong>{formatNumber(alert.current)}</strong>
                      <span>
                        / {formatNumber(alert.threshold)} {alert.unit}
                      </span>
                    </div>
                    <div className="admin-alert-progress">
                      <i style={{ width: `${progress}%` }} />
                    </div>
                    <label>
                      <span>NOVO LIMITE · {definition.suffix}</span>
                      <div>
                        <input
                          aria-label={`Novo limite de ${definition.label}`}
                          max={definition.maximum}
                          min={definition.minimum}
                          type="number"
                          value={draftValue}
                          onChange={(event) =>
                            setThresholdDrafts((current) => ({
                              ...current,
                              [definition.key]: Number(event.target.value),
                            }))
                          }
                        />
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            void runAdminAction(
                              `threshold-${definition.key}`,
                              {
                                action: "update-threshold",
                                setting: definition.key,
                                value: draftValue,
                              },
                            )
                          }
                        >
                          SALVAR
                        </button>
                      </div>
                    </label>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-panel admin-simulator-panel">
            <div className="admin-panel-heading">
              <div>
                <span>LABORATÓRIO ECONÔMICO</span>
                <h2>Simulador de rebalanceamento</h2>
              </div>
              <small>NÃO APLICA MUDANÇAS</small>
            </div>
            <div className="admin-simulator-layout">
              <div className="admin-simulator-controls">
                <div className="admin-simulator-note">
                  <b>SIMULAÇÃO ISOLADA</b>
                  <p>
                    Ajuste os percentuais para prever progressão, emissão e
                    preços. Nenhum resultado é salvo no jogo.
                  </p>
                </div>
                {simulatorControls.map((control) => (
                  <label key={control.key}>
                    <span>
                      {control.label}
                      <strong>{simulationInput[control.key]}%</strong>
                    </span>
                    <input
                      aria-label={control.label}
                      max={control.maximum}
                      min={control.minimum}
                      type="range"
                      value={simulationInput[control.key]}
                      onChange={(event) =>
                        setSimulationInput((current) => ({
                          ...current,
                          [control.key]: Number(event.target.value),
                        }))
                      }
                    />
                    <small>
                      {control.minimum}% <i /> BASE 100% <i /> {control.maximum}%
                    </small>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSimulationInput({ ...DEFAULT_SIMULATION_INPUT })
                  }
                >
                  RESTAURAR CENÁRIO BASE
                </button>
              </div>
              <div className="admin-simulation-result">
                <div className={`admin-simulation-status ${simulation.status}`}>
                  <span>LEITURA DO CENÁRIO</span>
                  <strong>
                    {simulation.status === "stable"
                      ? "FAIXA CONTROLADA"
                      : simulation.status === "critical"
                        ? "PROGRESSÃO RÁPIDA DEMAIS"
                        : simulation.status === "attention"
                          ? "EXIGE ATENÇÃO"
                          : "PROGRESSÃO MUITO LENTA"}
                  </strong>
                  <p>
                    Projeção virtual para comparação interna. Não representa
                    retorno financeiro nem promessa de ganho.
                  </p>
                </div>
                <div className="admin-simulation-metrics">
                  <article>
                    <span>PROGRESSÃO ESTIMADA</span>
                    <strong>{simulation.progressionDays} dias</strong>
                    <small>referência atual: 303 dias</small>
                  </article>
                  <article>
                    <span>ORÇAMENTO DE PODER</span>
                    <strong>
                      {formatNumber(simulation.dailyPowerBudgetGh)} GH/s
                    </strong>
                    <small>por conta e ciclo UTC</small>
                  </article>
                  <article>
                    <span>ÍNDICE DE SUMIDOURO</span>
                    <strong>{simulation.sinkIndex}</strong>
                    <small>base atual: 100</small>
                  </article>
                  <article>
                    <span>REDE SIMULADA</span>
                    <strong>
                      {simulation.normalized.networkDifficultyPercent}%
                    </strong>
                    <small>não altera blocos existentes</small>
                  </article>
                </div>
                <div className="admin-simulation-prices">
                  <section>
                    <span>MINERADORES PROJETADOS</span>
                    {simulation.adjustedMiners
                      .filter((_, index) => [0, 4, 6].includes(index))
                      .map((miner) => (
                        <div key={miner.id}>
                          <strong>{miner.name}</strong>
                          <b>{formatCma(miner.priceCma)}</b>
                        </div>
                      ))}
                  </section>
                  <section>
                    <span>CAIXAS PROJETADAS</span>
                    {simulation.adjustedCrates.map((crate) => (
                      <div key={crate.id}>
                        <strong>{crate.name}</strong>
                        <b>{formatCma(crate.priceCma)}</b>
                      </div>
                    ))}
                  </section>
                </div>
              </div>
            </div>
          </section>

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
              <div>
                <span>MINERADORES</span>
                <strong>{formatNumber(overview.inventory.totalMiners)}</strong>
              </div>
              <div>
                <span>MAIOR CONCENTRAÇÃO</span>
                <strong>
                  {overview.inventory.minerConcentrationPercent}%
                </strong>
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
