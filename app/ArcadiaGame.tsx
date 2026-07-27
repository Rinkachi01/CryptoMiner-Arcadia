"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import {
  RACK_CAPACITY,
  RACK_COLUMNS,
  calculateEstimatedReward,
  defaultInstalledMiners,
  findNextAvailableSlot,
  formatAtomic,
  getInstalledEnergy,
  getInstalledPower,
  getMiner,
  getOccupiedSlots,
  getUsedSlotCount,
  miners,
  pools,
  type InstalledMiner,
  type PoolId,
} from "./game-rules";

type ViewId = "mine" | "pools" | "inventory";

const navigation: Array<{
  id: ViewId;
  label: string;
  shortLabel: string;
  glyph: string;
}> = [
  { id: "mine", label: "Sala de mineração", shortLabel: "Sala", glyph: "M" },
  { id: "pools", label: "Pools", shortLabel: "Pools", glyph: "P" },
  { id: "inventory", label: "Inventário", shortLabel: "Itens", glyph: "I" },
];

const balances = [
  {
    symbol: "CMA",
    value: "86.40",
    asset: assetsManifest.cmaCoin.path,
    alt: assetsManifest.cmaCoin.alt,
  },
  {
    symbol: "BTC",
    value: "0.00001284",
    asset: assetsManifest.bitcoin.path,
    alt: assetsManifest.bitcoin.alt,
  },
  {
    symbol: "DOGE",
    value: "6.42",
    asset: assetsManifest.dogecoin.path,
    alt: assetsManifest.dogecoin.alt,
  },
];

const rarityLabels = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
};

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatPower(powerGh: number) {
  if (powerGh >= 1000) {
    return `${(powerGh / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} TH/s`;
  }
  return `${powerGh.toLocaleString("pt-BR")} GH/s`;
}

function isSavedPlacement(value: unknown): value is InstalledMiner[] {
  if (!Array.isArray(value)) return false;

  return value.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Partial<InstalledMiner>;
    return (
      typeof candidate.minerId === "string" &&
      typeof candidate.slotIndex === "number" &&
      Boolean(getMiner(candidate.minerId))
    );
  });
}

export function ArcadiaGame() {
  const [activeView, setActiveView] = useState<ViewId>("mine");
  const [selectedPoolId, setSelectedPoolId] = useState<PoolId>("cma");
  const [installed, setInstalled] = useState<InstalledMiner[]>(
    defaultInstalledMiners,
  );
  const [rackOpen, setRackOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");

  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0];
  const [secondsLeft, setSecondsLeft] = useState(selectedPool.blockSeconds);

  const installedPower = useMemo(
    () => getInstalledPower(installed),
    [installed],
  );
  const installedEnergy = useMemo(
    () => getInstalledEnergy(installed),
    [installed],
  );
  const usedSlots = useMemo(() => getUsedSlotCount(installed), [installed]);
  const occupiedSlots = useMemo(
    () => getOccupiedSlots(installed),
    [installed],
  );
  const estimatedReward = useMemo(
    () => calculateEstimatedReward(selectedPool, installedPower),
    [installedPower, selectedPool],
  );

  useEffect(() => {
    const loadSavedState = window.setTimeout(() => {
      try {
        const savedPlacement = window.localStorage.getItem(
          "arcadia-rack-placement-v1",
        );
        const savedPool = window.localStorage.getItem("arcadia-pool-v1");

        if (savedPlacement) {
          const parsed: unknown = JSON.parse(savedPlacement);
          if (isSavedPlacement(parsed)) setInstalled(parsed);
        }

        if (savedPool && pools.some((pool) => pool.id === savedPool)) {
          const pool = pools.find((item) => item.id === savedPool);
          setSelectedPoolId(savedPool as PoolId);
          if (pool) setSecondsLeft(pool.blockSeconds);
        }
      } catch {
        // A configuração inicial segura continua ativa se o armazenamento falhar.
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(loadSavedState);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      "arcadia-rack-placement-v1",
      JSON.stringify(installed),
    );
    window.localStorage.setItem("arcadia-pool-v1", selectedPoolId);
  }, [hydrated, installed, selectedPoolId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) =>
        current <= 1 ? selectedPool.blockSeconds : current - 1,
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [selectedPool.blockSeconds]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.style.overflow = rackOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [rackOpen]);

  function installMiner(minerId: string) {
    const miner = getMiner(minerId);
    if (!miner) return;

    if (installed.some((placement) => placement.minerId === minerId)) {
      setToast(`${miner.name} já está instalado.`);
      return;
    }

    const slotIndex = findNextAvailableSlot(installed, miner);
    if (slotIndex === null) {
      setToast(
        miner.slotSize === 2
          ? "Esse minerador precisa de dois slots livres na mesma prateleira."
          : "Não há um slot livre nesse rack.",
      );
      return;
    }

    setInstalled((current) => [...current, { minerId, slotIndex }]);
    setToast(
      `${miner.name} instalado: ${miner.slotSize} ${
        miner.slotSize === 1 ? "slot ocupado" : "slots ocupados"
      }.`,
    );
  }

  function removeMiner(minerId: string) {
    const miner = getMiner(minerId);
    setInstalled((current) =>
      current.filter((placement) => placement.minerId !== minerId),
    );
    setToast(`${miner?.name ?? "Minerador"} voltou para o inventário.`);
  }

  function choosePool(poolId: PoolId) {
    const pool = pools.find((item) => item.id === poolId);
    setSelectedPoolId(poolId);
    if (pool) setSecondsLeft(pool.blockSeconds);
    setToast(`100% do seu poder foi direcionado para ${pool?.symbol}.`);
  }

  function openRackFromInventory() {
    setActiveView("mine");
    window.setTimeout(() => setRackOpen(true), 100);
  }

  return (
    <main className="arcadia-shell">
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => setActiveView("mine")}
          aria-label="Voltar para a sala de mineração"
        >
          <span className="brand-mark">
            <img src={assetsManifest.cmaCoin.path} alt="" />
          </span>
          <span>
            <strong>CRYPTO MINER</strong>
            <em>ARCADIA</em>
          </span>
        </button>

        <div className="topbar-status" aria-label="Status do sistema">
          <span className="online-dot" />
          SISTEMA ONLINE
        </div>

        <div className="balances" aria-label="Saldos virtuais">
          {balances.map((balance) => (
            <div className="balance-chip" key={balance.symbol}>
              <img src={balance.asset} alt={balance.alt} />
              <span>
                <small>{balance.symbol}</small>
                <strong>{balance.value}</strong>
              </span>
            </div>
          ))}
        </div>

        <button className="player-chip" type="button" aria-label="Perfil">
          <span>07</span>
          <strong>M</strong>
        </button>
      </header>

      <aside className="sidebar" aria-label="Navegação principal">
        <div className="player-card">
          <div className="avatar-frame">M</div>
          <div>
            <span>OPERADOR</span>
            <strong>MATEUS</strong>
            <small>NÍVEL 07</small>
          </div>
        </div>

        <nav>
          {navigation.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              type="button"
              key={item.id}
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-glyph">{item.glyph}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="economy-anchor">
          <span>BASE DA ECONOMIA</span>
          <strong>1 CMA = US$ 1</strong>
          <small>Âncora fixa do jogo</small>
        </div>

        <div className="simulation-note">
          <span>SIMULAÇÃO VIRTUAL</span>
          <p>Sem mineração real no seu dispositivo.</p>
        </div>
      </aside>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">
              SETOR 01 <i /> OFICINA ARCADIA
            </span>
            <h1>
              {activeView === "mine" && "Sua sala de mineração"}
              {activeView === "pools" && "Pools de mineração"}
              {activeView === "inventory" && "Inventário de equipamentos"}
            </h1>
          </div>
          <div className="block-timer">
            <span>PRÓXIMO BLOCO · {selectedPool.symbol}</span>
            <strong>{formatTimer(secondsLeft)}</strong>
            <div>
              <i
                style={{
                  width: `${
                    ((selectedPool.blockSeconds - secondsLeft) /
                      selectedPool.blockSeconds) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="metric-strip">
          <article>
            <span className="metric-icon power">H</span>
            <div>
              <small>PODER INSTALADO</small>
              <strong>{formatPower(installedPower)}</strong>
            </div>
            <em>ATIVO</em>
          </article>
          <article>
            <span className="metric-icon slots">S</span>
            <div>
              <small>SLOTS DO RACK</small>
              <strong>
                {usedSlots} / {RACK_CAPACITY}
              </strong>
            </div>
            <em>{RACK_CAPACITY - usedSlots} LIVRES</em>
          </article>
          <article>
            <span className="metric-icon energy">E</span>
            <div>
              <small>CONSUMO</small>
              <strong>{installedEnergy} W</strong>
            </div>
            <em>ESTÁVEL</em>
          </article>
          <article>
            <span className="metric-icon pool">P</span>
            <div>
              <small>POOL ATUAL</small>
              <strong>{selectedPool.symbol}</strong>
            </div>
            <em>100% ALOCADO</em>
          </article>
        </div>

        {activeView === "mine" && (
          <MiningRoom
            installed={installed}
            selectedPoolId={selectedPoolId}
            estimatedReward={`${formatAtomic(
              estimatedReward,
              selectedPool.decimals,
            )} ${selectedPool.symbol}`}
            onOpenRack={() => setRackOpen(true)}
            onOpenPools={() => setActiveView("pools")}
          />
        )}

        {activeView === "pools" && (
          <PoolsView
            selectedPoolId={selectedPoolId}
            installedPower={installedPower}
            onChoosePool={choosePool}
          />
        )}

        {activeView === "inventory" && (
          <InventoryView
            installed={installed}
            onOpenRack={openRackFromInventory}
          />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.id}
            className={activeView === item.id ? "active" : ""}
            onClick={() => setActiveView(item.id)}
          >
            <span>{item.glyph}</span>
            {item.shortLabel}
          </button>
        ))}
      </nav>

      {rackOpen && (
        <RackManager
          installed={installed}
          occupiedSlots={occupiedSlots}
          usedSlots={usedSlots}
          onInstall={installMiner}
          onRemove={removeMiner}
          onClose={() => setRackOpen(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>✓</span>
          {toast}
        </div>
      )}
    </main>
  );
}

function MiningRoom({
  installed,
  selectedPoolId,
  estimatedReward,
  onOpenRack,
  onOpenPools,
}: {
  installed: InstalledMiner[];
  selectedPoolId: PoolId;
  estimatedReward: string;
  onOpenRack: () => void;
  onOpenPools: () => void;
}) {
  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0];

  return (
    <div className="mine-grid">
      <section className="room-card">
        <div className="room-toolbar">
          <span>
            <i className="online-dot" /> SALA ATIVA
          </span>
          <div>
            <button type="button" className="selected">
              VISÃO FRONTAL
            </button>
            <button type="button" disabled>
              EDITAR SALA · EM BREVE
            </button>
          </div>
        </div>

        <div className="room-stage">
          <img
            className="room-background"
            src={assetsManifest.roomOne.path}
            alt={assetsManifest.roomOne.alt}
          />
          <button
            type="button"
            className="room-rack"
            onClick={onOpenRack}
            aria-label="Abrir rack e gerenciar mineradores"
          >
            <img
              className="rack-frame"
              src={assetsManifest.rackBasic.path}
              alt=""
            />
            {installed.map((placement) => {
              const miner = getMiner(placement.minerId);
              if (!miner) return null;
              const row = Math.floor(placement.slotIndex / RACK_COLUMNS);
              const column = placement.slotIndex % RACK_COLUMNS;

              return (
                <img
                  className={`rack-miner size-${miner.slotSize}`}
                  key={placement.minerId}
                  src={miner.asset}
                  alt={miner.alt}
                  style={{
                    left: `${column * 46 + 5}%`,
                    top: `${row * 23.5 + 2}%`,
                  }}
                />
              );
            })}
            <span className="rack-click-label">
              <b>RACK 01</b>
              CLIQUE PARA GERENCIAR
            </span>
          </button>

          <div className="room-hint">
            <span>+</span>
            <p>
              <strong>Gerencie seu rack</strong>
              Instale mineradores de 1 ou 2 fans
            </p>
          </div>

          <div className="room-coordinates">X: 14 · Y: 06 · LAYOUT V.01</div>
        </div>
      </section>

      <aside className="operation-panel">
        <div className="panel-title">
          <span>OPERAÇÃO ATUAL</span>
          <i />
        </div>

        <div className="current-pool-card">
          <div className="pool-orbit">
            <img src={selectedPool.asset} alt="" />
          </div>
          <div>
            <small>MINERANDO AGORA</small>
            <strong>{selectedPool.name}</strong>
            <span>100% do poder</span>
          </div>
          <button type="button" onClick={onOpenPools}>
            TROCAR
          </button>
        </div>

        <div className="reward-box">
          <span>ESTIMATIVA POR BLOCO</span>
          <strong>{estimatedReward}</strong>
          <small>
            Estimativa proporcional ao poder atual. O fechamento definitivo é
            validado pelo servidor.
          </small>
        </div>

        <div className="activity-feed">
          <div>
            <strong>ATIVIDADE RECENTE</strong>
            <span>AO VIVO</span>
          </div>
          <ul>
            <li>
              <i className="success" />
              <p>
                <strong>Rack 01 sincronizado</strong>
                configuração validada
              </p>
              <time>agora</time>
            </li>
            <li>
              <i />
              <p>
                <strong>Bloco #3147 distribuído</strong>
                recompensa registrada
              </p>
              <time>5 min</time>
            </li>
            <li>
              <i className="amber" />
              <p>
                <strong>Energia estável</strong>
                consumo dentro do limite
              </p>
              <time>12 min</time>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function PoolsView({
  selectedPoolId,
  installedPower,
  onChoosePool,
}: {
  selectedPoolId: PoolId;
  installedPower: number;
  onChoosePool: (poolId: PoolId) => void;
}) {
  return (
    <section className="pools-view">
      <div className="section-intro">
        <div>
          <span className="eyebrow">ALOCAÇÃO SIMPLES</span>
          <h2>Escolha uma única pool</h2>
          <p>
            Nesta fase, 100% do seu poder fica em uma pool por vez. CMA, Bitcoin
            e Dogecoin são as três opções disponíveis.
          </p>
        </div>
        <div className="cma-anchor-card">
          <img src={assetsManifest.cmaCoin.path} alt="" />
          <span>
            <small>ÂNCORA CMA</small>
            <strong>1 CMA = US$ 1</strong>
            <em>valor-base fixo da economia</em>
          </span>
        </div>
      </div>

      <div className="pool-grid">
        {pools.map((pool) => {
          const selected = pool.id === selectedPoolId;
          const estimate = calculateEstimatedReward(pool, installedPower);

          return (
            <article
              className={`pool-card ${selected ? "selected" : ""}`}
              key={pool.id}
              style={{ "--pool-color": pool.color } as React.CSSProperties}
            >
              <div className="pool-card-top">
                <div className="pool-logo">
                  <img src={pool.asset} alt="" />
                </div>
                <span className="pool-state">
                  {selected ? "ATIVA" : "DISPONÍVEL"}
                </span>
              </div>
              <span className="pool-code">{pool.symbol} / POOL</span>
              <h3>{pool.name}</h3>
              <p>{pool.tagline}</p>
              <dl>
                <div>
                  <dt>Intervalo</dt>
                  <dd>{Math.floor(pool.blockSeconds / 60)} min</dd>
                </div>
                <div>
                  <dt>Seu poder</dt>
                  <dd>{formatPower(installedPower)}</dd>
                </div>
                <div>
                  <dt>Estimativa</dt>
                  <dd>
                    {formatAtomic(estimate, pool.decimals)} {pool.symbol}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={selected}
                onClick={() => onChoosePool(pool.id)}
              >
                {selected ? "MINERANDO AGORA" : `MINERAR ${pool.symbol}`}
              </button>
            </article>
          );
        })}
      </div>

      <div className="pool-rule-note">
        <span>i</span>
        <p>
          <strong>Regra desta versão</strong>
          Não existe divisão entre pools. Ao trocar, todo o poder passa para a
          nova escolha no próximo bloco.
        </p>
      </div>
    </section>
  );
}

function InventoryView({
  installed,
  onOpenRack,
}: {
  installed: InstalledMiner[];
  onOpenRack: () => void;
}) {
  return (
    <section className="inventory-view">
      <div className="section-intro">
        <div>
          <span className="eyebrow">EQUIPAMENTOS · 07 ITENS</span>
          <h2>Seus mineradores</h2>
          <p>
            O tamanho do equipamento define o espaço necessário no rack. Uma
            fan usa 1 slot; duas fans usam 2 slots contínuos.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onOpenRack}>
          GERENCIAR RACK
        </button>
      </div>

      <div className="inventory-grid">
        {miners.map((miner) => {
          const isInstalled = installed.some(
            (placement) => placement.minerId === miner.id,
          );

          return (
            <article className={`inventory-card ${miner.rarity}`} key={miner.id}>
              <div className="inventory-art">
                <span>{rarityLabels[miner.rarity]}</span>
                <img src={miner.asset} alt={miner.alt} />
              </div>
              <div className="inventory-info">
                <span>{miner.fanCount} FAN</span>
                <h3>{miner.name}</h3>
                <div>
                  <p>
                    <small>PODER</small>
                    <strong>{formatPower(miner.powerGh)}</strong>
                  </p>
                  <p>
                    <small>ESPAÇO</small>
                    <strong>
                      {miner.slotSize} {miner.slotSize === 1 ? "slot" : "slots"}
                    </strong>
                  </p>
                </div>
                <em className={isInstalled ? "installed" : ""}>
                  {isInstalled ? "INSTALADO NO RACK" : "NO INVENTÁRIO"}
                </em>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RackManager({
  installed,
  occupiedSlots,
  usedSlots,
  onInstall,
  onRemove,
  onClose,
}: {
  installed: InstalledMiner[];
  occupiedSlots: Set<number>;
  usedSlots: number;
  onInstall: (minerId: string) => void;
  onRemove: (minerId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="rack-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rack-title"
      >
        <header>
          <div>
            <span className="eyebrow">SALA 01 · EQUIPAMENTO</span>
            <h2 id="rack-title">Gerenciar Rack 01</h2>
            <p>
              Escolha um minerador. O sistema reserva automaticamente a
              quantidade correta de slots na mesma prateleira.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="rack-manager-layout">
          <div className="rack-preview-panel">
            <div className="rack-summary">
              <span>RACK BÁSICO · 4 PRATELEIRAS</span>
              <strong>
                {usedSlots}/{RACK_CAPACITY} SLOTS
              </strong>
            </div>

            <div className="rack-preview">
              <img src={assetsManifest.rackBasic.path} alt="" />
              <div className="rack-slot-grid">
                {Array.from({ length: RACK_CAPACITY }, (_, slotIndex) => (
                  <span
                    className={occupiedSlots.has(slotIndex) ? "occupied" : ""}
                    key={slotIndex}
                  >
                    {slotIndex + 1}
                  </span>
                ))}
              </div>
              {installed.map((placement) => {
                const miner = getMiner(placement.minerId);
                if (!miner) return null;
                const row = Math.floor(placement.slotIndex / RACK_COLUMNS);
                const column = placement.slotIndex % RACK_COLUMNS;

                return (
                  <button
                    type="button"
                    className={`preview-miner size-${miner.slotSize}`}
                    key={placement.minerId}
                    style={{
                      left: `${column * 47 + 4}%`,
                      top: `${row * 23.3 + 1.5}%`,
                    }}
                    onClick={() => onRemove(miner.id)}
                    title={`Retirar ${miner.name}`}
                  >
                    <img src={miner.asset} alt={miner.alt} />
                  </button>
                );
              })}
            </div>

            <div className="slot-legend">
              <span>
                <i /> LIVRE
              </span>
              <span>
                <i className="used" /> OCUPADO
              </span>
            </div>

            <div className="rack-rule">
              <b>REGRA DE ENCAIXE</b>
              <div>
                <span className="fan-icon one">●</span>
                <p>
                  <strong>1 fan</strong>
                  ocupa 1 slot
                </p>
              </div>
              <div>
                <span className="fan-icon two">● ●</span>
                <p>
                  <strong>2 fans</strong>
                  ocupam 2 slots contínuos
                </p>
              </div>
            </div>
          </div>

          <div className="rack-inventory">
            <div className="rack-inventory-heading">
              <div>
                <span>SEUS MINERADORES</span>
                <strong>
                  {miners.length - installed.length} disponíveis
                </strong>
              </div>
              <span>ORDENADO POR PODER</span>
            </div>

            <div className="rack-miner-list">
              {miners.map((miner) => {
                const placement = installed.find(
                  (item) => item.minerId === miner.id,
                );
                const possibleSlot = placement
                  ? null
                  : findNextAvailableSlot(installed, miner);

                return (
                  <article
                    className={`rack-miner-card ${
                      placement ? "installed" : ""
                    }`}
                    key={miner.id}
                  >
                    <div className={`mini-rarity ${miner.rarity}`}>
                      {rarityLabels[miner.rarity]}
                    </div>
                    <div className="rack-miner-art">
                      <img src={miner.asset} alt={miner.alt} />
                    </div>
                    <div className="rack-miner-data">
                      <span>
                        {miner.fanCount} {miner.fanCount === 1 ? "FAN" : "FANS"}
                      </span>
                      <h3>{miner.name}</h3>
                      <p>
                        {formatPower(miner.powerGh)} · {miner.energyW} W
                      </p>
                    </div>
                    <div className="slot-cost">
                      <small>OCUPA</small>
                      <strong>
                        {miner.slotSize}{" "}
                        {miner.slotSize === 1 ? "SLOT" : "SLOTS"}
                      </strong>
                    </div>
                    {placement ? (
                      <button
                        className="remove"
                        type="button"
                        onClick={() => onRemove(miner.id)}
                      >
                        RETIRAR
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={possibleSlot === null}
                        onClick={() => onInstall(miner.id)}
                      >
                        {possibleSlot === null ? "SEM ESPAÇO" : "INSTALAR"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <footer>
          <p>
            <span>✓</span>
            Alterações salvas automaticamente neste dispositivo
          </p>
          <button type="button" onClick={onClose}>
            CONCLUIR
          </button>
        </footer>
      </section>
    </div>
  );
}
