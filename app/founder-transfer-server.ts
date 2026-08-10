import type { PublicGameState } from "./game-server.ts";
import { syncAccountNetworkPower } from "./network-server.ts";

const BLOCK_INTERVAL_MS = 10 * 60 * 1000;
const MAX_TRANSFER_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSFER_BYTES = 2 * 1024 * 1024;
const COMPRESSED_TRANSFER_PREFIX = "arcadia-transfer-gzip-v1:";

type TransferStateRow = {
  created_at: number;
  state_json: string;
  updated_at: number;
  version: number;
};

type DestinationStateRow = TransferStateRow & {
  display_name: string;
  email: string;
};

type TransferTable = {
  columns: readonly string[];
  limit: number;
  name: string;
};

type TransferPayload = {
  accountId: string;
  exportedAt: number;
  format: "arcadia-founder-transfer";
  sourceState: TransferStateRow;
  tables: Record<string, Array<Record<string, unknown>>>;
  transferId: string;
  version: 1;
};

export type FounderTransferEnvelope = {
  payload: TransferPayload;
  signature: string;
};

const TRANSFER_TABLES: readonly TransferTable[] = [
  {
    name: "ledger_entries",
    limit: 10_000,
    columns: [
      "id",
      "account_id",
      "action",
      "idempotency_key",
      "state_version",
      "delta_cma_micros",
      "metadata_json",
      "created_at",
    ],
  },
  {
    name: "game_sessions",
    limit: 5_000,
    columns: [
      "id",
      "account_id",
      "game_id",
      "nonce",
      "seed",
      "status",
      "started_at",
      "expires_at",
      "completed_at",
      "duration_ms",
      "score",
      "reward_power_gh",
      "risk_level",
      "review_reason",
      "proof_json",
      "difficulty",
    ],
  },
  {
    name: "game_progress",
    limit: 20,
    columns: [
      "account_id",
      "game_id",
      "level",
      "win_streak",
      "next_play_at",
      "total_plays",
      "total_wins",
      "updated_at",
    ],
  },
  {
    name: "temporary_power_grants",
    limit: 5_000,
    columns: [
      "id",
      "account_id",
      "source_session_id",
      "power_gh",
      "starts_at",
      "expires_at",
      "created_at",
    ],
  },
  {
    name: "game_emission_budgets",
    limit: 100,
    columns: ["account_id", "window_key", "granted_power_gh", "updated_at"],
  },
  {
    name: "daily_mission_claims",
    limit: 1_000,
    columns: [
      "id",
      "account_id",
      "mission_id",
      "window_key",
      "status",
      "battery_reward",
      "state_version_before",
      "state_version_after",
      "created_at",
      "completed_at",
    ],
  },
  {
    name: "beta_feedback",
    limit: 1_000,
    columns: [
      "id",
      "account_id",
      "category",
      "rating",
      "message",
      "page",
      "status",
      "created_at",
    ],
  },
  {
    name: "beta_accessibility_reviews",
    limit: 1_000,
    columns: [
      "id",
      "account_id",
      "window_key",
      "viewport_bucket",
      "input_mode",
      "text_scale",
      "text_readable",
      "controls_easy",
      "motion_comfortable",
      "rack_clear",
      "notes",
      "created_at",
    ],
  },
  {
    name: "task_preferences",
    limit: 1,
    columns: [
      "account_id",
      "partner_tasks_mode",
      "consent_version",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "task_preference_events",
    limit: 1_000,
    columns: [
      "id",
      "account_id",
      "partner_tasks_mode",
      "consent_version",
      "source",
      "created_at",
    ],
  },
  {
    name: "conversion_quotes",
    limit: 1_000,
    columns: [
      "id",
      "account_id",
      "asset",
      "asset_amount_atomic",
      "usd_rate_micros",
      "gross_cma_micros",
      "fee_bps",
      "fee_cma_micros",
      "net_cma_micros",
      "status",
      "consumption_key",
      "consumed_at",
      "state_version",
      "expires_at",
      "created_at",
    ],
  },
] as const;

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32_768));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function transformBytes(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
) {
  const safeBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const output = new Blob([safeBuffer]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function signPayload(payload: TransferPayload, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  return bytesToHex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  );
}

export function founderTransferSecretFromEnv(value: unknown) {
  const candidate = (value as { ARCADIA_TRANSFER_SECRET?: unknown } | null)
    ?.ARCADIA_TRANSFER_SECRET;
  return typeof candidate === "string" ? candidate.trim() : "";
}

export function isFreshFounderDestination(
  state: Partial<PublicGameState>,
  version: number,
) {
  const installed = Object.values(state.rackMiners ?? {}).flat().length;
  return (
    version <= 3 &&
    Number(state.cmaBalance ?? 0) === 0 &&
    Number(state.btcBalanceAtomic ?? 0) === 0 &&
    Number(state.dogeBalanceAtomic ?? 0) === 0 &&
    Number(state.batteryCount ?? 0) === 0 &&
    Array.isArray(state.racks) &&
    state.racks.length === 1 &&
    Array.isArray(state.minerInventory) &&
    state.minerInventory.length === 1 &&
    installed === 0
  );
}

export async function ensureFounderTransferSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS founder_account_transfers (
        transfer_id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        source_version INTEGER NOT NULL,
        destination_version INTEGER NOT NULL,
        row_count INTEGER NOT NULL,
        imported_at INTEGER NOT NULL
      )`,
    )
    .run();
}

export async function createFounderTransferEnvelope(
  db: D1Database,
  accountId: string,
  secret: string,
  now: number,
): Promise<{ envelope: FounderTransferEnvelope; rowCount: number }> {
  if (!secret) throw new Error("O segredo de migração ainda não foi configurado.");
  const sourceState = await db
    .prepare(
      `SELECT state_json, version, created_at, updated_at
       FROM game_states WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<TransferStateRow>();
  if (!sourceState) throw new Error("A conta fundadora não possui estado salvo.");

  const tableResults = await Promise.all(
    TRANSFER_TABLES.map(async (table) => {
      const result = await db
        .prepare(
          `SELECT ${table.columns.join(", ")}
           FROM ${table.name}
           WHERE account_id = ?
           LIMIT ${table.limit + 1}`,
        )
        .bind(accountId)
        .all<Record<string, unknown>>();
      if (result.results.length > table.limit) {
        throw new Error(`A tabela ${table.name} excedeu o limite da migração.`);
      }
      return [table.name, result.results] as const;
    }),
  );
  const tables = Object.fromEntries(tableResults);
  const rowCount = 1 + tableResults.reduce((sum, [, rows]) => sum + rows.length, 0);
  const payload: TransferPayload = {
    accountId,
    exportedAt: now,
    format: "arcadia-founder-transfer",
    sourceState,
    tables,
    transferId: crypto.randomUUID(),
    version: 1,
  };
  const envelope: FounderTransferEnvelope = {
    payload,
    signature: await signPayload(payload, secret),
  };
  if (new TextEncoder().encode(JSON.stringify(envelope)).byteLength > MAX_TRANSFER_BYTES) {
    throw new Error("O pacote excedeu 2 MB e precisa ser dividido.");
  }
  return { envelope, rowCount };
}

export async function serializeFounderTransferEnvelope(
  envelope: FounderTransferEnvelope,
) {
  const raw = new TextEncoder().encode(JSON.stringify(envelope));
  if (raw.byteLength > MAX_TRANSFER_BYTES) {
    throw new Error("O pacote excedeu 2 MB e precisa ser dividido.");
  }
  const compressed = await transformBytes(raw, new CompressionStream("gzip"));
  return `${COMPRESSED_TRANSFER_PREFIX}${bytesToBase64(compressed)}`;
}

async function parseEnvelope(value: unknown): Promise<FounderTransferEnvelope> {
  let parsed = value;
  if (typeof value === "string") {
    if (value.length > MAX_TRANSFER_BYTES * 2) {
      throw new Error("Pacote muito grande.");
    }
    if (value.startsWith(COMPRESSED_TRANSFER_PREFIX)) {
      const compressed = base64ToBytes(value.slice(COMPRESSED_TRANSFER_PREFIX.length));
      if (compressed.byteLength > MAX_TRANSFER_BYTES) {
        throw new Error("Pacote compactado muito grande.");
      }
      const raw = await transformBytes(
        compressed,
        new DecompressionStream("gzip"),
      );
      if (raw.byteLength > MAX_TRANSFER_BYTES) {
        throw new Error("Pacote descompactado muito grande.");
      }
      parsed = JSON.parse(new TextDecoder().decode(raw));
    } else {
      if (new TextEncoder().encode(value).byteLength > MAX_TRANSFER_BYTES) {
        throw new Error("Pacote muito grande.");
      }
      parsed = JSON.parse(value);
    }
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Pacote inválido.");
  const envelope = parsed as Partial<FounderTransferEnvelope>;
  if (!envelope.payload || typeof envelope.signature !== "string") {
    throw new Error("Pacote incompleto.");
  }
  return envelope as FounderTransferEnvelope;
}

function sqliteValue(value: unknown): string | number | null {
  if (value === null || typeof value === "string" || typeof value === "number") {
    return value;
  }
  throw new Error("O pacote contém um valor incompatível com o banco.");
}

async function runBatches(db: D1Database, statements: D1PreparedStatement[]) {
  for (let index = 0; index < statements.length; index += 75) {
    await db.batch(statements.slice(index, index + 75));
  }
}

export async function importFounderTransferEnvelope(
  db: D1Database,
  accountId: string,
  secret: string,
  rawEnvelope: unknown,
  now: number,
) {
  if (!secret) throw new Error("O segredo de migração ainda não foi configurado.");
  await ensureFounderTransferSchema(db);
  const envelope = await parseEnvelope(rawEnvelope);
  const { payload } = envelope;
  if (
    payload.format !== "arcadia-founder-transfer" ||
    payload.version !== 1 ||
    payload.accountId !== accountId ||
    !payload.transferId ||
    !Number.isFinite(payload.exportedAt) ||
    payload.exportedAt > now + 60_000 ||
    now - payload.exportedAt > MAX_TRANSFER_AGE_MS
  ) {
    throw new Error("O pacote não pertence a esta conta ou expirou.");
  }
  const expectedSignature = await signPayload(payload, secret);
  if (!constantTimeEqual(expectedSignature, envelope.signature)) {
    throw new Error("A assinatura do pacote não é válida.");
  }
  const replay = await db
    .prepare(
      `SELECT transfer_id FROM founder_account_transfers
       WHERE transfer_id = ?`,
    )
    .bind(payload.transferId)
    .first<{ transfer_id: string }>();
  if (replay) throw new Error("Este pacote já foi importado.");

  const destination = await db
    .prepare(
      `SELECT email, display_name, state_json, version, created_at, updated_at
       FROM game_states WHERE account_id = ?`,
    )
    .bind(accountId)
    .first<DestinationStateRow>();
  if (!destination) throw new Error("Abra o jogo público uma vez antes de migrar.");
  const destinationState = JSON.parse(destination.state_json) as PublicGameState;
  if (!isFreshFounderDestination(destinationState, Number(destination.version))) {
    throw new Error(
      "A conta pública já possui atividade. A migração automática foi interrompida para não sobrescrever progresso.",
    );
  }

  const sourceState = JSON.parse(payload.sourceState.state_json) as PublicGameState;
  if (!Array.isArray(sourceState.racks) || !sourceState.rackMiners) {
    throw new Error("O estado fundador não contém racks válidos.");
  }
  sourceState.lastSettledBlock = Math.floor(now / BLOCK_INTERVAL_MS);

  const deleteStatements = TRANSFER_TABLES.map((table) =>
    db.prepare(`DELETE FROM ${table.name} WHERE account_id = ?`).bind(accountId),
  );
  await runBatches(db, deleteStatements);

  const insertStatements: D1PreparedStatement[] = [];
  let rowCount = 1;
  for (const table of TRANSFER_TABLES) {
    const rows = payload.tables[table.name] ?? [];
    if (!Array.isArray(rows) || rows.length > table.limit) {
      throw new Error(`A tabela ${table.name} está fora do limite.`);
    }
    for (const row of rows) {
      if (!row || typeof row !== "object" || row.account_id !== accountId) {
        throw new Error(`A tabela ${table.name} contém outra conta.`);
      }
      const placeholders = table.columns.map(() => "?").join(", ");
      insertStatements.push(
        db
          .prepare(
            `INSERT INTO ${table.name} (${table.columns.join(", ")})
             VALUES (${placeholders})`,
          )
          .bind(...table.columns.map((column) => sqliteValue(row[column]))),
      );
      rowCount += 1;
    }
  }
  await runBatches(db, insertStatements);

  const destinationVersion = Math.max(
    Number(destination.version),
    Number(payload.sourceState.version),
  ) + 1;
  const updatedState = await db
    .prepare(
      `UPDATE game_states
       SET state_json = ?, version = ?, updated_at = ?
       WHERE account_id = ? AND version = ?`,
    )
    .bind(
      JSON.stringify(sourceState),
      destinationVersion,
      now,
      accountId,
      destination.version,
    )
    .run();
  if (Number(updatedState.meta.changes ?? 0) !== 1) {
    throw new Error("A conta pública mudou durante a migração. Tente novamente.");
  }
  await syncAccountNetworkPower(db, accountId, sourceState, now);

  await db.batch([
    db
      .prepare(
        `INSERT INTO ledger_entries (
          id, account_id, action, idempotency_key, state_version,
          delta_cma_micros, metadata_json, created_at
        ) VALUES (?, ?, 'founder_account_transferred', ?, ?, 0, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        accountId,
        `founder-transfer:${payload.transferId}`,
        destinationVersion,
        JSON.stringify({
          sourceVersion: payload.sourceState.version,
          transferredRows: rowCount,
          transferId: payload.transferId,
        }),
        now,
      ),
    db
      .prepare(
        `INSERT INTO founder_account_transfers (
          transfer_id, account_id, source_version, destination_version,
          row_count, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        payload.transferId,
        accountId,
        payload.sourceState.version,
        destinationVersion,
        rowCount,
        now,
      ),
  ]);

  return {
    destinationVersion,
    rowCount,
    sourceVersion: Number(payload.sourceState.version),
    state: sourceState,
    transferId: payload.transferId,
  };
}
