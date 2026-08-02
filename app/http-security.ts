const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isRejectedCrossSiteApiMutation(input: {
  fetchSite: string | null;
  method: string;
  origin: string | null;
  requestOrigin: string;
  pathname: string;
}) {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;
  if (!input.pathname.startsWith("/api/")) return false;
  if (input.fetchSite?.toLowerCase() === "cross-site") return true;
  if (!input.origin) return false;
  try {
    return new URL(input.origin).origin !== input.requestOrigin;
  } catch {
    return true;
  }
}

export function applyArcadiaSecurityHeaders(headers: Headers, isHttps: boolean) {
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  if (isHttps) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }
}
