import {
  BATTERY_HOURS,
  BATTERY_PRICE_CMA,
  BLOCK_INTERVAL_SECONDS,
  MAX_ENERGY_HOURS,
  RACK_PRICE_CMA,
  ROOM_RACK_CAPACITY,
  calculateEstimatedReward,
  canInstallAt,
  findNextAvailableSlot,
  getInstalledPower,
  getMiner,
  pools,
  type InstalledMiner,
  type PoolId,
} from "./game-rules.ts";
import {
  getSupplyCrate,
  resolveSupplyCrate,
  supplyCrates,
  type SupplyCrateId,
} from "./supply-crate-rules.ts";
import {
  ROOM_COUNT,
  getPreviousRoom,
  getRoomDefinition,
  isRoomId,
  normalizeOwnedRoomIds,
  type RoomId,
} from "./room-rules.ts";

export type { RoomId } from "./room-rules.ts";
export type WalletSymbol = "CMA" | "BTC" | "DOGE";
export type PoolAllocations = Record<PoolId, number>;

export type MinerUnit = {
  instanceId: string;
  minerId: string;
};

export type RackInstance = {
  id: string;
  roomId: RoomId;
  positionIndex: number;
};

export type PublicGameState = {
  selectedPoolId: PoolId;
  poolAllocations: PoolAllocations;
  displayedBalanceSymbol: WalletSymbol;
  cmaBalance: number;
  btcBalanceAtomic: number;
  dogeBalanceAtomic: number;
  batteryCount: number;
  energyExpiresAt: number;
  lastEnergyClaimAt: number;
  lastSettledBlock: number;
  activeRoomId: RoomId;
  ownedRoomIds: RoomId[];
  rackInventoryCount: number;
  minerInventory: MinerUnit[];
  racks: RackInstance[];
  rackMiners: Record<string, InstalledMiner[]>;
  dailyMissionClaims: Record<string, string>;
  crateOpenCount: number;
  cratePityStreaks: Record<SupplyCrateId, number>;
};

export type GameActionName =
  | "sync"
  | "set_wallet_symbol"
  | "set_active_room"
  | "buy_room"
  | "buy_miners"
  | "buy_racks"
  | "buy_batteries"
  | "open_supply_crate"
  | "place_rack"
  | "install_miner"
  | "remove_miner"
  | "remove_all_miners"
  | "apply_allocations"
  | "use_battery"
  | "claim_energy";

export type ActionResult = {
  state: PublicGameState;
  message: string;
  deltaCmaMicros: number;
  metadata: Record<string, unknown>;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const BLOCK_INTERVAL_MS = BLOCK_INTERVAL_SECONDS * 1000;
const MAX_MINER_UNITS = ROOM_COUNT * ROOM_RACK_CAPACITY * 8 + 40;
const MAX_BOOTSTRAP_MINER_UNITS = 80;
const MAX_PURCHASE_QUANTITY = 20;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneState(state: PublicGameState): PublicGameState {
  return JSON.parse(JSON.stringify(state)) as PublicGameState;
}

function getOwnedMinerUnitCount(state: PublicGameState) {
  return (
    state.minerInventory.length +
    Object.values(state.rackMiners).reduce(
      (total, placements) => total + placements.length,
      0,
    )
  );
}

function isWalletSymbol(value: unknown): value is WalletSymbol {
  return value === "CMA" || value === "BTC" || value === "DOGE";
}

function isAllocation(value: unknown): value is PoolAllocations {
  if (!value || typeof value !== "object") return false;
  const allocation = value as Partial<PoolAllocations>;
  const values = [allocation.cma, allocation.btc, allocation.doge];
  return (
    values.every(
      (item) =>
        typeof item === "number" &&
        Number.isInteger(item) &&
        item >= 0 &&
        item <= 100,
    ) && values.reduce((sum, item) => sum + (item ?? 0), 0) === 100
  );
}

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function currentBlock(now: number) {
  return Math.floor(now / BLOCK_INTERVAL_MS);
}

export function createInitialGameState(now: number): PublicGameState {
  return {
    selectedPoolId: "cma",
    poolAllocations: { cma: 100, btc: 0, doge: 0 },
    displayedBalanceSymbol: "CMA",
    cmaBalance: 0,
    btcBalanceAtomic: 0,
    dogeBalanceAtomic: 0,
    batteryCount: 0,
    energyExpiresAt: now,
    lastEnergyClaimAt: now,
    lastSettledBlock: currentBlock(now),
    activeRoomId: "room-1",
    ownedRoomIds: ["room-1"],
    rackInventoryCount: 0,
    minerInventory: [
      {
        instanceId: createId("starter-byte-spark"),
        minerId: "byte-spark",
      },
    ],
    racks: [{ id: "rack-01", roomId: "room-1", positionIndex: 0 }],
    rackMiners: { "rack-01": [] },
    dailyMissionClaims: {},
    crateOpenCount: 0,
    cratePityStreaks: {
      "signal-cache": 0,
      "grid-cache": 0,
      "quantum-cache": 0,
    },
  };
}

export function normalizeBootstrapState(
  value: unknown,
  now: number,
): PublicGameState {
  const initial = createInitialGameState(now);
  if (!value || typeof value !== "object") return initial;
  const candidate = value as Partial<PublicGameState>;

  const ownedRoomIds = normalizeOwnedRoomIds(candidate.ownedRoomIds);

  const racks: RackInstance[] = [];
  const seenRackIds = new Set<string>();
  const seenPositions = new Set<string>();
  if (Array.isArray(candidate.racks)) {
    for (const rawRack of candidate.racks) {
      if (!rawRack || typeof rawRack !== "object") continue;
      const rack = rawRack as Partial<RackInstance>;
      if (
        typeof rack.id !== "string" ||
        !isRoomId(rack.roomId) ||
        !ownedRoomIds.includes(rack.roomId) ||
        typeof rack.positionIndex !== "number" ||
        !Number.isInteger(rack.positionIndex) ||
        rack.positionIndex < 0 ||
        rack.positionIndex >= ROOM_RACK_CAPACITY ||
        seenRackIds.has(rack.id) ||
        seenPositions.has(`${rack.roomId}:${rack.positionIndex}`)
      ) {
        continue;
      }
      seenRackIds.add(rack.id);
      seenPositions.add(`${rack.roomId}:${rack.positionIndex}`);
      racks.push({
        id: rack.id,
        roomId: rack.roomId,
        positionIndex: rack.positionIndex,
      });
    }
  }
  if (racks.length === 0) racks.push(initial.racks[0]);

  const rackMiners: Record<string, InstalledMiner[]> = {};
  const usedUnitIds = new Set<string>();
  let totalUnits = 0;
  const candidateRackMiners =
    candidate.rackMiners && typeof candidate.rackMiners === "object"
      ? candidate.rackMiners
      : {};

  for (const rack of racks) {
    const accepted: InstalledMiner[] = [];
    const placements = candidateRackMiners[rack.id];
    if (Array.isArray(placements)) {
      for (const rawPlacement of placements) {
        if (
          totalUnits >= MAX_BOOTSTRAP_MINER_UNITS ||
          !rawPlacement ||
          typeof rawPlacement !== "object"
        ) {
          continue;
        }
        const placement = rawPlacement as Partial<InstalledMiner>;
        const miner =
          typeof placement.minerId === "string"
            ? getMiner(placement.minerId)
            : undefined;
        if (
          !miner ||
          typeof placement.instanceId !== "string" ||
          usedUnitIds.has(placement.instanceId) ||
          typeof placement.slotIndex !== "number" ||
          !Number.isInteger(placement.slotIndex) ||
          !canInstallAt(accepted, miner, placement.slotIndex)
        ) {
          continue;
        }
        accepted.push({
          instanceId: placement.instanceId,
          minerId: miner.id,
          slotIndex: placement.slotIndex,
        });
        usedUnitIds.add(placement.instanceId);
        totalUnits += 1;
      }
    }
    rackMiners[rack.id] = accepted;
  }

  const minerInventory: MinerUnit[] = [];
  if (Array.isArray(candidate.minerInventory)) {
    for (const rawUnit of candidate.minerInventory) {
      if (
        totalUnits >= MAX_BOOTSTRAP_MINER_UNITS ||
        !rawUnit ||
        typeof rawUnit !== "object"
      ) {
        continue;
      }
      const unit = rawUnit as Partial<MinerUnit>;
      if (
        typeof unit.instanceId !== "string" ||
        typeof unit.minerId !== "string" ||
        !getMiner(unit.minerId) ||
        usedUnitIds.has(unit.instanceId)
      ) {
        continue;
      }
      minerInventory.push({
        instanceId: unit.instanceId,
        minerId: unit.minerId,
      });
      usedUnitIds.add(unit.instanceId);
      totalUnits += 1;
    }
  }

  const poolAllocations = isAllocation(candidate.poolAllocations)
    ? candidate.poolAllocations
    : initial.poolAllocations;
  const selectedPoolId = pools.reduce((largest, pool) =>
    poolAllocations[pool.id] > poolAllocations[largest.id] ? pool : largest,
  ).id;
  const activeRoomId =
    isRoomId(candidate.activeRoomId) &&
    ownedRoomIds.includes(candidate.activeRoomId)
      ? candidate.activeRoomId
      : "room-1";

  return {
    selectedPoolId,
    poolAllocations,
    displayedBalanceSymbol: isWalletSymbol(candidate.displayedBalanceSymbol)
      ? candidate.displayedBalanceSymbol
      : "CMA",
    cmaBalance: safeNumber(candidate.cmaBalance, 86.4, 0, 100),
    btcBalanceAtomic: Math.floor(
      safeNumber(candidate.btcBalanceAtomic, 1284, 0, 1_000_000),
    ),
    dogeBalanceAtomic: Math.floor(
      safeNumber(candidate.dogeBalanceAtomic, 642_000_000, 0, 1_000_000_000_000),
    ),
    batteryCount: Math.floor(
      safeNumber(candidate.batteryCount, 2, 0, 8),
    ),
    energyExpiresAt: safeNumber(
      candidate.energyExpiresAt,
      initial.energyExpiresAt,
      now,
      now + MAX_ENERGY_HOURS * MS_PER_HOUR,
    ),
    lastEnergyClaimAt: safeNumber(
      candidate.lastEnergyClaimAt,
      0,
      0,
      now,
    ),
    lastSettledBlock: currentBlock(now),
    activeRoomId,
    ownedRoomIds,
    rackInventoryCount: Math.floor(
      safeNumber(candidate.rackInventoryCount, 0, 0, 24),
    ),
    minerInventory,
    racks,
    rackMiners,
    dailyMissionClaims: {},
    crateOpenCount: 0,
    cratePityStreaks: {
      "signal-cache": 0,
      "grid-cache": 0,
      "quantum-cache": 0,
    },
  };
}

export function settleMiningBlocks(
  state: PublicGameState,
  now: number,
  temporaryPowerGh = 0,
  networkPowerGh?: Partial<Record<PoolId, number>>,
  blockRewardAtomic?: Partial<Record<PoolId, number>>,
): {
  state: PublicGameState;
  settledBlocks: number;
  rewards: Record<PoolId, number>;
} {
  const next = cloneState(state);
  const targetBlock = currentBlock(now);
  const energyBlock = Math.floor(next.energyExpiresAt / BLOCK_INTERVAL_MS);
  const eligibleBlock = Math.min(targetBlock, energyBlock);
  const settledBlocks = Math.max(0, eligibleBlock - next.lastSettledBlock);
  const rewards: Record<PoolId, number> = { cma: 0, btc: 0, doge: 0 };

  if (settledBlocks > 0) {
    const allInstalled = Object.values(next.rackMiners).flat();
    const installedPower =
      getInstalledPower(allInstalled) + Math.max(0, temporaryPowerGh);

    for (const pool of pools) {
      const allocatedPower = Math.floor(
        (installedPower * next.poolAllocations[pool.id]) / 100,
      );
      const rewardAtomic =
        calculateEstimatedReward(
          pool,
          allocatedPower,
          networkPowerGh?.[pool.id] ?? allocatedPower,
          BigInt(blockRewardAtomic?.[pool.id] ?? Number(pool.rewardAtomic)),
          settledBlocks,
        );
      rewards[pool.id] = Number(rewardAtomic);
    }

    next.cmaBalance += rewards.cma / 1_000_000;
    next.btcBalanceAtomic += rewards.btc;
    next.dogeBalanceAtomic += rewards.doge;
  }

  next.lastSettledBlock = targetBlock;
  return { state: next, settledBlocks, rewards };
}

function requirePositiveInteger(value: unknown, maximum: number) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= maximum
  );
}

function payloadObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function success(
  state: PublicGameState,
  message: string,
  deltaCmaMicros = 0,
  metadata: Record<string, unknown> = {},
): ActionResult {
  return { state, message, deltaCmaMicros, metadata };
}

function normalizedCratePityStreaks(
  state: Pick<PublicGameState, "cratePityStreaks">,
) {
  return Object.fromEntries(
    supplyCrates.map((crate) => [
      crate.id,
      Math.min(
        9,
        Math.max(
          0,
          Math.floor(Number(state.cratePityStreaks?.[crate.id] ?? 0)),
        ),
      ),
    ]),
  ) as Record<SupplyCrateId, number>;
}

export function applySupplyCratePurchase(
  currentState: PublicGameState,
  crateId: SupplyCrateId,
  roll: number,
  now: number,
  temporaryPowerGh = 0,
  networkPowerGh?: Partial<Record<PoolId, number>>,
  blockRewardAtomic?: Partial<Record<PoolId, number>>,
): ActionResult {
  const settled = settleMiningBlocks(
    currentState,
    now,
    temporaryPowerGh,
    networkPowerGh,
    blockRewardAtomic,
  );
  const state = settled.state;
  const crate = getSupplyCrate(crateId);
  if (!crate) throw new Error("Caixa de suprimentos inválida.");
  if (state.cmaBalance < crate.priceCma) {
    throw new Error("Saldo CMA insuficiente para abrir essa caixa.");
  }

  const pityStreaks = normalizedCratePityStreaks(state);
  const opening = resolveSupplyCrate(crate.id, roll, pityStreaks[crate.id]);
  const reward = opening.reward;
  if (
    reward.type === "miner" &&
    getOwnedMinerUnitCount(state) + reward.quantity > MAX_MINER_UNITS
  ) {
    throw new Error(
      "Seu inventário de mineradores está cheio. Libere espaço antes de abrir.",
    );
  }

  state.cmaBalance =
    Math.round((state.cmaBalance - crate.priceCma) * 1_000_000) / 1_000_000;
  state.crateOpenCount = Math.max(0, Math.floor(state.crateOpenCount ?? 0)) + 1;
  const rareOrBetter = ["rare", "epic", "legendary"].includes(reward.rarity);
  state.cratePityStreaks = {
    ...pityStreaks,
    [crate.id]: rareOrBetter ? 0 : Math.min(9, pityStreaks[crate.id] + 1),
  };

  if (reward.type === "battery") {
    state.batteryCount += reward.quantity;
  } else if (reward.type === "rack") {
    state.rackInventoryCount += reward.quantity;
  } else if (reward.type === "miner" && reward.minerId) {
    state.minerInventory.push(
      ...Array.from({ length: reward.quantity }, () => ({
        instanceId: createId(`crate-${reward.minerId}`),
        minerId: reward.minerId as string,
      })),
    );
  }

  return success(
    state,
    `${crate.name} aberta: ${reward.label} enviado ao inventário.`,
    -Math.round(crate.priceCma * 1_000_000),
    {
      settledBlocks: settled.settledBlocks,
      rewards: settled.rewards,
      supplyCrate: {
        ...opening,
        openCount: state.crateOpenCount,
      },
    },
  );
}

export function applyGameAction(
  currentState: PublicGameState,
  action: GameActionName,
  rawPayload: unknown,
  now: number,
  temporaryPowerGh = 0,
  networkPowerGh?: Partial<Record<PoolId, number>>,
  blockRewardAtomic?: Partial<Record<PoolId, number>>,
): ActionResult {
  const settled = settleMiningBlocks(
    currentState,
    now,
    temporaryPowerGh,
    networkPowerGh,
    blockRewardAtomic,
  );
  const state = settled.state;
  const payload = payloadObject(rawPayload);

  if (action === "sync") {
    return success(
      state,
      settled.settledBlocks > 0
        ? `${settled.settledBlocks} bloco(s) processado(s) pelo servidor.`
        : "Estado sincronizado com o servidor.",
      Math.round((settled.rewards.cma / 1_000_000) * 1_000_000),
      { settledBlocks: settled.settledBlocks, rewards: settled.rewards },
    );
  }

  if (action === "set_wallet_symbol") {
    if (!isWalletSymbol(payload.symbol)) {
      throw new Error("Moeda da carteira inválida.");
    }
    state.displayedBalanceSymbol = payload.symbol;
    return success(state, `${payload.symbol} fixada na carteira.`);
  }

  if (action === "set_active_room") {
    if (
      !isRoomId(payload.roomId) ||
      !state.ownedRoomIds.includes(payload.roomId)
    ) {
      throw new Error("Essa sala ainda não pertence à sua conta.");
    }
    state.activeRoomId = payload.roomId;
    return success(state, "Sala ativa atualizada.");
  }

  if (action === "buy_room") {
    const room = getRoomDefinition(payload.roomId);
    if (!room || room.id === "room-1") {
      throw new Error("Sala inválida.");
    }
    if (state.ownedRoomIds.includes(room.id)) {
      state.activeRoomId = room.id;
      return success(state, `${room.name} já pertence à sua conta.`);
    }
    const previousRoom = getPreviousRoom(room.id);
    if (!previousRoom || !state.ownedRoomIds.includes(previousRoom.id)) {
      throw new Error(
        `Desbloqueie ${previousRoom?.name ?? "a sala anterior"} primeiro.`,
      );
    }
    if (state.cmaBalance < room.priceCma) {
      throw new Error("Saldo CMA insuficiente para comprar essa sala.");
    }
    state.cmaBalance -= room.priceCma;
    state.ownedRoomIds.push(room.id);
    state.activeRoomId = room.id;
    return success(
      state,
      `${room.name} desbloqueado com 12 posições gratuitas.`,
      -room.priceCma * 1_000_000,
      {
        priceCma: room.priceCma,
        roomId: room.id,
        roomName: room.name,
        sequence: room.sequence,
      },
    );
  }

  if (action === "buy_miners") {
    if (
      typeof payload.minerId !== "string" ||
      !requirePositiveInteger(payload.quantity, 10)
    ) {
      throw new Error("Compra de minerador inválida.");
    }
    const miner = getMiner(payload.minerId);
    if (!miner) throw new Error("Minerador não encontrado.");
    if (getOwnedMinerUnitCount(state) + payload.quantity > MAX_MINER_UNITS) {
      throw new Error("Limite de equipamentos do inventário atingido.");
    }
    const total = miner.priceCma * payload.quantity;
    if (state.cmaBalance < total) {
      throw new Error("Saldo CMA insuficiente para essa compra.");
    }
    state.cmaBalance -= total;
    state.minerInventory.push(
      ...Array.from({ length: payload.quantity }, () => ({
        instanceId: createId(miner.id),
        minerId: miner.id,
      })),
    );
    return success(
      state,
      `${payload.quantity}x ${miner.name} enviado(s) ao inventário.`,
      -Math.round(total * 1_000_000),
      {
        minerId: miner.id,
        quantity: payload.quantity,
      },
    );
  }

  if (action === "buy_racks") {
    if (!requirePositiveInteger(payload.quantity, MAX_PURCHASE_QUANTITY)) {
      throw new Error("Quantidade de racks inválida.");
    }
    const total = RACK_PRICE_CMA * payload.quantity;
    if (state.cmaBalance < total) {
      throw new Error("Saldo CMA insuficiente para comprar esses racks.");
    }
    state.cmaBalance -= total;
    state.rackInventoryCount += payload.quantity;
    return success(
      state,
      `${payload.quantity} rack(s) enviado(s) ao inventário.`,
      -Math.round(total * 1_000_000),
      { quantity: payload.quantity },
    );
  }

  if (action === "buy_batteries") {
    if (!requirePositiveInteger(payload.quantity, MAX_PURCHASE_QUANTITY)) {
      throw new Error("Quantidade de baterias inválida.");
    }
    const total = BATTERY_PRICE_CMA * payload.quantity;
    if (state.cmaBalance < total) {
      throw new Error("Saldo CMA insuficiente para comprar essas baterias.");
    }
    state.cmaBalance -= total;
    state.batteryCount += payload.quantity;
    return success(
      state,
      `${payload.quantity} bateria(s) enviada(s) ao inventário.`,
      -Math.round(total * 1_000_000),
      { quantity: payload.quantity },
    );
  }

  if (action === "place_rack") {
    if (
      !isRoomId(payload.roomId) ||
      !state.ownedRoomIds.includes(payload.roomId) ||
      typeof payload.positionIndex !== "number" ||
      !Number.isInteger(payload.positionIndex) ||
      payload.positionIndex < 0 ||
      payload.positionIndex >= ROOM_RACK_CAPACITY
    ) {
      throw new Error("Posição de rack inválida.");
    }
    const roomRacks = state.racks.filter(
      (rack) => rack.roomId === payload.roomId,
    );
    if (roomRacks.length >= ROOM_RACK_CAPACITY) {
      throw new Error("Essa sala já atingiu o limite de 12 racks.");
    }
    if (
      roomRacks.some(
        (rack) => rack.positionIndex === payload.positionIndex,
      )
    ) {
      throw new Error("Essa posição já está ocupada.");
    }
    if (state.rackInventoryCount <= 0) {
      throw new Error("Compre um rack antes de instalar.");
    }
    const rackId = createId("rack");
    state.rackInventoryCount -= 1;
    state.racks.push({
      id: rackId,
      roomId: payload.roomId,
      positionIndex: payload.positionIndex,
    });
    state.rackMiners[rackId] = [];
    return success(state, "Rack instalado na posição escolhida.", 0, {
      rackId,
      roomId: payload.roomId,
      positionIndex: payload.positionIndex,
    });
  }

  if (action === "install_miner") {
    if (
      typeof payload.rackId !== "string" ||
      typeof payload.instanceId !== "string"
    ) {
      throw new Error("Instalação inválida.");
    }
    const rack = state.racks.find((item) => item.id === payload.rackId);
    const unitIndex = state.minerInventory.findIndex(
      (item) => item.instanceId === payload.instanceId,
    );
    const unit = state.minerInventory[unitIndex];
    const miner = unit ? getMiner(unit.minerId) : undefined;
    if (!rack || !unit || !miner) {
      throw new Error("Rack ou minerador não encontrado.");
    }
    const installed = state.rackMiners[rack.id] ?? [];
    const requestedSlot =
      typeof payload.slotIndex === "number" &&
      Number.isInteger(payload.slotIndex)
        ? payload.slotIndex
        : findNextAvailableSlot(installed, miner);
    if (
      requestedSlot === null ||
      !canInstallAt(installed, miner, requestedSlot)
    ) {
      throw new Error(
        miner.slotSize === 2
          ? "Esse minerador precisa de dois slots livres na mesma prateleira."
          : "Esse slot não está disponível.",
      );
    }
    installed.push({
      instanceId: unit.instanceId,
      minerId: unit.minerId,
      slotIndex: requestedSlot,
    });
    state.rackMiners[rack.id] = installed;
    state.minerInventory.splice(unitIndex, 1);
    return success(state, `${miner.name} instalado no rack.`, 0, {
      rackId: rack.id,
      instanceId: unit.instanceId,
      slotIndex: requestedSlot,
    });
  }

  if (action === "remove_miner") {
    if (
      typeof payload.rackId !== "string" ||
      typeof payload.instanceId !== "string"
    ) {
      throw new Error("Remoção inválida.");
    }
    const installed = state.rackMiners[payload.rackId] ?? [];
    const placementIndex = installed.findIndex(
      (item) => item.instanceId === payload.instanceId,
    );
    const placement = installed[placementIndex];
    if (!placement) throw new Error("Minerador não encontrado nesse rack.");
    installed.splice(placementIndex, 1);
    state.rackMiners[payload.rackId] = installed;
    state.minerInventory.push({
      instanceId: placement.instanceId,
      minerId: placement.minerId,
    });
    return success(state, "Minerador devolvido ao inventário.", 0, {
      rackId: payload.rackId,
      instanceId: placement.instanceId,
    });
  }

  if (action === "remove_all_miners") {
    if (typeof payload.rackId !== "string") {
      throw new Error("Rack inválido.");
    }
    const installed = state.rackMiners[payload.rackId] ?? [];
    state.minerInventory.push(
      ...installed.map(({ instanceId, minerId }) => ({
        instanceId,
        minerId,
      })),
    );
    state.rackMiners[payload.rackId] = [];
    return success(state, "Todos os mineradores voltaram ao inventário.", 0, {
      rackId: payload.rackId,
      quantity: installed.length,
    });
  }

  if (action === "apply_allocations") {
    if (!isAllocation(payload.allocations)) {
      throw new Error("A distribuição precisa somar exatamente 100%.");
    }
    state.poolAllocations = payload.allocations;
    state.selectedPoolId = pools.reduce((largest, pool) =>
      state.poolAllocations[pool.id] >
      state.poolAllocations[largest.id]
        ? pool
        : largest,
    ).id;
    return success(state, "Distribuição de poder atualizada pelo servidor.", 0, {
      allocations: state.poolAllocations,
    });
  }

  if (action === "use_battery") {
    if (state.batteryCount <= 0) {
      throw new Error("Você não possui baterias.");
    }
    const remaining = Math.max(0, state.energyExpiresAt - now);
    if (remaining >= MAX_ENERGY_HOURS * MS_PER_HOUR) {
      throw new Error("As oito células de energia já estão carregadas.");
    }
    state.batteryCount -= 1;
    state.energyExpiresAt =
      now +
      Math.min(
        MAX_ENERGY_HOURS * MS_PER_HOUR,
        remaining + BATTERY_HOURS * MS_PER_HOUR,
      );
    return success(state, `Bateria utilizada: +${BATTERY_HOURS} horas.`, 0, {
      energyExpiresAt: state.energyExpiresAt,
    });
  }

  if (action === "claim_energy") {
    throw new Error(
      "A recarga gratuita foi desativada. Complete o Tour do Arcade ou compre uma bateria.",
    );
  }

  throw new Error("Ação de jogo não reconhecida.");
}

export function nextBlockAt(now: number) {
  return (currentBlock(now) + 1) * BLOCK_INTERVAL_MS;
}
