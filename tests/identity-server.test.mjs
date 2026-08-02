import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  accountIdForVerifiedEmail,
  safeArcadiaReturnPath,
} from "../app/identity-rules.ts";

test("identidade central preserva a conta ao normalizar e-mail verificado", async () => {
  const first = await accountIdForVerifiedEmail(" Operador@Arcadia.test ");
  const second = await accountIdForVerifiedEmail("operador@arcadia.test");
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("beta e login público preservam a conta pelo e-mail verificado", async () => {
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

test("retorno da autenticação só aceita caminho da própria aplicação", () => {
  assert.equal(safeArcadiaReturnPath("/admin?tab=beta"), "/admin?tab=beta");
  assert.equal(safeArcadiaReturnPath("https://evil.example"), "/");
  assert.equal(safeArcadiaReturnPath("//evil.example"), "/");
  assert.equal(safeArcadiaReturnPath("/auth/callback"), "/");
});
