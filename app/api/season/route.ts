import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import { readSeasonOverview } from "../../season-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getArcadiaUser();
  if (!user || !env.DB) {
    return Response.json(
      { error: "Faça login para acompanhar a temporada." },
      { status: 401 },
    );
  }
  const now = Date.now();
  const overview = await readSeasonOverview(
    env.DB,
    await accountIdForUser(user),
    now,
  );
  return Response.json(
    {
      ...overview,
      competitiveOnly: true,
      rewardNotice:
        "Ranking de atividade, sem prêmio em CMA, saque ou vantagem financeira.",
      serverTime: now,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
