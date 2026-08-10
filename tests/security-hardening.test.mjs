import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  detectAutomationPattern,
  readSecurityConfig,
} from "../app/security-server.ts";

test("detector recusa rajada impossível e intervalo robótico sem punir ritmo humano", () => {
  assert.match(
    detectAutomationPattern([100, 120, 151, 980]),
    /rápida demais/,
  );
  assert.match(
    detectAutomationPattern([100, 500, 900, 1300, 1700, 2100, 2500, 2900]),
    /uniforme/,
  );
  assert.equal(
    detectAutomationPattern([100, 420, 910, 1_550, 2_020, 2_800, 3_180]),
    null,
  );
});

test("Turnstile só fica configurado com as duas chaves e falha fechado quando exigido", () => {
  assert.deepEqual(readSecurityConfig({ TURNSTILE_REQUIRED: "true" }), {
    configured: false,
    hostname: null,
    required: true,
    secret: "",
    siteKey: "",
  });
  assert.equal(
    readSecurityConfig({
      TURNSTILE_REQUIRED: "true",
      TURNSTILE_SECRET: "secret",
      TURNSTILE_SITE_KEY: "site",
    }).configured,
    true,
  );
});

test("os quatro jogos passam pelo mesmo limite no servidor e o navegador não confirma prêmio", async () => {
  const [packet, hash, circuit, link, gate, widget, security, route] = await Promise.all([
    readFile(new URL("../app/api/games/packet-catch/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/games/hash-match/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/games/circuit-rush/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/games/coin-link/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ArcadeHumanGate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TurnstileWidget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/security-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/security/route.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [packet, hash, circuit, link]) {
    assert.match(source, /guardArcadeAction/);
    assert.match(source, /rejectAutomatedSession/);
  }
  assert.match(gate, /arcade_access/);
  assert.match(widget, /expired-callback/);
  assert.match(route, /verifyTurnstileAndCreatePass/);
  assert.match(security, /siteverify/);
  assert.doesNotMatch(security, /remoteip|userAgent|fingerprint/i);
  assert.doesNotMatch(gate, /rewardPowerGh|ledger_entries|balanceCma/i);
});

test("migração, recuperação, painel e guia cobrem o pré-lançamento", async () => {
  const [migration, recovery, dashboard, guide] = await Promise.all([
    readFile(new URL("../drizzle/0016_empty_mad_thinker.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/PUBLIC_LAUNCH_GUIDE.md", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /CREATE TABLE `arcade_security_passes`/);
  assert.match(migration, /CREATE TABLE `security_rate_windows`/);
  assert.match(migration, /CREATE TABLE `security_events`/);
  assert.match(recovery, /arcade_security_passes/);
  assert.match(recovery, /security_rate_windows/);
  assert.match(recovery, /security_events/);
  assert.match(dashboard, /DINHEIRO REAL E SAQUES CONTINUAM DESATIVADOS/);
  assert.match(guide, /CMA é um crédito virtual fechado/);
  assert.match(guide, /TURNSTILE_REQUIRED=true/);
});
