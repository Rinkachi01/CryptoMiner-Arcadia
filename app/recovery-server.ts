const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ARCHIVE_BYTES = 24 * 1024 * 1024;
const ARCHIVE_SCHEMA_VERSION = "arcadia-recovery-v1";
const PAGE_SIZE = 500;

type BackupRow = Record<string, string | number | null>;
type CountRow = { total: number };

export type RecoveryArchiveBucket = {
  get(key: string): Promise<{
    body: ReadableStream;
    text(): Promise<string>;
  } | null>;
  head(key: string): Promise<unknown | null>;
  put(
    key: string,
    value: string,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    },
  ): Promise<unknown>;
};

export type RecoveryDrillChecks = {
  accountStatesReadable: boolean;
  archiveFresh: boolean;
  checksumMatches: boolean;
  ledgerAccountsPresent: boolean;
  ledgerVersionsSafe: boolean;
  networkAccountsPresent: boolean;
  payloadComplete: boolean;
  schemaRecognized: boolean;
  storageObjectReadable: boolean;
};

export type PublicRecoveryArchive = {
  checksumSha256: string | null;
  createdAt: number;
  errorMessage: string | null;
  id: string;
  rowCount: number;
  sizeBytes: number;
  status: "preparing" | "ready" | "failed";
};

export type PublicRecoveryDrill = {
  archiveId: string;
  checks: RecoveryDrillChecks;
  createdAt: number;
  id: string;
  status: "passed" | "failed";
};

export type RecoveryReadinessGate = {
  id: string;
  label: string;
  passed: boolean;
};

export type RecoveryOverview = {
  archives: PublicRecoveryArchive[];
  drills: PublicRecoveryDrill[];
  gates: RecoveryReadinessGate[];
  latestArchive: PublicRecoveryArchive | null;
  latestDrill: PublicRecoveryDrill | null;
  status: "stable" | "attention" | "critical";
  storageConnected: boolean;
};

type ArchiveRow = {
  checksum_sha256: string | null;
  created_at: number;
  error_message: string | null;
  id: string;
  object_key: string;
  row_count: number;
  size_bytes: number;
  status: string;
};

type DrillRow = {
  archive_id: string;
  checks_json: string;
  created_at: number;
  id: string;
  status: string;
};

type RecoveryBundle = {
  generatedAt: number;
  manifest: {
    checksumSha256: string;
    containsPersonalData: true;
    rowCount: number;
    tableCounts: Record<string, number>;
  };
  schemaVersion: string;
  tables: Record<string, BackupRow[]>;
};

const requiredTables = [
  "game_states",
  "ledger_entries",
  "game_sessions",
  "game_progress",
  "temporary_power_grants",
  "game_emission_budgets",
  "daily_mission_claims",
  "network_runtime_settings",
  "account_network_power",
  "seasons",
  "season_snapshots",
  "admin_owners",
  "admin_runtime_settings",
  "admin_session_reviews",
  "admin_audit_log",
  "beta_feedback",
  "beta_device_profiles",
  "beta_accessibility_reviews",
  "task_preferences",
  "task_preference_events",
  "operational_checkpoints",
] as const;

const tableLimits: Record<(typeof requiredTables)[number], number> = {
  account_network_power: 10_000,
  beta_accessibility_reviews: 50_000,
  beta_device_profiles: 10_000,
  admin_audit_log: 50_000,
  admin_owners: 10,
  admin_runtime_settings: 10,
  admin_session_reviews: 50_000,
  beta_feedback: 50_000,
  daily_mission_claims: 50_000,
  game_emission_budgets: 50_000,
  game_progress: 50_000,
  game_sessions: 100_000,
  game_states: 10_000,
  ledger_entries: 100_000,
  network_runtime_settings: 10,
  operational_checkpoints: 10_000,
  season_snapshots: 10_000,
  seasons: 1_000,
  task_preference_events: 50_000,
  task_preferences: 10_000,
  temporary_power_grants: 100_000,
};

const emptyChecks: RecoveryDrillChecks = {
  accountStatesReadable: false,
  archiveFresh: false,
  checksumMatches: false,
  ledgerAccountsPresent: false,
  ledgerVersionsSafe: false,
  networkAccountsPresent: false,
  payloadComplete: false,
  schemaRecognized: false,
  storageObjectReadable: false,
};

export function recoveryBucketFromEnv(value: unknown) {
  const candidate = value as { RECOVERY_ARCHIVE?: RecoveryArchiveBucket };
  return candidate.RECOVERY_ARCHIVE ?? null;
}

export async function ensureRecoverySchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS recovery_archives (
        id TEXT PRIMARY KEY NOT NULL,
        object_key TEXT UNIQUE NOT NULL,
        checksum_sha256 TEXT,
        size_bytes INTEGER DEFAULT 0 NOT NULL,
        row_count INTEGER DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'preparing' NOT NULL,
        error_message TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS recovery_archives_created_at_idx
       ON recovery_archives (created_at)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS recovery_drills (
        id TEXT PRIMARY KEY NOT NULL,
        archive_id TEXT NOT NULL,
        status TEXT NOT NULL,
        checks_json TEXT DEFAULT '{}' NOT NULL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS recovery_drills_created_at_idx
       ON recovery_drills (created_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS recovery_drills_archive_idx
       ON recovery_drills (archive_id)`,
    ),
  ]);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readTable(
  db: D1Database,
  table: (typeof requiredTables)[number],
) {
  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM ${table}`)
    .first<CountRow>();
  const total = Number(count?.total ?? 0);
  if (total > tableLimits[table]) {
    throw new Error(
      `${table} ultrapassou o limite do pacote manual. Configure exportação em lotes antes de continuar.`,
    );
  }
  const rows: BackupRow[] = [];
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const page = await db
      .prepare(
        `SELECT * FROM ${table}
         ORDER BY 1 ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, offset)
      .all<BackupRow>();
    rows.push(...(page.results ?? []));
  }
  return rows;
}

async function buildRecoveryBundle(db: D1Database, now: number) {
  const tables: Record<string, BackupRow[]> = {};
  const tableCounts: Record<string, number> = {};
  let rowCount = 0;
  for (const table of requiredTables) {
    const rows = await readTable(db, table);
    tables[table] = rows;
    tableCounts[table] = rows.length;
    rowCount += rows.length;
  }
  const core = {
    generatedAt: now,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    tables,
  };
  const checksumSha256 = await sha256Hex(JSON.stringify(core));
  const bundle: RecoveryBundle = {
    ...core,
    manifest: {
      checksumSha256,
      containsPersonalData: true,
      rowCount,
      tableCounts,
    },
  };
  const payload = JSON.stringify(bundle);
  const sizeBytes = new TextEncoder().encode(payload).byteLength;
  if (sizeBytes > MAX_ARCHIVE_BYTES) {
    throw new Error(
      "O pacote ultrapassou 24 MB. A próxima cópia precisa ser exportada em partes.",
    );
  }
  return { bundle, checksumSha256, payload, rowCount, sizeBytes };
}

function publicArchive(row: ArchiveRow): PublicRecoveryArchive {
  return {
    checksumSha256: row.checksum_sha256,
    createdAt: Number(row.created_at),
    errorMessage: row.error_message,
    id: row.id,
    rowCount: Number(row.row_count),
    sizeBytes: Number(row.size_bytes),
    status:
      row.status === "ready"
        ? "ready"
        : row.status === "failed"
          ? "failed"
          : "preparing",
  };
}

function parseChecks(value: string): RecoveryDrillChecks {
  try {
    return { ...emptyChecks, ...(JSON.parse(value) as RecoveryDrillChecks) };
  } catch {
    return emptyChecks;
  }
}

function publicDrill(row: DrillRow): PublicRecoveryDrill {
  return {
    archiveId: row.archive_id,
    checks: parseChecks(row.checks_json),
    createdAt: Number(row.created_at),
    id: row.id,
    status: row.status === "passed" ? "passed" : "failed",
  };
}

export function evaluateRecoveryReadiness(input: {
  archiveObjectPresent: boolean;
  latestArchive: PublicRecoveryArchive | null;
  latestDrill: PublicRecoveryDrill | null;
  now: number;
  storageConnected: boolean;
}) {
  const archiveRecent = Boolean(
    input.latestArchive &&
      input.latestArchive.status === "ready" &&
      input.now - input.latestArchive.createdAt <= 7 * DAY_MS,
  );
  const drillMatchesArchive = Boolean(
    input.latestArchive &&
      input.latestDrill &&
      input.latestDrill.archiveId === input.latestArchive.id &&
      input.latestDrill.status === "passed",
  );
  const gates: RecoveryReadinessGate[] = [
    {
      id: "external-storage",
      label: "Armazenamento separado conectado",
      passed: input.storageConnected,
    },
    {
      id: "recent-archive",
      label: "Cópia completa criada nos últimos 7 dias",
      passed: archiveRecent,
    },
    {
      id: "archive-object",
      label: "Arquivo externo localizado e legível",
      passed: input.archiveObjectPresent,
    },
    {
      id: "restore-drill",
      label: "Ensaio de restauração aprovado para a cópia atual",
      passed: drillMatchesArchive,
    },
  ];
  const critical =
    !input.storageConnected ||
    Boolean(input.latestArchive && !input.archiveObjectPresent);
  return {
    gates,
    status: critical
      ? ("critical" as const)
      : gates.every((gate) => gate.passed)
        ? ("stable" as const)
        : ("attention" as const),
  };
}

async function readArchiveRows(db: D1Database) {
  return db
    .prepare(
      `SELECT id, object_key, checksum_sha256, size_bytes, row_count,
              status, error_message, created_at
       FROM recovery_archives
       ORDER BY created_at DESC
       LIMIT 8`,
    )
    .all<ArchiveRow>();
}

export async function readRecoveryOverview(
  db: D1Database,
  bucket: RecoveryArchiveBucket | null,
  now: number,
): Promise<RecoveryOverview> {
  await ensureRecoverySchema(db);
  const [archiveRows, drillRows] = await Promise.all([
    readArchiveRows(db),
    db
      .prepare(
        `SELECT id, archive_id, status, checks_json, created_at
         FROM recovery_drills
         ORDER BY created_at DESC
         LIMIT 8`,
      )
      .all<DrillRow>(),
  ]);
  const archiveRecords = archiveRows.results ?? [];
  const archives = archiveRecords.map(publicArchive);
  const drills = (drillRows.results ?? []).map(publicDrill);
  const latestReadyIndex = archiveRecords.findIndex(
    (archive) => archive.status === "ready",
  );
  const latestArchive =
    latestReadyIndex >= 0 ? archives[latestReadyIndex] : null;
  const latestObjectKey =
    latestReadyIndex >= 0 ? archiveRecords[latestReadyIndex].object_key : null;
  const archiveObjectPresent = Boolean(
    bucket && latestObjectKey && (await bucket.head(latestObjectKey)),
  );
  const readiness = evaluateRecoveryReadiness({
    archiveObjectPresent,
    latestArchive,
    latestDrill: drills[0] ?? null,
    now,
    storageConnected: Boolean(bucket),
  });
  return {
    archives,
    drills,
    gates: readiness.gates,
    latestArchive,
    latestDrill: drills[0] ?? null,
    status: readiness.status,
    storageConnected: Boolean(bucket),
  };
}

export async function createRecoveryArchive(
  db: D1Database,
  bucket: RecoveryArchiveBucket | null,
  actorAccountId: string,
  now: number,
) {
  await ensureRecoverySchema(db);
  if (!bucket) {
    throw new Error("O armazenamento externo ainda não está conectado.");
  }
  const id = crypto.randomUUID();
  const timestamp = new Date(now).toISOString().replaceAll(":", "-");
  const objectKey = `recovery/${timestamp}-${id}.json`;
  await db
    .prepare(
      `INSERT INTO recovery_archives (
        id, object_key, status, created_by, created_at
      ) VALUES (?, ?, 'preparing', ?, ?)`,
    )
    .bind(id, objectKey, actorAccountId, now)
    .run();
  try {
    const result = await buildRecoveryBundle(db, now);
    await bucket.put(objectKey, result.payload, {
      customMetadata: {
        checksumSha256: result.checksumSha256,
        schemaVersion: ARCHIVE_SCHEMA_VERSION,
      },
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    await db
      .prepare(
        `UPDATE recovery_archives
         SET checksum_sha256 = ?, size_bytes = ?, row_count = ?,
             status = 'ready', error_message = NULL
         WHERE id = ?`,
      )
      .bind(
        result.checksumSha256,
        result.sizeBytes,
        result.rowCount,
        id,
      )
      .run();
    return {
      checksumSha256: result.checksumSha256,
      id,
      rowCount: result.rowCount,
      sizeBytes: result.sizeBytes,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao montar a cópia externa.";
    await db
      .prepare(
        `UPDATE recovery_archives
         SET status = 'failed', error_message = ?
         WHERE id = ?`,
      )
      .bind(message.slice(0, 280), id)
      .run();
    throw error;
  }
}

function isRecoveryBundle(value: unknown): value is RecoveryBundle {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecoveryBundle>;
  return Boolean(
    candidate.manifest &&
      candidate.tables &&
      typeof candidate.generatedAt === "number" &&
      typeof candidate.schemaVersion === "string",
  );
}

async function recordDrill(
  db: D1Database,
  archiveId: string,
  checks: RecoveryDrillChecks,
  actorAccountId: string,
  now: number,
) {
  const status = Object.values(checks).every(Boolean) ? "passed" : "failed";
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO recovery_drills (
        id, archive_id, status, checks_json, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, archiveId, status, JSON.stringify(checks), actorAccountId, now)
    .run();
  return { checks, id, status };
}

export async function runRecoveryDrill(
  db: D1Database,
  bucket: RecoveryArchiveBucket | null,
  actorAccountId: string,
  now: number,
) {
  await ensureRecoverySchema(db);
  if (!bucket) {
    throw new Error("O armazenamento externo ainda não está conectado.");
  }
  const archive = await db
    .prepare(
      `SELECT id, object_key, checksum_sha256, size_bytes, row_count,
              status, error_message, created_at
       FROM recovery_archives
       WHERE status = 'ready'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .first<ArchiveRow>();
  if (!archive) {
    throw new Error("Crie uma cópia externa antes do ensaio de restauração.");
  }
  const checks = { ...emptyChecks };
  try {
    const object = await bucket.get(archive.object_key);
    checks.storageObjectReadable = Boolean(object);
    if (!object) {
      return recordDrill(db, archive.id, checks, actorAccountId, now);
    }
    const parsed = JSON.parse(await object.text()) as unknown;
    if (!isRecoveryBundle(parsed)) {
      return recordDrill(db, archive.id, checks, actorAccountId, now);
    }
    checks.schemaRecognized = parsed.schemaVersion === ARCHIVE_SCHEMA_VERSION;
    checks.archiveFresh = now - parsed.generatedAt <= 7 * DAY_MS;
    checks.payloadComplete = requiredTables.every((table) =>
      Array.isArray(parsed.tables[table]),
    );
    const core = {
      generatedAt: parsed.generatedAt,
      schemaVersion: parsed.schemaVersion,
      tables: parsed.tables,
    };
    checks.checksumMatches =
      (await sha256Hex(JSON.stringify(core))) ===
        parsed.manifest.checksumSha256 &&
      parsed.manifest.checksumSha256 === archive.checksum_sha256;

    const states = parsed.tables.game_states ?? [];
    const stateVersions = new Map<string, number>();
    checks.accountStatesReadable = states.every((row) => {
      try {
        const accountId = String(row.account_id ?? "");
        const state = JSON.parse(String(row.state_json ?? ""));
        const version = Number(row.version ?? 0);
        if (!accountId || !state || typeof state !== "object" || version < 1) {
          return false;
        }
        stateVersions.set(accountId, version);
        return true;
      } catch {
        return false;
      }
    });
    const ledger = parsed.tables.ledger_entries ?? [];
    checks.ledgerAccountsPresent = ledger.every((row) =>
      stateVersions.has(String(row.account_id ?? "")),
    );
    checks.ledgerVersionsSafe = ledger.every((row) => {
      const stateVersion = stateVersions.get(String(row.account_id ?? ""));
      return (
        stateVersion !== undefined &&
        Number(row.state_version ?? 0) <= stateVersion
      );
    });
    checks.networkAccountsPresent = (
      parsed.tables.account_network_power ?? []
    ).every((row) => stateVersions.has(String(row.account_id ?? "")));
    return recordDrill(db, archive.id, checks, actorAccountId, now);
  } catch {
    return recordDrill(db, archive.id, checks, actorAccountId, now);
  }
}

export async function readLatestRecoveryObject(
  db: D1Database,
  bucket: RecoveryArchiveBucket | null,
) {
  await ensureRecoverySchema(db);
  if (!bucket) return null;
  const archive = await db
    .prepare(
      `SELECT id, object_key, checksum_sha256, size_bytes, row_count,
              status, error_message, created_at
       FROM recovery_archives
       WHERE status = 'ready'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .first<ArchiveRow>();
  if (!archive) return null;
  const object = await bucket.get(archive.object_key);
  return object ? { archive: publicArchive(archive), object } : null;
}
