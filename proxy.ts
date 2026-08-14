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
  let config: ReturnType<typeof readSupabaseAuthConfig>;
  try {
    config = readSupabaseAuthConfig(env);
  } catch {
    return secureResponse(response, request);
  }
  if (!config?.enabled) return secureResponse(response, request);

  let supabase: ReturnType<typeof createServerClient>;
  try {
    supabase = createServerClient(config.url, config.publishableKey, {
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
  } catch {
    return secureResponse(response, request);
  }

  // A rota OAuth/callback pode chegar sem cookie ou com um cookie antigo. A
  // validação é importante, mas nunca deve transformar uma sessão anônima ou
  // um token inválido em um erro 500 do Worker.
  try {
    await supabase.auth.getClaims();
  } catch {
    // Continue as an anonymous request; protected pages perform their own
    // authorization check and redirect to /auth when needed.
  }
  response.headers.set("Cache-Control", "private, no-store");
  return secureResponse(response, request);
}

export const config = {
  matcher: ["/:path*"],
};
