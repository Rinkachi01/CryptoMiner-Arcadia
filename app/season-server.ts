import {
  DEFAULT_SEASON_DURATION_DAYS,
  calculateSeasonScore,
  compareSeasonSnapshots,
  normalizeSeasonDurationDays,
  seasonProgressPercent,
} from "./season-rules";

const DAY_MS = 24 * 60 * 60 * 1000;

type SeasonRow = {
  closed_at: number | null;
  created_at: number;
  created_by: string;
  ends_at: number;
  id: string;
  name: string;
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
  closedAt: number | null;
  createdAt: number;
  endsAt: number;
  id: string;
  name: string;
  progressPercent: number;
  startsAt: number;
  status: "active" | "closed";
};

export type SeasonLeaderboardEntry = {
  accountId: string;
  displayName: string;
  highestDifficulty: number;
  plays: number;
  rank: number;
  score: number;
  wins: number;
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
  ]);
}

function publicSeason(row: SeasonRow, now: number): PublicSeason {
  return {
    closedAt: row.closed_at,
    createdAt: row.created_at,
    endsAt: row.ends_at,
    id: row.id,
    name: row.name,
    progressPercent: seasonProgressPercent(row.starts_at, row.ends_at, now),
    startsAt: row.starts_at,
    status: row.status === "active" ? "active" : "closed",
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
      `SELECT id, name, status, starts_at, ends_at, created_by, created_at, closed_at
       FROM seasons
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 1`,
    )
    .first<SeasonRow>();
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
          id, name, status, starts_at, ends_at, created_by, created_at, closed_at
        ) VALUES (?, ?, 'active', ?, ?, 'system', ?, NULL)`,
      )
      .bind(
        "season-alpha-default",
        "Temporada Alfa · Teste fechado",
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

  return rows.results
    .map((row) => ({
      accountId: row.account_id,
      displayName: row.display_name ?? "Operador Arcadia",
      highestDifficulty: Number(row.highest_difficulty),
      plays: Number(row.plays),
      score: calculateSeasonScore({
        highestDifficulty: Number(row.highest_difficulty),
        plays: Number(row.plays),
        wins: Number(row.wins),
      }),
      wins: Number(row.wins),
    }))
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.wins - first.wins ||
        first.displayName.localeCompare(second.displayName, "pt-BR"),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function readSeasonOverview(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const row = await ensureDefaultSeason(db, now);
  if (!row) {
    return {
      currentPlayer: null,
      leaderboard: [] as SeasonLeaderboardEntry[],
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

  return {
    currentPlayer:
      leaderboard.find((entry) => entry.accountId === accountId) ?? null,
    leaderboard: leaderboard.slice(0, 25),
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
        id, name, status, starts_at, ends_at, created_by, created_at, closed_at
      ) VALUES (?, ?, 'active', ?, ?, ?, ?, NULL)`,
    )
    .bind(
      id,
      safeName,
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
