import type { SupportCategory } from "./support-rules";
import { supportCategoryLabels } from "./support-rules";

type SupportEmailEnvironment = {
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  SUPPORT_EMAIL_TO?: string;
  TRANSACTIONAL_EMAIL_ENABLED?: string;
};

type SupportEmailTicket = {
  category: SupportCategory;
  email: string;
  message: string;
  publicId: string;
  subject: string;
};

function setting(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readSupportEmailConfig(environment: unknown) {
  const source = (environment ?? {}) as SupportEmailEnvironment;
  const apiKey = setting(source.RESEND_API_KEY);
  const from = setting(source.EMAIL_FROM);
  const to = setting(source.SUPPORT_EMAIL_TO);
  const requested =
    setting(source.TRANSACTIONAL_EMAIL_ENABLED).toLowerCase() === "true";
  return {
    apiKey,
    enabled: Boolean(requested && apiKey && from && to),
    from,
    requested,
    to,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function deliverSupportTicket(
  environment: unknown,
  ticket: SupportEmailTicket,
) {
  const config = readSupportEmailConfig(environment);
  if (!config.enabled) return { status: "configuration_pending" as const };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        html: `
        <div style="font-family:Arial,sans-serif;color:#17212b;line-height:1.55">
          <h2>Novo chamado ${escapeHtml(ticket.publicId)}</h2>
          <p><strong>Categoria:</strong> ${escapeHtml(supportCategoryLabels[ticket.category])}</p>
          <p><strong>Conta:</strong> ${escapeHtml(ticket.email)}</p>
          <p><strong>Título:</strong> ${escapeHtml(ticket.subject)}</p>
          <div style="white-space:pre-wrap;border:1px solid #d7e0e7;padding:16px">${escapeHtml(ticket.message)}</div>
          <p style="color:#5f6f7b">Responda diretamente a esta mensagem para falar com o jogador.</p>
        </div>`,
        reply_to: ticket.email,
        subject: `[${ticket.publicId}] ${ticket.subject}`,
        to: [config.to],
      }),
    });
    const result = (await response.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;
    if (!response.ok || !result?.id) {
      return {
        status: "failed" as const,
        reason:
          setting(result?.message).slice(0, 180) || `HTTP ${response.status}`,
      };
    }
    return { status: "sent" as const, providerId: result.id };
  } catch {
    return {
      status: "failed" as const,
      reason: "provider_unavailable",
    };
  }
}
