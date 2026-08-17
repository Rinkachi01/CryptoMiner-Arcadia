import { env } from "cloudflare:workers";
import { assetsManifest } from "../../../assets.manifest";
import type { PublicGameState } from "../../../game-server";
import { getArcadiaUser } from "../../../identity-server";
import { getRoomDefinition } from "../../../room-rules";

export const dynamic = "force-dynamic";

// Keep the public leaderboard intentionally small: the room preview can
// include several racks and miners, so returning only the top 15 avoids an
// unnecessarily heavy response while preserving the useful competition view.
export const PUBLIC_LEADERBOARD_LIMIT = 15;

type LeaderboardRow = {
  account_id: string;
  display_name: string;
  state_json: string;
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
           g.state_json,
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
         LIMIT ${PUBLIC_LEADERBOARD_LIMIT}`
      )
      .bind(now, now)
      .all<LeaderboardRow>();

    const leaderboard = (rows.results ?? [])
      .filter((row) => row.total_power_gh > 0)
      .map((row, index) => ({
        ...(() => {
          let state: Partial<PublicGameState> = {};
          try {
            state = JSON.parse(row.state_json) as Partial<PublicGameState>;
          } catch {
            // A legacy state still appears in the ranking without a room preview.
          }
          const mainRoomRacks = Array.isArray(state.racks)
            ? state.racks.filter((rack) => rack.roomId === "room-1")
            : [];
          return {
            mainRoomMinerCount: mainRoomRacks.reduce(
              (total, rack) =>
                total +
                (Array.isArray(state.rackMiners?.[rack.id])
                  ? state.rackMiners?.[rack.id].length ?? 0
                  : 0),
              0,
            ),
            mainRoomRackCount: mainRoomRacks.length,
          };
        })(),
        rank: index + 1,
        accountId: row.account_id,
        displayName: row.display_name,
        mainRoomName: getRoomDefinition("room-1")?.name ?? "Oficina Neon",
        mainRoomAsset: assetsManifest.roomOne.path,
        powerGh: Number(row.total_power_gh),
      }));

    return Response.json({
      generatedAt: now,
      leaderboard,
    });
  } catch {
    return Response.json({ error: "Não foi possível carregar o ranking." }, { status: 500 });
  }
}
