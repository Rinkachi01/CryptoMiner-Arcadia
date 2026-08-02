import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { walletProviderReadiness } from "../app/wallet-server.ts";

test("depósitos exigem credencial, URL HTTPS e ativação explícita", () => {
  assert.deepEqual(walletProviderReadiness({}), {
    depositsEnabled: false,
    provider: "bitpay",
    providerReady: false,
  });
  assert.deepEqual(
    walletProviderReadiness({
      BITPAY_TOKEN: "token-de-teste",
      CRYPTO_DEPOSITS_ENABLED: "false",
      PUBLIC_BASE_URL: "https://arcadia.example",
    }),
    { depositsEnabled: false, provider: "bitpay", providerReady: true },
  );
  assert.equal(
    walletProviderReadiness({
      BITPAY_TOKEN: "token-de-teste",
      CRYPTO_DEPOSITS_ENABLED: "true",
      PUBLIC_BASE_URL: "https://arcadia.example",
    }).depositsEnabled,
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
  assert.match(server, /custody_mode.*provider_invoice/s);
  assert.doesNotMatch(server, /private_key|seed_phrase|mnemonic/i);
  assert.match(route, /getArcadiaUser/);
  assert.match(view, /Depósitos reais aguardam o provedor regulado/);
  assert.match(view, /Nunca envie criptomoeda/);
  assert.match(page, />ENTRAR</);
  assert.match(page, />CRIAR CONTA</);
});
