export type AdminRuntimeSettings = {
  cratesEnabled: boolean;
  dailyBatteryEnabled: boolean;
  minigamePowerEnabled: boolean;
  updatedAt: number;
  updatedBy: string | null;
};

export type AdminSettingKey =
  | "cratesEnabled"
  | "dailyBatteryEnabled"
  | "minigamePowerEnabled";

type SettingsRow = {
  crates_enabled: number;
  daily_battery_enabled: number;
  minigame_power_enabled: number;
  updated_at: number;
  updated_by: string | null;
};

type OwnerRow = {
  account_id: string;
  email: string;
  created_at: number;
};

const DEFAULT_SETTINGS: AdminRuntimeSettings = {
  cratesEnabled: true,
  dailyBatteryEnabled: true,
  minigamePowerEnabled: true,
  updatedAt: 0,
  updatedBy: null,
};

export async function ensureRuntimeSettingsSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_runtime_settings (
        singleton_id INTEGER PRIMARY KEY NOT NULL,
        crates_enabled INTEGER DEFAULT 1 NOT NULL,
        minigame_power_enabled INTEGER DEFAULT 1 NOT NULL,
        daily_battery_enabled INTEGER DEFAULT 1 NOT NULL,
        updated_at INTEGER DEFAULT 0 NOT NULL,
        updated_by TEXT
      )`,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO admin_runtime_settings (
        singleton_id, crates_enabled, minigame_power_enabled,
        daily_battery_enabled, updated_at
      ) VALUES (1, 1, 1, 1, 0)`,
    )
    .run();
}

export async function ensureAdminSchema(db: D1Database) {
  await ensureRuntimeSettingsSchema(db);
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS admin_owners (
        singleton_id INTEGER PRIMARY KEY NOT NULL,
        account_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS admin_session_reviews (
        session_id TEXT PRIMARY KEY NOT NULL,
        resolution TEXT NOT NULL,
        note TEXT DEFAULT '' NOT NULL,
        reviewed_by TEXT NOT NULL,
        reviewed_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS admin_session_reviews_reviewed_at_idx
       ON admin_session_reviews (reviewed_at)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS admin_audit_log (
        id TEXT PRIMARY KEY NOT NULL,
        actor_account_id TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}' NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
       ON admin_audit_log (created_at)`,
    ),
  ]);
}

export async function claimOrVerifyAdminOwner(
  db: D1Database,
  accountId: string,
  email: string,
  now: number,
) {
  await ensureAdminSchema(db);
  await db
    .prepare(
      `INSERT OR IGNORE INTO admin_owners (
        singleton_id, account_id, email, created_at
      ) VALUES (1, ?, ?, ?)`,
    )
    .bind(accountId, email.trim().toLowerCase(), now)
    .run();
  const owner = await db
    .prepare(
      `SELECT account_id, email, created_at
       FROM admin_owners WHERE singleton_id = 1`,
    )
    .first<OwnerRow>();
  return {
    allowed: owner?.account_id === accountId,
    owner,
  };
}

export async function readAdminRuntimeSettings(
  db: D1Database,
): Promise<AdminRuntimeSettings> {
  await ensureRuntimeSettingsSchema(db);
  const row = await db
    .prepare(
      `SELECT crates_enabled, minigame_power_enabled,
              daily_battery_enabled, updated_at, updated_by
       FROM admin_runtime_settings
       WHERE singleton_id = 1`,
    )
    .first<SettingsRow>();
  if (!row) return DEFAULT_SETTINGS;
  return {
    cratesEnabled: row.crates_enabled === 1,
    dailyBatteryEnabled: row.daily_battery_enabled === 1,
    minigamePowerEnabled: row.minigame_power_enabled === 1,
    updatedAt: Number(row.updated_at ?? 0),
    updatedBy: row.updated_by,
  };
}

export async function updateAdminRuntimeSetting(
  db: D1Database,
  setting: AdminSettingKey,
  enabled: boolean,
  actorAccountId: string,
  now: number,
) {
  await ensureRuntimeSettingsSchema(db);
  const columnBySetting: Record<AdminSettingKey, string> = {
    cratesEnabled: "crates_enabled",
    dailyBatteryEnabled: "daily_battery_enabled",
    minigamePowerEnabled: "minigame_power_enabled",
  };
  const column = columnBySetting[setting];
  await db
    .prepare(
      `UPDATE admin_runtime_settings
       SET ${column} = ?, updated_at = ?, updated_by = ?
       WHERE singleton_id = 1`,
    )
    .bind(enabled ? 1 : 0, now, actorAccountId)
    .run();
  return readAdminRuntimeSettings(db);
}

export async function writeAdminAudit(
  db: D1Database,
  actorAccountId: string,
  action: string,
  metadata: Record<string, unknown>,
  now: number,
) {
  await db
    .prepare(
      `INSERT INTO admin_audit_log (
        id, actor_account_id, action, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      actorAccountId,
      action,
      JSON.stringify(metadata),
      now,
    )
    .run();
}
