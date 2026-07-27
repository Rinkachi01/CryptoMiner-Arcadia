import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renderiza a experiência principal do Crypto Miner Arcadia", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Crypto Miner Arcadia<\/title>/i);
  assert.match(html, /Sua sala de minera[cç][aã]o/i);
  assert.match(html, /1 CMA = US\$ 1/i);
  assert.match(html, /Sala de minera[cç][aã]o/i);
  assert.match(html, /Pools/i);
  assert.match(html, /Invent[aá]rio/i);
  assert.match(html, /RACKS NESTA SALA/i);
  assert.match(html, /ENERGIA/i);
  assert.match(html, /ESTIMATIVA POR BLOCO[^<]*10 MIN/i);
  assert.doesNotMatch(html, />CONSUMO</i);
  assert.doesNotMatch(html, /codex-preview/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
});
