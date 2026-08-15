import { pcLevelAfterInactivity } from "./pc-progression-rules";

type PcProgressRow = {
  total_plays: number | null;
  last_activity_at: number | null;
};

/**
 * Reads the authoritative PC level used to time temporary Arcade power.
 * The level is global to the account, not tied to one individual minigame.
 */
export async function readActivePcLevel(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(total_plays), 0) AS total_plays,
              COALESCE(MAX(updated_at), 0) AS last_activity_at
       FROM game_progress
       WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<PcProgressRow>();
  return pcLevelAfterInactivity(
    Number(row?.total_plays ?? 0),
    Number(row?.last_activity_at ?? 0),
    now,
  );
}
