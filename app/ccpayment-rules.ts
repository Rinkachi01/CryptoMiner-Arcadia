/**
 * CCPayment configuration and request-signing helpers.
 *
 * This module intentionally does not activate the provider by itself.  The
 * provider is opt-in through CCPAYMENT_ENABLED and credentials must be added
 * as Cloudflare Worker secrets (never committed to source or exposed to the
 * browser).
 */

export type CCPaymentAsset = "BTC" | "DOGE" | "LTC";

export type CCPaymentEnvironment = {
  CCPAYMENT_ENABLED?: string;
  CCPAYMENT_API_BASE_URL?: string;
  CCPAYMENT_CHECKOUT_ENDPOINT?: string;
  CCPAYMENT_CHECKOUT_ENABLED?: string;
  /** Fee (basis points) grossed up at checkout so the merchant target is net. */
  CCPAYMENT_CUSTOMER_FEE_BPS?: string;
  CCPAYMENT_APP_ID?: string;
  CCPAYMENT_APP_SECRET?: string;
  CCPAYMENT_TESTNET_ENABLED?: string;
  PUBLIC_BASE_URL?: string;
};

// CCPayment's merchant API is served from this JSON endpoint.  The web
// console/root domain returns an HTML page (HTTP 200), which is easy to
// mistake for a successful API response when a binding is missing or stale.
const DEFAULT_API_BASE_URL = "https://ccpayment.com/ccpayment/v2";

export type CCPaymentApiVersion = "v1" | "v2";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isTrue(value: unknown) {
  return clean(value).toLowerCase() === "true";
}

function parseFeeBps(value: unknown) {
  const parsed = Number.parseInt(clean(value), 10);
  // Keep this deliberately bounded: a malformed binding must never turn into
  // an unexpectedly large customer charge.
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1_000 ? parsed : 0;
}

function envValue(source: CCPaymentEnvironment, key: keyof CCPaymentEnvironment) {
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

function validApiBaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function canonicalizeApiBaseUrl(value: string) {
  const candidate = clean(value).replace(/\/$/, "");
  if (!candidate) return DEFAULT_API_BASE_URL;
  try {
    const parsed = new URL(candidate);
    // Older staging bindings occasionally contained the CCPayment website
    // root. Keep those bindings from sending `/getCoinList` to an HTML page;
    // only the official merchant API path is used for v2 requests.
    if (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      (parsed.hostname === "ccpayment.com" || parsed.hostname === "www.ccpayment.com") &&
      (parsed.pathname === "" || parsed.pathname === "/")
    ) {
      return DEFAULT_API_BASE_URL;
    }
  } catch {
    // Preserve the value so the normal readiness check fails closed.
  }
  return candidate;
}

export function readCCPaymentConfig(environment: unknown) {
  const source = (environment ?? {}) as CCPaymentEnvironment;
  const enabled = isTrue(envValue(source, "CCPAYMENT_ENABLED"));
  const appId = envValue(source, "CCPAYMENT_APP_ID");
  const appSecret = envValue(source, "CCPAYMENT_APP_SECRET");
  const publicBaseUrl = envValue(source, "PUBLIC_BASE_URL").replace(/\/$/, "");
  const requestedApiBase = envValue(source, "CCPAYMENT_API_BASE_URL");
  const apiBaseUrl = canonicalizeApiBaseUrl(requestedApiBase || DEFAULT_API_BASE_URL);
  const checkoutEndpoint = envValue(source, "CCPAYMENT_CHECKOUT_ENDPOINT");
  const checkoutEnabledRequested = isTrue(
    envValue(source, "CCPAYMENT_CHECKOUT_ENABLED"),
  );
  const customerFeeBps = parseFeeBps(
    envValue(source, "CCPAYMENT_CUSTOMER_FEE_BPS"),
  );
  const appIdConfigured = appId.length >= 8;
  const appSecretConfigured = appSecret.length >= 16;
  const publicBaseUrlConfigured = validPublicBaseUrl(publicBaseUrl);
  const apiBaseUrlConfigured = validApiBaseUrl(apiBaseUrl);
  const checkoutEndpointConfigured = checkoutEndpoint.startsWith("/");
  // A callback assinada pode ser recebida antes de habilitarmos a criação de
  // cobranças. Mantemos as duas capacidades separadas para não ativar
  // pagamentos reais por acidente enquanto o endpoint de checkout ainda não
  // foi confirmado.
  const webhookReady = Boolean(
    enabled &&
      appIdConfigured &&
      appSecretConfigured &&
      publicBaseUrlConfigured &&
      apiBaseUrlConfigured,
  );
  const providerReady = Boolean(
    webhookReady && checkoutEndpointConfigured,
  );

  return {
    enabled,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    appId,
    appIdConfigured,
    appSecret,
    appSecretConfigured,
    checkoutEndpoint,
    checkoutEndpointConfigured,
    apiBaseUrlConfigured,
    publicBaseUrl,
    publicBaseUrlConfigured,
    webhookReady,
    providerReady,
    checkoutEnabled: Boolean(providerReady && checkoutEnabledRequested),
    customerFeeBps,
    testnet: isTrue(envValue(source, "CCPAYMENT_TESTNET_ENABLED")),
  };
}

/**
 * Converts the amount the merchant wants to receive into the amount sent to
 * the provider. Rounding is always upward to cents so the net target is never
 * underpaid by a fractional cent.
 */
export function grossUpCCPaymentUsd(netUsd: number, feeBps: number) {
  if (!Number.isFinite(netUsd) || netUsd < 0) return Number.NaN;
  const safeFeeBps = Number.isInteger(feeBps) && feeBps >= 0 && feeBps < 10_000
    ? feeBps
    : 0;
  const feeRate = safeFeeBps / 10_000;
  return Math.ceil((netUsd / (1 - feeRate)) * 100) / 100;
}

export function ccpaymentFeeUsd(grossUsd: number, netUsd: number) {
  if (!Number.isFinite(grossUsd) || !Number.isFinite(netUsd)) return Number.NaN;
  return Math.max(0, Math.round((grossUsd - netUsd) * 100) / 100);
}

/**
 * Gross up a crypto amount in its smallest unit so the merchant target is
 * still net after the customer-funded CCPayment fee.  Integer arithmetic is
 * intentional here: floating point rounding must never create or remove
 * satoshis/litoshis/dogecoins from a checkout.
 */
export function grossUpCCPaymentAtomic(netAtomic: number, feeBps: number) {
  if (!Number.isSafeInteger(netAtomic) || netAtomic <= 0) return null;
  const safeFeeBps = Number.isInteger(feeBps) && feeBps >= 0 && feeBps < 10_000
    ? feeBps
    : 0;
  const numerator = BigInt(netAtomic) * 10_000n;
  const denominator = BigInt(10_000 - safeFeeBps);
  const gross = (numerator + denominator - 1n) / denominator;
  if (gross > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(gross);
}

export function ccpaymentFeeAtomic(grossAtomic: number, netAtomic: number) {
  if (!Number.isSafeInteger(grossAtomic) || !Number.isSafeInteger(netAtomic)) return null;
  const fee = grossAtomic - netAtomic;
  return fee >= 0 ? fee : null;
}

export function isCCPaymentAsset(value: unknown): value is CCPaymentAsset {
  return value === "BTC" || value === "DOGE" || value === "LTC";
}

export function normalizeCCPaymentStatus(value: unknown) {
  const normalized = clean(value).toLowerCase();
  switch (normalized) {
    case "successful":
    case "success":
    case "paid":
    case "completed":
      return "finished" as const;
    case "pending":
    case "waiting":
    case "processing":
      return "pending" as const;
    case "failed":
    case "failure":
    case "expired":
    case "cancelled":
    case "canceled":
      return "failed" as const;
    default:
      return "unknown" as const;
  }
}

/** CCPayment requires SHA-256(APPID + APP Secret + timestamp + body string). */
export async function signCCPaymentRequest(input: {
  appId: string;
  appSecret: string;
  timestamp: string;
  body: string;
}) {
  const data = `${input.appId}${input.appSecret}${input.timestamp}${input.body}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * CCPayment's v1 documentation describes a plain SHA-256 concatenation, but
 * the current dashboard/webhook sender has also been observed using the
 * HMAC-SHA256 form used by its newer API examples.  Both forms still require
 * the app secret and are safe to accept during this compatibility window.
 */
async function signCCPaymentHmacRequest(input: {
  appId: string;
  appSecret: string;
  timestamp: string;
  body: string;
}) {
  const message = `${input.appId}${input.timestamp}${input.body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createCCPaymentHeaders(input: {
  appId: string;
  appSecret: string;
  body: string;
  nowMs?: number;
  version?: CCPaymentApiVersion;
}) {
  const timestamp = String(Math.floor((input.nowMs ?? Date.now()) / 1000));
  const sign = input.version === "v2"
    ? await signCCPaymentHmacRequest({
        appId: input.appId,
        appSecret: input.appSecret,
        timestamp,
        body: input.body,
      })
    : await signCCPaymentRequest({
        appId: input.appId,
        appSecret: input.appSecret,
        timestamp,
        body: input.body,
      });
  return {
    Appid: input.appId,
    Timestamp: timestamp,
    Sign: sign,
    // Match CCPayment's SDK spelling exactly; some edge deployments are strict
    // about the JSON media type on signed requests.
    "Content-Type": "application/json;charset=utf-8",
  };
}

export function ccpaymentApiVersion(apiBaseUrl: string): CCPaymentApiVersion {
  return /\/v2\/?$/i.test(apiBaseUrl.trim()) ? "v2" : "v1";
}

export async function verifyCCPaymentResponse(input: {
  appId: string;
  appSecret: string;
  timestamp: string;
  body: string;
  signature: string;
}) {
  if (!/^[a-f0-9]{64}$/i.test(input.signature)) {
    return false;
  }
  const normalizedSignature = input.signature.toLowerCase();
  const candidates = [
    await signCCPaymentRequest(input),
    await signCCPaymentHmacRequest(input),
  ];
  for (const expected of candidates) {
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected.charCodeAt(index) ^ normalizedSignature.charCodeAt(index);
    }
    if (difference === 0) return true;
  }
  return false;
}

export function validCCPaymentCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const allowedHost =
      url.hostname === "ccpayment.com" ||
      url.hostname.endsWith(".ccpayment.com") ||
      url.hostname === "cwallet.com" ||
      url.hostname.endsWith(".cwallet.com");
    if (url.protocol !== "https:" || !allowedHost) return null;
    return url.toString();
  } catch {
    return null;
  }
}
