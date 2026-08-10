type SupportTicketRow = {
  category: string;
  created_at: number;
  delivery_status: string;
  message: string;
  public_id: string;
  status: string;
  subject: string;
  updated_at: number;
};

export async function ensureSupportSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY NOT NULL,
      public_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'open' NOT NULL,
      delivery_status TEXT DEFAULT 'configuration_pending' NOT NULL,
      provider_message_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_public_id_unique
      ON support_tickets (public_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS support_tickets_account_created_idx
      ON support_tickets (account_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
      ON support_tickets (status, created_at)`),
  ]);
}

export function createSupportPublicId(uuid: string) {
  return `CMA-${uuid.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function readPersonalSupportTickets(
  db: D1Database,
  accountId: string,
) {
  await ensureSupportSchema(db);
  const rows = await db
    .prepare(
      `SELECT public_id, category, subject, message, status,
              delivery_status, created_at, updated_at
       FROM support_tickets
       WHERE account_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .bind(accountId)
    .all<SupportTicketRow>();
  return (rows.results ?? []).map((row) => ({
    category: row.category,
    createdAt: Number(row.created_at),
    deliveryStatus: row.delivery_status,
    message: row.message,
    publicId: row.public_id,
    status: row.status,
    subject: row.subject,
    updatedAt: Number(row.updated_at),
  }));
}
