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

export const operationalCheckpoints = sqliteTable(
  "operational_checkpoints",
  {
    id: text("id").primaryKey(),
    actorAccountId: text("actor_account_id").notNull(),
    status: text("status").notNull(),
    metricsJson: text("metrics_json").notNull().default("{}"),
    findingsJson: text("findings_json").notNull().default("[]"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("operational_checkpoints_created_at_idx").on(table.createdAt),
  ],
);

export const recoveryArchives = sqliteTable(
  "recovery_archives",
  {
    id: text("id").primaryKey(),
    objectKey: text("object_key").notNull().unique(),
    checksumSha256: text("checksum_sha256"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    rowCount: integer("row_count").notNull().default(0),
    status: text("status").notNull().default("preparing"),
    errorMessage: text("error_message"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("recovery_archives_created_at_idx").on(table.createdAt),
  ],
);

export const recoveryDrills = sqliteTable(
  "recovery_drills",
  {
    id: text("id").primaryKey(),
    archiveId: text("archive_id").notNull(),
    status: text("status").notNull(),
    checksJson: text("checks_json").notNull().default("{}"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("recovery_drills_created_at_idx").on(table.createdAt),
    index("recovery_drills_archive_idx").on(table.archiveId),
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

export const betaDeviceProfiles = sqliteTable("beta_device_profiles", {
  accountId: text("account_id").primaryKey(),
  firstViewport: text("first_viewport").notNull(),
  currentViewport: text("current_viewport").notNull(),
  firstInputMode: text("first_input_mode").notNull(),
  currentInputMode: text("current_input_mode").notNull(),
  textScale: text("text_scale").notNull().default("comfortable"),
  onboardingStage: integer("onboarding_stage").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const betaAccessibilityReviews = sqliteTable(
  "beta_accessibility_reviews",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    windowKey: text("window_key").notNull(),
    viewportBucket: text("viewport_bucket").notNull(),
    inputMode: text("input_mode").notNull(),
    textScale: text("text_scale").notNull().default("comfortable"),
    textReadable: integer("text_readable").notNull(),
    controlsEasy: integer("controls_easy").notNull(),
    motionComfortable: integer("motion_comfortable").notNull(),
    rackClear: integer("rack_clear").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("beta_accessibility_account_window_unique").on(
      table.accountId,
      table.windowKey,
    ),
    index("beta_accessibility_created_at_idx").on(table.createdAt),
  ],
);

export const taskPreferences = sqliteTable("task_preferences", {
  accountId: text("account_id").primaryKey(),
  partnerTasksMode: text("partner_tasks_mode").notNull().default("ask"),
  consentVersion: text("consent_version").notNull().default("beta-v1"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const taskPreferenceEvents = sqliteTable(
  "task_preference_events",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    partnerTasksMode: text("partner_tasks_mode").notNull(),
    consentVersion: text("consent_version").notNull().default("beta-v1"),
    source: text("source").notNull().default("tasks"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("task_preference_events_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
  ],
);

export const arcadeSecurityPasses = sqliteTable(
  "arcade_security_passes",
  {
    accountId: text("account_id").primaryKey(),
    verifiedAt: integer("verified_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("arcade_security_passes_expiry_idx").on(table.expiresAt)],
);

export const securityRateWindows = sqliteTable(
  "security_rate_windows",
  {
    accountId: text("account_id").notNull(),
    action: text("action").notNull(),
    windowKey: text("window_key").notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("security_rate_window_unique").on(
      table.accountId,
      table.action,
      table.windowKey,
    ),
    index("security_rate_windows_expiry_idx").on(table.expiresAt),
  ],
);

export const securityEvents = sqliteTable(
  "security_events",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    category: text("category").notNull(),
    reason: text("reason").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("security_events_created_at_idx").on(table.createdAt),
    index("security_events_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
  ],
);

export const marketPriceSnapshots = sqliteTable(
  "market_price_snapshots",
  {
    asset: text("asset").primaryKey(),
    usdPriceMicros: integer("usd_price_micros").notNull(),
    provider: text("provider").notNull(),
    observedAt: integer("observed_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("market_price_snapshots_observed_idx").on(table.observedAt),
  ],
);

export const conversionQuotes = sqliteTable(
  "conversion_quotes",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    asset: text("asset").notNull(),
    assetAmountAtomic: integer("asset_amount_atomic").notNull(),
    usdRateMicros: integer("usd_rate_micros").notNull(),
    grossCmaMicros: integer("gross_cma_micros").notNull(),
    feeBps: integer("fee_bps").notNull(),
    feeCmaMicros: integer("fee_cma_micros").notNull(),
    netCmaMicros: integer("net_cma_micros").notNull(),
    status: text("status").notNull().default("preview"),
    consumptionKey: text("consumption_key"),
    consumedAt: integer("consumed_at"),
    stateVersion: integer("state_version"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("conversion_quotes_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
    index("conversion_quotes_status_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const playerWalletAccounts = sqliteTable(
  "player_wallet_accounts",
  {
    accountId: text("account_id").primaryKey(),
    ledgerModel: text("ledger_model").notNull().default("individual"),
    custodyMode: text("custody_mode").notNull().default("provider_invoice"),
    depositStatus: text("deposit_status").notNull().default("awaiting_provider"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("player_wallet_accounts_deposit_status_idx").on(table.depositStatus),
  ],
);

export const walletDepositIntents = sqliteTable(
  "wallet_deposit_intents",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    asset: text("asset").notNull(),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference"),
    checkoutUrl: text("checkout_url"),
    depositAddress: text("deposit_address"),
    requestedUsdMicros: integer("requested_usd_micros").notNull(),
    receivedAtomic: integer("received_atomic").notNull().default(0),
    settlementAsset: text("settlement_asset"),
    settlementAtomic: integer("settlement_atomic").notNull().default(0),
    creditedCmaMicros: integer("credited_cma_micros").notNull().default(0),
    status: text("status").notNull().default("awaiting_provider"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("wallet_deposit_intents_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
    index("wallet_deposit_intents_provider_reference_idx").on(
      table.provider,
      table.providerReference,
    ),
    index("wallet_deposit_intents_status_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const walletProviderEvents = sqliteTable(
  "wallet_provider_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    depositIntentId: text("deposit_intent_id"),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull().default("received"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("wallet_provider_events_provider_event_unique").on(
      table.provider,
      table.providerEventId,
    ),
    index("wallet_provider_events_intent_created_idx").on(
      table.depositIntentId,
      table.createdAt,
    ),
  ],
);

export const walletPixDepositIntents = sqliteTable(
  "wallet_pix_deposit_intents",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerReference: text("provider_reference"),
    cmaUnits: integer("cma_units").notNull(),
    brlCents: integer("brl_cents").notNull(),
    usdBrlMicros: integer("usd_brl_micros").notNull(),
    marginBps: integer("margin_bps").notNull(),
    status: text("status").notNull().default("creating"),
    ticketUrl: text("ticket_url"),
    qrCode: text("qr_code"),
    creditedAt: integer("credited_at"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("wallet_pix_deposit_provider_reference_unique").on(
      table.providerReference,
    ),
    index("wallet_pix_deposit_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
    index("wallet_pix_deposit_status_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const walletWithdrawalIntents = sqliteTable(
  "wallet_withdrawal_intents",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    asset: text("asset").notNull(),
    provider: text("provider").notNull(),
    requestedAtomic: integer("requested_atomic").notNull(),
    destinationAddress: text("destination_address"),
    destinationPreview: text("destination_preview").notNull(),
    payoutBrlCents: integer("payout_brl_cents").notNull().default(0),
    status: text("status").notNull().default("simulation_only"),
    reviewNote: text("review_note"),
    transactionHash: text("transaction_hash"),
    resolvedAt: integer("resolved_at"),
    resolvedBy: text("resolved_by"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("wallet_withdrawal_intents_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
    index("wallet_withdrawal_intents_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const walletBrlRateSnapshots = sqliteTable("wallet_brl_rate_snapshots", {
  asset: text("asset").primaryKey(),
  brlPriceMicros: integer("brl_price_micros").notNull(),
  observedAt: integer("observed_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const walletBrlWithdrawalQuotes = sqliteTable(
  "wallet_brl_withdrawal_quotes",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    sourceAsset: text("source_asset").notNull(),
    sourceAtomic: integer("source_atomic").notNull(),
    brlPriceMicros: integer("brl_price_micros").notNull(),
    grossBrlCents: integer("gross_brl_cents").notNull(),
    feeBps: integer("fee_bps").notNull(),
    netBrlCents: integer("net_brl_cents").notNull(),
    status: text("status").notNull().default("preview"),
    consumedAt: integer("consumed_at"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("wallet_brl_withdrawal_quotes_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
    index("wallet_brl_withdrawal_quotes_status_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const networkRuntimeSettings = sqliteTable("network_runtime_settings", {
  singletonId: integer("singleton_id").primaryKey(),
  baseCmaGh: integer("base_cma_gh").notNull().default(60_000_000),
  baseBtcGh: integer("base_btc_gh").notNull().default(1_800_000),
  baseDogeGh: integer("base_doge_gh").notNull().default(4_000_000),
  baseLtcGh: integer("base_ltc_gh").notNull().default(2_500_000),
  rewardCmaAtomic: integer("reward_cma_atomic").notNull().default(5_000),
  rewardBtcAtomic: integer("reward_btc_atomic").notNull().default(5),
  rewardDogeAtomic: integer("reward_doge_atomic")
    .notNull()
    .default(1_000_000),
  rewardLtcAtomic: integer("reward_ltc_atomic").notNull().default(5_000),
  rewardBonusBps: integer("reward_bonus_bps").notNull().default(10_000),
  rewardBonusEndsAt: integer("reward_bonus_ends_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
  updatedBy: text("updated_by"),
});

export const accountNetworkPower = sqliteTable(
  "account_network_power",
  {
    accountId: text("account_id").primaryKey(),
    installedPowerGh: integer("installed_power_gh").notNull().default(0),
    allocationCma: integer("allocation_cma").notNull().default(100),
    allocationBtc: integer("allocation_btc").notNull().default(0),
    allocationDoge: integer("allocation_doge").notNull().default(0),
    allocationLtc: integer("allocation_ltc").notNull().default(0),
    energyExpiresAt: integer("energy_expires_at").notNull().default(0),
    updatedAt: integer("updated_at").notNull().default(0),
  },
  (table) => [
    index("account_network_power_energy_expiry_idx").on(
      table.energyExpiresAt,
    ),
  ],
);

export const seasons = sqliteTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    campaignSlug: text("campaign_slug").notNull().default("legacy"),
    durationDays: integer("duration_days").notNull().default(30),
    premiumPriceCmaMicros: integer("premium_price_cma_micros")
      .notNull()
      .default(0),
    configurationJson: text("configuration_json").notNull().default("{}"),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    closedAt: integer("closed_at"),
  },
  (table) => [
    index("seasons_status_ends_at_idx").on(table.status, table.endsAt),
    index("seasons_created_at_idx").on(table.createdAt),
    index("seasons_campaign_slug_idx").on(table.campaignSlug),
  ],
);

export const seasonDailyLogins = sqliteTable(
  "season_daily_logins",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id").notNull(),
    accountId: text("account_id").notNull(),
    dayKey: text("day_key").notNull(),
    xp: integer("xp").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("season_daily_logins_unique").on(
      table.seasonId,
      table.accountId,
      table.dayKey,
    ),
    index("season_daily_logins_season_account_idx").on(
      table.seasonId,
      table.accountId,
    ),
  ],
);

export const seasonPasses = sqliteTable(
  "season_passes",
  {
    seasonId: text("season_id").notNull(),
    accountId: text("account_id").notNull(),
    premiumUnlocked: integer("premium_unlocked").notNull().default(0),
    cmaPaidMicros: integer("cma_paid_micros").notNull().default(0),
    purchasedAt: integer("purchased_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("season_passes_season_account_unique").on(
      table.seasonId,
      table.accountId,
    ),
    index("season_passes_account_idx").on(table.accountId),
  ],
);

export const seasonPassMax = sqliteTable(
  "season_pass_max",
  {
    seasonId: text("season_id").notNull(),
    accountId: text("account_id").notNull(),
    cmaPaidMicros: integer("cma_paid_micros").notNull(),
    purchasedAt: integer("purchased_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("season_pass_max_season_account_unique").on(
      table.seasonId,
      table.accountId,
    ),
    index("season_pass_max_account_idx").on(table.accountId),
  ],
);

export const seasonRewardClaims = sqliteTable(
  "season_reward_claims",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id").notNull(),
    accountId: text("account_id").notNull(),
    level: integer("level").notNull(),
    track: text("track").notNull(),
    rewardJson: text("reward_json").notNull(),
    status: text("status").notNull().default("completed"),
    stateVersionBefore: integer("state_version_before").notNull(),
    stateVersionAfter: integer("state_version_after").notNull(),
    createdAt: integer("created_at").notNull(),
    completedAt: integer("completed_at").notNull(),
  },
  (table) => [
    uniqueIndex("season_reward_claims_unique").on(
      table.seasonId,
      table.accountId,
      table.track,
      table.level,
    ),
    index("season_reward_claims_account_idx").on(
      table.accountId,
      table.createdAt,
    ),
  ],
);

export const referralCodes = sqliteTable(
  "referral_codes",
  {
    accountId: text("account_id").primaryKey(),
    code: text("code").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("referral_codes_code_unique").on(table.code)],
);

export const referralAttributions = sqliteTable(
  "referral_attributions",
  {
    referredAccountId: text("referred_account_id").primaryKey(),
    referrerAccountId: text("referrer_account_id").notNull(),
    referralCode: text("referral_code").notNull(),
    status: text("status").notNull().default("tracked"),
    attributedAt: integer("attributed_at").notNull(),
    validatedAt: integer("validated_at"),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    index("referral_attributions_referrer_idx").on(
      table.referrerAccountId,
      table.attributedAt,
    ),
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

export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    accountId: text("account_id").notNull(),
    email: text("email").notNull(),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("open"),
    deliveryStatus: text("delivery_status")
      .notNull()
      .default("configuration_pending"),
    providerMessageId: text("provider_message_id"),
    adminNote: text("admin_note").notNull().default(""),
    lastReplyAt: integer("last_reply_at"),
    lastReplyBy: text("last_reply_by"),
    replyDeliveryStatus: text("reply_delivery_status")
      .notNull()
      .default("none"),
    replyProviderMessageId: text("reply_provider_message_id"),
    playerSeenReplyAt: integer("player_seen_reply_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("support_tickets_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
    index("support_tickets_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);
