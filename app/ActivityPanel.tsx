"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityCategory } from "./activity-rules";

type ActivityFilter = "all" | ActivityCategory;

type ActivityItem = {
  id: string;
  source: "ledger" | "arcade";
  status: "verified" | "review";
  createdAt: number;
  cmaDelta: number;
  powerGh: number;
  walletRewards: Array<{
    symbol: "CMA" | "BTC" | "DOGE";
    amount: number;
  }>;
  category: ActivityCategory;
  title: string;
  description: string;
};

type ActivityResponse = {
  account: {
    createdAt: number;
    lastSavedAt: number;
  };
  summary: {
    verifiedRecords: number;
    cmaEarned: number;
    cmaSpent: number;
    miningRecords: number;
    cratesOpened: number;
    gamesPlayed: number;
    gamesWon: number;
    temporaryPowerGh: number;
    reviews: number;
  };
  timeline: ActivityItem[];
  periodDays: number;
  retention: {
    visibleDays: number;
    maxTimelineRows: number;
    economicLedger: "all_time";
  };
  generatedAt: number;
  integrityNotice: string;
  error?: string;
};

const filters: Array<{ id: ActivityFilter; label: string }> = [
  { id: "all", label: "Tudo" },
  { id: "mining", label: "Mineração" },
  { id: "arcade", label: "Arcade" },
  { id: "economy", label: "Compras" },
  { id: "equipment", label: "Equipamentos" },
  { id: "energy", label: "Energia" },
];

const categoryGlyphs: Record<ActivityCategory, string> = {
  account: "ID",
  mining: "H",
  arcade: "G",
  economy: "$",
  equipment: "R",
  energy: "E",
};

function formatCma(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatWalletAmount(value: number, symbol: "CMA" | "BTC" | "DOGE") {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: symbol === "CMA" ? 2 : 0,
    maximumFractionDigits: symbol === "CMA" ? 6 : 8,
  });
}

function formatPower(powerGh: number) {
  if (powerGh >= 1_000_000) {
    return `${(powerGh / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} PH/s`;
  }
  if (powerGh >= 1_000) {
    return `${(powerGh / 1_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} TH/s`;
  }
  return `${powerGh.toLocaleString("pt-BR")} GH/s`;
}

function formatDate(timestamp: number, includeTime = true) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(timestamp);
}

export function ActivityPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [requestKey, setRequestKey] = useState(0);
  const [message, setMessage] = useState("Carregando seu histórico...");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/activity", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as ActivityResponse;
        if (!response.ok) {
          throw new Error(result.error ?? "Histórico indisponível.");
        }
        setData(result);
        setMessage("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar seu histórico.",
        );
      });
    return () => controller.abort();
  }, [refreshKey, requestKey]);

  const filteredTimeline = useMemo(
    () =>
      data?.timeline.filter(
        (item) => filter === "all" || item.category === filter,
      ) ?? [],
    [data, filter],
  );

  if (!data) {
    return (
      <section className="activity-panel-loading" aria-live="polite">
        <span className="online-dot" />
        {message}
      </section>
    );
  }

  const winRate =
    data.summary.gamesPlayed > 0
      ? Math.round((data.summary.gamesWon / data.summary.gamesPlayed) * 100)
      : 0;

  return (
    <section className="activity-panel">
      <header className="activity-overview">
        <div>
          <span className="eyebrow">
            ÚLTIMOS {data.periodDays} DIAS · CONTA PESSOAL
          </span>
          <h3>Seu histórico, sem mistério</h3>
          <p>
            Compras, mineração, energia e partidas aparecem em uma única linha
            do tempo. Os dados vêm da sua conta protegida no servidor.
          </p>
        </div>
        <aside>
          <span>CONTA ATIVA DESDE</span>
          <strong>{formatDate(data.account.createdAt, false)}</strong>
          <small>Último salvamento: {formatDate(data.account.lastSavedAt)}</small>
        </aside>
      </header>

      <div className="activity-metrics" aria-label="Resumo dos últimos 30 dias">
        <article>
          <span>REGISTROS VERIFICADOS</span>
          <strong>{data.summary.verifiedRecords.toLocaleString("pt-BR")}</strong>
          <small>ações e partidas confirmadas</small>
        </article>
        <article>
          <span>MINERAÇÃO</span>
          <strong>{data.summary.miningRecords.toLocaleString("pt-BR")}</strong>
          <small>fechamentos registrados</small>
        </article>
        <article>
          <span>ARCADE</span>
          <strong>{winRate}%</strong>
          <small>
            {data.summary.gamesWon} vitórias em {data.summary.gamesPlayed} partidas
          </small>
        </article>
        <article>
          <span>PODER TEMPORÁRIO</span>
          <strong>{formatPower(data.summary.temporaryPowerGh)}</strong>
          <small>concedido por partidas concluídas</small>
        </article>
      </div>

      <div className="activity-ledger-summary">
        <div>
          <span>CMA RECEBIDO</span>
          <strong className="positive">+{formatCma(data.summary.cmaEarned)}</strong>
        </div>
        <div>
          <span>CMA UTILIZADO</span>
          <strong className="negative">−{formatCma(data.summary.cmaSpent)}</strong>
        </div>
        <div>
          <span>CAIXAS ABERTAS</span>
          <strong>{data.summary.cratesOpened}</strong>
        </div>
        <div>
          <span>STATUS DA AUDITORIA</span>
          <strong className={data.summary.reviews > 0 ? "attention" : "positive"}>
            {data.summary.reviews > 0
              ? `${data.summary.reviews} em análise`
              : "Tudo validado"}
          </strong>
        </div>
      </div>

      <section className="activity-timeline-card">
        <div className="activity-heading">
          <div>
            <span>LINHA DO TEMPO</span>
            <strong>Atividades mais recentes</strong>
          </div>
          <button type="button" onClick={() => setRequestKey((key) => key + 1)}>
            ATUALIZAR
          </button>
        </div>

        <nav className="activity-filters" aria-label="Filtrar histórico">
          {filters.map((item) => (
            <button
              type="button"
              className={filter === item.id ? "active" : ""}
              aria-pressed={filter === item.id}
              key={item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="activity-timeline" aria-live="polite">
          {filteredTimeline.length === 0 ? (
            <div className="activity-empty">
              <strong>Nenhuma atividade neste filtro</strong>
              <p>Quando você jogar, minerar ou organizar a sala, aparecerá aqui.</p>
            </div>
          ) : (
            filteredTimeline.map((item) => (
              <article key={item.id}>
                <span className={`activity-glyph ${item.category}`}>
                  {categoryGlyphs[item.category]}
                </span>
                <div className="activity-copy">
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    {formatDate(item.createdAt)}
                  </time>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
                <div className="activity-values">
                  {item.walletRewards.map((reward) => (
                    <b className="positive" key={reward.symbol}>
                      +{formatWalletAmount(reward.amount, reward.symbol)}{" "}
                      {reward.symbol}
                    </b>
                  ))}
                  {item.walletRewards.length === 0 && item.cmaDelta !== 0 && (
                    <b className={item.cmaDelta > 0 ? "positive" : "negative"}>
                      {item.cmaDelta > 0 ? "+" : "−"}
                      {formatCma(Math.abs(item.cmaDelta))} CMA
                    </b>
                  )}
                  {item.powerGh > 0 && <b>+{formatPower(item.powerGh)}</b>}
                  <small className={item.status}>
                    {item.status === "verified" ? "✓ SERVIDOR" : "EM ANÁLISE"}
                  </small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <footer className="activity-integrity-note">
        <span>✓</span>
        <p>
          <strong>Histórico pessoal autoritativo.</strong> {data.integrityNotice} Uma
          tela aberta em outro dispositivo não consegue reescrever estes registros.
          A tela consulta os últimos {data.retention.visibleDays} dias e mostra
          até {data.retention.maxTimelineRows} itens; o ledger econômico completo
          permanece preservado para auditoria, sem ser carregado inteiro no navegador.
        </p>
      </footer>
    </section>
  );
}
