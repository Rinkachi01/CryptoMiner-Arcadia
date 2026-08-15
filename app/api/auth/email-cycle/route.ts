import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../../identity-server";
import {
  emailCycleIsEnabled,
  readEmailCycleStatus,
  requestEmailCycleCode,
  verifyEmailCycleCode,
} from "../../../email-cycle-server";

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
  return { accountId: await accountIdForUser(user), db: env.DB, email: user.verifiedEmail };
}

export async function GET() {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const status = await readEmailCycleStatus(current.db, current.accountId);
  return json({
    ...status,
    enabled: emailCycleIsEnabled(env),
  });
}

export async function POST(request: Request) {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as
    | { action?: unknown; code?: unknown }
    | null;
  const action = body?.action;
  if (action !== "send" && action !== "verify") {
    return json({ error: "Ação de verificação inválida." }, 400);
  }

  if (action === "send") {
    const result = await requestEmailCycleCode(
      current.db,
      current.accountId,
      current.email,
      env,
    );
    const statusCode =
      result.status === "configuration_pending"
        ? 503
        : result.status === "cooldown"
          ? 429
          : 200;
    return json(result, statusCode);
  }

  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return json({ error: "Informe o código de 6 dígitos." }, 400);
  }
  const result = await verifyEmailCycleCode(
    current.db,
    current.accountId,
    code,
    env,
  );
  return json(
    result,
    result.ok
      ? 200
      : result.status === "too_many_attempts"
        ? 429
        : 400,
  );
}
