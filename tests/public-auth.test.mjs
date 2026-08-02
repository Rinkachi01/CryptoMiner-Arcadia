import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readSupabaseAuthConfig } from "../app/supabase-config.ts";

test("Supabase só abre o login com URL, chave publicável e flag explícita", () => {
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

test("fluxo público inclui sessão SSR, confirmação, recuperação e documentos", async () => {
  const sources = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/AuthForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8"),
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
  assert.match(source, /resetPasswordForEmail/);
  assert.match(source, /exchangeCodeForSession/);
  assert.match(source, /updateUser/);
  assert.match(source, /captchaToken/);
  assert.match(source, /auth_\$\{mode\}/);
  assert.match(source, /CMA não é sacável/i);
  assert.match(source, /nunca solicita sua chave privada/i);
  assert.match(source, /Todos os direitos reservados/i);
});

test("metadados públicos acompanham o endereço externo configurado", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /process\.env\.PUBLIC_BASE_URL/);
  assert.match(layout, /crypto-miner-arcadia\.criptomineracardia\.workers\.dev/);
  assert.doesNotMatch(layout, /mateusmoraes12345678\.chatgpt\.site/);
});
