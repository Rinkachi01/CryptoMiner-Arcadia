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

test("central persiste chamados por conta, limita abuso e entrega respostas", async () => {
  const [
    route,
    form,
    page,
    emailServer,
    migration,
    readMigration,
    adminRoute,
    dashboard,
    game,
    home,
    supportServer,
  ] = await Promise.all([
    readFile(new URL("../app/api/support/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/support/SupportRequestForm.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/support/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/support-email-server.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0020_concerned_elektra.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../drizzle/0021_keen_meggan.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/support-server.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /getArcadiaUser/);
  assert.match(route, /60_000/);
  assert.match(route, />= 5/);
  assert.match(route, /deliverSupportTicket/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /acknowledgeSupportReplies/);
  assert.match(emailServer, /requested && apiKey && from && to/);
  assert.match(emailServer, /Authorization: `Bearer \$\{config\.apiKey\}`/);
  assert.match(emailServer, /Idempotency-Key/);
  assert.match(emailServer, /deliverSupportReply/);
  assert.match(form, /\/api\/support/);
  assert.match(form, /adminReply/);
  assert.match(form, /NOVA RESPOSTA DO ARCADIA/);
  assert.match(page, /SupportRequestForm/);
  assert.doesNotMatch(page, /support@cryptominearcadia\.com/);
  assert.match(migration, /ADD `admin_note`/);
  assert.match(migration, /ADD `reply_delivery_status`/);
  assert.match(readMigration, /ADD `player_seen_reply_at`/);
  assert.match(adminRoute, /update-support-ticket/);
  assert.match(adminRoute, /claimOrVerifyAdminOwner/);
  assert.match(dashboard, /Protocolos dos jogadores/);
  assert.match(dashboard, /AGUARDANDO LEITURA/);
  assert.match(game, /unreadSupportReplies/);
  assert.match(game, /mobile-support-link/);
  assert.match(home, /readUnreadSupportReplyCount/);
  assert.match(supportServer, /account_id = \?/);
  assert.match(supportServer, /player_seen_reply_at < last_reply_at/);
  assert.match(supportServer, /180 \* 24 \* 60 \* 60 \* 1000/);
});
