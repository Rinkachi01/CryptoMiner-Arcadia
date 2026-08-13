"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { DailyWelcomeModal } from "./DailyWelcomeModal";
import { PacketCatchView } from "./PacketCatchView";
import { CareerView } from "./CareerView";
import { SeasonPanel } from "./SeasonPanel";
import { ConversionView } from "./ConversionView";
import { FirstDayPanel } from "./FirstDayPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { OperatorInbox } from "./OperatorInbox";
import { OperatorProgressPanel } from "./OperatorProgressPanel";
import { PCStatusPanel } from "./PCStatusPanel";
import { QuestsPanel } from "./QuestsPanel";
import { TasksView } from "./TasksView";
import { readClientBetaDeviceProfile } from "./beta-device-client";
import {
  BATTERY_HOURS,
  BATTERY_PRICE_CMA,
  BLOCK_INTERVAL_SECONDS,
  MAX_ENERGY_HOURS,
  RACK_CAPACITY,
  RACK_COLUMNS,
  RACK_PRICE_CMA,
  ROOM_RACK_CAPACITY,
  canInstallAt,
  calculateDailyEstimatedReward,
  calculateEstimatedReward,
  findNextAvailableSlot,
  formatAtomic,
  getInstalledPower,
  getMiner,
  getUsedSlotCount,
  miners,
  storeMiners,
  pools,
  type InstalledMiner,
  type PoolId,
} from "./game-rules";
import type {
  GameActionName,
  MinerUnit,
  PoolAllocations,
  PublicGameState,
  RackInstance,
  RoomId,
  WalletSymbol,
} from "./game-server";
import { roomCatalog } from "./room-rules";
import type { NetworkPowerSnapshot } from "./network-server";
import type { OnboardingStatus } from "./onboarding-rules";
import {
  SUPPLY_CRATE_PITY_LIMIT,
  formatCrateChance,
  supplyCrates,
  type SupplyCrateId,
  type SupplyCrateOpening,
} from "./supply-crate-rules";

type ViewId =
  | "mine"
  | "pools"
  | "conversion"
  | "inventory"
  | "shop"
  | "games"
  | "season"
  | "leaderboard"
  | "tasks"
  | "career";
type ShopCategory = "miners" | "racks" | "energy" | "crates";
type TextScale = "comfortable" | "large" | "extra";

type RoomDefinition = {
  id: RoomId;
  name: string;
  label: string;
  asset: string;
  alt: string;
  priceCma: number;
  sequence: number;
};

type RackPosition = {
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
};

type ArcadiaGameProps = {
  user: {
    displayName: string;
    email: string;
  };
  isOwner: boolean;
  signOutPath: string;
  unreadSupportReplies: number;
};

type GameApiResponse = {
  state: PublicGameState;
  version: number;
  serverTime: number;
  nextBlockAt: number;
  temporaryPowerGh: number;
  network?: NetworkPowerSnapshot;
  message: string;
  error?: string;
  actionResult?: {
    supplyCrate?: SupplyCrateOpening & {
      openCount: number;
    };
  };
};

const navigation: Array<{
  id: ViewId;
  label: string;
  shortLabel: string;
  glyph: string;
}> = [
  { id: "mine", label: "Sala de mineração", shortLabel: "Sala", glyph: "M" },
  { id: "pools", label: "Pools", shortLabel: "Pools", glyph: "P" },
  { id: "conversion", label: "Carteira", shortLabel: "Carteira", glyph: "W" },
  { id: "inventory", label: "Inventário", shortLabel: "Itens", glyph: "I" },
  { id: "shop", label: "Loja", shortLabel: "Loja", glyph: "$" },
  { id: "games", label: "Minigames", shortLabel: "Jogos", glyph: "G" },
  { id: "season", label: "Temporada", shortLabel: "Season", glyph: "S" },
  { id: "leaderboard", label: "Ranking Global", shortLabel: "Ranking", glyph: "R" },
  { id: "tasks", label: "Tarefas", shortLabel: "Tasks", glyph: "T" },
  {
    id: "career",
    label: "Central do operador",
    shortLabel: "Carreira",
    glyph: "C",
  },
];

const roomDefinitions: RoomDefinition[] = roomCatalog.map((room) => ({
  ...room,
  asset:
    room.id === "room-1"
      ? assetsManifest.roomOne.path
      : assetsManifest.roomTwo.path,
  alt:
    room.id === "room-1"
      ? assetsManifest.roomOne.alt
      : `${assetsManifest.roomTwo.alt} · setor ${room.sequence - 1}`,
}));

const rackPositions: RackPosition[] = [
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
];

const defaultRacks: RackInstance[] = [
  { id: "rack-01", roomId: "room-1", positionIndex: 0 },
];

const defaultRackMiners: Record<string, InstalledMiner[]> = {
  "rack-01": [],
};

const defaultMinerInventory: MinerUnit[] = [
  {
    instanceId: "starter-byte-spark-preview",
    minerId: "byte-spark",
  },
];

const defaultPoolAllocations: PoolAllocations = {
  cma: 100,
  btc: 0,
  doge: 0,
  ltc: 0,
};
const defaultNetworkSnapshot: NetworkPowerSnapshot = {
  basePowerGh: { cma: 0, btc: 0, doge: 0, ltc: 0 },
  playerPowerGh: { cma: 0, btc: 0, doge: 0, ltc: 0 },
  totalPowerGh: { cma: 0, btc: 0, doge: 0, ltc: 0 },
  baseBlockRewardAtomic: Object.fromEntries(
    pools.map((pool) => [pool.id, Number(pool.rewardAtomic)]),
  ) as Record<PoolId, number>,
  blockRewardAtomic: Object.fromEntries(
    pools.map((pool) => [pool.id, Number(pool.rewardAtomic)]),
  ) as Record<PoolId, number>,
  bonusActive: false,
  bonusBps: 10_000,
  bonusEndsAt: 0,
  testMode: true,
  updatedAt: 0,
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

function formatEnergy(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}h ${minutes
    .toString()
    .padStart(2, "0")}m`;
}

function rackMinerPosition(slotIndex: number): React.CSSProperties {
  const row = Math.floor(slotIndex / RACK_COLUMNS);
  const column = slotIndex % RACK_COLUMNS;
  return {
    left: `${31 + column * 21.5}%`,
    top: `${row * 23}%`,
  };
}

export function ArcadiaGame({
  user,
  isOwner,
  signOutPath,
  unreadSupportReplies,
}: ArcadiaGameProps) {
  const [activeView, setActiveView] = useState<ViewId>("mine");
  const [textScale, setTextScale] =
    useState<TextScale>("comfortable");
  const [shopCategory, setShopCategory] =
    useState<ShopCategory>("miners");
  const [careerStartTab, setCareerStartTab] = useState<
    "overview" | "missions"
  >("overview");
  const [selectedPoolId, setSelectedPoolId] = useState<PoolId>("cma");
  const [poolAllocations, setPoolAllocations] = useState<PoolAllocations>(
    defaultPoolAllocations,
  );
  const [displayedBalanceSymbol, setDisplayedBalanceSymbol] =
    useState<WalletSymbol>("CMA");
  const [cmaBalance, setCmaBalance] = useState(0);
  const [btcBalanceAtomic, setBtcBalanceAtomic] = useState(0);
  const [dogeBalanceAtomic, setDogeBalanceAtomic] = useState(0);
  const [ltcBalanceAtomic, setLtcBalanceAtomic] = useState(0);
  const [batteryCount, setBatteryCount] = useState(0);
  const [energyExpiresAt, setEnergyExpiresAt] = useState(0);
  const [lastSettledBlock, setLastSettledBlock] = useState(0);
  const [temporaryPowerGh, setTemporaryPowerGh] = useState(0);
  const [network, setNetwork] = useState<NetworkPowerSnapshot>(
    defaultNetworkSnapshot,
  );
  const [clockNow, setClockNow] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState<RoomId>("room-1");
  const [ownedRoomIds, setOwnedRoomIds] = useState<RoomId[]>(["room-1"]);
  const [rackInventoryCount, setRackInventoryCount] = useState(0);
  const [crateOpenCount, setCrateOpenCount] = useState(0);
  const [cratePityStreaks, setCratePityStreaks] = useState<
    Record<SupplyCrateId, number>
  >({
    "signal-cache": 0,
    "grid-cache": 0,
    "quantum-cache": 0,
  });
  const [minerInventory, setMinerInventory] =
    useState<MinerUnit[]>(defaultMinerInventory);
  const [racks, setRacks] = useState<RackInstance[]>(defaultRacks);
  const [rackMiners, setRackMiners] =
    useState<Record<string, InstalledMiner[]>>(defaultRackMiners);
  const [activeRackId, setActiveRackId] = useState("rack-01");
  const [rackOpen, setRackOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [serverVersion, setServerVersion] = useState(0);
  const [serverStatus, setServerStatus] = useState<
    "connecting" | "online" | "error"
  >("connecting");
  const [actionPending, setActionPending] = useState(false);
  const [toast, setToast] = useState("");
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const lastBetaProfileKey = useRef("");

  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0];
  const activeRoom =
    roomDefinitions.find((room) => room.id === activeRoomId) ??
    roomDefinitions[0];
  const [blockDeadline, setBlockDeadline] = useState(0);
  const playerInitial =
    user.displayName.trim().charAt(0).toLocaleUpperCase("pt-BR") || "M";
  const secondsLeft = hydrated
    ? Math.max(0, Math.ceil((blockDeadline - clockNow) / 1000))
    : selectedPool.blockSeconds;

  const allInstalled = useMemo(
    () => Object.values(rackMiners).flat(),
    [rackMiners],
  );
  const installedPower = useMemo(
    () => getInstalledPower(allInstalled),
    [allInstalled],
  );
  const energySeconds = hydrated
    ? Math.max(0, Math.ceil((energyExpiresAt - clockNow) / 1000))
    : 0;
  const effectivePower =
    energySeconds > 0 ? installedPower + temporaryPowerGh : 0;
  const currentRoomRacks = useMemo(
    () => racks.filter((rack) => rack.roomId === activeRoomId),
    [activeRoomId, racks],
  );
  const activeRack =
    racks.find((rack) => rack.id === activeRackId) ?? currentRoomRacks[0];
  const activeRackMiners = activeRack ? rackMiners[activeRack.id] ?? [] : [];

  function applyServerSnapshot(snapshot: GameApiResponse) {
    const state = snapshot.state;
    setSelectedPoolId(state.selectedPoolId);
    setPoolAllocations(state.poolAllocations);
    setDisplayedBalanceSymbol(state.displayedBalanceSymbol);
    setCmaBalance(state.cmaBalance);
    setBtcBalanceAtomic(state.btcBalanceAtomic);
    setDogeBalanceAtomic(state.dogeBalanceAtomic);
    setLtcBalanceAtomic(state.ltcBalanceAtomic);
    setBatteryCount(state.batteryCount);
    setEnergyExpiresAt(state.energyExpiresAt);
    setLastSettledBlock(state.lastSettledBlock);
    setTemporaryPowerGh(Math.max(0, snapshot.temporaryPowerGh ?? 0));
    if (snapshot.network) setNetwork(snapshot.network);
    setActiveRoomId(state.activeRoomId);
    setOwnedRoomIds(state.ownedRoomIds);
    setRackInventoryCount(state.rackInventoryCount);
    setCrateOpenCount(Math.max(0, state.crateOpenCount ?? 0));
    setCratePityStreaks({
      "signal-cache": state.cratePityStreaks?.["signal-cache"] ?? 0,
      "grid-cache": state.cratePityStreaks?.["grid-cache"] ?? 0,
      "quantum-cache": state.cratePityStreaks?.["quantum-cache"] ?? 0,
    });
    setMinerInventory(state.minerInventory);
    setRacks(state.racks);
    setRackMiners(state.rackMiners);
    setActiveRackId((current) =>
      state.racks.some((rack) => rack.id === current)
        ? current
        : (state.racks[0]?.id ?? "rack-01"),
    );
    setServerVersion(snapshot.version);
    setClockNow(snapshot.serverTime);
    setBlockDeadline(snapshot.nextBlockAt);
    setServerStatus("online");
    setHydrated(true);
  }

  async function performGameAction(
    action: GameActionName,
    payload: Record<string, unknown> = {},
  ) {
    if (serverStatus !== "online" || actionPending) {
      if (serverStatus !== "online") {
        setToast("Aguarde a conexão segura com o servidor.");
      }
      return null;
    }

    setActionPending(true);
    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload,
          expectedVersion: serverVersion,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = (await response.json()) as GameApiResponse;
      if (result.state) applyServerSnapshot(result);
      setToast(result.error ?? result.message);
      return response.ok ? result : null;
    } catch {
      setServerStatus("error");
      setToast("A conexão com o servidor foi interrompida. Nenhuma ação local foi aplicada.");
      return null;
    } finally {
      setActionPending(false);
    }
  }

  async function refreshServerState() {
    try {
      const response = await fetch("/api/game", { cache: "no-store" });
      const result = (await response.json()) as GameApiResponse;
      if (response.ok && result.state) {
        applyServerSnapshot(result);
        return true;
      }
    } catch {
      setServerStatus("error");
    }
    return false;
  }

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bootstrap",
          }),
          signal: controller.signal,
        });
        const result = (await response.json()) as GameApiResponse;
        if (!response.ok || !result.state) {
          throw new Error(result.error ?? "Servidor indisponível.");
        }
        applyServerSnapshot(result);
      } catch (error) {
        if (controller.signal.aborted) return;
        setClockNow(Date.now());
        setEnergyExpiresAt(Date.now());
        setHydrated(true);
        setServerStatus("error");
        setToast(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a conta.",
        );
      }
    })();

    return () => controller.abort();
    // A inicialização autoritativa acontece uma única vez por sessão.
  }, []);

  useEffect(() => {
    if (!hydrated || serverStatus !== "online") return;
    const controller = new AbortController();
    void fetch("/api/onboarding", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        setOnboarding((await response.json()) as OnboardingStatus);
      })
      .catch(() => {
        // O jogo permanece funcional se o guia estiver temporariamente offline.
      });
    return () => controller.abort();
  }, [hydrated, serverStatus, serverVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
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

  useEffect(() => {
    if (!hydrated || serverStatus !== "online" || !onboarding) return;
    const profile = readClientBetaDeviceProfile(textScale);
    const profileKey = [
      profile.viewport,
      profile.inputMode,
      profile.textScale,
      onboarding.completedCount,
    ].join(":");
    if (lastBetaProfileKey.current === profileKey) return;
    lastBetaProfileKey.current = profileKey;
    void fetch("/api/beta-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record-profile",
        onboardingStage: onboarding.completedCount,
        ...profile,
      }),
    }).catch(() => {
      lastBetaProfileKey.current = "";
    });
  }, [hydrated, onboarding, serverStatus, textScale]);

  useEffect(() => {
    if (
      !hydrated ||
      serverStatus !== "online" ||
      blockDeadline <= Date.now()
    ) {
      return;
    }
    const delay = Math.max(1000, blockDeadline - Date.now() + 350);
    const timer = window.setTimeout(() => {
      void fetch("/api/game", { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json()) as GameApiResponse;
          if (response.ok && result.state) applyServerSnapshot(result);
        })
        .catch(() => setServerStatus("error"));
    }, delay);
    return () => window.clearTimeout(timer);
    // O prazo do bloco é fornecido pelo servidor e agenda uma única sincronização.
  }, [blockDeadline, hydrated, serverStatus]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.style.overflow = roomsOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [roomsOpen]);

  async function installMiner(instanceId: string, requestedSlot?: number) {
    if (!activeRack) return;
    await performGameAction("install_miner", {
      rackId: activeRack.id,
      instanceId,
      ...(requestedSlot === undefined ? {} : { slotIndex: requestedSlot }),
    });
  }

  async function removeMiner(instanceId: string) {
    if (!activeRack) return;
    await performGameAction("remove_miner", {
      rackId: activeRack.id,
      instanceId,
    });
  }

  async function removeAllMiners() {
    if (!activeRack || activeRackMiners.length === 0) return;
    await performGameAction("remove_all_miners", {
      rackId: activeRack.id,
    });
  }

  async function applyPoolAllocations(next: PoolAllocations) {
    await performGameAction("apply_allocations", {
      allocations: next,
    });
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

  function openStore(category: ShopCategory) {
    setShopCategory(category);
    setActiveView("shop");
    setWalletOpen(false);
  }

  async function placeRack(positionIndex: number) {
    if (!ownedRoomIds.includes(activeRoomId)) return;
    if (rackInventoryCount <= 0) {
      openStore("racks");
      setToast("Compre um rack na loja antes de instalar.");
      return;
    }
    const result = await performGameAction("place_rack", {
      roomId: activeRoomId,
      positionIndex,
    });
    const rack = result?.state.racks.find(
      (item) =>
        item.roomId === activeRoomId &&
        item.positionIndex === positionIndex,
    );
    if (rack) {
      setActiveRackId(rack.id);
      window.setTimeout(() => setRackOpen(true), 100);
    }
  }

  async function chooseRoom(roomId: RoomId) {
    if (!ownedRoomIds.includes(roomId)) {
      setRoomsOpen(true);
      return;
    }
    const result = await performGameAction("set_active_room", { roomId });
    if (result) {
      setEditMode(false);
      setRoomsOpen(false);
      const rack = result.state.racks.find((item) => item.roomId === roomId);
      if (rack) setActiveRackId(rack.id);
    }
  }

  async function buyRoom(room: RoomDefinition) {
    if (ownedRoomIds.includes(room.id)) {
      await chooseRoom(room.id);
      return;
    }
    const result = await performGameAction("buy_room", { roomId: room.id });
    if (result) {
      setEditMode(true);
      setRoomsOpen(false);
    }
  }

  async function buyMiners(minerId: string, quantity: number) {
    await performGameAction("buy_miners", { minerId, quantity });
  }

  async function buyRacks(quantity: number) {
    await performGameAction("buy_racks", { quantity });
  }

  async function buyBatteries(quantity: number) {
    await performGameAction("buy_batteries", { quantity });
  }

  async function openSupplyCrate(crateId: SupplyCrateId) {
    return performGameAction("open_supply_crate", { crateId });
  }

  async function activateBattery() {
    await performGameAction("use_battery");
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

  const balances: Array<{
    symbol: WalletSymbol;
    value: string;
    asset: string;
    alt: string;
  }> = [
    {
      symbol: "CMA",
      value: formatCma(cmaBalance),
      asset: assetsManifest.cmaCoin.path,
      alt: assetsManifest.cmaCoin.alt,
    },
    {
      symbol: "BTC",
      value: (btcBalanceAtomic / 100_000_000).toFixed(8),
      asset: assetsManifest.bitcoin.path,
      alt: assetsManifest.bitcoin.alt,
    },
    {
      symbol: "DOGE",
      value: (dogeBalanceAtomic / 100_000_000).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }),
      asset: assetsManifest.dogecoin.path,
      alt: assetsManifest.dogecoin.alt,
    },
    {
      symbol: "LTC",
      value: (ltcBalanceAtomic / 100_000_000).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }),
      asset: assetsManifest.litecoin.path,
      alt: assetsManifest.litecoin.alt,
    },
  ];
  const displayedBalance =
    balances.find(
      (balance) => balance.symbol === displayedBalanceSymbol,
    ) ?? balances[0];

  return (
    <main
      className={`arcadia-shell text-scale-${textScale} ${
        actionPending ? "server-action-pending" : ""
      }`}
      data-server-status={serverStatus}
    >
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

        <OperatorInbox
          energySeconds={energySeconds}
          batteryCount={batteryCount}
          rackCount={racks.length}
          installedMinerCount={allInstalled.length}
          poolAllocations={poolAllocations}
          secondsLeft={secondsLeft}
          onboarding={onboarding}
          refreshKey={serverVersion}
          onNavigate={(target) => {
            setRackOpen(false);
            setWalletOpen(false);
            if (target === "career") setCareerStartTab("missions");
            setActiveView(target);
          }}
        />

        <button
          className="reading-mode-toggle"
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
          <b>A+</b>
          <span>
            <small>LEITURA</small>
            <strong>
              {textScale === "comfortable"
                ? "CONFORTÁVEL"
                : textScale === "large"
                  ? "GRANDE"
                  : "EXTRA GRANDE"}
            </strong>
          </span>
        </button>

        <div className="balances wallet-control">
          <button
            className="wallet-trigger"
            type="button"
            title="Abrir carteira virtual e escolher a moeda exibida"
            aria-label={`Abrir carteira virtual. Saldo exibido: ${displayedBalance.symbol} ${displayedBalance.value}`}
            aria-expanded={walletOpen}
            aria-controls="wallet-menu"
            onClick={() => setWalletOpen((open) => !open)}
          >
            <img src={displayedBalance.asset} alt="" />
            <span>
              <small>SALDO {displayedBalance.symbol}</small>
              <strong>{displayedBalance.value}</strong>
            </span>
            <b aria-hidden="true">⌄</b>
          </button>
          {walletOpen && (
            <div
              className="wallet-menu"
              id="wallet-menu"
              aria-label="Saldos virtuais"
            >
              <div className="wallet-menu-title">
                <span>CARTEIRA VIRTUAL</span>
                <small>saque manual de BTC/DOGE/LTC</small>
              </div>
              {balances.map((balance) => (
                <button
                  type="button"
                  className={`wallet-balance-row ${
                    displayedBalanceSymbol === balance.symbol ? "selected" : ""
                  }`}
                  key={balance.symbol}
                  title={`Exibir ${balance.symbol} no topo`}
                  onClick={() => {
                    void performGameAction("set_wallet_symbol", {
                      symbol: balance.symbol,
                    });
                    setWalletOpen(false);
                  }}
                >
                  <img src={balance.asset} alt={balance.alt} />
                  <span>{balance.symbol}</span>
                  <strong title={balance.value}>{balance.value}</strong>
                  <em>
                    {displayedBalanceSymbol === balance.symbol
                      ? "EXIBINDO"
                      : "FIXAR"}
                  </em>
                </button>
              ))}
              <button
                type="button"
                className="wallet-conversion-link"
                title="Abrir a carteira completa e a conversão para CMA"
                onClick={() => {
                  setRackOpen(false);
                  setWalletOpen(false);
                  setActiveView("conversion");
                }}
              >
                <span>⇄</span>
                <strong>ABRIR CARTEIRA</strong>
                <em>CONVERTER</em>
              </button>
            </div>
          )}
        </div>

        <div className="account-control">
          <span>
            <small>
              {serverStatus === "online" ? "CONTA PROTEGIDA" : "CONECTANDO"}
            </small>
            <strong>{user.displayName}</strong>
          </span>
          <a href={signOutPath}>SAIR</a>
          <b>{playerInitial}</b>
        </div>
      </header>

      <div className={`server-status-strip ${serverStatus}`}>
        <span className="online-dot" />
        {serverStatus === "online"
          ? `PROGRESSO PROTEGIDO · VERSÃO ${serverVersion}`
          : serverStatus === "connecting"
            ? "CARREGANDO SUA CONTA SEGURA"
            : "SERVIDOR INDISPONÍVEL · AÇÕES BLOQUEADAS"}
        <small>BLOCO SINCRONIZADO #{lastSettledBlock}</small>
      </div>

      <DailyWelcomeModal onClose={() => {}} />

      <aside className="sidebar" aria-label="Navegação principal">
        <div className="player-card">
          <div className="avatar-frame">{playerInitial}</div>
          <div>
            <span>OPERADOR</span>
            <strong>{user.displayName}</strong>
            <small>CONTA NO SERVIDOR</small>
          </div>
        </div>

        <nav>
          {navigation.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              type="button"
              key={item.id}
              title={item.label}
              onClick={(event) => {
                event.currentTarget.blur();
                setRackOpen(false);
                setWalletOpen(false);
                if (item.id === "career") setCareerStartTab("overview");
                setActiveView(item.id);
              }}
            >
              <span className="nav-glyph">{item.glyph}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <a className="support-nav-link" href="/support" title="Central de suporte">
            <span className="nav-glyph">?</span>
            <span>Central de suporte</span>
            {unreadSupportReplies > 0 ? (
              <small>{Math.min(99, unreadSupportReplies)}</small>
            ) : null}
          </a>
          {isOwner ? (
            <a className="admin-nav-link" href="/admin" title="Central do proprietário">
              <span className="nav-glyph">C</span>
              <span>Central do proprietário</span>
              <small>OWNER</small>
            </a>
          ) : null}
        </nav>

        <div className="simulation-note">
          <span>SIMULAÇÃO VIRTUAL</span>
          <p>Operação virtual com progresso e economia controlados pelo servidor.</p>
          <div className="sidebar-public-links">
            <a href="/legal">TERMOS E PRIVACIDADE</a>
          </div>
        </div>
      </aside>

      <section className={`workspace workspace-${activeView}`}>
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">
              {rackOpen && activeRack ? (
                <>
                  CONTROLE DE RACK <i /> {activeRoom.name.toUpperCase()}
                </>
              ) : activeView === "shop" ? (
                <>MERCADO ARCADIA <i /> EQUIPAMENTOS E ENERGIA</>
              ) : activeView === "conversion" ? (
                <>CARTEIRA DO OPERADOR <i /> SALDOS E CONVERSÃO</>
              ) : activeView === "games" ? (
                <>ARCADE ARCADIA <i /> 3 MINIGAMES ONLINE</>
              ) : activeView === "season" ? (
                <>TEMPORADA 01 <i /> CORRIDA ESPACIAL</>
              ) : activeView === "leaderboard" ? (
                <>RANKING GLOBAL <i /> MAIORES MINERADORES</>
              ) : activeView === "tasks" ? (
                <>CENTRAL DE TAREFAS <i /> MISSÕES E FEEDBACK</>
              ) : activeView === "career" ? (
                <>CENTRAL DO OPERADOR <i /> PROGRESSO E MISSÕES</>
              ) : (
                <>
                  {activeRoom.label} <i /> {activeRoom.name.toUpperCase()}
                </>
              )}
            </span>
            <h1>
              {rackOpen && activeRack
                ? "Gerenciar equipamentos"
                : activeView === "mine"
                  ? "Sua sala de mineração"
                  : activeView === "pools"
                    ? "Pools de mineração"
                    : activeView === "conversion"
                      ? "Carteira e conversão"
                    : activeView === "inventory"
                      ? "Inventário de equipamentos"
                      : activeView === "shop"
                        ? "Loja de equipamentos"
                        : activeView === "games"
                          ? "Central de minigames"
                        : activeView === "season"
                          ? "Passe da temporada"
                          : activeView === "tasks"
                            ? "Central de tarefas"
                            : "Carreira do operador"}
            </h1>
          </div>
        </div>

        <div className="metric-strip">
          <article className="power-metric">
            <span className="metric-icon power">H</span>
            <div>
              <small>PODER INSTALADO</small>
              <strong>{formatPower(effectivePower)}</strong>
            </div>
            <em>
              {energySeconds <= 0
                ? "SEM ENERGIA"
                : temporaryPowerGh > 0
                  ? `+${formatPower(temporaryPowerGh)} DOS JOGOS`
                  : "ATIVO"}
            </em>
          </article>
          <article className="rack-metric">
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
              <strong>{formatEnergy(energySeconds)}</strong>
            </div>
            <em>{batteryCount} BATERIAS</em>
          </article>
          <article className="pool-metric">
            <span className="metric-icon pool">P</span>
            <div>
              <small>REDE PRINCIPAL</small>
              <strong>{selectedPool.symbol}</strong>
            </div>
            <em>{formatPower(network.playerPowerGh[selectedPool.id])} NA REDE</em>
          </article>
        </div>

        {rackOpen && activeRack && (
          <GameErrorBoundary
            compact
            resetKey={activeRack.id}
            title="O painel do rack foi interrompido"
            message="Sua sala e seus equipamentos continuam salvos. Volte à sala e tente novamente."
            onRecover={() => setRackOpen(false)}
          >
            <RackManager
              rackLabel={`RACK ${String(
                currentRoomRacks.findIndex(
                  (rack) => rack.id === activeRack.id,
                ) + 1,
              ).padStart(2, "0")}`}
              roomName={activeRoom.name}
              installed={activeRackMiners}
              minerInventory={minerInventory}
              onInstall={installMiner}
              onRemove={removeMiner}
              onRemoveAll={removeAllMiners}
              onClose={() => setRackOpen(false)}
            />
          </GameErrorBoundary>
        )}

        {!rackOpen && activeView === "mine" && (
          <div className="mine-view-container">
            <div className="mine-main-content">
              <MiningRoom
                activeRoom={activeRoom}
                roomRacks={currentRoomRacks}
                rackMiners={rackMiners}
                editMode={editMode}
                poolAllocations={poolAllocations}
                network={network}
                effectivePower={effectivePower}
                secondsLeft={secondsLeft}
                energySeconds={energySeconds}
                batteryCount={batteryCount}
                rackInventoryCount={rackInventoryCount}
                ownedRooms={ownedRoomIds.length}
                onSetEditMode={setEditMode}
                onOpenRack={openRack}
                onPlaceRack={placeRack}
                onOpenPools={() => setActiveView("pools")}
                onOpenRooms={() => setRoomsOpen(true)}
                onOpenStore={openStore}
                onOpenGames={() => setActiveView("games")}
                onUseBattery={activateBattery}
              />
            </div>
            <style jsx>{`
              .mine-view-container {
                display: flex;
                flex-direction: row;
                gap: 24px;
                padding: 0 16px;
                max-width: 1400px;
                margin: 0 auto;
                align-items: flex-start;
              }
              .mine-main-content {
                flex: 1;
                min-width: 0;
              }
              .mine-side-panels {
                width: 320px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex-shrink: 0;
              }
              @media (max-width: 900px) {
                .mine-view-container {
                  flex-direction: column;
                }
              }
            `}</style>
          </div>
        )}

        {!rackOpen && activeView === "mine" && (
          <FirstDayPanel
            batteryCount={batteryCount}
            status={onboarding}
            onNavigate={(target) => {
              if (target === "career") setCareerStartTab("missions");
              setActiveView(target);
            }}
            onOpenStarterRack={() => {
              setActiveView("mine");
              openRack("rack-01");
            }}
            onActivateEnergy={() => {
              void activateBattery();
            }}
          />
        )}

        {!rackOpen && activeView === "pools" && (
          <PoolsView
            allocations={poolAllocations}
            installedPower={effectivePower}
            network={network}
            onApplyAllocations={applyPoolAllocations}
          />
        )}

        {!rackOpen && activeView === "conversion" && (
          <ConversionView
            btcBalanceAtomic={btcBalanceAtomic}
            cmaBalance={cmaBalance}
            dogeBalanceAtomic={dogeBalanceAtomic}
            ltcBalanceAtomic={ltcBalanceAtomic}
            onRefreshAccount={refreshServerState}
            serverVersion={serverVersion}
          />
        )}

        {!rackOpen && activeView === "inventory" && (
          <InventoryView
            minerInventory={minerInventory}
            installedMiners={allInstalled}
            rackInventoryCount={rackInventoryCount}
            batteryCount={batteryCount}
            onOpenRack={openRackFromInventory}
            onOpenStore={openStore}
          />
        )}

        {!rackOpen && activeView === "shop" && (
          <ShopView
            activeCategory={shopCategory}
            cmaBalance={cmaBalance}
            minerInventory={minerInventory}
            installedMiners={allInstalled}
            rackInventoryCount={rackInventoryCount}
            batteryCount={batteryCount}
            crateOpenCount={crateOpenCount}
            cratePityStreaks={cratePityStreaks}
            onSetCategory={setShopCategory}
            onBuyMiners={buyMiners}
            onBuyRacks={buyRacks}
            onBuyBatteries={buyBatteries}
            onOpenSupplyCrate={openSupplyCrate}
            onGoToRoom={() => {
              setActiveView("mine");
              setEditMode(true);
            }}
          />
        )}

        {!rackOpen && activeView === "games" && (
          <div style={{ display: "flex", gap: "24px", maxWidth: "1400px", margin: "0 auto", padding: "0 16px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PacketCatchView
                temporaryPowerGh={temporaryPowerGh}
                onRefreshAccount={refreshServerState}
              />
            </div>
            <div style={{ width: "320px", flexShrink: 0 }}>
              <PCStatusPanel refreshKey={serverVersion} />
            </div>
          </div>
        )}

        {!rackOpen && activeView === "season" && (
          <SeasonPanel
            refreshKey={serverVersion}
            onRefreshAccount={refreshServerState}
          />
        )}

        {!rackOpen && activeView === "tasks" && (
          <TasksView
            onboardingStage={onboarding?.completedCount ?? 0}
            textScale={textScale}
            onNavigate={(target) => {
              setRackOpen(false);
              if (target === "career") setCareerStartTab("overview");
              setActiveView(target);
            }}
          />
        )}

        {!rackOpen && activeView === "career" && (
          <CareerView
            initialTab={careerStartTab}
            onRefreshAccount={refreshServerState}
          />
        )}

        {!rackOpen && activeView === "leaderboard" && (
          <LeaderboardPanel />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.id}
            className={activeView === item.id ? "active" : ""}
            onClick={() => {
              setRackOpen(false);
              if (item.id === "career") setCareerStartTab("overview");
              setActiveView(item.id);
            }}
          >
            <span>{item.glyph}</span>
            {item.shortLabel}
          </button>
        ))}
        <a className="mobile-support-link" href="/support">
          <span>?</span>
          Suporte
          {unreadSupportReplies > 0 ? (
            <b>{Math.min(99, unreadSupportReplies)}</b>
          ) : null}
        </a>
      </nav>

      {roomsOpen && (
        <RoomsModal
          activeRoomId={activeRoomId}
          ownedRoomIds={ownedRoomIds}
          cmaBalance={cmaBalance}
          purchasePending={actionPending}
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
  poolAllocations,
  network,
  effectivePower,
  secondsLeft,
  energySeconds,
  batteryCount,
  rackInventoryCount,
  ownedRooms,
  onSetEditMode,
  onOpenRack,
  onPlaceRack,
  onOpenPools,
  onOpenRooms,
  onOpenStore,
  onOpenGames,
  onUseBattery,
}: {
  activeRoom: RoomDefinition;
  roomRacks: RackInstance[];
  rackMiners: Record<string, InstalledMiner[]>;
  editMode: boolean;
  poolAllocations: PoolAllocations;
  network: NetworkPowerSnapshot;
  effectivePower: number;
  secondsLeft: number;
  energySeconds: number;
  batteryCount: number;
  rackInventoryCount: number;
  ownedRooms: number;
  onSetEditMode: (value: boolean) => void;
  onOpenRack: (rackId: string) => void;
  onPlaceRack: (positionIndex: number) => void;
  onOpenPools: () => void;
  onOpenRooms: () => void;
  onOpenStore: (category: ShopCategory) => void;
  onOpenGames: () => void;
  onUseBattery: () => void;
}) {
  const [operationsOpen, setOperationsOpen] = useState(false);
  const orderedRoomRacks = [...roomRacks].sort(
    (first, second) => first.positionIndex - second.positionIndex,
  );
  const firstEmptyRackPosition = rackPositions.findIndex(
    (_, positionIndex) =>
      !roomRacks.some((rack) => rack.positionIndex === positionIndex),
  );

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
              <span>●</span> SALA
            </button>
            <button
              type="button"
              className={editMode ? "selected edit-active" : ""}
              onClick={() => onSetEditMode(true)}
            >
              <span>+</span> ORGANIZAR · {roomRacks.length}/{ROOM_RACK_CAPACITY}
            </button>
            <button type="button" onClick={onOpenRooms}>
              <span>▣</span> TROCAR SALA · {ownedRooms}/{roomDefinitions.length}
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
                  onClick={() => onPlaceRack(positionIndex)}
                  aria-label={`Instalar rack na posição ${positionIndex + 1}`}
                >
                  <span>+</span>
                  <small>POSIÇÃO {positionIndex + 1}</small>
                  <b>
                    {rackInventoryCount > 0
                      ? `INSTALAR · ${rackInventoryCount} DISP.`
                      : "ABRIR LOJA"}
                  </b>
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
                <span className="rack-visual">
                  <img
                    className="rack-frame"
                    src={assetsManifest.rackBasic.path}
                    alt=""
                  />
                  {installed.map((placement) => {
                    const miner = getMiner(placement.minerId);
                    if (!miner) return null;

                    return (
                      <img
                        className={`rack-miner size-${miner.slotSize}`}
                        key={placement.instanceId}
                        src={miner.asset}
                        alt={miner.alt}
                        style={rackMinerPosition(placement.slotIndex)}
                      />
                    );
                  })}
                </span>
                <span className="rack-click-label">
                  <b>RACK · {getUsedSlotCount(installed)}/8</b>
                  CLIQUE PARA GERENCIAR
                </span>
              </button>
            );
          })}

          <div className="room-coordinates">
            {ROOM_RACK_CAPACITY} POSIÇÕES GRATUITAS · LAYOUT V.03
          </div>
        </div>

        <div className="room-command-dock" aria-label="Resumo da operação">
          <div className="room-command-status">
            <span><small>PODER</small><strong>{formatPower(effectivePower)}</strong></span>
            <span><small>ENERGIA</small><strong>{formatEnergy(energySeconds)}</strong></span>
            <span><small>PRÓXIMO BLOCO</small><strong>{formatTimer(secondsLeft)}</strong></span>
          </div>
          <div className="room-command-actions">
            <button type="button" onClick={() => setOperationsOpen(true)}>
              <span>⌁</span> OPERAÇÃO
            </button>
            <button type="button" onClick={onOpenPools}>
              <span>◫</span> POOLS
            </button>
            <button type="button" onClick={() => onOpenStore("miners")}>
              <span>＋</span> LOJA
            </button>
          </div>
        </div>

        <nav
          className="mobile-rack-dock"
          aria-label="Acesso rápido aos racks desta sala"
        >
          <header>
            <div>
              <span>RACKS DA SALA</span>
              <strong>
                {roomRacks.length}/{ROOM_RACK_CAPACITY} instalados
              </strong>
            </div>
            <small>Deslize e toque para gerenciar</small>
          </header>
          <div className="mobile-rack-scroll">
            {orderedRoomRacks.map((rack) => {
              const installed = rackMiners[rack.id] ?? [];
              const usedSlots = getUsedSlotCount(installed);
              return (
                <button
                  type="button"
                  className="mobile-rack-card"
                  onClick={() => onOpenRack(rack.id)}
                  aria-label={`Abrir rack da posição ${
                    rack.positionIndex + 1
                  }, ${usedSlots} de 8 slots ocupados`}
                  key={rack.id}
                >
                  <span className="mobile-rack-sprite" aria-hidden="true">
                    <img
                      className="rack-frame"
                      src={assetsManifest.rackBasic.path}
                      alt=""
                    />
                    {installed.map((placement) => {
                      const miner = getMiner(placement.minerId);
                      if (!miner) return null;
                      return (
                        <img
                          className={`rack-miner size-${miner.slotSize}`}
                          key={placement.instanceId}
                          src={miner.asset}
                          alt=""
                          style={rackMinerPosition(placement.slotIndex)}
                        />
                      );
                    })}
                  </span>
                  <span className="mobile-rack-copy">
                    <strong>
                      RACK {String(rack.positionIndex + 1).padStart(2, "0")}
                    </strong>
                    <small>{usedSlots}/8 slots ocupados</small>
                  </span>
                  <b>ABRIR</b>
                </button>
              );
            })}

            {editMode && firstEmptyRackPosition >= 0 && (
              <button
                type="button"
                className="mobile-rack-card add"
                onClick={() => onPlaceRack(firstEmptyRackPosition)}
                aria-label={`Instalar rack na posição ${firstEmptyRackPosition + 1}`}
              >
                <span className="mobile-rack-add" aria-hidden="true">
                  +
                </span>
                <span className="mobile-rack-copy">
                  <strong>POSIÇÃO {firstEmptyRackPosition + 1}</strong>
                  <small>
                    {rackInventoryCount > 0
                      ? `${rackInventoryCount} rack disponível`
                      : "Abrir loja de racks"}
                  </small>
                </span>
                <b>{rackInventoryCount > 0 ? "INSTALAR" : "LOJA"}</b>
              </button>
            )}
          </div>
        </nav>
      </section>

      {operationsOpen && (
        <>
          <button
            aria-label="Fechar painel da operação"
            className="operation-drawer-backdrop"
            onClick={() => setOperationsOpen(false)}
            type="button"
          />
          <aside className="operation-panel operation-drawer" aria-label="Detalhes da operação">
        <div className="panel-title">
          <span>OPERAÇÃO ATUAL</span>
          <button aria-label="Fechar" onClick={() => setOperationsOpen(false)} type="button">×</button>
        </div>

        <EnergyCard
          energySeconds={energySeconds}
          batteryCount={batteryCount}
          onOpenGames={onOpenGames}
          onOpenStore={() => onOpenStore("energy")}
          onUseBattery={onUseBattery}
        />

        <div style={{ padding: "16px" }}>
          <QuestsPanel
            refreshKey={serverVersion}
            onRefreshAccount={refreshServerState}
          />
        </div>

        <div className="allocation-summary-card">
          <div className="allocation-summary-heading">
            <span>DISTRIBUIÇÃO DE PODER</span>
            <strong>{energySeconds > 0 ? "ATIVA" : "PAUSADA"}</strong>
          </div>
          <div className="allocation-summary-list">
            {pools.map((pool) => {
              const allocation = poolAllocations[pool.id];
              return (
                <div key={pool.id}>
                  <img src={pool.asset} alt="" />
                  <span>{pool.symbol}</span>
                  <b>{allocation}%</b>
                  <small>
                    {formatPower(
                      Math.floor((effectivePower * allocation) / 100),
                    )}
                  </small>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={onOpenPools}>
            AJUSTAR DISTRIBUIÇÃO
          </button>
        </div>

        <MiningStatusPanel
          installedPower={effectivePower}
          allocations={poolAllocations}
          networkPowerGh={network.playerPowerGh}
          secondsLeft={secondsLeft}
          onOpenPools={onOpenPools}
        />

        <div className="reward-box multi-reward-box">
          <div className="fixed-block-heading">
            <span>BLOCO FIXO DA REDE · 10 MIN</span>
            <b>
              {network.bonusActive
                ? `EVENTO ${network.bonusBps / 100}%`
                : "EMISSÃO-BASE"}
            </b>
          </div>
          <div className="reward-split-list">
            {pools.map((pool) => {
              const allocation = poolAllocations[pool.id] ?? 0;
              const allocatedPower = Math.floor(
                (effectivePower * allocation) / 100,
              );
              const blockRewardAtomic = network.blockRewardAtomic[pool.id] ?? 0;
              const activeNetworkPowerGh = network.playerPowerGh[pool.id] ?? 0;
              const safeBlockCount = 1;
              const personalEstimateAtomic = calculateEstimatedReward(
                pool,
                allocatedPower,
                activeNetworkPowerGh,
                BigInt(blockRewardAtomic),
              );
              // For UI fractional display:
              const rawEstimateStr = activeNetworkPowerGh > 0 
                ? ((safeBlockCount * Number(blockRewardAtomic) * allocatedPower) / activeNetworkPowerGh) / (10 ** pool.decimals)
                : 0;
              const formattedFractionalEstimate = rawEstimateStr.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
              return (
                <div key={pool.id}>
                  <img src={pool.asset} alt="" />
                  <strong>
                    {formatAtomic(
                      BigInt(blockRewardAtomic),
                      pool.decimals,
                    )}{" "}
                    {pool.symbol}
                  </strong>
                  <small>
                    Sua parte: {personalEstimateAtomic > 0n ? formatAtomic(personalEstimateAtomic, pool.decimals) : formattedFractionalEstimate}{" "}
                    {pool.symbol}
                  </small>
                </div>
              );
            })}
          </div>
          <small>
            Mais poder altera sua porcentagem na disputa, nunca o valor total
            emitido pelo bloco. Se você for o único minerador ativo, recebe 100%
            do bloco fixo daquela rede.
          </small>
        </div>

          </aside>
        </>
      )}
    </div>
  );
}

function EnergyCard({
  energySeconds,
  batteryCount,
  onOpenGames,
  onOpenStore,
  onUseBattery,
}: {
  energySeconds: number;
  batteryCount: number;
  onOpenGames: () => void;
  onOpenStore: () => void;
  onUseBattery: () => void;
}) {
  const chargedCells = Math.ceil(energySeconds / (BATTERY_HOURS * 3600));

  return (
    <div className="energy-card">
      <div className="energy-card-heading">
        <div className="battery-art">
          <img src={assetsManifest.battery.path} alt={assetsManifest.battery.alt} />
        </div>
        <div>
          <small>ENERGIA DOS MINERADORES</small>
          <strong>{formatEnergy(energySeconds)}</strong>
          <span>{batteryCount} baterias no inventário</span>
        </div>
      </div>
      <div
        className="energy-cells"
        aria-label={`${chargedCells} de 8 células carregadas`}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <i className={index < chargedCells ? "charged" : ""} key={index}>
            12h
          </i>
        ))}
      </div>
      <div className="daily-energy">
        <span>
          <small>ENERGIA PELO ARCADE</small>
          <strong>Complete os 3 minigames</strong>
        </span>
        <button type="button" onClick={onOpenGames}>
          JOGAR
        </button>
      </div>
      <div className="energy-actions">
        <button
          type="button"
          onClick={onUseBattery}
          disabled={
            batteryCount === 0 ||
            energySeconds >= MAX_ENERGY_HOURS * 3600
          }
        >
          USAR BATERIA · +{BATTERY_HOURS}H
        </button>
        <button type="button" onClick={onOpenStore}>
          IR PARA LOJA
        </button>
      </div>
      <p>O Tour do Arcade concede 1 bateria após validar os três jogos.</p>
    </div>
  );
}

function MiningStatusPanel({
  installedPower,
  allocations,
  networkPowerGh,
  secondsLeft,
  onOpenPools,
}: {
  installedPower: number;
  allocations: PoolAllocations;
  networkPowerGh: Record<PoolId, number>;
  secondsLeft: number;
  onOpenPools: () => void;
}) {
  const activePools = pools.filter((pool) => allocations[pool.id] > 0);

  return (
    <section className="mining-status-panel" aria-label="Status da mineração">
      <div className="mining-status-heading">
        <span>REDE GLOBAL DO SERVIDOR</span>
        <i className="online-dot" />
      </div>

      <div className="mining-pool-status-list">
        {activePools.map((pool) => {
          const allocation = allocations[pool.id];
          const allocatedPower = Math.floor(
            (installedPower * allocation) / 100,
          );
          return (
            <article
              key={pool.id}
              style={{ "--pool-color": pool.color } as React.CSSProperties}
            >
              <img src={pool.asset} alt="" />
              <span>
                <small>{pool.symbol} · {allocation}% DO SEU PODER</small>
                <strong>{formatPower(networkPowerGh[pool.id])}</strong>
                <em>Poder total da rede {pool.symbol}</em>
              </span>
              <b>{formatPower(allocatedPower)}</b>
            </article>
          );
        })}
      </div>

      <div className="mining-block-status">
        <span>
          <small>PRÓXIMO BLOCO</small>
          <strong>{formatTimer(secondsLeft)}</strong>
        </span>
        <div>
          <i
            style={{
              width: `${
                ((BLOCK_INTERVAL_SECONDS - secondsLeft) /
                  BLOCK_INTERVAL_SECONDS) *
                100
              }%`,
            }}
          />
        </div>
        <button type="button" onClick={onOpenPools}>
          GERENCIAR POOLS
        </button>
      </div>
    </section>
  );
}

export function GamesView() {
  const games = [
    {
      id: "packet-catch",
      name: "Packet Catch",
      glyph: "↓",
      description:
        "Capture pacotes válidos e evite dados corrompidos em partidas rápidas.",
      reward: "100–220 GH/s temporários",
      secondary: "chance baixa de bateria",
      duration: "60–90 segundos",
      color: "#36d8f2",
    },
    {
      id: "hash-match",
      name: "Hash Match",
      glyph: "◇",
      description:
        "Encontre pares de chips com memória, velocidade e poucos erros.",
      reward: "140–280 GH/s temporários",
      secondary: "fragmentos CMA limitados",
      duration: "2–3 minutos",
      color: "#a9ff3f",
    },
    {
      id: "circuit-rush",
      name: "Circuit Rush",
      glyph: "»",
      description:
        "Guie um drone por circuitos e desvie de obstáculos eletrônicos.",
      reward: "180–350 GH/s temporários",
      secondary: "chance baixa de bateria",
      duration: "90–120 segundos",
      color: "#ffb33b",
    },
  ];

  return (
    <section className="games-view">
      <div className="games-hero">
        <div>
          <span className="eyebrow">FASE DE PROJETO · RECOMPENSAS DESATIVADAS</span>
          <h2>Arcade de mineração</h2>
          <p>
            Três minigames originais foram definidos para conceder poder
            temporário. CMA e baterias terão limites diários e validação no
            servidor antes de serem ativados.
          </p>
        </div>
        <div className="games-balance-seal">
          <strong>0</strong>
          <span>RECOMPENSAS EMITIDAS</span>
          <small>protótipo seguro</small>
        </div>
      </div>

      <div className="games-grid">
        {games.map((game, index) => (
          <article
            className="game-prototype-card"
            style={{ "--game-color": game.color } as React.CSSProperties}
            key={game.id}
          >
            <div className="game-prototype-art">
              <span>{game.glyph}</span>
              <div>
                {Array.from({ length: 12 }, (_, cell) => (
                  <i key={cell} className={(cell + index) % 4 === 0 ? "lit" : ""} />
                ))}
              </div>
              <b>EM PROJETO</b>
            </div>
            <div className="game-prototype-info">
              <span>MINIGAME {String(index + 1).padStart(2, "0")}</span>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
              <dl>
                <div>
                  <dt>Duração</dt>
                  <dd>{game.duration}</dd>
                </div>
                <div>
                  <dt>Poder previsto</dt>
                  <dd>{game.reward}</dd>
                </div>
                <div>
                  <dt>Extra previsto</dt>
                  <dd>{game.secondary}</dd>
                </div>
              </dl>
              <button type="button" disabled>
                PROTÓTIPO BLOQUEADO
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="games-safety-roadmap">
        <div>
          <span>01</span>
          <strong>Jogabilidade</strong>
          <small>Construir e testar diversão sem recompensas.</small>
        </div>
        <div>
          <span>02</span>
          <strong>Servidor e antifraude</strong>
          <small>Sessões assinadas, limites e pontuação validada.</small>
        </div>
        <div>
          <span>03</span>
          <strong>Economia controlada</strong>
          <small>Ativar poder, bateria e CMA com teto diário.</small>
        </div>
      </div>
    </section>
  );
}

function PoolsView({
  allocations,
  installedPower,
  network,
  onApplyAllocations,
}: {
  allocations: PoolAllocations;
  installedPower: number;
  network: NetworkPowerSnapshot;
  onApplyAllocations: (allocations: PoolAllocations) => void;
}) {
  const [draft, setDraft] = useState<PoolAllocations>(allocations);
  const totalAllocation = pools.reduce(
    (total, pool) => total + draft[pool.id],
    0,
  );

  function setAllocation(poolId: PoolId, value: number) {
    setDraft((current) => ({
      ...current,
      [poolId]: Math.min(100, Math.max(0, Math.round(value))),
    }));
  }

  return (
    <section className="pools-view">
      <div className="section-intro">
        <div>
          <span className="eyebrow">MULTI-MINERAÇÃO · BLOCOS DE 10 MINUTOS</span>
          <h2>Distribua seu poder</h2>
          <p>
            Divida 100% do seu poder entre CMA, Bitcoin, Dogecoin e Litecoin.
          </p>
        </div>
        <div
          className={`allocation-total ${
            totalAllocation === 100 ? "valid" : "invalid"
          }`}
        >
          <small>TOTAL DISTRIBUÍDO</small>
          <strong>{totalAllocation}%</strong>
          <span>
            {totalAllocation === 100
              ? "PRONTO PARA APLICAR"
              : totalAllocation < 100
                ? `FALTAM ${100 - totalAllocation}%`
                : `EXCEDEU ${totalAllocation - 100}%`}
          </span>
        </div>
      </div>

      <div className="allocation-presets">
        <span>DISTRIBUIÇÕES RÁPIDAS</span>
        <button
          type="button"
          onClick={() => setDraft({ cma: 100, btc: 0, doge: 0, ltc: 0 })}
        >
          100% CMA
        </button>
        <button
          type="button"
          onClick={() =>
            setDraft({ cma: 50, btc: 20, doge: 15, ltc: 15 })
          }
        >
          50 / 20 / 15 / 15
        </button>
        <button
          type="button"
          onClick={() => setDraft({ cma: 25, btc: 25, doge: 25, ltc: 25 })}
        >
          DIVISÃO IGUAL
        </button>
      </div>

      <div className="pool-grid">
        {pools.map((pool) => {
          const allocation = draft[pool.id] ?? 0;
          const allocatedPower = Math.floor(
            (installedPower * allocation) / 100,
          );
          const blockRewardAtomic = network.blockRewardAtomic[pool.id] ?? 0;
          const estimate = calculateEstimatedReward(
            pool,
            allocatedPower,
            network.playerPowerGh[pool.id],
            BigInt(blockRewardAtomic),
          );
          const dailyEstimate = calculateDailyEstimatedReward(
            pool,
            allocatedPower,
            network.playerPowerGh[pool.id],
            BigInt(network.blockRewardAtomic[pool.id]),
          );

          return (
            <article
              className={`pool-card ${allocation > 0 ? "selected" : ""}`}
              key={pool.id}
              style={{ "--pool-color": pool.color } as React.CSSProperties}
            >
              <div className="pool-card-top">
                <div className="pool-logo">
                  <img src={pool.asset} alt="" />
                </div>
                <span className="pool-state">
                  {allocation > 0 ? `${allocation}% ALOCADO` : "SEM PODER"}
                </span>
              </div>
              <span className="pool-code">{pool.symbol} / POOL</span>
              <h3>{pool.name}</h3>
              <dl>
                <div>
                  <dt>Poder alocado</dt>
                  <dd>{formatPower(allocatedPower)}</dd>
                </div>
                <div>
                  <dt>Poder global dos jogadores</dt>
                  <dd>{formatPower(network.playerPowerGh[pool.id])}</dd>
                </div>
                <div>
                  <dt>Sua parte por bloco</dt>
                  <dd>
                    {formatAtomic(estimate, pool.decimals)} {pool.symbol}
                  </dd>
                </div>
              </dl>
              <div className="pool-compact-estimate">
                <span>Bloco de 10 min</span>
                <strong>{formatAtomic(BigInt(network.blockRewardAtomic[pool.id]), pool.decimals)} {pool.symbol}</strong>
                <small>Estimativa em 24h: {formatAtomic(dailyEstimate, pool.decimals)} {pool.symbol}</small>
              </div>
              <div className="pool-allocation-control">
                <label htmlFor={`allocation-${pool.id}`}>
                  <span>ALOCAÇÃO</span>
                  <strong>{allocation}%</strong>
                </label>
                <input
                  id={`allocation-${pool.id}`}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={allocation}
                  onChange={(event) =>
                    setAllocation(pool.id, Number(event.target.value))
                  }
                  style={
                    {
                      "--allocation": `${allocation}%`,
                      "--pool-color": pool.color,
                    } as React.CSSProperties
                  }
                />
                <div>
                  <button
                    type="button"
                    onClick={() => setAllocation(pool.id, allocation - 1)}
                    disabled={allocation === 0}
                    aria-label={`Diminuir alocação de ${pool.symbol}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={allocation}
                    onChange={(event) =>
                      setAllocation(pool.id, Number(event.target.value))
                    }
                    aria-label={`Percentual alocado em ${pool.symbol}`}
                  />
                  <span>%</span>
                  <button
                    type="button"
                    onClick={() => setAllocation(pool.id, allocation + 1)}
                    disabled={allocation === 100}
                    aria-label={`Aumentar alocação de ${pool.symbol}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="allocation-apply-bar">
        <div>
          <span>PODER TOTAL</span>
          <strong>{formatPower(installedPower)}</strong>
          <small>Distribuído entre as quatro pools</small>
        </div>
        <button
          type="button"
          disabled={totalAllocation !== 100}
          onClick={() => onApplyAllocations(draft)}
        >
          APLICAR DISTRIBUIÇÃO
        </button>
      </div>

      <details className="pool-rule-note">
        <summary>Como a recompensa é calculada?</summary>
        <p>O servidor fecha um bloco fixo por rede a cada 10 minutos e divide esse bloco proporcionalmente ao poder energizado. A estimativa pode variar conforme outros jogadores mudam a alocação.</p>
      </details>
    </section>
  );
}

function InventoryView({
  minerInventory,
  installedMiners,
  rackInventoryCount,
  batteryCount,
  onOpenRack,
  onOpenStore,
}: {
  minerInventory: MinerUnit[];
  installedMiners: InstalledMiner[];
  rackInventoryCount: number;
  batteryCount: number;
  onOpenRack: () => void;
  onOpenStore: (category: ShopCategory) => void;
}) {
  return (
    <section className="inventory-view">
      <div className="section-intro">
        <div>
          <span className="eyebrow">INVENTÁRIO · EQUIPAMENTOS ADQUIRIDOS</span>
          <h2>Seus equipamentos</h2>
          <p>
            Mineradores de uma fan ocupam 1 slot. Modelos de duas fans usam uma
            prateleira inteira e entregam mais poder por espaço.
          </p>
        </div>
        <div className="inventory-actions">
          <button className="primary-action" type="button" onClick={onOpenRack}>
            GERENCIAR RACK
          </button>
          <button type="button" onClick={() => onOpenStore("miners")}>
            ABRIR LOJA
          </button>
        </div>
      </div>

      <div className="inventory-summary">
        <article>
          <img src={assetsManifest.rackBasic.path} alt="" />
          <span>
            <small>RACKS DISPONÍVEIS</small>
            <strong>{rackInventoryCount}</strong>
          </span>
          <button type="button" onClick={() => onOpenStore("racks")}>
            COMPRAR
          </button>
        </article>
        <article>
          <img src={assetsManifest.battery.path} alt="" />
          <span>
            <small>BATERIAS DE 12H</small>
            <strong>{batteryCount}</strong>
          </span>
          <button type="button" onClick={() => onOpenStore("energy")}>
            COMPRAR
          </button>
        </article>
      </div>

      <div className="inventory-grid">
        {miners.map((miner) => {
          const availableCount = minerInventory.filter(
            (unit) => unit.minerId === miner.id,
          ).length;
          const installedCount = installedMiners.filter(
            (unit) => unit.minerId === miner.id,
          ).length;
          const ownedCount = availableCount + installedCount;

          if (ownedCount === 0) return null;

          return (
            <article
              className={`inventory-card ${miner.rarity} ${
                ownedCount === 0 ? "not-owned" : ""
              }`}
              key={miner.id}
            >
              <div className="inventory-art">
                <span>{rarityLabels[miner.rarity]}</span>
                <img src={miner.asset} alt={miner.alt} />
                <b className="owned-badge">VOCÊ TEM · {ownedCount}</b>
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
                <em className={installedCount > 0 ? "installed" : ""}>
                  {availableCount} DISPONÍVEL · {installedCount} INSTALADO
                </em>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QuantityPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="quantity-picker" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Diminuir quantidade"
      >
        −
      </button>
      <strong>{value}</strong>
      <button
        type="button"
        onClick={() => onChange(Math.min(10, value + 1))}
        disabled={value >= 10}
        aria-label="Aumentar quantidade"
      >
        +
      </button>
    </div>
  );
}

function ShopView({
  activeCategory,
  cmaBalance,
  minerInventory,
  installedMiners,
  rackInventoryCount,
  batteryCount,
  crateOpenCount,
  cratePityStreaks,
  onSetCategory,
  onBuyMiners,
  onBuyRacks,
  onBuyBatteries,
  onOpenSupplyCrate,
  onGoToRoom,
}: {
  activeCategory: ShopCategory;
  cmaBalance: number;
  minerInventory: MinerUnit[];
  installedMiners: InstalledMiner[];
  rackInventoryCount: number;
  batteryCount: number;
  crateOpenCount: number;
  cratePityStreaks: Record<SupplyCrateId, number>;
  onSetCategory: (category: ShopCategory) => void;
  onBuyMiners: (minerId: string, quantity: number) => void;
  onBuyRacks: (quantity: number) => void;
  onBuyBatteries: (quantity: number) => void;
  onOpenSupplyCrate: (
    crateId: SupplyCrateId,
  ) => Promise<GameApiResponse | null>;
  onGoToRoom: () => void;
}) {
  const [minerQuantities, setMinerQuantities] = useState<
    Record<string, number>
  >({});
  const [rackQuantity, setRackQuantity] = useState(1);
  const [batteryQuantity, setBatteryQuantity] = useState(1);
  const [crateOpening, setCrateOpening] = useState<{
    crateId: SupplyCrateId;
    phase: "opening" | "revealed";
    result?: SupplyCrateOpening;
  } | null>(null);

  async function openCrate(crateId: SupplyCrateId) {
    if (crateOpening?.phase === "opening") return;
    setCrateOpening({ crateId, phase: "opening" });
    const response = await onOpenSupplyCrate(crateId);
    await new Promise((resolve) => window.setTimeout(resolve, 1_150));
    const result = response?.actionResult?.supplyCrate;
    if (!result) {
      setCrateOpening(null);
      return;
    }
    setCrateOpening({
      crateId,
      phase: "revealed",
      result,
    });
  }

  return (
    <section className="shop-view">
      <div className="shop-hero">
        <div>
          <span className="eyebrow">LOJA OFICIAL · PAGAMENTO EM CMA</span>
          <h2>Monte sua operação</h2>
          <p>
            Compre equipamentos aqui. As 12 posições de cada sala são gratuitas:
            você paga apenas pelo rack que será instalado. Fans definem espaço,
            enquanto potência, raridade e preço são atributos independentes.
          </p>
        </div>
        <div className="shop-wallet">
          <img src={assetsManifest.cmaCoin.path} alt="" />
          <span>
            <small>SALDO DISPONÍVEL</small>
            <strong>{formatCma(cmaBalance)} CMA</strong>
          </span>
        </div>
      </div>

      <nav className="shop-tabs" aria-label="Categorias da loja">
        <button
          type="button"
          className={activeCategory === "miners" ? "active" : ""}
          onClick={() => onSetCategory("miners")}
        >
          MINERADORES
        </button>
        <button
          type="button"
          className={activeCategory === "racks" ? "active" : ""}
          onClick={() => onSetCategory("racks")}
        >
          RACKS · {rackInventoryCount}
        </button>
        <button
          type="button"
          className={activeCategory === "energy" ? "active" : ""}
          onClick={() => onSetCategory("energy")}
        >
          ENERGIA · {batteryCount}
        </button>
        <button
          type="button"
          className={activeCategory === "crates" ? "active" : ""}
          onClick={() => onSetCategory("crates")}
        >
          CAIXAS · {crateOpenCount}
        </button>
      </nav>

      {activeCategory === "crates" && (
        <div className="supply-crates-section">
          <div className="supply-crates-heading">
            <div>
              <span className="eyebrow">SUPRIMENTOS ALEATÓRIOS · CHANCES PÚBLICAS</span>
              <h3>Caixas Arcadia</h3>
              <p>
                Cada abertura é resolvida no servidor e registrada no histórico.
                Os prêmios são itens virtuais; não existe saque, revenda ou
                retorno financeiro.
              </p>
            </div>
            <aside>
              <strong>PROTEÇÃO DE AZAR</strong>
              <span>
                A 10ª caixa sem item raro garante raridade rara ou superior.
              </span>
            </aside>
          </div>

          {crateOpening && (
            <section
              className={`crate-opening-stage ${crateOpening.phase}`}
              aria-live="polite"
            >
              <div className={`supply-crate-visual ${crateOpening.crateId}`}>
                <i />
                <b>CMA</b>
                <span />
              </div>
              <div className="crate-opening-copy">
                <span>
                  {crateOpening.phase === "opening"
                    ? "ABERTURA AUTORIZADA PELO SERVIDOR"
                    : "ITEM ENVIADO AO INVENTÁRIO"}
                </span>
                <strong>
                  {crateOpening.phase === "opening"
                    ? "DECODIFICANDO SUPRIMENTOS..."
                    : crateOpening.result?.reward.label}
                </strong>
                {crateOpening.phase === "opening" ? (
                  <div className="crate-opening-progress">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                ) : (
                  <>
                    <p>
                      Raridade{" "}
                      <b>{crateOpening.result?.reward.rarity.toUpperCase()}</b>
                      {crateOpening.result?.pityTriggered
                        ? " · proteção de azar ativada"
                        : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCrateOpening(null)}
                    >
                      CONTINUAR NA LOJA
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          <div className="supply-crate-grid">
            {supplyCrates.map((crate) => {
              const pityStreak = cratePityStreaks[crate.id] ?? 0;
              return (
                <article className={`supply-crate-card ${crate.tier}`} key={crate.id}>
                  <div className="supply-crate-card-art">
                    <div className={`supply-crate-visual ${crate.id}`}>
                      <i />
                      <b>CMA</b>
                      <span />
                    </div>
                    <small>{crate.shortName}</small>
                  </div>
                  <div className="supply-crate-card-info">
                    <span>CAIXA DE SUPRIMENTOS</span>
                    <h4>{crate.name}</h4>
                    <p>{crate.description}</p>
                    <div className="crate-odds-table">
                      <div>
                        <strong>CONTEÚDO POSSÍVEL</strong>
                        <b>CHANCE</b>
                      </div>
                      {crate.rewards.map((reward) => (
                        <div className={reward.rarity} key={reward.id}>
                          <span>{reward.label}</span>
                          <b>{formatCrateChance(reward.chanceBasisPoints)}</b>
                        </div>
                      ))}
                    </div>
                    <div className="crate-pity-meter">
                      <span>
                        PROTEÇÃO RARA · {pityStreak}/{SUPPLY_CRATE_PITY_LIMIT - 1}
                      </span>
                      <i>
                        <em
                          style={{
                            width: `${Math.min(
                              100,
                              (pityStreak / (SUPPLY_CRATE_PITY_LIMIT - 1)) * 100,
                            )}%`,
                          }}
                        />
                      </i>
                    </div>
                    <div className="crate-price">
                      <span>ABERTURA</span>
                      <strong>{formatCma(crate.priceCma)} CMA</strong>
                    </div>
                    <button
                      type="button"
                      disabled={
                        crate.priceCma > cmaBalance ||
                        crateOpening?.phase === "opening"
                      }
                      onClick={() => openCrate(crate.id)}
                    >
                      {crate.priceCma > cmaBalance
                        ? "SALDO INSUFICIENTE"
                        : "COMPRAR E ABRIR"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {activeCategory === "miners" && (
        <div className="shop-miner-grid">
          {storeMiners.map((miner) => {
            const quantity = minerQuantities[miner.id] ?? 1;
            const owned =
              minerInventory.filter((unit) => unit.minerId === miner.id)
                .length +
              installedMiners.filter((unit) => unit.minerId === miner.id)
                .length;
            const total = miner.priceCma * quantity;

            return (
              <article
                className={`shop-product-card ${miner.rarity}`}
                key={miner.id}
              >
                <div className="shop-product-art">
                  <span>{rarityLabels[miner.rarity]}</span>
                  <img src={miner.asset} alt={miner.alt} />
                  <b>{formatCma(miner.priceCma)} CMA</b>
                </div>
                <div className="shop-product-info">
                  <small>
                    {miner.slotSize === 1 ? "PEQUENO" : "MÉDIO"} ·{" "}
                    {miner.fanCount} {miner.fanCount === 1 ? "FAN" : "FANS"}
                  </small>
                  <h3>{miner.name}</h3>
                  <dl>
                    <div>
                      <dt>Poder</dt>
                      <dd>{formatPower(miner.powerGh)}</dd>
                    </div>
                    <div>
                      <dt>Espaço</dt>
                      <dd>{miner.slotSize} slot{miner.slotSize === 1 ? "" : "s"}</dd>
                    </div>
                    <div>
                      <dt>Você tem</dt>
                      <dd>{owned}</dd>
                    </div>
                  </dl>
                  <QuantityPicker
                    value={quantity}
                    onChange={(value) =>
                      setMinerQuantities((state) => ({
                        ...state,
                        [miner.id]: value,
                      }))
                    }
                    label={`Quantidade de ${miner.name}`}
                  />
                  <div className="shop-total">
                    <span>TOTAL</span>
                    <strong>{formatCma(total)} CMA</strong>
                  </div>
                  <button
                    type="button"
                    disabled={total > cmaBalance}
                    onClick={() => onBuyMiners(miner.id, quantity)}
                  >
                    {total > cmaBalance ? "SALDO INSUFICIENTE" : "COMPRAR"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeCategory === "racks" && (
        <div className="shop-feature-grid">
          <article className="feature-product-card">
            <div className="feature-product-art rack">
              <img src={assetsManifest.rackBasic.path} alt={assetsManifest.rackBasic.alt} />
              <span>RACK BÁSICO 8</span>
            </div>
            <div className="feature-product-info">
              <span className="eyebrow">ESTRUTURA · 4 PRATELEIRAS</span>
              <h3>Rack básico de 8 slots</h3>
              <p>
                Compatível com mineradores de uma e duas fans. Depois da compra,
                instale gratuitamente em qualquer posição vazia da sala.
              </p>
              <ul>
                <li>8 slots em 4 prateleiras</li>
                <li>Posições da sala sem custo</li>
                <li>{rackInventoryCount} disponíveis no inventário</li>
              </ul>
              <QuantityPicker
                value={rackQuantity}
                onChange={setRackQuantity}
                label="Quantidade de racks"
              />
              <div className="shop-total">
                <span>TOTAL</span>
                <strong>
                  {formatCma(RACK_PRICE_CMA * rackQuantity)} CMA
                </strong>
              </div>
              <button
                type="button"
                disabled={RACK_PRICE_CMA * rackQuantity > cmaBalance}
                onClick={() => onBuyRacks(rackQuantity)}
              >
                COMPRAR RACK
              </button>
              {rackInventoryCount > 0 && (
                <button
                  className="secondary-shop-action"
                  type="button"
                  onClick={onGoToRoom}
                >
                  INSTALAR NA SALA
                </button>
              )}
            </div>
          </article>
        </div>
      )}

      {activeCategory === "energy" && (
        <div className="shop-feature-grid energy">
          <article className="feature-product-card">
            <div className="feature-product-art energy">
              <img src={assetsManifest.battery.path} alt={assetsManifest.battery.alt} />
              <span>BATERIA ARCADIA · +12H</span>
            </div>
            <div className="feature-product-info">
              <span className="eyebrow">ENERGIA · RESERVA PORTÁTIL</span>
              <h3>Bateria de mineração</h3>
              <p>
                Cada bateria adiciona 12 horas, até o limite de 96 horas.
                O Tour diário do Arcade concede uma bateria após os três jogos.
              </p>
              <ul>
                <li>+12 horas por bateria</li>
                <li>1 bateria diária ao concluir o Tour do Arcade</li>
                <li>{batteryCount} baterias no inventário</li>
              </ul>
              <QuantityPicker
                value={batteryQuantity}
                onChange={setBatteryQuantity}
                label="Quantidade de baterias"
              />
              <div className="shop-total">
                <span>TOTAL</span>
                <strong>
                  {formatCma(BATTERY_PRICE_CMA * batteryQuantity)} CMA
                </strong>
              </div>
              <button
                type="button"
                disabled={BATTERY_PRICE_CMA * batteryQuantity > cmaBalance}
                onClick={() => onBuyBatteries(batteryQuantity)}
              >
                COMPRAR BATERIA
              </button>
            </div>
          </article>

          <aside className="energy-shop-note">
            <span>PRÓXIMA ETAPA</span>
            <h3>Recompensas dos minigames</h3>
            <p>
              O desenho já reserva baterias e pequenas quantidades de CMA como
              recompensas, mas a emissão ainda não foi ativada para não
              desbalancear a economia.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}

function RackManager({
  rackLabel,
  roomName,
  installed,
  minerInventory,
  onInstall,
  onRemove,
  onRemoveAll,
  onClose,
}: {
  rackLabel: string;
  roomName: string;
  installed: InstalledMiner[];
  minerInventory: MinerUnit[];
  onInstall: (instanceId: string, slotIndex?: number) => void;
  onRemove: (instanceId: string) => void;
  onRemoveAll: () => void;
  onClose: () => void;
}) {
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const usedSlots = getUsedSlotCount(installed);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
      <section
        className="rack-modal rack-inline-panel"
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
                return (
                  <button
                    type="button"
                    className={`preview-miner corrected size-${miner.slotSize}`}
                    key={placement.instanceId}
                    style={rackMinerPosition(placement.slotIndex)}
                    onClick={() => onRemove(placement.instanceId)}
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
                      onClick={() => onRemove(placement.instanceId)}
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
                  {minerInventory.length} disponíveis
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
                const availableUnits = minerInventory.filter(
                  (unit) => unit.minerId === miner.id,
                );
                if (availableUnits.length === 0) return null;
                const nextUnit = availableUnits[0];
                const possibleSlot =
                  targetSlot === null
                    ? findNextAvailableSlot(installed, miner)
                    : canInstallAt(installed, miner, targetSlot)
                      ? targetSlot
                      : null;

                return (
                  <article className="rack-miner-card" key={miner.id}>
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
                        {availableUnits.length} disponível
                        {availableUnits.length === 1 ? "" : "is"}
                      </p>
                    </div>
                    <div className="slot-cost">
                      <small>OCUPA</small>
                      <strong>
                        {miner.slotSize}{" "}
                        {miner.slotSize === 1 ? "SLOT" : "SLOTS"}
                      </strong>
                    </div>
                    <button
                      type="button"
                      disabled={possibleSlot === null}
                      onClick={() => {
                        if (possibleSlot === null) return;
                        onInstall(nextUnit.instanceId, possibleSlot);
                        setTargetSlot(null);
                      }}
                    >
                      {possibleSlot === null ? "NÃO CABE" : "INSTALAR"}
                    </button>
                  </article>
                );
              })}
              {minerInventory.length === 0 && (
                <div className="empty-rack-inventory">
                  <strong>NENHUM MINERADOR DISPONÍVEL</strong>
                  <span>Compre novos equipamentos na loja.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer>
          <p>
            <span>✓</span>
            Encaixes salvos automaticamente na sua conta
          </p>
          <button type="button" onClick={onClose}>
            CONCLUIR
          </button>
        </footer>
      </section>
  );
}

function RoomsModal({
  activeRoomId,
  ownedRoomIds,
  cmaBalance,
  purchasePending,
  onChoose,
  onBuy,
  onClose,
}: {
  activeRoomId: RoomId;
  ownedRoomIds: RoomId[];
  cmaBalance: number;
  purchasePending: boolean;
  onChoose: (roomId: RoomId) => void;
  onBuy: (room: RoomDefinition) => Promise<void>;
  onClose: () => void;
}) {
  const [confirmingRoomId, setConfirmingRoomId] = useState<RoomId | null>(null);
  const confirmingRoom =
    roomDefinitions.find((room) => room.id === confirmingRoomId) ?? null;
  const nextRoom =
    roomDefinitions.find((room) => !ownedRoomIds.includes(room.id)) ?? null;

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
              Seis setores permanentes. Cada sala possui 12 posições gratuitas
              e mantém seu próprio layout.
            </p>
          </div>
          <div className="room-wallet">
            <small>
              {ownedRoomIds.length}/{roomDefinitions.length} SALAS · SEU SALDO
            </small>
            <strong>{formatCma(cmaBalance)} CMA</strong>
            <span>
              {nextRoom
                ? `Próxima: ${nextRoom.name} · ${formatCma(nextRoom.priceCma)} CMA`
                : "Complexo completo"}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="room-store-grid">
          {roomDefinitions.map((room) => {
            const owned = ownedRoomIds.includes(room.id);
            const active = activeRoomId === room.id;
            const previousRoom = roomDefinitions[room.sequence - 2];
            const previousOwned =
              room.sequence === 1 ||
              (previousRoom && ownedRoomIds.includes(previousRoom.id));
            const canAfford = cmaBalance >= room.priceCma;
            const lockedBySequence = !owned && !previousOwned;
            const unavailable = !owned && (!previousOwned || !canAfford);
            return (
              <article
                className={`room-store-card ${active ? "active" : ""} ${
                  lockedBySequence ? "sequence-locked" : ""
                }`}
                key={room.id}
              >
                <div className="room-preview-image">
                  <img src={room.asset} alt={room.alt} />
                  <span>
                    {active
                      ? "SALA ATUAL"
                      : owned
                        ? "DESBLOQUEADA"
                        : lockedBySequence
                          ? "REQUER SALA ANTERIOR"
                          : "PRÓXIMA EXPANSÃO"}
                  </span>
                </div>
                <div className="room-store-info">
                  <span>{room.label}</span>
                  <h3>{room.name}</h3>
                  <p>
                    12 posições de rack · layout independente · compra
                    permanente
                  </p>
                  {!owned && (
                    <strong className="room-price">
                      {formatCma(room.priceCma)} CMA
                    </strong>
                  )}
                  <button
                    type="button"
                    disabled={active || unavailable || purchasePending}
                    onClick={() =>
                      owned
                        ? onChoose(room.id)
                        : setConfirmingRoomId(room.id)
                    }
                  >
                    {active
                      ? "SALA ATUAL"
                      : owned
                        ? "ENTRAR NA SALA"
                        : lockedBySequence
                          ? `DESBLOQUEIE ${previousRoom?.label ?? "A SALA ANTERIOR"}`
                          : !canAfford
                            ? "SALDO INSUFICIENTE"
                            : "REVISAR COMPRA"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {confirmingRoom && (
          <div className="room-purchase-confirmation" role="status">
            <div>
              <span>CONFIRMAR EXPANSÃO</span>
              <strong>{confirmingRoom.name}</strong>
              <small>
                A compra libera 12 posições gratuitas e não pode ser desfeita.
              </small>
            </div>
            <dl>
              <div>
                <dt>PREÇO</dt>
                <dd>{formatCma(confirmingRoom.priceCma)} CMA</dd>
              </div>
              <div>
                <dt>SALDO APÓS COMPRA</dt>
                <dd>
                  {formatCma(cmaBalance - confirmingRoom.priceCma)} CMA
                </dd>
              </div>
            </dl>
            <div>
              <button
                type="button"
                disabled={purchasePending}
                onClick={() => setConfirmingRoomId(null)}
              >
                CANCELAR
              </button>
              <button
                className="confirm"
                type="button"
                disabled={purchasePending}
                onClick={() => void onBuy(confirmingRoom)}
              >
                {purchasePending ? "PROCESSANDO..." : "CONFIRMAR COMPRA"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
