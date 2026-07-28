import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all(
  [
    "../app/admin-settings.ts",
    "../app/api/admin/route.ts",
    "../app/AdminDashboard.tsx",
    "../app/game-emission-budget.ts",
    "../app/api/game/route.ts",
    "../app/api/games/summary/route.ts",
    "../drizzle/0005_sweet_magneto.sql",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);

const [
  settingsSource,
  apiSource,
  dashboardSource,
  budgetSource,
  gameRouteSource,
  summaryRouteSource,
  migrationSource,
] = files;

test("o primeiro proprietário fica travado no servidor", () => {
  assert.match(settingsSource, /INSERT OR IGNORE INTO admin_owners/);
  assert.match(settingsSource, /owner\?\.account_id === accountId/);
  assert.match(apiSource, /Ação permitida apenas ao proprietário/);
  assert.doesNotMatch(
    dashboardSource,
    /localStorage\.(?:getItem|setItem)\([^)]*(?:owner|admin|account)/i,
  );
  assert.doesNotMatch(dashboardSource, /sessionStorage/);
  assert.match(dashboardSource, /arcadia-text-scale/);
});

test("as três chaves econômicas são reversíveis e auditadas", () => {
  for (const setting of [
    "cratesEnabled",
    "minigamePowerEnabled",
    "dailyBatteryEnabled",
  ]) {
    assert.match(settingsSource, new RegExp(setting));
    assert.match(dashboardSource, new RegExp(setting));
  }
  assert.match(settingsSource, /admin_audit_log/);
  assert.match(apiSource, /runtime_setting_updated/);
  assert.match(migrationSource, /admin_runtime_settings/);
});

test("pausas são aplicadas nas rotas autoritativas", () => {
  assert.match(gameRouteSource, /settings\.cratesEnabled/);
  assert.match(budgetSource, /settings\.minigamePowerEnabled/);
  assert.match(summaryRouteSource, /settings\.dailyBatteryEnabled/);
  assert.match(budgetSource, /paused: true/);
});

test("fila antifraude registra resolução sem apagar a sessão", () => {
  assert.match(apiSource, /admin_session_reviews/);
  assert.match(apiSource, /resolution === "cleared"/);
  assert.match(apiSource, /resolution === "confirmed"/);
  assert.doesNotMatch(apiSource, /DELETE FROM game_sessions/i);
});
