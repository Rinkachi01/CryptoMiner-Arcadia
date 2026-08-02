import { env } from "cloudflare:workers";
import {
  adminOwnerAccountIdFromEnv,
  claimOrVerifyAdminOwner,
  writeAdminAudit,
} from "../../../admin-settings";
import {
  createFounderTransferEnvelope,
  founderTransferSecretFromEnv,
  importFounderTransferEnvelope,
  serializeFounderTransferEnvelope,
} from "../../../founder-transfer-server";
import { accountIdForUser, getArcadiaUser } from "../../../identity-server";

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
  if (!owner.allowed) return { forbidden: true as const };
  return { accountId, db: env.DB, forbidden: false as const };
}

export async function GET() {
  const context = await ownerContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  if (context.forbidden) return json({ error: "Acesso exclusivo do fundador." }, 403);
  try {
    const result = await createFounderTransferEnvelope(
      context.db,
      context.accountId,
      founderTransferSecretFromEnv(env),
      Date.now(),
    );
    return json({
      rowCount: result.rowCount,
      transferPackage: await serializeFounderTransferEnvelope(result.envelope),
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Falha ao gerar pacote." },
      409,
    );
  }
}

export async function POST(request: Request) {
  const context = await ownerContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  if (context.forbidden) return json({ error: "Acesso exclusivo do fundador." }, 403);
  const body = (await request.json().catch(() => null)) as
    | { transferPackage?: unknown }
    | null;
  if (!body?.transferPackage) return json({ error: "Informe o pacote assinado." }, 400);
  const now = Date.now();
  try {
    const result = await importFounderTransferEnvelope(
      context.db,
      context.accountId,
      founderTransferSecretFromEnv(env),
      body.transferPackage,
      now,
    );
    await writeAdminAudit(
      context.db,
      context.accountId,
      "founder_account_transferred",
      {
        destinationVersion: result.destinationVersion,
        rowCount: result.rowCount,
        sourceVersion: result.sourceVersion,
        transferId: result.transferId,
      },
      now,
    );
    return json({
      message: `Conta fundadora migrada com ${result.rowCount.toLocaleString("pt-BR")} registros verificados.`,
      result: {
        cmaBalance: result.state.cmaBalance,
        destinationVersion: result.destinationVersion,
        installedRacks: result.state.racks.length,
        sourceVersion: result.sourceVersion,
      },
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Falha ao importar pacote." },
      409,
    );
  }
}
