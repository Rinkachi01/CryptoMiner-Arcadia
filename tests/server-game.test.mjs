import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyGameAction,
  createInitialGameState,
  normalizeBootstrapState,
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

  assert.equal(state.cmaBalance, 2);
  assert.equal(state.btcBalanceAtomic, 0);
  assert.equal(state.dogeBalanceAtomic, 0);
  assert.equal(state.batteryCount, 1);
  assert.equal(state.energyExpiresAt, now + 12 * 60 * 60 * 1000);
  assert.equal(state.lastEnergyClaimAt, now);
  assert.deepEqual(
    state.minerInventory.map((unit) => unit.minerId),
    ["byte-spark"],
  );
  assert.equal(state.racks.length, 1);
  assert.deepEqual(state.rackMiners["rack-01"], []);
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
