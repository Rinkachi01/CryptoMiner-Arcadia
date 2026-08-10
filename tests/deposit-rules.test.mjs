import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateDirectCmaDeposit,
  DEPOSIT_SETTLEMENT_ASSET,
  parseDecimalAtomic,
} from "../app/deposit-rules.ts";

test("depósito direto aplica reserva de 3% e exige cobertura em USDT", () => {
  const covered = calculateDirectCmaDeposit(10_000_000, 9_850_000);
  assert.deepEqual(covered, {
    creditedCmaMicros: 9_700_000,
    feeBps: 300,
    feeCmaMicros: 300_000,
    grossCmaMicros: 10_000_000,
    reserveCovered: true,
  });
  assert.equal(
    calculateDirectCmaDeposit(10_000_000, 9_699_999).reserveCovered,
    false,
  );
  assert.equal(DEPOSIT_SETTLEMENT_ASSET, "USDTTRC20");
});

test("valores decimais do provedor são convertidos sem ponto flutuante", () => {
  assert.equal(parseDecimalAtomic("9.700000", 6), 9_700_000);
  assert.equal(parseDecimalAtomic(10, 6), 10_000_000);
  assert.equal(parseDecimalAtomic("9.70000000", 6), 9_700_000);
  assert.equal(parseDecimalAtomic("9.70000001", 6), null);
  assert.equal(parseDecimalAtomic("1e2", 6), null);
  assert.equal(parseDecimalAtomic("0", 6), null);
});

test("IPN concluído credita CMA e preserva a liquidação auditável", async () => {
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
  assert.match(source, /credit_cma_deposit/);
  assert.match(source, /delta_cma_micros/);
  assert.doesNotMatch(source, /credit_crypto_deposit/);
});
