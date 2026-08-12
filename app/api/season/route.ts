import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import type { SeasonTrack } from "../../season-rules";
import {
  claimSeasonReward,
  purchaseSeasonPremium,
  readSeasonOverview,
  registerSeasonDailyLogin,
} from "../../season-server";

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
    true,
  );
  const isSpaceRace = overview.season?.campaignSlug === "space-race-01";
  return Response.json(
    {
      ...overview,
      competitiveOnly: !isSpaceRace,
      rewardNotice: isSpaceRace
        ? "Prêmios sazonais não alteram o valor fixo dos blocos."
        : "Ranking de atividade, sem prêmio em CMA, saque ou vantagem financeira.",
      serverTime: now,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getArcadiaUser();
  if (!user || !env.DB) {
    return Response.json(
      { error: "Faça login para acompanhar a temporada." },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as
    | { action?: unknown; level?: unknown; track?: unknown }
    | null;
  const accountId = await accountIdForUser(user);
  const now = Date.now();
  try {
    let message = "Temporada atualizada.";
    if (body?.action === "daily-login") {
      const result = await registerSeasonDailyLogin(env.DB, accountId, now);
      message = result.awarded
        ? `Login do dia: +${result.xp} XP.`
        : "O XP de login de hoje já foi registrado.";
    } else if (body?.action === "buy-premium") {
      const result = await purchaseSeasonPremium(env.DB, accountId, now);
      message = result.alreadyOwned
        ? "A trilha premium já pertence à sua conta."
        : `Trilha premium liberada por ${result.priceCma} CMA.`;
    } else if (
      body?.action === "claim-reward" &&
      (body.track === "free" || body.track === "premium") &&
      typeof body.level === "number" &&
      Number.isInteger(body.level)
    ) {
      const result = await claimSeasonReward(
        env.DB,
        accountId,
        body.track as SeasonTrack,
        body.level,
        now,
      );
      message = result.alreadyClaimed
        ? "Este prêmio já foi resgatado."
        : `${result.reward.title} enviado para sua conta.`;
    } else {
      return Response.json({ error: "Ação sazonal inválida." }, { status: 400 });
    }
    const refreshedAt = Date.now();
    return Response.json(
      {
        message,
        ...(await readSeasonOverview(env.DB, accountId, refreshedAt)),
        serverTime: refreshedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a ação sazonal.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
}
