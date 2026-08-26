import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createInitialGameState } from "../app/game-server.ts";
import { signNowPaymentsPayload } from "../app/nowpayments-rules.ts";
import {
  ensureWalletSchema,
  readProviderDepositMinimum,
  processNowPaymentsIpn,
} from "../app/wallet-server.ts";

const NOW = Date.UTC(2026, 7, 11, 20, 0, 0);
const ACCOUNT_ID = "account-nowpayments-flow";
const IPN_SECRET = "nowpayments-test-secret-12345";
const ENVIRONMENT = {
  CRYPTO_DEPOSITS_ENABLED: "true",
  CRYPTO_LIVE_DEPOSITS_ENABLED: "true",
  NOWPAYMENTS_API_BASE_URL: "https://api.nowpayments.io/v1",
  NOWPAYMENTS_API_KEY: "nowpayments-test-api-key-long-enough",
  NOWPAYMENTS_IPN_SECRET: IPN_SECRET,
  NOWPAYMENTS_SETTLEMENT_ASSET: "usdttrc20",
  PUBLIC_BASE_URL: "https://arcadia.example",
};

test("mínimo dinâmico consulta cada rede nativa sem conversão implícita", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(new URL(String(input)));
    return Response.json({ fiat_equivalent: 0.03 });
  };
  try {
    for (const asset of ["DOGE", "LTC", "BTC"]) {
      const result = await readProviderDepositMinimum({
        asset,
        environment: ENVIRONMENT,
      });
      assert.equal(result.asset, asset);
      assert.equal(result.settlementAsset, asset);
      const url = requestedUrls.at(-1);
      assert.equal(url.searchParams.get("currency_from"), asset.toLowerCase());
      assert.equal(url.searchParams.get("currency_to"), asset.toLowerCase());
      assert.equal(url.searchParams.get("fiat_equivalent"), "usd");
      assert.equal(url.searchParams.get("is_fee_paid_by_user"), "true");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

class SqliteD1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new SqliteD1Statement(this.database, this.sql, values);
  }

  first(column) {
    const row = this.database.prepare(this.sql).get(...this.values) ?? null;
    return column && row ? row[column] ?? null : row;
  }

  all() {
    return {
      meta: { changes: 0 },
      results: this.database.prepare(this.sql).all(...this.values),
      success: true,
    };
  }

  run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return {
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
      success: true,
    };
  }
}

class SqliteD1Database {
  constructor() {
    this.database = new DatabaseSync(":memory:");
    this.database.exec("PRAGMA foreign_keys = ON");
  }

  prepare(sql) {
    return new SqliteD1Statement(this.database, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

async function createFixture(asset) {
  const db = new SqliteD1Database();
  await ensureWalletSchema(db);
  db.database.exec(`CREATE TABLE game_states (
    account_id TEXT PRIMARY KEY NOT NULL,
    state_json TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE ledger_entries (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL,
    action TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    state_version INTEGER NOT NULL,
    delta_cma_micros INTEGER NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (account_id, idempotency_key)
  );`);
  const state = createInitialGameState(NOW);
  state.btcBalanceAtomic = 0;
  state.dogeBalanceAtomic = 0;
  state.ltcBalanceAtomic = 0;
  const intentId = `deposit-${crypto.randomUUID()}`;
  const invoiceId = `invoice-${asset.toLowerCase()}`;
  db.prepare(`INSERT INTO game_states (
    account_id, state_json, version, updated_at
  ) VALUES (?, ?, 1, ?)`).bind(ACCOUNT_ID, JSON.stringify(state), NOW).run();
  db.prepare(`INSERT INTO wallet_deposit_intents (
    id, account_id, asset, provider, provider_reference, checkout_url,
    deposit_address, requested_usd_micros, received_atomic,
    settlement_asset, settlement_atomic, credited_cma_micros,
    status, expires_at, created_at, updated_at
  ) VALUES (?, ?, ?, 'nowpayments', ?, NULL, NULL, 10000000, 0,
    NULL, 0, 0, 'waiting', ?, ?, ?)`)
    .bind(intentId, ACCOUNT_ID, asset, invoiceId, NOW + 1_800_000, NOW, NOW)
    .run();
  return { db, intentId, invoiceId, initialState: state };
}

function finishedPayload({ asset, intentId, invoiceId, paidAmount, outcomeCurrency, outcomeAmount = "9.700000" }) {
  const resolvedOutcomeCurrency = outcomeCurrency ?? asset.toLowerCase();
  return {
    actually_paid: paidAmount,
    invoice_id: invoiceId,
    order_id: intentId,
    outcome_amount: outcomeAmount,
    outcome_currency: resolvedOutcomeCurrency,
    pay_currency: asset.toLowerCase(),
    payment_id: `payment-${asset.toLowerCase()}`,
    payment_status: "finished",
    price_amount: "10.00",
    price_currency: "usd",
  };
}

function readState(db) {
  const row = db.prepare("SELECT state_json, version FROM game_states WHERE account_id = ?")
    .bind(ACCOUNT_ID)
    .first();
  return { state: JSON.parse(row.state_json), version: row.version };
}

for (const scenario of [
  { asset: "BTC", balance: "btcBalanceAtomic", paidAmount: "0.0001", receivedAtomic: 10_000 },
  { asset: "DOGE", balance: "dogeBalanceAtomic", paidAmount: "2.5", receivedAtomic: 250_000_000 },
  { asset: "LTC", balance: "ltcBalanceAtomic", paidAmount: "0.2", receivedAtomic: 20_000_000 },
]) {
  test(`IPN finished credita ${scenario.asset} uma vez e nunca cria CMA`, async () => {
    const fixture = await createFixture(scenario.asset);
    try {
      const payload = finishedPayload({ ...fixture, ...scenario });
      const signature = await signNowPaymentsPayload(payload, IPN_SECRET);
      const first = await processNowPaymentsIpn({
        db: fixture.db,
        environment: ENVIRONMENT,
        now: NOW + 1_000,
        payload,
        signature,
      });
      assert.equal(first.status, "credited");
      const afterFirst = readState(fixture.db);
      assert.equal(afterFirst.state[scenario.balance], scenario.receivedAtomic);
      assert.equal(afterFirst.state.cmaBalance, fixture.initialState.cmaBalance);
      assert.equal(afterFirst.version, 2);

      const replay = await processNowPaymentsIpn({
        db: fixture.db,
        environment: ENVIRONMENT,
        now: NOW + 2_000,
        payload,
        signature,
      });
      assert.equal(replay.status, "credited");
      const afterReplay = readState(fixture.db);
      assert.equal(afterReplay.state[scenario.balance], scenario.receivedAtomic);
      assert.equal(afterReplay.version, 2);
      assert.equal(
        fixture.db.prepare("SELECT COUNT(*) AS total FROM ledger_entries").first().total,
        1,
      );
      assert.equal(
        fixture.db.prepare("SELECT status FROM wallet_deposit_intents WHERE id = ?")
          .bind(fixture.intentId)
          .first().status,
        "credited",
      );
    } finally {
      fixture.db.close();
    }
  });
}

test("IPN adulterado, parcial ou com liquidação errada nunca credita saldo", async () => {
  const tampered = await createFixture("BTC");
  try {
    const payload = finishedPayload({
      ...tampered,
      asset: "BTC",
      paidAmount: "0.0001",
    });
    const signature = await signNowPaymentsPayload(payload, IPN_SECRET);
    await assert.rejects(
      processNowPaymentsIpn({
        db: tampered.db,
        environment: ENVIRONMENT,
        payload: { ...payload, actually_paid: "0.0002" },
        signature,
      }),
      /Assinatura/,
    );
    assert.equal(readState(tampered.db).state.btcBalanceAtomic, 0);
  } finally {
    tampered.db.close();
  }

  const partial = await createFixture("DOGE");
  try {
    const payload = {
      order_id: partial.intentId,
      payment_id: "payment-partial",
      payment_status: "partially_paid",
    };
    const signature = await signNowPaymentsPayload(payload, IPN_SECRET);
    const result = await processNowPaymentsIpn({
      db: partial.db,
      environment: ENVIRONMENT,
      payload,
      signature,
    });
    assert.equal(result.status, "partially_paid");
    assert.equal(readState(partial.db).state.dogeBalanceAtomic, 0);
    assert.equal(partial.db.prepare("SELECT COUNT(*) AS total FROM ledger_entries").first().total, 0);
  } finally {
    partial.db.close();
  }

  const wrongSettlement = await createFixture("LTC");
  try {
    const payload = {
      ...finishedPayload({
        ...wrongSettlement,
        asset: "LTC",
        paidAmount: "0.2",
      }),
      outcome_currency: "usdtbsc",
    };
    const signature = await signNowPaymentsPayload(payload, IPN_SECRET);
    const result = await processNowPaymentsIpn({
      db: wrongSettlement.db,
      environment: ENVIRONMENT,
      payload,
      signature,
    });
    assert.equal(result.status, "review_required");
    assert.equal(readState(wrongSettlement.db).state.ltcBalanceAtomic, 0);
    assert.equal(wrongSettlement.db.prepare("SELECT COUNT(*) AS total FROM ledger_entries").first().total, 0);
  } finally {
    wrongSettlement.db.close();
  }
});

test("IPN com liquidação na mesma moeda paga aceita o depósito nativo", async () => {
  const fixture = await createFixture("DOGE");
  try {
    const payload = finishedPayload({
      ...fixture,
      asset: "DOGE",
      paidAmount: "2.5",
      outcomeAmount: "2.45000000",
      outcomeCurrency: "doge",
    });
    const signature = await signNowPaymentsPayload(payload, IPN_SECRET);
    const result = await processNowPaymentsIpn({
      db: fixture.db,
      environment: ENVIRONMENT,
      now: NOW + 1_000,
      payload,
      signature,
    });
    assert.equal(result.status, "credited");
    assert.equal(readState(fixture.db).state.dogeBalanceAtomic, 250_000_000);
    assert.equal(
      fixture.db.prepare("SELECT settlement_asset FROM wallet_deposit_intents WHERE id = ?")
        .bind(fixture.intentId)
        .first().settlement_asset,
      "DOGE",
    );
  } finally {
    fixture.db.close();
  }
});
