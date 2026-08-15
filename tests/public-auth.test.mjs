import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readSupabaseAuthConfig } from "../app/supabase-config.ts";

test("Supabase abre o login somente com URL, chave publicavel e flag explicita", () => {
  assert.equal(readSupabaseAuthConfig({}), null);
  const config = readSupabaseAuthConfig({
    PUBLIC_LOGIN_ENABLED: "true",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-key",
    SUPABASE_URL: "https://arcadia.supabase.co",
  });
  assert.equal(config?.enabled, true);
  assert.equal(config?.url, "https://arcadia.supabase.co");
  assert.equal(config?.captchaRequired, false);
  assert.equal(config?.turnstileSiteKey, null);
  const protectedConfig = readSupabaseAuthConfig({
    AUTH_CAPTCHA_REQUIRED: "true",
    PUBLIC_LOGIN_ENABLED: "true",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-key",
    SUPABASE_URL: "https://arcadia.supabase.co",
    TURNSTILE_SITE_KEY: "public-site-key",
  });
  assert.equal(protectedConfig?.captchaRequired, true);
  assert.equal(protectedConfig?.turnstileSiteKey, "public-site-key");
});

test("Supabase nunca aceita chave elevada na configuracao enviada ao navegador", () => {
  const base = {
    PUBLIC_LOGIN_ENABLED: "true",
    SUPABASE_URL: "https://arcadia.supabase.co",
  };
  assert.equal(
    readSupabaseAuthConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: "sb_secret_server-only" }),
    null,
  );
  assert.equal(
    readSupabaseAuthConfig({
      ...base,
      SUPABASE_PUBLISHABLE_KEY: `service_role_${"a".repeat(100)}`,
    }),
    null,
  );
  assert.equal(
    readSupabaseAuthConfig({
      ...base,
      SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbm9uIn0.signature",
    })?.enabled,
    true,
  );
});

test("fluxo publico inclui sessao SSR, confirmacao, recuperacao e documentos", async () => {
  const sources = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/AuthForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/mfa/MfaChallenge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/perfil/MfaSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/update-password/UpdatePasswordForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/support/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/legal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TurnstileWidget.tsx", import.meta.url), "utf8"),
  ]);
  const source = sources.join("\n");

  assert.match(source, /createServerClient/);
  assert.match(source, /getClaims/);
  assert.match(source, /signUp/);
  assert.match(source, /signInWithPassword/);
  assert.match(source, /signInWithOAuth/);
  assert.match(source, /provider:\s*"google"/);
  assert.match(source, /supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel/);
  assert.match(source, /mfaRequired/);
  assert.match(source, /mfa\.enroll/);
  assert.match(source, /mfa\.verify/);
  assert.match(source, /mfa\.unenroll/);
  assert.match(source, /cma-coin\.png/);
  assert.match(source, /resetPasswordForEmail/);
  assert.match(source, /supabase\.auth\.resend/);
  assert.match(source, /REENVIAR E-MAIL/);
  assert.match(source, /resendSeconds/);
  assert.match(source, /exchangeCodeForSession/);
  assert.match(source, /updateUser/);
  assert.match(source, /captchaToken/);
  assert.match(source, /auth_\$\{mode\}/);
  assert.match(source, /CMA nao e sacavel|CMA n.o . sac.vel/i);
  assert.match(source, /nunca solicita sua chave privada/i);
  assert.match(source, /Todos os direitos reservados/i);
});

test("metadados publicos acompanham o endereco externo configurado", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /process\.env\.PUBLIC_BASE_URL/);
  assert.match(layout, /https:\/\/cryptominerarcadia\.com/);
  assert.doesNotMatch(layout, /mateusmoraes12345678\.chatgpt\.site/);
});
