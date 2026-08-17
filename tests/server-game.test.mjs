import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyGameAction,
  createInitialGameState,
  normalizeBootstrapState,
  normalizePoolAllocations,
  settleMiningBlocks,
} from "../app/game-server.ts";

const BLOCK_MS = 10 * 60 * 1000;

test("servidor recusa compra sem saldo e não altera o estado", () => {
  const now = 1_800_000_000_000;
  const state = createInitialGameState(now);
  state.cmaBalance = 0;
  const inventorySize = state.minerInventory.length;

  assert.throws(
    () =>
      applyGameAction(
        state,
        "buy_miners",
        { minerId: "helix-gold", quantity: 1 },
        now,
      ),
    /Saldo CMA insuficiente/i,
  );
  assert.equal(state.cmaBalance, 0);
  assert.equal(state.minerInventory.length, inventorySize);
});

test("alocação precisa fechar em cem por cento", () => {
  const now = 1_800_000_000_000;
  const state = createInitialGameState(now);

  assert.throws(
    () =>
      applyGameAction(
        state,
        "apply_allocations",
        { allocations: { cma: 80, btc: 10, doge: 5 } },
        now,
      ),
    /100%|cem|exatamente/i,
  );
});

test("migra uma distribuição legada de três pools sem voltar para CMA", () => {
  assert.deepEqual(normalizePoolAllocations({ cma: 25, btc: 35, doge: 40 }), {
    cma: 25,
    btc: 35,
    doge: 40,
    ltc: 0,
  });

  const migrated = normalizeBootstrapState(
    {
      poolAllocations: { cma: 100, btc: 0, doge: 0, ltc: 0 },
      gamePoolAllocations: { cma: 25, btc: 35, doge: 40 },
    },
    1_800_000_000_000,
  );
  assert.deepEqual(migrated.poolAllocations, {
    cma: 25,
    btc: 35,
    doge: 40,
    ltc: 0,
  });
});

test("salvar alocação sempre grava o formato completo de quatro pools", () => {
  const now = 1_800_000_000_000;
  const state = createInitialGameState(now);
  const updated = applyGameAction(
    state,
    "apply_allocations",
    { allocations: { cma: 10, btc: 20, doge: 30, ltc: 40 } },
    now,
  ).state;
  assert.deepEqual(updated.poolAllocations, {
    cma: 10,
    btc: 20,
    doge: 30,
    ltc: 40,
  });
});

test("blocos são liquidados pelo relógio do servidor", () => {
  const now = 1_800_000_000_000;
  let state = createInitialGameState(now);
  state = applyGameAction(
    state,
    "install_miner",
    {
      rackId: "rack-01",
      instanceId: state.minerInventory[0].instanceId,
      slotIndex: 0,
    },
    now,
  ).state;
  state.energyExpiresAt = now + 12 * 60 * 60 * 1000;
  state.lastSettledBlock = Math.floor(now / BLOCK_MS);

  const settlement = settleMiningBlocks(state, now + 2 * BLOCK_MS);
  assert.equal(settlement.settledBlocks, 2);
  assert.equal(settlement.state.cmaBalance > state.cmaBalance, true);
  assert.equal(
    settlement.state.lastSettledBlock,
    Math.floor((now + 2 * BLOCK_MS) / BLOCK_MS),
  );
});

test("nova conta recebe somente o kit inicial equilibrado", () => {
  const now = 1_800_000_000_000;
  const state = createInitialGameState(now);

  assert.equal(state.cmaBalance, 0);
  assert.equal(state.btcBalanceAtomic, 0);
  assert.equal(state.dogeBalanceAtomic, 0);
  assert.equal(state.batteryCount, 0);
  assert.equal(state.energyExpiresAt, now);
  assert.equal(state.lastEnergyClaimAt, now);
  assert.deepEqual(state.poolAllocations, {
    cma: 100,
    btc: 0,
    doge: 0,
    ltc: 0,
  });
  assert.deepEqual(
    state.minerInventory.map((unit) => unit.minerId),
    ["byte-spark"],
  );
  assert.equal(state.racks.length, 1);
  assert.deepEqual(state.rackMiners["rack-01"], []);
});

test("energia inicial não pode ser obtida por recarga gratuita", () => {
  const now = 1_800_000_000_000;
  const state = createInitialGameState(now);

  assert.throws(
    () =>
      applyGameAction(
        state,
        "claim_energy",
        {},
        now + 24 * 60 * 60 * 1000,
      ),
    /Tour do Arcade|bateria/i,
  );
  assert.equal(state.energyExpiresAt, now);
  assert.equal(state.batteryCount, 0);
});

test("migração local é limitada antes de entrar no servidor", () => {
  const now = 1_800_000_000_000;
  const migrated = normalizeBootstrapState(
    {
      cmaBalance: 999999,
      batteryCount: 999,
      energyExpiresAt: now + 9999 * 60 * 60 * 1000,
      ownedRoomIds: ["room-1", "room-2", "room-999"],
      dailyMissionClaims: { "arcade-tour": "2099-12-31" },
    },
    now,
  );

  assert.equal(migrated.cmaBalance, 100);
  assert.equal(migrated.batteryCount, 8);
  assert.equal(migrated.ownedRoomIds.includes("room-2"), true);
  assert.deepEqual(migrated.dailyMissionClaims, {});
  assert.equal(
    migrated.energyExpiresAt <= now + 96 * 60 * 60 * 1000,
    true,
  );
});

test("estado inicial não antecipa resgates de missão", () => {
  const state = createInitialGameState(1_800_000_000_000);
  assert.deepEqual(state.dailyMissionClaims, {});
});

test("liquidação de blocos protege contra chamadas concorrentes", async () => {
  const source = await readFile(
    new URL("../app/api/game/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /WHERE account_id = \? AND version = \?/i,
  );
  assert.match(source, /INSERT OR IGNORE INTO ledger_entries/i);
  assert.match(source, /updateResult\.meta\.changes/i);
});
