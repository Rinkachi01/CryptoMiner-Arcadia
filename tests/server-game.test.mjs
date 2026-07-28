import assert from "node:assert/strict";
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
  const state = createInitialGameState(now);
  state.lastSettledBlock = Math.floor(now / BLOCK_MS);

  const settlement = settleMiningBlocks(state, now + 2 * BLOCK_MS);
  assert.equal(settlement.settledBlocks, 2);
  assert.equal(settlement.state.cmaBalance > state.cmaBalance, true);
  assert.equal(
    settlement.state.lastSettledBlock,
    Math.floor((now + 2 * BLOCK_MS) / BLOCK_MS),
  );
});

test("migração local é limitada antes de entrar no servidor", () => {
  const now = 1_800_000_000_000;
  const migrated = normalizeBootstrapState(
    {
      cmaBalance: 999999,
      batteryCount: 999,
      energyExpiresAt: now + 9999 * 60 * 60 * 1000,
      ownedRoomIds: ["room-1", "room-2", "room-999"],
    },
    now,
  );

  assert.equal(migrated.cmaBalance, 100);
  assert.equal(migrated.batteryCount, 8);
  assert.equal(migrated.ownedRoomIds.includes("room-2"), true);
  assert.equal(
    migrated.energyExpiresAt <= now + 96 * 60 * 60 * 1000,
    true,
  );
});
