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

type SupportReplyTicket = Pick<
  SupportEmailTicket,
  "email" | "publicId" | "subject"
>;

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

async function replyIdempotencyKey(publicId: string, reply: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${publicId}:${reply}`),
  );
  const shortHash = [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `support-reply-${publicId}-${shortHash}`;
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
          <p style="color:#5f6f7b">Abra a Central do Proprietário para responder sem expor o e-mail particular da equipe.</p>
        </div>`,
        reply_to: config.to,
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

export async function deliverSupportReply(
  environment: unknown,
  ticket: SupportReplyTicket,
  reply: string,
) {
  const config = readSupportEmailConfig(environment);
  if (!config.enabled) return { status: "configuration_pending" as const };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": await replyIdempotencyKey(ticket.publicId, reply),
      },
      body: JSON.stringify({
        from: config.from,
        html: `
        <div style="font-family:Arial,sans-serif;color:#17212b;line-height:1.6">
          <p style="color:#55707c;font-size:12px;letter-spacing:1px">CRYPTO MINER ARCADIA</p>
          <h2>Resposta ao protocolo ${escapeHtml(ticket.publicId)}</h2>
          <div style="white-space:pre-wrap;border-left:4px solid #89c52f;background:#f5f8f2;padding:18px">${escapeHtml(reply)}</div>
          <p style="color:#5f6f7b">Você pode responder a este e-mail ou acompanhar o protocolo na Central de Suporte.</p>
          <p style="color:#7f8d94;font-size:12px">O Arcadia nunca solicita senha, chave privada, seed phrase ou código de autenticação.</p>
        </div>`,
        reply_to: config.to,
        subject: `Re: [${ticket.publicId}] ${ticket.subject}`,
        to: [ticket.email],
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
    return { status: "failed" as const, reason: "provider_unavailable" };
  }
}
