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

export const gameEmissionBudgets = sqliteTable(
  "game_emission_budgets",
  {
    accountId: text("account_id").notNull(),
    windowKey: text("window_key").notNull(),
    grantedPowerGh: integer("granted_power_gh").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_emission_budgets_account_window_unique").on(
      table.accountId,
      table.windowKey,
    ),
  ],
);

export const dailyMissionClaims = sqliteTable(
  "daily_mission_claims",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    missionId: text("mission_id").notNull(),
    windowKey: text("window_key").notNull(),
    status: text("status").notNull().default("reserved"),
    batteryReward: integer("battery_reward").notNull().default(1),
    stateVersionBefore: integer("state_version_before").notNull(),
    stateVersionAfter: integer("state_version_after"),
    createdAt: integer("created_at").notNull(),
    completedAt: integer("completed_at"),
  },
  (table) => [
    uniqueIndex("daily_mission_claims_account_window_unique").on(
      table.accountId,
      table.missionId,
      table.windowKey,
    ),
    index("daily_mission_claims_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
  ],
);

export const adminOwners = sqliteTable("admin_owners", {
  singletonId: integer("singleton_id").primaryKey(),
  accountId: text("account_id").notNull().unique(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const adminRuntimeSettings = sqliteTable("admin_runtime_settings", {
  singletonId: integer("singleton_id").primaryKey(),
  cratesEnabled: integer("crates_enabled").notNull().default(1),
  minigamePowerEnabled: integer("minigame_power_enabled").notNull().default(1),
  dailyBatteryEnabled: integer("daily_battery_enabled").notNull().default(1),
  powerAlertGh: integer("power_alert_gh").notNull().default(4_000),
  openReviewAlertCount: integer("open_review_alert_count").notNull().default(3),
  crateAlertCount: integer("crate_alert_count").notNull().default(20),
  minerConcentrationAlertPercent: integer(
    "miner_concentration_alert_percent",
  )
    .notNull()
    .default(45),
  updatedAt: integer("updated_at").notNull().default(0),
  updatedBy: text("updated_by"),
});

export const adminSessionReviews = sqliteTable(
  "admin_session_reviews",
  {
    sessionId: text("session_id").primaryKey(),
    resolution: text("resolution").notNull(),
    note: text("note").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: integer("reviewed_at").notNull(),
  },
  (table) => [
    index("admin_session_reviews_reviewed_at_idx").on(table.reviewedAt),
  ],
);

export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    actorAccountId: text("actor_account_id").notNull(),
    action: text("action").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("admin_audit_log_created_at_idx").on(table.createdAt),
  ],
);

export const betaFeedback = sqliteTable(
  "beta_feedback",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    category: text("category").notNull(),
    rating: integer("rating").notNull(),
    message: text("message").notNull(),
    page: text("page").notNull().default("tasks"),
    status: text("status").notNull().default("new"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("beta_feedback_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
    index("beta_feedback_created_at_idx").on(table.createdAt),
  ],
);

export const networkRuntimeSettings = sqliteTable("network_runtime_settings", {
  singletonId: integer("singleton_id").primaryKey(),
  baseCmaGh: integer("base_cma_gh").notNull().default(60_000_000),
  baseBtcGh: integer("base_btc_gh").notNull().default(1_800_000),
  baseDogeGh: integer("base_doge_gh").notNull().default(4_000_000),
  rewardCmaAtomic: integer("reward_cma_atomic").notNull().default(5_000),
  rewardBtcAtomic: integer("reward_btc_atomic").notNull().default(5),
  rewardDogeAtomic: integer("reward_doge_atomic")
    .notNull()
    .default(1_000_000),
  rewardBonusBps: integer("reward_bonus_bps").notNull().default(10_000),
  rewardBonusEndsAt: integer("reward_bonus_ends_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
  updatedBy: text("updated_by"),
});

export const seasons = sqliteTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    closedAt: integer("closed_at"),
  },
  (table) => [
    index("seasons_status_ends_at_idx").on(table.status, table.endsAt),
    index("seasons_created_at_idx").on(table.createdAt),
  ],
);

export const seasonSnapshots = sqliteTable(
  "season_snapshots",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id").notNull(),
    metricsJson: text("metrics_json").notNull().default("{}"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("season_snapshots_season_created_idx").on(
      table.seasonId,
      table.createdAt,
    ),
  ],
);
