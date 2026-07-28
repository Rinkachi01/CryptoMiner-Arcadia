import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { calculateOperatorProgress } from "../../../operator-progress-rules";

export const dynamic = "force-dynamic";

const gameIds = ["packet-catch", "hash-match", "circuit-rush"] as const;

type ProgressRow = {
  game_id: string;
  level: number;
  win_streak: number;
  next_play_at: number;
  total_plays: number;
  total_wins: number;
};

type TodayRow = {
  game_id: string;
  plays_today: number;
  wins_today: number;
  power_today: number;
};

async function accountIdFor(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        nonce TEXT NOT NULL,
        seed TEXT NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        started_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        score INTEGER,
        reward_power_gh INTEGER DEFAULT 0 NOT NULL,
        risk_level TEXT DEFAULT 'normal' NOT NULL,
        review_reason TEXT,
        proof_json TEXT DEFAULT '{}' NOT NULL,
        difficulty INTEGER DEFAULT 1 NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS game_progress (
        account_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        level INTEGER DEFAULT 1 NOT NULL,
        win_streak INTEGER DEFAULT 0 NOT NULL,
        next_play_at INTEGER DEFAULT 0 NOT NULL,
        total_plays INTEGER DEFAULT 0 NOT NULL,
        total_wins INTEGER DEFAULT 0 NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS game_progress_account_game_unique
      ON game_progress (account_id, game_id)
    `),
  ]);
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Faça login para continuar." }, 401);
  const db = env.DB;
  if (!db) return json({ error: "Telemetria indisponível." }, 503);

  const now = Date.now();
  const accountId = await accountIdFor(user.email);
  await ensureSchema(db);
  await db.batch(
    gameIds.map((gameId) =>
      db.prepare(
        `INSERT OR IGNORE INTO game_progress (
          account_id, game_id, level, win_streak, next_play_at,
          total_plays, total_wins, updated_at
        ) VALUES (?, ?, 1, 0, 0, 0, 0, ?)`,
      ).bind(accountId, gameId, now),
    ),
  );

  const [progressResult, todayResult, flaggedRow] = await Promise.all([
    db.prepare(
      `SELECT game_id, level, win_streak, next_play_at,
              total_plays, total_wins
       FROM game_progress
       WHERE account_id = ?
       ORDER BY game_id`,
    )
      .bind(accountId)
      .all<ProgressRow>(),
    db.prepare(
      `SELECT game_id,
              COUNT(*) AS plays_today,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS wins_today,
              COALESCE(SUM(CASE WHEN status = 'completed'
                THEN reward_power_gh ELSE 0 END), 0) AS power_today
       FROM game_sessions
       WHERE account_id = ? AND started_at >= ?
       GROUP BY game_id`,
    )
      .bind(accountId, now - 24 * 60 * 60 * 1000)
      .all<TodayRow>(),
    db.prepare(
      `SELECT COUNT(*) AS total
       FROM game_sessions
       WHERE account_id = ? AND risk_level != 'normal'`,
    )
      .bind(accountId)
      .first<{ total: number }>(),
  ]);

  const progressRows = progressResult.results ?? [];
  const todayRows = new Map(
    (todayResult.results ?? []).map((row) => [row.game_id, row]),
  );
  const totalPlays = progressRows.reduce(
    (sum, row) => sum + Number(row.total_plays),
    0,
  );
  const totalWins = progressRows.reduce(
    (sum, row) => sum + Number(row.total_wins),
    0,
  );
  const playsToday = [...todayRows.values()].reduce(
    (sum, row) => sum + Number(row.plays_today),
    0,
  );
  const winsToday = [...todayRows.values()].reduce(
    (sum, row) => sum + Number(row.wins_today),
    0,
  );
  const powerToday = [...todayRows.values()].reduce(
    (sum, row) => sum + Number(row.power_today),
    0,
  );
  const gamesPlayedToday = gameIds.filter(
    (gameId) => Number(todayRows.get(gameId)?.plays_today ?? 0) > 0,
  ).length;

  return json({
    serverTime: now,
    operator: calculateOperatorProgress(totalPlays, totalWins),
    totals: {
      totalPlays,
      totalWins,
      playsToday,
      winsToday,
      powerToday,
      flaggedSessions: Number(flaggedRow?.total ?? 0),
    },
    games: gameIds.map((gameId) => {
      const progress = progressRows.find((row) => row.game_id === gameId);
      const today = todayRows.get(gameId);
      const plays = Number(progress?.total_plays ?? 0);
      const wins = Number(progress?.total_wins ?? 0);
      return {
        id: gameId,
        level: Number(progress?.level ?? 1),
        winStreak: Number(progress?.win_streak ?? 0),
        nextPlayAt: Number(progress?.next_play_at ?? 0),
        totalPlays: plays,
        totalWins: wins,
        winRate: plays > 0 ? Math.round((wins / plays) * 100) : 0,
        playsToday: Number(today?.plays_today ?? 0),
        winsToday: Number(today?.wins_today ?? 0),
      };
    }),
    missions: [
      {
        id: "play-three",
        label: "Jogue 3 partidas",
        current: Math.min(3, playsToday),
        target: 3,
      },
      {
        id: "win-two",
        label: "Vença 2 partidas",
        current: Math.min(2, winsToday),
        target: 2,
      },
      {
        id: "arcade-tour",
        label: "Jogue os 3 minigames",
        current: gamesPlayedToday,
        target: 3,
      },
    ],
  });
}
