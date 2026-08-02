import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import {
  createConversionQuote,
  readMarketRates,
} from "../../conversion-server";
import {
  CMA_USD_REFERENCE,
  CONVERSION_FEE_BPS,
  CONVERSION_MIN_USD,
  conversionAssets,
} from "../../conversion-rules";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function conversionContext() {
  const user = await getArcadiaUser();
  if (!user) return null;
  if (!env.DB) throw new Error("Banco autoritativo indisponível.");
  return {
    accountId: await accountIdForUser(user),
    db: env.DB,
  };
}

export async function GET() {
  const current = await conversionContext();
  if (!current) return json({ error: "Faça login para consultar cotações." }, 401);
  try {
    return json({
      assets: conversionAssets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        decimals: Math.log10(asset.atomicScale),
      })),
      conversionEnabled: false,
      policy: {
        cmaUsdReference: CMA_USD_REFERENCE,
        feeBps: CONVERSION_FEE_BPS,
        minimumUsd: CONVERSION_MIN_USD,
        oneWayOnly: true,
        withdrawableCma: false,
      },
      rates: await readMarketRates(current.db, env, Date.now()),
    });
  } catch {
    return json(
      { error: "A fonte de cotação está temporariamente indisponível." },
      503,
    );
  }
}

export async function POST(request: Request) {
  const current = await conversionContext();
  if (!current) return json({ error: "Faça login para gerar uma cotação." }, 401);
  const body = (await request.json().catch(() => null)) as
    | { amount?: unknown; asset?: unknown }
    | null;
  if (!body || typeof body.amount !== "string") {
    return json({ error: "Dados da cotação inválidos." }, 400);
  }
  try {
    return json({
      conversionEnabled: false,
      quote: await createConversionQuote({
        accountId: current.accountId,
        amount: body.amount,
        asset: body.asset,
        db: current.db,
        environment: env,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cotação recusada.";
    return json({ error: message }, message.startsWith("Muitas") ? 429 : 400);
  }
}
