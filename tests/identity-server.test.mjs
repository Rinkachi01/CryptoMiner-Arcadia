import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  accountIdForVerifiedEmail,
  isTrustedChatGPTHost,
  safeArcadiaReturnPath,
} from "../app/identity-rules.ts";

test("identidade central preserva a conta ao normalizar e-mail verificado", async () => {
  const first = await accountIdForVerifiedEmail(" Operador@Arcadia.test ");
  const second = await accountIdForVerifiedEmail("operador@arcadia.test");
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("beta e login publico preservam a conta pelo e-mail verificado", async () => {
  const [page, identity] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/identity-rules.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ACESSO PROTEGIDO/);
  assert.match(page, /e-mail confirmado/i);
  assert.match(page, /progresso no servidor/i);
  assert.match(identity, /CURRENT_IDENTITY_PROVIDER = "chatgpt"/);
  assert.match(identity, /PUBLIC_IDENTITY_PROVIDER = "supabase"/);
  assert.match(identity, /accountIdForVerifiedEmail/);
});

test("login OAuth preserva o nome já salvo no perfil da conta", async () => {
  const source = await readFile(
    new URL("../app/identity-server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /persistedDisplayName/);
  assert.match(source, /FROM game_states WHERE account_id = \?/);
  assert.match(source, /displayName,\s*email/);
});

test("retorno da autenticacao so aceita caminho da propria aplicacao", () => {
  assert.equal(safeArcadiaReturnPath("/admin?tab=beta"), "/admin?tab=beta");
  assert.equal(safeArcadiaReturnPath("https://evil.example"), "/");
  assert.equal(safeArcadiaReturnPath("//evil.example"), "/");
  assert.equal(safeArcadiaReturnPath("/auth/callback"), "/");
});

test("headers antigos do ChatGPT so sao confiaveis no host gerenciado", () => {
  assert.equal(isTrustedChatGPTHost("crypto-miner.chatgpt.site"), true);
  assert.equal(isTrustedChatGPTHost("crypto-miner.chatgpt.site:443"), true);
  assert.equal(isTrustedChatGPTHost("cryptominerarcadia.com"), false);
  assert.equal(isTrustedChatGPTHost("attacker.chatgpt.site.evil.example"), false);
  assert.equal(isTrustedChatGPTHost(null), false);
});
