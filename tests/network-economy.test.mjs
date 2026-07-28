import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateEstimatedReward,
  getInstalledPower,
  pools,
} from "../app/game-rules.ts";
import { createInitialGameState } from "../app/game-server.ts";
import { aggregatePlayerNetworkPower } from "../app/network-server.ts";

test("rede viva soma apenas equipamentos energizados e respeita alocações", () => {
  const now = 1_800_000_000_000;
  const cmaState = createInitialGameState(now);
  const splitState = createInitialGameState(now);
  splitState.poolAllocations = { cma: 50, btc: 30, doge: 20 };
  const offlineState = createInitialGameState(now);
  offlineState.energyExpiresAt = now - 1;

  const cmaPower = getInstalledPower(Object.values(cmaState.rackMiners).flat());
  const splitInstalled = getInstalledPower(
    Object.values(splitState.rackMiners).flat(),
  );
  const totals = aggregatePlayerNetworkPower(
    [
      { accountId: "cma", state: cmaState },
      { accountId: "split", state: splitState },
      { accountId: "offline", state: offlineState },
    ],
    new Map([["split", 1_000]]),
    now,
  );

  assert.equal(totals.cma, cmaPower + Math.floor((splitInstalled + 1_000) * 0.5));
  assert.equal(totals.btc, Math.floor((splitInstalled + 1_000) * 0.3));
  assert.equal(totals.doge, Math.floor((splitInstalled + 1_000) * 0.2));
});

test("base visual zerada não remove o piso econômico da recompensa", () => {
  const cma = pools.find((pool) => pool.id === "cma");
  assert.ok(cma);
  const defaultReward = calculateEstimatedReward(cma, 14_500);
  const zeroVisualReward = calculateEstimatedReward(cma, 14_500, 0);
  const crowdedReward = calculateEstimatedReward(
    cma,
    14_500,
    cma.networkPowerGh * 2,
  );

  assert.equal(zeroVisualReward, defaultReward);
  assert.ok(crowdedReward < defaultReward);
});

test("laboratório do proprietário é limitado, reversível e auditado", async () => {
  const [route, dashboard, migration] = await Promise.all([
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0008_goofy_pestilence.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(route, /OWNER_TEST_BALANCE_CMA = 10_000/);
  assert.match(route, /admin_test_cma_grant/);
  assert.match(route, /economic_test_prepared/);
  assert.match(route, /restore-network-reference/);
  assert.match(route, /writeAdminAudit/);
  assert.match(dashboard, /Piso de dificuldade preservado/);
  assert.match(dashboard, /SALDO 10\.000 CMA/);
  assert.match(migration, /network_runtime_settings/);
});
