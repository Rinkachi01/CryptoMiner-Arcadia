import { env } from "cloudflare:workers";
import {
  presentGameSession,
  presentLedgerActivity,
} from "../../activity-rules";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

type StateRow = {
  created_at: number;
  updated_at: number;
};

type LedgerRow = {
  id: string;
  action: string;
  delta_cma_micros: number;
  metadata_json: string;
  created_at: number;
};

type LedgerSummaryRow = {
  total: number;
  cma_earned_micros: number;
  cma_spent_micros: number;
  mining_records: number;
  crates_opened: number;
};

type SessionRow = {
  id: string;
  game_id: string;
  status: string;
  completed_at: number;
  score: number | null;
  reward_power_gh: number;
  risk_level: string;
  difficulty: number;
};

type SessionSummaryRow = {
  total: number;
  wins: number;
  reward_power_gh: number;
  reviews: number;
};

const PERIOD_DAYS = 30;
const MAX_SOURCE_ROWS = 60;
const MAX_TIMELINE_ROWS = 80;
const walletDecimals = {
  CMA: 1_000_000,
  BTC: 100_000_000,
  DOGE: 100_000_000,
} as const;

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

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function walletRewards(metadata: Record<string, unknown>) {
  const rewards =
    metadata.rewards && typeof metadata.rewards === "object"
      ? (metadata.rewards as Record<string, unknown>)
      : {};
  return [
    {
      symbol: "CMA" as const,
      amount: Number(rewards.cma ?? 0) / walletDecimals.CMA,
    },
    {
      symbol: "BTC" as const,
      amount: Number(rewards.btc ?? 0) / walletDecimals.BTC,
    },
    {
      symbol: "DOGE" as const,
      amount: Number(rewards.doge ?? 0) / walletDecimals.DOGE,
    },
  ].filter((reward) => Number.isFinite(reward.amount) && reward.amount > 0);
}

async function ensureReadableHistory(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS game_states (
        account_id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        state_json TEXT NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        action TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        state_version INTEGER NOT NULL,
        delta_cma_micros INTEGER DEFAULT 0 NOT NULL,
        metadata_json TEXT DEFAULT '{}' NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
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
  ]);
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Faça login para ver seu histórico." }, 401);
  const db = env.DB;
  if (!db) {
    return json({ error: "Histórico temporariamente indisponível." }, 503);
  }

  const now = Date.now();
  const since = now - PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const accountId = await accountIdFor(user.email);
  await ensureReadableHistory(db);

  const [
    state,
    ledgerRows,
    ledgerSummary,
    sessionRows,
    sessionSummary,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT created_at, updated_at
         FROM game_states
         WHERE account_id = ?`,
      )
      .bind(accountId)
      .first<StateRow>(),
    db
      .prepare(
        `SELECT id, action, delta_cma_micros, metadata_json, created_at
         FROM ledger_entries
         WHERE account_id = ? AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(accountId, since, MAX_SOURCE_ROWS)
      .all<LedgerRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN delta_cma_micros > 0
                  THEN delta_cma_micros ELSE 0 END), 0) AS cma_earned_micros,
                COALESCE(SUM(CASE WHEN delta_cma_micros < 0
                  THEN -delta_cma_micros ELSE 0 END), 0) AS cma_spent_micros,
                SUM(CASE WHEN action = 'block_settlement'
                  THEN 1 ELSE 0 END) AS mining_records,
                SUM(CASE WHEN action = 'open_supply_crate'
                  THEN 1 ELSE 0 END) AS crates_opened
         FROM ledger_entries
         WHERE account_id = ? AND created_at >= ?`,
      )
      .bind(accountId, since)
      .first<LedgerSummaryRow>(),
    db
      .prepare(
        `SELECT id, game_id, status, completed_at, score, reward_power_gh,
                risk_level, difficulty
         FROM game_sessions
         WHERE account_id = ?
           AND completed_at >= ?
           AND completed_at IS NOT NULL
           AND status IN ('completed', 'failed')
         ORDER BY completed_at DESC
         LIMIT ?`,
      )
      .bind(accountId, since, MAX_SOURCE_ROWS)
      .all<SessionRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS wins,
                COALESCE(SUM(CASE WHEN status = 'completed'
                  THEN reward_power_gh ELSE 0 END), 0) AS reward_power_gh,
                SUM(CASE WHEN risk_level != 'normal' THEN 1 ELSE 0 END) AS reviews
         FROM game_sessions
         WHERE account_id = ?
           AND completed_at >= ?
           AND status IN ('completed', 'failed')`,
      )
      .bind(accountId, since)
      .first<SessionSummaryRow>(),
  ]);

  const ledgerTimeline = (ledgerRows.results ?? []).map((row) => {
    const metadata = parseJsonObject(row.metadata_json);
    const presentation = presentLedgerActivity(
      row.action,
      metadata,
    );
    return {
      id: `ledger:${row.id}`,
      source: "ledger" as const,
      status: "verified" as const,
      createdAt: Number(row.created_at),
      cmaDelta: Number(row.delta_cma_micros) / 1_000_000,
      powerGh: 0,
      walletRewards: walletRewards(metadata),
      ...presentation,
    };
  });
  const sessionTimeline = (sessionRows.results ?? []).map((row) => {
    const presentation = presentGameSession(
      row.game_id,
      row.status,
      Number(row.score ?? 0),
      Number(row.difficulty),
    );
    return {
      id: `session:${row.id}`,
      source: "arcade" as const,
      status:
        row.risk_level === "normal"
          ? ("verified" as const)
          : ("review" as const),
      createdAt: Number(row.completed_at),
      cmaDelta: 0,
      powerGh:
        row.status === "completed" ? Number(row.reward_power_gh) : 0,
      walletRewards: [],
      ...presentation,
    };
  });
  const timeline = [...ledgerTimeline, ...sessionTimeline]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_TIMELINE_ROWS);

  return json({
    periodDays: PERIOD_DAYS,
    retention: {
      visibleDays: PERIOD_DAYS,
      maxTimelineRows: MAX_TIMELINE_ROWS,
      economicLedger: "all_time",
    },
    generatedAt: now,
    account: {
      createdAt: Number(state?.created_at ?? now),
      lastSavedAt: Number(state?.updated_at ?? now),
    },
    summary: {
      verifiedRecords:
        Number(ledgerSummary?.total ?? 0) +
        Number(sessionSummary?.total ?? 0) -
        Number(sessionSummary?.reviews ?? 0),
      cmaEarned: Number(ledgerSummary?.cma_earned_micros ?? 0) / 1_000_000,
      cmaSpent: Number(ledgerSummary?.cma_spent_micros ?? 0) / 1_000_000,
      miningRecords: Number(ledgerSummary?.mining_records ?? 0),
      cratesOpened: Number(ledgerSummary?.crates_opened ?? 0),
      gamesPlayed: Number(sessionSummary?.total ?? 0),
      gamesWon: Number(sessionSummary?.wins ?? 0),
      temporaryPowerGh: Number(sessionSummary?.reward_power_gh ?? 0),
      reviews: Number(sessionSummary?.reviews ?? 0),
    },
    timeline,
    integrityNotice:
      "Este histórico é lido diretamente do ledger e das sessões validadas pelo servidor.",
  });
}
