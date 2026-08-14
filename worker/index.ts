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

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    const hostDisposition = arcadiaHostDisposition(url.hostname);
    if (hostDisposition === "redirect") {
      const redirect = Response.redirect(canonicalArcadiaUrl(request.url), 308);
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

    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response, url.pathname);
  },
};

function withSecurityHeaders(response: Response, pathname: string) {
  const secured = new Response(response.body, response);
  applyArcadiaSecurityHeaders(secured.headers, true);
  if (pathname.startsWith("/api/")) {
    secured.headers.set("Cache-Control", "private, no-store");
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin")) {
    secured.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return secured;
}

export default worker;
