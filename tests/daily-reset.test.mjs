import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_RESET_HOUR_LOCAL,
  dailyResetWindow,
} from "../app/daily-reset-rules.ts";
import { pcLevelAfterInactivity } from "../app/pc-progression-rules.ts";

test("janela diária começa às 21:00 no fuso do operador", () => {
  assert.equal(DAILY_RESET_HOUR_LOCAL, 21);
  const before = dailyResetWindow(Date.UTC(2026, 6, 28, 23, 59));
  const after = dailyResetWindow(Date.UTC(2026, 6, 29, 0, 1));
  assert.equal(before.resetAt, Date.UTC(2026, 6, 29, 0));
  assert.equal(after.startsAt, Date.UTC(2026, 6, 29, 0));
  assert.equal(after.resetAt, Date.UTC(2026, 6, 30, 0));
});

test("PC perde um nível na virada sem nova partida", () => {
  const lastPlay = Date.UTC(2026, 6, 28, 23, 59);
  assert.equal(
    pcLevelAfterInactivity(60, lastPlay, Date.UTC(2026, 6, 29, 0, 1)),
    2,
  );
  assert.equal(
    pcLevelAfterInactivity(60, lastPlay, Date.UTC(2026, 6, 30, 0, 1)),
    1,
  );
});
