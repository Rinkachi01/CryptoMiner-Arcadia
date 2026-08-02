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
  SeasonEconomicReport,
  SeasonLeaderboardEntry,
  SeasonSnapshot,
} from "./season-server";
import type { NetworkPowerSnapshot } from "./network-server";
import type { OperationalHealthReport } from "./operations-server";
import type {
  RecoveryDrillChecks,
  RecoveryOverview,
} from "./recovery-server";
import type { SecurityOverview } from "./security-server";
import type { ConversionOverview } from "./conversion-server";
import { BLOCKS_PER_DAY, formatAtomic, pools, type PoolId } from "./game-rules";

type AdminOverview = {
  alerts: AdminAlert[];
  audit: Array<{
    action: string;
    createdAt: number;
    metadata: Record<string, unknown>;
  }>;
  beta: {
    accessibility: {
      controlsEasyRate: number;
      largeTextProfiles: number;
      motionComfortableRate: number;
      rackClearRate: number;
      reviews30d: number;
      textReadableRate: number;
      touchReviews: number;
    };
    behaviorSignals: {
      arcade: {
        deltaPercentagePoints: number;
        exposed: number;
        exposedRate: number;
        reliable: boolean;
        unexposed: number;
        unexposedRate: number;
      };
      energy: {
        deltaPercentagePoints: number;
        exposed: number;
        exposedRate: number;
        reliable: boolean;
        unexposed: number;
        unexposedRate: number;
      };
      notice: string;
    };
    cohorts: Array<{
      arcade7d: number;
      energy7d: number;
      endAt: number;
      measurementComplete: boolean;
      returned7d: number;
      signups: number;
      startAt: number;
    }>;
    definitions: {
      active: string;
      returned: string;
    };
    deviceFunnel: {
      coverage: {
        percent: number;
        profiled: number;
        total: number;
      };
      inputModes: Array<{
        id: string;
        label: string;
        totalStarted: number;
        stages: Array<{
          id: string;
          label: string;
          accounts: number;
          conversionFromStart: number;
          dropoffFromPrevious: number;
        }>;
      }>;
      viewports: Array<{
        id: string;
        label: string;
        totalStarted: number;
        stages: Array<{
          id: string;
          label: string;
          accounts: number;
          conversionFromStart: number;
          dropoffFromPrevious: number;
        }>;
      }>;
    };
    maintenance: {
      archivedProofs: number;
      eligibleProofs: number;
      retentionDays: number;
    };
    onboarding: {
      started7d: number;
      totalStarted: number;
      stages: Array<{
        id: string;
        label: string;
        accounts: number;
        conversionFromStart: number;
        dropoffFromPrevious: number;
      }>;
    };
    preferences: {
      ask: number;
      disabled: number;
      unset: number;
    };
    summary: {
      activePlayers7d: number;
      arcadePlayers7d: number;
      energyPlayers7d: number;
      expandedPlayers: number;
      newPlayers7d: number;
      returningPlayers7d: number;
      totalPlayers: number;
    };
    windowDays: number;
  };
  conversion: ConversionOverview;
  games: Array<{
    gameId: string;
    plays: number;
    power: number;
    wins: number;
  }>;
  feedback: {
    averageRating: number;
    recent: Array<{
      category: string;
      createdAt: number;
      displayName: string;
      id: string;
      message: string;
      rating: number;
      status: string;
    }>;
    statusCounts: {
      new: number;
      planned: number;
      resolved: number;
      reviewing: number;
    };
    total30d: number;
  };
  emission24h: {
    rewardsAtomic: Record<PoolId, number>;
    settlementRecords: number;
  };
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
  operations: OperationalHealthReport;
  recovery: RecoveryOverview;
  security: SecurityOverview;
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
  seasonReport: SeasonEconomicReport | null;
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

const feedbackCategoryLabels: Record<string, string> = {
  economy: "Economia e pools",
  interface: "Interface e leitura",
  minigames: "Minigames",
  racks: "Racks e mineradores",
  tasks: "Tarefas e monetização",
};

const feedbackStatusLabels: Record<string, string> = {
  new: "Recebido",
  reviewing: "Em análise",
  planned: "Planejado",
  resolved: "Resolvido",
};

const actionLabels: Record<string, string> = {
  starter_kit_granted: "Kits iniciais entregues",
  buy_batteries: "Baterias compradas",
  buy_miners: "Mineradores comprados",
  buy_racks: "Racks comprados",
  buy_room: "Salas compradas",
  daily_mission_battery: "Baterias diárias",
  claim_energy: "Energia resgatada",
  open_supply_crate: "Caixas abertas",
  admin_test_cma_grant: "Crédito CMA de teste",
  block_settlement: "Blocos minerados",
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

function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} MB`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 1024).toLocaleString("pt-BR")} KB`;
  }
  return `${Math.max(0, value).toLocaleString("pt-BR")} bytes`;
}

function formatSignedNumber(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("pt-BR")}`;
}

const seasonReviewChecks: Array<{
  key: keyof SeasonEconomicReport["checks"];
  label: string;
}> = [
  { key: "seasonClosed", label: "Temporada encerrada" },
  { key: "enoughPlayers", label: "Ao menos 5 operadores ativos" },
  { key: "enoughActivity", label: "Atividade mínima por operador" },
  { key: "enoughSnapshots", label: "Dois pontos de comparação" },
  { key: "reviewQueueClear", label: "Fila antifraude revisada" },
];

const recoveryDrillLabels: Array<{
  key: keyof RecoveryDrillChecks;
  label: string;
}> = [
  { key: "storageObjectReadable", label: "Arquivo externo legível" },
  { key: "checksumMatches", label: "Checksum íntegro" },
  { key: "schemaRecognized", label: "Versão reconhecida" },
  { key: "payloadComplete", label: "Tabelas essenciais presentes" },
  { key: "accountStatesReadable", label: "Estados de conta reconstruíveis" },
  { key: "ledgerAccountsPresent", label: "Ledger vinculado às contas" },
  { key: "ledgerVersionsSafe", label: "Versões do ledger consistentes" },
  { key: "networkAccountsPresent", label: "Índice ligado às contas" },
  { key: "archiveFresh", label: "Cópia dentro da janela de 7 dias" },
];

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

function ratioPercent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function formatShortDate(value: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
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
  const [rewardDrafts, setRewardDrafts] = useState<
    Partial<Record<PoolId, string>>
  >({});
  const [simulationInput, setSimulationInput] =
    useState<EconomySimulationInput>(DEFAULT_SIMULATION_INPUT);
  const [seasonName, setSeasonName] = useState("Temporada Beta");
  const [seasonDurationDays, setSeasonDurationDays] = useState(30);
  const [textScale, setTextScale] =
    useState<TextScale>("comfortable");
  const [maintenanceArmed, setMaintenanceArmed] = useState(false);

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

  function saveBlockBudget() {
    if (!overview) return;
    const rewards = Object.fromEntries(
      pools.map((pool) => {
        const fallback =
          pool.id === "btc"
            ? overview.network.baseBlockRewardAtomic[pool.id]
            : overview.network.baseBlockRewardAtomic[pool.id] /
              10 ** pool.decimals;
        const value = Number(rewardDrafts[pool.id] ?? fallback);
        return [
          pool.id,
          pool.id === "btc"
            ? Math.round(value)
            : Math.round(value * 10 ** pool.decimals),
        ];
      }),
    ) as Record<PoolId, number>;
    void runAdminAction("set-block-budget", {
      action: "set-block-budget",
      rewards,
    });
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

      <section className="admin-panel admin-launch-readiness">
        <div className="admin-panel-heading">
          <div>
            <span>PRÉ-LANÇAMENTO PÚBLICO · SEGURANÇA E FINANÇAS</span>
            <h2>Portões antes de abrir o Arcadia</h2>
          </div>
          <small>DINHEIRO REAL E SAQUES CONTINUAM DESATIVADOS</small>
        </div>

        <div className="admin-launch-grid">
          <article className="ready">
            <b>01</b>
            <span>SERVIDOR AUTORITATIVO</span>
            <strong>PRONTO</strong>
            <p>Sessões, placar, recompensas e limites são conferidos no servidor.</p>
          </article>
          <article className="ready">
            <b>02</b>
            <span>ANTI-AUTOMAÇÃO</span>
            <strong>ATIVO</strong>
            <p>Limite global por conta e padrões impossíveis entram em revisão.</p>
          </article>
          <article className={overview.security.configured ? "ready" : "pending"}>
            <b>03</b>
            <span>DESAFIO HUMANO</span>
            <strong>
              {overview.security.required
                ? "OBRIGATÓRIO"
                : overview.security.configured
                  ? "PREPARADO"
                  : "AGUARDA CHAVES"}
            </strong>
            <p>Turnstile opcional, validado no servidor e com passe de 12 horas.</p>
          </article>
          <article className="pending">
            <b>04</b>
            <span>LOGIN PÚBLICO</span>
            <strong>PENDENTE</strong>
            <p>Escolher provedor, recuperação de senha e MFA do proprietário.</p>
          </article>
          <article className="ready">
            <b>05</b>
            <span>CONVERSÃO PARA CMA</span>
            <strong>BTC / DOGE ATIVO</strong>
            <p>Conversão interna registrada; depósitos continuam bloqueados até o provedor.</p>
          </article>
          <article className="pending">
            <b>06</b>
            <span>ABERTURA PÚBLICA</span>
            <strong>EXIGE APROVAÇÃO</strong>
            <p>Domínio, termos, privacidade, teste de carga e recuperação primeiro.</p>
          </article>
        </div>

        <section className="owner-launch-checklist" aria-labelledby="owner-next-actions">
          <header>
            <div>
              <span>PRÓXIMAS AÇÕES DO PROPRIETÁRIO</span>
              <h3 id="owner-next-actions">O que você precisa providenciar</h3>
            </div>
            <strong>BETA PÚBLICO PRIMEIRO · DINHEIRO REAL DEPOIS</strong>
          </header>
          <div>
            <article className="next">
              <b>1</b>
              <div>
                <span>DOMÍNIO E CONTATO</span>
                <strong>Registrar o domínio oficial</strong>
                <p>
                  Escolha o endereço do Arcadia e crie um e-mail administrativo
                  separado da conta dos jogadores. O HTTPS será configurado na
                  hospedagem, sem comprar certificado à parte.
                </p>
              </div>
              <em>VOCÊ</em>
            </article>
            <article className="next">
              <b>2</b>
              <div>
                <span>CADASTRO E LOGIN</span>
                <strong>Escolher o serviço de contas públicas</strong>
                <p>
                  Precisamos de e-mail verificado, recuperação de senha, sessões
                  seguras e autenticação reforçada na conta do proprietário.
                </p>
              </div>
              <em>VOCÊ + ARCADIA</em>
            </article>
            <article className="blocked">
              <b>3</b>
              <div>
                <span>BASE LEGAL</span>
                <strong>Validar empresa, termos e privacidade</strong>
                <p>
                  Antes de aceitar dinheiro real, confirme o modelo com contador e
                  assessoria jurídica, incluindo LGPD, política de reembolso e idade
                  mínima.
                </p>
              </div>
              <em>EXTERNO</em>
            </article>
            <article className="blocked">
              <b>4</b>
              <div>
                <span>DEPÓSITOS BTC / DOGE</span>
                <strong>Contratar um provedor aprovado</strong>
                <p>
                  A estrutura individual e o histórico já existem. A cobrança só
                  será liberada depois da aprovação do provedor, credenciais de
                  produção e validação do pagamento no servidor.
                </p>
              </div>
              <em>AGUARDA CONTRATO</em>
            </article>
            <article className="later">
              <b>5</b>
              <div>
                <span>SAQUES</span>
                <strong>Fase posterior e separada</strong>
                <p>
                  CMA continuará não sacável. Saques de BTC ou DOGE exigirão KYC,
                  controles contra fraude, limites, reservas e um provedor de payout
                  autorizado.
                </p>
              </div>
              <em>NÃO LIBERAR AGORA</em>
            </article>
          </div>
        </section>

        <div className="admin-security-summary">
          <div>
            <span>EVENTOS DE SEGURANÇA · 24H</span>
            <strong>{formatNumber(overview.security.events24h)}</strong>
          </div>
          <div>
            <span>CONTAS LIMITADAS · 24H</span>
            <strong>{formatNumber(overview.security.blockedAccounts24h)}</strong>
          </div>
          <div>
            <span>PASSES HUMANOS ATIVOS</span>
            <strong>{formatNumber(overview.security.activePasses)}</strong>
          </div>
          <div>
            <span>CONVERSÕES CONCLUÍDAS · 24H</span>
            <strong>{formatNumber(overview.conversion.conversions24h)}</strong>
          </div>
        </div>
      </section>

      <section className="admin-panel admin-beta-observability">
        <div className="admin-panel-heading">
          <div>
            <span>BETA OBSERVÁVEL · JANELA DE 7 DIAS</span>
            <h2>Retenção, energia e Arcade</h2>
          </div>
          <small>DADOS DO SERVIDOR · SEM RASTREADOR EXTERNO</small>
        </div>

        <div className="admin-beta-summary">
          <article>
            <span>ATIVOS EM 7D</span>
            <strong>{formatNumber(overview.beta.summary.activePlayers7d)}</strong>
            <small>{overview.beta.definitions.active}</small>
          </article>
          <article>
            <span>RETORNANDO</span>
            <strong>
              {formatNumber(overview.beta.summary.returningPlayers7d)}
            </strong>
            <small>{overview.beta.definitions.returned}</small>
          </article>
          <article>
            <span>JOGARAM NO ARCADE</span>
            <strong>
              {ratioPercent(
                overview.beta.summary.arcadePlayers7d,
                overview.beta.summary.activePlayers7d,
              )}
              %
            </strong>
            <small>
              {overview.beta.summary.arcadePlayers7d} de{" "}
              {overview.beta.summary.activePlayers7d} ativos
            </small>
          </article>
          <article>
            <span>USARAM ENERGIA</span>
            <strong>
              {ratioPercent(
                overview.beta.summary.energyPlayers7d,
                overview.beta.summary.activePlayers7d,
              )}
              %
            </strong>
            <small>
              {overview.beta.summary.energyPlayers7d} de{" "}
              {overview.beta.summary.activePlayers7d} ativos
            </small>
          </article>
        </div>

        <section className="admin-onboarding-funnel">
          <header>
            <div>
              <span>FUNIL DO PRIMEIRO DIA · KIT ATUAL</span>
              <h3>Da entrega do Byte Spark ao primeiro bloco</h3>
            </div>
            <strong>
              {overview.beta.onboarding.started7d} nova(s) conta(s) em 7 dias
            </strong>
          </header>
          {overview.beta.onboarding.totalStarted === 0 ? (
            <p>
              O novo kit começou agora. As primeiras contas aparecerão aqui sem
              misturar jogadores antigos com a experiência atual.
            </p>
          ) : (
            <div className="admin-onboarding-stages">
              {overview.beta.onboarding.stages.map((stage, index) => (
                <article key={stage.id}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span>{stage.label}</span>
                  <strong>{stage.accounts}</strong>
                  <small>{stage.conversionFromStart}% desde o início</small>
                  {index > 0 && stage.dropoffFromPrevious > 0 && (
                    <em>-{stage.dropoffFromPrevious} na etapa anterior</em>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-device-lab">
          <header>
            <div>
              <span>LABORATÓRIO DE TELA E CONTROLE</span>
              <h3>Onde cada tipo de jogador interrompe o primeiro dia</h3>
              <p>
                Usa somente categorias amplas salvas na conta. Não há IP,
                localização, modelo do aparelho ou impressão digital.
              </p>
            </div>
            <strong>
              {overview.beta.deviceFunnel.coverage.percent}% COBERTO ·{" "}
              {overview.beta.deviceFunnel.coverage.profiled}/
              {overview.beta.deviceFunnel.coverage.total} PERFIS
            </strong>
          </header>

          <div className="admin-device-sections">
            <section>
              <div className="admin-device-section-heading">
                <span>POR TAMANHO DE TELA</span>
                <small>Categoria registrada na primeira visita</small>
              </div>
              <div className="admin-device-groups">
                {overview.beta.deviceFunnel.viewports.map((group) => (
                  <article key={group.id}>
                    <div>
                      <strong>{group.label}</strong>
                      <span>{group.totalStarted} conta(s)</span>
                    </div>
                    {group.stages.map((stage) => (
                      <div className="admin-device-stage" key={stage.id}>
                        <span>{stage.label}</span>
                        <b>{stage.conversionFromStart}%</b>
                        <i>
                          <em style={{ width: `${stage.conversionFromStart}%` }} />
                        </i>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            </section>

            <section>
              <div className="admin-device-section-heading">
                <span>POR FORMA DE CONTROLE</span>
                <small>Toque, ponteiro ou aparelho híbrido</small>
              </div>
              <div className="admin-device-groups compact">
                {overview.beta.deviceFunnel.inputModes.map((group) => {
                  const lastStage = group.stages.at(-1);
                  return (
                    <article key={group.id}>
                      <div>
                        <strong>{group.label}</strong>
                        <span>{group.totalStarted} conta(s)</span>
                      </div>
                      <div className="admin-device-stage featured">
                        <span>Chegaram ao primeiro bloco</span>
                        <b>{lastStage?.conversionFromStart ?? 0}%</b>
                        <i>
                          <em
                            style={{
                              width: `${lastStage?.conversionFromStart ?? 0}%`,
                            }}
                          />
                        </i>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="admin-accessibility-summary">
            <article>
              <span>LEITURA APROVADA</span>
              <strong>{overview.beta.accessibility.textReadableRate}%</strong>
            </article>
            <article>
              <span>CONTROLES APROVADOS</span>
              <strong>{overview.beta.accessibility.controlsEasyRate}%</strong>
            </article>
            <article>
              <span>MOVIMENTO CONFORTÁVEL</span>
              <strong>
                {overview.beta.accessibility.motionComfortableRate}%
              </strong>
            </article>
            <article>
              <span>RACK CLARO</span>
              <strong>{overview.beta.accessibility.rackClearRate}%</strong>
            </article>
            <aside>
              <b>{overview.beta.accessibility.reviews30d}</b>
              <span>teste(s) em 30 dias</span>
              <small>
                {overview.beta.accessibility.touchReviews} por toque/híbrido ·{" "}
                {overview.beta.accessibility.largeTextProfiles} perfil(is) com
                texto ampliado
              </small>
            </aside>
          </div>
        </section>

        <div className="admin-beta-analysis">
          {[
            ["ARCADE NO 1º DIA", overview.beta.behaviorSignals.arcade],
            ["ENERGIA NO 1º DIA", overview.beta.behaviorSignals.energy],
          ].map(([label, signal]) => {
            const observation = signal as
              typeof overview.beta.behaviorSignals.arcade;
            return (
              <article key={label as string}>
                <div>
                  <span>{label as string}</span>
                  <em className={observation.reliable ? "ready" : ""}>
                    {observation.reliable
                      ? "AMOSTRA MÍNIMA"
                      : "AMOSTRA PEQUENA"}
                  </em>
                </div>
                <strong>
                  {observation.deltaPercentagePoints > 0 ? "+" : ""}
                  {observation.deltaPercentagePoints} p.p.
                </strong>
                <p>diferença observada no retorno entre os dias 2 e 7</p>
                <dl>
                  <div>
                    <dt>Com o recurso</dt>
                    <dd>
                      {observation.exposedRate}% · {observation.exposed} conta(s)
                    </dd>
                  </div>
                  <div>
                    <dt>Sem o recurso</dt>
                    <dd>
                      {observation.unexposedRate}% · {observation.unexposed}{" "}
                      conta(s)
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
        <p className="admin-beta-notice">
          {overview.beta.behaviorSignals.notice} A leitura só ganha força com
          pelo menos cinco contas em cada grupo.
        </p>

        <div className="admin-cohort-table" role="table" aria-label="Coortes de retenção">
          <div role="row" className="heading">
            <span role="columnheader">COORTE</span>
            <span role="columnheader">ENTRADAS</span>
            <span role="columnheader">RETORNO 7D</span>
            <span role="columnheader">ARCADE</span>
            <span role="columnheader">ENERGIA</span>
          </div>
          {overview.beta.cohorts.map((cohort) => (
            <div role="row" key={cohort.startAt}>
              <strong role="cell">
                {formatShortDate(cohort.startAt)}–{formatShortDate(cohort.endAt)}
                {!cohort.measurementComplete && <small>EM ABERTO</small>}
              </strong>
              <span role="cell">{cohort.signups}</span>
              <span role="cell">
                {ratioPercent(cohort.returned7d, cohort.signups)}%
              </span>
              <span role="cell">
                {ratioPercent(cohort.arcade7d, cohort.signups)}%
              </span>
              <span role="cell">
                {ratioPercent(cohort.energy7d, cohort.signups)}%
              </span>
            </div>
          ))}
        </div>

        <div className="admin-data-stewardship">
          <div>
            <span>PREFERÊNCIAS DE TAREFAS</span>
            <strong>
              {overview.beta.preferences.ask} pedir autorização ·{" "}
              {overview.beta.preferences.disabled} desativadas
            </strong>
            <small>
              {overview.beta.preferences.unset} conta(s) ainda sem escolha
              salva. Nenhum parceiro está conectado.
            </small>
          </div>
          <div>
            <span>COMPROVANTES DE PARTIDA</span>
            <strong>
              {overview.beta.maintenance.eligibleProofs} elegível(is) ·{" "}
              {overview.beta.maintenance.archivedProofs} compactado(s)
            </strong>
            <small>
              Após {overview.beta.maintenance.retentionDays} dias, somente
              provas normais e encerradas podem ser compactadas. Resultado,
              recompensa e ledger permanecem intactos.
            </small>
          </div>
          <div className="admin-maintenance-action">
            {!maintenanceArmed ? (
              <button
                type="button"
                disabled={
                  overview.beta.maintenance.eligibleProofs === 0 ||
                  Boolean(busyAction)
                }
                onClick={() => setMaintenanceArmed(true)}
              >
                REVISAR COMPACTAÇÃO
              </button>
            ) : (
              <>
                <p>
                  Confirmar a compactação de{" "}
                  {overview.beta.maintenance.eligibleProofs} comprovante(s)?
                </p>
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => {
                    setMaintenanceArmed(false);
                    void runAdminAction("compact-game-proofs", {
                      action: "compact-game-proofs",
                    });
                  }}
                >
                  CONFIRMAR
                </button>
                <button
                  className="secondary"
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => setMaintenanceArmed(false)}
                >
                  CANCELAR
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="admin-panel admin-network-lab">
        <div className="admin-panel-heading">
          <div>
            <span>ORÇAMENTO DE EMISSÃO · SERVIDOR AUTORITATIVO</span>
            <h2>Blocos fixos e eventos temporários</h2>
          </div>
          <small className={overview.network.bonusActive ? "test-active" : ""}>
            {overview.network.bonusActive
              ? `EVENTO ${overview.network.bonusBps / 100}%`
              : "ORÇAMENTO-BASE"}
          </small>
        </div>

        <div className="admin-network-lab-copy">
          <div>
            <strong>Uma quantia fixa é disputada em cada bloco</strong>
            <p>
              O poder de um jogador altera apenas sua participação. Ele nunca
              aumenta a emissão total de CMA, BTC ou DOGE. Se todos dobrarem o
              poder, a divisão permanece igual.
            </p>
          </div>
          <aside>
            <span>LIMITE DIÁRIO PREVISÍVEL</span>
            <strong>144 blocos por rede a cada 24 horas</strong>
            <p>
              O teto diário é o valor do bloco multiplicado por 144. Eventos
              têm duração máxima de 24h, limite de 200% e ficam registrados na
              auditoria.
            </p>
            <small>
              {overview.emission24h.settlementRecords} registro(s) de crédito
              processados nas últimas 24 horas.
            </small>
          </aside>
        </div>

        <div className="admin-network-grid">
          {pools.map((pool) => {
            const atomic = overview.network.baseBlockRewardAtomic[pool.id];
            const activeDailyLimitAtomic =
              overview.network.blockRewardAtomic[pool.id] * BLOCKS_PER_DAY;
            const realizedAtomic =
              overview.emission24h.rewardsAtomic[pool.id] ?? 0;
            const utilizationPercent =
              activeDailyLimitAtomic > 0
                ? Math.min(
                    100,
                    (realizedAtomic / activeDailyLimitAtomic) * 100,
                  )
                : 0;
            const inputValue =
              rewardDrafts[pool.id] ??
              (pool.id === "btc"
                ? String(atomic)
                : String(atomic / 10 ** pool.decimals));
            return (
            <article key={pool.id}>
              <span>{pool.symbol} · BLOCO FIXO</span>
              <strong>
                {formatAtomic(
                  BigInt(overview.network.blockRewardAtomic[pool.id]),
                  pool.decimals,
                )}{" "}
                {pool.symbol}
              </strong>
              <dl>
                <div>
                  <dt>Rede de jogadores</dt>
                  <dd>{formatPower(overview.network.playerPowerGh[pool.id])}</dd>
                </div>
                <div>
                  <dt>Teto ativo em 24h</dt>
                  <dd>
                    {formatAtomic(
                      BigInt(overview.network.blockRewardAtomic[pool.id]) *
                        BigInt(BLOCKS_PER_DAY),
                      pool.decimals,
                    )}{" "}
                    {pool.symbol}
                  </dd>
                </div>
                <div>
                  <dt>Crédito processado em 24h</dt>
                  <dd>
                    {formatAtomic(BigInt(realizedAtomic), pool.decimals)}{" "}
                    {pool.symbol}
                  </dd>
                </div>
              </dl>
              <div className="admin-emission-progress">
                <span>
                  UTILIZAÇÃO DO TETO
                  <b>
                    {utilizationPercent.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </b>
                </span>
                <i>
                  <em style={{ width: `${utilizationPercent}%` }} />
                </i>
              </div>
              <label className="admin-block-budget-input">
                <span>
                  VALOR-BASE · {pool.id === "btc" ? "SATOSHIS" : pool.symbol}
                </span>
                <input
                  type="number"
                  min={pool.id === "cma" ? 0.001 : pool.id === "btc" ? 1 : 0.001}
                  max={pool.id === "cma" ? 0.05 : pool.id === "btc" ? 100 : 0.1}
                  step={pool.id === "btc" ? 1 : 0.001}
                  value={inputValue}
                  onChange={(event) =>
                    setRewardDrafts((current) => ({
                      ...current,
                      [pool.id]: event.target.value,
                    }))
                  }
                />
              </label>
            </article>
          )})}
        </div>

        <div className="admin-network-actions">
          <button
            type="button"
            disabled={busyAction === "set-block-budget"}
            onClick={saveBlockBudget}
          >
            {busyAction === "set-block-budget"
              ? "SALVANDO..."
              : "SALVAR ORÇAMENTO FIXO"}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={busyAction === "prepare-economic-test"}
            onClick={() =>
              void runAdminAction("prepare-economic-test", {
                action: "prepare-economic-test",
              })
            }
          >
            {busyAction === "prepare-economic-test"
              ? "RECARREGANDO..."
              : "REPOR CARTEIRA · 10.000 CMA"}
          </button>
          <small>
            Faixas seguras: 0,001–0,05 CMA; 1–100 satoshis; 0,001–0,1 DOGE.
            O saldo de teste não cria saque real.
          </small>
        </div>

        <div className="admin-network-actions admin-bonus-actions">
          <span>EVENTO TEMPORÁRIO</span>
          <button
            className="secondary"
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAdminAction("bonus-125", {
                action: "start-block-bonus",
                bonusBps: 12_500,
                durationHours: 6,
              })
            }
          >
            125% · 6H
          </button>
          <button
            className="secondary"
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAdminAction("bonus-150", {
                action: "start-block-bonus",
                bonusBps: 15_000,
                durationHours: 6,
              })
            }
          >
            150% · 6H
          </button>
          <button
            className="secondary"
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAdminAction("bonus-200", {
                action: "start-block-bonus",
                bonusBps: 20_000,
                durationHours: 1,
              })
            }
          >
            200% · 1H
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!overview.network.bonusActive || Boolean(busyAction)}
            onClick={() =>
              void runAdminAction("stop-block-bonus", {
                action: "stop-block-bonus",
              })
            }
          >
            ENCERRAR EVENTO
          </button>
          <small>
            {overview.network.bonusActive
              ? `Encerramento automático: ${formatDate(overview.network.bonusEndsAt)}.`
              : "Nenhum bônus ativo. O valor-base continua protegido."}
          </small>
        </div>
      </section>

      <section className="admin-panel admin-monetization-panel">
        <div className="admin-panel-heading">
          <div>
            <span>PRÓXIMA FRENTE · MONETIZAÇÃO RESPONSÁVEL</span>
            <h2>Receita sem inflar moedas ou poder</h2>
          </div>
          <small>INTEGRAÇÃO REAL DESATIVADA</small>
        </div>
        <div className="admin-monetization-grid">
          <article>
            <b>01</b>
            <div>
              <strong>Patrocínio visual</strong>
              <p>Banner identificado no Arcade, longe dos controles do jogo.</p>
            </div>
            <span>PRIMEIRO TESTE</span>
          </article>
          <article>
            <b>02</b>
            <div>
              <strong>Cosméticos</strong>
              <p>Temas de sala, molduras e skins sem vantagem de mineração.</p>
            </div>
            <span>SEGURO</span>
          </article>
          <article>
            <b>03</b>
            <div>
              <strong>Anúncio opcional</strong>
              <p>
                Somente após consentimento e antifraude; nunca paga CMA, BTC,
                DOGE ou poder.
              </p>
            </div>
            <span>FUTURO</span>
          </article>
        </div>
      </section>

      <section className="admin-panel admin-feedback-panel">
        <div className="admin-panel-heading">
          <div>
            <span>ESCUTA DO BETA · ÚLTIMOS 30 DIAS</span>
            <h2>Feedback enviado pelos operadores</h2>
          </div>
          <small>
            {overview.feedback.total30d} ENVIO(S) ·{" "}
            {overview.feedback.statusCounts.new} NOVO(S) · NOTA{" "}
            {overview.feedback.averageRating.toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}
            /5
          </small>
        </div>
        {overview.feedback.recent.length === 0 ? (
          <div className="admin-feedback-empty">
            As respostas enviadas pela nova Central de Tarefas aparecerão aqui.
          </div>
        ) : (
          <div className="admin-feedback-grid">
            {overview.feedback.recent.map((item) => (
              <article key={item.id}>
                <div>
                  <span>
                    {feedbackCategoryLabels[item.category] ?? item.category}
                  </span>
                  <b>{item.rating}/5</b>
                </div>
                <p>{item.message}</p>
                <footer>
                  <small>
                    {item.displayName} · {formatDate(item.createdAt)}
                  </small>
                  <label>
                    ETAPA
                    <select
                      value={item.status}
                      disabled={busyAction === `feedback-${item.id}`}
                      onChange={(event) =>
                        void runAdminAction(`feedback-${item.id}`, {
                          action: "set-feedback-status",
                          feedbackId: item.id,
                          feedbackStatus: event.target.value,
                        })
                      }
                    >
                      {Object.entries(feedbackStatusLabels).map(
                        ([status, label]) => (
                          <option key={status} value={status}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </footer>
              </article>
            ))}
          </div>
        )}
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

                {overview.seasonReport && (
                  <section className="admin-season-report">
                    <header>
                      <div>
                        <span>RELATÓRIO ECONÔMICO DO CICLO</span>
                        <h3>
                          {overview.seasonReport.status === "active"
                            ? "Leitura provisória da temporada"
                            : "Fechamento preservado da temporada"}
                        </h3>
                      </div>
                      <strong
                        className={
                          overview.seasonReport.readyForEconomyReview
                            ? "ready"
                            : "waiting"
                        }
                      >
                        {overview.seasonReport.readyForEconomyReview
                          ? "PRONTO PARA REVISÃO"
                          : "MANTER ECONOMIA ATUAL"}
                      </strong>
                    </header>

                    <div className="admin-season-report-metrics">
                      <article>
                        <span>OPERADORES ATIVOS</span>
                        <strong>
                          {formatNumber(
                            overview.seasonReport.metrics.activeOperators,
                          )}
                        </strong>
                        <small>
                          {formatNumber(
                            overview.seasonReport.metrics.newPlayers,
                          )} novos no ciclo
                        </small>
                      </article>
                      <article>
                        <span>ARCADE VALIDADO</span>
                        <strong>
                          {formatNumber(overview.seasonReport.metrics.games)}
                        </strong>
                        <small>
                          {overview.seasonReport.metrics.winRate}% de vitórias
                        </small>
                      </article>
                      <article>
                        <span>PODER TEMPORÁRIO</span>
                        <strong>
                          {formatNumber(
                            overview.seasonReport.metrics.powerGrantedGh,
                          )} GH/s
                        </strong>
                        <small>Concedido pelos minigames</small>
                      </article>
                      <article>
                        <span>CMA DOS BLOCOS</span>
                        <strong>
                          {formatCma(
                            overview.seasonReport.metrics.cmaBlockCredits,
                          )}
                        </strong>
                        <small>
                          {formatCma(overview.seasonReport.metrics.cmaSpent)} em
                          sumidouros
                        </small>
                      </article>
                      <article>
                        <span>ENERGIA E CAIXAS</span>
                        <strong>
                          {formatNumber(
                            overview.seasonReport.metrics.batteryClaims,
                          )} baterias
                        </strong>
                        <small>
                          {formatNumber(
                            overview.seasonReport.metrics.crateOpens,
                          )} caixas abertas
                        </small>
                      </article>
                      <article>
                        <span>CRÉDITOS DE TESTE</span>
                        <strong>
                          {formatCma(
                            overview.seasonReport.metrics.cmaTestCredits,
                          )} CMA
                        </strong>
                        <small>Separados da recompensa dos blocos</small>
                      </article>
                    </div>

                    <div className="admin-season-review-grid">
                      <div className="admin-season-checks">
                        <span>PORTÕES PARA REBALANCEAMENTO</span>
                        {seasonReviewChecks.map((check) => {
                          const passed = overview.seasonReport?.checks[check.key];
                          return (
                            <div className={passed ? "passed" : "pending"} key={check.key}>
                              <b>{passed ? "✓" : "○"}</b>
                              <span>{check.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="admin-season-comparison">
                        <span>TENDÊNCIA ENTRE SNAPSHOTS</span>
                        {overview.seasonReport.snapshotComparison ? (
                          <>
                            <div>
                              <small>Jogadores totais</small>
                              <strong>
                                {formatSignedNumber(
                                  overview.seasonReport.snapshotComparison
                                    .totalPlayersDelta,
                                )}
                              </strong>
                            </div>
                            <div>
                              <small>Ativos em 24h</small>
                              <strong>
                                {formatSignedNumber(
                                  overview.seasonReport.snapshotComparison
                                    .activePlayers24hDelta,
                                )}
                              </strong>
                            </div>
                            <div>
                              <small>Partidas em 24h</small>
                              <strong>
                                {formatSignedNumber(
                                  overview.seasonReport.snapshotComparison
                                    .games24hDelta,
                                )}
                              </strong>
                            </div>
                            <div>
                              <small>Poder em 24h</small>
                              <strong>
                                {formatSignedNumber(
                                  overview.seasonReport.snapshotComparison
                                    .powerGranted24hDelta,
                                )} GH/s
                              </strong>
                            </div>
                          </>
                        ) : (
                          <p>
                            Registre pelo menos dois snapshots para comparar a
                            evolução sem alterar a economia real.
                          </p>
                        )}
                      </div>
                    </div>

                    <footer>
                      <strong>
                        BTC creditado: {formatAtomic(
                          BigInt(
                            overview.seasonReport.metrics.btcCreditedAtomic,
                          ),
                          8,
                        )}
                      </strong>
                      <strong>
                        DOGE creditado: {formatAtomic(
                          BigInt(
                            overview.seasonReport.metrics.dogeCreditedAtomic,
                          ),
                          8,
                        )}
                      </strong>
                      <span>
                        Nenhum preço ou valor de bloco é alterado por este
                        relatório.
                      </span>
                    </footer>
                  </section>
                )}
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

          <section className="admin-panel admin-operations-panel">
            <div className="admin-panel-heading">
              <div>
                <span>INTEGRIDADE DO SERVIDOR</span>
                <h2>Central de Operações</h2>
              </div>
              <strong className={`admin-operations-status ${overview.operations.status}`}>
                {overview.operations.status === "stable"
                  ? "SISTEMA SAUDÁVEL"
                  : overview.operations.status === "critical"
                    ? "AÇÃO CRÍTICA"
                    : "EXIGE ATENÇÃO"}
              </strong>
            </div>

            <div className="admin-operations-summary">
              <article>
                <span>CONTAS MONITORADAS</span>
                <strong>{formatNumber(overview.operations.metrics.totalAccounts)}</strong>
                <small>Estados persistidos no servidor</small>
              </article>
              <article>
                <span>ESTADOS ILEGÍVEIS</span>
                <strong>{formatNumber(overview.operations.metrics.invalidStateRows)}</strong>
                <small>Linhas que não passam na validação</small>
              </article>
              <article>
                <span>ÍNDICE DA REDE</span>
                <strong>
                  {formatNumber(
                    overview.operations.metrics.missingNetworkIndexes +
                      overview.operations.metrics.staleNetworkIndexes,
                  )}
                </strong>
                <small>
                  {overview.operations.metrics.missingNetworkIndexes} ausentes ·{" "}
                  {overview.operations.metrics.staleNetworkIndexes} atrasados
                </small>
              </article>
              <article>
                <span>SESSÕES EXPIRADAS</span>
                <strong>{formatNumber(overview.operations.metrics.stuckGameSessions)}</strong>
                <small>Partidas ainda marcadas como ativas</small>
              </article>
              <article>
                <span>RESGATES INTERROMPIDOS</span>
                <strong>
                  {formatNumber(overview.operations.metrics.reservedMissionClaims)}
                </strong>
                <small>Reservados há mais de 30 minutos</small>
              </article>
              <article>
                <span>REVISÕES ANTIFRAUDE</span>
                <strong>{formatNumber(overview.operations.metrics.openRiskReviews)}</strong>
                <small>Sessões preservadas aguardando decisão</small>
              </article>
            </div>

            <div className="admin-operations-body">
              <section className="admin-integrity-checklist">
                <header>
                  <div>
                    <span>DIAGNÓSTICO ATUAL</span>
                    <strong>{formatDate(overview.operations.checkedAt)}</strong>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      void runAdminAction("operations-checkpoint", {
                        action: "create-operations-checkpoint",
                      })
                    }
                  >
                    {busyAction === "operations-checkpoint"
                      ? "REGISTRANDO…"
                      : "REGISTRAR CHECKPOINT"}
                  </button>
                </header>
                <div>
                  {overview.operations.findings.map((finding) => (
                    <article className={finding.severity} key={finding.id}>
                      <i aria-hidden="true" />
                      <div>
                        <strong>{finding.label}</strong>
                        <p>{finding.description}</p>
                      </div>
                      <span>
                        {finding.severity === "stable"
                          ? "SAUDÁVEL"
                          : finding.severity === "critical"
                            ? "CRÍTICO"
                            : "ATENÇÃO"}
                      </span>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="admin-checkpoint-history">
                <header>
                  <span>CHECKPOINTS RECENTES</span>
                  <small>Últimos {overview.operations.checkpoints.length} registros</small>
                </header>
                {overview.operations.checkpoints.length === 0 ? (
                  <p>
                    Ainda não há fotografia de comparação. O primeiro registro não
                    altera nenhum dado do jogo.
                  </p>
                ) : (
                  overview.operations.checkpoints.map((checkpoint) => (
                    <article key={checkpoint.id}>
                      <i className={checkpoint.status} />
                      <div>
                        <strong>{formatDate(checkpoint.createdAt)}</strong>
                        <small>{shortId(checkpoint.id)}</small>
                      </div>
                      <span>{checkpoint.status.toUpperCase()}</span>
                    </article>
                  ))
                )}
                <footer>
                  <strong>Checkpoint não é backup.</strong>
                  <span>
                    Ele preserva métricas e alertas para comparação e auditoria.
                  </span>
                </footer>
              </aside>
            </div>

            <section className="admin-incident-runbook">
              <header>
                <div>
                  <span>SIMULAÇÃO DE INCIDENTES</span>
                  <h3>Plano de resposta segura</h3>
                </div>
                <small>NÃO ALTERA DADOS REAIS</small>
              </header>
              <div>
                {overview.operations.runbook.map((scenario) => (
                  <article className={scenario.status} key={scenario.id}>
                    <header>
                      <span>
                        {scenario.status === "triggered" ? "SINAL ATIVO" : "PRONTO"}
                      </span>
                      <strong>{scenario.title}</strong>
                    </header>
                    <dl>
                      <div>
                        <dt>GATILHO</dt>
                        <dd>{scenario.trigger}</dd>
                      </div>
                      <div>
                        <dt>IMPACTO</dt>
                        <dd>{scenario.impact}</dd>
                      </div>
                      <div>
                        <dt>AÇÃO SEGURA</dt>
                        <dd>{scenario.safeAction}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <section className="admin-panel admin-recovery-panel">
            <div className="admin-panel-heading">
              <div>
                <span>CONTINUIDADE DO PROJETO</span>
                <h2>Backup e restauração</h2>
              </div>
              <strong className={`admin-recovery-status ${overview.recovery.status}`}>
                {overview.recovery.status === "stable"
                  ? "RECUPERAÇÃO PRONTA"
                  : overview.recovery.status === "critical"
                    ? "PROTEÇÃO INCOMPLETA"
                    : "PREPARAÇÃO PENDENTE"}
              </strong>
            </div>

            <div className="admin-recovery-summary">
              <article>
                <span>ARMAZENAMENTO EXTERNO</span>
                <strong>
                  {overview.recovery.storageConnected ? "CONECTADO" : "INDISPONÍVEL"}
                </strong>
                <small>Separado do banco operacional</small>
              </article>
              <article>
                <span>ÚLTIMA CÓPIA COMPLETA</span>
                <strong>{formatDate(overview.recovery.latestArchive?.createdAt ?? null)}</strong>
                <small>
                  {overview.recovery.latestArchive
                    ? `${formatNumber(overview.recovery.latestArchive.rowCount)} registros`
                    : "Nenhuma cópia criada"}
                </small>
              </article>
              <article>
                <span>TAMANHO DO PACOTE</span>
                <strong>
                  {overview.recovery.latestArchive
                    ? formatBytes(overview.recovery.latestArchive.sizeBytes)
                    : "—"}
                </strong>
                <small>Limite seguro atual: 24 MB</small>
              </article>
              <article>
                <span>ÚLTIMO ENSAIO</span>
                <strong>
                  {overview.recovery.latestDrill?.status === "passed"
                    ? "APROVADO"
                    : overview.recovery.latestDrill
                      ? "REPROVADO"
                      : "NÃO EXECUTADO"}
                </strong>
                <small>{formatDate(overview.recovery.latestDrill?.createdAt ?? null)}</small>
              </article>
            </div>

            <div className="admin-recovery-actions">
              <div>
                <span>PACOTE COMPLETO E SENSÍVEL</span>
                <p>
                  A cópia inclui contas, inventários, ledger e configurações. Ela fica
                  fora do banco principal e deve ser baixada apenas para armazenamento
                  seguro do proprietário.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  disabled={Boolean(busyAction) || !overview.recovery.storageConnected}
                  onClick={() =>
                    void runAdminAction("create-recovery-archive", {
                      action: "create-recovery-archive",
                    })
                  }
                >
                  {busyAction === "create-recovery-archive"
                    ? "CRIANDO CÓPIA…"
                    : "CRIAR CÓPIA EXTERNA"}
                </button>
                <button
                  className="secondary"
                  type="button"
                  disabled={
                    Boolean(busyAction) ||
                    !overview.recovery.storageConnected ||
                    !overview.recovery.latestArchive
                  }
                  onClick={() =>
                    void runAdminAction("run-recovery-drill", {
                      action: "run-recovery-drill",
                    })
                  }
                >
                  {busyAction === "run-recovery-drill"
                    ? "VALIDANDO…"
                    : "SIMULAR RESTAURAÇÃO"}
                </button>
                {overview.recovery.latestArchive &&
                overview.recovery.storageConnected ? (
                  <a href="/api/admin/recovery/latest">BAIXAR ÚLTIMA CÓPIA</a>
                ) : (
                  <span className="disabled">DOWNLOAD APÓS A PRIMEIRA CÓPIA</span>
                )}
              </div>
            </div>

            <div className="admin-recovery-body">
              <section className="admin-recovery-gates">
                <header>
                  <span>PORTÕES DE RECUPERAÇÃO</span>
                  <small>{overview.recovery.gates.filter((gate) => gate.passed).length}/4 prontos</small>
                </header>
                {overview.recovery.gates.map((gate) => (
                  <article className={gate.passed ? "passed" : "pending"} key={gate.id}>
                    <b>{gate.passed ? "✓" : "○"}</b>
                    <span>{gate.label}</span>
                  </article>
                ))}
              </section>

              <section className="admin-recovery-drill">
                <header>
                  <span>VALIDAÇÃO DA ÚLTIMA CÓPIA</span>
                  <small>NENHUMA CONTA É SOBRESCRITA</small>
                </header>
                {recoveryDrillLabels.map((check) => {
                  const passed = overview.recovery.latestDrill?.checks[check.key] === true;
                  return (
                    <article className={passed ? "passed" : "pending"} key={check.key}>
                      <i />
                      <span>{check.label}</span>
                    </article>
                  );
                })}
              </section>
            </div>

            <div className="admin-recovery-history">
              <header>
                <div>
                  <span>HISTÓRICO DE CÓPIAS</span>
                  <strong>{overview.recovery.archives.length} tentativas recentes</strong>
                </div>
                <small>RETENÇÃO SEM EXCLUSÃO AUTOMÁTICA</small>
              </header>
              {overview.recovery.archives.length === 0 ? (
                <p>A primeira cópia completa ainda precisa ser criada.</p>
              ) : (
                <div>
                  {overview.recovery.archives.map((archive) => (
                    <article className={archive.status} key={archive.id}>
                      <i />
                      <div>
                        <strong>{formatDate(archive.createdAt)}</strong>
                        <small>{shortId(archive.id)}</small>
                      </div>
                      <span>
                        {archive.status === "ready"
                          ? `${formatBytes(archive.sizeBytes)} · ${formatNumber(archive.rowCount)} linhas`
                          : archive.errorMessage ?? "Preparando pacote"}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <section className="admin-release-readiness">
              <header>
                <span>PRÓXIMAS FASES ACELERADAS</span>
                <h3>Prontidão para ampliar o beta</h3>
              </header>
              <div>
                <article className={overview.operations.status === "stable" ? "ready" : "waiting"}>
                  <b>{overview.operations.status === "stable" ? "✓" : "1"}</b>
                  <div>
                    <strong>Integridade operacional</strong>
                    <span>Central sem sinais críticos e checkpoint recente.</span>
                  </div>
                </article>
                <article className={overview.recovery.status === "stable" ? "ready" : "waiting"}>
                  <b>{overview.recovery.status === "stable" ? "✓" : "2"}</b>
                  <div>
                    <strong>Recuperação comprovada</strong>
                    <span>Cópia externa recente e ensaio aprovado.</span>
                  </div>
                </article>
                <article className={overview.seasonReport?.readyForEconomyReview ? "ready" : "waiting"}>
                  <b>{overview.seasonReport?.readyForEconomyReview ? "✓" : "3"}</b>
                  <div>
                    <strong>Temporada econômica</strong>
                    <span>Os cinco portões precisam encerrar verdes.</span>
                  </div>
                </article>
                <article className="external">
                  <b>4</b>
                  <div>
                    <strong>Autenticação pública</strong>
                    <span>Depende da escolha do provedor e da hospedagem final.</span>
                  </div>
                </article>
                <article className="external">
                  <b>5</b>
                  <div>
                    <strong>Teste com jogadores reais</strong>
                    <span>Leitura, toque e onboarding precisam de validação externa.</span>
                  </div>
                </article>
              </div>
            </section>
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
                    <span>RITMO RELATIVO DO CATÁLOGO</span>
                    <strong>
                      {Math.round((303 / simulation.progressionDays) * 100)}%
                    </strong>
                    <small>100% = cenário-base, sem promessa de prazo</small>
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
