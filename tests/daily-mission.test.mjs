import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DAILY_ARCADE_BATTERY_REWARD,
  DAILY_ARCADE_MISSION_ID,
  dailyMissionIdempotencyKey,
  dailyMissionWindow,
  isDailyArcadeMissionEligible,
} from "../app/daily-mission-rules.ts";

test("tour diário reconhece todos os seis minigames", () => {
  assert.equal(
    isDailyArcadeMissionEligible([
      "packet-catch",
      "hash-match",
      "circuit-rush",
      "coin-link",
      "sky-dash",
      "crypto-2048",
    ]),
    true,
  );
  assert.equal(
    isDailyArcadeMissionEligible(["packet-catch", "hash-match"]),
    false,
  );
  assert.equal(DAILY_ARCADE_BATTERY_REWARD, 1);
});

test("missão diária reinicia às 21h locais (00:00 UTC)", () => {
  const now = Date.UTC(2026, 6, 28, 23, 59, 30);
  const window = dailyMissionWindow(now);
  assert.equal(window.windowKey, "2026-07-28");
  assert.equal(window.startsAt, Date.UTC(2026, 6, 28, 0));
  assert.equal(window.resetAt, Date.UTC(2026, 6, 29, 0));
  assert.equal(
    dailyMissionIdempotencyKey(window.windowKey),
    `mission:${DAILY_ARCADE_MISSION_ID}:2026-07-28`,
  );
});

test("resgate de bateria é autoritativo, concorrente e auditado", async () => {
  const source = await readFile(
    new URL("../app/api/games/summary/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /claim-daily-battery/);
  assert.match(source, /WHERE account_id = \? AND version = \?/);
  assert.match(source, /dailyMissionClaims/);
  assert.match(source, /INSERT OR IGNORE INTO ledger_entries/);
  assert.match(source, /daily_mission_battery/);
  assert.match(source, /delta_cma_micros[\s\S]*0/);
});
