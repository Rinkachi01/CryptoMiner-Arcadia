export type CrmAlertSeverity = "info" | "attention" | "success";
export type CrmAlertCategory = "support" | "feedback" | "treasury" | "operations";

export type AdminCrmAlert = {
  category: CrmAlertCategory;
  createdAt: number;
  id: string;
  message: string;
  reference?: string;
  severity: CrmAlertSeverity;
  title: string;
};

export type CrmSupportEvent = {
  createdAt: number;
  email?: string;
  publicId: string;
  status: string;
  subject?: string;
};

export type CrmFeedbackEvent = {
  category?: string;
  createdAt: number;
  displayName?: string;
  id: string;
  message?: string;
  status: string;
};

export type CrmTreasuryEvent = {
  amount?: string;
  asset?: string;
  createdAt: number;
  displayName?: string;
  id: string;
  kind: "deposit" | "withdrawal";
  reference?: string;
  status: string;
};

export type CrmSecurityEvent = {
  category: string;
  createdAt: number;
  displayName?: string;
  id: string;
  reason?: string;
};

export type CrmAuditEvent = {
  action: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function supportTitle(status: string) {
  switch (status) {
    case "reviewing":
      return {
        severity: "attention" as const,
        title: "Chamado de suporte em análise",
      };
    case "resolved":
      return {
        severity: "success" as const,
        title: "Chamado de suporte resolvido",
      };
    case "closed":
      return {
        severity: "success" as const,
        title: "Chamado de suporte encerrado",
      };
    default:
      return {
        severity: "info" as const,
        title: "Novo chamado de suporte",
      };
  }
}

function feedbackTitle(status: string) {
  switch (status) {
    case "reviewing":
      return { severity: "attention" as const, title: "Feedback em análise" };
    case "resolved":
      return { severity: "success" as const, title: "Feedback resolvido" };
    case "planned":
      return { severity: "success" as const, title: "Feedback planejado" };
    default:
      return { severity: "info" as const, title: "Novo feedback recebido" };
  }
}

function treasuryTitle(kind: CrmTreasuryEvent["kind"], status: string) {
  if (kind === "withdrawal") {
    if (status === "reviewing") return { severity: "attention" as const, title: "Saque em análise" };
    if (status === "paid") return { severity: "success" as const, title: "Saque pago" };
    if (status === "rejected") return { severity: "attention" as const, title: "Saque recusado" };
    return { severity: "attention" as const, title: "Novo saque solicitado" };
  }
  if (status === "credited") {
    return { severity: "success" as const, title: "Depósito confirmado" };
  }
  if (
    status === "review_required" ||
    status.includes("failed") ||
    status === "expired" ||
    status.includes("rejected") ||
    status.includes("canceled")
  ) {
    return { severity: "attention" as const, title: "Depósito exige revisão" };
  }
  if (
    [
      "creating",
      "waiting",
      "confirming",
      "confirmed",
      "sending",
      "pending",
      "pending_account",
      "partially_paid",
      "waiting_transfer",
      "finished",
    ].includes(status)
  ) {
    return { severity: "attention" as const, title: "Depósito pendente" };
  }
  return { severity: "info" as const, title: "Novo depósito criado" };
}

function securityTitle(category: string) {
  if (category.toLowerCase().includes("turnstile")) return "Falha de verificação humana";
  if (category.toLowerCase().includes("rate")) return "Limite de segurança atingido";
  return "Revisão antifraude necessária";
}

/**
 * Builds the small, founder-only activity feed shown in the CRM cockpit.
 * The window is intentionally short so old operational details do not become
 * a permanent queue, while the audit log remains the source of truth.
 */
export function buildAdminCrmAlerts(input: {
  auditEvents?: CrmAuditEvent[];
  feedbackEvents?: CrmFeedbackEvent[];
  now: number;
  securityEvents?: CrmSecurityEvent[];
  supportEvents?: CrmSupportEvent[];
  treasuryEvents?: CrmTreasuryEvent[];
  limit?: number;
}): AdminCrmAlert[] {
  const since = input.now - DAY_MS;
  const alerts: AdminCrmAlert[] = [];

  for (const event of input.supportEvents ?? []) {
    if (event.createdAt < since || event.createdAt > input.now) continue;
    const status = supportTitle(event.status);
    const subject = textValue(event.subject) || "Atendimento sem assunto";
    alerts.push({
      category: "support",
      createdAt: event.createdAt,
      id: `support:${event.publicId}:${event.status}:${event.createdAt}`,
      message: `${event.publicId} · ${subject}`,
      reference: event.publicId,
      severity: status.severity,
      title: status.title,
    });
  }

  for (const event of input.feedbackEvents ?? []) {
    if (event.createdAt < since || event.createdAt > input.now) continue;
    const status = feedbackTitle(event.status);
    const source = textValue(event.displayName) || "Operador";
    const category = textValue(event.category);
    alerts.push({
      category: "feedback",
      createdAt: event.createdAt,
      id: `feedback:${event.id}`,
      message: `${source}${category ? ` · ${category}` : ""}${event.message ? ` · ${textValue(event.message).slice(0, 120)}` : ""}`,
      reference: event.id,
      severity: status.severity,
      title: status.title,
    });
  }

  for (const event of input.treasuryEvents ?? []) {
    if (event.createdAt < since || event.createdAt > input.now) continue;
    const status = treasuryTitle(event.kind, event.status);
    const owner = textValue(event.displayName) || "Operador";
    const details = [owner, textValue(event.asset), textValue(event.amount)].filter(Boolean).join(" · ");
    alerts.push({
      category: "treasury",
      createdAt: event.createdAt,
      id: `treasury:${event.kind}:${event.id}:${event.status}`,
      message: details || "Movimentação registrada na tesouraria.",
      reference: event.reference ?? event.id,
      severity: status.severity,
      title: status.title,
    });
  }

  for (const event of input.securityEvents ?? []) {
    if (event.createdAt < since || event.createdAt > input.now) continue;
    const owner = textValue(event.displayName) || "Conta não identificada";
    alerts.push({
      category: "operations",
      createdAt: event.createdAt,
      id: `security:${event.id}`,
      message: `${owner} · ${textValue(event.reason) || "Verifique a fila antifraude."}`,
      reference: event.id,
      severity: "attention",
      title: securityTitle(event.category),
    });
  }

  for (const event of input.auditEvents ?? []) {
    if (event.action !== "support_ticket_updated") continue;
    if (event.createdAt < since || event.createdAt > input.now) continue;
    const metadata = event.metadata ?? {};
    const publicId = textValue(metadata.publicId);
    const statusValue = textValue(metadata.status);
    if (!publicId || !statusValue) continue;
    const status = supportTitle(statusValue);
    alerts.push({
      category: "support",
      createdAt: event.createdAt,
      id: `support-audit:${publicId}:${statusValue}:${event.createdAt}`,
      message: `${publicId} · atualização registrada no protocolo.`,
      reference: publicId,
      severity: status.severity,
      title: status.title,
    });
  }

  const seen = new Set<string>();
  const severityOrder: Record<CrmAlertSeverity, number> = {
    attention: 0,
    info: 1,
    success: 2,
  };
  return alerts
    .sort((first, second) =>
      severityOrder[first.severity] - severityOrder[second.severity] ||
      second.createdAt - first.createdAt,
    )
    .filter((alert) => {
      const key = `${alert.category}:${alert.reference ?? alert.id}:${alert.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, input.limit ?? 30));
}
