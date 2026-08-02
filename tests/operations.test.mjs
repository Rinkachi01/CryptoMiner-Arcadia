import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildIncidentRunbook,
  evaluateOperationalHealth,
} from "../app/operations-server.ts";

const NOW = 1_800_000_000_000;

function healthyMetrics(overrides = {}) {
  return {
    expiredPowerBacklog: 0,
    invalidStateRows: 0,
    latestCheckpointAt: NOW - 24 * 60 * 60 * 1000,
    missingNetworkIndexes: 0,
    openRiskReviews: 0,
    reservedMissionClaims: 0,
    staleNetworkIndexes: 0,
    stuckGameSessions: 0,
    totalAccounts: 12,
    ...overrides,
  };
}

test("diagnóstico saudável exige dados íntegros e checkpoint recente", () => {
  const result = evaluateOperationalHealth(healthyMetrics(), NOW);
  assert.equal(result.status, "stable");
  assert.equal(result.findings.every((finding) => finding.severity === "stable"), true);
});

test("estado ilegível é crítico e checkpoint ausente exige atenção", () => {
  const result = evaluateOperationalHealth(
    healthyMetrics({ invalidStateRows: 1, latestCheckpointAt: null }),
    NOW,
  );
  assert.equal(result.status, "critical");
  assert.equal(
    result.findings.find((finding) => finding.id === "state-integrity")?.severity,
    "critical",
  );
  assert.equal(
    result.findings.find((finding) => finding.id === "checkpoint-cadence")?.severity,
    "attention",
  );
});

test("runbook ativa somente cenários correspondentes aos sinais observados", () => {
  const runbook = buildIncidentRunbook(
    healthyMetrics({ openRiskReviews: 2, reservedMissionClaims: 1 }),
  );
  assert.equal(
    runbook.find((scenario) => scenario.id === "reward-spike")?.status,
    "triggered",
  );
  assert.equal(
    runbook.find((scenario) => scenario.id === "stuck-session")?.status,
    "triggered",
  );
  assert.equal(
    runbook.find((scenario) => scenario.id === "state-recovery")?.status,
    "ready",
  );
});

test("Central de Operações é exclusiva, auditável e não repara dados automaticamente", async () => {
  const [server, route, dashboard, migration] = await Promise.all([
    readFile(new URL("../app/operations-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0013_ancient_madame_masque.sql", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(migration, /CREATE TABLE `operational_checkpoints`/);
  assert.match(server, /json_valid\(state_json\)/);
  assert.match(server, /LEFT JOIN account_network_power/);
  assert.match(server, /status = 'reserved'/);
  assert.doesNotMatch(server, /DELETE FROM|UPDATE game_states|UPDATE game_sessions/i);
  assert.match(route, /operational_checkpoint_created/);
  assert.match(route, /Ação permitida apenas ao proprietário/);
  assert.match(dashboard, /Central de Operações/);
  assert.match(dashboard, /NÃO ALTERA DADOS REAIS/);
  assert.match(dashboard, /Checkpoint não é backup/);
});
