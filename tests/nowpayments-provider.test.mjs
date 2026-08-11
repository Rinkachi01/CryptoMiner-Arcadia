import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalNowPaymentsPayload,
  normalizeNowPaymentsStatus,
  parseNowPaymentsMinimumUsd,
  readNowPaymentsConfig,
  safeNowPaymentsMinimumUsd,
  signNowPaymentsPayload,
  verifyNowPaymentsPayload,
} from "../app/nowpayments-rules.ts";

test("configuração do provedor falha fechada e exige segredo IPN", () => {
  assert.equal(readNowPaymentsConfig({}).providerReady, false);
  const configured = readNowPaymentsConfig({
    CRYPTO_DEPOSITS_ENABLED: "true",
    NOWPAYMENTS_API_BASE_URL: "https://api-sandbox.nowpayments.io/v1",
    NOWPAYMENTS_API_KEY: "api-key-de-teste-comprida",
    NOWPAYMENTS_IPN_SECRET: "segredo-ipn-teste",
    PUBLIC_BASE_URL: "https://arcadia.example",
  });
  assert.equal(configured.providerReady, true);
  assert.equal(configured.depositsEnabled, true);
  assert.equal(configured.sandbox, true);

  const productionBlocked = readNowPaymentsConfig({
    CRYPTO_DEPOSITS_ENABLED: "true",
    NOWPAYMENTS_API_BASE_URL: "https://api.nowpayments.io/v1",
    NOWPAYMENTS_API_KEY: "api-key-de-teste-comprida",
    NOWPAYMENTS_IPN_SECRET: "segredo-ipn-teste",
    PUBLIC_BASE_URL: "https://arcadia.example",
  });
  assert.equal(productionBlocked.providerReady, true);
  assert.equal(productionBlocked.depositsEnabled, false);
  assert.equal(
    readNowPaymentsConfig({
      CRYPTO_DEPOSITS_ENABLED: "true",
      CRYPTO_LIVE_DEPOSITS_ENABLED: "true",
      NOWPAYMENTS_API_BASE_URL: "https://api.nowpayments.io/v1",
      NOWPAYMENTS_API_KEY: "api-key-de-teste-comprida",
      NOWPAYMENTS_IPN_SECRET: "segredo-ipn-teste",
      PUBLIC_BASE_URL: "https://arcadia.example",
    }).depositsEnabled,
    true,
  );
});

test("mínimo do provedor é arredondado para cima e falha fechado", () => {
  assert.equal(parseNowPaymentsMinimumUsd({ fiat_equivalent: 2.341 }), 2.35);
  assert.equal(parseNowPaymentsMinimumUsd({ fiat_equivalent: "4.20" }), 4.2);
  assert.equal(parseNowPaymentsMinimumUsd({ fiat_equivalent: 0 }), null);
  assert.equal(parseNowPaymentsMinimumUsd({ min_amount: 1 }), null);
  assert.equal(safeNowPaymentsMinimumUsd(11.98), 12.22);
  assert.equal(safeNowPaymentsMinimumUsd(0), null);
  assert.equal(
    readNowPaymentsConfig({ NOWPAYMENTS_SETTLEMENT_ASSET: "USDTTRC20" })
      .settlementAsset,
    "usdttrc20",
  );
});

test("assinatura IPN é canônica, verificável e sensível a alterações", async () => {
  const payload = {
    payment_status: "finished",
    order_id: "deposit-00000000-0000-0000-0000-000000000000",
    nested: { z: 1, a: 2 },
  };
  assert.equal(
    canonicalNowPaymentsPayload(payload),
    '{"nested":{"a":2,"z":1},"order_id":"deposit-00000000-0000-0000-0000-000000000000","payment_status":"finished"}',
  );
  const signature = await signNowPaymentsPayload(payload, "segredo-ipn-teste");
  assert.equal(
    await verifyNowPaymentsPayload({ payload, secret: "segredo-ipn-teste", signature }),
    true,
  );
  assert.equal(
    await verifyNowPaymentsPayload({
      payload: { ...payload, payment_status: "waiting" },
      secret: "segredo-ipn-teste",
      signature,
    }),
    false,
  );
  assert.equal(normalizeNowPaymentsStatus("finished"), "finished");
  assert.equal(normalizeNowPaymentsStatus("invented"), "unknown");
});

test("webhook público verifica assinatura antes de processar crédito", async () => {
  const source = await readFile(
    new URL("../app/api/wallet/nowpayments/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /x-nowpayments-sig/);
  assert.match(source, /processNowPaymentsIpn/);
  assert.match(source, /payload_too_large/);
  assert.match(source, /request\.body\.getReader\(\)/);
  assert.doesNotMatch(source, /request\.text\(\)/);
});
