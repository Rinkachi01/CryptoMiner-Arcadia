import type { EmailOtpType } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import {
  accountIdForVerifiedEmail,
  safeArcadiaReturnPath,
} from "../../identity-rules";
import { claimReferral } from "../../referral-server";
import { createSupabaseServerClient } from "../../supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeArcadiaReturnPath(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const referralCode = requestUrl.searchParams.get("ref")?.trim().toUpperCase() ?? "";
  // OAuth providers can return transient errors and the Supabase client can
  // throw when a code has already been consumed. Never let either case become
  // a Worker exception/HTTP 500; send the user back to the sign-in screen.
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> = null;
  let error = true;
  try {
    supabase = await createSupabaseServerClient();
    if (supabase && code) {
      const result = await supabase.auth.exchangeCodeForSession(code);
      error = Boolean(result.error);
    } else if (supabase && tokenHash && type) {
      const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      error = Boolean(result.error);
    }

    if (!error && env.DB && /^[A-Z0-9]{8,16}$/.test(referralCode)) {
      const result = await supabase?.auth.getUser();
      const email = result?.data.user?.email?.trim().toLowerCase();
      if (email && result?.data.user?.email_confirmed_at) {
        await claimReferral(
          env.DB,
          await accountIdForVerifiedEmail(email),
          referralCode,
          Date.now(),
        ).catch(() => null);
      }
    }
  } catch {
    error = true;
  }

  let destination = error
    ? `/auth?error=${encodeURIComponent("O link expirou ou já foi utilizado.")}`
    : next;
  if (!error && supabase) {
    const assurance = await supabase.auth
      .getAuthenticatorAssuranceLevel()
      .catch(() => ({ data: null }));
    if (
      assurance.data?.nextLevel === "aal2" &&
      assurance.data.currentLevel !== "aal2"
    ) {
      destination = `/auth/mfa?next=${encodeURIComponent(next)}`;
    }
  }
  return NextResponse.redirect(new URL(destination, requestUrl.origin), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
