import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import {
  claimReferral,
  readReferralOverview,
} from "../../referral-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function context() {
  const user = await getArcadiaUser();
  if (!user || !env.DB) return null;
  return { accountId: await accountIdForUser(user), db: env.DB };
}

export async function GET(request: Request) {
  const authenticated = await context();
  if (!authenticated) return json({ error: "Faça login para continuar." }, 401);
  const origin = new URL(request.url).origin;
  return json(
    await readReferralOverview(
      authenticated.db,
      authenticated.accountId,
      origin,
      Date.now(),
    ),
  );
}

export async function POST(request: Request) {
  const authenticated = await context();
  if (!authenticated) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  if (typeof body?.code !== "string") {
    return json({ error: "Código de indicação inválido." }, 400);
  }
  return json(
    await claimReferral(
      authenticated.db,
      authenticated.accountId,
      body.code,
      Date.now(),
    ),
  );
}
