import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { walletProviderReadiness } from "../app/wallet-server.ts";

test("depósitos exigem credencial, URL HTTPS e ativação explícita", () => {
  assert.deepEqual(walletProviderReadiness({}), {
    activationRequested: false,
    depositsEnabled: false,
    liveActivationRequested: false,
    missingSetup: ["api_key", "ipn_secret", "public_url"],
    mode: "disabled",
    provider: "nowpayments",
    providerReady: false,
    providerSandbox: true,
    sandboxEnabled: false,
  });
  assert.deepEqual(
    walletProviderReadiness({
      NOWPAYMENTS_API_KEY: "api-key-de-teste-comprida",
      NOWPAYMENTS_IPN_SECRET: "segredo-ipn-teste",
      CRYPTO_DEPOSITS_ENABLED: "false",
      PUBLIC_BASE_URL: "https://arcadia.example",
    }),
    {
      activationRequested: false,
      depositsEnabled: false,
      liveActivationRequested: false,
      missingSetup: [],
      mode: "disabled",
      provider: "nowpayments",
      providerReady: true,
      providerSandbox: true,
      sandboxEnabled: false,
    },
  );
  assert.equal(
    walletProviderReadiness({
      NOWPAYMENTS_API_KEY: "api-key-de-teste-comprida",
      NOWPAYMENTS_IPN_SECRET: "segredo-ipn-teste",
      CRYPTO_DEPOSITS_ENABLED: "true",
      NOWPAYMENTS_API_BASE_URL: "https://api-sandbox.nowpayments.io/v1",
      PUBLIC_BASE_URL: "https://arcadia.example",
    }).depositsEnabled,
    true,
  );
  assert.equal(
    walletProviderReadiness({ CRYPTO_SANDBOX_ENABLED: "true" }).sandboxEnabled,
    true,
  );
});

test("carteira usa livro-razão individual e não guarda chaves privadas", async () => {
  const [server, route, view, page] = await Promise.all([
    readFile(new URL("../app/wallet-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wallet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ConversionView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(server, /ledger_model.*individual/s);
  assert.match(server, /CRYPTO_LIVE_DEPOSITS_OWNER_ONLY/);
  assert.match(server, /homologação exclusiva da conta fundadora/);
  assert.match(server, /custody_mode.*provider_invoice/s);
  assert.doesNotMatch(server, /private_key|seed_phrase|mnemonic/i);
  assert.match(route, /getArcadiaUser/);
  assert.match(view, /Depósitos reais usam fatura externa/);
  assert.match(view, /Nunca envie criptomoeda/);
  assert.match(view, /Deposite BTC ou DOGE no seu saldo interno/);
  assert.match(view, /nenhum CMA é criado automaticamente/);
  assert.match(view, /SOLICITAR SAQUE/);
  assert.match(view, /Promise\.allSettled/);
  assert.match(page, />ENTRAR</);
  assert.match(page, />CRIAR CONTA</);
});

test("laboratório financeiro registra somente simulações e preserva saldos", async () => {
  const [server, route, view, recovery, schema] = await Promise.all([
    readFile(new URL("../app/wallet-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wallet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ConversionView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(server, /simulation_only/);
  assert.match(server, /noFundsMoved: true/);
  assert.match(server, /noBalanceChanged: true/);
  assert.match(server, /Limite de cinco simulações por hora/);
  assert.match(route, /sandbox-deposit/);
  assert.match(route, /sandbox-withdrawal/);
  assert.match(route, /create-deposit/);
  assert.match(server, /processNowPaymentsIpn/);
  assert.match(view, /ZERO CRÉDITO/);
  assert.match(view, /não altera nenhum saldo/);
  assert.match(schema, /wallet_withdrawal_intents/);
  assert.match(recovery, /wallet_withdrawal_intents/);
});
