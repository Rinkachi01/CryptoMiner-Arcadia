import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isBetaTextScale,
  isInputMode,
  isViewportBucket,
} from "../app/beta-device-server.ts";
import { buildDeviceOnboardingBreakdown } from "../app/beta-observability.ts";

test("perfil do beta aceita somente categorias amplas", () => {
  assert.equal(isViewportBucket("small"), true);
  assert.equal(isViewportBucket("1920x1080"), false);
  assert.equal(isInputMode("touch"), true);
  assert.equal(isInputMode("iphone"), false);
  assert.equal(isBetaTextScale("extra"), true);
  assert.equal(isBetaTextScale("12px"), false);
});

test("funil separa tela pequena de tela grande sem misturar contas", () => {
  const now = Date.UTC(2026, 7, 1, 12);
  const accounts = ["mobile", "desktop"].map((accountId) => ({
    account_id: accountId,
    created_at: now - 1_000,
    state_json: "{}",
    updated_at: now,
  }));
  const starter = (accountId) => ({
    account_id: accountId,
    action: "starter_kit_granted",
    created_at: now - 1_000,
    metadata_json: JSON.stringify({ version: "operator-v2" }),
  });
  const action = (accountId, name) => ({
    account_id: accountId,
    action: name,
    created_at: now,
    metadata_json: "{}",
  });
  const result = buildDeviceOnboardingBreakdown(
    accounts,
    [
      starter("mobile"),
      starter("desktop"),
      action("mobile", "install_miner"),
    ],
    [],
    [
      {
        account_id: "mobile",
        first_input_mode: "touch",
        first_viewport: "small",
        text_scale: "large",
      },
      {
        account_id: "desktop",
        first_input_mode: "pointer",
        first_viewport: "large",
        text_scale: "comfortable",
      },
    ],
    now,
  );

  assert.deepEqual(result.coverage, { percent: 100, profiled: 2, total: 2 });
  assert.equal(
    result.viewports.find((group) => group.id === "small").stages[1].accounts,
    1,
  );
  assert.equal(
    result.viewports.find((group) => group.id === "large").stages[1].accounts,
    0,
  );
});

test("teste de acessibilidade é autenticado, não paga prêmio e não cria fingerprint", async () => {
  const [route, client, tasks, admin, migration, recovery] = await Promise.all([
    readFile(new URL("../app/api/beta-device/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/beta-device-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/TasksView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0015_exotic_odin.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /getArcadiaUser/);
  assert.match(route, /submit-accessibility-review/);
  assert.doesNotMatch(route, /reward|ledger|balance|power_grant/i);
  assert.match(client, /window\.innerWidth/);
  assert.match(client, /any-pointer: coarse/);
  assert.doesNotMatch(client, /userAgent|navigator\.platform|canvas|WebGL|ip/i);
  assert.match(tasks, /Este teste não paga CMA, BTC, DOGE, energia ou poder temporário/);
  assert.match(admin, /SEM RASTREADOR EXTERNO/);
  assert.match(admin, /LABORATÓRIO DE TELA E CONTROLE/);
  assert.match(migration, /CREATE TABLE `beta_device_profiles`/);
  assert.match(migration, /CREATE TABLE `beta_accessibility_reviews`/);
  assert.match(recovery, /beta_device_profiles/);
  assert.match(recovery, /beta_accessibility_reviews/);
});
