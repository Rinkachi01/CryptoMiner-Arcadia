type SupportTicketRow = {
  admin_note: string;
  category: string;
  created_at: number;
  delivery_status: string;
  email?: string;
  last_reply_at: number | null;
  message: string;
  public_id: string;
  reply_delivery_status: string;
  status: string;
  subject: string;
  updated_at: number;
};

export const supportTicketStatuses = [
  "open",
  "reviewing",
  "resolved",
  "closed",
] as const;

export type SupportTicketStatus = (typeof supportTicketStatuses)[number];

export function isSupportTicketStatus(
  value: unknown,
): value is SupportTicketStatus {
  return supportTicketStatuses.includes(value as SupportTicketStatus);
}

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
      admin_note TEXT DEFAULT '' NOT NULL,
      last_reply_at INTEGER,
      last_reply_by TEXT,
      reply_delivery_status TEXT DEFAULT 'none' NOT NULL,
      reply_provider_message_id TEXT,
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
              delivery_status, admin_note, last_reply_at,
              reply_delivery_status, created_at, updated_at
       FROM support_tickets
       WHERE account_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .bind(accountId)
    .all<SupportTicketRow>();
  return (rows.results ?? []).map((row) => ({
    category: row.category,
    adminReply: row.admin_note || null,
    createdAt: Number(row.created_at),
    deliveryStatus: row.delivery_status,
    lastReplyAt: row.last_reply_at ? Number(row.last_reply_at) : null,
    message: row.message,
    publicId: row.public_id,
    replyDeliveryStatus: row.reply_delivery_status,
    status: row.status,
    subject: row.subject,
    updatedAt: Number(row.updated_at),
  }));
}

export async function readAdminSupportOverview(db: D1Database) {
  await ensureSupportSchema(db);
  const [counts, tickets] = await Promise.all([
    db
      .prepare(
        `SELECT status, COUNT(*) AS total
         FROM support_tickets
         GROUP BY status`,
      )
      .all<{ status: string; total: number }>(),
    db
      .prepare(
        `SELECT public_id, email, category, subject, message, status,
                delivery_status, admin_note, last_reply_at,
                reply_delivery_status, created_at, updated_at
         FROM support_tickets
         ORDER BY CASE status
           WHEN 'open' THEN 0
           WHEN 'reviewing' THEN 1
           WHEN 'resolved' THEN 2
           ELSE 3
         END, updated_at DESC
         LIMIT 40`,
      )
      .all<SupportTicketRow>(),
  ]);
  const statusCounts: Record<SupportTicketStatus, number> = {
    open: 0,
    reviewing: 0,
    resolved: 0,
    closed: 0,
  };
  for (const row of counts.results ?? []) {
    if (isSupportTicketStatus(row.status)) {
      statusCounts[row.status] = Number(row.total);
    }
  }
  return {
    statusCounts,
    tickets: (tickets.results ?? []).map((row) => ({
      adminNote: row.admin_note,
      category: row.category,
      createdAt: Number(row.created_at),
      deliveryStatus: row.delivery_status,
      email: row.email ?? "",
      lastReplyAt: row.last_reply_at ? Number(row.last_reply_at) : null,
      message: row.message,
      publicId: row.public_id,
      replyDeliveryStatus: row.reply_delivery_status,
      status: row.status,
      subject: row.subject,
      updatedAt: Number(row.updated_at),
    })),
  };
}
