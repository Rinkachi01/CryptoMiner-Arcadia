import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import type { PublicGameState } from "../../game-server";
import {
  buildOnboardingStatus,
  type OnboardingLedgerEvent,
} from "../../onboarding-rules";

export const dynamic = "force-dynamic";

type StateRow = {
  state_json: string;
};

type LedgerRow = {
  action: string;
  metadata_json: string;
};

type CountRow = {
  total: number;
};

async function accountIdFor(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseMetadata(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function ensureOnboardingSchema(db: D1Database) {
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
  if (!user) {
    return Response.json(
      { error: "Faça login para ver seu primeiro dia." },
      { status: 401 },
    );
  }
  const db = env.DB;
  if (!db) {
    return Response.json(
      { error: "Guia do operador temporariamente indisponível." },
      { status: 503 },
    );
  }

  await ensureOnboardingSchema(db);
  const accountId = await accountIdFor(user.email);
  const [stateRow, ledgerRows, sessionCount] = await Promise.all([
    db
      .prepare(`SELECT state_json FROM game_states WHERE account_id = ?`)
      .bind(accountId)
      .first<StateRow>(),
    db
      .prepare(
        `SELECT action, metadata_json
         FROM ledger_entries
         WHERE account_id = ?
           AND action IN (
             'starter_kit_granted',
             'install_miner',
             'apply_allocations',
             'block_settlement',
             'claim_energy',
             'use_battery'
           )
         ORDER BY created_at ASC
         LIMIT 500`,
      )
      .bind(accountId)
      .all<LedgerRow>(),
    db
      .prepare(
        `SELECT COUNT(DISTINCT game_id) AS total
         FROM game_sessions
         WHERE account_id = ?
           AND status IN ('completed', 'failed')`,
      )
      .bind(accountId)
      .first<CountRow>(),
  ]);

  if (!stateRow) {
    return Response.json(
      { error: "A conta ainda está sendo preparada." },
      { status: 404 },
    );
  }

  const events: OnboardingLedgerEvent[] = (ledgerRows.results ?? []).map(
    (row) => ({
      action: row.action,
      metadata: parseMetadata(row.metadata_json),
    }),
  );
  const status = buildOnboardingStatus(
    JSON.parse(stateRow.state_json) as PublicGameState,
    events,
    Number(sessionCount?.total ?? 0),
    Date.now(),
  );
  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
