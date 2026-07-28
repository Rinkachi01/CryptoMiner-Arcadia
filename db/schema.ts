import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const gameStates = sqliteTable(
  "game_states",
  {
    accountId: text("account_id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    stateJson: text("state_json").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_states_email_unique").on(table.email),
    index("game_states_updated_at_idx").on(table.updatedAt),
  ],
);

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    action: text("action").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    stateVersion: integer("state_version").notNull(),
    deltaCmaMicros: integer("delta_cma_micros").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("ledger_entries_idempotency_unique").on(
      table.accountId,
      table.idempotencyKey,
    ),
    index("ledger_entries_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
  ],
);

export const gameSessions = sqliteTable(
  "game_sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    gameId: text("game_id").notNull(),
    nonce: text("nonce").notNull(),
    seed: text("seed").notNull(),
    status: text("status").notNull().default("active"),
    startedAt: integer("started_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    completedAt: integer("completed_at"),
    durationMs: integer("duration_ms"),
    score: integer("score"),
    rewardPowerGh: integer("reward_power_gh").notNull().default(0),
    riskLevel: text("risk_level").notNull().default("normal"),
    reviewReason: text("review_reason"),
    proofJson: text("proof_json").notNull().default("{}"),
    difficulty: integer("difficulty").notNull().default(1),
  },
  (table) => [
    uniqueIndex("game_sessions_nonce_unique").on(table.nonce),
    index("game_sessions_account_started_idx").on(
      table.accountId,
      table.startedAt,
    ),
    index("game_sessions_review_idx").on(table.riskLevel, table.startedAt),
  ],
);

export const gameProgress = sqliteTable(
  "game_progress",
  {
    accountId: text("account_id").notNull(),
    gameId: text("game_id").notNull(),
    level: integer("level").notNull().default(1),
    winStreak: integer("win_streak").notNull().default(0),
    nextPlayAt: integer("next_play_at").notNull().default(0),
    totalPlays: integer("total_plays").notNull().default(0),
    totalWins: integer("total_wins").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_progress_account_game_unique").on(
      table.accountId,
      table.gameId,
    ),
    index("game_progress_next_play_idx").on(table.gameId, table.nextPlayAt),
  ],
);

export const temporaryPowerGrants = sqliteTable(
  "temporary_power_grants",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    sourceSessionId: text("source_session_id").notNull(),
    powerGh: integer("power_gh").notNull(),
    startsAt: integer("starts_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("temporary_power_source_unique").on(table.sourceSessionId),
    index("temporary_power_account_expiry_idx").on(
      table.accountId,
      table.expiresAt,
    ),
  ],
);
