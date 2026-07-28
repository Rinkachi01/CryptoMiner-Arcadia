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

test("bloco total fica fixo enquanto o poder altera apenas a participação", () => {
  const cma = pools.find((pool) => pool.id === "cma");
  assert.ok(cma);
  const soloSmall = calculateEstimatedReward(cma, 100, 100);
  const soloLarge = calculateEstimatedReward(cma, 10_000, 10_000);
  const firstShare = calculateEstimatedReward(cma, 300, 1_000);
  const secondShare = calculateEstimatedReward(cma, 700, 1_000);
  const doubledFirstShare = calculateEstimatedReward(cma, 600, 2_000);

  assert.equal(soloSmall, cma.rewardAtomic);
  assert.equal(soloLarge, cma.rewardAtomic);
  assert.equal(firstShare, doubledFirstShare);
  assert.ok(firstShare + secondShare <= cma.rewardAtomic);
});

test("laboratório do proprietário é limitado, reversível e auditado", async () => {
  const [route, dashboard, migration] = await Promise.all([
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0009_chubby_legion.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(route, /OWNER_TEST_BALANCE_CMA = 10_000/);
  assert.match(route, /admin_test_cma_grant/);
  assert.match(route, /economic_test_prepared/);
  assert.match(route, /set-block-budget/);
  assert.match(route, /start-block-bonus/);
  assert.match(route, /blockRewardBounds/);
  assert.match(route, /writeAdminAudit/);
  assert.match(dashboard, /Uma quantia fixa é disputada em cada bloco/);
  assert.match(dashboard, /SALVAR ORÇAMENTO FIXO/);
  assert.match(migration, /reward_cma_atomic/);
});
