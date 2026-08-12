import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRetentionCohorts } from "../app/beta-observability.ts";
import {
  isPartnerTaskMode,
  partnerTaskModes,
} from "../app/task-preferences.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

test("coortes distinguem entrada, retorno, Arcade e energia", () => {
  const now = Date.UTC(2026, 6, 28, 12);
  const createdAt = now - 4 * DAY_MS;
  const accounts = [
    {
      account_id: "alpha",
      created_at: createdAt,
      state_json: "{}",
      updated_at: createdAt,
    },
    {
      account_id: "beta",
      created_at: createdAt,
      state_json: "{}",
      updated_at: createdAt,
    },
  ];
  const cohorts = buildRetentionCohorts(
    accounts,
    [
      {
        accountId: "alpha",
        at: createdAt + 2 * DAY_MS,
        kind: "arcade",
      },
      {
        accountId: "alpha",
        at: createdAt + 3 * DAY_MS,
        kind: "energy",
      },
    ],
    now,
  );

  assert.equal(cohorts[0].signups, 2);
  assert.equal(cohorts[0].returned7d, 1);
  assert.equal(cohorts[0].arcade7d, 1);
  assert.equal(cohorts[0].energy7d, 1);
  assert.equal(cohorts[0].measurementComplete, false);
});

test("preferência de tarefas aceita somente escolhas sem ativação automática", async () => {
  const [api, tasks, migration] = await Promise.all([
    readFile(
      new URL("../app/api/task-preferences/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/TasksView.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0011_burly_gunslinger.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.deepEqual(partnerTaskModes, ["ask", "disabled"]);
  assert.equal(isPartnerTaskMode("ask"), true);
  assert.equal(isPartnerTaskMode("enabled"), false);
  assert.match(api, /getArcadiaUser/);
  assert.match(api, /saveTaskPreference/);
  assert.match(tasks, /Parceiro conectado: <b>NÃO<\/b>/);
  assert.match(tasks, /Nenhum compartilhamento é autorizado/);
  assert.match(migration, /CREATE TABLE `task_preferences`/);
  assert.match(migration, /CREATE TABLE `task_preference_events`/);
});

test("compactação preserva ledger e exige ação exclusiva do proprietário", async () => {
  const [observability, adminApi, dashboard] = await Promise.all([
    readFile(new URL("../app/beta-observability.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(observability, /PROOF_RETENTION_DAYS = 30/);
  assert.match(observability, /risk_level = 'normal'/);
  assert.match(observability, /status IN \('completed', 'failed'\)/);
  assert.match(observability, /UPDATE game_sessions/);
  assert.doesNotMatch(observability, /DELETE FROM (?:game_sessions|ledger_entries)/i);
  assert.match(adminApi, /compact-game-proofs/);
  assert.match(adminApi, /old_game_proofs_compacted/);
  assert.match(dashboard, /REVISAR COMPACTAÇÃO/);
  assert.match(dashboard, /CONFIRMAR/);
});
