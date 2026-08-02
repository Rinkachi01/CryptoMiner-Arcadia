export type SupabaseAuthEnvironment = {
  AUTH_CAPTCHA_REQUIRED?: string;
  PUBLIC_LOGIN_ENABLED?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_URL?: string;
  TURNSTILE_SITE_KEY?: string;
};

export type SupabaseAuthConfig = {
  captchaRequired: boolean;
  enabled: boolean;
  publishableKey: string;
  turnstileSiteKey: string | null;
  url: string;
};

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function validSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function validPublishableKey(value: string | undefined) {
  if (!value) return false;
  const key = value.trim();
  return key.startsWith("sb_publishable_") || key.length >= 80;
}

export function readSupabaseAuthConfig(
  environment: unknown,
): SupabaseAuthConfig | null {
  const source = (environment ?? {}) as SupabaseAuthEnvironment;
  if (
    !validSupabaseUrl(source.SUPABASE_URL) ||
    !validPublishableKey(source.SUPABASE_PUBLISHABLE_KEY)
  ) {
    return null;
  }

  return {
    captchaRequired: enabled(source.AUTH_CAPTCHA_REQUIRED),
    enabled: enabled(source.PUBLIC_LOGIN_ENABLED),
    publishableKey: source.SUPABASE_PUBLISHABLE_KEY!.trim(),
    turnstileSiteKey: source.TURNSTILE_SITE_KEY?.trim() || null,
    url: source.SUPABASE_URL!.trim(),
  };
}
