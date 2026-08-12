import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CRYPTO_WITHDRAWAL_MINIMUM_BRL_CENTS,
  MANUAL_WITHDRAWAL_MINIMUM_ATOMIC,
  PIX_WITHDRAWAL_MINIMUM_BRL_CENTS,
  manualWithdrawalsEnabled,
  minimumAtomicForBrl,
} from "../app/wallet-server.ts";

test("fila manual nasce desativada e exige ativação explícita", () => {
  assert.equal(manualWithdrawalsEnabled({}), false);
  assert.equal(
    manualWithdrawalsEnabled({ MANUAL_WITHDRAWALS_ENABLED: "true" }),
    true,
  );
  assert.deepEqual(MANUAL_WITHDRAWAL_MINIMUM_ATOMIC, {
    BTC: 10_000,
    DOGE: 1_000_000_000,
    LTC: 1_000_000,
  });
});

test("mínimos de saque acompanham o valor econômico em real", () => {
  assert.equal(CRYPTO_WITHDRAWAL_MINIMUM_BRL_CENTS, 5_000);
  assert.equal(PIX_WITHDRAWAL_MINIMUM_BRL_CENTS, 2_000);
  assert.equal(minimumAtomicForBrl("BTC", 500_000), 10_000);
  assert.equal(minimumAtomicForBrl("DOGE", 1), 5_000_000_000);
  assert.equal(minimumAtomicForBrl("LTC", 500), 10_000_000);
});

test("pedido reserva saldo e recusa produz estorno autoritativo", async () => {
  const [server, route, adminRoute, schema, migration] = await Promise.all([
    readFile(new URL("../app/wallet-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wallet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/withdrawals/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0024_light_warlock.sql", import.meta.url), "utf8"),
  ]);
  assert.match(route, /create-withdrawal/);
  assert.match(route, /create-brl-withdrawal/);
  assert.match(route, /brl-withdrawal-quote/);
  assert.match(server, /reserve_crypto_withdrawal/);
  assert.match(server, /reserve_brl_withdrawal/);
  assert.match(server, /refund_crypto_withdrawal/);
  assert.match(server, /status IN \('requested', 'reviewing'\)/);
  assert.match(server, /Saldo .* insuficiente/);
  assert.match(server, /return state\.ltcBalanceAtomic/);
  assert.match(adminRoute, /claimOrVerifyAdminOwner/);
  assert.match(adminRoute, /manual_withdrawal_/);
  assert.match(schema, /destinationAddress/);
  assert.match(migration, /destination_address/);
});

test("Litecoin entra em depósito, conversão e fila manual de saque", async () => {
  const [game, wallet, view] = await Promise.all([
    readFile(new URL("../app/game-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/wallet-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ConversionView.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(game, /ltcBalanceAtomic/);
  assert.match(wallet, /assets: \["BTC", "DOGE", "LTC"\]/);
  assert.match(wallet, /assets: \["BTC", "DOGE", "LTC"\]/);
  assert.match(view, /type WithdrawableAsset = "BTC" \| "DOGE" \| "LTC"/);
  assert.match(view, /endereço Litecoin válido/);
});
