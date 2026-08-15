import type { SupportCategory } from "./support-rules.ts";
import { supportCategoryLabels } from "./support-rules.ts";

type SupportEmailEnvironment = {
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  GOOGLE_MAIL_WEBHOOK_SECRET?: string;
  GOOGLE_MAIL_WEBHOOK_URL?: string;
  RESEND_API_KEY?: string;
  SUPPORT_EMAIL_TO?: string;
  TRANSACTIONAL_EMAIL_ENABLED?: string;
};

type SupportEmailProvider = "google_apps_script" | "resend";

type SupportEmailMessage = {
  html: string;
  idempotencyKey: string;
  replyTo: string;
  subject: string;
  to: string;
  type: "reply" | "ticket" | "verification";
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
  const googleWebhookSecret = setting(source.GOOGLE_MAIL_WEBHOOK_SECRET);
  const googleWebhookUrl = setting(source.GOOGLE_MAIL_WEBHOOK_URL);
  const to = setting(source.SUPPORT_EMAIL_TO);
  const provider: SupportEmailProvider =
    setting(source.EMAIL_PROVIDER).toLowerCase() === "google_apps_script"
      ? "google_apps_script"
      : "resend";
  const requested =
    setting(source.TRANSACTIONAL_EMAIL_ENABLED).toLowerCase() === "true";
  const resendReady = Boolean(apiKey && from && to);
  const googleReady = Boolean(
    googleWebhookSecret.length >= 32 &&
      googleWebhookUrl.startsWith("https://script.google.com/") &&
      googleWebhookUrl.includes("/macros/s/") &&
      googleWebhookUrl.endsWith("/exec") &&
      to,
  );
  return {
    apiKey,
    enabled: Boolean(
      requested &&
        (provider === "google_apps_script" ? googleReady : resendReady),
    ),
    from,
    googleWebhookSecret,
    googleWebhookUrl,
    googleReady,
    provider,
    requested,
    resendReady,
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

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function signGoogleBridgePayload(
  secret: string,
  timestamp: number,
  idempotencyKey: string,
  message: SupportEmailMessage,
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const canonical = `${timestamp}.${idempotencyKey}.${JSON.stringify(message)}`;
  return bytesToHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(canonical)),
  );
}

async function deliverWithGoogleBridge(
  config: ReturnType<typeof readSupportEmailConfig>,
  message: SupportEmailMessage,
) {
  const timestamp = Date.now();
  const signature = await signGoogleBridgePayload(
    config.googleWebhookSecret,
    timestamp,
    message.idempotencyKey,
    message,
  );
  const response = await fetch(config.googleWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: message.idempotencyKey,
      message,
      signature,
      timestamp,
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
  });
  const result = (await response.json().catch(() => null)) as
    | { error?: string; id?: string; ok?: boolean }
    | null;
  if (!response.ok || !result?.ok || !result.id) {
    return {
      status: "failed" as const,
      reason: setting(result?.error).slice(0, 180) || `HTTP ${response.status}`,
    };
  }
  return { status: "sent" as const, providerId: result.id };
}

async function deliverWithResend(
  config: ReturnType<typeof readSupportEmailConfig>,
  message: SupportEmailMessage,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.from,
      html: message.html,
      reply_to: message.replyTo,
      subject: message.subject,
      to: [message.to],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  const result = (await response.json().catch(() => null)) as
    | { id?: string; message?: string }
    | null;
  if (!response.ok || !result?.id) {
    return {
      status: "failed" as const,
      reason: setting(result?.message).slice(0, 180) || `HTTP ${response.status}`,
    };
  }
  return { status: "sent" as const, providerId: result.id };
}

async function deliverSupportEmail(
  config: ReturnType<typeof readSupportEmailConfig>,
  message: SupportEmailMessage,
) {
  return config.provider === "google_apps_script"
    ? deliverWithGoogleBridge(config, message)
    : deliverWithResend(config, message);
}

export async function deliverSupportTicket(
  environment: unknown,
  ticket: SupportEmailTicket,
) {
  const config = readSupportEmailConfig(environment);
  if (!config.enabled) return { status: "configuration_pending" as const };

  try {
    return await deliverSupportEmail(config, {
      type: "ticket",
      to: config.to,
      replyTo: config.to,
      idempotencyKey: `support-ticket-${ticket.publicId}`,
      subject: `[${ticket.publicId}] ${ticket.subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#17212b;line-height:1.55">
          <h2>Novo chamado ${escapeHtml(ticket.publicId)}</h2>
          <p><strong>Categoria:</strong> ${escapeHtml(supportCategoryLabels[ticket.category])}</p>
          <p><strong>Conta:</strong> ${escapeHtml(ticket.email)}</p>
          <p><strong>Título:</strong> ${escapeHtml(ticket.subject)}</p>
          <div style="white-space:pre-wrap;border:1px solid #d7e0e7;padding:16px">${escapeHtml(ticket.message)}</div>
          <p style="color:#5f6f7b">Abra a Central do Proprietário para responder sem expor o e-mail particular da equipe.</p>
        </div>`,
    });
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
    return await deliverSupportEmail(config, {
      type: "reply",
      to: ticket.email,
      replyTo: config.to,
      idempotencyKey: await replyIdempotencyKey(ticket.publicId, reply),
      subject: `Re: [${ticket.publicId}] ${ticket.subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#17212b;line-height:1.6">
          <p style="color:#55707c;font-size:12px;letter-spacing:1px">CRYPTO MINER ARCADIA</p>
          <h2>Resposta ao protocolo ${escapeHtml(ticket.publicId)}</h2>
          <div style="white-space:pre-wrap;border-left:4px solid #89c52f;background:#f5f8f2;padding:18px">${escapeHtml(reply)}</div>
          <p style="color:#5f6f7b">Você pode responder a este e-mail ou acompanhar o protocolo na Central de Suporte.</p>
          <p style="color:#7f8d94;font-size:12px">O Arcadia nunca solicita senha, chave privada, seed phrase ou código de autenticação.</p>
        </div>`,
    });
  } catch {
    return { status: "failed" as const, reason: "provider_unavailable" };
  }
}

export async function deliverEmailCycleCode(
  environment: unknown,
  details: {
    accountId: string;
    code: string;
    email: string;
    expiresAt: number;
    cycleKey: string;
  },
) {
  const config = readSupportEmailConfig(environment);
  if (!config.enabled) return { status: "configuration_pending" as const };

  const codeHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `${details.accountId}:${details.cycleKey}:${details.code}`,
    ),
  );
  // The existing Google Apps Script bridge intentionally accepts only the
  // support-ticket/reply envelope. A cycle code is a reply-style message to
  // the verified account, so keep the bridge contract compatible without
  // weakening its validation rules.
  const idempotencyKey = `support-reply-emailcycle-${details.accountId}-${details.cycleKey}-${bytesToHex(codeHash).slice(0, 16)}`;
  const expiresInMinutes = Math.max(
    1,
    Math.ceil((details.expiresAt - Date.now()) / 60_000),
  );

  try {
    return await deliverSupportEmail(config, {
      type: "reply",
      to: details.email,
      replyTo: config.to,
      idempotencyKey,
      subject: "Seu código de verificação do Arcadia",
      html: `
        <div style="font-family:Arial,sans-serif;color:#17212b;line-height:1.6;max-width:560px">
          <p style="color:#55707c;font-size:12px;letter-spacing:1px">CRYPTO MINER ARCADIA</p>
          <h2>Confirme seu acesso</h2>
          <p>Para continuar no Arcadia neste novo ciclo do servidor, informe o código abaixo:</p>
          <div style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;border:1px solid #d7e0e7;background:#f5f8f2;padding:18px;margin:24px 0">${escapeHtml(details.code)}</div>
          <p>Este código expira em aproximadamente <strong>${expiresInMinutes} minutos</strong> e pode ser usado uma única vez.</p>
          <p style="color:#7f8d94;font-size:12px">Se você não iniciou este acesso, ignore esta mensagem. O Arcadia nunca solicita senha, chave privada, seed phrase ou código de autenticação pelo suporte.</p>
        </div>`,
    });
  } catch {
    return { status: "failed" as const, reason: "provider_unavailable" };
  }
}
