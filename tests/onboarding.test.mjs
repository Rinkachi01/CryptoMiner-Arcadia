import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createInitialGameState } from "../app/game-server.ts";
import {
  buildOnboardingStatus,
  STARTER_KIT_VERSION,
} from "../app/onboarding-rules.ts";
import { buildOnboardingFunnel } from "../app/beta-observability.ts";

const NOW = 1_800_000_000_000;

test("onboarding exige ações confirmadas e recompensa positiva", () => {
  const state = createInitialGameState(NOW);
  const baseEvents = [
    {
      action: "starter_kit_granted",
      metadata: { version: STARTER_KIT_VERSION },
    },
  ];
  const start = buildOnboardingStatus(state, baseEvents, 0, NOW);
  assert.equal(start.eligible, true);
  assert.equal(start.milestones.kitDelivered, true);
  assert.equal(start.milestones.energyOnline, false);
  assert.equal(start.milestones.minerInstalled, false);
  assert.equal(start.milestones.poolsConfirmed, false);
  assert.equal(start.milestones.firstBlockCredited, false);

  state.rackMiners["rack-01"] = [
    {
      instanceId: state.minerInventory[0].instanceId,
      minerId: "byte-spark",
      slotIndex: 0,
    },
  ];
  const completed = buildOnboardingStatus(
    state,
    [
      ...baseEvents,
      { action: "use_battery" },
      { action: "apply_allocations" },
      {
        action: "block_settlement",
        metadata: { rewards: { cma: 1000, btc: 0, doge: 0 } },
      },
    ],
    3,
    NOW,
  );
  assert.equal(completed.completed, true);
  assert.equal(completed.completedCount, 6);
});

test("funil do proprietário usa somente contas do kit atual", () => {
  const accounts = [
    {
      account_id: "new",
      created_at: NOW,
      updated_at: NOW,
      state_json: JSON.stringify({
        rackMiners: { "rack-01": [{ minerId: "byte-spark" }] },
      }),
    },
    {
      account_id: "legacy",
      created_at: NOW,
      updated_at: NOW,
      state_json: JSON.stringify({ rackMiners: {} }),
    },
  ];
  const ledger = [
    {
      account_id: "new",
      action: "starter_kit_granted",
      metadata_json: JSON.stringify({ version: STARTER_KIT_VERSION }),
      created_at: NOW,
    },
    {
      account_id: "new",
      action: "use_battery",
      metadata_json: "{}",
      created_at: NOW,
    },
    {
      account_id: "new",
      action: "apply_allocations",
      metadata_json: "{}",
      created_at: NOW,
    },
    {
      account_id: "new",
      action: "block_settlement",
      metadata_json: JSON.stringify({ rewards: { cma: 50 } }),
      created_at: NOW,
    },
    {
      account_id: "legacy",
      action: "install_miner",
      metadata_json: "{}",
      created_at: NOW,
    },
  ];
  const funnel = buildOnboardingFunnel(
    accounts,
    ledger,
    [{ account_id: "new" }],
    NOW,
  );

  assert.equal(funnel.totalStarted, 1);
  assert.deepEqual(
    funnel.stages.map((stage) => stage.accounts),
    [1, 1, 1, 1, 1, 1],
  );
});

test("conta nova não importa saldo nem energia local", async () => {
  const [route, client, panel, summaryRoute] = await Promise.all([
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/FirstDayPanel.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/games/summary/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(route, /starter_kit_granted/);
  assert.match(route, /starter-kit:\$\{STARTER_KIT_VERSION\}/);
  assert.doesNotMatch(route, /startingCma|energyHours|batteryCount: 1/);
  assert.doesNotMatch(client, /arcadia-game-state-v4/);
  assert.match(panel, /Instale o Byte Spark/);
  assert.match(panel, /Jogue os três minigames/);
  assert.match(panel, /Receba o primeiro bloco/);
  assert.match(summaryRoute, /starter_kit_granted/);
});
