import { env } from "cloudflare:workers";
import { getArcadiaUser } from "../../../identity-server";

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  account_id: string;
  display_name: string;
  total_power_gh: number;
};

export async function GET() {
  const user = await getArcadiaUser();
  if (!user) {
    return Response.json({ error: "Faça login para ver o ranking." }, { status: 401 });
  }
  const db = env.DB;
  if (!db) {
    return Response.json({ error: "Ranking temporariamente indisponível." }, { status: 503 });
  }

  const now = Date.now();

  try {
    const rows = await db
      .prepare(
        `SELECT
           g.account_id,
           g.display_name,
           (
             COALESCE(a.installed_power_gh, 0) +
             COALESCE((
               SELECT SUM(power_gh)
               FROM temporary_power_grants t
               WHERE t.account_id = g.account_id
                 AND t.starts_at <= ?
                 AND t.expires_at > ?
             ), 0)
           ) AS total_power_gh
         FROM game_states g
         LEFT JOIN account_network_power a ON a.account_id = g.account_id
         WHERE g.account_id NOT IN (SELECT account_id FROM admin_owners)
         ORDER BY total_power_gh DESC
         LIMIT 100`
      )
      .bind(now, now)
      .all<LeaderboardRow>();

    const leaderboard = (rows.results ?? [])
      .filter((row) => row.total_power_gh > 0)
      .map((row, index) => ({
        rank: index + 1,
        accountId: row.account_id,
        displayName: row.display_name,
        powerGh: Number(row.total_power_gh),
      }));

    return Response.json({
      generatedAt: now,
      leaderboard,
    });
  } catch (error) {
    return Response.json({ error: "Não foi possível carregar o ranking." }, { status: 500 });
  }
}
