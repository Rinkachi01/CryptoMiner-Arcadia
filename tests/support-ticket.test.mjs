import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateSupportTicketInput } from "../app/support-rules.ts";
import { createSupportPublicId } from "../app/support-server.ts";

test("chamado exige categoria, titulo e descricao validos", () => {
  assert.equal(validateSupportTicketInput({}).valid, false);
  assert.equal(
    validateSupportTicketInput({
      category: "account",
      message: "curta",
      subject: "Login",
    }).valid,
    false,
  );
  const valid = validateSupportTicketInput({
    category: "game",
    message: "O rack da sala nao responde ao toque no celular.",
    subject: "Rack sem resposta",
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.category, "game");
});

test("protocolo publico nao revela o identificador interno", () => {
  assert.equal(
    createSupportPublicId("12345678-abcd-4ef0-9988-112233445566"),
    "CMA-12345678",
  );
});

test("central persiste chamados por conta e limita abuso", async () => {
  const [route, form, page, emailServer, migration] = await Promise.all([
    readFile(new URL("../app/api/support/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/support/SupportRequestForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/support/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/support-email-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0019_demonic_blizzard.sql", import.meta.url), "utf8"),
  ]);
  assert.match(route, /getArcadiaUser/);
  assert.match(route, /60_000/);
  assert.match(route, />= 5/);
  assert.match(route, /deliverSupportTicket/);
  assert.match(emailServer, /requested && apiKey && from && to/);
  assert.match(emailServer, /Authorization: `Bearer \$\{config\.apiKey\}`/);
  assert.match(form, /\/api\/support/);
  assert.match(page, /SupportRequestForm/);
  assert.match(migration, /CREATE TABLE `support_tickets`/);
});
