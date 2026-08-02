import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import { readWalletOverview } from "../../wallet-server";

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
  } catch {
    return json({ error: "Não foi possível preparar a carteira agora." }, 503);
  }
}
