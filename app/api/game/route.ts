import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  applyGameAction,
  createInitialGameState,
  nextBlockAt,
  normalizeBootstrapState,
  settleMiningBlocks,
  type GameActionName,
  type PublicGameState,
} from "../../game-server";

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

async function accountIdFor(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
  return JSON.parse(row.state_json) as PublicGameState;
}

async function createAccount(
  db: D1Database,
  accountId: string,
  email: string,
  displayName: string,
  now: number,
  bootstrapState?: unknown,
) {
  const state =
    bootstrapState === undefined
      ? createInitialGameState(now)
      : normalizeBootstrapState(bootstrapState, now);
  await db
    .prepare(
      `INSERT INTO game_states (
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
  await db
    .prepare(
      `INSERT INTO ledger_entries (
        id, account_id, action, idempotency_key, state_version,
        delta_cma_micros, metadata_json, created_at
      ) VALUES (?, ?, 'account_initialized', ?, 1, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      accountId,
      `bootstrap:${accountId}`,
      JSON.stringify({ importedLocalState: bootstrapState !== undefined }),
      now,
    )
    .run();
  return {
    account_id: accountId,
    email,
    display_name: displayName,
    state_json: JSON.stringify(state),
    version: 1,
    created_at: now,
    updated_at: now,
  } satisfies StoredRow;
}

async function authenticatedContext() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = env.DB;
  if (!db) throw new Error("Banco autoritativo indisponível.");
  await ensureSchema(db);
  return {
    db,
    user,
    accountId: await accountIdFor(user.email),
  };
}

function responsePayload(
  row: StoredRow,
  state: PublicGameState,
  now: number,
  message: string,
) {
  return {
    state,
    version: row.version,
    serverTime: now,
    nextBlockAt: nextBlockAt(now),
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

  const settled = settleMiningBlocks(parseState(row), now);
  if (settled.settledBlocks > 0) {
    const nextVersion = row.version + 1;
    await context.db.batch([
      context.db
        .prepare(
          `UPDATE game_states
           SET state_json = ?, version = ?, display_name = ?, updated_at = ?
           WHERE account_id = ?`,
        )
        .bind(
          JSON.stringify(settled.state),
          nextVersion,
          context.user.displayName,
          now,
          context.accountId,
        ),
      context.db
        .prepare(
          `INSERT INTO ledger_entries (
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
          }),
          now,
        ),
    ]);
    row = {
      ...row,
      state_json: JSON.stringify(settled.state),
      version: nextVersion,
      updated_at: now,
    };
  }

  return json(
    responsePayload(
      row,
      settled.state,
      now,
      settled.settledBlocks > 0
        ? `${settled.settledBlocks} bloco(s) processado(s).`
        : "Conta sincronizada.",
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
      body.action === "bootstrap" ? body.bootstrapState : undefined,
    );
  }

  if (body.action === "bootstrap") {
    return json(
      responsePayload(
        row,
        parseState(row),
        now,
        "Conta autoritativa pronta.",
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
        ),
        error: "Versão desatualizada. O estado mais recente foi restaurado.",
      },
      409,
    );
  }

  let result;
  try {
    result = applyGameAction(
      parseState(row),
      body.action as GameActionName,
      body.payload,
      now,
    );
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Não foi possível concluir.",
        ...responsePayload(row, parseState(row), now, "Ação recusada."),
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
  return json(responsePayload(updatedRow, result.state, now, result.message));
}
