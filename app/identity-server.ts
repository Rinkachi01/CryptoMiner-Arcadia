import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  type ChatGPTUser,
} from "./chatgpt-auth.ts";
import { redirect } from "next/navigation";
import {
  accountIdForVerifiedEmail,
  CURRENT_IDENTITY_PROVIDER,
  PUBLIC_IDENTITY_PROVIDER,
  safeArcadiaReturnPath,
} from "./identity-rules.ts";
import {
  createSupabaseServerClient,
  publicLoginConfig,
} from "./supabase-server.ts";

export {
  accountIdForVerifiedEmail,
  CURRENT_IDENTITY_PROVIDER,
  PUBLIC_ACCOUNT_STATUS,
} from "./identity-rules.ts";

export type ArcadiaUser = {
  displayName: string;
  email: string;
  fullName: string | null;
  provider:
    | typeof CURRENT_IDENTITY_PROVIDER
    | typeof PUBLIC_IDENTITY_PROVIDER;
  providerSubject: string;
  userId: string;
  verifiedEmail: string;
};

async function getSupabaseUser(): Promise<ArcadiaUser | null> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> = null;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return null;
  }
  if (!supabase) return null;
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let error: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"] = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    error = result.error;
  } catch {
    // A stale or partially written OAuth cookie must behave as an anonymous
    // session, never as a server-rendering exception.
    return null;
  }
  if (error || !user?.email || !user.email_confirmed_at) return null;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim() || null
      : null;
  const verifiedEmail = user.email.trim().toLowerCase();
  return {
    displayName: fullName ?? verifiedEmail,
    email: verifiedEmail,
    fullName,
    provider: PUBLIC_IDENTITY_PROVIDER,
    providerSubject: user.id,
    userId: user.id,
    verifiedEmail,
  };
}

function toChatGPTArcadiaUser(user: ChatGPTUser): ArcadiaUser {
  return {
    ...user,
    provider: CURRENT_IDENTITY_PROVIDER,
    providerSubject: user.userId,
    verifiedEmail: user.email.trim().toLowerCase(),
  };
}

export async function getArcadiaUser(): Promise<ArcadiaUser | null> {
  try {
    // On the public domain, only a verified Supabase session is authoritative.
    // Never fall back to the legacy ChatGPT request headers there: those headers
    // are not a credential and could otherwise be supplied by a caller.
    if (publicLoginConfig()?.enabled) return getSupabaseUser();
    const user = await getChatGPTUser();
    if (user) return toChatGPTArcadiaUser(user);
    return getSupabaseUser();
  } catch {
    return null;
  }
}

export async function requireArcadiaUser(
  returnTo: string,
): Promise<ArcadiaUser> {
  const user = await getArcadiaUser();
  if (user) return user;
  redirect(arcadiaSignInPath(returnTo));
}

export function arcadiaSignInPath(
  returnTo: string,
  mode: "signin" | "signup" | "reset" = "signin",
): string {
  if (publicLoginConfig()?.enabled) {
    const safeReturnTo = safeArcadiaReturnPath(returnTo);
    return `/auth?mode=${mode}&return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return chatGPTSignInPath(returnTo);
}

export function arcadiaSignOutPath(
  returnTo = "/",
  provider: ArcadiaUser["provider"] = CURRENT_IDENTITY_PROVIDER,
): string {
  if (provider === PUBLIC_IDENTITY_PROVIDER) {
    const safeReturnTo = safeArcadiaReturnPath(returnTo);
    return `/auth/signout?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return chatGPTSignOutPath(returnTo);
}

export function accountIdForUser(user: ArcadiaUser) {
  // Mantém o mesmo identificador usado no beta privado. Quando o cadastro
  // público chegar, um e-mail verificado poderá ser vinculado sem perder o
  // progresso atual.
  return accountIdForVerifiedEmail(user.verifiedEmail);
}
