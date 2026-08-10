export type NowPaymentsAsset = "BTC" | "DOGE";

export type NowPaymentsEnvironment = {
  CRYPTO_DEPOSITS_ENABLED?: string;
  CRYPTO_LIVE_DEPOSITS_ENABLED?: string;
  NOWPAYMENTS_API_BASE_URL?: string;
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
  PUBLIC_BASE_URL?: string;
};

const PRODUCTION_API = "https://api.nowpayments.io/v1";
const SANDBOX_API = "https://api-sandbox.nowpayments.io/v1";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function enabled(value: unknown) {
  return clean(value).toLowerCase() === "true";
}

function environmentValue(
  source: NowPaymentsEnvironment,
  key: keyof NowPaymentsEnvironment,
) {
  const bindingValue = clean(source[key]);
  if (bindingValue) return bindingValue;
  return typeof process !== "undefined" ? clean(process.env[key]) : "";
}

function validPublicBaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function readNowPaymentsConfig(environment: unknown) {
  const source = (environment ?? {}) as NowPaymentsEnvironment;
  const apiKey = environmentValue(source, "NOWPAYMENTS_API_KEY");
  const ipnSecret = environmentValue(source, "NOWPAYMENTS_IPN_SECRET");
  const publicBaseUrl = environmentValue(source, "PUBLIC_BASE_URL").replace(
    /\/$/,
    "",
  );
  const requestedApiBase = environmentValue(
    source,
    "NOWPAYMENTS_API_BASE_URL",
  );
  const depositsFlag = environmentValue(source, "CRYPTO_DEPOSITS_ENABLED");
  const liveDepositsFlag = environmentValue(
    source,
    "CRYPTO_LIVE_DEPOSITS_ENABLED",
  );
  const productionRequested = requestedApiBase === PRODUCTION_API;
  const apiBaseUrl = productionRequested ? PRODUCTION_API : SANDBOX_API;
  const apiKeyConfigured = apiKey.length >= 24;
  const ipnSecretConfigured = ipnSecret.length >= 16;
  const publicBaseUrlConfigured = validPublicBaseUrl(publicBaseUrl);
  const providerReady = Boolean(
    apiKeyConfigured && ipnSecretConfigured && publicBaseUrlConfigured,
  );
  const sandbox = apiBaseUrl === SANDBOX_API;
  const activationRequested =
    enabled(depositsFlag) || (!depositsFlag && providerReady && sandbox);
  const liveActivationRequested = enabled(liveDepositsFlag);
  return {
    activationRequested,
    apiBaseUrl,
    apiKeyConfigured,
    apiKey,
    depositsEnabled:
      providerReady &&
      activationRequested &&
      (sandbox || liveActivationRequested),
    ipnSecret,
    ipnSecretConfigured,
    liveActivationRequested,
    providerReady,
    publicBaseUrl,
    publicBaseUrlConfigured,
    sandbox,
  };
}

export function isNowPaymentsAsset(value: unknown): value is NowPaymentsAsset {
  return value === "BTC" || value === "DOGE";
}

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, item]) => [key, sortCanonical(item)]),
  );
}

export function canonicalNowPaymentsPayload(payload: unknown) {
  return JSON.stringify(sortCanonical(payload));
}

function bytesToHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha512(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-512", name: "HMAC" },
    false,
    ["sign"],
  );
  return bytesToHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

async function secureHexEqual(first: string, second: string) {
  if (!/^[a-f0-9]{128}$/i.test(first) || !/^[a-f0-9]{128}$/i.test(second)) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < first.length; index += 2) {
    const firstByte = Number.parseInt(first.slice(index, index + 2), 16);
    const secondByte = Number.parseInt(second.slice(index, index + 2), 16);
    difference |= firstByte ^ secondByte;
  }
  return difference === 0;
}

export async function signNowPaymentsPayload(payload: unknown, secret: string) {
  return hmacSha512(canonicalNowPaymentsPayload(payload), secret);
}

export async function verifyNowPaymentsPayload(input: {
  payload: unknown;
  secret: string;
  signature: string;
}) {
  if (!input.secret || !input.signature) return false;
  const expected = await signNowPaymentsPayload(input.payload, input.secret);
  return secureHexEqual(expected, input.signature);
}

export function normalizeNowPaymentsStatus(value: unknown) {
  switch (value) {
    case "waiting":
    case "confirming":
    case "confirmed":
    case "sending":
    case "partially_paid":
    case "finished":
    case "failed":
    case "refunded":
    case "expired":
      return value;
    default:
      return "unknown" as const;
  }
}

export function validNowPaymentsCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const allowedHost =
      url.hostname === "nowpayments.io" ||
      url.hostname.endsWith(".nowpayments.io") ||
      url.hostname === "nowpayments.app" ||
      url.hostname.endsWith(".nowpayments.app");
    if (url.protocol !== "https:" || !allowedHost) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
