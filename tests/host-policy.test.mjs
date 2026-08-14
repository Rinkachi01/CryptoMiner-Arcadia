import assert from "node:assert/strict";
import test from "node:test";
import {
  arcadiaHostDisposition,
  canonicalArcadiaUrl,
} from "../app/host-policy.ts";

test("domínio oficial é o único host de produção autorizado", () => {
  assert.equal(arcadiaHostDisposition("cryptominerarcadia.com"), "allow");
  assert.equal(arcadiaHostDisposition("crypto-miner-arcadia.criptomineracardia.workers.dev"), "block");
  assert.equal(arcadiaHostDisposition("crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site"), "block");
});

test("www redireciona para o domínio canônico e preserva o caminho", () => {
  assert.equal(arcadiaHostDisposition("www.cryptominerarcadia.com"), "redirect");
  assert.equal(
    canonicalArcadiaUrl("https://www.cryptominerarcadia.com/auth?mode=signin").toString(),
    "https://cryptominerarcadia.com/auth?mode=signin",
  );
});

test("hosts locais só são permitidos explicitamente no desenvolvimento", () => {
  assert.equal(arcadiaHostDisposition("localhost", { allowDevHosts: true }), "allow");
  assert.equal(arcadiaHostDisposition("localhost"), "block");
});
