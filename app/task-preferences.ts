export const partnerTaskModes = ["ask", "disabled"] as const;

export type PartnerTaskMode = (typeof partnerTaskModes)[number];

export type PublicTaskPreference = {
  consentVersion: "beta-v1";
  partnerConnected: false;
  partnerTasksMode: PartnerTaskMode;
  saved: boolean;
  updatedAt: number | null;
};

type PreferenceRow = {
  consent_version: string;
  partner_tasks_mode: string;
  updated_at: number;
};

export function isPartnerTaskMode(value: unknown): value is PartnerTaskMode {
  return partnerTaskModes.includes(value as PartnerTaskMode);
}

export async function ensureTaskPreferenceSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS task_preferences (
        account_id TEXT PRIMARY KEY NOT NULL,
        partner_tasks_mode TEXT DEFAULT 'ask' NOT NULL,
        consent_version TEXT DEFAULT 'beta-v1' NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS task_preference_events (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        partner_tasks_mode TEXT NOT NULL,
        consent_version TEXT DEFAULT 'beta-v1' NOT NULL,
        source TEXT DEFAULT 'tasks' NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS task_preference_events_account_created_idx
       ON task_preference_events (account_id, created_at)`,
    ),
  ]);
}

export async function readTaskPreference(
  db: D1Database,
  accountId: string,
): Promise<PublicTaskPreference> {
  await ensureTaskPreferenceSchema(db);
  const row = await db
    .prepare(
      `SELECT partner_tasks_mode, consent_version, updated_at
       FROM task_preferences
       WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<PreferenceRow>();
  return {
    consentVersion: "beta-v1",
    partnerConnected: false,
    partnerTasksMode: isPartnerTaskMode(row?.partner_tasks_mode)
      ? row.partner_tasks_mode
      : "ask",
    saved: Boolean(row),
    updatedAt: row ? Number(row.updated_at) : null,
  };
}

export async function saveTaskPreference(
  db: D1Database,
  accountId: string,
  mode: PartnerTaskMode,
  now: number,
) {
  await ensureTaskPreferenceSchema(db);
  await db.batch([
    db
      .prepare(
        `INSERT INTO task_preferences (
          account_id, partner_tasks_mode, consent_version, created_at, updated_at
        ) VALUES (?, ?, 'beta-v1', ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          partner_tasks_mode = excluded.partner_tasks_mode,
          consent_version = excluded.consent_version,
          updated_at = excluded.updated_at`,
      )
      .bind(accountId, mode, now, now),
    db
      .prepare(
        `INSERT INTO task_preference_events (
          id, account_id, partner_tasks_mode, consent_version, source, created_at
        ) VALUES (?, ?, ?, 'beta-v1', 'tasks', ?)`,
      )
      .bind(crypto.randomUUID(), accountId, mode, now),
  ]);
  return readTaskPreference(db, accountId);
}
