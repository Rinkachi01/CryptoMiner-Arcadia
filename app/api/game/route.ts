import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import { readAdminRuntimeSettings } from "../../admin-settings";
import { BLOCK_INTERVAL_SECONDS } from "../../game-rules";
import {
  applyGameAction,
  applySupplyCratePurchase,
  createInitialGameState,
  nextBlockAt,
  settleMiningBlocks,
  type GameActionName,
  type PublicGameState,
} from "../../game-server";
import { getSupplyCrate } from "../../supply-crate-rules";
import {
  readNetworkPowerSnapshot,
  syncAccountNetworkPower,
  type NetworkPowerSnapshot,
} from "../../network-server";
import { STARTER_KIT_VERSION } from "../../onboarding-rules";
import {
  ensurePlayerWalletAccount,
  ensureWalletSchema,
  walletProviderReadiness,
} from "../../wallet-server";

export const dynamic = "force-dynamic";

type StoredRow = {
  account_id: string;
  email: string;
  display_name: string;
  state_json: string;
  version: number;
  created_at: number;
  updated_at: number;
};

function json(
  value: unknown,
  status = 200,
) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
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
      CREATE UNIQUE INDEX IF NOT EXISTS game_states_email_unique
      ON game_states (email)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS game_states_updated_at_idx
      ON game_states (updated_at)
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
    db.prepare(`
      CREATE INDEX IF NOT EXISTS ledger_entries_account_created_idx
      ON ledger_entries (account_id, created_at)
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
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_nonce_unique
      ON game_sessions (nonce)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS game_sessions_account_started_idx
      ON game_sessions (account_id, started_at)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS game_sessions_review_idx
      ON game_sessions (risk_level, started_at)
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
    db.prepare(`
      CREATE INDEX IF NOT EXISTS game_progress_next_play_idx
      ON game_progress (game_id, next_play_at)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS temporary_power_grants (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        source_session_id TEXT NOT NULL,
        power_gh INTEGER NOT NULL,
        starts_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS temporary_power_source_unique
      ON temporary_power_grants (source_session_id)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS temporary_power_account_expiry_idx
      ON temporary_power_grants (account_id, expires_at)
    `),
  ]);
}

async function readState(db: D1Database, accountId: string) {
  return db
    .prepare(
      `SELECT account_id, email, display_name, state_json, version,
              created_at, updated_at
       FROM game_states
       WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<StoredRow>();
}

function parseState(row: StoredRow): PublicGameState {
  const parsed = JSON.parse(row.state_json) as Record<string, unknown>;
  // Estados antigos podiam guardar uma distribuição separada para os jogos.
  // Ela é descartada na leitura: a única distribuição autoritativa é a das Pools.
  if (parsed && typeof parsed === "object" && "gamePoolAllocations" in parsed) {
    delete parsed.gamePoolAllocations;
  }
  return parsed as PublicGameState;
}

function secureRandomUnit() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 4_294_967_296;
}

async function activeTemporaryPower(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(power_gh), 0) AS total
       FROM temporary_power_grants
       WHERE account_id = ? AND starts_at <= ? AND expires_at > ?`,
    )
    .bind(accountId, now, now)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function activeTemporaryPowerSummary(
  db: D1Database,
  accountId: string,
  now: number,
) {
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(power_gh), 0) AS total,
         COUNT(*) AS active_grants,
         COALESCE(MIN(expires_at), 0) AS next_expiry
       FROM temporary_power_grants
       WHERE account_id = ? AND starts_at <= ? AND expires_at > ?`,
    )
    .bind(accountId, now, now)
    .first<{
      total: number;
      active_grants: number;
      next_expiry: number;
    }>();
  return {
    totalGh: Math.max(0, Number(row?.total ?? 0)),
    activeGrantCount: Math.max(0, Number(row?.active_grants ?? 0)),
    nextExpiryAt: Math.max(0, Number(row?.next_expiry ?? 0)),
  };
}

async function settlementTemporaryPower(
  db: D1Database,
  accountId: string,
  state: PublicGameState,
  now: number,
) {
  const firstUnsettledBlockAt =
    (state.lastSettledBlock + 1) * BLOCK_INTERVAL_SECONDS * 1000;
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(power_gh), 0) AS total
       FROM temporary_power_grants
       WHERE account_id = ? AND starts_at <= ? AND expires_at > ?`,
    )
    .bind(accountId, firstUnsettledBlockAt, now)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function createAccount(
  db: D1Database,
  accountId: string,
  email: string,
  displayName: string,
  now: number,
) {
  await ensureWalletSchema(db);
  const state = createInitialGameState(now);
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_states (
        account_id, email, display_name, state_json, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      accountId,
      email,
      displayName,
      JSON.stringify(state),
      now,
      now,
    )
    .run();
  await ensurePlayerWalletAccount(
    db,
    accountId,
    walletProviderReadiness(env).depositsEnabled,
    now,
  );
  await db
    .prepare(
      `INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'account_initialized', ?, 1, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `bootstrap:${accountId}`,
      JSON.stringify({
        importedLocalState: false,
        starterKitVersion: STARTER_KIT_VERSION,
      }),
      now,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'starter_kit_granted', ?, 1, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `starter-kit:${STARTER_KIT_VERSION}:${accountId}`,
      JSON.stringify({
        version: STARTER_KIT_VERSION,
        rack: { id: "rack-01", roomId: "room-1", positionIndex: 0 },
        miner: { minerId: "byte-spark", quantity: 1, installed: false },
      }),
      now,
    )
    .run();
  const persisted = await readState(db, accountId);
  if (!persisted) throw new Error("Não foi possível criar a conta.");
  await syncAccountNetworkPower(db, accountId, state, now);
  return persisted;
}

async function authenticatedContext() {
  const user = await getArcadiaUser();
  if (!user) return null;
  const db = env.DB;
  if (!db) throw new Error("Banco autoritativo indisponível.");
  await ensureSchema(db);
  return {
    db,
    user,
    accountId: await accountIdForUser(user),
  };
}

function responsePayload(
  row: StoredRow,
  state: PublicGameState,
  now: number,
  message: string,
  temporaryPowerGh = 0,
  temporaryPowerSummary = {
    totalGh: Math.max(0, temporaryPowerGh),
    activeGrantCount: 0,
    nextExpiryAt: 0,
  },
  network?: NetworkPowerSnapshot,
) {
  return {
    state,
    version: row.version,
    serverTime: now,
    nextBlockAt: nextBlockAt(now),
    temporaryPowerGh,
    temporaryPowerSummary,
    network,
    message,
    account: {
      displayName: row.display_name,
      email: row.email,
    },
  };
}

export async function GET() {
  const context = await authenticatedContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  const now = Date.now();
  let row = await readState(context.db, context.accountId);
  if (!row) {
    row = await createAccount(
      context.db,
      context.accountId,
      context.user.email,
      context.user.displayName,
      now,
    );
  }

  const temporaryPowerGh = await activeTemporaryPower(
    context.db,
    context.accountId,
    now,
  );
  const temporaryPowerSummary = await activeTemporaryPowerSummary(
    context.db,
    context.accountId,
    now,
  );
  const state = parseState(row);
  await syncAccountNetworkPower(
    context.db,
    context.accountId,
    state,
    now,
  );
  const network = await readNetworkPowerSnapshot(context.db, now);
  const eligibleTemporaryPowerGh = await settlementTemporaryPower(
    context.db,
    context.accountId,
    state,
    now,
  );
  const settled = settleMiningBlocks(
    state,
    now,
    eligibleTemporaryPowerGh,
    network.playerPowerGh,
    network.blockRewardAtomic,
  );
  let responseState = settled.state;
  let settledBlockCount = settled.settledBlocks;
  if (settled.settledBlocks > 0) {
    const nextVersion = row.version + 1;
    const updateResult = await context.db
      .prepare(
        `UPDATE game_states
         SET state_json = ?, version = ?, display_name = ?, updated_at = ?
         WHERE account_id = ? AND version = ?`,
      )
      .bind(
        JSON.stringify(settled.state),
        nextVersion,
        context.user.displayName,
        now,
        context.accountId,
        row.version,
      )
      .run();

    if ((updateResult.meta.changes ?? 0) === 1) {
      await context.db
        .prepare(
          `INSERT OR IGNORE INTO ledger_entries (
            id, account_id, action, idempotency_key, state_version,
            delta_cma_micros, metadata_json, created_at
          ) VALUES (?, ?, 'block_settlement', ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.accountId,
          `blocks:${settled.state.lastSettledBlock}`,
          nextVersion,
          settled.rewards.cma,
          JSON.stringify({
            settledBlocks: settled.settledBlocks,
            rewards: settled.rewards,
            blockRewardAtomic: network.blockRewardAtomic,
            bonusBps: network.bonusBps,
            networkPowerGh: network.playerPowerGh,
          }),
          now,
        )
        .run();
      row = {
        ...row,
        state_json: JSON.stringify(settled.state),
        version: nextVersion,
        updated_at: now,
      };
    } else {
      const latest = await readState(context.db, context.accountId);
      if (latest) {
        row = latest;
        responseState = parseState(latest);
        settledBlockCount = 0;
      }
    }
  }

  return json(
    responsePayload(
      row,
      responseState,
      now,
      settledBlockCount > 0
        ? `${settledBlockCount} bloco(s) processado(s).`
      : "Conta sincronizada.",
      temporaryPowerGh,
      temporaryPowerSummary,
      network,
    ),
  );
}

export async function POST(request: Request) {
  const context = await authenticatedContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);

  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        payload?: unknown;
        expectedVersion?: unknown;
        idempotencyKey?: unknown;
        bootstrapState?: unknown;
      }
    | null;
  if (!body || typeof body.action !== "string") {
    return json({ error: "Ação inválida." }, 400);
  }

  const now = Date.now();
  let row = await readState(context.db, context.accountId);
  if (!row) {
    row = await createAccount(
      context.db,
      context.accountId,
      context.user.email,
      context.user.displayName,
      now,
    );
  }
  const temporaryPowerGh = await activeTemporaryPower(
    context.db,
    context.accountId,
    now,
  );
  const temporaryPowerSummary = await activeTemporaryPowerSummary(
    context.db,
    context.accountId,
    now,
  );
  const eligibleTemporaryPowerGh = await settlementTemporaryPower(
    context.db,
    context.accountId,
    parseState(row),
    now,
  );
  await syncAccountNetworkPower(
    context.db,
    context.accountId,
    parseState(row),
    now,
  );
  let network = await readNetworkPowerSnapshot(context.db, now);

  if (body.action === "bootstrap") {
    return json(
      responsePayload(
        row,
        parseState(row),
        now,
        "Conta autoritativa pronta.",
        temporaryPowerGh,
        temporaryPowerSummary,
        network,
      ),
    );
  }

  if (
    typeof body.idempotencyKey !== "string" ||
    body.idempotencyKey.length < 8 ||
    body.idempotencyKey.length > 100
  ) {
    return json({ error: "Identificador da ação inválido." }, 400);
  }

  const priorAction = await context.db
    .prepare(
      `SELECT id FROM ledger_entries
       WHERE account_id = ? AND idempotency_key = ?`,
    )
    .bind(context.accountId, body.idempotencyKey)
    .first<{ id: string }>();
  if (priorAction) {
    const latest = (await readState(context.db, context.accountId)) ?? row;
    return json(
      responsePayload(
        latest,
        parseState(latest),
        now,
        "Ação já processada anteriormente.",
        temporaryPowerGh,
        temporaryPowerSummary,
        network,
      ),
    );
  }

  if (
    typeof body.expectedVersion !== "number" ||
    body.expectedVersion !== row.version
  ) {
    return json(
      {
        ...responsePayload(
          row,
          parseState(row),
          now,
          "Seu estado foi atualizado em outra sessão.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
        error: "Versão desatualizada. O estado mais recente foi restaurado.",
      },
      409,
    );
  }

  let result;
  try {
    const crateId =
      body.action === "open_supply_crate" &&
      body.payload &&
      typeof body.payload === "object"
        ? (body.payload as Record<string, unknown>).crateId
        : undefined;
    const crate = getSupplyCrate(crateId);
    if (body.action === "open_supply_crate") {
      const settings = await readAdminRuntimeSettings(context.db);
      if (!settings.cratesEnabled) {
        throw new Error(
          "As Caixas Arcadia estão pausadas temporariamente pelo operador.",
        );
      }
    }
    result =
      body.action === "open_supply_crate" && crate
        ? applySupplyCratePurchase(
            parseState(row),
            crate.id,
            secureRandomUnit(),
            now,
            eligibleTemporaryPowerGh,
            network.playerPowerGh,
            network.blockRewardAtomic,
          )
        : applyGameAction(
            parseState(row),
            body.action as GameActionName,
            body.payload,
            now,
            eligibleTemporaryPowerGh,
            network.playerPowerGh,
            network.blockRewardAtomic,
          );
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Não foi possível concluir.",
        ...responsePayload(
          row,
          parseState(row),
          now,
          "Ação recusada.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
      },
      400,
    );
  }

  const nextVersion = row.version + 1;
  const updateResult = await context.db
    .prepare(
      `UPDATE game_states
       SET state_json = ?, version = ?, display_name = ?, updated_at = ?
       WHERE account_id = ? AND version = ?`,
    )
    .bind(
      JSON.stringify(result.state),
      nextVersion,
      context.user.displayName,
      now,
      context.accountId,
      row.version,
    )
    .run();

  if ((updateResult.meta.changes ?? 0) !== 1) {
    const latest = (await readState(context.db, context.accountId)) ?? row;
    return json(
      {
        ...responsePayload(
          latest,
          parseState(latest),
          now,
          "Outra sessão concluiu uma ação primeiro.",
          temporaryPowerGh,
          temporaryPowerSummary,
          network,
        ),
        error: "Estado atualizado em outra sessão. Tente novamente.",
      },
      409,
    );
  }

  await context.db
    .prepare(
      `INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      context.accountId,
      body.action,
      body.idempotencyKey,
      nextVersion,
      result.deltaCmaMicros,
      JSON.stringify(result.metadata),
      now,
    )
    .run();

  const updatedRow: StoredRow = {
    ...row,
    display_name: context.user.displayName,
    state_json: JSON.stringify(result.state),
    version: nextVersion,
    updated_at: now,
  };
  await syncAccountNetworkPower(
    context.db,
    context.accountId,
    result.state,
    now,
  );
  network = await readNetworkPowerSnapshot(context.db, now);
  return json({
    ...responsePayload(
      updatedRow,
      result.state,
      now,
      result.message,
      temporaryPowerGh,
      temporaryPowerSummary,
      network,
    ),
    actionResult: result.metadata,
  });
}
