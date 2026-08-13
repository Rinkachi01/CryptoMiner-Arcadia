import {
  DEFAULT_SEASON_DURATION_DAYS,
  SEASON_DAILY_GAME_XP_CAP,
  SEASON_DAILY_LOGIN_XP,
  SEASON_DAILY_SPEND_XP_CAP,
  SEASON_GAME_XP,
  SEASON_SPEND_XP_PER_CMA,
  SPACE_RACE_DURATION_DAYS,
  SPACE_RACE_LEVELS,
  SPACE_RACE_PREMIUM_PRICE_CMA,
  SPACE_RACE_PREMIUM_MAX_PRICE_CMA,
  SPACE_RACE_SEASON_ID,
  SPACE_RACE_SLUG,
  calculateSeasonScore,
  compareSeasonSnapshots,
  normalizeSeasonDurationDays,
  seasonLevelForXp,
  seasonPremiumMaxPriceCma,
  seasonProgressPercent,
  seasonXpRequiredForLevel,
  spaceRaceRewards,
  type SeasonReward,
  type SeasonTrack,
} from "./season-rules";
import { ensureAdminSchema } from "./admin-settings";
import { getMiner } from "./game-rules";
import type { PublicGameState } from "./game-server";
import { ensureNetworkSchema } from "./network-server";

const DAY_MS = 24 * 60 * 60 * 1000;

type SeasonRow = {
  campaign_slug: string;
  closed_at: number | null;
  configuration_json: string;
  created_at: number;
  created_by: string;
  duration_days: number;
  ends_at: number;
  id: string;
  name: string;
  premium_price_cma_micros: number;
  starts_at: number;
  status: string;
};

type LeaderboardRow = {
  account_id: string;
  display_name: string | null;
  highest_difficulty: number;
  plays: number;
  wins: number;
};

type DailyActivityRow = {
  account_id: string;
  activity_key: string;
  total: number;
};

type SeasonPassRow = {
  cma_paid_micros: number;
  premium_unlocked: number;
  purchased_at: number | null;
};

type SeasonPassMaxRow = {
  cma_paid_micros: number;
  purchased_at: number;
};

type SeasonClaimRow = {
  level: number;
  track: string;
};

type SeasonLoginRow = {
  created_at: number;
  day_key: string;
  xp: number;
};

type StoredGameStateRow = {
  state_json: string;
  version: number;
};

type SnapshotRow = {
  created_at: number;
  id: string;
  metrics_json: string;
  season_id: string;
};

type SeasonSessionSummaryRow = {
  active_operators: number;
  games: number;
  power_granted_gh: number;
  wins: number;
};

type SeasonLedgerSummaryRow = {
  battery_claims: number;
  cma_block_micros: number;
  cma_spent_micros: number;
  cma_test_micros: number;
  crate_opens: number;
};

type SeasonBlockRewardRow = {
  btc_atomic: number;
  doge_atomic: number;
  ltc_atomic: number;
};

type SeasonCountRow = {
  total: number;
};

export type PublicSeason = {
  campaignSlug: string;
  closedAt: number | null;
  createdAt: number;
  durationDays: number;
  endsAt: number;
  id: string;
  name: string;
  premiumPriceCma: number;
  premiumMaxPriceCma: number;
  progressPercent: number;
  startsAt: number;
  status: "active" | "closed" | "draft";
};

export type SeasonLeaderboardEntry = {
  accountId: string;
  displayName: string;
  highestDifficulty: number;
  plays: number;
  rank: number;
  score: number;
  wins: number;
  level: number;
};

export type Quest = {
  id: string;
  type: "games_played" | "games_won" | "cma_spent" | "crates_opened";
  requirement: number;
  xp: number;
  title: string;
};

export type QuestProgress = {
  quest: Quest;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export const DAILY_QUESTS: Quest[] = [
  { id: "daily_games_10", type: "games_played", requirement: 10, xp: 10, title: "Jogar 10 minigames" },
  { id: "daily_wins_5", type: "games_won", requirement: 5, xp: 15, title: "Vencer 5 minigames" },
  { id: "daily_spend_2", type: "cma_spent", requirement: 2, xp: 10, title: "Gastar 2 CMA na Loja" },
  { id: "daily_spend_5", type: "cma_spent", requirement: 5, xp: 15, title: "Gastar 5 CMA na Loja" },
];

export const WEEKLY_QUESTS: Quest[] = [
  { id: "weekly_games_50", type: "games_played", requirement: 50, xp: 40, title: "Jogar 50 minigames" },
  { id: "weekly_wins_30", type: "games_won", requirement: 30, xp: 50, title: "Vencer 30 minigames" },
  { id: "weekly_spend_10", type: "cma_spent", requirement: 10, xp: 25, title: "Gastar 10 CMA na Loja" },
  { id: "weekly_spend_50", type: "cma_spent", requirement: 50, xp: 50, title: "Gastar 50 CMA na Loja" },
  { id: "weekly_crate_1", type: "crates_opened", requirement: 1, xp: 30, title: "Abrir 1 Caixa de Suprimentos" },
];

export type SeasonPlayerProgress = {
  claimedRewardKeys: string[];
  level: number;
  nextLevelXp: number;
  maxUnlocked: boolean;
  premiumUnlocked: boolean;
  dailyLogin: {
    claimedToday: boolean;
    cycleDay: number;
    nextXp: number;
    schedule: readonly number[];
    streakDays: number;
  };
  quests: {
    daily: QuestProgress[];
    weekly: QuestProgress[];
  };
  sources: {
    games: number;
    logins: number;
    missions: number;
    spending: number;
  };
  xp: number;
};

export type PowerLeaderboardEntry = {
  accountId: string;
  displayName: string;
  powerGh: number;
  rank: number;
};

export type SeasonSnapshot = {
  createdAt: number;
  id: string;
  metrics: Record<string, number>;
  seasonId: string;
};

export type SeasonEconomicReport = {
  checks: {
    enoughActivity: boolean;
    enoughPlayers: boolean;
    enoughSnapshots: boolean;
    reviewQueueClear: boolean;
    seasonClosed: boolean;
  };
  metrics: {
    activeOperators: number;
    batteryClaims: number;
    btcCreditedAtomic: number;
    cmaBlockCredits: number;
    cmaSpent: number;
    cmaTestCredits: number;
    crateOpens: number;
    dogeCreditedAtomic: number;
    ltcCreditedAtomic: number;
    games: number;
    newPlayers: number;
    openReviews: number;
    powerGrantedGh: number;
    winRate: number;
    wins: number;
  };
  period: {
    endsAt: number;
    startsAt: number;
  };
  readyForEconomyReview: boolean;
  seasonId: string;
  snapshotComparison: {
    activePlayers24hDelta: number;
    fromAt: number;
    games24hDelta: number;
    powerGranted24hDelta: number;
    toAt: number;
    totalPlayersDelta: number;
  } | null;
  status: "active" | "closed";
};

export async function ensureSeasonSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS seasons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        campaign_slug TEXT NOT NULL DEFAULT 'legacy',
        duration_days INTEGER NOT NULL DEFAULT 30,
        premium_price_cma_micros INTEGER NOT NULL DEFAULT 0,
        configuration_json TEXT NOT NULL DEFAULT '{}',
        starts_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS seasons_status_ends_at_idx
       ON seasons (status, ends_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS seasons_created_at_idx
       ON seasons (created_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS seasons_campaign_slug_idx
       ON seasons (campaign_slug)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS season_snapshots (
        id TEXT PRIMARY KEY,
        season_id TEXT NOT NULL,
        metrics_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS season_snapshots_season_created_idx
       ON season_snapshots (season_id, created_at)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS season_daily_logins (
        id TEXT PRIMARY KEY,
        season_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        day_key TEXT NOT NULL,
        xp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS season_daily_logins_unique
       ON season_daily_logins (season_id, account_id, day_key)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS season_daily_logins_season_account_idx
       ON season_daily_logins (season_id, account_id)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS season_passes (
        season_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        premium_unlocked INTEGER NOT NULL DEFAULT 0,
        cma_paid_micros INTEGER NOT NULL DEFAULT 0,
        purchased_at INTEGER,
        updated_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS season_passes_season_account_unique
       ON season_passes (season_id, account_id)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS season_passes_account_idx
       ON season_passes (account_id)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS season_pass_max (
        season_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        cma_paid_micros INTEGER NOT NULL,
        purchased_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS season_pass_max_season_account_unique
       ON season_pass_max (season_id, account_id)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS season_pass_max_account_idx
       ON season_pass_max (account_id)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS season_reward_claims (
        id TEXT PRIMARY KEY,
        season_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        track TEXT NOT NULL,
        reward_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        state_version_before INTEGER NOT NULL,
        state_version_after INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS season_reward_claims_unique
       ON season_reward_claims (season_id, account_id, track, level)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS season_reward_claims_account_idx
       ON season_reward_claims (account_id, created_at)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS season_quest_claims (
        id TEXT PRIMARY KEY,
        season_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        cycle_key TEXT NOT NULL,
        xp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS season_quest_claims_unique
       ON season_quest_claims (season_id, account_id, quest_id, cycle_key)`,
    ),
    db.prepare(
      `INSERT OR IGNORE INTO season_pass_max (
        season_id, account_id, cma_paid_micros, purchased_at, updated_at
      )
      SELECT season_id, account_id, 0, MIN(created_at), MAX(created_at)
      FROM season_quest_claims
      WHERE quest_id = 'buy-premium-max'
      GROUP BY season_id, account_id`,
    ),
  ]);
}

function publicSeason(row: SeasonRow, now: number): PublicSeason {
  return {
    campaignSlug: row.campaign_slug,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    durationDays: row.duration_days,
    endsAt: row.ends_at,
    id: row.id,
    name: row.name,
    premiumPriceCma: row.premium_price_cma_micros / 1_000_000,
    premiumMaxPriceCma: SPACE_RACE_PREMIUM_MAX_PRICE_CMA,
    progressPercent:
      row.status === "draft"
        ? 0
        : seasonProgressPercent(row.starts_at, row.ends_at, now),
    startsAt: row.starts_at,
    status:
      row.status === "active"
        ? "active"
        : row.status === "draft"
          ? "draft"
          : "closed",
  };
}

function parseSnapshotMetrics(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

async function readSeasonRow(db: D1Database) {
  return db
    .prepare(
      `SELECT id, name, status, campaign_slug, duration_days,
              premium_price_cma_micros, configuration_json,
              starts_at, ends_at, created_by, created_at, closed_at
       FROM seasons
       WHERE status != 'draft'
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 1`,
    )
    .first<SeasonRow>();
}

async function readSpaceRaceDraftRow(db: D1Database) {
  return db
    .prepare(
      `SELECT id, name, status, campaign_slug, duration_days,
              premium_price_cma_micros, configuration_json,
              starts_at, ends_at, created_by, created_at, closed_at
       FROM seasons
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(SPACE_RACE_SEASON_ID)
    .first<SeasonRow>();
}

export async function ensureSpaceRaceDraft(db: D1Database, now: number) {
  await ensureSeasonSchema(db);
  await db
    .prepare(
      `INSERT OR IGNORE INTO seasons (
        id, name, status, campaign_slug, duration_days,
        premium_price_cma_micros, configuration_json,
        starts_at, ends_at, created_by, created_at, closed_at
      ) VALUES (?, 'Temporada 01 · Corrida Espacial', 'draft', ?, ?, ?, ?, 0, 0, 'system', ?, NULL)`,
    )
    .bind(
      SPACE_RACE_SEASON_ID,
      SPACE_RACE_SLUG,
      SPACE_RACE_DURATION_DAYS,
      SPACE_RACE_PREMIUM_PRICE_CMA * 1_000_000,
      JSON.stringify({ levels: SPACE_RACE_LEVELS, rewardVersion: 1 }),
      now,
    )
    .run();
  await db
    .prepare(
      `UPDATE seasons
       SET duration_days = ?, premium_price_cma_micros = ?,
           configuration_json = ?
       WHERE id = ? AND status = 'draft'`,
    )
    .bind(
      SPACE_RACE_DURATION_DAYS,
      SPACE_RACE_PREMIUM_PRICE_CMA * 1_000_000,
      JSON.stringify({ levels: SPACE_RACE_LEVELS, rewardVersion: 1 }),
      SPACE_RACE_SEASON_ID,
    )
    .run();
  return readSpaceRaceDraftRow(db);
}

export async function ensureDefaultSeason(db: D1Database, now: number) {
  await ensureSeasonSchema(db);
  const count = await db
    .prepare("SELECT COUNT(*) AS total FROM seasons")
    .first<{ total: number }>();
  if (Number(count?.total ?? 0) === 0) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO seasons (
          id, name, status, campaign_slug, duration_days,
          premium_price_cma_micros, configuration_json,
          starts_at, ends_at, created_by, created_at, closed_at
        ) VALUES (?, ?, 'active', 'alpha-default', ?, 0, '{}', ?, ?, 'system', ?, NULL)`,
      )
      .bind(
        "season-alpha-default",
        "Ciclo inaugural Arcadia",
        DEFAULT_SEASON_DURATION_DAYS,
        now,
        now + DEFAULT_SEASON_DURATION_DAYS * DAY_MS,
        now,
      )
      .run();
  }
  await db
    .prepare(
      `UPDATE seasons
       SET name = 'Ciclo inaugural Arcadia'
       WHERE id = 'season-alpha-default'
         AND name = 'Temporada Alfa · Teste fechado'`,
    )
    .run();
  await db
    .prepare(
      `UPDATE seasons
       SET status = 'closed', closed_at = ends_at
       WHERE status = 'active' AND ends_at <= ?`,
    )
    .bind(now)
    .run();
  await ensureSpaceRaceDraft(db, now);
  return readSeasonRow(db);
}

export async function readSeasonLeaderboard(
  db: D1Database,
  season: SeasonRow,
) {
  await ensureAdminSchema(db);
  const until =
    season.status === "active"
      ? Math.min(Date.now(), season.ends_at)
      : (season.closed_at ?? season.ends_at);
  const rows = await db
    .prepare(
      `SELECT sessions.account_id,
              states.display_name,
              COUNT(*) AS plays,
              COALESCE(SUM(CASE WHEN sessions.status = 'completed' THEN 1 ELSE 0 END), 0) AS wins,
              COALESCE(MAX(sessions.difficulty), 0) AS highest_difficulty
       FROM game_sessions sessions
       LEFT JOIN game_states states ON states.account_id = sessions.account_id
       LEFT JOIN admin_owners owner ON owner.account_id = sessions.account_id
       WHERE sessions.started_at >= ? AND sessions.started_at <= ?
         AND sessions.status IN ('completed', 'failed')
         AND owner.account_id IS NULL
       GROUP BY sessions.account_id, states.display_name`,
    )
    .bind(season.starts_at, until)
    .all<LeaderboardRow>();

  const baseEntries = rows.results.map((row) => ({
      accountId: row.account_id,
      displayName: row.display_name ?? "Operador Arcadia",
      highestDifficulty: Number(row.highest_difficulty),
      plays: Number(row.plays),
      legacyScore: calculateSeasonScore({
        highestDifficulty: Number(row.highest_difficulty),
        plays: Number(row.plays),
        wins: Number(row.wins),
      }),
      wins: Number(row.wins),
    }));

  if (season.campaign_slug !== SPACE_RACE_SLUG) {
    return baseEntries
      .map((entry) => ({
        ...entry,
        level: 1,
        score: entry.legacyScore,
        xp: 0,
      }))
      .sort(
        (first, second) =>
          second.score - first.score ||
          second.wins - first.wins ||
          first.displayName.localeCompare(second.displayName, "pt-BR"),
      )
      .map((entry, index) => ({
        accountId: entry.accountId,
        displayName: entry.displayName,
        highestDifficulty: entry.highestDifficulty,
        level: entry.level,
        plays: entry.plays,
        rank: index + 1,
        score: entry.score,
        wins: entry.wins,
        xp: entry.xp,
      }));
  }

  const [loginRows, gameRows, spendingRows, questClaims] = await Promise.all([
    db
      .prepare(
        `SELECT account_id, 'login' AS activity_key, COALESCE(SUM(xp), 0) AS total
         FROM season_daily_logins
         WHERE season_id = ?
         GROUP BY account_id`,
      )
      .bind(season.id)
      .all<DailyActivityRow>(),
    db
      .prepare(
        `SELECT account_id,
                CAST((completed_at - ?) / ? AS INTEGER) AS activity_key,
                COUNT(*) AS total
         FROM game_sessions
         WHERE completed_at >= ? AND completed_at <= ?
           AND status = 'completed'
         GROUP BY account_id, activity_key`,
      )
      .bind(season.starts_at, DAY_MS, season.starts_at, until)
      .all<DailyActivityRow>(),
    db
      .prepare(
        `SELECT account_id,
                CAST((created_at - ?) / ? AS INTEGER) AS activity_key,
                COALESCE(SUM(-delta_cma_micros), 0) AS total
         FROM ledger_entries
         WHERE created_at >= ? AND created_at <= ?
           AND delta_cma_micros < 0
         GROUP BY account_id, activity_key`,
      )
      .bind(season.starts_at, DAY_MS, season.starts_at, until)
      .all<DailyActivityRow>(),
    db
      .prepare(
        `SELECT account_id, 'quest' AS activity_key, COALESCE(SUM(xp), 0) AS total
         FROM season_quest_claims
         WHERE season_id = ? AND quest_id != 'buy-premium-max'
         GROUP BY account_id`,
      )
      .bind(season.id)
      .all<DailyActivityRow>(),
  ]);

  const xpByAccount = new Map<
    string,
    SeasonPlayerProgress["sources"] & { xp: number }
  >();
  const ensureXp = (accountId: string) => {
    const existing = xpByAccount.get(accountId);
    if (existing) return existing;
    const created = { games: 0, logins: 0, missions: 0, spending: 0, xp: 0 };
    xpByAccount.set(accountId, created);
    return created;
  };

  for (const row of loginRows.results) {
    const progress = ensureXp(row.account_id);
    progress.logins += Math.max(0, Number(row.total));
  }

  for (const row of questClaims.results) {
    const progress = ensureXp(row.account_id);
    progress.missions += Math.max(0, Number(row.total));
  }

  const weeklyGames = new Map<string, number>();
  for (const row of gameRows.results) {
    const dailyGames = Math.max(0, Number(row.total));
    const progress = ensureXp(row.account_id);
    progress.games += Math.min(
      SEASON_DAILY_GAME_XP_CAP,
      dailyGames * SEASON_GAME_XP,
    );
    const week = Math.floor(Number(row.activity_key) / 7);
    const key = `${row.account_id}:${week}`;
    weeklyGames.set(key, (weeklyGames.get(key) ?? 0) + dailyGames);
  }

  for (const row of spendingRows.results) {
    const progress = ensureXp(row.account_id);
    progress.spending += Math.min(
      SEASON_DAILY_SPEND_XP_CAP,
      Math.floor(Math.max(0, Number(row.total)) / 1_000_000) *
        SEASON_SPEND_XP_PER_CMA,
    );
  }
  for (const progress of xpByAccount.values()) {
    progress.xp =
      progress.games + progress.logins + progress.missions + progress.spending;
  }

  const accounts = new Set([
    ...baseEntries.map((entry) => entry.accountId),
    ...xpByAccount.keys(),
  ]);
  const owner = await db
    .prepare("SELECT account_id FROM admin_owners WHERE singleton_id = 1")
    .first<{ account_id: string }>();
  if (owner?.account_id) accounts.delete(owner.account_id);
  const displayNames = new Map(
    baseEntries.map((entry) => [entry.accountId, entry.displayName]),
  );
  const baseByAccount = new Map(
    baseEntries.map((entry) => [entry.accountId, entry]),
  );

  return [...accounts]
    .map((accountId) => {
      const base = baseByAccount.get(accountId);
      const xp = xpByAccount.get(accountId)?.xp ?? 0;
      return {
        accountId,
        displayName: displayNames.get(accountId) ?? "Operador Arcadia",
        highestDifficulty: base?.highestDifficulty ?? 0,
        level: seasonLevelForXp(xp),
        plays: base?.plays ?? 0,
        score: xp,
        wins: base?.wins ?? 0,
        xp,
      };
    })
    .sort(
      (first, second) =>
        second.xp - first.xp ||
        second.wins - first.wins ||
        first.displayName.localeCompare(second.displayName, "pt-BR"),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function readPlayerProgress(
  db: D1Database,
  season: SeasonRow,
  accountId: string,
  leaderboard: SeasonLeaderboardEntry[],
  now = Date.now(),
): Promise<SeasonPlayerProgress> {
  const [pass, maxPass, claims] = await Promise.all([
    db
      .prepare(
        `SELECT premium_unlocked, cma_paid_micros, purchased_at
         FROM season_passes
         WHERE season_id = ? AND account_id = ?`,
      )
      .bind(season.id, accountId)
      .first<SeasonPassRow>(),
    db
      .prepare(
        `SELECT cma_paid_micros, purchased_at
         FROM season_pass_max
         WHERE season_id = ? AND account_id = ?`,
      )
      .bind(season.id, accountId)
      .first<SeasonPassMaxRow>(),
    db
      .prepare(
        `SELECT level, track
         FROM season_reward_claims
         WHERE season_id = ? AND account_id = ? AND status = 'completed'`,
      )
      .bind(season.id, accountId)
      .all<SeasonClaimRow>(),
  ]);
  const entry = leaderboard.find((item) => item.accountId === accountId);
  const xp = entry?.score ?? 0;
  const level = seasonLevelForXp(xp);

  const [loginRows, gameDaily, spendingDaily, questClaims, crateDaily] = await Promise.all([
    db
      .prepare(
        `SELECT day_key, xp, created_at
         FROM season_daily_logins
         WHERE season_id = ? AND account_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(season.id, accountId)
      .all<SeasonLoginRow>(),
    db
      .prepare(
        `SELECT CAST((completed_at - ?) / ? AS INTEGER) AS activity_key,
                COUNT(*) AS total,
                SUM(CASE WHEN score > 0 THEN 1 ELSE 0 END) AS wins
         FROM game_sessions
         WHERE account_id = ? AND completed_at >= ? AND completed_at <= ?
           AND status = 'completed'
         GROUP BY activity_key`,
      )
      .bind(season.starts_at, DAY_MS, accountId, season.starts_at, season.ends_at)
      .all<{ activity_key: string; total: number; wins: number }>(),
    db
      .prepare(
        `SELECT CAST((created_at - ?) / ? AS INTEGER) AS activity_key,
                COALESCE(SUM(-delta_cma_micros), 0) AS total
         FROM ledger_entries
         WHERE account_id = ? AND created_at >= ? AND created_at <= ?
           AND delta_cma_micros < 0
         GROUP BY activity_key`,
      )
      .bind(season.starts_at, DAY_MS, accountId, season.starts_at, season.ends_at)
      .all<DailyActivityRow>(),
    db
      .prepare(
        `SELECT quest_id, cycle_key, xp
         FROM season_quest_claims
         WHERE season_id = ? AND account_id = ?`,
      )
      .bind(season.id, accountId)
      .all<{ quest_id: string; cycle_key: string; xp: number }>(),
    db
      .prepare(
        `SELECT CAST((created_at - ?) / ? AS INTEGER) AS activity_key,
                COUNT(*) AS total
         FROM ledger_entries
         WHERE account_id = ? AND created_at >= ? AND created_at <= ?
           AND action = 'open_supply_crate'
         GROUP BY activity_key`,
      )
      .bind(season.starts_at, DAY_MS, accountId, season.starts_at, season.ends_at)
      .all<DailyActivityRow>(),
  ]);
  let games = 0;
  let missions = 0;
  let totalGamesToday = 0;
  let totalWinsToday = 0;
  let totalGamesWeek = 0;
  let totalWinsWeek = 0;
  let cratesToday = 0;
  let cratesWeek = 0;
  
  const todayActivityKey = Math.floor((now - season.starts_at) / DAY_MS);
  const currentWeek = Math.floor((now - season.starts_at) / (7 * DAY_MS));
  
  for (const row of gameDaily.results) {
    const count = Math.max(0, Number(row.total));
    const wins = Math.max(0, Number(row.wins));
    games += Math.min(SEASON_DAILY_GAME_XP_CAP, count * SEASON_GAME_XP);
    
    if (Number(row.activity_key) === todayActivityKey) {
      totalGamesToday += count;
      totalWinsToday += wins;
    }
    
    const week = Math.floor(Number(row.activity_key) / 7);
    if (week === currentWeek) {
      totalGamesWeek += count;
      totalWinsWeek += wins;
    }
  }

  let spendingTodayCma = 0;
  let spendingWeekCma = 0;
  const spending = spendingDaily.results.reduce(
    (total, row) => {
      const spentCma = Math.floor(Math.max(0, Number(row.total)) / 1_000_000);
      if (Number(row.activity_key) === todayActivityKey) {
        spendingTodayCma += spentCma;
      }
      const week = Math.floor(Number(row.activity_key) / 7);
      if (week === currentWeek) {
        spendingWeekCma += spentCma;
      }
      return total + Math.min(SEASON_DAILY_SPEND_XP_CAP, spentCma * SEASON_SPEND_XP_PER_CMA);
    },
    0,
  );
  const loginDays = new Set(
    loginRows.results.map((row) => Math.floor(Number(row.created_at) / DAY_MS)),
  );
  const today = Math.floor(now / DAY_MS);
  const claimedToday = loginDays.has(today);
  let streakDays = 0;
  let cursor = claimedToday ? today : today - 1;
  while (loginDays.has(cursor)) {
    streakDays += 1;
    cursor -= 1;
  }
  const cycleDay = claimedToday
    ? ((Math.max(1, streakDays) - 1) % SEASON_DAILY_LOGIN_XP.length) + 1
    : (streakDays % SEASON_DAILY_LOGIN_XP.length) + 1;

  // Quest Evaluation
  const cycleKeyDaily = `daily_${today}`;
  const cycleKeyWeekly = `weekly_${Math.floor(now / (7 * DAY_MS))}`;
  const claimedSet = new Set(questClaims.results.map(c => `${c.quest_id}:${c.cycle_key}`));
  
  missions = questClaims.results.reduce(
    (acc, claim) =>
      claim.quest_id === "buy-premium-max" ? acc : acc + claim.xp,
    0,
  );

  function evaluateQuest(quest: Quest, progressVal: number, cycleKey: string): QuestProgress {
    const completed = progressVal >= quest.requirement;
    const claimed = claimedSet.has(`${quest.id}:${cycleKey}`);
    return { quest, progress: Math.min(progressVal, quest.requirement), completed, claimed };
  }

  for (const row of crateDaily.results) {
    const count = Math.max(0, Number(row.total));
    if (Number(row.activity_key) === todayActivityKey) cratesToday += count;
    const week = Math.floor(Number(row.activity_key) / 7);
    if (week === currentWeek) cratesWeek += count;
  }

  const quests = {
    daily: DAILY_QUESTS.map(q => {
      let p = 0;
      if (q.type === "games_played") p = totalGamesToday;
      if (q.type === "games_won") p = totalWinsToday;
      if (q.type === "cma_spent") p = spendingTodayCma;
      if (q.type === "crates_opened") p = cratesToday;
      return evaluateQuest(q, p, cycleKeyDaily);
    }),
    weekly: WEEKLY_QUESTS.map(q => {
      let p = 0;
      if (q.type === "games_played") p = totalGamesWeek;
      if (q.type === "games_won") p = totalWinsWeek;
      if (q.type === "cma_spent") p = spendingWeekCma;
      if (q.type === "crates_opened") p = cratesWeek;
      return evaluateQuest(q, p, cycleKeyWeekly);
    }),
  };

  return {
    claimedRewardKeys: claims.results.map(
      (claim) => `${claim.track}:${claim.level}`,
    ),
    level,
    nextLevelXp:
      level >= SPACE_RACE_LEVELS
        ? seasonXpRequiredForLevel(SPACE_RACE_LEVELS)
        : seasonXpRequiredForLevel(level + 1),
    maxUnlocked: Boolean(maxPass),
    premiumUnlocked: pass?.premium_unlocked === 1,
    dailyLogin: {
      claimedToday,
      cycleDay,
      nextXp: SEASON_DAILY_LOGIN_XP[cycleDay - 1],
      schedule: SEASON_DAILY_LOGIN_XP,
      streakDays,
    },
    quests,
    sources: {
      games,
      logins: loginRows.results.reduce(
        (total, row) => total + Math.max(0, Number(row.xp)),
        0,
      ),
      missions,
      spending,
    },
    xp:
      games +
      missions +
      spending +
      loginRows.results.reduce(
        (total, row) => total + Math.max(0, Number(row.xp)),
        0,
      ),
  };
}

async function readPowerLeaderboard(db: D1Database, now: number) {
  await Promise.all([ensureAdminSchema(db), ensureNetworkSchema(db)]);
  const rows = await db
    .prepare(
      `SELECT network.account_id,
              states.display_name,
              network.installed_power_gh + COALESCE(temp.power_gh, 0) AS power_gh
       FROM account_network_power network
       LEFT JOIN game_states states ON states.account_id = network.account_id
       LEFT JOIN (
         SELECT account_id, COALESCE(SUM(power_gh), 0) AS power_gh
         FROM temporary_power_grants
         WHERE starts_at <= ? AND expires_at > ?
         GROUP BY account_id
       ) temp ON temp.account_id = network.account_id
       LEFT JOIN admin_owners owner ON owner.account_id = network.account_id
       WHERE network.energy_expires_at > ?
         AND owner.account_id IS NULL
         AND network.installed_power_gh + COALESCE(temp.power_gh, 0) > 0
       ORDER BY power_gh DESC, states.display_name ASC
       LIMIT 25`,
    )
    .bind(now, now, now)
    .all<{ account_id: string; display_name: string | null; power_gh: number }>();
  return rows.results.map((row, index): PowerLeaderboardEntry => ({
    accountId: row.account_id,
    displayName: row.display_name ?? "Operador Arcadia",
    powerGh: Math.max(0, Number(row.power_gh)),
    rank: index + 1,
  }));
}

export async function readSeasonOverview(
  db: D1Database,
  accountId: string,
  now: number,
  includeDraft = false,
) {
  const row = await ensureDefaultSeason(db, now);
  if (!row) {
    return {
      currentPlayer: null,
      draft: null,
      leaderboard: [] as SeasonLeaderboardEntry[],
      powerLeaderboard: [] as PowerLeaderboardEntry[],
      playerProgress: null as SeasonPlayerProgress | null,
      rewards: [] as SeasonReward[],
      season: null,
      snapshots: [] as SeasonSnapshot[],
    };
  }
  const leaderboard = await readSeasonLeaderboard(db, row);
  const snapshotRows = await db
    .prepare(
      `SELECT id, season_id, metrics_json, created_at
       FROM season_snapshots
       WHERE season_id = ?
       ORDER BY created_at DESC
       LIMIT 12`,
    )
    .bind(row.id)
    .all<SnapshotRow>();

  const [playerProgress, draftRow, powerLeaderboard] = await Promise.all([
    readPlayerProgress(db, row, accountId, leaderboard, now),
    includeDraft ? readSpaceRaceDraftRow(db) : Promise.resolve(null),
    readPowerLeaderboard(db, now),
  ]);
  return {
    currentPlayer:
      leaderboard.find((entry) => entry.accountId === accountId) ?? null,
    draft:
      draftRow?.status === "draft" ? publicSeason(draftRow, now) : null,
    leaderboard: leaderboard.slice(0, 25),
    playerProgress,
    powerLeaderboard,
    rewards: spaceRaceRewards,
    season: publicSeason(row, now),
    snapshots: snapshotRows.results.map((snapshot) => {
      return {
        createdAt: snapshot.created_at,
        id: snapshot.id,
        metrics: parseSnapshotMetrics(snapshot.metrics_json),
        seasonId: snapshot.season_id,
      };
    }),
  };
}

function activeSpaceRace(row: SeasonRow | null) {
  if (
    !row ||
    row.status !== "active" ||
    row.campaign_slug !== SPACE_RACE_SLUG
  ) {
    throw new Error("A Corrida Espacial ainda não foi ativada pelo fundador.");
  }
  return row;
}

export async function activateSpaceRaceSeason(
  db: D1Database,
  actorAccountId: string,
  now: number,
) {
  const draft = await ensureSpaceRaceDraft(db, now);
  if (!draft) throw new Error("A prévia da Corrida Espacial não foi encontrada.");
  if (draft.status === "active") {
    return { alreadyActive: true, endsAt: draft.ends_at, id: draft.id };
  }
  if (draft.status !== "draft") {
    throw new Error("Esta temporada já foi encerrada e não pode ser reiniciada.");
  }
  const endsAt = now + SPACE_RACE_DURATION_DAYS * DAY_MS;
  const results = await db.batch([
    db
      .prepare(
        `UPDATE seasons
         SET status = 'closed', closed_at = ?, ends_at = MIN(ends_at, ?)
         WHERE status = 'active' AND id != ?`,
      )
      .bind(now, now, draft.id),
    db
      .prepare(
        `UPDATE seasons
         SET status = 'active', starts_at = ?, ends_at = ?, closed_at = NULL,
             created_by = ?
         WHERE id = ? AND status = 'draft'`,
      )
      .bind(now, endsAt, actorAccountId, draft.id),
  ]);
  if (Number(results[1]?.meta.changes ?? 0) !== 1) {
    throw new Error("A temporada mudou em outra sessão. Atualize o painel.");
  }
  return { alreadyActive: false, endsAt, id: draft.id };
}

export async function registerSeasonDailyLogin(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const season = activeSpaceRace(await ensureDefaultSeason(db, now));
  if (now < season.starts_at || now >= season.ends_at) {
    throw new Error("O ciclo de XP não está aberto.");
  }
  const today = Math.floor(now / DAY_MS);
  const rows = await db
    .prepare(
      `SELECT day_key, xp, created_at
       FROM season_daily_logins
       WHERE season_id = ? AND account_id = ?
       ORDER BY created_at DESC
       LIMIT 14`,
    )
    .bind(season.id, accountId)
    .all<SeasonLoginRow>();
  const byDay = new Map(
    rows.results.map((row) => [Math.floor(Number(row.created_at) / DAY_MS), row]),
  );
  const alreadyClaimed = byDay.get(today);
  if (alreadyClaimed) {
    return { awarded: false, xp: Math.max(0, Number(alreadyClaimed.xp)) };
  }
  let previousStreak = 0;
  let cursor = today - 1;
  while (byDay.has(cursor)) {
    previousStreak += 1;
    cursor -= 1;
  }
  const cycleDay = (previousStreak % SEASON_DAILY_LOGIN_XP.length) + 1;
  const loginXp = SEASON_DAILY_LOGIN_XP[cycleDay - 1];
  const dayKey = `${season.id}:utc:${today}`;
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO season_daily_logins (
        id, season_id, account_id, day_key, xp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      season.id,
      accountId,
      dayKey,
      loginXp,
      now,
    )
    .run();
  return {
    awarded: Number(result.meta.changes ?? 0) === 1,
    cycleDay,
    streakDays: previousStreak + 1,
    xp: loginXp,
  };
}

function parseStoredGameState(row: StoredGameStateRow) {
  const state = JSON.parse(row.state_json) as PublicGameState;
  if (!state || typeof state !== "object" || !Array.isArray(state.minerInventory)) {
    throw new Error("O estado da conta precisa ser sincronizado antes de continuar.");
  }
  return state;
}

export async function purchaseSeasonPremium(
  db: D1Database,
  accountId: string,
  now: number,
  isMax = false,
) {
  const overview = await readSeasonOverview(db, accountId, now);
  if (!overview.season || !overview.playerProgress) {
    throw new Error("Temporada não encontrada.");
  }
  const seasonRow = await readSeasonRow(db);
  const season = activeSpaceRace(seasonRow);

  const [existingPass, existingMax] = await Promise.all([
    db
      .prepare(
        `SELECT premium_unlocked, cma_paid_micros, purchased_at
         FROM season_passes WHERE season_id = ? AND account_id = ?`,
      )
      .bind(season.id, accountId)
      .first<SeasonPassRow>(),
    db
      .prepare(
        `SELECT cma_paid_micros, purchased_at
         FROM season_pass_max WHERE season_id = ? AND account_id = ?`,
      )
      .bind(season.id, accountId)
      .first<SeasonPassMaxRow>(),
  ]);

  if (isMax && existingMax) {
    return {
      alreadyOwned: true,
      maxUnlocked: true,
      priceCma: existingMax.cma_paid_micros / 1_000_000,
      tier: "max" as const,
    };
  }
  if (!isMax && existingPass?.premium_unlocked === 1) {
    return {
      alreadyOwned: true,
      maxUnlocked: Boolean(existingMax),
      priceCma: existingPass.cma_paid_micros / 1_000_000,
      tier: "premium" as const,
    };
  }

  const premiumOwned = existingPass?.premium_unlocked === 1;
  const priceMicros = Math.round(
    (isMax
      ? seasonPremiumMaxPriceCma(overview.playerProgress.level, premiumOwned)
      : season.premium_price_cma_micros / 1_000_000) * 1_000_000,
  );
  const purchaseKind = isMax ? "max" : "premium";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stored = await db
      .prepare("SELECT state_json, version FROM game_states WHERE account_id = ?")
      .bind(accountId)
      .first<StoredGameStateRow>();
    if (!stored) throw new Error("Abra a sala de mineração antes de adquirir a trilha.");
    const state = parseStoredGameState(stored);
    if (Math.round(state.cmaBalance * 1_000_000) < priceMicros) {
      throw new Error("Saldo CMA insuficiente para liberar a trilha premium.");
    }
    state.cmaBalance =
      (Math.round(state.cmaBalance * 1_000_000) - priceMicros) / 1_000_000;
    const stateJson = JSON.stringify(state);
    const nextVersion = stored.version + 1;
    const ledgerId = crypto.randomUUID();
    try {
      const batchOps = [
        db
          .prepare(
            `UPDATE game_states
             SET state_json = ?, version = ?, updated_at = ?
             WHERE account_id = ? AND version = ?
               AND (
                 (? = 1 AND NOT EXISTS (
                   SELECT 1 FROM season_pass_max
                   WHERE season_id = ? AND account_id = ?
                 )) OR (? = 0 AND NOT EXISTS (
                   SELECT 1 FROM season_passes
                   WHERE season_id = ? AND account_id = ? AND premium_unlocked = 1
                 ))
               )`,
          )
          .bind(
            stateJson,
            nextVersion,
            now,
            accountId,
            stored.version,
            isMax ? 1 : 0,
            season.id,
            accountId,
            isMax ? 1 : 0,
            season.id,
            accountId,
          ),
        db
          .prepare(
            `INSERT INTO season_passes (
              season_id, account_id, premium_unlocked, cma_paid_micros,
              purchased_at, updated_at
            )
            SELECT ?, ?, 1, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM game_states
              WHERE account_id = ? AND version = ? AND state_json = ?
            )
            ON CONFLICT (season_id, account_id) DO UPDATE SET 
              premium_unlocked = excluded.premium_unlocked,
              cma_paid_micros = season_passes.cma_paid_micros + excluded.cma_paid_micros,
              updated_at = excluded.updated_at`,
          )
          .bind(
            season.id,
            accountId,
            priceMicros,
            now,
            now,
            accountId,
            nextVersion,
            stateJson,
          ),
        db
          .prepare(
            `INSERT OR IGNORE INTO season_pass_max (
              season_id, account_id, cma_paid_micros, purchased_at, updated_at
            )
            SELECT ?, ?, ?, ?, ?
            WHERE ? = 1 AND EXISTS (
              SELECT 1 FROM game_states
              WHERE account_id = ? AND version = ? AND state_json = ?
            )`,
          )
          .bind(
            season.id,
            accountId,
            priceMicros,
            now,
            now,
            isMax ? 1 : 0,
            accountId,
            nextVersion,
            stateJson,
          ),
        db
          .prepare(
            `INSERT INTO ledger_entries (
              id, account_id, action, idempotency_key, state_version,
              delta_cma_micros, metadata_json, created_at
            )
            SELECT ?, ?, 'season_premium_purchase', ?, ?, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM game_states
              WHERE account_id = ? AND version = ? AND state_json = ?
            )`,
          )
          .bind(
            ledgerId,
            accountId,
            `season-pass:${purchaseKind}:${season.id}:${accountId}:${nextVersion}`,
            nextVersion,
            -priceMicros,
            JSON.stringify({ priceCma: priceMicros / 1_000_000, seasonId: season.id, isMax }),
            now,
            accountId,
            nextVersion,
            stateJson,
          ),
      ];

      const results = await db.batch(batchOps);
      if (Number(results[0]?.meta.changes ?? 0) === 1) {
        return {
          alreadyOwned: false,
          maxUnlocked: isMax,
          priceCma: priceMicros / 1_000_000,
          tier: purchaseKind,
        };
      }
    } catch (error) {
      const owned = isMax
        ? await db
            .prepare(
              `SELECT cma_paid_micros, purchased_at FROM season_pass_max
               WHERE season_id = ? AND account_id = ?`,
            )
            .bind(season.id, accountId)
            .first<SeasonPassMaxRow>()
        : await db
            .prepare(
              `SELECT cma_paid_micros, purchased_at FROM season_passes
               WHERE season_id = ? AND account_id = ? AND premium_unlocked = 1`,
            )
            .bind(season.id, accountId)
            .first<SeasonPassRow>();
      if (owned) {
        return {
          alreadyOwned: true,
          maxUnlocked: isMax,
          priceCma: owned.cma_paid_micros / 1_000_000,
          tier: purchaseKind,
        };
      }
      if (attempt === 2) throw error;
    }
  }
  throw new Error("Outra ação atualizou sua conta. Tente novamente.");
}

function rewardFor(track: SeasonTrack, level: number) {
  return spaceRaceRewards.find(
    (reward) => reward.track === track && reward.level === level,
  );
}

export async function claimSeasonReward(
  db: D1Database,
  accountId: string,
  track: SeasonTrack,
  level: number,
  now: number,
) {
  const season = activeSpaceRace(await ensureDefaultSeason(db, now));
  const reward = rewardFor(track, level);
  if (!reward) throw new Error("Recompensa sazonal inválida.");
  const leaderboard = await readSeasonLeaderboard(db, season);
  const progress = await readPlayerProgress(db, season, accountId, leaderboard, now);
  if (progress.level < reward.level && !(track === "premium" && progress.maxUnlocked)) {
    throw new Error(`Alcance o nível ${reward.level} para resgatar.`);
  }
  if (track === "premium" && !progress.premiumUnlocked) {
    throw new Error("Libere a trilha premium antes de resgatar este prêmio.");
  }
  if (progress.claimedRewardKeys.includes(`${track}:${level}`)) {
    return { alreadyClaimed: true, reward };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stored = await db
      .prepare("SELECT state_json, version FROM game_states WHERE account_id = ?")
      .bind(accountId)
      .first<StoredGameStateRow>();
    if (!stored) throw new Error("Abra a sala de mineração antes de resgatar.");
    const state = parseStoredGameState(stored);
    if (reward.reward.type === "battery") {
      state.batteryCount = Math.min(
        99,
        Math.max(0, Math.floor(state.batteryCount)) + reward.reward.quantity,
      );
    } else if (reward.reward.type === "miner") {
      const miner = getMiner(reward.reward.minerId);
      if (!miner || miner.availability !== "season") {
        throw new Error("O minerador sazonal não está cadastrado.");
      }
      state.minerInventory.push({
        instanceId: `season-${miner.id}-${crypto.randomUUID()}`,
        minerId: miner.id,
      });
    }
    const stateJson = JSON.stringify(state);
    const nextVersion = stored.version + 1;
    const claimId = crypto.randomUUID();
    const batch = [
      db
        .prepare(
          `UPDATE game_states
           SET state_json = ?, version = ?, updated_at = ?
           WHERE account_id = ? AND version = ?
             AND NOT EXISTS (
               SELECT 1 FROM season_reward_claims
               WHERE season_id = ? AND account_id = ? AND track = ? AND level = ?
             )`,
        )
        .bind(
          stateJson,
          nextVersion,
          now,
          accountId,
          stored.version,
          season.id,
          accountId,
          track,
          level,
        ),
      db
        .prepare(
          `INSERT INTO season_reward_claims (
            id, season_id, account_id, level, track, reward_json, status,
            state_version_before, state_version_after, created_at, completed_at
          )
          SELECT ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM game_states
            WHERE account_id = ? AND version = ? AND state_json = ?
          )`,
        )
        .bind(
          claimId,
          season.id,
          accountId,
          level,
          track,
          JSON.stringify(reward.reward),
          stored.version,
          nextVersion,
          now,
          now,
          accountId,
          nextVersion,
          stateJson,
        ),
      db
        .prepare(
          `INSERT INTO ledger_entries (
            id, account_id, action, idempotency_key, state_version,
            delta_cma_micros, metadata_json, created_at
          )
          SELECT ?, ?, 'season_reward_claim', ?, ?, 0, ?, ?
          WHERE EXISTS (SELECT 1 FROM season_reward_claims WHERE id = ?)`,
        )
        .bind(
          crypto.randomUUID(),
          accountId,
          `season-reward:${season.id}:${track}:${level}:${accountId}`,
          nextVersion,
          JSON.stringify({ level, reward: reward.reward, seasonId: season.id, track }),
          now,
          claimId,
        ),
    ];
    if (reward.reward.type === "power") {
      batch.push(
        db
          .prepare(
            `INSERT INTO temporary_power_grants (
              id, account_id, source_session_id, power_gh,
              starts_at, expires_at, created_at
            )
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM season_reward_claims WHERE id = ?)`,
          )
          .bind(
            crypto.randomUUID(),
            accountId,
            `season:${season.id}:${track}:${level}:${accountId}`,
            reward.reward.powerGh,
            now,
            now + reward.reward.days * DAY_MS,
            now,
            claimId,
          ),
      );
    }
    try {
      const results = await db.batch(batch);
      if (
        Number(results[0]?.meta.changes ?? 0) === 1 &&
        Number(results[1]?.meta.changes ?? 0) === 1
      ) {
        return { alreadyClaimed: false, reward };
      }
    } catch (error) {
      const claimed = await db
        .prepare(
          `SELECT 1 AS claimed FROM season_reward_claims
           WHERE season_id = ? AND account_id = ? AND track = ? AND level = ?`,
        )
        .bind(season.id, accountId, track, level)
        .first<{ claimed: number }>();
      if (claimed) return { alreadyClaimed: true, reward };
      if (attempt === 2) throw error;
    }
  }
  throw new Error("Outra ação atualizou sua conta. Tente novamente.");
}

export async function readSeasonEconomicReport(
  db: D1Database,
  now: number,
): Promise<SeasonEconomicReport | null> {
  await ensureSeasonSchema(db);
  const season = await readSeasonRow(db);
  if (!season) return null;
  const until =
    season.status === "active"
      ? Math.min(now, season.ends_at)
      : (season.closed_at ?? season.ends_at);

  const [
    newPlayers,
    sessions,
    ledger,
    blockRewards,
    openReviews,
    snapshotRows,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM game_states
         WHERE created_at >= ? AND created_at <= ?`,
      )
      .bind(season.starts_at, until)
      .first<SeasonCountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS games,
                COUNT(DISTINCT account_id) AS active_operators,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS wins,
                COALESCE(SUM(reward_power_gh), 0) AS power_granted_gh
         FROM game_sessions
         WHERE started_at >= ? AND started_at <= ?
           AND status IN ('completed', 'failed')`,
      )
      .bind(season.starts_at, until)
      .first<SeasonSessionSummaryRow>(),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN action = 'daily_mission_battery' THEN 1 ELSE 0 END), 0) AS battery_claims,
           COALESCE(SUM(CASE WHEN action = 'open_supply_crate' THEN 1 ELSE 0 END), 0) AS crate_opens,
           COALESCE(SUM(CASE WHEN action = 'block_settlement' AND delta_cma_micros > 0 THEN delta_cma_micros ELSE 0 END), 0) AS cma_block_micros,
           COALESCE(SUM(CASE WHEN action = 'admin_test_cma_grant' AND delta_cma_micros > 0 THEN delta_cma_micros ELSE 0 END), 0) AS cma_test_micros,
           COALESCE(SUM(CASE WHEN delta_cma_micros < 0 THEN -delta_cma_micros ELSE 0 END), 0) AS cma_spent_micros
         FROM ledger_entries
         WHERE created_at >= ? AND created_at <= ?`,
      )
      .bind(season.starts_at, until)
      .first<SeasonLedgerSummaryRow>(),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN json_valid(metadata_json) THEN CAST(json_extract(metadata_json, '$.rewards.btc') AS INTEGER) ELSE 0 END), 0) AS btc_atomic,
           COALESCE(SUM(CASE WHEN json_valid(metadata_json) THEN CAST(json_extract(metadata_json, '$.rewards.doge') AS INTEGER) ELSE 0 END), 0) AS doge_atomic,
           COALESCE(SUM(CASE WHEN json_valid(metadata_json) THEN CAST(json_extract(metadata_json, '$.rewards.ltc') AS INTEGER) ELSE 0 END), 0) AS ltc_atomic
         FROM ledger_entries
         WHERE action = 'block_settlement'
           AND created_at >= ? AND created_at <= ?`,
      )
      .bind(season.starts_at, until)
      .first<SeasonBlockRewardRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM game_sessions AS sessions
         LEFT JOIN admin_session_reviews AS reviews
           ON reviews.session_id = sessions.id
         WHERE sessions.started_at >= ? AND sessions.started_at <= ?
           AND sessions.risk_level != 'normal'
           AND reviews.session_id IS NULL`,
      )
      .bind(season.starts_at, until)
      .first<SeasonCountRow>(),
    db
      .prepare(
        `SELECT id, season_id, metrics_json, created_at
         FROM season_snapshots
         WHERE season_id = ?
         ORDER BY created_at ASC
         LIMIT 120`,
      )
      .bind(season.id)
      .all<SnapshotRow>(),
  ]);

  const games = Number(sessions?.games ?? 0);
  const wins = Number(sessions?.wins ?? 0);
  const activeOperators = Number(sessions?.active_operators ?? 0);
  const snapshots = (snapshotRows.results ?? []).map((snapshot) => ({
    createdAt: snapshot.created_at,
    id: snapshot.id,
    metrics: parseSnapshotMetrics(snapshot.metrics_json),
    seasonId: snapshot.season_id,
  }));
  const checks = {
    enoughActivity: games >= Math.max(3, activeOperators * 3),
    enoughPlayers: activeOperators >= 5,
    enoughSnapshots: snapshots.length >= 2,
    reviewQueueClear: Number(openReviews?.total ?? 0) === 0,
    seasonClosed: season.status !== "active",
  };

  return {
    checks,
    metrics: {
      activeOperators,
      batteryClaims: Number(ledger?.battery_claims ?? 0),
      btcCreditedAtomic: Number(blockRewards?.btc_atomic ?? 0),
      cmaBlockCredits: Number(ledger?.cma_block_micros ?? 0) / 1_000_000,
      cmaSpent: Number(ledger?.cma_spent_micros ?? 0) / 1_000_000,
      cmaTestCredits: Number(ledger?.cma_test_micros ?? 0) / 1_000_000,
      crateOpens: Number(ledger?.crate_opens ?? 0),
      dogeCreditedAtomic: Number(blockRewards?.doge_atomic ?? 0),
      ltcCreditedAtomic: Number(blockRewards?.ltc_atomic ?? 0),
      games,
      newPlayers: Number(newPlayers?.total ?? 0),
      openReviews: Number(openReviews?.total ?? 0),
      powerGrantedGh: Number(sessions?.power_granted_gh ?? 0),
      winRate: games > 0 ? Math.round((wins / games) * 100) : 0,
      wins,
    },
    period: { endsAt: until, startsAt: season.starts_at },
    readyForEconomyReview: Object.values(checks).every(Boolean),
    seasonId: season.id,
    snapshotComparison: compareSeasonSnapshots(snapshots),
    status: season.status === "active" ? "active" : "closed",
  };
}

export async function createSeason(
  db: D1Database,
  name: string,
  durationDays: number,
  createdBy: string,
  now: number,
) {
  await ensureSeasonSchema(db);
  const active = await db
    .prepare("SELECT id FROM seasons WHERE status = 'active' LIMIT 1")
    .first<{ id: string }>();
  if (active) throw new Error("Encerre a temporada ativa antes de iniciar outra.");
  const safeName =
    name.trim().replace(/\s+/g, " ").slice(0, 72) ||
    `Temporada ${new Date(now).toLocaleDateString("pt-BR")}`;
  const safeDuration = normalizeSeasonDurationDays(durationDays);
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO seasons (
        id, name, status, campaign_slug, duration_days,
        premium_price_cma_micros, configuration_json,
        starts_at, ends_at, created_by, created_at, closed_at
      ) VALUES (?, ?, 'active', ?, ?, 0, '{}', ?, ?, ?, ?, NULL)`,
    )
    .bind(
      id,
      safeName,
      `custom-${id}`,
      safeDuration,
      now,
      now + safeDuration * DAY_MS,
      createdBy,
      now,
    )
    .run();
  return { durationDays: safeDuration, id, name: safeName };
}

export async function closeActiveSeason(
  db: D1Database,
  actorAccountId: string,
  now: number,
) {
  const active = await db
    .prepare("SELECT id FROM seasons WHERE status = 'active' LIMIT 1")
    .first<{ id: string }>();
  if (!active) throw new Error("Não existe temporada ativa para encerrar.");
  await db
    .prepare(
      `UPDATE seasons
       SET status = 'closed', closed_at = ?, ends_at = MIN(ends_at, ?), created_by = created_by
       WHERE id = ? AND status = 'active'`,
    )
    .bind(now, now, active.id)
    .run();
  return { actorAccountId, id: active.id };
}

export async function createSeasonSnapshot(
  db: D1Database,
  metrics: Record<string, number>,
  createdBy: string,
  now: number,
) {
  const season = await readSeasonRow(db);
  if (!season) throw new Error("Nenhuma temporada disponível para o snapshot.");
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO season_snapshots (
        id, season_id, metrics_json, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, season.id, JSON.stringify(metrics), createdBy, now)
    .run();
  return { id, seasonId: season.id };
}

export async function claimSeasonQuest(
  db: D1Database,
  accountId: string,
  questId: string,
  cycleKey: string,
  now: number,
) {
  const overview = await readSeasonOverview(db, accountId, now);
  if (!overview.season || overview.season.status !== "active") {
    throw new Error("Temporada inativa ou não encontrada.");
  }
  
  const dailyMatch = overview.playerProgress?.quests.daily.find(q => q.quest.id === questId);
  const weeklyMatch = overview.playerProgress?.quests.weekly.find(q => q.quest.id === questId);
  
  const match = dailyMatch ?? weeklyMatch;
  if (!match) {
    throw new Error("Quest não encontrada.");
  }
  if (!match.completed) {
    throw new Error("Você ainda não concluiu esta Quest.");
  }
  if (match.claimed) {
    throw new Error("Recompensa já resgatada.");
  }

  const expectedCycleKey = dailyMatch
    ? `daily_${Math.floor(now / DAY_MS)}`
    : `weekly_${Math.floor(now / (7 * DAY_MS))}`;
    
  if (cycleKey !== expectedCycleKey) {
    throw new Error("O ciclo da Quest expirou.");
  }

  await db
    .prepare(
      `INSERT INTO season_quest_claims (
        id, season_id, account_id, quest_id, cycle_key, xp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), overview.season.id, accountId, questId, cycleKey, match.quest.xp, now)
    .run();
    
  return { xp: match.quest.xp, title: match.quest.title };
}
