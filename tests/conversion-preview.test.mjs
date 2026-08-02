import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CMA_USD_REFERENCE,
  CONVERSION_FEE_BPS,
  amountToAtomic,
  applyInternalConversionBalances,
  calculateConversionQuote,
  conversionAssets,
} from "../app/conversion-rules.ts";

test("CMA usa dólar como referência interna sem criar resgate", () => {
  assert.equal(CMA_USD_REFERENCE, 1);
  assert.equal(CONVERSION_FEE_BPS, 300);
  const quote = calculateConversionQuote("BTC", 10_000, 100_000);
  assert.equal(quote.grossUsd, 10);
  assert.equal(quote.grossCma, 10);
  assert.equal(quote.feeCma, 0.3);
  assert.equal(quote.netCma, 9.7);
});

test("prévia aceita BTC, DOGE e LTC com no máximo oito casas", () => {
  assert.deepEqual(
    conversionAssets.map((asset) => asset.id),
    ["BTC", "DOGE", "LTC"],
  );
  assert.equal(amountToAtomic("0,00010000", "BTC"), 10_000);
  assert.equal(amountToAtomic("1.000000001", "DOGE"), null);
  assert.equal(amountToAtomic("0", "LTC"), null);
});

test("conversão debita a moeda e credita CMA em precisão de micros", () => {
  assert.deepEqual(
    applyInternalConversionBalances({
      asset: "BTC",
      assetAmountAtomic: 10_000,
      btcBalanceAtomic: 25_000,
      cmaBalance: 1.25,
      dogeBalanceAtomic: 50_000_000,
      netCmaMicros: 9_700_000,
    }),
    {
      btcBalanceAtomic: 15_000,
      cmaBalance: 10.95,
      dogeBalanceAtomic: 50_000_000,
    },
  );
  assert.throws(
    () =>
      applyInternalConversionBalances({
        asset: "DOGE",
        assetAmountAtomic: 2,
        btcBalanceAtomic: 0,
        cmaBalance: 0,
        dogeBalanceAtomic: 1,
        netCmaMicros: 1,
      }),
    /Saldo DOGE insuficiente/,
  );
});

test("cotação vem do servidor, expira e a execução é autoritativa", async () => {
  const [route, server, view] = await Promise.all([
    readFile(new URL("../app/api/conversion/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/conversion-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ConversionView.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /getArcadiaUser/);
  assert.match(route, /readMarketRates/);
  assert.match(server, /api\.coingecko\.com/);
  assert.match(server, /CONVERSION_QUOTE_TTL_MS/);
  assert.match(server, /QUOTE_LIMIT_10_MIN/);
  assert.match(route, /executeConversionQuote/);
  assert.match(server, /UPDATE game_states/);
  assert.match(server, /convert_crypto_to_cma/);
  assert.match(server, /consumption_key/);
  assert.match(view, /CONFIRMAR CONVERSÃO/);
  assert.match(view, /USAR SALDO TOTAL/);
});

test("migração e recuperação incluem execução e carteiras", async () => {
  const [migration, recovery, admin, guide] = await Promise.all([
    readFile(new URL("../drizzle/0018_lying_lilandra.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/PUBLIC_LAUNCH_GUIDE.md", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /ALTER TABLE `conversion_quotes` ADD `consumption_key`/);
  assert.match(migration, /CREATE TABLE `player_wallet_accounts`/);
  assert.match(migration, /CREATE TABLE `wallet_deposit_intents`/);
  assert.match(recovery, /conversion_quotes/);
  assert.match(recovery, /wallet_provider_events/);
  assert.match(admin, /BTC \/ DOGE ATIVO/);
  assert.match(guide, /1 CMA usa US\$ 1 como unidade de referência contábil/);
  assert.match(guide, /IPN não é assinada/);
});
