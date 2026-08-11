import {
  DEFAULT_SEASON_DURATION_DAYS,
  SEASON_DAILY_GAME_XP_CAP,
  SEASON_DAILY_SPEND_XP_CAP,
  SEASON_GAME_XP,
  SEASON_LOGIN_XP,
  SEASON_SPEND_XP_PER_CMA,
  SPACE_RACE_DURATION_DAYS,
  SPACE_RACE_LEVELS,
  SPACE_RACE_PREMIUM_PRICE_CMA,
  SPACE_RACE_SEASON_ID,
  SPACE_RACE_SLUG,
  calculateSeasonScore,
  compareSeasonSnapshots,
  normalizeSeasonDurationDays,
  seasonLevelForXp,
  seasonProgressPercent,
  seasonXpRequiredForLevel,
  spaceRaceRewards,
  type SeasonReward,
  type SeasonTrack,
} from "./season-rules";
import { getMiner } from "./game-rules";
import type { PublicGameState } from "./game-server";

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

type SeasonClaimRow = {
  level: number;
  track: string;
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
  xp: number;
  level: number;
};

export type SeasonPlayerProgress = {
  claimedRewardKeys: string[];
  level: number;
  nextLevelXp: number;
  premiumUnlocked: boolean;
  sources: {
    games: number;
    logins: number;
    missions: number;
    spending: number;
  };
  xp: number;
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
        "Temporada Alfa · Teste fechado",
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
       WHERE sessions.started_at >= ? AND sessions.started_at <= ?
         AND sessions.status IN ('completed', 'failed')
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

  const [loginRows, gameRows, spendingRows] = await Promise.all([
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

  const weeklyGames = new Map<string, number>();
  for (const row of gameRows.results) {
    const dailyGames = Math.max(0, Number(row.total));
    const progress = ensureXp(row.account_id);
    progress.games += Math.min(
      SEASON_DAILY_GAME_XP_CAP,
      dailyGames * SEASON_GAME_XP,
    );
    if (dailyGames >= 3) progress.missions += 30;
    if (dailyGames >= 5) progress.missions += 40;
    const week = Math.floor(Number(row.activity_key) / 7);
    const key = `${row.account_id}:${week}`;
    weeklyGames.set(key, (weeklyGames.get(key) ?? 0) + dailyGames);
  }
  for (const [key, games] of weeklyGames) {
    const accountId = key.slice(0, key.lastIndexOf(":"));
    const progress = ensureXp(accountId);
    if (games >= 10) progress.missions += 100;
    if (games >= 15) progress.missions += 150;
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
): Promise<SeasonPlayerProgress> {
  const [pass, claims] = await Promise.all([
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
        `SELECT level, track
         FROM season_reward_claims
         WHERE season_id = ? AND account_id = ? AND status = 'completed'`,
      )
      .bind(season.id, accountId)
      .all<SeasonClaimRow>(),
  ]);
  const entry = leaderboard.find((item) => item.accountId === accountId);
  const xp = entry?.xp ?? 0;
  const level = seasonLevelForXp(xp);

  const [login, gameDaily, spendingDaily] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(xp), 0) AS total
         FROM season_daily_logins
         WHERE season_id = ? AND account_id = ?`,
      )
      .bind(season.id, accountId)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT CAST((completed_at - ?) / ? AS INTEGER) AS activity_key,
                COUNT(*) AS total
         FROM game_sessions
         WHERE account_id = ? AND completed_at >= ? AND completed_at <= ?
           AND status = 'completed'
         GROUP BY activity_key`,
      )
      .bind(season.starts_at, DAY_MS, accountId, season.starts_at, season.ends_at)
      .all<DailyActivityRow>(),
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
  ]);
  let games = 0;
  let missions = 0;
  const weekly = new Map<number, number>();
  for (const row of gameDaily.results) {
    const count = Math.max(0, Number(row.total));
    games += Math.min(SEASON_DAILY_GAME_XP_CAP, count * SEASON_GAME_XP);
    if (count >= 3) missions += 30;
    if (count >= 5) missions += 40;
    const week = Math.floor(Number(row.activity_key) / 7);
    weekly.set(week, (weekly.get(week) ?? 0) + count);
  }
  for (const count of weekly.values()) {
    if (count >= 10) missions += 100;
    if (count >= 15) missions += 150;
  }
  const spending = spendingDaily.results.reduce(
    (total, row) =>
      total +
      Math.min(
        SEASON_DAILY_SPEND_XP_CAP,
        Math.floor(Math.max(0, Number(row.total)) / 1_000_000) *
          SEASON_SPEND_XP_PER_CMA,
      ),
    0,
  );
  return {
    claimedRewardKeys: claims.results.map(
      (claim) => `${claim.track}:${claim.level}`,
    ),
    level,
    nextLevelXp:
      level >= SPACE_RACE_LEVELS
        ? seasonXpRequiredForLevel(SPACE_RACE_LEVELS)
        : seasonXpRequiredForLevel(level + 1),
    premiumUnlocked: pass?.premium_unlocked === 1,
    sources: {
      games,
      logins: Number(login?.total ?? 0),
      missions,
      spending,
    },
    xp,
  };
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

  const isSpaceRace = row.campaign_slug === SPACE_RACE_SLUG;
  const [playerProgress, draftRow] = await Promise.all([
    isSpaceRace
      ? readPlayerProgress(db, row, accountId, leaderboard)
      : Promise.resolve(null),
    includeDraft ? readSpaceRaceDraftRow(db) : Promise.resolve(null),
  ]);
  return {
    currentPlayer:
      leaderboard.find((entry) => entry.accountId === accountId) ?? null,
    draft:
      draftRow?.status === "draft" ? publicSeason(draftRow, now) : null,
    leaderboard: leaderboard.slice(0, 25),
    playerProgress,
    rewards: isSpaceRace ? spaceRaceRewards : [],
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
  const dayIndex = Math.floor((now - season.starts_at) / DAY_MS);
  const dayKey = `${season.id}:${dayIndex}`;
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
      SEASON_LOGIN_XP,
      now,
    )
    .run();
  return { awarded: Number(result.meta.changes ?? 0) === 1, xp: SEASON_LOGIN_XP };
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
) {
  const season = activeSpaceRace(await ensureDefaultSeason(db, now));
  const existing = await db
    .prepare(
      `SELECT premium_unlocked, cma_paid_micros, purchased_at
       FROM season_passes WHERE season_id = ? AND account_id = ?`,
    )
    .bind(season.id, accountId)
    .first<SeasonPassRow>();
  if (existing?.premium_unlocked === 1) {
    return { alreadyOwned: true, priceCma: existing.cma_paid_micros / 1_000_000 };
  }
  const priceMicros = season.premium_price_cma_micros;
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
      const results = await db.batch([
        db
          .prepare(
            `UPDATE game_states
             SET state_json = ?, version = ?, updated_at = ?
             WHERE account_id = ? AND version = ?
               AND NOT EXISTS (
                 SELECT 1 FROM season_passes
                 WHERE season_id = ? AND account_id = ? AND premium_unlocked = 1
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
            )`,
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
            `INSERT INTO ledger_entries (
              id, account_id, action, idempotency_key, state_version,
              delta_cma_micros, metadata_json, created_at
            )
            SELECT ?, ?, 'season_premium_purchase', ?, ?, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM season_passes
              WHERE season_id = ? AND account_id = ? AND premium_unlocked = 1
            )`,
          )
          .bind(
            ledgerId,
            accountId,
            `season-premium:${season.id}:${accountId}`,
            nextVersion,
            -priceMicros,
            JSON.stringify({ priceCma: priceMicros / 1_000_000, seasonId: season.id }),
            now,
            season.id,
            accountId,
          ),
      ]);
      if (
        Number(results[0]?.meta.changes ?? 0) === 1 &&
        Number(results[1]?.meta.changes ?? 0) === 1
      ) {
        return { alreadyOwned: false, priceCma: priceMicros / 1_000_000 };
      }
    } catch (error) {
      const pass = await db
        .prepare(
          `SELECT premium_unlocked, cma_paid_micros, purchased_at
           FROM season_passes WHERE season_id = ? AND account_id = ?`,
        )
        .bind(season.id, accountId)
        .first<SeasonPassRow>();
      if (pass?.premium_unlocked === 1) {
        return { alreadyOwned: true, priceCma: pass.cma_paid_micros / 1_000_000 };
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
  const progress = await readPlayerProgress(db, season, accountId, leaderboard);
  if (progress.level < reward.level) {
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
