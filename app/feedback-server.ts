type FeedbackRow = {
  category: string;
  created_at: number;
  display_name?: string | null;
  id: string;
  message: string;
  rating: number;
  status: string;
};

export async function ensureBetaFeedbackSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS beta_feedback (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        category TEXT NOT NULL,
        rating INTEGER NOT NULL,
        message TEXT NOT NULL,
        page TEXT DEFAULT 'tasks' NOT NULL,
        status TEXT DEFAULT 'new' NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS beta_feedback_account_created_idx
       ON beta_feedback (account_id, created_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS beta_feedback_created_at_idx
       ON beta_feedback (created_at)`,
    ),
  ]);
}

export async function readPersonalBetaFeedback(
  db: D1Database,
  accountId: string,
) {
  await ensureBetaFeedbackSchema(db);
  const rows = await db
    .prepare(
      `SELECT id, category, rating, message, status, created_at
       FROM beta_feedback
       WHERE account_id = ?
       ORDER BY created_at DESC
       LIMIT 8`,
    )
    .bind(accountId)
    .all<FeedbackRow>();
  return (rows.results ?? []).map((row) => ({
    category: row.category,
    createdAt: Number(row.created_at),
    id: row.id,
    message: row.message,
    rating: Number(row.rating),
    status: row.status,
  }));
}

export async function readAdminBetaFeedback(
  db: D1Database,
  now: number,
) {
  await ensureBetaFeedbackSchema(db);
  const since = now - 30 * 24 * 60 * 60 * 1000;
  const [summary, rows] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS average_rating
         FROM beta_feedback
         WHERE created_at >= ?`,
      )
      .bind(since)
      .first<{ average_rating: number; total: number }>(),
    db
      .prepare(
        `SELECT feedback.id, feedback.category, feedback.rating,
                feedback.message, feedback.status, feedback.created_at,
                states.display_name
         FROM beta_feedback feedback
         LEFT JOIN game_states states ON states.account_id = feedback.account_id
         ORDER BY feedback.created_at DESC
         LIMIT 12`,
      )
      .all<FeedbackRow>(),
  ]);

  return {
    averageRating: Number(summary?.average_rating ?? 0),
    recent: (rows.results ?? []).map((row) => ({
      category: row.category,
      createdAt: Number(row.created_at),
      displayName: row.display_name ?? "Operador",
      id: row.id,
      message: row.message,
      rating: Number(row.rating),
      status: row.status,
    })),
    total30d: Number(summary?.total ?? 0),
  };
}
