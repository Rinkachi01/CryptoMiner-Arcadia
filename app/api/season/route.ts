import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import type { SeasonTrack } from "../../season-rules";
import {
  claimSeasonQuest,
  claimSeasonReward,
  claimWelcomeXpBundle,
  purchaseSeasonPremium,
  readSeasonOverview,
  registerSeasonDailyLogin,
} from "../../season-server";

export const dynamic = "force-dynamic";

function allowsSeasonalCurrency(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  // Season 2 is the current campaign in both environments. Keep the
  // allow-list explicit so preview/unknown hosts cannot mint seasonal credit.
  return new Set([
    "staging.cryptominerarcadia.com",
    "cryptominerarcadia.com",
    "www.cryptominerarcadia.com",
  ]).has(hostname) || (
    hostname.endsWith(".workers.dev") && hostname.includes("staging")
  );
}

// The welcome-bonus cadence is a production-only policy. Keeping the host
// gate here prevents the staging/test environment from inheriting production
// reset behavior or changing its existing one-claim-per-season semantics.
function enablesDailyWelcomeXpReset(request: Request) {
  return !new URL(request.url).hostname.toLowerCase().includes("staging");
}

export async function GET(request: Request) {
  const user = await getArcadiaUser();
  if (!user || !env.DB) {
    return Response.json(
      { error: "Faça login para acompanhar a temporada." },
      { status: 401 },
    );
  }
  const now = Date.now();
  const accountId = await accountIdForUser(user);
  const allowSeasonalCurrency = allowsSeasonalCurrency(request);
  const welcomeXpDailyReset = enablesDailyWelcomeXpReset(request);
  const stagingXpBoost = new URL(request.url).hostname.toLowerCase().includes("staging");
  const overview = await readSeasonOverview(
    env.DB,
    accountId,
    now,
    true,
    allowSeasonalCurrency,
    welcomeXpDailyReset,
    stagingXpBoost,
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
    | { action?: unknown; level?: unknown; track?: unknown; questId?: unknown; cycleKey?: unknown }
    | null;
  const accountId = await accountIdForUser(user);
  const now = Date.now();
  const allowSeasonalCurrency = allowsSeasonalCurrency(request);
  const welcomeXpDailyReset = enablesDailyWelcomeXpReset(request);
  const stagingXpBoost = new URL(request.url).hostname.toLowerCase().includes("staging");
  try {
    let message = "Temporada atualizada.";
    if (body?.action === "daily-login") {
      const result = await registerSeasonDailyLogin(env.DB, accountId, now);
      message = result.awarded
        ? `Login do dia: +${result.xp} XP.`
        : "O XP de login de hoje já foi registrado.";
    } else if (body?.action === "claim-welcome-xp") {
      const result = await claimWelcomeXpBundle(
        env.DB,
        accountId,
        now,
        welcomeXpDailyReset,
      );
      message = result.alreadyClaimed
        ? "O Bundle XP de boas-vindas já foi resgatado."
        : `Bundle XP de boas-vindas: +${result.xp} XP.`;
    } else if (body?.action === "buy-premium" || body?.action === "buy-premium-max") {
      const isMax = body?.action === "buy-premium-max";
      const result = await purchaseSeasonPremium(env.DB, accountId, now, isMax);
      message = result.alreadyOwned
        ? isMax
          ? "O Orbit Pass Max já pertence à sua conta."
          : "A trilha Premium já pertence à sua conta."
        : isMax
          ? `Orbit Pass Max ativado por ${result.priceCma} CMA. Todas as recompensas Premium foram liberadas para resgate.`
          : `Trilha Premium liberada por ${result.priceCma} CMA.`;
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
        allowSeasonalCurrency,
        stagingXpBoost,
      );
      message = result.alreadyClaimed
        ? "Este prêmio já foi resgatado."
        : `${result.reward.title} enviado para sua conta.`;
    } else if (
      body?.action === "claim-quest" &&
      typeof body.questId === "string" &&
      typeof body.cycleKey === "string"
    ) {
      const result = await claimSeasonQuest(
        env.DB,
        accountId,
        body.questId,
        body.cycleKey,
        now,
        stagingXpBoost,
      );
      message = `Quest concluída: +${result.xp} XP.`;
    } else {
      return Response.json({ error: "Ação sazonal inválida." }, { status: 400 });
    }
    const refreshedAt = Date.now();
    return Response.json(
      {
        message,
        ...(await readSeasonOverview(
          env.DB,
          accountId,
          refreshedAt,
          false,
          allowSeasonalCurrency,
          welcomeXpDailyReset,
          stagingXpBoost,
        )),
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
