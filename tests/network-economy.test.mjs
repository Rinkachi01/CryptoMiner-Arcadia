import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateEstimatedReward,
  getInstalledPower,
  pools,
} from "../app/game-rules.ts";
import { createInitialGameState } from "../app/game-server.ts";
import {
  aggregatePlayerNetworkPower,
  buildAccountNetworkContribution,
} from "../app/network-server.ts";

test("rede viva soma apenas equipamentos energizados e respeita alocações", () => {
  const now = 1_800_000_000_000;
  const cmaState = createInitialGameState(now);
  const splitState = createInitialGameState(now);
  cmaState.energyExpiresAt = now + 12 * 60 * 60 * 1000;
  splitState.energyExpiresAt = now + 12 * 60 * 60 * 1000;
  splitState.poolAllocations = { cma: 40, btc: 25, doge: 20, ltc: 15 };
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

  assert.equal(totals.cma, cmaPower + Math.floor((splitInstalled + 1_000) * 0.4));
  assert.equal(totals.btc, Math.floor((splitInstalled + 1_000) * 0.25));
  assert.equal(totals.doge, Math.floor((splitInstalled + 1_000) * 0.2));
  assert.equal(totals.ltc, Math.floor((splitInstalled + 1_000) * 0.15));
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

test("índice incremental preserva potência, alocação e validade da energia", () => {
  const now = 1_800_000_000_000;
  let state = createInitialGameState(now);
  state.rackMiners["rack-01"] = [
    {
      instanceId: state.minerInventory[0].instanceId,
      minerId: "byte-spark",
      slotIndex: 0,
    },
  ];
  state.poolAllocations = { cma: 20, btc: 25, doge: 35, ltc: 20 };
  state.energyExpiresAt = now + 12 * 60 * 60 * 1000;

  const contribution = buildAccountNetworkContribution("operator", state);
  assert.equal(contribution.accountId, "operator");
  assert.equal(contribution.installedPowerGh, getInstalledPower(state.rackMiners["rack-01"]));
  assert.deepEqual(contribution.allocations, state.poolAllocations);
  assert.equal(contribution.energyExpiresAt, state.energyExpiresAt);
});

test("rede global não possui mais teto silencioso de cinco mil contas", async () => {
  const source = await readFile(
    new URL("../app/network-server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /account_network_power/);
  assert.match(source, /backfillAccountNetworkPower/);
  assert.doesNotMatch(source, /FROM game_states\s+LIMIT 5000/);
});

test("reconstrução legada da rede é limitada por requisição", async () => {
  const source = await readFile(
    new URL("../app/network-server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /const NETWORK_BACKFILL_BATCH_SIZE = 25/);
  assert.doesNotMatch(source, /while \(true\) \{[\s\S]*backfillAccountNetworkPower/);
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
  assert.match(route, /owner_wallet_replenished/);
  assert.match(route, /replenish-owner-wallet/);
  assert.match(route, /set-block-budget/);
  assert.match(route, /start-block-bonus/);
  assert.match(route, /poolIds/);
  assert.match(route, /updateBlockRewardSchedules/);
  assert.match(route, /bonusStartsAt/);
  assert.match(route, /agendado por/);
  assert.match(route, /blockRewardBounds/);
  assert.match(route, /writeAdminAudit/);
  assert.match(dashboard, /Uma quantia fixa é disputada em cada bloco/);
  assert.match(dashboard, /SALVAR ORÇAMENTO FIXO/);
  assert.match(dashboard, /AGENDADOR DE EVENTOS/);
  assert.match(dashboard, /Bônus por pool/);
  assert.match(dashboard, /datetime-local/);
  assert.match(await readFile(new URL("../app/network-server.ts", import.meta.url), "utf8"), /bonusSchedules/);
  assert.match(migration, /reward_cma_atomic/);
  const litecoinMigration = await readFile(
    new URL("../drizzle/0026_concerned_snowbird.sql", import.meta.url),
    "utf8",
  );
  assert.match(litecoinMigration, /reward_ltc_atomic/);
  assert.match(litecoinMigration, /allocation_ltc/);
});
