import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { readSeasonOverview } from "../../season-server";

export const dynamic = "force-dynamic";

async function accountIdFor(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !env.DB) {
    return Response.json(
      { error: "Faça login para acompanhar a temporada." },
      { status: 401 },
    );
  }
  const now = Date.now();
  const overview = await readSeasonOverview(
    env.DB,
    await accountIdFor(user.email),
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
