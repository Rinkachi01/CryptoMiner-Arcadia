/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RECOVERY_ARCHIVE: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) {
        return Response.json({ error: "Origem da solicitação recusada." }, { status: 403 });
      }
      const contentLength = Number(request.headers.get("Content-Length") ?? 0);
      if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
        return Response.json({ error: "Solicitação acima do limite permitido." }, { status: 413 });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(imageResponse, url.pathname);
    }

    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response, url.pathname);
  },
};

function withSecurityHeaders(response: Response, pathname: string) {
  const secured = new Response(response.body, response);
  secured.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", "DENY");
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin")) {
    secured.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return secured;
}

export default worker;
