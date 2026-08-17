import {
  pcLevelAfterInactivity,
  pcResetRequired,
} from "./pc-progression-rules";

type PcProgressRow = {
  total_plays: number | null;
  last_activity_at: number | null;
};

type PcWinRow = {
  last_win_at: number | null;
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
  const [progressRow, winRow] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(total_plays), 0) AS total_plays,
                COALESCE(MAX(updated_at), 0) AS last_activity_at
         FROM game_progress
         WHERE account_id = ?`,
      )
      .bind(accountId)
      .first<PcProgressRow>(),
    db
      .prepare(
        `SELECT COALESCE(MAX(completed_at), 0) AS last_win_at
         FROM game_sessions
         WHERE account_id = ? AND status = 'completed'`,
      )
      .bind(accountId)
      .first<PcWinRow>(),
  ]);

  const totalPlays = Number(progressRow?.total_plays ?? 0);
  const lastActivityAt = Number(progressRow?.last_activity_at ?? 0);
  const lastWinAt = Number(winRow?.last_win_at ?? 0);
  if (pcResetRequired(totalPlays, lastActivityAt, lastWinAt, now)) {
    await db
      .prepare(
        `UPDATE game_progress
         SET level = 1, win_streak = 0, next_play_at = 0,
             total_plays = 0, total_wins = 0, updated_at = ?
         WHERE account_id = ? AND total_plays > 0`,
      )
      .bind(now, accountId)
      .run();
    return 0;
  }
  return pcLevelAfterInactivity(totalPlays, lastActivityAt, lastWinAt, now);
}
