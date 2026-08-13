import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("produção usa o domínio oficial em URLs públicas e callbacks", async () => {
  const [config, layout] = await Promise.all([
    readFile(new URL("../wrangler.production.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(config, /"PUBLIC_BASE_URL": "https:\/\/cryptominerarcadia\.com"/);
  assert.match(config, /"pattern": "cryptominerarcadia\.com"/);
  assert.match(config, /"custom_domain": true/);
  assert.doesNotMatch(layout, /crypto-miner-arcadia\.criptomineracardia\.workers\.dev/);
});

test("mineradores sazonais recebem um berço visual sem afetar os clássicos", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /data-rack-art=/);
  assert.match(component, /miner\.availability === "season"/);
  assert.match(styles, /\[data-rack-art="season"\]/);
  assert.match(styles, /object-position:\s*center bottom/);
});
