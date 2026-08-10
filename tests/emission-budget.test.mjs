import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DAILY_GAME_POWER_BUDGET_GH,
  calculateEmissionAward,
  emissionWindow,
} from "../app/game-emission-budget.ts";

test("orçamento diário nunca concede poder acima do restante", () => {
  assert.equal(DAILY_GAME_POWER_BUDGET_GH, 5_000);
  assert.equal(calculateEmissionAward(4_850, 320), 150);
  assert.equal(calculateEmissionAward(5_000, 300), 0);
  assert.equal(calculateEmissionAward(1_000, 280), 280);
});

test("janela de emissão reinicia no próximo dia UTC", () => {
  const now = Date.UTC(2026, 6, 28, 23, 59, 30);
  const window = emissionWindow(now);
  assert.equal(window.windowKey, "2026-07-28");
  assert.equal(window.resetAt, Date.UTC(2026, 6, 29));
});

test("os quatro minigames reservam poder no orçamento global", async () => {
  const sources = await Promise.all(
    ["packet-catch", "hash-match", "circuit-rush", "coin-link"].map((game) =>
      readFile(
        new URL(`../app/api/games/${game}/route.ts`, import.meta.url),
        "utf8",
      ),
    ),
  );
  for (const source of sources) {
    assert.match(source, /reserveDailyGamePower/);
    assert.match(source, /emissionBudget/);
    assert.match(source, /SET reward_power_gh = \?/);
  }
});
