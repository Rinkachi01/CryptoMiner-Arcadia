import { createServerClient } from "@supabase/ssr";
import { env } from "cloudflare:workers";
import { NextResponse, type NextRequest } from "next/server";
import {
  applyArcadiaSecurityHeaders,
  isRejectedCrossSiteApiMutation,
} from "./app/http-security.ts";
import {
  arcadiaHostDisposition,
  canonicalArcadiaUrl,
} from "./app/host-policy.ts";
import { readSupabaseAuthConfig } from "./app/supabase-config.ts";

function secureResponse(response: NextResponse, request: NextRequest) {
  applyArcadiaSecurityHeaders(
    response.headers,
    request.nextUrl.protocol === "https:",
  );
  return response;
}

export async function proxy(request: NextRequest) {
  const allowedHosts =
    typeof env.ARCADIA_ALLOWED_HOSTS === "string"
      ? env.ARCADIA_ALLOWED_HOSTS.split(",")
          .map((host) => host.trim())
          .filter(Boolean)
      : [];
  const disposition = arcadiaHostDisposition(request.nextUrl.hostname, {
    allowDevHosts: process.env.NODE_ENV !== "production",
    allowedHosts,
  });
  if (disposition === "redirect") {
    return secureResponse(
      NextResponse.redirect(canonicalArcadiaUrl(request.url), 308),
      request,
    );
  }
  if (disposition === "block") {
    return secureResponse(
      new NextResponse("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      }),
      request,
    );
  }

  if (
    isRejectedCrossSiteApiMutation({
      fetchSite: request.headers.get("sec-fetch-site"),
      method: request.method,
      origin: request.headers.get("origin"),
      pathname: request.nextUrl.pathname,
      requestOrigin: request.nextUrl.origin,
    })
  ) {
    return secureResponse(
      NextResponse.json(
        { error: "Ação recusada por origem inválida." },
        { status: 403 },
      ),
      request,
    );
  }

  let response = NextResponse.next({ request });
  const config = readSupabaseAuthConfig(env);
  if (!config?.enabled) return secureResponse(response, request);

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Valida o token e renova a sessão antes de qualquer resposta autenticada.
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return secureResponse(response, request);
}

export const config = {
  matcher: ["/:path*"],
};
