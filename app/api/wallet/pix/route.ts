import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../../identity-server";
import {
  createPixDeposit,
  quotePixDeposit,
  readPixOverview,
  reconcilePendingPixDeposits,
} from "../../../pix-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const user = await getArcadiaUser();
  if (!user) return json({ error: "Faça login para abrir o Pix." }, 401);
  if (!env.DB) return json({ error: "Banco autoritativo indisponível." }, 503);
  try {
    return json(
      await readPixOverview({
        accountId: await accountIdForUser(user),
        db: env.DB,
        environment: env,
      }),
    );
  } catch (error) {
    console.error(
      "pix_overview_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ error: "Não foi possível preparar o Pix agora." }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getArcadiaUser();
  if (!user) return json({ error: "Faça login para usar o Pix." }, 401);
  if (!env.DB) return json({ error: "Banco autoritativo indisponível." }, 503);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 16_000) return json({ error: "Dados muito grandes." }, 413);
  const body = (await request.json().catch(() => null)) as
    | { action?: unknown; targetCma?: unknown }
    | null;
  if (!body) return json({ error: "Dados do Pix inválidos." }, 400);
  try {
    if (body.action === "quote") {
      return json({
        quote: await quotePixDeposit({
          db: env.DB,
          environment: env,
          targetCma: body.targetCma,
        }),
      });
    }
    if (body.action === "create") {
      return json({
        message: "Cobrança Pix criada. O CMA só entra após confirmação assinada.",
        pix: await createPixDeposit({
          accountEmail: user.email,
          accountId: await accountIdForUser(user),
          db: env.DB,
          environment: env,
          targetCma: body.targetCma,
        }),
      });
    }
    if (body.action === "refresh") {
      const accountId = await accountIdForUser(user);
      const reconciliation = await reconcilePendingPixDeposits({
        accountId,
        db: env.DB,
        environment: env,
      });
      return json({
        message: reconciliation.credited > 0
          ? `${reconciliation.credited} pagamento Pix confirmado.`
          : "Extrato Pix atualizado.",
        overview: await readPixOverview({ accountId, db: env.DB, environment: env }),
        reconciliation,
      });
    }
    return json({ error: "Ação Pix inválida." }, 400);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o Pix.",
      },
      400,
    );
  }
}
