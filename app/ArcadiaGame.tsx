"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { assetsManifest } from "./assets.manifest";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { DailyWelcomeModal } from "./DailyWelcomeModal";
import { PacketCatchView } from "./PacketCatchView";
import { CareerView } from "./CareerView";
import { SeasonPanel } from "./SeasonPanel";
import { ConversionView } from "./ConversionView";
import { FirstDayPanel } from "./FirstDayPanel";
import { OperatorTour } from "./OperatorTour";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { OperatorInbox } from "./OperatorInbox";
import { PCStatusPanel } from "./PCStatusPanel";
import { TasksView } from "./TasksView";
import { LanguageSwitcher, formatTranslation, useArcadiaLanguage } from "./i18n";
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
  supplyCrates,
  type SupplyCrateId,
  type SupplyCrateOpening,
} from "./supply-crate-rules";
import {
  luckCrates,
  type LuckCrateId,
  type LuckCrateOpening,
} from "./luck-crate-rules";
import {
  emptyPartsInventory,
  getPartMergeCount,
  partFamilies,
  partKey,
  partMergeFee,
  partAssetPath,
  partRarities,
  type PartFamily,
  type PartRarity,
} from "./parts-rules";
import {
  SEASON_CURRENCY_SYMBOL,
  seasonStoreBoxes,
  type SeasonStoreBoxId,
  type SeasonStoreOpening,
} from "./season-store-rules";
import {
  getMinerMergeRequirement,
  getMinerLevelCode,
  getMinerPowerAtLevel as getMergedMinerPowerAtLevel,
  getMinerLevelName,
  normalizeMinerLevel,
} from "./miner-merge-rules";
import { getMinerOffers } from "./miner-offers-rules";

export type ViewId =
  | "mine"
  | "pools"
  | "conversion"
  | "inventory"
  | "forge"
  | "shop"
  | "games"
  | "season"
  | "leaderboard"
  | "tasks"
  | "career";
type ShopCategory = "offers" | "miners" | "racks" | "energy" | "crates" | "season";
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
  initialView?: ViewId;
  initialCareerTab?: "overview" | "referrals" | "activity";
};

type GameApiResponse = {
  state: PublicGameState;
  version: number;
  serverTime: number;
  nextBlockAt: number;
  temporaryPowerGh: number;
  temporaryPowerSummary?: {
    totalGh: number;
    activeGrantCount: number;
    nextExpiryAt: number;
  };
  network?: NetworkPowerSnapshot;
  account?: {
    displayName: string;
    email: string;
  };
  message: string;
  error?: string;
  actionResult?: {
    supplyCrate?: SupplyCrateOpening & {
      openCount: number;
    };
    seasonStoreBox?: SeasonStoreOpening & {
      priceAmc: number;
      seasonId: string;
    };
    luckCrate?: LuckCrateOpening & {
      openCount: number;
    };
  };
};

const navigation: Array<{
  id: ViewId;
  label: string;
  shortLabel: string;
  glyph: string;
  icon: string;
}> = [
  { id: "mine", label: "Sala de mineração", shortLabel: "Sala", glyph: "M", icon: "/assets/icons/icone_sala_mineracao.png" },
  { id: "pools", label: "Pools", shortLabel: "Pools", glyph: "P", icon: "/assets/icons/icone_torneios.png" },
  { id: "conversion", label: "Carteira", shortLabel: "Carteira", glyph: "W", icon: "/assets/icons/icone_carteira.png" },
  { id: "inventory", label: "Inventário", shortLabel: "Itens", glyph: "I", icon: "/assets/icons/icone_inventario.png" },
  { id: "forge", label: "Oficina Arcadia", shortLabel: "Oficina", glyph: "F", icon: "/assets/icons/icone_forja_crafting.png" },
  { id: "shop", label: "Loja", shortLabel: "Loja", glyph: "$", icon: "/assets/icons/icone_loja.png" },
  { id: "games", label: "Minigames", shortLabel: "Jogos", glyph: "G", icon: "/assets/icons/icone_minigames.png" },
  { id: "season", label: "Temporada", shortLabel: "Season", glyph: "S", icon: "/assets/icons/icone_passe_temporada.png" },
  { id: "leaderboard", label: "Ranking Global", shortLabel: "Ranking", glyph: "R", icon: "/assets/icons/icone_ranking_global.png" },
  { id: "tasks", label: "Tarefas", shortLabel: "Tasks", glyph: "T", icon: "/assets/icons/icone_tarefas.png" },
  {
    id: "career",
    label: "Central do operador",
    shortLabel: "Carreira",
    glyph: "C",
    icon: "/assets/icons/icone_central_operador_perfil.png",
  },
];

const viewPaths: Record<ViewId, string> = {
  mine: "/sala",
  pools: "/pools",
  conversion: "/carteira",
  inventory: "/inventario",
  forge: "/oficina",
  shop: "/loja",
  games: "/minigames",
  season: "/temporada",
  leaderboard: "/ranking",
  tasks: "/tarefas",
  career: "/operador",
};

type BlockNotice = {
  block: number;
  count: number;
};

export function viewFromPath(pathname: string): ViewId | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/" || normalized === "/sala") return "mine";
  const match = (Object.entries(viewPaths) as Array<[ViewId, string]>).find(
    ([, path]) => path === normalized,
  );
  return match?.[0] ?? null;
}

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

// Staging-only layout: the taller rack has a portrait aspect ratio, so the
// room uses four columns and three rows with extra floor space below the art.
// Production keeps the existing 6×2 map and the original rack asset.
const stagingRackPositions: RackPosition[] = [
  // The extended staging room keeps the operator area clear.  Each placement
  // preserves the tall rack's native 2:3 aspect ratio and is arranged in
  // three rows of four on the open floor below the workstation.
  { left: 2, top: 27, width: 21, height: 23, zIndex: 12 },
  { left: 27, top: 27, width: 21, height: 23, zIndex: 12 },
  { left: 52, top: 27, width: 21, height: 23, zIndex: 12 },
  { left: 77, top: 27, width: 21, height: 23, zIndex: 12 },
  { left: 2, top: 51, width: 21, height: 23, zIndex: 14 },
  { left: 27, top: 51, width: 21, height: 23, zIndex: 14 },
  { left: 52, top: 51, width: 21, height: 23, zIndex: 14 },
  { left: 77, top: 51, width: 21, height: 23, zIndex: 14 },
  { left: 2, top: 75, width: 21, height: 23, zIndex: 16 },
  { left: 27, top: 75, width: 21, height: 23, zIndex: 16 },
  { left: 52, top: 75, width: 21, height: 23, zIndex: 16 },
  { left: 77, top: 75, width: 21, height: 23, zIndex: 16 },
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
  bonusStartsAt: 0,
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

function formatPower(powerGh: number): string {
  // Normalise NaN / Infinity → 0 (fix #7 - AI recommendation)
  if (!Number.isFinite(powerGh) || Number.isNaN(powerGh)) powerGh = 0;
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

function rackMinerPosition(
  slotIndex: number,
  slotSize = 1,
  staging = false,
  seasonal = false,
): React.CSSProperties {
  const row = Math.floor(slotIndex / RACK_COLUMNS);
  // Two-slot miners always start at the first column of a row. The server
  // rejects invalid placements, but normalising here keeps old placements
  // from rendering across the whole rack while they are being migrated.
  const column = slotSize > 1 ? 0 : slotIndex % RACK_COLUMNS;

  if (staging) {
    // The staging rack is a portrait 1024×1536 sprite with two columns and
    // four shelves. Keep each art box inside its shelf instead of using the
    // production landscape coordinates (which made one-slot miners stretch
    // over an entire shelf and made two-slot miners spill below the rack).
    // Keep every sprite inside the shelf rails. A one-slot art box is slightly
    // narrower than half a cell and is pulled further inward from the side rails;
    // this prevents transparent padding in the source sprite from making the
    // miner look like it is floating outside the shelf. Two-slot art keeps the
    // complete-row treatment that is already aligned with the rack.
    // These values are staging-only; production still uses its original
    // coordinates and dimensions.
    const width = slotSize > 1 ? 98 : 18;
    const left = slotSize > 1 ? 1 : column === 0 ? 27 : 55;
    const height = slotSize > 1 ? 18 : seasonal ? 12.5 : 11.5;
    const top = (slotSize > 1 ? 8.5 : seasonal ? 12.5 : 13.5) + row * 22.5;
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      "--rack-miner-width": `${width}%`,
      "--rack-miner-height": `${height}%`,
    } as React.CSSProperties;
  }

  return {
    left: `${31 + column * 21.5}%`,
    top: `${row * 23}%`,
  };
}

function minerVisualFamily(miner: { availability?: string; visualFamily?: string }) {
  return miner.visualFamily ?? (miner.availability === "season" ? "space-race" : "standard");
}

function minerVisualStyle(
  miner: { visualScale?: number },
  position?: React.CSSProperties,
): React.CSSProperties {
  return {
    ...position,
    "--miner-art-scale": String(miner.visualScale ?? 1),
  } as React.CSSProperties;
}

export function ArcadiaGame({
  user,
  isOwner,
  signOutPath,
  unreadSupportReplies,
  initialView = "mine",
  initialCareerTab = "overview",
}: ArcadiaGameProps) {
  const { t, locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const [activeView, setActiveView] = useState<ViewId>(initialView);
  const [accountDisplayName, setAccountDisplayName] = useState(user.displayName);
  const [textScale, setTextScale] =
    useState<TextScale>("comfortable");
  const [shopCategory, setShopCategory] =
    // Keep production on the normal catalogue. Staging exposes the flash-offer
    // tab from the shop navigation without leaking it into the public build.
    useState<ShopCategory>("miners");
  const [careerStartTab, setCareerStartTab] = useState<
    "overview" | "referrals" | "activity"
  >(initialCareerTab);
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
  const [lastEnergyClaimAt, setLastEnergyClaimAt] = useState(0);
  const [lastSettledBlock, setLastSettledBlock] = useState(0);
  const [temporaryPowerGh, setTemporaryPowerGh] = useState(0);
  const [network, setNetwork] = useState<NetworkPowerSnapshot>(
    defaultNetworkSnapshot,
  );
  const [clockNow, setClockNow] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState<RoomId>("room-1");
  // Keep the server snapshot false to avoid hydration drift, then resolve the
  // host on the client. Production can therefore never render staging-only
  // workshop routes or assets.
  const stagingVisuals = true;
  const [ownedRoomIds, setOwnedRoomIds] = useState<RoomId[]>(["room-1"]);
  const [rackInventoryCount, setRackInventoryCount] = useState(0);
  const [crateOpenCount, setCrateOpenCount] = useState(0);
  const [luckCrateOpenCount, setLuckCrateOpenCount] = useState(0);
  const [cratePityStreaks, setCratePityStreaks] = useState<
    Record<SupplyCrateId, number>
  >({
    "signal-cache": 0,
    "grid-cache": 0,
    "quantum-cache": 0,
  });
  const [partsInventory, setPartsInventory] = useState(
    () => emptyPartsInventory(),
  );
  const [seasonalWalletAmc, setSeasonalWalletAmc] = useState(0);
  const [minerOfferPurchases, setMinerOfferPurchases] = useState<Record<string, number>>({});
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
  const [blockNotice, setBlockNotice] = useState<BlockNotice | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const lastBetaProfileKey = useRef("");
  const lastSettledBlockRef = useRef(0);

  useEffect(() => {
    const targetPath = viewPaths[activeView];
    if (window.location.pathname !== "/" && window.location.pathname !== targetPath) {
      window.history.replaceState({}, "", targetPath);
    } else if (activeView !== "mine" && window.location.pathname !== targetPath) {
      window.history.replaceState({}, "", targetPath);
    }
    const handlePopState = () => {
      const nextView = viewFromPath(window.location.pathname);
      if (nextView) setActiveView(nextView);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeView]);

  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0];
  const activeRoom =
    roomDefinitions.find((room) => room.id === activeRoomId) ??
    roomDefinitions[0];
  const displayedActiveRoom = useMemo(() => {
    if (!stagingVisuals) return activeRoom;
    const stagingAsset =
      activeRoom.id === "room-1"
        ? assetsManifest.roomOneStaging
        : assetsManifest.roomTwoStaging;
    return {
      ...activeRoom,
      asset: stagingAsset.path,
      alt: `${stagingAsset.alt} · staging`,
    };
  }, [activeRoom, stagingVisuals]);
  const [blockDeadline, setBlockDeadline] = useState(0);
  const playerInitial =
    accountDisplayName.trim().charAt(0).toLocaleUpperCase("pt-BR") || "M";
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
  const minerPower = energySeconds > 0 ? installedPower : 0;
  // Poder temporário de minigame é independente das baterias dos mineradores.
  const effectivePower = minerPower + temporaryPowerGh;
  const currentRoomRacks = useMemo(
    () => racks.filter((rack) => rack.roomId === activeRoomId),
    [activeRoomId, racks],
  );
  const activeRack =
    racks.find((rack) => rack.id === activeRackId) ?? currentRoomRacks[0];
  const activeRackMiners = activeRack ? rackMiners[activeRack.id] ?? [] : [];

  function applyServerSnapshot(snapshot: GameApiResponse) {
    const state = snapshot.state;
    const previousSettledBlock = lastSettledBlockRef.current;
    const isFirstSnapshot = !hydrated;
    lastSettledBlockRef.current = state.lastSettledBlock;
    if (
      !isFirstSnapshot &&
      state.lastSettledBlock > previousSettledBlock
    ) {
      setBlockNotice({
        block: state.lastSettledBlock,
        count: state.lastSettledBlock - previousSettledBlock,
      });
    }
    setSelectedPoolId(state.selectedPoolId);
    setPoolAllocations(state.poolAllocations);
    setDisplayedBalanceSymbol(state.displayedBalanceSymbol);
    setCmaBalance(state.cmaBalance);
    setBtcBalanceAtomic(state.btcBalanceAtomic);
    setDogeBalanceAtomic(state.dogeBalanceAtomic);
    setLtcBalanceAtomic(state.ltcBalanceAtomic);
    setBatteryCount(state.batteryCount);
    setEnergyExpiresAt(state.energyExpiresAt);
    setLastEnergyClaimAt(Math.max(0, state.lastEnergyClaimAt ?? 0));
    setLastSettledBlock(state.lastSettledBlock);
    setTemporaryPowerGh(Math.max(0, snapshot.temporaryPowerGh ?? 0));
    if (snapshot.network) setNetwork(snapshot.network);
    setActiveRoomId(state.activeRoomId);
    setOwnedRoomIds(state.ownedRoomIds);
    setRackInventoryCount(state.rackInventoryCount);
    setCrateOpenCount(Math.max(0, state.crateOpenCount ?? 0));
    setLuckCrateOpenCount(Math.max(0, state.luckCrateOpenCount ?? 0));
    setCratePityStreaks({
      "signal-cache": state.cratePityStreaks?.["signal-cache"] ?? 0,
      "grid-cache": state.cratePityStreaks?.["grid-cache"] ?? 0,
      "quantum-cache": state.cratePityStreaks?.["quantum-cache"] ?? 0,
    });
    setPartsInventory(state.partsInventory);
    setSeasonalWalletAmc(Math.max(0, Number(state.seasonalWallet?.amc ?? 0)));
    setMinerOfferPurchases(state.minerOfferPurchases ?? {});
    setMinerInventory(state.minerInventory);
    setRacks(state.racks);
    setRackMiners(state.rackMiners);
    setActiveRackId((current) =>
      state.racks.some((rack) => rack.id === current)
        ? current
        : (state.racks[0]?.id ?? "rack-01"),
    );
    setServerVersion(snapshot.version);
    if (snapshot.account?.displayName?.trim()) {
      setAccountDisplayName(snapshot.account.displayName.trim());
    }
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

  async function claimFreeBatteryCycle() {
    if (actionPending) return;
    setActionPending(true);
    try {
      const response = await fetch("/api/battery-cycle", { method: "POST" });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setToast(result.error ?? "A bateria ainda não está disponível.");
        return;
      }
      setToast(result.message ?? "Bateria adicionada ao inventário.");
      await refreshServerState();
    } catch {
      setToast("Não foi possível validar o ciclo de bateria.");
    } finally {
      setActionPending(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: number | undefined;

    const bootstrap = async (attempt = 0): Promise<void> => {
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
        if (attempt < 2) {
          retryTimer = window.setTimeout(() => {
            void bootstrap(attempt + 1);
          }, 750 * (attempt + 1));
          return;
        }
        // Nunca apresentar zeros/defaults como se fossem o estado real da conta.
        setHydrated(false);
        setServerStatus("error");
        setToast(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a conta.",
        );
      }
    };

    void bootstrap();

    return () => {
      controller.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
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
    if (!blockNotice) return;
    const timer = window.setTimeout(() => setBlockNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [blockNotice]);

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
    const result = await performGameAction("apply_allocations", {
      allocations: next,
    });
    if (!result) return;

    // Read the authoritative row once more after the write. This catches a
    // stale session/version or an edge write that did not reach D1 before the
    // player refreshes the page.
    const verified = await refreshServerState();
    if (!verified) {
      setToast("A distribuição foi enviada, mas não foi possível confirmá-la. Atualize e tente novamente.");
    }
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

  async function buyMinerOffer(offerId: string, quantity: number) {
    await performGameAction("buy_miner_offer", { offerId, quantity });
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

  async function openLuckCrate(crateId: LuckCrateId) {
    return performGameAction("open_luck_crate", { crateId });
  }

  async function openSeasonBox(boxId: SeasonStoreBoxId) {
    return performGameAction("open_season_box", { boxId });
  }

  async function mergePart(family: PartFamily, rarity: PartRarity) {
    await performGameAction("merge_part", { family, rarity });
  }

  async function mergeMiner(minerAId: string, minerBId: string) {
    await performGameAction("merge_miner", { minerAId, minerBId });
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
      value: formatCma(cmaBalance ?? 0),
      asset: assetsManifest.cmaCoin.path,
      alt: assetsManifest.cmaCoin.alt,
    },
    {
      symbol: "BTC",
      value: ((btcBalanceAtomic ?? 0) / 100_000_000).toFixed(8),
      asset: assetsManifest.bitcoin.path,
      alt: assetsManifest.bitcoin.alt,
    },
    {
      symbol: "DOGE",
      value: ((dogeBalanceAtomic ?? 0) / 100_000_000).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }),
      asset: assetsManifest.dogecoin.path,
      alt: assetsManifest.dogecoin.alt,
    },
    {
      symbol: "LTC",
      value: ((ltcBalanceAtomic ?? 0) / 100_000_000).toLocaleString("pt-BR", {
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
        stagingVisuals ? "staging-shell" : ""
      } ${
        actionPending ? "server-action-pending" : ""
      }`}
      data-server-status={serverStatus}
    >
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => setActiveView("mine")}
          aria-label={english ? "Return to the mining room" : "Voltar para a sala de mineração"}
        >
          <span className="brand-mark">
            <img src={assetsManifest.cmaCoin.path} alt="" />
          </span>
          <span>
            <strong>CRYPTO MINER</strong>
            <em>ARCADIA</em>
          </span>
        </button>

        <div className="topbar-status" aria-label={english ? "System status" : "Status do sistema"}>
          <span className="online-dot" />
          {english ? "SYSTEM ONLINE" : "SISTEMA ONLINE"}
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
            if (target === "career") setCareerStartTab("overview");
            setActiveView(target);
          }}
        />

        <button
          className="reading-mode-toggle"
          type="button"
          aria-label={`${english ? "Text size" : "Tamanho do texto"}: ${
            textScale === "comfortable"
              ? english ? "comfortable" : "confortável"
              : textScale === "large"
                ? english ? "large" : "grande"
                : english ? "extra large" : "extra grande"
          }. ${english ? "Click to change." : "Clique para alterar."}`}
          onClick={cycleTextScale}
        >
          <b>A+</b>
          <span>
            <small>{english ? "READING" : "LEITURA"}</small>
            <strong>
              {textScale === "comfortable"
                ? english ? "COMFORTABLE" : "CONFORTÁVEL"
                : textScale === "large"
                  ? english ? "LARGE" : "GRANDE"
                  : english ? "EXTRA LARGE" : "EXTRA GRANDE"}
            </strong>
          </span>
        </button>

        <div className="balances wallet-control">
          {/* Abrir carteira virtual e escolher a moeda exibida */}
          <button
            className="wallet-trigger"
            type="button"
            title={t("wallet.title")}
            aria-label={`${english ? "Open virtual wallet" : "Abrir carteira virtual"}. ${english ? "Displayed balance" : "Saldo exibido"}: ${displayedBalance.symbol} ${displayedBalance.value}`}
            aria-expanded={walletOpen}
            aria-controls="wallet-menu"
            onClick={() => setWalletOpen((open) => !open)}
          >
            <img src={displayedBalance.asset} alt="" />
            <span>
              <small>{english ? "BALANCE" : "SALDO"} {displayedBalance.symbol}</small>
              <strong>{displayedBalance.value}</strong>
            </span>
            <b aria-hidden="true">⌄</b>
          </button>
          {walletOpen && (
            <div
              className="wallet-menu"
              id="wallet-menu"
              aria-label={t("wallet.title")}
            >
              <div className="wallet-menu-title">
                <span>{t("wallet.title")}</span>
                <small>{t("wallet.withdrawal")}</small>
              </div>
              {balances.map((balance) => (
                <button
                  type="button"
                  className={`wallet-balance-row ${
                    displayedBalanceSymbol === balance.symbol ? "selected" : ""
                  }`}
                  key={balance.symbol}
                  title={`${t("wallet.showing")} ${balance.symbol}`}
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
                      ? t("wallet.showing").toUpperCase()
                      : t("wallet.pin").toUpperCase()}
                  </em>
                </button>
              ))}
              {stagingVisuals && (
                <div
                  className="wallet-balance-row wallet-seasonal-row"
                  role="status"
                  title={locale === "en" ? "Seasonal currency. Not available for withdrawal or conversion." : locale === "es" ? "Moneda de temporada. No disponible para retiro ni conversión." : "Moeda sazonal. Não disponível para saque ou conversão."}
                  aria-label={`${SEASON_CURRENCY_SYMBOL} ${locale === "en" ? "seasonal balance" : locale === "es" ? "saldo de temporada" : "saldo sazonal"}`}
                >
                  <img src={assetsManifest.arcadiaCoin.path} alt={assetsManifest.arcadiaCoin.alt} />
                  <span>{SEASON_CURRENCY_SYMBOL}</span>
                  <strong title={seasonalWalletAmc.toLocaleString(locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR", { maximumFractionDigits: 2 })}>
                    {seasonalWalletAmc.toLocaleString(locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR", { maximumFractionDigits: 2 })}
                  </strong>
                  <em>{locale === "en" ? "SEASONAL" : locale === "es" ? "TEMPORADA" : "TEMPORÁRIA"}</em>
                </div>
              )}
              <button
                type="button"
                className="wallet-conversion-link"
                title={english ? "Open the full wallet and convert to CMA" : "Abrir a carteira completa e a conversão para CMA"}
                onClick={() => {
                  setRackOpen(false);
                  setWalletOpen(false);
                  setActiveView("conversion");
                }}
              >
                <span>⇄</span>
                {/* ABRIR CARTEIRA is the canonical action label for accessibility snapshots. */}
                <strong>{t("wallet.open")}</strong>
                <em>{t("wallet.convert")}</em>
              </button>
            </div>
          )}
        </div>

        <LanguageSwitcher />

        <div className="account-control">
          <a className="account-summary" href="/perfil" title={t("profile.open")}>
            <small>
              {serverStatus === "online" ? t("profile.account") : t("account.connecting")}
            </small>
            <strong>{accountDisplayName}</strong>
          </a>
          <a href={signOutPath}>{t("account.signout")}</a>
          <a className="account-avatar" href="/perfil" title={t("profile.open")}>
            {playerInitial}
          </a>
        </div>
      </header>

      <div className={`server-status-strip ${serverStatus}`}>
        <span className="online-dot" />
        {serverStatus === "online"
          ? formatTranslation(t("status.progress"), { version: serverVersion })
          : serverStatus === "connecting"
            ? t("status.loading")
            : t("status.error")}
        <small>{formatTranslation(t("status.block"), { block: lastSettledBlock })}</small>
      </div>

      {!hydrated && (
        <div className="account-sync-overlay" role="status" aria-live="polite">
          <div className="account-sync-card">
            <span className="online-dot" />
            <strong>
              {serverStatus === "error"
                ? t("sync.error")
                : t("sync.loading")}
            </strong>
            <p>
              {serverStatus === "error"
                ? t("sync.errorDescription")
                : t("sync.loadingDescription")}
            </p>
            {serverStatus === "error" && (
              <button type="button" onClick={() => window.location.reload()}>
                {t("sync.retry")}
              </button>
            )}
          </div>
        </div>
      )}

      <DailyWelcomeModal
        enabled={hydrated && serverStatus === "online"}
        onClose={() => {}}
      />

      <OperatorTour
        accountKey={user.email}
        status={onboarding}
        onNavigate={(target) => {
          setRackOpen(false);
          setWalletOpen(false);
          if (target === "career") setCareerStartTab("overview");
          setActiveView(target);
        }}
        onOpenStarterRack={() => {
          setActiveView("mine");
          openRack("rack-01");
        }}
      />

      <aside className="sidebar" aria-label={t("sidebar.navigation")}>
        <div className="player-card">
          <div className="avatar-frame">{playerInitial}</div>
          <div>
            {/* OPERADOR · CONTA NO SERVIDOR remain canonical labels for accessibility snapshots. */}
            <span>{t("sidebar.operator").toUpperCase()}</span>
            <strong>{accountDisplayName}</strong>
            <small>{t("sidebar.serverAccount").toUpperCase()}</small>
          </div>
        </div>

        <nav>
          {navigation.filter((item) => stagingVisuals || item.id !== "forge").map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              type="button"
              key={item.id}
              data-nav-id={item.id}
              title={t(`nav.${item.id}`, item.label)}
              aria-label={t(`nav.${item.id}`, item.label)}
              onClick={(event) => {
                event.currentTarget.blur();
                setRackOpen(false);
                setWalletOpen(false);
                if (item.id === "career") setCareerStartTab("overview");
                if (item.id === "shop" && stagingVisuals) setShopCategory("offers");
                setActiveView(item.id);
              }}
            >
              <span className="nav-glyph" aria-hidden="true">
                <img src={item.icon} alt="" />
                <span className="nav-glyph-fallback">{item.glyph}</span>
              </span>
              <span>{t(`nav.${item.id}`, item.label)}</span>
            </button>
          ))}
          <a className="support-nav-link" href="/support" title={t("nav.support")} aria-label={t("nav.support")}>
            <span className="nav-glyph" aria-hidden="true">
              <img src="/assets/icons/icone_suporte.png" alt="" />
              <span className="nav-glyph-fallback">?</span>
            </span>
            <span>{t("nav.support")}</span>
            {unreadSupportReplies > 0 ? (
              <small>{Math.min(99, unreadSupportReplies)}</small>
            ) : null}
          </a>
          {isOwner ? (
            <a className="admin-nav-link" href="/admin" title={t("nav.owner")} aria-label={t("nav.owner")}>
              <span className="nav-glyph" aria-hidden="true">
                <img src="/assets/icons/icone_central_operador_perfil.png" alt="" />
                <span className="nav-glyph-fallback">C</span>
              </span>
              <span>{t("nav.owner")}</span>
              <small>OWNER</small>
            </a>
          ) : null}
        </nav>

        <div className="simulation-note">
          <span>{t("sidebar.virtualSimulation").toUpperCase()}</span>
          <p>{t("sidebar.simulationDescription")}</p>
          <div className="sidebar-public-links">
            <a href="/legal">{t("sidebar.terms").toUpperCase()}</a>
          </div>
        </div>
      </aside>

      <section className={`workspace workspace-${activeView}`}>
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">
              {rackOpen && activeRack ? (
                <>
                  {locale !== "pt-BR" ? "RACK CONTROL" : "CONTROLE DE RACK"} <i /> {activeRoom.name.toUpperCase()}
                </>
              ) : activeView === "shop" ? (
                <>{t("workspace.shopEyebrow").toUpperCase()}</>
              ) : activeView === "conversion" ? (
                <>{t("workspace.walletEyebrow").toUpperCase()}</>
              ) : activeView === "games" ? (
                <>{t("workspace.gamesEyebrow").toUpperCase()}</>
              ) : activeView === "season" ? (
                <>{t("workspace.seasonEyebrow").toUpperCase()}</>
              ) : activeView === "leaderboard" ? (
                <>{t("workspace.leaderboardEyebrow").toUpperCase()}</>
              ) : activeView === "tasks" ? (
                <>{t("workspace.tasksEyebrow").toUpperCase()}</>
              ) : activeView === "career" ? (
                <>{t("workspace.careerEyebrow").toUpperCase()}</>
              ) : activeView === "pools" ? (
                <>{t("workspace.pools").toUpperCase()}</>
              ) : activeView === "inventory" ? (
                <>{t("workspace.inventory").toUpperCase()}</>
              ) : activeView === "forge" ? (
                <>{t("workspace.forgeEyebrow").toUpperCase()}</>
              ) : (
                <>
                  {locale !== "pt-BR" ? t("workspace.mineEyebrow").toUpperCase() : activeRoom.label} <i /> {activeRoom.name.toUpperCase()}
                </>
              )}
            </span>
            <h1>
              {rackOpen && activeRack
                 ? t("workspace.manage")
                : activeView === "mine"
                  ? t("workspace.mine")
                  : activeView === "pools"
                    ? t("workspace.pools")
                    : activeView === "conversion"
                      ? t("workspace.wallet")
                    : activeView === "inventory"
                      ? t("workspace.inventory")
                      : activeView === "forge"
                        ? t("workspace.forge")
                      : activeView === "shop"
                         ? t("workspace.shop")
                        : activeView === "games"
                           ? t("workspace.games")
                        : activeView === "season"
                           ? t("workspace.season")
                          : activeView === "tasks"
                             ? t("workspace.tasks")
                             : t("workspace.career")}
            </h1>
          </div>
        </div>

        <div className="metric-strip">
          <article className="power-metric">
            <span className="metric-icon power">H</span>
            <div>
              <small>{t("metric.minerPower").toUpperCase()}</small>
              <strong>{formatPower(minerPower)}</strong>
            </div>
            <em>
              {energySeconds <= 0
                ? t("metric.useBattery").toUpperCase()
                : t("metric.batteryPowered").toUpperCase()}
            </em>
          </article>
          <article className="game-power-metric">
            <span className="metric-icon game-power">G</span>
            <div>
              <small>{t("metric.gamePower").toUpperCase()}</small>
              <strong>{formatPower(temporaryPowerGh)}</strong>
            </div>
            <em>{(temporaryPowerGh > 0 ? t("metric.noBattery") : t("metric.playToGenerate")).toUpperCase()}</em>
          </article>
          <article className="rack-metric">
            <span className="metric-icon slots">R</span>
            <div>
              {/* RACKS NESTA SALA remains the canonical metric name for accessibility snapshots. */}
              <small>{t("metric.racks").toUpperCase()}</small>
              <strong>
                {currentRoomRacks.length} / {ROOM_RACK_CAPACITY}
              </strong>
            </div>
            <em>{ROOM_RACK_CAPACITY - currentRoomRacks.length} {t("metric.free").toUpperCase()}</em>
          </article>
          <article className="energy-metric">
            <img src={assetsManifest.battery.path} alt="" />
            <div>
              <small>{t("metric.energy").toUpperCase()}</small>
              <strong>{formatEnergy(energySeconds)}</strong>
            </div>
            <em>{batteryCount} {t("metric.batteries").toUpperCase()}</em>
          </article>
          <article className="pool-metric">
            <span className="metric-icon pool">P</span>
            <div>
              <small>{t("metric.mainNetwork").toUpperCase()}</small>
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
              stagingVisuals={stagingVisuals}
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
                activeRoom={displayedActiveRoom}
                stagingVisuals={stagingVisuals}
                roomRacks={currentRoomRacks}
                rackMiners={rackMiners}
                editMode={editMode}
                poolAllocations={poolAllocations}
                network={network}
                minerPower={minerPower}
                temporaryPowerGh={temporaryPowerGh}
                effectivePower={effectivePower}
                secondsLeft={secondsLeft}
                energySeconds={energySeconds}
                batteryCount={batteryCount}
                lastEnergyClaimAt={lastEnergyClaimAt}
                clockNow={clockNow}
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
                onClaimFreeBattery={claimFreeBatteryCycle}
                cyclePending={actionPending}
              />
            </div>
            <style jsx>{`
              .mine-view-container, .games-view-container {
                display: flex;
                flex-direction: row;
                gap: 24px;
                padding: 0 16px;
                max-width: 1400px;
                margin: 0 auto;
                align-items: flex-start;
              }
              .mine-main-content, .games-main-content {
                flex: 1;
                min-width: 0;
              }
              .mine-side-panels, .games-side-panels {
                width: 320px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex-shrink: 0;
              }
              @media (max-width: 1100px) {
                .mine-view-container, .games-view-container {
                  flex-direction: column;
                }
                .mine-side-panels, .games-side-panels {
                  width: 100%;
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
              if (target === "career") setCareerStartTab("overview");
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
            key={serverVersion}
            allocations={poolAllocations}
            installedPower={minerPower}
            temporaryPowerGh={temporaryPowerGh}
            network={network}
            saving={actionPending}
            onApplyAllocations={applyPoolAllocations}
          />
        )}

        {!rackOpen && activeView === "conversion" && (
          <ConversionView
            btcBalanceAtomic={btcBalanceAtomic}
            cmaBalance={cmaBalance}
            dogeBalanceAtomic={dogeBalanceAtomic}
            ltcBalanceAtomic={ltcBalanceAtomic}
            seasonalWalletAmc={seasonalWalletAmc}
            onRefreshAccount={refreshServerState}
            serverVersion={serverVersion}
          />
        )}

        {!rackOpen && activeView === "inventory" && (
          <InventoryView
            minerInventory={minerInventory}
            installedMiners={allInstalled}
            installedRackCount={racks.length}
            rackInventoryCount={rackInventoryCount}
            partsInventory={partsInventory}
            locale={locale}
            onOpenRack={openRackFromInventory}
            onOpenForge={() => setActiveView("forge")}
            onOpenStore={openStore}
          />
        )}

        {!rackOpen && stagingVisuals && activeView === "forge" && (
        <ForgeView
          minerInventory={minerInventory}
          partsInventory={partsInventory}
          cmaBalance={cmaBalance}
          locale={locale}
            onMergeMiner={mergeMiner}
            onMergePart={mergePart}
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
            luckCrateOpenCount={luckCrateOpenCount}
            cratePityStreaks={cratePityStreaks}
            seasonalWalletAmc={seasonalWalletAmc}
            minerOfferPurchases={minerOfferPurchases}
            serverTime={clockNow}
            allowSeasonalShop={stagingVisuals}
            locale={locale}
            onSetCategory={setShopCategory}
            onBuyMiners={buyMiners}
            onBuyMinerOffer={buyMinerOffer}
            onBuyRacks={buyRacks}
            onBuyBatteries={buyBatteries}
            onOpenSupplyCrate={openSupplyCrate}
            onOpenLuckCrate={openLuckCrate}
            onOpenSeasonBox={openSeasonBox}
            onGoToRoom={() => {
              setActiveView("mine");
              setEditMode(true);
            }}
          />
        )}

        {!rackOpen && activeView === "games" && (
          <div className="games-view-container">
            <div className="games-main-content">
              <PCStatusPanel
                refreshKey={serverVersion}
                temporaryPowerGh={temporaryPowerGh}
                stagingVisuals={stagingVisuals}
              />
              <PacketCatchView
                temporaryPowerGh={temporaryPowerGh}
                onRefreshAccount={refreshServerState}
              />
            </div>
          </div>
        )}

        {!rackOpen && activeView === "season" && (
          <SeasonPanel
            refreshKey={serverVersion}
            onRefreshAccount={refreshServerState}
            stagingVisuals={stagingVisuals}
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
          />
        )}

        {!rackOpen && activeView === "leaderboard" && (
          <LeaderboardPanel />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.filter((item) => stagingVisuals || item.id !== "forge").map((item) => (
          <button
            type="button"
            key={item.id}
            className={activeView === item.id ? "active" : ""}
            onClick={() => {
                setRackOpen(false);
                setWalletOpen(false);
                setRoomsOpen(false);
                if (item.id === "career") setCareerStartTab("overview");
                if (item.id === "shop" && stagingVisuals) setShopCategory("offers");
                setActiveView(item.id);
              }}
          >
            <span className="mobile-nav-icon" aria-hidden="true">
              <img src={item.icon} alt="" />
              <span className="nav-glyph-fallback">{item.glyph}</span>
            </span>
            {t(`nav.short.${item.id}`, item.shortLabel)}
          </button>
        ))}
        <a className="mobile-support-link" href="/support">
          <span className="mobile-nav-icon" aria-hidden="true">
            <img src="/assets/icons/icone_suporte.png" alt="" />
            <span className="nav-glyph-fallback">?</span>
          </span>
          {t("nav.support")}
          {unreadSupportReplies > 0 ? (
            <b>{Math.min(99, unreadSupportReplies)}</b>
          ) : null}
        </a>
      </nav>

      {roomsOpen && (
        <RoomsModal
          activeRoomId={activeRoomId}
          ownedRoomIds={ownedRoomIds}
          stagingVisuals={stagingVisuals}
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

      {blockNotice && (
        <div className="block-notice" role="status" aria-live="polite">
          <div className="block-notice-icon" aria-hidden="true">
            <span>⛏</span>
            <img src={assetsManifest.cmaCoin.path} alt="" />
          </div>
          <div>
            <strong>{english
              ? blockNotice.count === 1 ? "Block mined" : "Blocks mined"
              : blockNotice.count === 1 ? "Bloco minerado" : "Blocos minerados"}</strong>
            <span>
              {blockNotice.count === 1
                ? english
                  ? `Block #${blockNotice.block.toLocaleString("en-US")} was processed.`
                  : `O bloco #${blockNotice.block.toLocaleString("pt-BR")} foi processado.`
                : english
                  ? `${blockNotice.count} blocks were processed through #${blockNotice.block.toLocaleString("en-US")}.`
                  : `${blockNotice.count} blocos foram processados até o #${blockNotice.block.toLocaleString("pt-BR")}.`}
            </span>
            <small>{english ? "Reward and ledger synced by the server." : "Recompensa e extrato sincronizados pelo servidor."}</small>
          </div>
          <button
            type="button"
            onClick={() => setBlockNotice(null)}
            aria-label={english ? "Close block notice" : "Fechar aviso de bloco"}
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

function MiningRoom({
  activeRoom,
  stagingVisuals,
  roomRacks,
  rackMiners,
  editMode,
  poolAllocations,
  network,
  minerPower,
  temporaryPowerGh,
  effectivePower,
  secondsLeft,
  energySeconds,
  batteryCount,
  lastEnergyClaimAt,
  clockNow,
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
  onClaimFreeBattery,
  cyclePending,
}: {
  activeRoom: RoomDefinition;
  stagingVisuals: boolean;
  roomRacks: RackInstance[];
  rackMiners: Record<string, InstalledMiner[]>;
  editMode: boolean;
  poolAllocations: PoolAllocations;
  network: NetworkPowerSnapshot;
  minerPower: number;
  temporaryPowerGh: number;
  effectivePower: number;
  secondsLeft: number;
  energySeconds: number;
  batteryCount: number;
  lastEnergyClaimAt: number;
  clockNow: number;
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
  onClaimFreeBattery: () => void;
  cyclePending: boolean;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const [operationsOpen, setOperationsOpen] = useState(false);
  const roomRackPositions = stagingVisuals ? stagingRackPositions : rackPositions;
  const rackAsset = stagingVisuals
    ? assetsManifest.rackTallStaging
    : assetsManifest.rackBasic;
  const orderedRoomRacks = [...roomRacks].sort(
    (first, second) => first.positionIndex - second.positionIndex,
  );
  const firstEmptyRackPosition = roomRackPositions.findIndex(
    (_, positionIndex) =>
      !roomRacks.some((rack) => rack.positionIndex === positionIndex),
  );

  return (
    <div className="mine-grid">
      <section className={`room-card ${stagingVisuals ? "room-card-staging" : ""}`}>
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
              <span>●</span> {english ? "ROOM" : "SALA"}
            </button>
            <button
              type="button"
              className={editMode ? "selected edit-active" : ""}
              onClick={() => onSetEditMode(true)}
            >
              <span>+</span> {english ? "ORGANIZE" : "ORGANIZAR"} · {roomRacks.length}/{ROOM_RACK_CAPACITY}
            </button>
            <button type="button" onClick={onOpenRooms}>
              <span>▣</span> {english ? "SWITCH ROOM" : "TROCAR SALA"} · {ownedRooms}/{roomDefinitions.length}
            </button>
          </div>
        </div>

        <div
          className={`room-stage ${stagingVisuals ? "room-stage-staging" : ""} ${editMode ? "editing" : ""}`}
          data-room-id={activeRoom.id}
          data-room-layout={stagingVisuals ? "arcadia-staging-4x3" : "arcadia-4x3"}
        >
          <div className="room-scene-canvas">
            <img
              className="room-background"
              src={activeRoom.asset}
              alt={activeRoom.alt}
            />

            {roomRackPositions.map((position, positionIndex) => {
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
                  aria-label={english ? `Install rack at position ${positionIndex + 1}` : `Instalar rack na posição ${positionIndex + 1}`}
                >
                  <span>+</span>
                  <small>{english ? "POSITION" : "POSIÇÃO"} {positionIndex + 1}</small>
                  <b>
                    {rackInventoryCount > 0
                      ? english ? `INSTALL · ${rackInventoryCount} AVAILABLE` : `INSTALAR · ${rackInventoryCount} DISP.`
                      : english ? "OPEN SHOP" : "ABRIR LOJA"}
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
                  aria-label={english ? `Open rack at position ${positionIndex + 1}` : `Abrir rack da posição ${positionIndex + 1}`}
                  style={style}
                  key={rack.id}
                >
                  <span className="rack-visual">
                    <img
                      className="rack-frame"
                      src={rackAsset.path}
                      alt=""
                    />
                    {installed.map((placement) => {
                      const miner = getMiner(placement.minerId);
                      if (!miner) return null;

                      return (
                        <span className="rack-miner-wrap" key={placement.instanceId}>
                          <img
                            className={`rack-miner size-${miner.slotSize}`}
                            data-rack-art={
                              miner.availability === "season" ? "season" : "standard"
                            }
                            data-miner-family={minerVisualFamily(miner)}
                            src={miner.asset}
                            alt={miner.alt}
                            style={minerVisualStyle(
                              miner,
                              stagingVisuals
                                ? rackMinerPosition(
                                    placement.slotIndex,
                                    miner.slotSize,
                                    true,
                                    miner.availability === "season",
                                  )
                                // Base production anchor: rackMinerPosition(placement.slotIndex)
                                // keeps legacy placements aligned while staging applies its own scale.
                                : rackMinerPosition(placement.slotIndex, miner.slotSize),
                            )}
                          />
                          {!stagingVisuals && (
                            <b
                              className="rack-miner-level-badge"
                              style={rackMinerPosition(placement.slotIndex, miner.slotSize, stagingVisuals)}
                              aria-label={`${english ? "Miner level" : "Nível do minerador"} ${normalizeMinerLevel(placement.level)}`}
                            >
                              {getMinerLevelCode(placement.level ?? 1)}
                            </b>
                          )}
                        </span>
                      );
                    })}
                  </span>
                  <span className="rack-click-label">
                    <b>RACK · {getUsedSlotCount(installed)}/8</b>
                    {english ? "CLICK TO MANAGE" : "CLIQUE PARA GERENCIAR"}
                  </span>
                </button>
              );
            })}

            <div className="room-coordinates">
              {ROOM_RACK_CAPACITY} {english ? "FREE POSITIONS" : "POSIÇÕES GRATUITAS"} · LAYOUT V.03
            </div>
          </div>
        </div>

        <div className="room-command-dock" aria-label={english ? "Operation summary" : "Resumo da operação"}>
          <div className="room-command-status">
            <span><small>{english ? "POWER" : "PODER"}</small><strong>{formatPower(effectivePower)}</strong></span>
            <span><small>{english ? "ENERGY" : "ENERGIA"}</small><strong>{formatEnergy(energySeconds)}</strong></span>
            <span><small>{english ? "NEXT BLOCK" : "PRÓXIMO BLOCO"}</small><strong>{formatTimer(secondsLeft)}</strong></span>
          </div>
          <div className="room-command-actions">
            <button type="button" onClick={() => setOperationsOpen(true)}>
              <span>⌁</span> {english ? "OPERATIONS" : "OPERAÇÃO"}
            </button>
            <button type="button" onClick={onOpenPools}>
              <span>◫</span> POOLS
            </button>
            <button type="button" onClick={() => onOpenStore("miners")}>
              <span>＋</span> {english ? "SHOP" : "LOJA"}
            </button>
          </div>
        </div>

        <nav
          className="mobile-rack-dock"
          aria-label={english ? "Quick access to this room's racks" : "Acesso rápido aos racks desta sala"}
        >
          <header>
            <div>
              <span>{english ? "ROOM RACKS" : "RACKS DA SALA"}</span>
              <strong>
                {roomRacks.length}/{ROOM_RACK_CAPACITY} {english ? "installed" : "instalados"}
              </strong>
            </div>
            <small>{english ? "Swipe and tap to manage" : "Deslize e toque para gerenciar"}</small>
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
                  aria-label={`${english ? "Open rack at position" : "Abrir rack da posição"} ${
                    rack.positionIndex + 1
                  }, ${usedSlots} ${english ? "of 8 occupied slots" : "de 8 slots ocupados"}`}
                  key={rack.id}
                >
                  <span className="mobile-rack-sprite" aria-hidden="true">
                    <img
                      className="rack-frame"
                      src={rackAsset.path}
                      alt=""
                    />
                    {installed.map((placement) => {
                      const miner = getMiner(placement.minerId);
                      if (!miner) return null;
                      return (
                        <span className="rack-miner-wrap" key={placement.instanceId}>
                          <img
                            className={`rack-miner size-${miner.slotSize}`}
                            data-rack-art={
                              miner.availability === "season" ? "season" : "standard"
                            }
                            data-miner-family={minerVisualFamily(miner)}
                            src={miner.asset}
                            alt=""
                            style={minerVisualStyle(
                              miner,
                              rackMinerPosition(
                                placement.slotIndex,
                                miner.slotSize,
                                stagingVisuals,
                                miner.availability === "season",
                              ),
                            )}
                          />
                          {!stagingVisuals && (
                            <b
                              className="rack-miner-level-badge"
                              style={rackMinerPosition(placement.slotIndex, miner.slotSize, stagingVisuals)}
                              aria-label={`${english ? "Miner level" : "Nível do minerador"} ${normalizeMinerLevel(placement.level)}`}
                            >
                              {getMinerLevelCode(placement.level ?? 1)}
                            </b>
                          )}
                        </span>
                      );
                    })}
                  </span>
                  <span className="mobile-rack-copy">
                    <strong>
                      RACK {String(rack.positionIndex + 1).padStart(2, "0")}
                    </strong>
                    <small>{usedSlots}/8 {english ? "occupied slots" : "slots ocupados"}</small>
                  </span>
                  <b>{english ? "OPEN" : "ABRIR"}</b>
                </button>
              );
            })}

            {editMode && firstEmptyRackPosition >= 0 && (
              <button
                type="button"
                className="mobile-rack-card add"
                onClick={() => onPlaceRack(firstEmptyRackPosition)}
                aria-label={english ? `Install rack at position ${firstEmptyRackPosition + 1}` : `Instalar rack na posição ${firstEmptyRackPosition + 1}`}
              >
                <span className="mobile-rack-add" aria-hidden="true">
                  +
                </span>
                <span className="mobile-rack-copy">
                  <strong>{english ? "POSITION" : "POSIÇÃO"} {firstEmptyRackPosition + 1}</strong>
                  <small>
                    {rackInventoryCount > 0
                      ? english ? `${rackInventoryCount} rack available` : `${rackInventoryCount} rack disponível`
                      : english ? "Open rack shop" : "Abrir loja de racks"}
                  </small>
                </span>
                <b>{rackInventoryCount > 0 ? english ? "INSTALL" : "INSTALAR" : english ? "SHOP" : "LOJA"}</b>
              </button>
            )}
          </div>
        </nav>
      </section>

      {operationsOpen && (
        <>
          <button
            aria-label={english ? "Close operations panel" : "Fechar painel da operação"}
            className="operation-drawer-backdrop"
            onClick={() => setOperationsOpen(false)}
            type="button"
          />
          <aside className="operation-panel operation-drawer" aria-label={english ? "Operation details" : "Detalhes da operação"}>
        <div className="panel-title">
          <span>{english ? "CURRENT OPERATIONS" : "OPERAÇÃO ATUAL"}</span>
          <button aria-label={english ? "Close" : "Fechar"} onClick={() => setOperationsOpen(false)} type="button">×</button>
        </div>

        <EnergyCard
          energySeconds={energySeconds}
          batteryCount={batteryCount}
          lastEnergyClaimAt={lastEnergyClaimAt}
          clockNow={clockNow}
          onOpenGames={onOpenGames}
          onOpenStore={() => onOpenStore("energy")}
          onUseBattery={onUseBattery}
          onClaimFreeBattery={onClaimFreeBattery}
          cyclePending={cyclePending}
        />

        <div className="allocation-summary-card">
          <div className="allocation-summary-heading">
            <span>{english ? "POWER DISTRIBUTION · POOLS" : "DISTRIBUIÇÃO DE PODER · POOLS"}</span>
            <strong>{energySeconds > 0 ? english ? "ACTIVE" : "ATIVA" : english ? "PAUSED" : "PAUSADA"}</strong>
          </div>
          <div className="allocation-summary-list">
            {pools.map((pool) => {
              const allocation = poolAllocations[pool.id] ?? 0;
              return (
                <div key={pool.id}>
                  <img src={pool.asset} alt="" />
                  <span>{pool.symbol}</span>
                  <b>{allocation}%</b>
                  <small>
                    {formatPower(
                      (minerPower * allocation) / 100
                    )}
                  </small>
                </div>
              );
            })}
          </div>
          <p className="pool-allocation-note">
            {english
              ? "Miners and temporary minigame power automatically follow this same distribution."
              : "Mineradores e poder temporário dos minigames seguem automaticamente esta mesma distribuição."}
          </p>
          <button type="button" onClick={onOpenPools}>
            {english ? "ADJUST DISTRIBUTION" : "AJUSTAR DISTRIBUIÇÃO"}
          </button>
        </div>

        <MiningStatusPanel
          installedPower={minerPower}
          temporaryPowerGh={temporaryPowerGh}
          allocations={poolAllocations}
          networkPowerGh={network.playerPowerGh}
          secondsLeft={secondsLeft}
          onOpenPools={onOpenPools}
        />

        <div className="reward-box multi-reward-box">
          <div className="fixed-block-heading">
            <span>{english ? "FIXED NETWORK BLOCK · 10 MIN" : "BLOCO FIXO DA REDE · 10 MIN"}</span>
            <b>
              {network.bonusActive && network.bonusBps != null
                ? `EVENTO ${(network.bonusBps / 100).toFixed(2)}%`
                : english ? "BASE EMISSION" : "EMISSÃO-BASE"}
            </b>
          </div>
          <div className="reward-split-list">
            {pools.map((pool) => {
              const allocation = poolAllocations[pool.id] ?? 0;
              const allocatedPower =
                (minerPower * allocation) / 100 +
                (temporaryPowerGh * allocation) / 100;
              // Safe bigint conversion — prevents BigInt(NaN/undefined/Infinity) crash
              const blockRewardAtomicNum = (network.blockRewardAtomic[pool.id] ?? 0) as number;
              const blockRewardAtomicBigInt = (() => {
                const n = Number(blockRewardAtomicNum);
                return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? BigInt(n) : 0n;
              })();
              const safeDecimals = (() => {
                const d = pool.decimals;
                return Number.isFinite(d) && Number.isInteger(d) && d >= 0 ? d : 0;
              })();
              const activeNetworkPowerGh = network.playerPowerGh[pool.id] ?? 0;
              const safeBlockCount = 1;
              const personalEstimateAtomic = calculateEstimatedReward(
                pool,
                allocatedPower,
                activeNetworkPowerGh,
                blockRewardAtomicBigInt,
              );
              // For UI fractional display:
              const rawEstimateStr = activeNetworkPowerGh > 0 
                ? ((safeBlockCount * Number(blockRewardAtomicBigInt) * allocatedPower) / activeNetworkPowerGh) / (10 ** safeDecimals)
                : 0;
              const formattedFractionalEstimate = rawEstimateStr.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
              return (
                <div key={pool.id}>
                  <img src={pool.asset} alt="" />
                  <strong>
                    {formatAtomic(
                      blockRewardAtomicBigInt,
                      safeDecimals,
                    )}{" "}
                    {pool.symbol}
                  </strong>
                  <small>
                    {english ? "Your share:" : "Sua parte:"} {personalEstimateAtomic > 0n ? formatAtomic(personalEstimateAtomic, safeDecimals) : formattedFractionalEstimate}{" "}
                    {pool.symbol}
                  </small>
                </div>
              );
            })}
          </div>
          <small>
            {english
              ? "More power changes your share of the competition, never the total block emission. If you are the only active miner, you receive 100% of that network's fixed block."
              : "Mais poder altera sua porcentagem na disputa, nunca o valor total emitido pelo bloco. Se você for o único minerador ativo, recebe 100% do bloco fixo daquela rede."}
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
  lastEnergyClaimAt,
  clockNow,
  onOpenGames,
  onOpenStore,
  onUseBattery,
  onClaimFreeBattery,
  cyclePending,
}: {
  energySeconds: number;
  batteryCount: number;
  lastEnergyClaimAt: number;
  clockNow: number;
  onOpenGames: () => void;
  onOpenStore: () => void;
  onUseBattery: () => void;
  onClaimFreeBattery: () => void;
  cyclePending: boolean;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const chargedCells = Math.ceil(energySeconds / (BATTERY_HOURS * 3600));
  const batteryCycleMs = 12 * 60 * 60 * 1000;
  const cycleRemaining = Math.max(
    0,
    lastEnergyClaimAt + batteryCycleMs - clockNow,
  );

  return (
    <div className="energy-card">
      <div className="energy-card-heading">
        <div className="battery-art">
          <img src={assetsManifest.battery.path} alt={assetsManifest.battery.alt} />
        </div>
        <div>
          <small>{english ? "MINER ENERGY" : "ENERGIA DOS MINERADORES"}</small>
          <strong>{formatEnergy(energySeconds)}</strong>
          <span>{batteryCount} {english ? "batteries in inventory" : "baterias no inventário"}</span>
        </div>
      </div>
      <div
        className="energy-cells"
        aria-label={english ? `${chargedCells} of 8 cells charged` : `${chargedCells} de 8 células carregadas`}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <i className={index < chargedCells ? "charged" : ""} key={index}>
            12h
          </i>
        ))}
      </div>
      {/* ENERGIA PELO ARCADE is an internal label; only the battery claim card is shown. */}
      <div className="battery-cycle-card">
        <span>
          <small>{english ? "FREE BATTERY · 12H CYCLE" : "BATERIA GRATUITA · CICLO DE 12H"}</small>
          <strong>
            {cycleRemaining === 0
              ? english ? "Battery available" : "Bateria disponível"
              : english ? `Next in ${formatEnergy(Math.ceil(cycleRemaining / 1000))}` : `Próxima em ${formatEnergy(Math.ceil(cycleRemaining / 1000))}`}
          </strong>
        </span>
        <button
          type="button"
          disabled={cycleRemaining > 0 || cyclePending}
          onClick={onClaimFreeBattery}
        >
          {cyclePending ? english ? "VALIDATING..." : "VALIDANDO..." : cycleRemaining === 0 ? english ? "CLAIM" : "RESGATAR" : english ? "WAIT" : "AGUARDAR"}
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
          {english ? "USE BATTERY" : "USAR BATERIA"} · +{BATTERY_HOURS}H
        </button>
        <button type="button" onClick={onOpenStore}>
          {english ? "OPEN SHOP" : "IR PARA LOJA"}
        </button>
        <button type="button" onClick={onOpenGames}>
          {english ? "OPEN ARCADE" : "IR PARA ARCADE"}
        </button>
      </div>
      <p>
        {english
          ? "The battery cycle is separate from season XP. XP missions stay in the pass and do not change pool allocations."
          : "O ciclo de bateria é separado do XP da temporada. As missões de XP ficam no passe e não alteram a distribuição das pools."}
      </p>
    </div>
  );
}

function MiningStatusPanel({
  installedPower,
  temporaryPowerGh,
  allocations,
  networkPowerGh,
  secondsLeft,
  onOpenPools,
}: {
  installedPower: number;
  temporaryPowerGh: number;
  allocations: PoolAllocations;
  networkPowerGh: Record<PoolId, number>;
  secondsLeft: number;
  onOpenPools: () => void;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const activePools = pools.filter((pool) => allocations[pool.id] > 0);

  return (
    <section className="mining-status-panel" aria-label={english ? "Mining status" : "Status da mineração"}>
      <div className="mining-status-heading">
        <span>{english ? "GLOBAL SERVER NETWORK" : "REDE GLOBAL DO SERVIDOR"}</span>
        <i className="online-dot" />
      </div>

      <div className="mining-pool-status-list">
        {activePools.map((pool) => {
          // Fix #3: guard allocation against undefined
          const allocation = allocations[pool.id] ?? 0;
          // Fix #4: guard installedPower against NaN/Infinity
          const safePower = typeof installedPower === "number" && Number.isFinite(installedPower) ? installedPower : 0;
          const safeTemporaryPower = Number.isFinite(temporaryPowerGh)
            ? Math.max(0, temporaryPowerGh)
            : 0;
          const allocatedMinerPower = Math.floor((safePower * allocation) / 100);
          const allocatedGamePower = Math.floor((safeTemporaryPower * allocation) / 100);
          // Fix #2: guard networkPowerGh key against undefined
          const poolNetworkPower = networkPowerGh[pool.id] ?? 0;
          return (
            <article
              key={pool.id}
              style={{ "--pool-color": pool.color } as React.CSSProperties}
            >
              <img src={pool.asset} alt="" />
              <span>
                <small>{pool.symbol} · {allocation}% {english ? "OF YOUR POWER" : "DO SEU PODER"}</small>
                <strong>{formatPower(poolNetworkPower)}</strong>
                <em>{english ? "Total network power" : "Poder total da rede"} {pool.symbol}</em>
              </span>
              <b>
                <span>{formatPower(allocatedMinerPower)} {english ? "miners" : "mineradores"}</span>
                <span className="temporary-power-inline">
                  + {formatPower(allocatedGamePower)} minigames
                </span>
              </b>
            </article>
          );
        })}
      </div>

      <div className="mining-block-status">
        <span>
          <small>{english ? "NEXT BLOCK" : "PRÓXIMO BLOCO"}</small>
          <strong>{formatTimer(secondsLeft)}</strong>
        </span>
        <div>
          <i
            style={{
              width: `${
                // Fix #5: guard against division by zero
                ((BLOCK_INTERVAL_SECONDS > 0 ? BLOCK_INTERVAL_SECONDS : 1) -
                  (secondsLeft ?? 0)) /
                  (BLOCK_INTERVAL_SECONDS > 0 ? BLOCK_INTERVAL_SECONDS : 1) *
                100
              }%`,
            }}
          />
        </div>
        <button type="button" onClick={onOpenPools}>
          {english ? "MANAGE POOLS" : "GERENCIAR POOLS"}
        </button>
      </div>
    </section>
  );
}

export function GamesView() {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const games = [
    {
      id: "packet-catch",
      name: "Packet Catch",
      glyph: "↓",
      description: english
        ? "Capture valid packets and avoid corrupted data in fast-paced rounds."
        : "Capture pacotes válidos e evite dados corrompidos em partidas rápidas.",
      reward: english ? "100–220 temporary GH/s" : "100–220 GH/s temporários",
      secondary: english ? "low battery chance" : "chance baixa de bateria",
      duration: english ? "60–90 seconds" : "60–90 segundos",
      color: "#36d8f2",
    },
    {
      id: "hash-match",
      name: "Hash Match",
      glyph: "◇",
      description: english
        ? "Find matching chip pairs with memory, speed and few mistakes."
        : "Encontre pares de chips com memória, velocidade e poucos erros.",
      reward: english ? "140–280 temporary GH/s" : "140–280 GH/s temporários",
      secondary: english ? "limited CMA fragments" : "fragmentos CMA limitados",
      duration: english ? "2–3 minutes" : "2–3 minutos",
      color: "#a9ff3f",
    },
    {
      id: "circuit-rush",
      name: "Circuit Rush",
      glyph: "»",
      description: english
        ? "Guide a drone through circuits and avoid electronic obstacles."
        : "Guie um drone por circuitos e desvie de obstáculos eletrônicos.",
      reward: english ? "180–350 temporary GH/s" : "180–350 GH/s temporários",
      secondary: english ? "low battery chance" : "chance baixa de bateria",
      duration: english ? "90–120 seconds" : "90–120 segundos",
      color: "#ffb33b",
    },
  ];

  return (
    <section className="games-view">
      <div className="games-hero">
        <div>
          <span className="eyebrow">{english ? "DESIGN PHASE · REWARDS DISABLED" : "FASE DE PROJETO · RECOMPENSAS DESATIVADAS"}</span>
          <h2>{english ? "Mining arcade" : "Arcade de mineração"}</h2>
          <p>
            {english
              ? "Three original minigames are designed to grant temporary power. CMA and batteries have daily limits and server validation before activation."
              : "Três minigames originais foram definidos para conceder poder temporário. CMA e baterias terão limites diários e validação no servidor antes de serem ativados."}
          </p>
        </div>
        <div className="games-balance-seal">
          <strong>0</strong>
          <span>{english ? "REWARDS ISSUED" : "RECOMPENSAS EMITIDAS"}</span>
          <small>{english ? "safe prototype" : "protótipo seguro"}</small>
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
              <b>{english ? "IN DESIGN" : "EM PROJETO"}</b>
            </div>
            <div className="game-prototype-info">
              <span>MINIGAME {String(index + 1).padStart(2, "0")}</span>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
              <dl>
                <div>
                  <dt>{english ? "Duration" : "Duração"}</dt>
                  <dd>{game.duration}</dd>
                </div>
                <div>
                  <dt>{english ? "Expected power" : "Poder previsto"}</dt>
                  <dd>{game.reward}</dd>
                </div>
                <div>
                  <dt>{english ? "Expected extra" : "Extra previsto"}</dt>
                  <dd>{game.secondary}</dd>
                </div>
              </dl>
              <button type="button" disabled>
                {english ? "PROTOTYPE LOCKED" : "PROTÓTIPO BLOQUEADO"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="games-safety-roadmap">
        <div>
          <span>01</span>
          <strong>{english ? "Gameplay" : "Jogabilidade"}</strong>
          <small>{english ? "Build and test fun without rewards." : "Construir e testar diversão sem recompensas."}</small>
        </div>
        <div>
          <span>02</span>
          <strong>{english ? "Server and anti-fraud" : "Servidor e antifraude"}</strong>
          <small>{english ? "Signed sessions, limits and validated scores." : "Sessões assinadas, limites e pontuação validada."}</small>
        </div>
        <div>
          <span>03</span>
          <strong>{english ? "Controlled economy" : "Economia controlada"}</strong>
          <small>{english ? "Enable power, batteries and CMA with a daily cap." : "Ativar poder, bateria e CMA com teto diário."}</small>
        </div>
      </div>
    </section>
  );
}

function PoolsView({
  allocations,
  installedPower,
  temporaryPowerGh,
  network,
  saving,
  onApplyAllocations,
}: {
  allocations: PoolAllocations;
  installedPower: number;
  temporaryPowerGh: number;
  network: NetworkPowerSnapshot;
  saving: boolean;
  onApplyAllocations: (allocations: PoolAllocations) => void | Promise<void>;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const [draft, setDraft] = useState<PoolAllocations>(allocations);
  const totalAllocation = pools.reduce(
    (total, pool) => total + draft[pool.id],
    0,
  );
  const hasUnsavedChanges = pools.some(
    (pool) => draft[pool.id] !== allocations[pool.id],
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
          <span className="eyebrow">{english ? "MULTI-MINING · 10-MINUTE BLOCKS" : "MULTI-MINERAÇÃO · BLOCOS DE 10 MINUTOS"}</span>
          <h2>{english ? "Distribute your power" : "Distribua seu poder"}</h2>
          <p>
            {english
              ? "One allocation applies to miners and to temporary power validated in the minigames."
              : "Uma única distribuição vale para os mineradores e para o poder temporário validado nos minigames."}
          </p>
        </div>
        <div
          className={`allocation-total ${
            totalAllocation === 100 ? "valid" : "invalid"
          }`}
        >
          <small>{english ? "TOTAL ALLOCATED" : "TOTAL DISTRIBUÍDO"}</small>
          <strong>{totalAllocation}%</strong>
          <span>
            {totalAllocation === 100
              ? english ? "READY TO APPLY" : "PRONTO PARA APLICAR"
              : totalAllocation < 100
                ? english ? `${100 - totalAllocation}% REMAINING` : `FALTAM ${100 - totalAllocation}%`
                : english ? `${totalAllocation - 100}% OVER` : `EXCEDEU ${totalAllocation - 100}%`}
          </span>
        </div>
      </div>

      <div className="temporary-power-banner">
        <div>
          <span className="temporary-power-badge">G</span>
          <div>
            <strong>{english ? "Temporary minigame power" : "Poder temporário dos minigames"}</strong>
            <small>
               {english
                 ? "Includes validated rewards and any additional power issued by the server. The total follows this same allocation."
                 : "Inclui a recompensa validada e qualquer poder adicional emitido pelo servidor. O total segue esta mesma distribuição."}
            </small>
          </div>
        </div>
        <div className="temporary-power-total">
          <strong>{formatPower(temporaryPowerGh)}</strong>
          <small>{english ? "validated temporary power" : "poder temporário validado"}</small>
        </div>
      </div>

      <div className="allocation-presets">
        <span>{english ? "QUICK ALLOCATIONS" : "DISTRIBUIÇÕES RÁPIDAS"}</span>
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
          {english ? "EQUAL SPLIT" : "DIVISÃO IGUAL"}
        </button>
      </div>

      <div className="pool-grid">
        {pools.map((pool) => {
          const allocation = draft[pool.id] ?? 0;
          const allocatedMinerPower = Math.floor(
            (installedPower * allocation) / 100,
          );
          const allocatedGamePower = Math.floor(
            (Math.max(0, temporaryPowerGh) * allocation) / 100,
          );
          const allocatedPower = allocatedMinerPower + allocatedGamePower;
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
                  {allocation > 0
                    ? `${allocation}% ${english ? "ALLOCATED" : "ALOCADO"}`
                    : english ? "NO POWER" : "SEM PODER"}
                </span>
              </div>
              <span className="pool-code">{pool.symbol} / POOL</span>
              <h3>{pool.name}</h3>
              <dl>
                <div>
                  <dt>{english ? "Miners" : "Mineradores"}</dt>
                  <dd>{formatPower(allocatedMinerPower)}</dd>
                </div>
                <div>
                  <dt>{english ? "Minigames · temporary" : "Minigames · temporário"}</dt>
                  <dd className={allocatedGamePower > 0 ? "temporary-power-value" : undefined}>
                    {formatPower(allocatedGamePower)}
                  </dd>
                </div>
                <div className="pool-total-power-row">
                  <dt>{english ? "Effective allocated power" : "Poder efetivo alocado"}</dt>
                  <dd>{formatPower(allocatedPower)}</dd>
                </div>
                <div>
                  <dt>{english ? "Global player power" : "Poder global dos jogadores"}</dt>
                  <dd>{formatPower(network.playerPowerGh[pool.id])}</dd>
                </div>
                <div>
                  <dt>{english ? "Your share per block" : "Sua parte por bloco"}</dt>
                  <dd>
                    {formatAtomic(estimate, pool.decimals)} {pool.symbol}
                  </dd>
                </div>
              </dl>
              <div className="pool-compact-estimate">
                <span>{english ? "10-minute block" : "Bloco de 10 min"}</span>
                <strong>{formatAtomic(BigInt(network.blockRewardAtomic[pool.id]), pool.decimals)} {pool.symbol}</strong>
                <small>{english ? "24h estimate" : "Estimativa em 24h"}: {formatAtomic(dailyEstimate, pool.decimals)} {pool.symbol}</small>
              </div>
              <div className="pool-allocation-control">
                <label htmlFor={`allocation-${pool.id}`}>
                  <span>{english ? "ALLOCATION" : "ALOCAÇÃO"}</span>
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
                    aria-label={`${english ? "Decrease allocation for" : "Diminuir alocação de"} ${pool.symbol}`}
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
                    aria-label={`${english ? "Percentage allocated to" : "Percentual alocado em"} ${pool.symbol}`}
                  />
                  <span>%</span>
                  <button
                    type="button"
                    onClick={() => setAllocation(pool.id, allocation + 1)}
                    disabled={allocation === 100}
                    aria-label={`${english ? "Increase allocation for" : "Aumentar alocação de"} ${pool.symbol}`}
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
          <span>{english ? "TOTAL EFFECTIVE POWER" : "PODER EFETIVO TOTAL"}</span>
          <strong>{formatPower(installedPower + Math.max(0, temporaryPowerGh))}</strong>
          <small>
            {formatPower(installedPower)} {english ? "miners" : "mineradores"} + {formatPower(Math.max(0, temporaryPowerGh))} minigames
          </small>
          <small className={hasUnsavedChanges ? "allocation-save-status is-dirty" : "allocation-save-status"}>
            {hasUnsavedChanges
              ? english
                ? "Changes are local until you apply them."
                : "As mudanças ficam locais até você aplicar."
              : english
                ? "Saved on the server."
                : "Salvo no servidor."}
          </small>
        </div>
        <button
          type="button"
          disabled={saving || totalAllocation !== 100}
          onClick={() => onApplyAllocations(draft)}
        >
          {saving
            ? english
              ? "SAVING..."
              : "SALVANDO..."
            : english
              ? "APPLY ALLOCATION"
              : "APLICAR DISTRIBUIÇÃO"}
        </button>
      </div>

      <details className="pool-rule-note">
        <summary>{english ? "How is the reward calculated?" : "Como a recompensa é calculada?"}</summary>
        <p>{english
          ? "The server closes a fixed block for each network every 10 minutes and divides it proportionally to energized power. The estimate may change as other players update their allocations."
          : "O servidor fecha um bloco fixo por rede a cada 10 minutos e divide esse bloco proporcionalmente ao poder energizado. A estimativa pode variar conforme outros jogadores mudam a alocação."}</p>
      </details>
    </section>
  );
}

function MinerMergeManager({
  minerInventory,
  partsInventory,
  cmaBalance,
  locale,
  mode,
  onModeChange,
  modeLabels,
  onMergeMiner,
}: {
  minerInventory: MinerUnit[];
  partsInventory: PublicGameState["partsInventory"];
  cmaBalance: number;
  locale: "pt-BR" | "en" | "es";
  mode: "miners" | "parts";
  onModeChange: (mode: "miners" | "parts") => void;
  modeLabels: { miners: string; parts: string };
  onMergeMiner: (minerAId: string, minerBId: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const copy = locale === "en"
    ? { eyebrow: "MANAGER · MINER MERGE", title: "Fuse identical miners", description: "Select a model on the left, review every requirement in the center and confirm only when the server marks it ready.", empty: "No two identical miners are available yet.", select: "AVAILABLE MINERS", parts: "PARTS", fee: "FEE", ready: "READY", missing: "MISSING", merge: "MERGE TWO", max: "MAX LEVEL", result: "RESULT", after: "POWER AFTER MERGE", inventory: "PARTS INVENTORY" }
    : locale === "es"
      ? { eyebrow: "MANAGER · FUSIÓN DE MINEROS", title: "Fusiona mineros idénticos", description: "Elige un modelo a la izquierda, revisa los requisitos en el centro y confirma cuando el servidor lo marque como listo.", empty: "Aún no hay dos mineros idénticos disponibles.", select: "MINEROS DISPONIBLES", parts: "PIEZAS", fee: "COSTE", ready: "LISTO", missing: "FALTA", merge: "FUSIONAR DOS", max: "NIVEL MÁXIMO", result: "RESULTADO", after: "PODER TRAS LA FUSIÓN", inventory: "INVENTARIO DE PIEZAS" }
      : { eyebrow: "MANAGER · FUSÃO DE MINERADORES", title: "Funda mineradores idênticos", description: "Escolha um modelo à esquerda, confira os requisitos no centro e confirme quando o servidor marcar como pronto.", empty: "Ainda não há dois mineradores idênticos disponíveis.", select: "MINERADORES DISPONÍVEIS", parts: "PEÇAS", fee: "CUSTO", ready: "PRONTO", missing: "FALTA", merge: "FUNDIR DOIS", max: "NÍVEL MÁXIMO", result: "RESULTADO", after: "PODER APÓS A FUSÃO", inventory: "INVENTÁRIO DE PEÇAS" };

  const groups = useMemo(() => {
    const grouped = new Map<string, MinerUnit[]>();
    for (const unit of minerInventory) {
      const key = `${unit.minerId}:${normalizeMinerLevel(unit.level)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), unit]);
    }
    return [...grouped.entries()]
      .map(([key, units]) => ({ key, units, miner: getMiner(units[0].minerId) }))
      .filter((group): group is { key: string; units: MinerUnit[]; miner: NonNullable<ReturnType<typeof getMiner>> } => Boolean(group.miner));
  }, [minerInventory]);

  const selected = groups.find((group) => group.key === selectedKey) ?? groups[0];
  const level = selected ? normalizeMinerLevel(selected.units[0].level) : 1;
  const requirement = selected ? getMinerMergeRequirement(level) : null;
  const partRows = requirement
    ? partFamilies.map((family) => ({ family, required: requirement.partRequirements[family.id], count: partsInventory[partKey(family.id, requirement.partRarity)] ?? 0 }))
    : [];
  const hasParts = Boolean(requirement && partRows.every((row) => row.count >= row.required * batchSize));
  const hasCma = Boolean(requirement && cmaBalance >= requirement.feeCma * batchSize);
  const canMerge = Boolean(selected && requirement && selected.units.length >= 2 * batchSize && hasParts && hasCma);
  const missingParts = partRows.reduce((sum, row) => sum + Math.max(0, row.required * batchSize - row.count), 0);
  const partTotals = partRarities.map((rarity) => ({
    ...rarity,
    count: partFamilies.reduce((sum, family) => sum + (partsInventory[partKey(family.id, rarity.id)] ?? 0), 0),
  }));

  return (
    <section className="merge-center" aria-labelledby="miner-merge-title">
      <div className="merge-center-heading"><div><span className="eyebrow">{copy.eyebrow}</span><h3 id="miner-merge-title">{copy.title}</h3><p>{copy.description}</p></div><strong className="merge-center-rule">2 → 1 · 32 básicos = C6</strong></div>
      <div className="merge-inventory-strip"><span>{copy.inventory}</span>{partTotals.map((part) => <b className={`rarity-chip ${part.id}`} key={part.id}>{part.label} <em>{part.count.toLocaleString()}</em></b>)}</div>
      <div className="merge-center-layout">
          <aside className="merge-col merge-selection"><div className="merge-mode-switch" role="tablist" aria-label="Merge type"><button type="button" role="tab" aria-selected={mode === "miners"} className={mode === "miners" ? "active" : ""} onClick={() => onModeChange("miners")}><span aria-hidden="true">⚙</span>{modeLabels.miners}</button><button type="button" role="tab" aria-selected={mode === "parts"} className={mode === "parts" ? "active" : ""} onClick={() => onModeChange("parts")}><span aria-hidden="true">⌘</span>{modeLabels.parts}</button></div><header><span className="eyebrow">{copy.select}</span><strong>{groups.length}</strong></header><div className="merge-selection-list">{groups.map(({ key, units, miner }) => { const itemLevel = normalizeMinerLevel(units[0].level); return <button type="button" className={key === selected?.key ? "selected" : ""} key={key} onClick={() => setSelectedKey(key)}><span className="merge-selection-art"><img src={miner.asset} alt="" /><b>{getMinerLevelCode(itemLevel)}</b></span><span><strong>{miner.name}</strong><small>{getMinerLevelName(itemLevel, locale)} · {units.length}x</small></span></button>; })}</div></aside>
          <div className="merge-col merge-recipe"><header><span className="eyebrow">{selected ? `${copy.parts} · ${getMinerLevelName(level, locale)}` : copy.parts}</span><h4>{selected?.miner.name ?? "—"}</h4></header>{selected && requirement ? <><div className="merge-recipe-preview"><span className="merge-art-wrap"><img data-miner-family={minerVisualFamily(selected.miner)} src={selected.miner.asset} alt={selected.miner.alt} /><b>{getMinerLevelCode(level)}</b></span><strong>2 {selected.miner.name} <small>→ C{requirement.targetLevel}</small></strong></div><div className="merge-recipe-list"><div className={selected.units.length >= 2 * batchSize ? "ok" : "missing"}><span>◈ {selected.miner.name}</span><b>{Math.min(selected.units.length, 2 * batchSize)} / {2 * batchSize}</b></div>{partRows.map((row) => <div className={row.count >= row.required ? "ok" : "missing"} key={row.family.id}><span>▣ {row.family.label} · {requirement.partRarity}</span><b>{Math.min(row.count, row.required * batchSize)} / {row.required * batchSize}</b></div>)}<div className={hasCma ? "ok" : "missing"}><span>◉ CMA</span><b>{formatCma(cmaBalance)} / {formatCma(requirement.feeCma * batchSize)}</b></div></div><div className="merge-batch-controls"><span>{copy.batch || "LOTE DE FUSÃO"}</span><div className="quantity-picker"><button type="button" onClick={() => setBatchSize(Math.max(1, batchSize - 1))} disabled={batchSize <= 1}>-</button><strong>{batchSize}</strong><button type="button" onClick={() => setBatchSize(batchSize + 1)} disabled={batchSize >= Math.floor(selected.units.length / 2)}>+</button></div></div><p className="merge-recipe-hint">{hasParts && hasCma && selected.units.length >= 2 * batchSize ? copy.ready : `${copy.missing} ${missingParts} ${copy.parts.toLowerCase()}`}</p><button type="button" className="primary-action merge-submit" disabled={!canMerge || pending !== null} onClick={() => { if (!canMerge || !selected.units[0] || !selected.units[1]) return; setPending(selected.key); void onMergeMiner(selected.units[0].instanceId, selected.units[1].instanceId, batchSize).finally(() => setPending(null)); }}>{pending === selected.key ? "..." : copy.merge}<small>{formatCma(requirement.feeCma * batchSize)} CMA</small></button></> : <p className="merge-empty">{groups.length === 0 ? copy.empty : copy.max}</p>}</div>
          <aside className="merge-col merge-result"><span className="eyebrow">{copy.result}</span>{selected && requirement ? <><div className="merge-result-art"><img data-miner-family={minerVisualFamily(selected.miner)} src={selected.miner.asset} alt={selected.miner.alt} /><b>{getMinerLevelCode(requirement.targetLevel)}</b></div><h4>{selected.miner.name}</h4><strong className="merge-result-level">{getMinerLevelName(requirement.targetLevel, locale)} · C{requirement.targetLevel}</strong><span>{copy.after}</span><strong className="merge-result-power">{formatPower(getMergedMinerPowerAtLevel(selected.miner.powerGh, requirement.targetLevel))}</strong></> : <p className="merge-empty">{copy.max}</p>}</aside>
        </div>
    </section>
  );
}

function ForgeView({
  minerInventory,
  partsInventory,
  cmaBalance,
  locale,
  onMergeMiner,
  onMergePart,
}: {
  minerInventory: MinerUnit[];
  partsInventory: PublicGameState["partsInventory"];
  cmaBalance: number;
  locale: "pt-BR" | "en" | "es";
  onMergeMiner: (minerAId: string, minerBId: string) => Promise<void>;
  onMergePart: (family: PartFamily, rarity: PartRarity) => Promise<void>;
}) {
  const [mode, setMode] = useState<"miners" | "parts">("miners");
  const copy = locale === "en"
    ? {
        eyebrow: "ARCADIA WORKSHOP · MERGE ONLY",
        title: "Upgrade your operation",
        description: "Combine identical miners or matching parts. The required quantity scales by rarity (50 → 25 → 10 → 5). Crafting is disabled for this test phase.",
        miners: "MINER MERGE",
        parts: "PART MERGE",
      }
    : locale === "es"
      ? {
          eyebrow: "TALLER ARCADIA · SOLO FUSIÓN",
          title: "Mejora tu operación",
          description: "Combina mineros idénticos o piezas iguales. La cantidad requerida baja por rareza (50 → 25 → 10 → 5). La creación está desactivada durante esta fase de pruebas.",
          miners: "FUSIÓN DE MINEROS",
          parts: "FUSIÓN DE PIEZAS",
        }
      : {
          eyebrow: "OFICINA ARCADIA · SOMENTE FUSÃO",
          title: "Evolua sua operação",
        description: "Junte mineradores idênticos ou peças iguais. A quantidade necessária cai por raridade (50 → 25 → 10 → 5). A criação fica desativada nesta fase de testes.",
          miners: "FUSÃO DE MINERADORES",
          parts: "FUSÃO DE PEÇAS",
        };

  return (
    <section className="arcadia-workshop" aria-labelledby="arcadia-workshop-title">
      <header className="arcadia-workshop-hero">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2 id="arcadia-workshop-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="arcadia-workshop-rule">
          <strong>2 → 1</strong>
          <span>ou 5 → 1</span>
        </div>
      </header>

      {mode === "miners" ? (
        <MinerMergeManager
          minerInventory={minerInventory}
          partsInventory={partsInventory}
          cmaBalance={cmaBalance}
          locale={locale}
          mode={mode}
          onModeChange={setMode}
          modeLabels={{ miners: copy.miners, parts: copy.parts }}
          onMergeMiner={onMergeMiner}
        />
      ) : (
        <PartsLab
          partsInventory={partsInventory}
          cmaBalance={cmaBalance}
          locale={locale}
          mode={mode}
          onModeChange={setMode}
          modeLabels={{ miners: copy.miners, parts: copy.parts }}
          onMergePart={onMergePart}
        />
      )}
    </section>
  );
}

function InventoryView({
  minerInventory,
  installedMiners,
  installedRackCount,
  rackInventoryCount,
  partsInventory,
  locale,
  onOpenRack,
  onOpenForge,
  onOpenStore,
}: {
  minerInventory: MinerUnit[];
  installedMiners: InstalledMiner[];
  installedRackCount: number;
  rackInventoryCount: number;
  partsInventory: PublicGameState["partsInventory"];
  locale: "pt-BR" | "en" | "es";
  onOpenRack: () => void;
  onOpenForge: () => void;
  onOpenStore: (category: ShopCategory) => void;
}) {
  const [section, setSection] = useState<"miners" | "racks" | "parts">("miners");
  // Keep the inventory's localized aria labels in the same scope as the
  // rendered cards. Without this declaration, opening the inventory throws
  // `ReferenceError: english is not defined` during render.
  const english = locale !== "pt-BR";
  const totalParts = Object.values(partsInventory).reduce((sum, value) => sum + value, 0);

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
          <button className="primary-action" type="button" onClick={onOpenForge}>
            ABRIR OFICINA
          </button>
          <button className="primary-action" type="button" onClick={onOpenRack}>
            GERENCIAR RACK
          </button>
          <button type="button" onClick={() => onOpenStore("miners")}>
            ABRIR LOJA
          </button>
        </div>
      </div>

      <nav className="inventory-tabs" aria-label="Seções do inventário">
        <button
          type="button"
          className={section === "miners" ? "active" : ""}
          onClick={() => setSection("miners")}
        >
          <span>⚙</span> MINERADORES <b>{minerInventory.length + installedMiners.length}</b>
        </button>
        <button
          type="button"
          className={section === "racks" ? "active" : ""}
          onClick={() => setSection("racks")}
        >
          <span>▤</span> RACKS <b>{installedRackCount + rackInventoryCount}</b>
        </button>
        <button
          type="button"
          className={section === "parts" ? "active" : ""}
          onClick={() => setSection("parts")}
        >
          <span>⌘</span> PEÇAS <b>{totalParts}</b>
        </button>
      </nav>

      {section === "miners" && (
        <>
          <div className="inventory-grid">
        {miners.map((miner) => {
          const availableCount = minerInventory.filter(
            (unit) => unit.minerId === miner.id,
          ).length;
          const installedCount = installedMiners.filter(
            (unit) => unit.minerId === miner.id,
          ).length;
          const ownedCount = availableCount + installedCount;
          const ownedLevels = [
            ...minerInventory
              .filter((unit) => unit.minerId === miner.id)
              .map((unit) => normalizeMinerLevel(unit.level)),
            ...installedMiners
              .filter((unit) => unit.minerId === miner.id)
              .map((unit) => normalizeMinerLevel(unit.level)),
          ];
          const highestLevel = Math.max(1, ...ownedLevels);

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
                <b
                  className="inventory-miner-level-badge"
                  aria-label={`${english ? "Miner level" : "Nível do minerador"} ${highestLevel}`}
                >
                  {getMinerLevelCode(highestLevel)}
                </b>
                <img data-miner-family={minerVisualFamily(miner)} src={miner.asset} alt={miner.alt} />
                <b className="owned-badge">VOCÊ TEM · {ownedCount}</b>
              </div>
              <div className="inventory-info">
                <span>
                  {miner.fanCount} {miner.fanCount === 1 ? "FAN" : "FANS"}
                </span>
                <div className="inventory-miner-name-row">
                  <h3>{miner.name}</h3>
                  <span className="miner-level-pill">
                    {getMinerLevelCode(highestLevel)} · {getMinerLevelName(highestLevel, locale)}
                  </span>
                </div>
                <div className="inventory-stats">
                  <p>
                    <small>PODER · NÍVEL {highestLevel}</small>
                    <strong>{formatPower(getMergedMinerPowerAtLevel(miner.powerGh, highestLevel))}</strong>
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
        </>
      )}

      {section === "racks" && (
        <div className="inventory-racks-panel">
          <article className="inventory-collection-card">
            <div className="inventory-collection-art">
              <img src={assetsManifest.rackBasic.path} alt="Rack básico" />
            </div>
            <div>
              <span className="eyebrow">INFRAESTRUTURA DA SALA</span>
              <h3>Racks Arcadia</h3>
              <p>
                {installedRackCount} instalado(s) na sala e {rackInventoryCount} disponível(is) para instalação.
              </p>
              <div className="inventory-collection-actions">
                <button type="button" className="primary-action" onClick={onOpenRack}>GERENCIAR RACKS</button>
                <button type="button" onClick={() => onOpenStore("racks")}>COMPRAR RACK</button>
              </div>
            </div>
          </article>
          <article className="inventory-collection-note">
            <strong>ORGANIZAÇÃO</strong>
            <span>Abra a sala para instalar, mover ou retirar mineradores sem sair do inventário.</span>
          </article>
        </div>
      )}

      {section === "parts" && (
        <InventoryPartsPanel
          partsInventory={partsInventory}
          locale={locale}
          onOpenForge={onOpenForge}
        />
      )}
    </section>
  );
}

function InventoryPartsPanel({
  partsInventory,
  locale,
  onOpenForge,
}: {
  partsInventory: PublicGameState["partsInventory"];
  locale: "pt-BR" | "en" | "es";
  onOpenForge: () => void;
}) {
  const familyLabels: Record<PartFamily, string> = locale === "en"
    ? { cable: "Power Unit", hashboard: "Hashboard", fan: "Fan" }
    : locale === "es"
      ? { cable: "Fuente", hashboard: "Placa", fan: "Ventilador" }
      : { cable: "Fonte", hashboard: "Placa", fan: "Ventoinha" };

  return (
    <div className="inventory-parts-panel">
      <div className="inventory-parts-heading">
        <div>
          <span className="eyebrow">MANAGER · COMPONENTES DE PROGRESSÃO</span>
          <h3>Manager de peças</h3>
          <p>Organize seus componentes por família e raridade. Nesta etapa, o Manager trabalha apenas com fusões.</p>
        </div>
        <button type="button" className="primary-action" onClick={onOpenForge}>
          ABRIR OFICINA
        </button>
      </div>
      <div className="inventory-parts-grid">
        {partFamilies.map((family) => {
          const total = partRarities.reduce(
            (sum, rarity) => sum + (partsInventory[partKey(family.id, rarity.id)] ?? 0),
            0,
          );
          return (
            <article className="inventory-part-family" key={family.id}>
              <img src={partAssetPath(family.id, "common")} alt="" />
              <div>
                <span className="eyebrow">MATERIAL</span>
                <h4>{familyLabels[family.id]}</h4>
                <strong>{total}</strong>
                <small>peça(s) no inventário</small>
              </div>
            </article>
          );
        })}
      </div>
      <p className="inventory-parts-note">As fusões de peças ficam na Oficina Arcadia, com validação do servidor e custo em CMA.</p>
    </div>
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

function CrateRewardDetails({
  title,
  rewards,
}: {
  title: string;
  rewards: readonly { id: string; label: string }[];
}) {
  return (
    <details className="crate-reward-details">
      <summary aria-label={title} title={title}>
        <span aria-hidden="true">i</span>
      </summary>
      <div className="crate-reward-popover" role="dialog" aria-label={title}>
        <strong>{title}</strong>
        <ul>
          {rewards.map((reward) => (
            <li key={reward.id}>{reward.label}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function PartsLab({
  partsInventory,
  cmaBalance,
  locale,
  mode,
  onModeChange,
  modeLabels,
  onMergePart,
}: {
  partsInventory: PublicGameState["partsInventory"];
  cmaBalance?: number;
  locale: "pt-BR" | "en" | "es";
  mode: "miners" | "parts";
  onModeChange: (mode: "miners" | "parts") => void;
  modeLabels: { miners: string; parts: string };
  onMergePart: (family: PartFamily, rarity: PartRarity) => Promise<void>;
}) {
  const copy = {
    "pt-BR": {
      eyebrow: "MANAGER · FUSÃO DE PEÇAS",
      title: "Funda peças por raridade",
      description: "Escolha uma peça à esquerda, veja a receita no centro e confirme quando houver material e CMA suficientes.",
      inventory: "INVENTÁRIO",
      merge: "FUNDIR",
      max: "MÁXIMO",
      fee: "custo",
      noParts: "Nenhuma peça desta raridade ainda.",
      source: "MATERIAL",
      select: "PEÇAS DISPONÍVEIS",
      result: "RESULTADO",
      ready: "PRONTO",
      missing: "FALTA",
    },
    en: {
      eyebrow: "MANAGER · PART MERGE",
      title: "Merge parts by rarity",
      description: "Select a part on the left, review the recipe in the center and confirm when materials and CMA are ready.",
      inventory: "INVENTORY",
      merge: "MERGE",
      max: "MAX",
      fee: "fee",
      noParts: "No parts at this rarity yet.",
      source: "MATERIAL",
      select: "AVAILABLE PARTS",
      result: "RESULT",
      ready: "READY",
      missing: "MISSING",
    },
    es: {
      eyebrow: "MANAGER · FUSIÓN DE PIEZAS",
      title: "Fusiona piezas por rareza",
      description: "Elige una pieza a la izquierda, revisa la receta en el centro y confirma cuando haya materiales y CMA suficientes.",
      inventory: "INVENTARIO",
      merge: "FUSIONAR",
      max: "MÁXIMO",
      fee: "coste",
      noParts: "Aún no tienes piezas de esta rareza.",
      source: "MATERIAL",
      select: "PIEZAS DISPONIBLES",
      result: "RESULTADO",
      ready: "LISTO",
      missing: "FALTA",
    },
  }[locale];
  const rarityLabel = (rarity: PartRarity) =>
    locale === "en"
      ? { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" }[rarity]
      : locale === "es"
        ? { common: "Común", uncommon: "Inusual", rare: "Rara", epic: "Épica", legendary: "Legendaria" }[rarity]
        : { common: "Comum", uncommon: "Incomum", rare: "Raro", epic: "Épico", legendary: "Lendário" }[rarity];
      const familyLabel = (family: PartFamily) =>
    locale === "en"
      ? { cable: "Power Unit", hashboard: "Hashboard", fan: "Fan" }[family]
      : locale === "es"
        ? { cable: "Fuente", hashboard: "Placa", fan: "Ventilador" }[family]
        : { cable: "Fonte", hashboard: "Placa", fan: "Ventoinha" }[family];
  const totalParts = Object.values(partsInventory).reduce((sum, value) => sum + value, 0);
  const [mergePending, setMergePending] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const options = useMemo(
    () => partFamilies.flatMap((family) => partRarities.filter((rarity) => rarity.id !== "legendary").map((rarity) => ({ family, rarity, key: partKey(family.id, rarity.id) }))),
    [],
  );
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];
  const selectedCount = selected ? partsInventory[selected.key] ?? 0 : 0;
  const nextRarity = selected ? partRarities.find((item) => item.order === selected.rarity.order + 1) : null;
  const required = selected ? getPartMergeCount(selected.rarity.id) * batchSize : 0;
  const fee = selected ? partMergeFee(selected.rarity.id) * batchSize : 0;
  const canMerge = Boolean(selected && nextRarity && selectedCount >= required && (cmaBalance === undefined || cmaBalance >= fee));
  const partTotals = partRarities.map((rarity) => ({
    ...rarity,
    count: partFamilies.reduce((sum, family) => sum + (partsInventory[partKey(family.id, rarity.id)] ?? 0), 0),
  }));

  async function merge(family: PartFamily, rarity: PartRarity, quantity: number) {
    const id = `${family}:${rarity}`;
    if (mergePending) return;
    setMergePending(id);
    try {
      await onMergePart(family, rarity, quantity);
    } finally {
      setMergePending(null);
    }
  }

  return (
    <section className="merge-center parts-merge-center">
      <div className="merge-center-heading"><div><span className="eyebrow">{copy.eyebrow}</span><h3>{copy.title}</h3><p>{copy.description}</p></div><strong className="merge-center-rule">50 → 25 → 10 → 5</strong></div>
      <div className="merge-inventory-strip"><span>{copy.inventory} · {totalParts.toLocaleString()}</span>{partTotals.map((part) => <b className={`rarity-chip ${part.id}`} key={part.id}>{part.label} <em>{part.count.toLocaleString()}</em></b>)}</div>
      <div className="merge-center-layout">
         <aside className="merge-col merge-selection"><div className="merge-mode-switch" role="tablist" aria-label="Merge type"><button type="button" role="tab" aria-selected={mode === "miners"} className={mode === "miners" ? "active" : ""} onClick={() => onModeChange("miners")}><span aria-hidden="true">⚙</span>{modeLabels.miners}</button><button type="button" role="tab" aria-selected={mode === "parts"} className={mode === "parts" ? "active" : ""} onClick={() => onModeChange("parts")}><span aria-hidden="true">⌘</span>{modeLabels.parts}</button></div><header><span className="eyebrow">{copy.select}</span><strong>{options.length}</strong></header><div className="merge-selection-list">{options.map((option) => { const count = partsInventory[option.key] ?? 0; return <button type="button" className={option.key === selected?.key ? "selected" : ""} key={option.key} onClick={() => setSelectedKey(option.key)}><span className={`merge-selection-art part-art ${option.rarity.id}`}><img src={partAssetPath(option.family.id, option.rarity.id)} alt="" /></span><span><strong>{familyLabel(option.family.id)}</strong><small>{rarityLabel(option.rarity.id)} · {count.toLocaleString()}</small></span></button>; })}</div></aside>
        <div className="merge-col merge-recipe"><header><span className="eyebrow">{selected ? `${familyLabel(selected.family.id)} · ${rarityLabel(selected.rarity.id)}` : copy.inventory}</span><h4>{selected ? `${copy.merge} ${rarityLabel(selected.rarity.id)}` : "—"}</h4></header>{selected && nextRarity ? <><div className="merge-recipe-preview"><span className={`merge-art-wrap part-art ${selected.rarity.id}`}><img src={partAssetPath(selected.family.id, selected.rarity.id)} alt="" /></span><strong>{required} {familyLabel(selected.family.id)} <small>→ {batchSize} {rarityLabel(nextRarity.id)}</small></strong></div><div className="merge-recipe-list"><div className={selectedCount >= required ? "ok" : "missing"}><span>▣ {rarityLabel(selected.rarity.id)}</span><b>{Math.min(selectedCount, required)} / {required}</b></div><div className={cmaBalance === undefined || cmaBalance >= fee ? "ok" : "missing"}><span>◉ CMA</span><b>{cmaBalance === undefined ? "—" : `${formatCma(cmaBalance)} / ${formatCma(fee)}`}</b></div></div><div className="merge-batch-controls"><span>{copy.batch || "LOTE DE FUSÃO"}</span><div className="quantity-picker"><button type="button" onClick={() => setBatchSize(Math.max(1, batchSize - 1))} disabled={batchSize <= 1}>-</button><strong>{batchSize}</strong><button type="button" onClick={() => setBatchSize(batchSize + 1)} disabled={batchSize >= Math.floor(selectedCount / (required / Math.max(1, batchSize)))}>+</button></div></div><p className="merge-recipe-hint">{canMerge ? copy.ready : `${copy.missing} ${Math.max(0, required - selectedCount)} ${copy.inventory.toLowerCase()}`}</p><button type="button" className="primary-action merge-submit" disabled={!canMerge || mergePending !== null} onClick={() => void merge(selected.family.id, selected.rarity.id, batchSize)}>{mergePending === selected.key ? "..." : copy.merge}<small>{formatCma(fee)} CMA · {required} {rarityLabel(selected.rarity.id)}</small></button></> : <p className="merge-empty">{copy.max}</p>}</div>
        <aside className="merge-col merge-result"><span className="eyebrow">{copy.result}</span>{selected && nextRarity ? <><div className={`merge-result-art part-art ${nextRarity.id}`}><img src={partAssetPath(selected.family.id, nextRarity.id)} alt="" /><b>{rarityLabel(nextRarity.id)}</b></div><h4>{familyLabel(selected.family.id)}</h4><strong className="merge-result-level">{rarityLabel(selected.rarity.id)} → {rarityLabel(nextRarity.id)}</strong><span>{copy.inventory}</span><strong className="merge-result-power">+{batchSize} {rarityLabel(nextRarity.id)}</strong></> : <p className="merge-empty">{copy.max}</p>}</aside>
      </div>
    </section>
  );
}

function SeasonStore({
  seasonalWalletAmc,
  locale,
  onOpenSeasonBox,
}: {
  seasonalWalletAmc: number;
  locale: "pt-BR" | "en" | "es";
  onOpenSeasonBox: (boxId: SeasonStoreBoxId) => Promise<GameApiResponse | null>;
}) {
  const copy = locale === "en"
    ? {
        eyebrow: "ARCADIA PASS · SEASON 02",
        title: "Season shop",
        description: "Spend temporary AMC earned from the pass on part cases. AMC resets with the season and never becomes withdrawable balance.",
        balance: "SEASON BALANCE",
        reset: "Linked to the active season · resets when the season ends",
        open: "BUY & OPEN",
        insufficient: "INSUFFICIENT AMC",
        opening: "SERVER VALIDATING THE DROP…",
        received: "PARTS SENT TO INVENTORY",
        rewards: "Possible contents",
      }
    : locale === "es"
      ? {
          eyebrow: "ARCADIA PASS · TEMPORADA 02",
          title: "Tienda de temporada",
          description: "Usa el AMC temporal del pase para abrir cajas de piezas. El AMC se reinicia con la temporada y nunca se puede retirar.",
          balance: "SALDO DE TEMPORADA",
          reset: "Vinculado a la temporada activa · se reinicia al terminar",
          open: "COMPRAR Y ABRIR",
          insufficient: "AMC INSUFICIENTE",
          opening: "EL SERVIDOR ESTÁ VALIDANDO EL DROP…",
          received: "PIEZAS ENVIADAS AL INVENTARIO",
          rewards: "Contenido posible",
        }
      : {
          eyebrow: "ARCADIA PASS · TEMPORADA 02",
          title: "Loja da temporada",
          description: "Use o AMC temporário do passe para abrir baús de peças. O AMC é reiniciado com a temporada e nunca vira saldo sacável.",
          balance: "SALDO DA TEMPORADA",
          reset: "Vinculado à temporada ativa · reinicia quando ela termina",
          open: "COMPRAR E ABRIR",
          insufficient: "AMC INSUFICIENTE",
          opening: "O SERVIDOR ESTÁ VALIDANDO O DROP…",
          received: "PEÇAS ENVIADAS AO INVENTÁRIO",
          rewards: "Conteúdo possível",
        };
  const [opening, setOpening] = useState<{
    box: SeasonStoreBoxId;
    phase: "opening" | "revealed";
    result?: SeasonStoreOpening;
  } | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  async function openBox(boxId: SeasonStoreBoxId) {
    if (opening?.phase === "opening") return;
    setStoreError(null);
    setOpening({ box: boxId, phase: "opening" });
    const response = await onOpenSeasonBox(boxId);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const result = response?.actionResult?.seasonStoreBox;
    if (!result) {
      setOpening(null);
      setStoreError("O servidor não confirmou esta abertura. Atualize a loja e tente novamente.");
      return;
    }
    setOpening({ box: boxId, phase: "revealed", result });
  }

  return (
    <div className="season-store">
      <section className="season-store-hero">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
          <small>{copy.reset}</small>
        </div>
        <div className="season-store-wallet">
          <img src={assetsManifest.arcadiaCoin.path} alt="Arcadia Coin" />
          <span>
            <small>{copy.balance}</small>
            <strong>{seasonalWalletAmc.toLocaleString(locale === "en" ? "en-US" : "pt-BR")} {SEASON_CURRENCY_SYMBOL}</strong>
          </span>
        </div>
      </section>

      {opening ? (
        <section className={`season-store-opening ${opening.phase}`} aria-live="polite">
          <img
            src={
              opening.result
                ? partAssetPath(opening.result.family, opening.result.rarity)
                : assetsManifest.arcadiaCoin.path
            }
            alt=""
          />
          <div>
            <span>{opening.phase === "opening" ? copy.opening : copy.received}</span>
            <strong>
              {opening.phase === "opening"
                ? "…"
                : `${opening.result?.quantity.toLocaleString(locale === "en" ? "en-US" : "pt-BR")} ${opening.result?.family} · ${opening.result?.rarity}`}
            </strong>
            {opening.phase === "revealed" ? (
              <button type="button" onClick={() => setOpening(null)}>CONTINUAR</button>
            ) : null}
          </div>
        </section>
      ) : null}
      {storeError ? <p className="store-action-error" role="alert">{storeError}</p> : null}

      <div className="season-store-box-grid">
        {seasonStoreBoxes.map((box) => {
          const canOpen = seasonalWalletAmc >= box.priceAmc;
          const rewardOptions = box.rewardOptions.map((reward) => ({
            id: reward.id,
            label: locale === "en" ? reward.labelEn : locale === "es" ? reward.labelEs : reward.labelPt,
          }));
          return (
            <article className={`season-store-box ${box.id}`} key={box.id}>
              <div className="season-store-box-art">
                <img src={box.imagePath} alt={box.title} />
                <span>{box.id === "mega-parts-case" ? "MEGA" : "COMMON"}</span>
              </div>
              <div className="season-store-box-copy">
                <div className="crate-card-header">
                  <span>{copy.rewards.toUpperCase()}</span>
                  <CrateRewardDetails title={copy.rewards} rewards={rewardOptions} />
                </div>
                <h4>{box.title}</h4>
                <p>{box.description}</p>
                <small>{copy.rewards}: {box.contentsLabel}</small>
                <strong>{box.priceAmc} {SEASON_CURRENCY_SYMBOL}</strong>
                <button type="button" disabled={!canOpen || opening?.phase === "opening"} onClick={() => void openBox(box.id)}>
                  {canOpen ? copy.open : copy.insufficient}
                </button>
              </div>
            </article>
          );
        })}
      </div>

    </div>
  );
}

function MinerOffersView({
  cmaBalance,
  purchases,
  serverTime,
  locale,
  onBuy,
}: {
  cmaBalance: number;
  purchases: Record<string, number>;
  serverTime: number;
  locale: "pt-BR" | "en" | "es";
  onBuy: (offerId: string, quantity: number) => void;
}) {
  // Keep the render pure: the snapshot clock is the source of truth, and a
  // deterministic zero fallback avoids hydration drift before the first tick.
  const offerServerTime = serverTime > 0 ? serverTime : 0;
  const offers = getMinerOffers(offerServerTime);
  const copy = locale === "en"
    ? {
        eyebrow: "LIMITED OFFERS · SEASON MINERS",
        title: "Arcadia flash market",
        description: "A small rotation of pass machines from the previous and current seasons. There is no per-account cap; CMA balance and inventory capacity still protect the economy.",
        noAccountLimit: "No per-account cap",
        purchased: "Bought this rotation",
        power: "Mining power",
        slots: "slots",
        from: "from",
        buy: "BUY OFFER",
        insufficient: "INSUFFICIENT CMA",
        soldOut: "SOLD OUT",
        best: "Best value",
        legacy: "Previous pass",
        current: "Current pass",
        rotation: "Rotates in",
        lot: "Cycle lot",
      }
    : locale === "es"
      ? {
          eyebrow: "OFERTAS LIMITADAS · MINEROS DE TEMPORADA",
          title: "Mercado flash de Arcadia",
          description: "Una rotación pequeña de máquinas del pase anterior y actual. No hay límite por cuenta; el saldo CMA y la capacidad del inventario protegen la economía.",
          noAccountLimit: "Sin límite por cuenta",
          purchased: "Compradas en esta rotación",
          power: "Poder de minería",
          slots: "slots",
          from: "de",
          buy: "COMPRAR OFERTA",
          insufficient: "CMA INSUFICIENTE",
          soldOut: "AGOTADO",
          best: "Mejor valor",
          legacy: "Pase anterior",
          current: "Pase actual",
          rotation: "Cambia en",
          lot: "Lote del ciclo",
        }
      : {
          eyebrow: "OFERTAS LIMITADAS · MINERADORES DE PASSE",
          title: "Mercado flash da Arcadia",
          description: "Uma rotação enxuta de máquinas do passe anterior e atual. Não há limite por conta; o saldo CMA e a capacidade do inventário continuam protegendo a economia.",
          noAccountLimit: "Sem limite por conta",
          purchased: "Compradas nesta rotação",
          power: "Poder de mineração",
          slots: "slots",
          from: "de",
          buy: "COMPRAR OFERTA",
          insufficient: "CMA INSUFICIENTE",
        soldOut: "ESGOTADO",
        best: "Melhor oferta",
        legacy: "Passe anterior",
        current: "Passe atual",
        rotation: "Troca em",
        lot: "Lote do ciclo",
      };

  const remainingMs = Math.max(
    0,
    (offers[0]?.rotationEndsAt ?? 0) - offerServerTime,
  );
  const rotationHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const rotationMinutes = Math.floor(
    (remainingMs % (60 * 60 * 1000)) / (60 * 1000),
  );
  const rotationLabel =
    String(rotationHours) + "h " + String(rotationMinutes).padStart(2, "0") + "m";

  return (
    <section className="miner-offers" aria-labelledby="miner-offers-title">
      <header className="miner-offers-hero">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h3 id="miner-offers-title">{copy.title} <span aria-hidden="true">✨</span></h3>
          <p>{copy.description}</p>
          <small className="miner-offers-rotation">
            {copy.rotation}: {rotationLabel} · {copy.lot}: 240 / 96 / 64
          </small>
        </div>
        <div className="miner-offers-balance">
          <img src={assetsManifest.cmaCoin.path} alt="" />
          <span>
            <small>CMA</small>
            <strong>{formatCma(cmaBalance)}</strong>
          </span>
        </div>
      </header>

      <div className="miner-offers-grid">
        {offers.map((offer) => {
          const miner = getMiner(offer.minerId);
          if (!miner) return null;
          const purchased = Math.max(0, purchases[offer.id] ?? 0);
          const canBuy = cmaBalance >= offer.priceCma;
          const badge = locale === "en" ? offer.badgeEn : locale === "es" ? offer.badgeEs : offer.badgePt;
          const description = locale === "en" ? offer.descriptionEn : locale === "es" ? offer.descriptionEs : offer.descriptionPt;
          const tierLabel = offer.tier === "premium" ? copy.best : offer.tier === "basic" ? copy.legacy : copy.current;
          return (
            <article className={`miner-offer-card ${offer.tier}`} key={offer.id}>
              <div className="miner-offer-art">
                <span className="miner-offer-discount">-{offer.discountPercent}%</span>
                <span className="miner-offer-tier">{tierLabel}</span>
                <span className="miner-offer-spark" aria-hidden="true">✦</span>
                <img data-miner-family={minerVisualFamily(miner)} src={miner.asset} alt={miner.alt} />
                <strong>{formatPower(miner.powerGh)}</strong>
              </div>
              <div className="miner-offer-body">
                <div className="miner-offer-kicker">{badge}</div>
                <h4>{miner.name} <small>{getMinerLevelCode(1)}</small></h4>
                <p>{description}</p>
                <dl className="miner-offer-stats">
                  <div><dt>{copy.power}</dt><dd>{formatPower(miner.powerGh)}</dd></div>
                  <div><dt>Raridade</dt><dd>{rarityLabels[miner.rarity]}</dd></div>
                  <div><dt>Espaço</dt><dd>{miner.slotSize} {copy.slots}</dd></div>
                </dl>
                <div className="miner-offer-price">
                  <span>{copy.from} <s>{formatCma(offer.referencePriceCma)} CMA</s></span>
                  <strong>{formatCma(offer.priceCma)} CMA</strong>
                </div>
                <div className="miner-offer-stock">
                  <span>
                    {copy.noAccountLimit} · {copy.purchased}: {purchased} · {copy.lot} {offer.lotSize}
                  </span>
                </div>
                <button type="button" disabled={!canBuy} onClick={() => onBuy(offer.id, 1)}>
                  {!canBuy ? copy.insufficient : copy.buy}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
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
  luckCrateOpenCount,
  seasonalWalletAmc,
  minerOfferPurchases,
  serverTime,
  allowSeasonalShop,
  locale,
  onSetCategory,
  onBuyMiners,
  onBuyMinerOffer,
  onBuyRacks,
  onBuyBatteries,
  onOpenSupplyCrate,
  onOpenLuckCrate,
  onOpenSeasonBox,
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
  luckCrateOpenCount: number;
  seasonalWalletAmc: number;
  minerOfferPurchases: Record<string, number>;
  serverTime: number;
  allowSeasonalShop: boolean;
  locale: "pt-BR" | "en" | "es";
  onSetCategory: (category: ShopCategory) => void;
  onBuyMiners: (minerId: string, quantity: number) => void;
  onBuyMinerOffer: (offerId: string, quantity: number) => void;
  onBuyRacks: (quantity: number) => void;
  onBuyBatteries: (quantity: number) => void;
  onOpenSupplyCrate: (
    crateId: SupplyCrateId,
  ) => Promise<GameApiResponse | null>;
  onOpenLuckCrate: (
    crateId: LuckCrateId,
  ) => Promise<GameApiResponse | null>;
  onOpenSeasonBox: (boxId: SeasonStoreBoxId) => Promise<GameApiResponse | null>;
  onGoToRoom: () => void;
}) {
  const [minerQuantities, setMinerQuantities] = useState<
    Record<string, number>
  >({});
  const [rackQuantity, setRackQuantity] = useState(1);
  const [batteryQuantity, setBatteryQuantity] = useState(1);
  const [crateSection, setCrateSection] = useState<"supply" | "luck" | "season">("supply");
  const [crateOpening, setCrateOpening] = useState<{
    crateId: SupplyCrateId;
    phase: "opening" | "revealed";
    result?: SupplyCrateOpening;
  } | null>(null);
  const [luckCrateOpening, setLuckCrateOpening] = useState<{
    crateId: LuckCrateId;
    phase: "opening" | "revealed";
    result?: LuckCrateOpening;
  } | null>(null);
  const [crateError, setCrateError] = useState<string | null>(null);
  const [luckCrateError, setLuckCrateError] = useState<string | null>(null);

  async function openCrate(crateId: SupplyCrateId) {
    if (crateOpening?.phase === "opening") return;
    setCrateError(null);
    setCrateOpening({ crateId, phase: "opening" });
    const response = await onOpenSupplyCrate(crateId);
    await new Promise((resolve) => window.setTimeout(resolve, 1_150));
    const result = response?.actionResult?.supplyCrate;
    if (!result) {
      setCrateOpening(null);
      setCrateError("O servidor não confirmou esta abertura. Atualize a loja e tente novamente.");
      return;
    }
    setCrateOpening({
      crateId,
      phase: "revealed",
      result,
    });
  }

  async function openLuckCrate(crateId: LuckCrateId) {
    if (luckCrateOpening?.phase === "opening") return;
    setLuckCrateError(null);
    setLuckCrateOpening({ crateId, phase: "opening" });
    const response = await onOpenLuckCrate(crateId);
    await new Promise((resolve) => window.setTimeout(resolve, 1_050));
    const result = response?.actionResult?.luckCrate;
    if (!result) {
      setLuckCrateOpening(null);
      setLuckCrateError("O servidor não confirmou esta abertura. Atualize a loja e tente novamente.");
      return;
    }
    setLuckCrateOpening({ crateId, phase: "revealed", result });
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
        {allowSeasonalShop && (
          <button
            type="button"
            className={activeCategory === "offers" ? "active offers-tab" : "offers-tab"}
            onClick={() => onSetCategory("offers")}
          >
            ✨ {locale === "en" ? "FLASH OFFERS" : locale === "es" ? "OFERTAS FLASH" : "OFERTAS FLASH"}
          </button>
        )}
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
        {allowSeasonalShop && (
          <button
            type="button"
            className={
              activeCategory === "season" ||
              (activeCategory === "crates" && crateSection === "season")
                ? "active"
                : ""
            }
            onClick={() => {
              setCrateSection("season");
              onSetCategory("crates");
            }}
          >
            {locale === "en" ? "SEASON SHOP" : locale === "es" ? "TIENDA DE TEMPORADA" : "LOJA DA TEMPORADA"}
          </button>
        )}
      </nav>

      {allowSeasonalShop && activeCategory === "offers" && (
        <MinerOffersView
          cmaBalance={cmaBalance}
          purchases={minerOfferPurchases}
          serverTime={serverTime}
          locale={locale}
          onBuy={onBuyMinerOffer}
        />
      )}

      {activeCategory === "crates" && (
        <div className="supply-crates-section">
          <nav className="crate-section-tabs" aria-label="Tipos de caixas">
            <button
              type="button"
              className={crateSection === "supply" ? "active" : ""}
              onClick={() => setCrateSection("supply")}
            >
              📦 SUPRIMENTOS
            </button>
            <button
              type="button"
              className={crateSection === "luck" ? "active" : ""}
              onClick={() => setCrateSection("luck")}
            >
              ✦ CAIXAS DA SORTE
            </button>
            {allowSeasonalShop && (
              <button
                type="button"
                className={crateSection === "season" ? "active" : ""}
                onClick={() => setCrateSection("season")}
              >
                ◈ LOJA DA TEMPORADA
              </button>
            )}
          </nav>

          {crateSection === "supply" && <>
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
            className={`luck-crate-opening ${crateOpening.phase}`}
            aria-live="polite"
          >
            <img
              src={supplyCrates.find((crate) => crate.id === crateOpening.crateId)?.imagePath}
              alt=""
            />
            <div>
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
              {crateOpening.phase === "revealed" ? (
                <>
                  <p style={{ margin: 0, color: "#9cabb7", fontSize: "10px" }}>
                    Raridade <b>{crateOpening.result?.reward.rarity.toUpperCase()}</b>
                    {crateOpening.result?.pityTriggered ? " — proteção de azar ativada" : ""}
                  </p>
                  <button type="button" onClick={() => setCrateOpening(null)}>
                    CONTINUAR NA LOJA
                  </button>
                </>
              ) : null}
            </div>
          </section>
        )}
          {crateError ? <p className="store-action-error" role="alert">{crateError}</p> : null}

          <div className="supply-crate-grid">
            {supplyCrates.map((crate) => {
              const pityStreak = cratePityStreaks[crate.id] ?? 0;
              return (
                <article className={`supply-crate-card ${crate.tier}`} key={crate.id}>
                    <div className="supply-crate-card-art">
                    <div className={`supply-crate-visual ${crate.id}`}>
                      <img src={crate.imagePath} alt={crate.name} />
                    </div>
                    <small>{crate.shortName}</small>
                  </div>
                  <div className="supply-crate-card-info">
                    <div className="crate-card-header">
                      <span>CAIXA DE SUPRIMENTOS</span>
                      <CrateRewardDetails
                        title="Possíveis recompensas"
                        rewards={crate.rewards}
                      />
                    </div>
                    <h4>{crate.name}</h4>
                    <p>{crate.description}</p>
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
          </>}

          {crateSection === "luck" && <section className="luck-crates-section">
            <div className="luck-crates-heading">
              <div>
                <span className="eyebrow">MOEDA PRINCIPAL · CMA</span>
                <h3>Caixas da Sorte</h3>
                <p>
                  Use CMA para abrir uma caixa e receber outro prêmio CMA. O AMC
                  continua reservado para recompensas e caixas da temporada.
                </p>
              </div>
              <aside>
                <strong>{cmaBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CMA DISPONÍVEL</strong>
                <span>{luckCrateOpenCount} abertura(s) · prêmios definidos pelo servidor.</span>
              </aside>
            </div>

            {luckCrateOpening ? (
              <section className={`luck-crate-opening ${luckCrateOpening.phase}`} aria-live="polite">
                <img
                  src={luckCrates.find((crate) => crate.id === luckCrateOpening.crateId)?.imagePath}
                  alt=""
                />
                <div>
                  <span>
                    {luckCrateOpening.phase === "opening"
                      ? "ABERTURA VALIDADA PELO SERVIDOR"
                      : "PRÊMIO ADICIONADO AO CMA"}
                  </span>
                  <strong>
                    {luckCrateOpening.phase === "opening"
                      ? "CALCULANDO O PRÊMIO..."
                      : luckCrateOpening.result?.reward.label}
                  </strong>
                  {luckCrateOpening.phase === "revealed" ? (
                    <button type="button" onClick={() => setLuckCrateOpening(null)}>
                      CONTINUAR NA LOJA
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
            {luckCrateError ? <p className="store-action-error" role="alert">{luckCrateError}</p> : null}

            <div className="luck-crate-grid">
              {luckCrates.map((crate) => {
                const canOpen = cmaBalance >= crate.priceCma;
                return (
                  <article className={`luck-crate-card ${crate.id}`} key={crate.id}>
                    <div className="luck-crate-art">
                      <img src={crate.imagePath} alt={crate.name} />
                      <small>{crate.shortName}</small>
                    </div>
                    <div className="luck-crate-info">
                      <div className="crate-card-header">
                        <span>CAIXA DA SORTE · CMA</span>
                        <CrateRewardDetails
                          title="Prêmios possíveis"
                          rewards={crate.rewards}
                        />
                      </div>
                      <h4>{crate.name}</h4>
                      <p>{crate.description}</p>
                      <div className="crate-price">
                        <span>ABERTURA</span>
                        <strong>{crate.priceCma.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CMA</strong>
                      </div>
                      <button
                        type="button"
                        disabled={!canOpen || luckCrateOpening?.phase === "opening"}
                        onClick={() => void openLuckCrate(crate.id)}
                      >
                        {canOpen ? "COMPRAR E ABRIR" : "CMA INSUFICIENTE"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>}

          {allowSeasonalShop && crateSection === "season" && (
            <SeasonStore
              seasonalWalletAmc={seasonalWalletAmc}
              locale={locale}
              onOpenSeasonBox={onOpenSeasonBox}
            />
          )}
        </div>
      )}

      {allowSeasonalShop && activeCategory === "season" && (
        <SeasonStore
          seasonalWalletAmc={seasonalWalletAmc}
          locale={locale}
          onOpenSeasonBox={onOpenSeasonBox}
        />
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
                  <b className="miner-level-chip">{getMinerLevelCode(1)}</b>
                  <img data-miner-family={minerVisualFamily(miner)} src={miner.asset} alt={miner.alt} />
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
  stagingVisuals,
  rackLabel,
  roomName,
  installed,
  minerInventory,
  onInstall,
  onRemove,
  onRemoveAll,
  onClose,
}: {
  stagingVisuals: boolean;
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
  const rackAsset = stagingVisuals
    ? assetsManifest.rackTallStaging
    : assetsManifest.rackBasic;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
      <section
        className={`rack-modal rack-inline-panel ${stagingVisuals ? "rack-inline-panel-staging" : ""}`}
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
              <img src={rackAsset.path} alt="" />
              {installed.map((placement) => {
                const miner = getMiner(placement.minerId);
                if (!miner) return null;
                return (
                  <button
                    type="button"
                    className={`preview-miner corrected size-${miner.slotSize}`}
                    data-rack-art={
                      miner.availability === "season" ? "season" : "standard"
                    }
                    data-miner-family={minerVisualFamily(miner)}
                    key={placement.instanceId}
                    style={minerVisualStyle(
                      miner,
                      rackMinerPosition(
                        placement.slotIndex,
                        miner.slotSize,
                        stagingVisuals,
                        miner.availability === "season",
                      ),
                    )}
                    onClick={() => onRemove(placement.instanceId)}
                    title={`Retirar ${miner.name}`}
                  >
                    <img data-miner-family={minerVisualFamily(miner)} src={miner.asset} alt={miner.alt} />
                    <b className="preview-miner-level-badge">{getMinerLevelCode(placement.level ?? 1)}</b>
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
                      <img data-miner-family={minerVisualFamily(miner)} src={miner.asset} alt="" />
                      <b className="slot-installed-level">
                        {getMinerLevelCode(placement.level ?? 1)}
                      </b>
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
              {miners.flatMap((miner) => {
                // Keep each level selectable. Previously all copies of a model
                // were collapsed into one card and the first unit (usually C1)
                // was always installed, making a freshly merged C2 appear to
                // be missing from the rack manager.
                const levels = Array.from(
                  new Set(
                    minerInventory
                      .filter((unit) => unit.minerId === miner.id)
                      .map((unit) => normalizeMinerLevel(unit.level)),
                  ),
                ).sort((a, b) => a - b);

                return levels.map((level) => {
                  const availableUnits = minerInventory.filter(
                    (unit) =>
                      unit.minerId === miner.id &&
                      normalizeMinerLevel(unit.level) === level,
                  );
                  const nextUnit = availableUnits[0];
                  if (!nextUnit) return null;
                  const possibleSlot =
                    targetSlot === null
                      ? findNextAvailableSlot(installed, miner)
                      : canInstallAt(installed, miner, targetSlot)
                        ? targetSlot
                        : null;

                  return (
                    <article className="rack-miner-card" key={`${miner.id}:C${level}`}>
                      <div className={`mini-rarity ${miner.rarity}`}>
                        {rarityLabels[miner.rarity]} · {getMinerLevelCode(level)}
                      </div>
                      <div className="rack-miner-art">
                        <img data-miner-family={minerVisualFamily(miner)} src={miner.asset} alt={miner.alt} />
                      </div>
                      <div className="rack-miner-data">
                        <span>
                          {miner.fanCount} {miner.fanCount === 1 ? "FAN" : "FANS"}
                        </span>
                        <h3>
                          {miner.name} <small className="miner-level-chip">{getMinerLevelCode(level)}</small>
                        </h3>
                        <p>
                          {formatPower(getMergedMinerPowerAtLevel(miner.powerGh, level))} ·{" "}
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
                });
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
  stagingVisuals,
  cmaBalance,
  purchasePending,
  onChoose,
  onBuy,
  onClose,
}: {
  activeRoomId: RoomId;
  ownedRoomIds: RoomId[];
  stagingVisuals: boolean;
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
            const previewAsset =
              stagingVisuals && room.id === "room-1"
                ? assetsManifest.roomOneStaging
                : stagingVisuals && room.id !== "room-1"
                  ? assetsManifest.roomTwoStaging
                  : null;
            return (
              <article
                className={`room-store-card ${active ? "active" : ""} ${
                  lockedBySequence ? "sequence-locked" : ""
                }`}
                key={room.id}
              >
                <div className="room-preview-image">
                  <img
                    src={previewAsset?.path ?? room.asset}
                    alt={previewAsset?.alt ?? room.alt}
                  />
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
