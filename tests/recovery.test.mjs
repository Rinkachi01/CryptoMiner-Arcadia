import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateRecoveryReadiness } from "../app/recovery-server.ts";

const NOW = 1_800_000_000_000;

const archive = {
  checksumSha256: "a".repeat(64),
  createdAt: NOW - 24 * 60 * 60 * 1000,
  errorMessage: null,
  id: "archive-01",
  rowCount: 120,
  sizeBytes: 20_000,
  status: "ready",
};

const drill = {
  archiveId: archive.id,
  checks: {
    accountStatesReadable: true,
    archiveFresh: true,
    checksumMatches: true,
    ledgerAccountsPresent: true,
    ledgerVersionsSafe: true,
    networkAccountsPresent: true,
    payloadComplete: true,
    schemaRecognized: true,
    storageObjectReadable: true,
  },
  createdAt: NOW,
  id: "drill-01",
  status: "passed",
};

test("recuperação fica pronta somente com cópia recente e ensaio correspondente", () => {
  const result = evaluateRecoveryReadiness({
    archiveObjectPresent: true,
    latestArchive: archive,
    latestDrill: drill,
    now: NOW,
    storageConnected: true,
  });
  assert.equal(result.status, "stable");
  assert.equal(result.gates.every((gate) => gate.passed), true);
});

test("objeto ausente é crítico e ensaio antigo não libera a cópia atual", () => {
  const result = evaluateRecoveryReadiness({
    archiveObjectPresent: false,
    latestArchive: archive,
    latestDrill: { ...drill, archiveId: "archive-antigo" },
    now: NOW,
    storageConnected: true,
  });
  assert.equal(result.status, "critical");
  assert.equal(
    result.gates.find((gate) => gate.id === "restore-drill")?.passed,
    false,
  );
});

test("pacote externo cobre estado, ledger e rede sem reparar contas automaticamente", async () => {
  const [server, hosting, migration] = await Promise.all([
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0014_round_smiling_tiger.sql", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(hosting, /"r2": "RECOVERY_ARCHIVE"/);
  assert.match(migration, /CREATE TABLE `recovery_archives`/);
  assert.match(migration, /CREATE TABLE `recovery_drills`/);
  assert.match(server, /SHA-256/);
  assert.match(server, /game_states/);
  assert.match(server, /ledger_entries/);
  assert.match(server, /account_network_power/);
  assert.match(server, /MAX_ARCHIVE_BYTES = 24 \* 1024 \* 1024/);
  assert.doesNotMatch(server, /DELETE FROM|UPDATE game_states|UPDATE ledger_entries/i);
});

test("ações e download de recuperação permanecem exclusivos do proprietário", async () => {
  const [adminRoute, downloadRoute, dashboard] = await Promise.all([
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/admin/recovery/latest/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(adminRoute, /recovery_archive_created/);
  assert.match(adminRoute, /recovery_drill_completed/);
  assert.match(downloadRoute, /claimOrVerifyAdminOwner/);
  assert.match(downloadRoute, /recovery_archive_downloaded/);
  assert.match(dashboard, /CRIAR CÓPIA EXTERNA/);
  assert.match(dashboard, /SIMULAR RESTAURAÇÃO/);
  assert.match(dashboard, /NENHUMA CONTA É SOBRESCRITA/);
});
