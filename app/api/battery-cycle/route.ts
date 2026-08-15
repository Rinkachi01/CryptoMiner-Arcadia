import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import type { PublicGameState } from "../../game-server";

export const dynamic = "force-dynamic";

const BATTERY_CYCLE_MS = 12 * 60 * 60 * 1000;
const MAX_BATTERY_INVENTORY = 99;

type StoredRow = {
  account_id: string;
  display_name: string;
  state_json: string;
  version: number;
};

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function ensureSchema(db: D1Database) {
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
      CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_idempotency_unique
      ON ledger_entries (account_id, idempotency_key)
    `),
  ]);
}

async function readState(db: D1Database, accountId: string) {
  return db
    .prepare(
      `SELECT account_id, display_name, state_json, version
       FROM game_states WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<StoredRow>();
}

function batteryCycle(state: PublicGameState, now: number) {
  const lastClaimAt = Math.max(0, Number(state.lastEnergyClaimAt ?? 0));
  const nextClaimAt = lastClaimAt + BATTERY_CYCLE_MS;
  return {
    claimable: now >= nextClaimAt,
    lastClaimAt,
    nextClaimAt,
    remainingMs: Math.max(0, nextClaimAt - now),
  };
}

export async function GET() {
  const user = await getArcadiaUser();
  if (env.DB) await ensureSchema(env.DB);
  if (!user || !env.DB) return json({ error: "Faça login para continuar." }, 401);
  const accountId = await accountIdForUser(user);
  const row = await readState(env.DB, accountId);
  if (!row) return json({ error: "Conta de mineração indisponível." }, 404);
  const state = JSON.parse(row.state_json) as PublicGameState;
  return json({ batteryCycle: batteryCycle(state, Date.now()), batteryCount: state.batteryCount });
}

export async function POST() {
  const user = await getArcadiaUser();
  if (env.DB) await ensureSchema(env.DB);
  if (!user || !env.DB) return json({ error: "Faça login para continuar." }, 401);
  const accountId = await accountIdForUser(user);
  const now = Date.now();
  const row = await readState(env.DB, accountId);
  if (!row) return json({ error: "Abra a sala de mineração antes de resgatar." }, 404);

  const state = JSON.parse(row.state_json) as PublicGameState;
  const cycle = batteryCycle(state, now);
  if (!cycle.claimable) {
    return json(
      {
        error: "A proxima bateria ainda esta no ciclo de 12 horas.",
        batteryCycle: cycle,
        batteryCount: state.batteryCount,
      },
      409,
    );
  }

  const nextState: PublicGameState = {
    ...state,
    batteryCount: Math.min(MAX_BATTERY_INVENTORY, Math.max(0, state.batteryCount) + 1),
    lastEnergyClaimAt: now,
  };
  const nextVersion = row.version + 1;
  const update = await env.DB
    .prepare(
      `UPDATE game_states
       SET state_json = ?, version = ?, display_name = ?, updated_at = ?
       WHERE account_id = ? AND version = ?`,
    )
    .bind(
      JSON.stringify(nextState),
      nextVersion,
      user.displayName,
      now,
      accountId,
      row.version,
    )
    .run();

  if ((update.meta.changes ?? 0) !== 1) {
    return json({ error: "A conta mudou em outra sessão. Atualize e tente novamente." }, 409);
  }

  await env.DB
    .prepare(
      `INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'battery_cycle_claim', ?, ?, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `battery-cycle:${now}:${accountId}`,
      nextVersion,
      JSON.stringify({ cycleHours: 12, quantity: 1 }),
      now,
    )
    .run();

  return json({
    claimed: true,
    batteryCount: nextState.batteryCount,
    batteryCycle: batteryCycle(nextState, now),
    message: "Bateria gratuita adicionada ao inventário.",
  });
}
