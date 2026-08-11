type MercadoPagoEnvironment = {
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  MERCADO_PAGO_API_BASE_URL?: string;
  MERCADO_PAGO_ENVIRONMENT?: string;
  MERCADO_PAGO_WEBHOOK_SECRET?: string;
  PIX_DEPOSITS_ENABLED?: string;
  PIX_OPERATIONAL_MARGIN_BPS?: string;
  PUBLIC_BASE_URL?: string;
};

function value(source: MercadoPagoEnvironment, key: keyof MercadoPagoEnvironment) {
  return typeof source[key] === "string" ? source[key]!.trim() : "";
}

function validHttpsUrl(input: string, allowedHost: string) {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.hostname === allowedHost;
  } catch {
    return false;
  }
}

export function readMercadoPagoConfig(environment: unknown) {
  const source = (environment ?? {}) as MercadoPagoEnvironment;
  const apiBaseCandidate = value(source, "MERCADO_PAGO_API_BASE_URL");
  const apiBaseUrl = validHttpsUrl(apiBaseCandidate, "api.mercadopago.com")
    ? apiBaseCandidate.replace(/\/$/, "")
    : "https://api.mercadopago.com";
  const accessToken = value(source, "MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = value(source, "MERCADO_PAGO_WEBHOOK_SECRET");
  const publicBaseUrl = value(source, "PUBLIC_BASE_URL");
  const requested = value(source, "PIX_DEPOSITS_ENABLED").toLowerCase() === "true";
  const mode = value(source, "MERCADO_PAGO_ENVIRONMENT").toLowerCase() === "production"
    ? ("production" as const)
    : ("test" as const);
  const rawMargin = Number(value(source, "PIX_OPERATIONAL_MARGIN_BPS") || 300);
  const operationalMarginBps = Number.isInteger(rawMargin)
    ? Math.min(2_000, Math.max(0, rawMargin))
    : 300;
  let publicBaseUrlConfigured = false;
  try {
    publicBaseUrlConfigured = new URL(publicBaseUrl).protocol === "https:";
  } catch {
    publicBaseUrlConfigured = false;
  }
  const accessTokenConfigured = accessToken.length >= 24;
  const webhookSecretConfigured = webhookSecret.length >= 16;
  const providerReady =
    accessTokenConfigured && webhookSecretConfigured && publicBaseUrlConfigured;

  return {
    accessToken,
    accessTokenConfigured,
    apiBaseUrl,
    enabled: requested && providerReady,
    mode,
    operationalMarginBps,
    providerReady,
    publicBaseUrl,
    publicBaseUrlConfigured,
    requested,
    webhookSecret,
    webhookSecretConfigured,
  };
}

function signatureParts(value: string) {
  const result = new Map<string, string>();
  for (const part of value.split(",")) {
    const [key, raw] = part.split("=", 2);
    if (key && raw) result.set(key.trim(), raw.trim());
  }
  return { timestamp: result.get("ts") ?? "", signature: result.get("v1") ?? "" };
}

function bytesToHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function safeHexEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export async function verifyMercadoPagoWebhook(input: {
  dataId: string;
  requestId: string;
  secret: string;
  signatureHeader: string;
}) {
  const dataId = input.dataId.trim().toLowerCase();
  const requestId = input.requestId.trim();
  const { timestamp, signature } = signatureParts(input.signatureHeader);
  if (
    !/^[a-z0-9_-]{6,128}$/.test(dataId) ||
    !/^[A-Za-z0-9-]{6,128}$/.test(requestId) ||
    !/^\d{10,16}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    input.secret.length < 16
  ) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const expected = bytesToHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)),
  );
  return safeHexEqual(signature.toLowerCase(), expected);
}
