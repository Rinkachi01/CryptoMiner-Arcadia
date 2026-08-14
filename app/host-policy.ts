export const ARCADIA_CANONICAL_HOST = "cryptominerarcadia.com";
export const ARCADIA_WWW_HOST = `www.${ARCADIA_CANONICAL_HOST}`;

export type ArcadiaHostDisposition = "allow" | "redirect" | "block";

function normalizeHost(host: string | null | undefined) {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

/**
 * The production surface is intentionally limited to the purchased domain.
 * Local hosts can be enabled only by the development proxy, never by Worker.
 */
export function arcadiaHostDisposition(
  host: string | null | undefined,
  options: {
    allowDevHosts?: boolean;
    allowedHosts?: readonly string[];
  } = {},
): ArcadiaHostDisposition {
  const normalized = normalizeHost(host);
  if (normalized === ARCADIA_CANONICAL_HOST) return "allow";
  if (normalized === ARCADIA_WWW_HOST) return "redirect";

  if (
    options.allowedHosts?.some(
      (allowedHost) => normalizeHost(allowedHost) === normalized,
    )
  ) {
    return "allow";
  }

  if (
    options.allowDevHosts &&
    (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]")
  ) {
    return "allow";
  }

  return "block";
}

export function canonicalArcadiaUrl(requestUrl: string) {
  const url = new URL(requestUrl);
  url.hostname = ARCADIA_CANONICAL_HOST;
  return url;
}
