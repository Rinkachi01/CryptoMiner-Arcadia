const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// These endpoints are machine-to-machine callbacks. They must not be forced
// to send a browser Origin header; their own handlers validate the provider
// signature, payload, reference and idempotency before changing balances.
const SIGNED_WEBHOOK_PATHS = new Set([
  "/api/wallet/mercadopago",
  "/api/wallet/nowpayments",
  "/api/wallet/ccpayment",
]);

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
].join("; ");

export function isRejectedCrossSiteApiMutation(input: {
  fetchSite: string | null;
  method: string;
  origin: string | null;
  requestOrigin: string;
  pathname: string;
}) {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;
  if (!input.pathname.startsWith("/api/")) return false;

  // A browser mutation must carry an origin that we can compare with the
  // request host. This closes the CSRF gap where a forged form/request omits
  // both Origin and Sec-Fetch-Site. Signed payment callbacks are the only
  // intentional exception and are protected by their route-level signature
  // checks.
  if (!input.origin && !SIGNED_WEBHOOK_PATHS.has(input.pathname)) return true;
  if (input.fetchSite?.toLowerCase() === "cross-site") return true;
  if (!input.origin) return false;
  try {
    return new URL(input.origin).origin !== input.requestOrigin;
  } catch {
    return true;
  }
}

export function applyArcadiaSecurityHeaders(headers: Headers, isHttps: boolean) {
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-Download-Options", "noopen");
  headers.set("Origin-Agent-Cluster", "?1");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  if (isHttps) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
}
