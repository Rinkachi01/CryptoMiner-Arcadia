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
import { accountIdForVerifiedEmail } from "./app/identity-rules.ts";
import {
  emailCycleIsEnabled,
  ensureEmailCycleSchema,
  readEmailCycleStatus,
} from "./app/email-cycle-server.ts";
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
  let claimsAuthenticated = false;
  let claimsEmail = "";
  try {
    const claims = await supabase.auth.getClaims();
    claimsAuthenticated = Boolean(claims.data?.claims?.sub);
    const emailClaim = claims.data?.claims?.email;
    claimsEmail =
      typeof emailClaim === "string" ? emailClaim.trim().toLowerCase() : "";
  } catch {
    // Continue as an anonymous request; protected pages perform their own
    // authorization check and redirect to /auth when needed.
  }

  // Once a user has a verified factor, every protected request must carry an
  // AAL2 session. The login form and OAuth callback also perform this check,
  // but the proxy closes the bypass where an old AAL1 session navigated
  // directly to the game or called an API without entering the code.
  const pathname = request.nextUrl.pathname;
  const isAuthFlow = pathname === "/auth" || pathname.startsWith("/auth/");
  const isEmailCycleFlow = pathname === "/api/auth/email-cycle";
  if (claimsAuthenticated && !isAuthFlow && !isEmailCycleFlow) {
    let assuranceKnown = false;
    let mfaConfigured = false;
    try {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      assuranceKnown = !assurance.error;
      mfaConfigured = assurance.data?.nextLevel === "aal2";
      if (
        !assurance.error &&
        mfaConfigured &&
        assurance.data.currentLevel !== "aal2"
      ) {
        if (pathname.startsWith("/api/")) {
          return secureResponse(
            NextResponse.json(
              {
                error: "Autenticação em duas etapas necessária.",
                mfaRequired: true,
              },
              { status: 401, headers: { "Cache-Control": "private, no-store" } },
            ),
            request,
          );
        }
        if (
          pathname === "/" ||
          pathname === "/perfil" ||
          pathname === "/support" ||
          pathname === "/admin" ||
          pathname.startsWith("/admin/") ||
          [
            "/sala",
            "/pools",
            "/carteira",
            "/inventario",
            "/loja",
            "/minigames",
            "/temporada",
            "/ranking",
            "/tarefas",
            "/operador",
          ].includes(pathname)
        ) {
          const next = `${pathname}${request.nextUrl.search}`;
          return secureResponse(
            NextResponse.redirect(
              new URL(
                `/auth/mfa?next=${encodeURIComponent(next)}`,
                request.url,
              ),
              { headers: { "Cache-Control": "private, no-store" } },
            ),
            request,
          );
        }
      }
    } catch {
      // Do not turn a transient assurance lookup failure into a Worker 500.
      // The page/API authorization layer remains the final fallback.
    }

    // Contas sem MFA confirmam o e-mail uma vez por ciclo do servidor. Essa
    // camada é separada da confirmação permanente do cadastro no Supabase.
    // Se a leitura de AAL ou o provedor de e-mail estiver indisponível, não
    // bloqueamos a sessão por engano; a proteção volta no próximo request.
    if (
      assuranceKnown &&
      !mfaConfigured &&
      env.DB &&
      emailCycleIsEnabled(env)
    ) {
      try {
        if (!claimsEmail) {
          const userResult = await supabase.auth.getUser();
          claimsEmail = userResult.data.user?.email?.trim().toLowerCase() ?? "";
        }
        if (claimsEmail) {
          await ensureEmailCycleSchema(env.DB);
          const accountId = await accountIdForVerifiedEmail(claimsEmail);
          const status = await readEmailCycleStatus(env.DB, accountId);
          if (!status.verified) {
            if (pathname.startsWith("/api/")) {
              return secureResponse(
                NextResponse.json(
                  {
                    error: "Verificação de e-mail necessária.",
                    emailVerificationRequired: true,
                    cycleKey: status.cycleKey,
                  },
                  {
                    status: 401,
                    headers: { "Cache-Control": "private, no-store" },
                  },
                ),
                request,
              );
            }
            const next = `${pathname}${request.nextUrl.search}`;
            return secureResponse(
              NextResponse.redirect(
                new URL(
                  `/auth/email-check?next=${encodeURIComponent(next)}`,
                  request.url,
                ),
                { headers: { "Cache-Control": "private, no-store" } },
              ),
              request,
            );
          }
        }
      } catch {
        // Fail open on infrastructure errors; the next request retries the
        // check and the application-level authorization remains authoritative.
      }
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return secureResponse(response, request);
}

export const config = {
  matcher: ["/:path*"],
};
