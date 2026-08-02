import { createServerClient } from "@supabase/ssr";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { readSupabaseAuthConfig } from "./supabase-config.ts";

export function publicLoginConfig() {
  return readSupabaseAuthConfig(env);
}

export async function createSupabaseServerClient() {
  const config = publicLoginConfig();
  if (!config?.enabled) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // O proxy renova a sessão quando o componente já não pode escrever cookies.
        }
      },
    },
  });
}

