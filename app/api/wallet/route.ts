import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import {
  createProviderDepositIntent,
  createManualWithdrawalRequest,
  createSandboxDepositIntent,
  createSandboxWithdrawalIntent,
  readProviderDepositMinimum,
  readWalletOverview,
} from "../../wallet-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const user = await getArcadiaUser();
  if (!user) return json({ error: "Faça login para abrir sua carteira." }, 401);
  if (!env.DB) return json({ error: "Banco autoritativo indisponível." }, 503);
  try {
    return json(
      await readWalletOverview({
        accountId: await accountIdForUser(user),
        db: env.DB,
        environment: env,
      }),
    );
  } catch (error) {
    console.error(
      "wallet_overview_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ error: "Não foi possível preparar a carteira agora." }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getArcadiaUser();
  if (!user) return json({ error: "Faça login para usar o laboratório." }, 401);
  if (!env.DB) return json({ error: "Banco autoritativo indisponível." }, 503);
  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        amount?: unknown;
        asset?: unknown;
        destinationAddress?: unknown;
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        usdAmount?: unknown;
      }
    | null;
  if (!body) return json({ error: "Simulação inválida." }, 400);
  const accountId = await accountIdForUser(user);
  try {
    if (body.action === "sandbox-deposit") {
      return json({
        message: "Fatura simulada criada. Nenhum dinheiro ou cripto foi movimentado.",
        simulation: await createSandboxDepositIntent({
          accountId,
          asset: body.asset,
          db: env.DB,
          environment: env,
          usdAmount: body.usdAmount,
        }),
      });
    }
    if (body.action === "create-deposit") {
      return json({
        message: "Fatura criada pelo provedor. A cripto recebida só entra no saldo interno após confirmação na rede.",
        deposit: await createProviderDepositIntent({
          accountId,
          asset: body.asset,
          db: env.DB,
          environment: env,
          usdAmount: body.usdAmount,
        }),
      });
    }
    if (body.action === "deposit-minimum") {
      return json({
        minimum: await readProviderDepositMinimum({
          asset: body.asset,
          environment: env,
        }),
      });
    }
    if (body.action === "sandbox-withdrawal") {
      return json({
        message: "Prévia de saque registrada. Nenhum saldo foi debitado.",
        simulation: await createSandboxWithdrawalIntent({
          accountId,
          amount: body.amount,
          asset: body.asset,
          db: env.DB,
          environment: env,
        }),
      });
    }
    if (body.action === "create-withdrawal") {
      return json({
        message: "Saque reservado e enviado para a análise do proprietário.",
        withdrawal: await createManualWithdrawalRequest({
          accountId,
          amount: body.amount,
          asset: body.asset,
          db: env.DB,
          destinationAddress: body.destinationAddress,
          environment: env,
          expectedVersion: body.expectedVersion,
          idempotencyKey: body.idempotencyKey,
        }),
      });
    }
    return json({ error: "Ação de carteira inválida." }, 400);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a simulação.",
      },
      400,
    );
  }
}
