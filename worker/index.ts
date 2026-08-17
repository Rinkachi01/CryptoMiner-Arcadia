/** Cloudflare Worker entry point for the vinext-starter template. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  applyArcadiaSecurityHeaders,
  isRejectedCrossSiteApiMutation,
} from "../app/http-security";
import {
  arcadiaHostDisposition,
  canonicalArcadiaUrl,
} from "../app/host-policy";

interface Env {
  ASSETS: Fetcher;
  ARCADIA_ALLOWED_HOSTS?: string;
  DB: D1Database;
  RECOVERY_ARCHIVE: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{
          response(): Response;
        }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function hasSupabaseSession(request: Request) {
  const cookie = request.headers.get("Cookie") ?? "";
  return /(?:^|;\s*)sb-[^-]+(?:-[^-]+)*-auth-token(?:\.|=|;|$)/i.test(cookie);
}

function isAnonymousLandingRequest(request: Request, url: URL) {
  return (
    request.method === "GET" &&
    url.pathname === "/" &&
    url.search === "" &&
    !hasSupabaseSession(request)
  );
}

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    const allowedHosts = (env.ARCADIA_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean);
    const hostDisposition = arcadiaHostDisposition(url.hostname, {
      allowedHosts,
    });
    if (hostDisposition === "redirect") {
      // Response.redirect() exposes immutable headers in the Workers runtime.
      // Build the redirect explicitly so the shared security headers can be
      // added without throwing a "Can't modify immutable headers" exception.
      const redirect = new Response(null, {
        status: 308,
        headers: {
          Location: canonicalArcadiaUrl(request.url).toString(),
        },
      });
      applyArcadiaSecurityHeaders(redirect.headers, true);
      return redirect;
    }
    if (hostDisposition === "block") {
      const blocked = new Response("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
      applyArcadiaSecurityHeaders(blocked.headers, true);
      return blocked;
    }

    // Keep the same-origin check at the Worker boundary as well as in the
    // framework proxy, so direct Worker requests receive the same protection.
    if (
      isRejectedCrossSiteApiMutation({
        fetchSite: request.headers.get("Sec-Fetch-Site"),
        method: request.method,
        origin: request.headers.get("Origin"),
        pathname: url.pathname,
        requestOrigin: url.origin,
      })
    ) {
      return Response.json(
        { error: "Origem da solicitacao recusada." },
        { status: 403 },
      );
    }

    if (
      url.pathname.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method)
    ) {
      const contentLength = Number(
        request.headers.get("Content-Length") ?? 0,
      );
      if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
        return Response.json(
          { error: "Solicitacao acima do limite permitido." },
          { status: 413 },
        );
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
      return withSecurityHeaders(imageResponse, url.pathname);
    }

    // The public landing page is identical for anonymous visitors. A short
    // edge cache shields the SSR route (and its auth check) from ad crawlers
    // and traffic bursts while keeping authenticated pages uncached.
    const cacheableLanding = isAnonymousLandingRequest(request, url);
    const landingCacheKey = cacheableLanding
      ? new Request(new URL("/", request.url).toString(), { method: "GET" })
      : null;
    if (landingCacheKey) {
      const cached = await caches.default.match(landingCacheKey);
      if (cached) return withSecurityHeaders(cached, url.pathname, request);
    }

    const response = await handler.fetch(request, env, ctx);
    if (
      landingCacheKey &&
      response.ok &&
      !response.headers.has("Set-Cookie")
    ) {
      const cachedResponse = new Response(response.body, response);
      cachedResponse.headers.set(
        "Cache-Control",
        "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
      );
      ctx.waitUntil(caches.default.put(landingCacheKey, cachedResponse.clone()));
      return withSecurityHeaders(cachedResponse, url.pathname, request);
    }
    return withSecurityHeaders(response, url.pathname, request);
  },
};

function withSecurityHeaders(
  response: Response,
  pathname: string,
  request?: Request,
) {
  const secured = new Response(response.body, response);
  applyArcadiaSecurityHeaders(secured.headers, true);
  // Vite emits hashed filenames for JS/CSS chunks. They are safe to cache for
  // a year because a new deployment always gets a new URL; this avoids
  // repeated downloads after navigation without caching any authenticated
  // HTML or API response. Non-hashed public assets get a shorter cache window
  // so future art changes are picked up promptly.
  const isPublicAsset = pathname.startsWith("/assets/");
  const isFingerprintedAsset =
    isPublicAsset &&
    /\/[^/]+-[A-Za-z0-9_-]{7,}\.[A-Za-z0-9]+$/.test(pathname);
  if (isFingerprintedAsset) {
    secured.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  } else if (isPublicAsset) {
    secured.headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
  }
  if (pathname.startsWith("/api/")) {
    secured.headers.set("Cache-Control", "private, no-store");
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin")) {
    secured.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  if (
    pathname === "/" &&
    request &&
    isAnonymousLandingRequest(request, new URL(request.url)) &&
    !secured.headers.has("Set-Cookie")
  ) {
    secured.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
    );
  }
  return secured;
}

export default worker;
