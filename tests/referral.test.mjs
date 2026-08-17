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

test("proposta de bônus é calculada por bloco e preserva o indicado", async () => {
  const [server, panel] = await Promise.all([
    readFile(new URL("../app/referral-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ReferralPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(server, /REFERRAL_CMA_SHARE_BPS = 800/);
  assert.match(server, /REFERRAL_CRYPTO_SHARE_BPS = 500/);
  assert.match(server, /REFERRAL_MIN_COMPLETED_GAMES = 3/);
  assert.match(server, /REFERRAL_MIN_ACCOUNT_AGE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(server, /const nextReferredState = referredState/);
  assert.match(server, /payoutMode: "per_validated_block"/);
  assert.match(server, /hasPayoutCap: false/);
  assert.match(panel, /sem recompensa acumulada/i);
  assert.match(panel, /cmaRewardPercent/);
  assert.match(panel, /cryptoRewardPercent/);
});
