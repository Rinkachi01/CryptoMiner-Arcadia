import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  readMercadoPagoConfig,
  verifyMercadoPagoWebhook,
} from "../app/mercadopago-rules.ts";

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

test("Pix falha fechado e separa configuração de ativação", () => {
  assert.equal(readMercadoPagoConfig({}).enabled, false);
  const base = {
    MERCADO_PAGO_ACCESS_TOKEN: `TEST-${"a".repeat(40)}`,
    MERCADO_PAGO_WEBHOOK_SECRET: "segredo-webhook-mercado-pago",
    PIX_OPERATIONAL_MARGIN_BPS: "300",
    PUBLIC_BASE_URL: "https://jogar.arcadia.example",
  };
  assert.equal(readMercadoPagoConfig(base).providerReady, true);
  assert.equal(readMercadoPagoConfig(base).enabled, false);
  assert.equal(
    readMercadoPagoConfig({ ...base, PIX_DEPOSITS_ENABLED: "true" }).enabled,
    true,
  );
  assert.equal(readMercadoPagoConfig({ ...base, PIX_OPERATIONAL_MARGIN_BPS: "99999" }).operationalMarginBps, 2_000);
});

test("assinatura Order usa o manifesto oficial do Mercado Pago", async () => {
  const dataId = "order_123456";
  const requestId = "request-123456";
  const timestamp = "1786470000";
  const secret = "segredo-webhook-mercado-pago";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = toHex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(
        `id:${dataId};request-id:${requestId};ts:${timestamp};`,
      ),
    ),
  );
  assert.equal(
    await verifyMercadoPagoWebhook({
      dataId,
      requestId,
      secret,
      signatureHeader: `ts=${timestamp},v1=${signature}`,
    }),
    true,
  );
  assert.equal(
    await verifyMercadoPagoWebhook({
      dataId,
      requestId,
      secret,
      signatureHeader: `ts=${timestamp},v1=${"0".repeat(64)}`,
    }),
    false,
  );
});

test("Pix usa Orders API, PTAX, idempotência e crédito autoritativo", async () => {
  const [server, playerRoute, webhookRoute, view, schema, recovery] = await Promise.all([
    readFile(new URL("../app/pix-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wallet/pix/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wallet/mercadopago/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ConversionView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
  ]);
  assert.match(server, /olinda\.bcb\.gov\.br/);
  assert.match(server, /\/v1\/orders/);
  assert.match(server, /X-Idempotency-Key/);
  assert.match(server, /status === "processed"/);
  assert.match(server, /statusDetail === "accredited"/);
  assert.match(server, /credit_pix_cma/);
  assert.match(server, /reconcilePendingPixDeposits/);
  assert.match(server, /GET ao endpoint|pix_reconciliation_failed|provider_reference/);
  assert.match(playerRoute, /getArcadiaUser/);
  assert.match(playerRoute, /body\.action === "refresh"/);
  assert.match(webhookRoute, /x-signature/);
  assert.match(webhookRoute, /processMercadoPagoWebhook/);
  assert.match(view, /Compre CMA inteiro em reais/);
  assert.match(view, /PIX COPIA E COLA/);
  assert.match(view, /EXTRATO PIX/);
  assert.match(view, /depositMethod === "PIX"/);
  assert.match(schema, /walletPixDepositIntents/);
  assert.match(recovery, /wallet_pix_deposit_intents/);
});
