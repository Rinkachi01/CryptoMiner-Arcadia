import assert from "node:assert/strict";
import test from "node:test";

import { readBoundedJsonObject } from "../app/external-json.ts";

test("aceita somente um objeto JSON dentro do limite", async () => {
  const result = await readBoundedJsonObject(
    new Response(JSON.stringify({ price: 12.34 }), {
      headers: { "content-type": "application/json" },
    }),
  );
  assert.deepEqual(result, { price: 12.34 });
});

test("recusa resposta externa grande mesmo sem content-length", async () => {
  const payload = new TextEncoder().encode(JSON.stringify({ data: "x".repeat(200) }));
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    }),
    { headers: { "content-type": "application/json" } },
  );
  await assert.rejects(() => readBoundedJsonObject(response, 64), /limite seguro/);
});

test("recusa conteúdo externo que não seja objeto JSON", async () => {
  await assert.rejects(
    () =>
      readBoundedJsonObject(
        new Response("[]", { headers: { "content-type": "application/json" } }),
      ),
    /Resposta externa inválida/,
  );
});
