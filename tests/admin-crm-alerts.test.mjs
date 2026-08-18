import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminCrmAlerts } from "../app/admin-crm-alert-rules.ts";

const now = Date.UTC(2026, 7, 17, 12, 0);

test("CRM não transforma liquidações de bloco em alertas operacionais", () => {
  const alerts = buildAdminCrmAlerts({
    now,
    blockEvents: [
      {
        createdAt: now - 10_000,
        id: "ledger-1",
        metadata: { settledBlocks: 2 },
      },
    ],
  });
  assert.equal(alerts.length, 0);
});

test("CRM reúne feedback, tesouraria e antifraude em alertas acionáveis", () => {
  const alerts = buildAdminCrmAlerts({
    now,
    feedbackEvents: [
      { createdAt: now - 4_000, displayName: "Lia", id: "fb-1", status: "new", category: "Minigames" },
    ],
    treasuryEvents: [
      { createdAt: now - 3_000, displayName: "Rui", id: "dep-1", kind: "deposit", status: "waiting_transfer" },
      { createdAt: now - 2_000, displayName: "Nina", id: "wd-1", kind: "withdrawal", status: "requested", asset: "BTC" },
    ],
    securityEvents: [
      { createdAt: now - 1_000, category: "turnstile_failure", displayName: "Conta 7", id: "sec-1", reason: "Validação expirada" },
    ],
  });
  assert.deepEqual(
    alerts.map((alert) => alert.title),
    ["Falha de verificação humana", "Novo saque solicitado", "Depósito pendente", "Novo feedback recebido"],
  );
  assert.deepEqual(
    alerts.map((alert) => alert.category),
    ["operations", "treasury", "treasury", "feedback"],
  );
});

test("CRM mantém depósitos sem confirmação fora do estado recebido", () => {
  const alerts = buildAdminCrmAlerts({
    now,
    treasuryEvents: [
      { createdAt: now - 4_000, displayName: "Lia", id: "waiting-1", kind: "deposit", status: "waiting" },
      { createdAt: now - 3_000, displayName: "Lia", id: "confirming-1", kind: "deposit", status: "confirming" },
      { createdAt: now - 2_000, displayName: "Lia", id: "finished-1", kind: "deposit", status: "finished" },
      { createdAt: now - 1_000, displayName: "Lia", id: "credited-1", kind: "deposit", status: "credited" },
    ],
  });
  assert.deepEqual(
    alerts.map((alert) => alert.title),
    ["Depósito pendente", "Depósito pendente", "Depósito pendente"],
  );
  assert.equal(alerts[0].severity, "attention");
  assert.equal(alerts[2].severity, "attention");
});

test("CRM diferencia chamado novo, em análise e resolvido", () => {
  const alerts = buildAdminCrmAlerts({
    now,
    supportEvents: [
      { createdAt: now - 3_000, publicId: "ARC-001", status: "open", subject: "Dúvida" },
      { createdAt: now - 2_000, publicId: "ARC-002", status: "reviewing", subject: "Pix" },
      { createdAt: now - 1_000, publicId: "ARC-003", status: "resolved", subject: "Acesso" },
    ],
  });
  assert.deepEqual(
    alerts.map((alert) => alert.title),
    [
      "Chamado de suporte em análise",
      "Novo chamado de suporte",
    ],
  );
  assert.ok(alerts.every((alert) => alert.category === "support"));
});

test("CRM remove itens resolvidos e expirados da fila operacional", () => {
  const alerts = buildAdminCrmAlerts({
    now,
    feedbackEvents: [
      { createdAt: now - 4_000, id: "fb-resolved", status: "resolved" },
      { createdAt: now - 3_000, id: "fb-planned", status: "planned" },
    ],
    treasuryEvents: [
      { createdAt: now - 2_000, id: "dep-credited", kind: "deposit", status: "credited" },
      { createdAt: now - 1_000, id: "dep-expired", kind: "deposit", status: "expired" },
      { createdAt: now - 500, id: "withdrawal-paid", kind: "withdrawal", status: "paid" },
    ],
  });
  assert.equal(alerts.length, 0);
});

test("CRM ignora eventos antigos e limita o feed", () => {
  const alerts = buildAdminCrmAlerts({
    limit: 2,
    now,
    supportEvents: [
      { createdAt: now - 25 * 60 * 60 * 1000, publicId: "OLD", status: "open" },
      { createdAt: now - 4_000, publicId: "NEW-1", status: "open" },
      { createdAt: now - 3_000, publicId: "NEW-2", status: "open" },
      { createdAt: now - 2_000, publicId: "NEW-3", status: "open" },
    ],
  });
  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts.map((alert) => alert.reference), ["NEW-3", "NEW-2"]);
});
