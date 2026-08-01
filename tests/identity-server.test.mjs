import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { accountIdForVerifiedEmail } from "../app/identity-rules.ts";

test("identidade central preserva a conta ao normalizar e-mail verificado", async () => {
  const first = await accountIdForVerifiedEmail(" Operador@Arcadia.test ");
  const second = await accountIdForVerifiedEmail("operador@arcadia.test");
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("beta mantém ChatGPT e comunica a futura migração pública", async () => {
  const [page, identity] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/identity-rules.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /BETA PRIVADO/);
  assert.match(page, /cadastro por e-mail/i);
  assert.match(page, /migração do progresso/i);
  assert.match(identity, /CURRENT_IDENTITY_PROVIDER = "chatgpt"/);
  assert.match(identity, /accountIdForVerifiedEmail/);
});
