import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("indicação é atribuída uma vez e não aceita autoindicação", async () => {
  const server = await readFile(
    new URL("../app/referral-server.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /referred_account_id TEXT PRIMARY KEY/);
  assert.match(server, /referrer\.account_id === referredAccountId/);
  assert.match(server, /INSERT OR IGNORE INTO referral_attributions/);
});

test("cadastro preserva o código até a confirmação do e-mail", async () => {
  const [form, callback] = await Promise.all([
    readFile(new URL("../app/auth/AuthForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(form, /referralCode/);
  assert.match(form, /auth\/callback.*ref=/s);
  assert.match(callback, /claimReferral/);
  assert.match(callback, /email_confirmed_at/);
});

test("proposta de bônus tem teto e não divide mineração", async () => {
  const [server, panel] = await Promise.all([
    readFile(new URL("../app/referral-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ReferralPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(server, /REFERRAL_MAX_CMA_PER_REFERRAL_MICROS = 250_000/);
  assert.match(server, /REFERRAL_WEEKLY_CMA_CAP_MICROS = 1_000_000/);
  assert.match(server, /REFERRAL_MIN_COMPLETED_GAMES = 3/);
  assert.match(server, /REFERRAL_MIN_ACCOUNT_AGE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(panel, /máximo por operador indicado/i);
});
