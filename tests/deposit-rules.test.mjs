import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyCryptoDepositBalances,
  DEPOSIT_SETTLEMENT_ASSET,
  parseDecimalAtomic,
} from "../app/deposit-rules.ts";

test("depósito preserva a liquidação auditável em USDT", () => {
  assert.equal(DEPOSIT_SETTLEMENT_ASSET, "USDTTRC20");
});

test("depósito credita somente a moeda paga sem criar CMA", () => {
  assert.deepEqual(
    applyCryptoDepositBalances({
      asset: "BTC",
      btcBalanceAtomic: 10,
      dogeBalanceAtomic: 20,
      receivedAtomic: 30,
    }),
    { btcBalanceAtomic: 40, dogeBalanceAtomic: 20 },
  );
  assert.deepEqual(
    applyCryptoDepositBalances({
      asset: "DOGE",
      btcBalanceAtomic: 10,
      dogeBalanceAtomic: 20,
      receivedAtomic: 30,
    }),
    { btcBalanceAtomic: 10, dogeBalanceAtomic: 50 },
  );
  assert.throws(() =>
    applyCryptoDepositBalances({
      asset: "BTC",
      btcBalanceAtomic: Number.MAX_SAFE_INTEGER,
      dogeBalanceAtomic: 0,
      receivedAtomic: 1,
    }),
  );
});

test("valores decimais do provedor são convertidos sem ponto flutuante", () => {
  assert.equal(parseDecimalAtomic("9.700000", 6), 9_700_000);
  assert.equal(parseDecimalAtomic(10, 6), 10_000_000);
  assert.equal(parseDecimalAtomic("9.70000000", 6), 9_700_000);
  assert.equal(parseDecimalAtomic("9.70000001", 6), null);
  assert.equal(parseDecimalAtomic("1e2", 6), null);
  assert.equal(parseDecimalAtomic("0", 6), null);
});

test("IPN concluído credita a moeda paga e exige conversão manual para CMA", async () => {
  const source = await readFile(
    new URL("../app/wallet-server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /is_fee_paid_by_user: true/);
  assert.match(source, /credencial de sandbox separada/);
  assert.match(source, /price_currency/);
  assert.match(source, /outcome_currency/);
  assert.match(source, /DEPOSIT_SETTLEMENT_ASSET/);
  assert.match(source, /review_required/);
  assert.match(source, /credit_crypto_deposit/);
  assert.match(source, /manualConversionRequired: true/);
  assert.match(source, /delta_cma_micros/);
  assert.doesNotMatch(source, /credit_cma_deposit/);
});
