import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import {
  guardArcadeAction,
  readArcadeSecurityStatus,
  verifyTurnstileAndCreatePass,
} from "../../security-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function securityContext() {
  const user = await getArcadiaUser();
  if (!user) return null;
  if (!env.DB) throw new Error("Banco autoritativo indisponível.");
  return {
    accountId: await accountIdForUser(user),
    db: env.DB,
  };
}

export async function GET() {
  const current = await securityContext();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  return json(
    await readArcadeSecurityStatus(
      current.db,
      current.accountId,
      env,
      Date.now(),
    ),
  );
}

export async function POST(request: Request) {
  const current = await securityContext();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as
    | { token?: unknown }
    | null;
  if (!body || typeof body.token !== "string" || body.token.length > 2_048) {
    return json({ error: "Resposta de verificação inválida." }, 400);
  }
  const now = Date.now();
  const rateGate = await guardArcadeAction(
    current.db,
    current.accountId,
    "verify",
    env,
    now,
  );
  if (!rateGate.allowed) return json(rateGate, rateGate.status);
  const result = await verifyTurnstileAndCreatePass(
    current.db,
    current.accountId,
    body.token,
    env,
    {
      expectedHostname: new URL(request.url).hostname,
      remoteIp: request.headers.get("cf-connecting-ip"),
    },
    now,
  );
  return result.ok ? json(result) : json(result, 403);
}
