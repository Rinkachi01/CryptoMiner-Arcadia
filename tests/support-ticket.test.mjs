import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateSupportTicketInput } from "../app/support-rules.ts";
import { createSupportPublicId } from "../app/support-server.ts";
import { readSupportEmailConfig } from "../app/support-email-server.ts";

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

test("Gmail provisório só ativa com ponte assinada completa", () => {
  const pending = readSupportEmailConfig({
    EMAIL_PROVIDER: "google_apps_script",
    SUPPORT_EMAIL_TO: "arcadia@example.com",
    TRANSACTIONAL_EMAIL_ENABLED: "true",
  });
  assert.equal(pending.enabled, false);

  const ready = readSupportEmailConfig({
    EMAIL_PROVIDER: "google_apps_script",
    GOOGLE_MAIL_WEBHOOK_SECRET: "a".repeat(32),
    GOOGLE_MAIL_WEBHOOK_URL:
      "https://script.google.com/macros/s/arcadia-test/exec",
    SUPPORT_EMAIL_TO: "arcadia@example.com",
    TRANSACTIONAL_EMAIL_ENABLED: "true",
  });
  assert.equal(ready.enabled, true);
  assert.equal(ready.provider, "google_apps_script");
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
    googleBridge,
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
    readFile(
      new URL("../docs/google-apps-script/Code.gs", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(route, /getArcadiaUser/);
  assert.match(route, /60_000/);
  assert.match(route, />= 5/);
  assert.match(route, /deliverSupportTicket/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /acknowledgeSupportReplies/);
  assert.match(emailServer, /google_apps_script/);
  assert.match(emailServer, /crypto\.subtle\.sign\("HMAC"/);
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
  assert.match(supportServer, /30 \* 24 \* 60 \* 60 \* 1000/);
  const unreadCount = supportServer.slice(
    supportServer.indexOf("export async function readUnreadSupportReplyCount"),
    supportServer.indexOf("export async function acknowledgeSupportReplies"),
  );
  assert.doesNotMatch(
    unreadCount,
    /ensureSupportSchema\(db\)/,
    "page renders must not run DDL on every navigation",
  );
  assert.match(googleBridge, /computeHmacSha256Signature/);
  assert.match(googleBridge, /MailApp\.sendEmail/);
  assert.match(googleBridge, /ARCADIA_SUPPORT_EMAIL/);
});
