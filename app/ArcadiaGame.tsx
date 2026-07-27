"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import {
  BATTERY_HOURS,
  BATTERY_PRICE_CMA,
  MAX_ENERGY_HOURS,
  RACK_CAPACITY,
  RACK_COLUMNS,
  RACK_PRICE_CMA,
  ROOM_RACK_CAPACITY,
  calculateDailyEstimatedReward,
  calculateEstimatedReward,
  canInstallAt,
  defaultInstalledMiners,
  findNextAvailableSlot,
  formatAtomic,
  getInstalledPower,
  getMiner,
  getUsedSlotCount,
  miners,
  pools,
  type InstalledMiner,
  type PoolId,
} from "./game-rules";

type ViewId = "mine" | "pools" | "inventory";
type RoomId = "room-1" | "room-2";

type RackInstance = {
  id: string;
  roomId: RoomId;
  positionIndex: number;
};

type RoomDefinition = {
  id: RoomId;
  name: string;
  label: string;
  asset: string;
  alt: string;
  priceCma: number;
};

type RackPosition = {
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
};

type SavedGameState = {
  selectedPoolId: PoolId;
  cmaBalance: number;
  batteryCount: number;
  energyHours: number;
  activeRoomId: RoomId;
  ownedRoomIds: RoomId[];
  racks: RackInstance[];
  rackMiners: Record<string, InstalledMiner[]>;
};

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

const roomDefinitions: RoomDefinition[] = [
  {
    id: "room-1",
    name: "Oficina Neon",
    label: "SALA 01",
    asset: assetsManifest.roomOne.path,
    alt: assetsManifest.roomOne.alt,
    priceCma: 0,
  },
  {
    id: "room-2",
    name: "Laboratório Noturno",
    label: "SALA 02",
    asset: assetsManifest.roomTwo.path,
    alt: assetsManifest.roomTwo.alt,
    priceCma: 20,
  },
];

const rackPositions: RackPosition[] = [
  { left: 54, top: 10, width: 21, height: 32, zIndex: 3 },
  { left: 77, top: 18, width: 17, height: 26, zIndex: 3 },
  { left: 2, top: 43, width: 17, height: 26, zIndex: 5 },
  { left: 21, top: 43, width: 17, height: 26, zIndex: 5 },
  { left: 40, top: 43, width: 17, height: 26, zIndex: 5 },
  { left: 59, top: 43, width: 17, height: 26, zIndex: 5 },
  { left: 78, top: 43, width: 17, height: 26, zIndex: 5 },
  { left: 3, top: 67, width: 17, height: 27, zIndex: 7 },
  { left: 22, top: 67, width: 17, height: 27, zIndex: 7 },
  { left: 41, top: 67, width: 17, height: 27, zIndex: 7 },
  { left: 60, top: 67, width: 17, height: 27, zIndex: 7 },
  { left: 79, top: 67, width: 17, height: 27, zIndex: 7 },
];

const defaultRacks: RackInstance[] = [
  { id: "rack-01", roomId: "room-1", positionIndex: 0 },
];

const defaultRackMiners: Record<string, InstalledMiner[]> = {
  "rack-01": defaultInstalledMiners,
};

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

function formatCma(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatEnergy(hours: number) {
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours.toString().padStart(2, "0")}h`;
}

function isPoolId(value: unknown): value is PoolId {
  return pools.some((pool) => pool.id === value);
}

function isRoomId(value: unknown): value is RoomId {
  return roomDefinitions.some((room) => room.id === value);
}

function isRackInstanceArray(value: unknown): value is RackInstance[] {
  if (!Array.isArray(value)) return false;
  return value.every((rack) => {
    if (!rack || typeof rack !== "object") return false;
    const candidate = rack as Partial<RackInstance>;
    return (
      typeof candidate.id === "string" &&
      isRoomId(candidate.roomId) &&
      typeof candidate.positionIndex === "number" &&
      candidate.positionIndex >= 0 &&
      candidate.positionIndex < ROOM_RACK_CAPACITY
    );
  });
}

function isRackMinerMap(
  value: unknown,
): value is Record<string, InstalledMiner[]> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every((placements) => {
    if (!Array.isArray(placements)) return false;
    return placements.every((placement) => {
      if (!placement || typeof placement !== "object") return false;
      const candidate = placement as Partial<InstalledMiner>;
      return (
        typeof candidate.minerId === "string" &&
        Boolean(getMiner(candidate.minerId)) &&
        typeof candidate.slotIndex === "number"
      );
    });
  });
}

function isSavedGameState(value: unknown): value is SavedGameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedGameState>;
  return (
    isPoolId(candidate.selectedPoolId) &&
    typeof candidate.cmaBalance === "number" &&
    typeof candidate.batteryCount === "number" &&
    typeof candidate.energyHours === "number" &&
    isRoomId(candidate.activeRoomId) &&
    Array.isArray(candidate.ownedRoomIds) &&
    candidate.ownedRoomIds.every(isRoomId) &&
    isRackInstanceArray(candidate.racks) &&
    isRackMinerMap(candidate.rackMiners)
  );
}

export function ArcadiaGame() {
  const [activeView, setActiveView] = useState<ViewId>("mine");
  const [selectedPoolId, setSelectedPoolId] = useState<PoolId>("cma");
  const [cmaBalance, setCmaBalance] = useState(86.4);
  const [batteryCount, setBatteryCount] = useState(2);
  const [energyHours, setEnergyHours] = useState(48);
  const [activeRoomId, setActiveRoomId] = useState<RoomId>("room-1");
  const [ownedRoomIds, setOwnedRoomIds] = useState<RoomId[]>(["room-1"]);
  const [racks, setRacks] = useState<RackInstance[]>(defaultRacks);
  const [rackMiners, setRackMiners] =
    useState<Record<string, InstalledMiner[]>>(defaultRackMiners);
  const [activeRackId, setActiveRackId] = useState("rack-01");
  const [rackOpen, setRackOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");

  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0];
  const activeRoom =
    roomDefinitions.find((room) => room.id === activeRoomId) ??
    roomDefinitions[0];
  const [secondsLeft, setSecondsLeft] = useState(selectedPool.blockSeconds);

  const allInstalled = useMemo(
    () => Object.values(rackMiners).flat(),
    [rackMiners],
  );
  const allInstalledMinerIds = useMemo(
    () => new Set(allInstalled.map((placement) => placement.minerId)),
    [allInstalled],
  );
  const installedPower = useMemo(
    () => getInstalledPower(allInstalled),
    [allInstalled],
  );
  const currentRoomRacks = useMemo(
    () => racks.filter((rack) => rack.roomId === activeRoomId),
    [activeRoomId, racks],
  );
  const activeRack =
    racks.find((rack) => rack.id === activeRackId) ?? currentRoomRacks[0];
  const activeRackMiners = activeRack ? rackMiners[activeRack.id] ?? [] : [];
  const estimatedReward = useMemo(
    () => calculateEstimatedReward(selectedPool, installedPower),
    [installedPower, selectedPool],
  );

  useEffect(() => {
    const loadSavedState = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("arcadia-game-state-v2");
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isSavedGameState(parsed)) {
            setSelectedPoolId(parsed.selectedPoolId);
            setCmaBalance(parsed.cmaBalance);
            setBatteryCount(parsed.batteryCount);
            setEnergyHours(parsed.energyHours);
            setActiveRoomId(parsed.activeRoomId);
            setOwnedRoomIds(parsed.ownedRoomIds);
            setRacks(parsed.racks);
            setRackMiners(parsed.rackMiners);
            setActiveRackId(parsed.racks[0]?.id ?? "rack-01");
            const pool = pools.find(
              (item) => item.id === parsed.selectedPoolId,
            );
            if (pool) setSecondsLeft(pool.blockSeconds);
          }
        }
      } catch {
        // O estado inicial seguro continua ativo se o armazenamento falhar.
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(loadSavedState);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const savedState: SavedGameState = {
      selectedPoolId,
      cmaBalance,
      batteryCount,
      energyHours,
      activeRoomId,
      ownedRoomIds,
      racks,
      rackMiners,
    };
    window.localStorage.setItem(
      "arcadia-game-state-v2",
      JSON.stringify(savedState),
    );
  }, [
    activeRoomId,
    batteryCount,
    cmaBalance,
    energyHours,
    hydrated,
    ownedRoomIds,
    rackMiners,
    racks,
    selectedPoolId,
  ]);

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
    document.body.style.overflow = rackOpen || roomsOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [rackOpen, roomsOpen]);

  function installMiner(minerId: string, requestedSlot?: number) {
    if (!activeRack) return;
    const miner = getMiner(minerId);
    if (!miner) return;

    if (allInstalledMinerIds.has(minerId)) {
      setToast(`${miner.name} já está instalado em um rack.`);
      return;
    }

    const current = rackMiners[activeRack.id] ?? [];
    const slotIndex =
      requestedSlot ?? findNextAvailableSlot(current, miner);

    if (
      slotIndex === null ||
      slotIndex === undefined ||
      !canInstallAt(current, miner, slotIndex)
    ) {
      setToast(
        miner.slotSize === 2
          ? "Esse minerador precisa de dois slots livres na mesma prateleira."
          : "Esse slot não está disponível.",
      );
      return;
    }

    setRackMiners((state) => ({
      ...state,
      [activeRack.id]: [...current, { minerId, slotIndex }],
    }));
    setToast(
      `${miner.name} instalado no${
        miner.slotSize === 1 ? ` slot ${slotIndex + 1}` : "s dois slots"
      }.`,
    );
  }

  function removeMiner(minerId: string) {
    if (!activeRack) return;
    const miner = getMiner(minerId);
    setRackMiners((state) => ({
      ...state,
      [activeRack.id]: (state[activeRack.id] ?? []).filter(
        (placement) => placement.minerId !== minerId,
      ),
    }));
    setToast(`${miner?.name ?? "Minerador"} voltou para o inventário.`);
  }

  function removeAllMiners() {
    if (!activeRack || activeRackMiners.length === 0) return;
    setRackMiners((state) => ({ ...state, [activeRack.id]: [] }));
    setToast("Todos os mineradores desse rack voltaram para o inventário.");
  }

  function choosePool(poolId: PoolId) {
    const pool = pools.find((item) => item.id === poolId);
    setSelectedPoolId(poolId);
    if (pool) setSecondsLeft(pool.blockSeconds);
    setToast(`100% do seu poder foi direcionado para ${pool?.symbol}.`);
  }

  function openRack(rackId: string) {
    setActiveRackId(rackId);
    setRackOpen(true);
  }

  function openRackFromInventory() {
    const rack =
      currentRoomRacks[0] ??
      racks.find((item) => item.roomId === "room-1");
    setActiveView("mine");
    if (rack) {
      setActiveRoomId(rack.roomId);
      setActiveRackId(rack.id);
      window.setTimeout(() => setRackOpen(true), 100);
    } else {
      setEditMode(true);
      setToast("Adicione um rack para instalar seus mineradores.");
    }
  }

  function buyRack(positionIndex: number) {
    if (!ownedRoomIds.includes(activeRoomId)) return;
    if (currentRoomRacks.length >= ROOM_RACK_CAPACITY) {
      setToast("Essa sala já atingiu o limite de 12 racks.");
      return;
    }
    if (currentRoomRacks.some((rack) => rack.positionIndex === positionIndex)) {
      return;
    }
    if (cmaBalance < RACK_PRICE_CMA) {
      setToast("Saldo CMA insuficiente para comprar esse rack.");
      return;
    }

    const rackId = `rack-${Date.now()}`;
    const rack: RackInstance = {
      id: rackId,
      roomId: activeRoomId,
      positionIndex,
    };
    setCmaBalance((balance) => balance - RACK_PRICE_CMA);
    setRacks((items) => [...items, rack]);
    setRackMiners((items) => ({ ...items, [rackId]: [] }));
    setActiveRackId(rackId);
    setToast(
      `Rack ${currentRoomRacks.length + 1} instalado na ${activeRoom.label}.`,
    );
    window.setTimeout(() => setRackOpen(true), 100);
  }

  function chooseRoom(roomId: RoomId) {
    if (!ownedRoomIds.includes(roomId)) {
      setRoomsOpen(true);
      return;
    }
    setActiveRoomId(roomId);
    setEditMode(false);
    setRoomsOpen(false);
    const rack = racks.find((item) => item.roomId === roomId);
    if (rack) setActiveRackId(rack.id);
  }

  function buyRoom(room: RoomDefinition) {
    if (ownedRoomIds.includes(room.id)) {
      chooseRoom(room.id);
      return;
    }
    if (cmaBalance < room.priceCma) {
      setToast("Saldo CMA insuficiente para comprar essa sala.");
      return;
    }
    setCmaBalance((balance) => balance - room.priceCma);
    setOwnedRoomIds((rooms) => [...rooms, room.id]);
    setActiveRoomId(room.id);
    setEditMode(true);
    setRoomsOpen(false);
    setToast(`${room.name} desbloqueado. Escolha onde instalar o primeiro rack.`);
  }

  function buyBattery() {
    if (cmaBalance < BATTERY_PRICE_CMA) {
      setToast("Saldo CMA insuficiente para comprar uma bateria.");
      return;
    }
    setCmaBalance((balance) => balance - BATTERY_PRICE_CMA);
    setBatteryCount((count) => count + 1);
    setToast("Uma bateria foi adicionada ao inventário.");
  }

  function useBattery() {
    if (batteryCount <= 0) {
      setToast("Você não possui baterias. Compre uma ou ganhe em minigames.");
      return;
    }
    if (energyHours >= MAX_ENERGY_HOURS) {
      setToast("As quatro células de energia já estão carregadas.");
      return;
    }
    setBatteryCount((count) => count - 1);
    setEnergyHours((hours) =>
      Math.min(MAX_ENERGY_HOURS, hours + BATTERY_HOURS),
    );
    setToast("Bateria utilizada: +24 horas de energia.");
  }

  const balances = [
    {
      symbol: "CMA",
      value: formatCma(cmaBalance),
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
          <small>Âncora contábil interna</small>
        </div>

        <div className="simulation-note">
          <span>SIMULAÇÃO VIRTUAL</span>
          <p>Sem mineração real, depósito ou saque nesta fase.</p>
        </div>
      </aside>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">
              {activeRoom.label} <i /> {activeRoom.name.toUpperCase()}
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
            <span className="metric-icon slots">R</span>
            <div>
              <small>RACKS NESTA SALA</small>
              <strong>
                {currentRoomRacks.length} / {ROOM_RACK_CAPACITY}
              </strong>
            </div>
            <em>{ROOM_RACK_CAPACITY - currentRoomRacks.length} LIVRES</em>
          </article>
          <article className="energy-metric">
            <img src={assetsManifest.battery.path} alt="" />
            <div>
              <small>ENERGIA</small>
              <strong>{formatEnergy(energyHours)}</strong>
            </div>
            <em>{batteryCount} BATERIAS</em>
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
            activeRoom={activeRoom}
            roomRacks={currentRoomRacks}
            rackMiners={rackMiners}
            editMode={editMode}
            selectedPoolId={selectedPoolId}
            estimatedReward={`${formatAtomic(
              estimatedReward,
              selectedPool.decimals,
            )} ${selectedPool.symbol}`}
            energyHours={energyHours}
            batteryCount={batteryCount}
            ownedRooms={ownedRoomIds.length}
            onSetEditMode={setEditMode}
            onOpenRack={openRack}
            onBuyRack={buyRack}
            onOpenPools={() => setActiveView("pools")}
            onOpenRooms={() => setRoomsOpen(true)}
            onBuyBattery={buyBattery}
            onUseBattery={useBattery}
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
            installedMinerIds={allInstalledMinerIds}
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

      {rackOpen && activeRack && (
        <RackManager
          rackLabel={`RACK ${String(
            currentRoomRacks.findIndex((rack) => rack.id === activeRack.id) + 1,
          ).padStart(2, "0")}`}
          roomName={activeRoom.name}
          installed={activeRackMiners}
          allInstalledMinerIds={allInstalledMinerIds}
          onInstall={installMiner}
          onRemove={removeMiner}
          onRemoveAll={removeAllMiners}
          onClose={() => setRackOpen(false)}
        />
      )}

      {roomsOpen && (
        <RoomsModal
          activeRoomId={activeRoomId}
          ownedRoomIds={ownedRoomIds}
          cmaBalance={cmaBalance}
          onChoose={chooseRoom}
          onBuy={buyRoom}
          onClose={() => setRoomsOpen(false)}
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
  activeRoom,
  roomRacks,
  rackMiners,
  editMode,
  selectedPoolId,
  estimatedReward,
  energyHours,
  batteryCount,
  ownedRooms,
  onSetEditMode,
  onOpenRack,
  onBuyRack,
  onOpenPools,
  onOpenRooms,
  onBuyBattery,
  onUseBattery,
}: {
  activeRoom: RoomDefinition;
  roomRacks: RackInstance[];
  rackMiners: Record<string, InstalledMiner[]>;
  editMode: boolean;
  selectedPoolId: PoolId;
  estimatedReward: string;
  energyHours: number;
  batteryCount: number;
  ownedRooms: number;
  onSetEditMode: (value: boolean) => void;
  onOpenRack: (rackId: string) => void;
  onBuyRack: (positionIndex: number) => void;
  onOpenPools: () => void;
  onOpenRooms: () => void;
  onBuyBattery: () => void;
  onUseBattery: () => void;
}) {
  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0];

  return (
    <div className="mine-grid">
      <section className="room-card">
        <div className="room-toolbar">
          <span>
            <i className="online-dot" /> {activeRoom.label} · {activeRoom.name}
          </span>
          <div>
            <button
              type="button"
              className={!editMode ? "selected" : ""}
              onClick={() => onSetEditMode(false)}
            >
              VISÃO
            </button>
            <button
              type="button"
              className={editMode ? "selected edit-active" : ""}
              onClick={() => onSetEditMode(true)}
            >
              EDITAR · {roomRacks.length}/{ROOM_RACK_CAPACITY}
            </button>
            <button type="button" onClick={onOpenRooms}>
              SALAS · {ownedRooms}/2
            </button>
          </div>
        </div>

        <div className={`room-stage ${editMode ? "editing" : ""}`}>
          <img
            className="room-background"
            src={activeRoom.asset}
            alt={activeRoom.alt}
          />

          {rackPositions.map((position, positionIndex) => {
            const rack = roomRacks.find(
              (item) => item.positionIndex === positionIndex,
            );
            const style = {
              left: `${position.left}%`,
              top: `${position.top}%`,
              width: `${position.width}%`,
              height: `${position.height}%`,
              zIndex: position.zIndex,
            };

            if (!rack) {
              if (!editMode) return null;
              return (
                <button
                  type="button"
                  className="rack-placement"
                  style={style}
                  key={`empty-${positionIndex}`}
                  onClick={() => onBuyRack(positionIndex)}
                  aria-label={`Comprar rack para a posição ${positionIndex + 1}`}
                >
                  <span>+</span>
                  <small>POSIÇÃO {positionIndex + 1}</small>
                  <b>{formatCma(RACK_PRICE_CMA)} CMA</b>
                </button>
              );
            }

            const installed = rackMiners[rack.id] ?? [];
            return (
              <button
                type="button"
                className="room-rack multi-rack"
                onClick={() => onOpenRack(rack.id)}
                aria-label={`Abrir rack da posição ${positionIndex + 1}`}
                style={style}
                key={rack.id}
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
                        left: `${27 + column * 24}%`,
                        top: `${row * 23.5 + 2}%`,
                      }}
                    />
                  );
                })}
                <span className="rack-click-label">
                  <b>RACK · {getUsedSlotCount(installed)}/8</b>
                  CLIQUE PARA GERENCIAR
                </span>
              </button>
            );
          })}

          <div className="room-mode-badge">
            {editMode ? (
              <>
                <span>EDITANDO LAYOUT</span>
                Clique em uma posição azul para instalar um rack
              </>
            ) : (
              <>
                <span>SALA ATIVA</span>
                Clique em um rack para adicionar mineradores
              </>
            )}
          </div>

          <div className="room-coordinates">
            {ROOM_RACK_CAPACITY} POSIÇÕES · LAYOUT V.02
          </div>
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
          <span>ESTIMATIVA POR BLOCO · 10 MIN</span>
          <strong>{estimatedReward}</strong>
          <small>
            Estimativa proporcional ao poder da rede. Recompensas desta versão
            são virtuais e não possuem saque.
          </small>
        </div>

        <EnergyCard
          energyHours={energyHours}
          batteryCount={batteryCount}
          onBuyBattery={onBuyBattery}
          onUseBattery={onUseBattery}
        />

        <div className="activity-feed compact">
          <div>
            <strong>ATIVIDADE RECENTE</strong>
            <span>AO VIVO</span>
          </div>
          <ul>
            <li>
              <i className="success" />
              <p>
                <strong>Layout de 12 racks pronto</strong>
                encaixes sincronizados
              </p>
              <time>agora</time>
            </li>
            <li>
              <i />
              <p>
                <strong>Bloco #3147 distribuído</strong>
                intervalo de 10 minutos
              </p>
              <time>10 min</time>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function EnergyCard({
  energyHours,
  batteryCount,
  onBuyBattery,
  onUseBattery,
}: {
  energyHours: number;
  batteryCount: number;
  onBuyBattery: () => void;
  onUseBattery: () => void;
}) {
  const chargedCells = Math.ceil(energyHours / BATTERY_HOURS);

  return (
    <div className="energy-card">
      <div className="energy-card-heading">
        <div className="battery-art">
          <img src={assetsManifest.battery.path} alt={assetsManifest.battery.alt} />
        </div>
        <div>
          <small>ENERGIA DOS MINERADORES</small>
          <strong>{formatEnergy(energyHours)}</strong>
          <span>{batteryCount} baterias no inventário</span>
        </div>
      </div>
      <div className="energy-cells" aria-label={`${chargedCells} de 4 células carregadas`}>
        {Array.from({ length: 4 }, (_, index) => (
          <i className={index < chargedCells ? "charged" : ""} key={index}>
            24h
          </i>
        ))}
      </div>
      <div className="energy-actions">
        <button
          type="button"
          onClick={onUseBattery}
          disabled={batteryCount === 0 || energyHours >= MAX_ENERGY_HOURS}
        >
          USAR BATERIA
        </button>
        <button type="button" onClick={onBuyBattery}>
          COMPRAR · {formatCma(BATTERY_PRICE_CMA)} CMA
        </button>
      </div>
      <p>Minigames poderão conceder baterias nas próximas etapas.</p>
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
          <span className="eyebrow">3 POOLS · BLOCOS DE 10 MINUTOS</span>
          <h2>Escolha uma única pool</h2>
          <p>
            Nesta fase, 100% do seu poder fica em uma pool por vez. A recompensa
            é proporcional ao seu poder comparado ao poder total da rede.
          </p>
        </div>
        <div className="cma-anchor-card">
          <img src={assetsManifest.cmaCoin.path} alt="" />
          <span>
            <small>ÂNCORA CMA</small>
            <strong>1 CMA = US$ 1</strong>
            <em>unidade contábil interna</em>
          </span>
        </div>
      </div>

      <div className="pool-grid">
        {pools.map((pool) => {
          const selected = pool.id === selectedPoolId;
          const estimate = calculateEstimatedReward(pool, installedPower);
          const dailyEstimate = calculateDailyEstimatedReward(
            pool,
            installedPower,
          );

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
                  <dd>10 min</dd>
                </div>
                <div>
                  <dt>Seu poder</dt>
                  <dd>{formatPower(installedPower)}</dd>
                </div>
                <div>
                  <dt>Por bloco</dt>
                  <dd>
                    {formatAtomic(estimate, pool.decimals)} {pool.symbol}
                  </dd>
                </div>
                <div>
                  <dt>24h estimadas</dt>
                  <dd>
                    {formatAtomic(dailyEstimate, pool.decimals)} {pool.symbol}
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
          <strong>Proteção da economia</strong>
          A estimativa não é retorno garantido. O poder global, a recompensa e
          o orçamento diário de cada pool podem ser rebalanceados para controlar
          emissão e preservar a reserva do jogo.
        </p>
      </div>
    </section>
  );
}

function InventoryView({
  installedMinerIds,
  onOpenRack,
}: {
  installedMinerIds: Set<string>;
  onOpenRack: () => void;
}) {
  return (
    <section className="inventory-view">
      <div className="section-intro">
        <div>
          <span className="eyebrow">CATÁLOGO INICIAL · 07 MINERADORES</span>
          <h2>Seus equipamentos</h2>
          <p>
            Mineradores de uma fan ocupam 1 slot. Modelos de duas fans usam uma
            prateleira inteira e entregam mais poder por espaço.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={onOpenRack}>
          GERENCIAR RACK
        </button>
      </div>

      <div className="inventory-grid">
        {miners.map((miner) => {
          const isInstalled = installedMinerIds.has(miner.id);

          return (
            <article className={`inventory-card ${miner.rarity}`} key={miner.id}>
              <div className="inventory-art">
                <span>{rarityLabels[miner.rarity]}</span>
                <img src={miner.asset} alt={miner.alt} />
                <b className="price-badge">
                  {formatCma(miner.priceCma)} CMA
                </b>
              </div>
              <div className="inventory-info">
                <span>
                  {miner.fanCount} {miner.fanCount === 1 ? "FAN" : "FANS"}
                </span>
                <h3>{miner.name}</h3>
                <div className="inventory-stats">
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
                  <p>
                    <small>EFICIÊNCIA</small>
                    <strong>
                      {formatPower(Math.round(miner.powerGh / miner.slotSize))}
                      /slot
                    </strong>
                  </p>
                </div>
                <em className={isInstalled ? "installed" : ""}>
                  {isInstalled ? "INSTALADO EM UM RACK" : "NO INVENTÁRIO"}
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
  rackLabel,
  roomName,
  installed,
  allInstalledMinerIds,
  onInstall,
  onRemove,
  onRemoveAll,
  onClose,
}: {
  rackLabel: string;
  roomName: string;
  installed: InstalledMiner[];
  allInstalledMinerIds: Set<string>;
  onInstall: (minerId: string, slotIndex?: number) => void;
  onRemove: (minerId: string) => void;
  onRemoveAll: () => void;
  onClose: () => void;
}) {
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const usedSlots = getUsedSlotCount(installed);

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
            <span className="eyebrow">
              {roomName.toUpperCase()} · EQUIPAMENTO
            </span>
            <h2 id="rack-title">Gerenciar {rackLabel}</h2>
            <p>
              Selecione uma posição vazia e escolha o minerador. Equipamentos de
              duas fans ocupam os dois slots da mesma prateleira.
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

            <div className="rack-preview corrected">
              <img src={assetsManifest.rackBasic.path} alt="" />
              {installed.map((placement) => {
                const miner = getMiner(placement.minerId);
                if (!miner) return null;
                const row = Math.floor(placement.slotIndex / RACK_COLUMNS);
                const column = placement.slotIndex % RACK_COLUMNS;
                return (
                  <button
                    type="button"
                    className={`preview-miner corrected size-${miner.slotSize}`}
                    key={placement.minerId}
                    style={{
                      left: `${27 + column * 24}%`,
                      top: `${row * 23.5 + 2}%`,
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
            <div className="rack-editor-heading">
              <div>
                <span>MAPA DO RACK</span>
                <strong>
                  {targetSlot === null
                    ? "ESCOLHA UM SLOT"
                    : `SLOT ${targetSlot + 1} SELECIONADO`}
                </strong>
              </div>
              <button
                type="button"
                onClick={onRemoveAll}
                disabled={installed.length === 0}
              >
                RETIRAR TODOS
              </button>
            </div>

            <div className="rack-slot-editor">
              {Array.from({ length: RACK_CAPACITY }, (_, slotIndex) => {
                const placement = installed.find(
                  (item) => item.slotIndex === slotIndex,
                );
                const covered = installed.some((item) => {
                  const miner = getMiner(item.minerId);
                  return (
                    miner &&
                    slotIndex > item.slotIndex &&
                    slotIndex < item.slotIndex + miner.slotSize
                  );
                });

                if (covered) return null;

                if (placement) {
                  const miner = getMiner(placement.minerId);
                  if (!miner) return null;
                  return (
                    <button
                      type="button"
                      className="slot-installed"
                      style={{ gridColumn: `span ${miner.slotSize}` }}
                      onClick={() => onRemove(miner.id)}
                      key={slotIndex}
                    >
                      <img src={miner.asset} alt="" />
                      <span>
                        <strong>{miner.name}</strong>
                        {miner.slotSize}{" "}
                        {miner.slotSize === 1 ? "slot" : "slots"} · retirar
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    type="button"
                    className={targetSlot === slotIndex ? "selected" : ""}
                    onClick={() => setTargetSlot(slotIndex)}
                    key={slotIndex}
                  >
                    <b>+</b>
                    <span>Adicionar minerador</span>
                    <small>SLOT {slotIndex + 1}</small>
                  </button>
                );
              })}
            </div>

            <div className="rack-inventory-heading">
              <div>
                <span>SEUS MINERADORES</span>
                <strong>
                  {miners.length - allInstalledMinerIds.size} disponíveis
                </strong>
              </div>
              <span>
                {targetSlot === null
                  ? "ENCAIXE AUTOMÁTICO"
                  : `INSTALAR NO SLOT ${targetSlot + 1}`}
              </span>
            </div>

            <div className="rack-miner-list">
              {miners.map((miner) => {
                const installedHere = installed.some(
                  (item) => item.minerId === miner.id,
                );
                const installedElsewhere =
                  allInstalledMinerIds.has(miner.id) && !installedHere;
                const possibleSlot = installedHere
                  ? null
                  : targetSlot === null
                    ? findNextAvailableSlot(installed, miner)
                    : canInstallAt(installed, miner, targetSlot)
                      ? targetSlot
                      : null;

                return (
                  <article
                    className={`rack-miner-card ${
                      installedHere ? "installed" : ""
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
                        {formatPower(miner.powerGh)} ·{" "}
                        {formatCma(miner.priceCma)} CMA
                      </p>
                    </div>
                    <div className="slot-cost">
                      <small>OCUPA</small>
                      <strong>
                        {miner.slotSize}{" "}
                        {miner.slotSize === 1 ? "SLOT" : "SLOTS"}
                      </strong>
                    </div>
                    {installedHere ? (
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
                        disabled={installedElsewhere || possibleSlot === null}
                        onClick={() => {
                          if (possibleSlot === null) return;
                          onInstall(miner.id, possibleSlot);
                          setTargetSlot(null);
                        }}
                      >
                        {installedElsewhere
                          ? "EM OUTRO RACK"
                          : possibleSlot === null
                            ? "NÃO CABE"
                            : "INSTALAR"}
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
            Encaixes salvos automaticamente neste dispositivo
          </p>
          <button type="button" onClick={onClose}>
            CONCLUIR
          </button>
        </footer>
      </section>
    </div>
  );
}

function RoomsModal({
  activeRoomId,
  ownedRoomIds,
  cmaBalance,
  onChoose,
  onBuy,
  onClose,
}: {
  activeRoomId: RoomId;
  ownedRoomIds: RoomId[];
  cmaBalance: number;
  onChoose: (roomId: RoomId) => void;
  onBuy: (room: RoomDefinition) => void;
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
        className="rooms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rooms-title"
      >
        <header>
          <div>
            <span className="eyebrow">EXPANSÃO DA OPERAÇÃO</span>
            <h2 id="rooms-title">Salas de mineração</h2>
            <p>
              Cada sala possui 12 posições de rack e mantém seu próprio layout.
            </p>
          </div>
          <div className="room-wallet">
            <small>SEU SALDO</small>
            <strong>{formatCma(cmaBalance)} CMA</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="room-store-grid">
          {roomDefinitions.map((room) => {
            const owned = ownedRoomIds.includes(room.id);
            const active = activeRoomId === room.id;
            return (
              <article
                className={`room-store-card ${active ? "active" : ""}`}
                key={room.id}
              >
                <div className="room-preview-image">
                  <img src={room.asset} alt={room.alt} />
                  <span>{owned ? "DESBLOQUEADA" : "BLOQUEADA"}</span>
                </div>
                <div className="room-store-info">
                  <span>{room.label}</span>
                  <h3>{room.name}</h3>
                  <p>12 posições de rack · layout independente</p>
                  <button
                    type="button"
                    disabled={active}
                    onClick={() => (owned ? onChoose(room.id) : onBuy(room))}
                  >
                    {active
                      ? "SALA ATUAL"
                      : owned
                        ? "ENTRAR NA SALA"
                        : `COMPRAR · ${formatCma(room.priceCma)} CMA`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
