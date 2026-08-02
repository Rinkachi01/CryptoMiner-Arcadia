import { NextResponse } from "next/server";
import { safeArcadiaReturnPath } from "../../identity-rules";
import { createSupabaseServerClient } from "../../supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeArcadiaReturnPath(
    requestUrl.searchParams.get("return_to"),
  );
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL(returnTo, requestUrl.origin), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

