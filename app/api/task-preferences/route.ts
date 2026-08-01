import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import {
  isPartnerTaskMode,
  readTaskPreference,
  saveTaskPreference,
} from "../../task-preferences";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function preferenceContext() {
  const user = await getArcadiaUser();
  if (!user) return null;
  if (!env.DB) throw new Error("Preferências temporariamente indisponíveis.");
  return {
    accountId: await accountIdForUser(user),
    db: env.DB,
  };
}

export async function GET() {
  const context = await preferenceContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  return json({
    preference: await readTaskPreference(context.db, context.accountId),
  });
}

export async function POST(request: Request) {
  const context = await preferenceContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as
    | { partnerTasksMode?: unknown }
    | null;
  if (!isPartnerTaskMode(body?.partnerTasksMode)) {
    return json({ error: "Escolha uma preferência válida." }, 400);
  }
  return json({
    message:
      body.partnerTasksMode === "disabled"
        ? "Preferência salva. Tarefas parceiras continuarão desativadas para você."
        : "Preferência salva. Sempre pediremos autorização antes de qualquer conexão.",
    preference: await saveTaskPreference(
      context.db,
      context.accountId,
      body.partnerTasksMode,
      Date.now(),
    ),
  });
}
