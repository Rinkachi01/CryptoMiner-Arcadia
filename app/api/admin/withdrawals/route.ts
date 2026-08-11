import { env } from "cloudflare:workers";
import {
  adminOwnerAccountIdFromEnv,
  claimOrVerifyAdminOwner,
  writeAdminAudit,
} from "../../../admin-settings";
import { accountIdForUser, getArcadiaUser } from "../../../identity-server";
import {
  readAdminWithdrawalOverview,
  reviewManualWithdrawal,
} from "../../../wallet-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function ownerContext() {
  const user = await getArcadiaUser();
  if (!user || !env.DB) return null;
  const accountId = await accountIdForUser(user);
  const owner = await claimOrVerifyAdminOwner(
    env.DB,
    accountId,
    user.email,
    Date.now(),
    adminOwnerAccountIdFromEnv(env),
  );
  return owner.allowed ? { accountId, db: env.DB } : false;
}

export async function GET() {
  const current = await ownerContext();
  if (current === null) return json({ error: "Faça login para continuar." }, 401);
  if (current === false) {
    return json({ error: "Fila disponível apenas para o proprietário." }, 403);
  }
  return json(
    await readAdminWithdrawalOverview({ db: current.db, environment: env }),
  );
}

export async function POST(request: Request) {
  const current = await ownerContext();
  if (current === null) return json({ error: "Faça login para continuar." }, 401);
  if (current === false) {
    return json({ error: "Ação disponível apenas para o proprietário." }, 403);
  }
  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        note?: unknown;
        requestId?: unknown;
        transactionReference?: unknown;
      }
    | null;
  if (
    !body ||
    (body.action !== "review" &&
      body.action !== "pay" &&
      body.action !== "reject")
  ) {
    return json({ error: "Ação de saque inválida." }, 400);
  }
  try {
    const result = await reviewManualWithdrawal({
      action: body.action,
      actorAccountId: current.accountId,
      db: current.db,
      environment: env,
      note: body.note,
      requestId: body.requestId,
      transactionReference: body.transactionReference,
    });
    await writeAdminAudit(
      current.db,
      current.accountId,
      `manual_withdrawal_${body.action}`,
      { requestId: body.requestId, status: result.status },
      Date.now(),
    );
    return json({
      message:
        result.status === "paid"
          ? "Pagamento registrado."
          : result.status === "rejected"
            ? "Solicitação recusada e saldo estornado."
            : "Solicitação marcada como em análise.",
      result,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Ação recusada." },
      400,
    );
  }
}
