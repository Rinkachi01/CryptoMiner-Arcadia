import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readPublicLaunchReadiness } from "../app/public-launch-server.ts";

test("pré-lançamento falha fechado sem serviços externos", () => {
  const readiness = readPublicLaunchReadiness(
    {},
    "https://crypto-miner-arcadia-game.example.chatgpt.site/",
  );
  assert.equal(readiness.hosting.https, true);
  assert.equal(readiness.hosting.customDomain, false);
  assert.equal(readiness.identity.projectConfigured, false);
  assert.equal(readiness.identity.publicLoginEnabled, false);
  assert.equal(readiness.deposits.enabled, false);
  assert.equal(readiness.withdrawals.cryptoEnabled, false);
  assert.equal(readiness.withdrawals.cmaWithdrawable, false);
  assert.equal(readiness.wallet.privateKeysInArcadia, false);
});

test("configuração prepara login e depósito sem ativá-los implicitamente", () => {
  const readiness = readPublicLaunchReadiness(
    {
      BITPAY_TOKEN: "token-producao",
      CRYPTO_DEPOSITS_ENABLED: "false",
      PUBLIC_BASE_URL: "https://jogar.arcadia.example",
      PUBLIC_LOGIN_ENABLED: "false",
      SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"a".repeat(80)}`,
      SUPABASE_URL: "https://arcadia.supabase.co",
    },
    "https://jogar.arcadia.example/",
  );
  assert.equal(readiness.hosting.customDomain, true);
  assert.equal(readiness.identity.projectConfigured, true);
  assert.equal(readiness.identity.publicLoginEnabled, false);
  assert.equal(readiness.deposits.configured, true);
  assert.equal(readiness.deposits.enabled, false);
});

test("painel documenta a divisão segura entre os serviços", async () => {
  const dashboard = await readFile(
    new URL("../app/AdminDashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(dashboard, /SEM MIGRAR PARA FIREBASE/);
  assert.match(dashboard, /Sites \+ Cloudflare/);
  assert.match(dashboard, /Supabase Auth/);
  assert.match(dashboard, /Livro-razão individual/);
  assert.match(dashboard, /Provedor de payout \+ KYC/);
});
