import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CMA_USD_REFERENCE,
  CONVERSION_FEE_BPS,
  CONVERSION_QUOTE_TTL_MS,
  amountToAtomic,
  applyInternalConversionBalances,
  calculateCmaPurchaseQuote,
  calculateConversionQuote,
  cmaUnitsFromInput,
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

test("cotação expira rapidamente para acompanhar a volatilidade", () => {
  assert.equal(CONVERSION_QUOTE_TTL_MS, 2 * 60 * 1000);
});

test("jogador compra somente unidades inteiras de CMA pelo valor calculado em cripto", () => {
  assert.equal(cmaUnitsFromInput("1"), 1);
  assert.equal(cmaUnitsFromInput(25), 25);
  assert.equal(cmaUnitsFromInput("1.5"), null);
  assert.equal(cmaUnitsFromInput("0"), null);
  assert.equal(cmaUnitsFromInput("1000001"), null);

  const quote = calculateCmaPurchaseQuote("BTC", 1, 100_000);
  assert.equal(quote.targetCma, 1);
  assert.equal(quote.netCma, 1);
  assert.equal(quote.assetAmountAtomic, 1_031);
  assert.equal(quote.assetAmount, 0.00001031);
  assert.equal(quote.feeCma, 0.030928);
  assert.equal(quote.grossUsd, 1.031);
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
      ltcBalanceAtomic: 0,
      netCmaMicros: 9_700_000,
    }),
    {
      btcBalanceAtomic: 15_000,
      cmaBalance: 10.95,
      dogeBalanceAtomic: 50_000_000,
      ltcBalanceAtomic: 0,
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
        ltcBalanceAtomic: 0,
        netCmaMicros: 1,
      }),
    /Saldo DOGE insuficiente/,
  );
  assert.deepEqual(
    applyInternalConversionBalances({
      asset: "LTC",
      assetAmountAtomic: 25_000,
      btcBalanceAtomic: 0,
      cmaBalance: 0,
      dogeBalanceAtomic: 0,
      ltcBalanceAtomic: 50_000,
      netCmaMicros: 1_000_000,
    }),
    {
      btcBalanceAtomic: 0,
      cmaBalance: 1,
      dogeBalanceAtomic: 0,
      ltcBalanceAtomic: 25_000,
    },
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
  assert.match(server, /api\.coinbase\.com/);
  assert.match(server, /fetchFreshRates/);
  assert.match(server, /CONVERSION_QUOTE_TTL_MS/);
  assert.match(server, /QUOTE_LIMIT_10_MIN/);
  assert.match(server, /AbortSignal\.timeout\(PRICE_FETCH_TIMEOUT_MS\)/);
  assert.match(server, /if \(rate\.stale\)/);
  assert.match(route, /executeConversionQuote/);
  assert.match(server, /UPDATE game_states/);
  assert.match(server, /convert_crypto_to_cma/);
  assert.match(server, /consumption_key/);
  assert.match(server, /quote\.net_cma_micros % 1_000_000/);
  assert.match(route, /targetCma: body\.targetCma/);
  assert.match(view, /CONFIRMAR CONVERSÃO/);
  assert.match(view, /COMPRAR O MÁXIMO INTEIRO/);
  assert.match(view, /QUANTIDADE INTEIRA DE CMA/);
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
  assert.match(admin, /BTC \/ DOGE \/ LTC ATIVO/);
  assert.match(guide, /1 CMA usa US\$ 1 como unidade de referência contábil/);
  assert.match(guide, /IPN precisa apresentar HMAC SHA-512 válido/);
});
