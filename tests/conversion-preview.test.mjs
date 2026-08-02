import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CMA_USD_REFERENCE,
  CONVERSION_FEE_BPS,
  amountToAtomic,
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

test("cotação vem do servidor, expira e não movimenta carteira", async () => {
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
  assert.match(view, /DEPÓSITOS BLOQUEADOS/);
  assert.match(view, /Nenhum saldo é movimentado nesta fase/);
  assert.doesNotMatch(route, /UPDATE game_states|ledger_entries|btcBalanceAtomic|dogeBalanceAtomic/);
});

test("migração e recuperação incluem preços e prévias", async () => {
  const [migration, recovery, admin, guide] = await Promise.all([
    readFile(new URL("../drizzle/0017_many_pet_avengers.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/PUBLIC_LAUNCH_GUIDE.md", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /CREATE TABLE `conversion_quotes`/);
  assert.match(migration, /CREATE TABLE `market_price_snapshots`/);
  assert.match(recovery, /conversion_quotes/);
  assert.match(recovery, /market_price_snapshots/);
  assert.match(admin, /PRÉVIA ATIVA/);
  assert.match(guide, /1 CMA usa US\$ 1 como unidade de referência contábil/);
});
