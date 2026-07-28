import assert from "node:assert/strict";
import test from "node:test";
import {
  applySupplyCratePurchase,
  createInitialGameState,
} from "../app/game-server.ts";
import {
  SUPPLY_CRATE_PITY_LIMIT,
  resolveSupplyCrate,
  supplyCrates,
} from "../app/supply-crate-rules.ts";

test("todas as caixas publicam probabilidades que fecham em cem por cento", () => {
  for (const crate of supplyCrates) {
    assert.equal(
      crate.rewards.reduce(
        (sum, reward) => sum + reward.chanceBasisPoints,
        0,
      ),
      10_000,
    );
    assert.equal(crate.priceCma > 0, true);
  }
});

test("proteção de azar garante prêmio raro ou superior na décima abertura", () => {
  const result = resolveSupplyCrate(
    "signal-cache",
    0,
    SUPPLY_CRATE_PITY_LIMIT - 1,
  );
  assert.equal(result.pityTriggered, true);
  assert.equal(["rare", "epic", "legendary"].includes(result.reward.rarity), true);
});

test("compra da caixa desconta CMA e credita somente item do jogo", () => {
  const now = 1_800_000_000_000;
  const state = createInitialGameState(now);
  const beforeBalance = state.cmaBalance;
  const beforeBatteries = state.batteryCount;
  const result = applySupplyCratePurchase(
    state,
    "signal-cache",
    0,
    now,
  );

  assert.equal(result.state.cmaBalance, beforeBalance - 0.9);
  assert.equal(result.state.batteryCount, beforeBatteries + 3);
  assert.equal(result.state.crateOpenCount, 1);
  assert.equal(result.deltaCmaMicros, -900_000);
  assert.equal(result.metadata.supplyCrate.reward.type, "battery");
});
