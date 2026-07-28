import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateAdminAlerts } from "../app/admin-alert-rules.ts";
import {
  DEFAULT_SIMULATION_INPUT,
  simulateEconomy,
} from "../app/economy-simulator.ts";

const settings = {
  crateAlertCount: 20,
  cratesEnabled: true,
  dailyBatteryEnabled: true,
  minerConcentrationAlertPercent: 45,
  minigamePowerEnabled: true,
  openReviewAlertCount: 3,
  powerAlertGh: 4_000,
  updatedAt: 0,
  updatedBy: null,
};

test("cenário base preserva os números econômicos atuais", () => {
  const result = simulateEconomy(DEFAULT_SIMULATION_INPUT);
  assert.equal(result.progressionDays, 303);
  assert.equal(result.dailyPowerBudgetGh, 5_000);
  assert.equal(result.sinkIndex, 100);
  assert.equal(result.status, "stable");
  assert.equal(result.adjustedCrates[0].priceCma, 0.9);
  assert.equal(result.adjustedMiners[0].priceCma, 0.6);
});

test("simulador identifica progressão rápida e lenta sem aplicar estado", () => {
  const fast = simulateEconomy({
    cratePricePercent: 50,
    minerPricePercent: 50,
    minigamePowerPercent: 150,
    networkDifficultyPercent: 60,
  });
  const slow = simulateEconomy({
    cratePricePercent: 200,
    minerPricePercent: 200,
    minigamePowerPercent: 0,
    networkDifficultyPercent: 240,
  });
  assert.equal(fast.status, "critical");
  assert.equal(slow.status, "slow");
  assert.equal(DEFAULT_SIMULATION_INPUT.minerPricePercent, 100);
});

test("alertas mudam de estável para atenção e crítico pelos limites", () => {
  const alerts = evaluateAdminAlerts(
    {
      crateOpens24h: 20,
      minerConcentrationPercent: 60,
      openReviews: 2,
      powerGranted24h: 5_500,
    },
    settings,
  );
  assert.equal(
    alerts.find((alert) => alert.id === "crate-volume")?.severity,
    "attention",
  );
  assert.equal(
    alerts.find((alert) => alert.id === "miner-concentration")?.severity,
    "critical",
  );
  assert.equal(
    alerts.find((alert) => alert.id === "open-reviews")?.severity,
    "stable",
  );
});

test("exportação da temporada é protegida e somente leitura", async () => {
  const source = await readFile(
    new URL("../app/api/admin/export/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /claimOrVerifyAdminOwner/);
  assert.match(source, /Content-Disposition/);
  assert.match(source, /text\/csv/);
  assert.match(source, /Últimos 30 dias/);
  assert.doesNotMatch(source, /UPDATE game_states|DELETE FROM/i);
});
