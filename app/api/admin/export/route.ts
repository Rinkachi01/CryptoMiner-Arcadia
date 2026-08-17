import { env } from "cloudflare:workers";
import {
  adminOwnerAccountIdFromEnv,
  claimOrVerifyAdminOwner,
  readAdminRuntimeSettings,
} from "../../../admin-settings";
import { accountIdForUser, getArcadiaUser } from "../../../identity-server";

export const dynamic = "force-dynamic";

type GameRow = {
  game_id: string;
  plays: number;
  power: number;
  suspicious: number;
  wins: number;
};

type LedgerRow = {
  action: string;
  cma_delta_micros: number;
  count: number;
};

type ReviewRow = {
  pending: number;
  reviewed: number;
};

type StateRow = {
  state_json: string;
};

type ExportJobRow = {
  account_id: string;
  created_at: number;
  error: string | null;
  id: string;
  processed_states: number;
  result_csv: string | null;
  state_offset: number;
  status: "processing" | "complete" | "failed";
  total_batteries: number;
  total_miners: number;
  total_racks: number;
  total_states: number;
  updated_at: number;
};

// Each export invocation stays well below the Worker CPU/memory budget. The
// client polls this route and downloads the CSV only after small chunks finish.
const EXPORT_STATE_CHUNK_SIZE = 25;
const EXPORT_JOB_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_EXPORT_STATES = 250;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(...values: unknown[]) {
  return values.map(csvCell).join(",");
}

async function ensureExportSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS admin_export_jobs (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        status TEXT DEFAULT 'processing' NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        total_states INTEGER DEFAULT 0 NOT NULL,
        processed_states INTEGER DEFAULT 0 NOT NULL,
        state_offset INTEGER DEFAULT 0 NOT NULL,
        total_batteries INTEGER DEFAULT 0 NOT NULL,
        total_miners INTEGER DEFAULT 0 NOT NULL,
        total_racks INTEGER DEFAULT 0 NOT NULL,
        result_csv TEXT,
        error TEXT
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS admin_export_jobs_account_updated_idx
       ON admin_export_jobs (account_id, updated_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS admin_export_jobs_updated_idx
       ON admin_export_jobs (updated_at)`,
    ),
  ]);
  await db
    .prepare("DELETE FROM admin_export_jobs WHERE updated_at < ?")
    .bind(Date.now() - EXPORT_JOB_RETENTION_MS)
    .run();
}

async function requireOwner() {
  const user = await getArcadiaUser();
  const db = env.DB;
  if (!user || !db) {
    return {
      error: Response.json({ error: "Faça login para continuar." }, { status: 401 }),
    } as const;
  }
  const now = Date.now();
  const accountId = await accountIdForUser(user);
  const owner = await claimOrVerifyAdminOwner(
    db,
    accountId,
    user.email,
    now,
    adminOwnerAccountIdFromEnv(env),
  );
  if (!owner.allowed) {
    return {
      error: Response.json(
        { error: "Relatório disponível apenas ao proprietário." },
        { status: 403 },
      ),
    } as const;
  }
  return { accountId, db, now, user } as const;
}

async function buildCsv(
  db: D1Database,
  userEmail: string,
  now: number,
  aggregates: Pick<ExportJobRow, "total_batteries" | "total_miners" | "total_racks">,
) {
  const since = now - 30 * 24 * 60 * 60 * 1000;
  const [games, ledger, reviews, settings] = await Promise.all([
    db
      .prepare(
        `SELECT game_id, COUNT(*) AS plays,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS wins,
                COALESCE(SUM(reward_power_gh), 0) AS power,
                COALESCE(SUM(CASE WHEN risk_level != 'normal' THEN 1 ELSE 0 END), 0) AS suspicious
         FROM game_sessions
         WHERE started_at >= ?
         GROUP BY game_id
         ORDER BY game_id`,
      )
      .bind(since)
      .all<GameRow>(),
    db
      .prepare(
        `SELECT action, COUNT(*) AS count,
                COALESCE(SUM(delta_cma_micros), 0) AS cma_delta_micros
         FROM ledger_entries
         WHERE created_at >= ?
         GROUP BY action
         ORDER BY action`,
      )
      .bind(since)
      .all<LedgerRow>(),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN reviews.session_id IS NULL THEN 1 ELSE 0 END), 0) AS pending,
           COALESCE(SUM(CASE WHEN reviews.session_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS reviewed
         FROM game_sessions sessions
         LEFT JOIN admin_session_reviews reviews ON reviews.session_id = sessions.id
         WHERE sessions.risk_level != 'normal'`,
      )
      .first<ReviewRow>(),
    readAdminRuntimeSettings(db),
  ]);

  const lines = [
    csvRow("CRYPTO MINER ARCADIA — RELATÓRIO DA TEMPORADA"),
    csvRow("Gerado em", new Date(now).toISOString()),
    csvRow("Período", "Últimos 30 dias"),
    csvRow("Proprietário", userEmail),
    csvRow(
      "Escopo da telemetria",
      `Até ${MAX_EXPORT_STATES} contas mais recentes para proteger a estabilidade do Worker`,
    ),
    "",
    csvRow("CONTROLES ATUAIS"),
    csvRow("Controle", "Estado ou limite"),
    csvRow("Caixas Arcadia", settings.cratesEnabled ? "Ativo" : "Pausado"),
    csvRow(
      "Poder dos minigames",
      settings.minigamePowerEnabled ? "Ativo" : "Pausado",
    ),
    csvRow("Bateria diária", settings.dailyBatteryEnabled ? "Ativo" : "Pausado"),
    csvRow("Alerta de poder GH/s", settings.powerAlertGh),
    csvRow("Alerta de revisões", settings.openReviewAlertCount),
    csvRow("Alerta de caixas", settings.crateAlertCount),
    csvRow("Alerta de concentração %", settings.minerConcentrationAlertPercent),
    "",
    csvRow("MINIGAMES — 30 DIAS"),
    csvRow("Jogo", "Partidas", "Vitórias", "Poder GH/s", "Sinalizadas"),
    ...games.results.map((game) =>
      csvRow(
        game.game_id,
        Number(game.plays),
        Number(game.wins),
        Number(game.power),
        Number(game.suspicious),
      ),
    ),
    "",
    csvRow("MOVIMENTO ECONÔMICO — 30 DIAS"),
    csvRow("Ação", "Quantidade", "Variação CMA"),
    ...ledger.results.map((entry) =>
      csvRow(
        entry.action,
        Number(entry.count),
        Number(entry.cma_delta_micros) / 1_000_000,
      ),
    ),
    "",
    csvRow("INVENTÁRIO AGREGADO"),
    csvRow("Baterias", aggregates.total_batteries),
    csvRow("Mineradores", aggregates.total_miners),
    csvRow("Racks instalados", aggregates.total_racks),
    "",
    csvRow("REVISÃO ANTIFRAUDE"),
    csvRow("Pendentes", Number(reviews?.pending ?? 0)),
    csvRow("Revisadas", Number(reviews?.reviewed ?? 0)),
    "",
    csvRow("AVISO", "Simulação virtual sem depósito, saque ou promessa de retorno."),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function POST() {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { accountId, db, now } = auth;
  await ensureExportSchema(db);

  const existing = await db
    .prepare(
      `SELECT id, total_states, processed_states
       FROM admin_export_jobs
       WHERE account_id = ? AND status = 'processing'
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .bind(accountId)
    .first<{ id: string; processed_states: number; total_states: number }>();
  if (existing) {
    return Response.json(
      {
        jobId: existing.id,
        processed: Number(existing.processed_states),
        status: "processing",
        total: Math.min(Number(existing.total_states), MAX_EXPORT_STATES),
      },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  const totalRow = await db
    .prepare("SELECT COUNT(*) AS total FROM game_states")
    .first<{ total: number }>();
  const totalStates = Math.min(Number(totalRow?.total ?? 0), MAX_EXPORT_STATES);
  const jobId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO admin_export_jobs (
         id, account_id, status, created_at, updated_at, total_states
       ) VALUES (?, ?, 'processing', ?, ?, ?)`,
    )
    .bind(jobId, accountId, now, now, totalStates)
    .run();
  return Response.json(
    { jobId, processed: 0, status: "processing", total: totalStates },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const auth = await requireOwner();
  if ("error" in auth) return auth.error;
  const { accountId, db, now, user } = auth;
  await ensureExportSchema(db);
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim();
  if (!jobId) {
    return Response.json(
      { error: "Inicie a exportação pelo botão do painel." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const job = await db
    .prepare("SELECT * FROM admin_export_jobs WHERE id = ? AND account_id = ?")
    .bind(jobId, accountId)
    .first<ExportJobRow>();
  if (!job) {
    return Response.json({ error: "Exportação não encontrada." }, { status: 404 });
  }
  if (job.status === "failed") {
    return Response.json(
      { error: job.error ?? "Não foi possível concluir a exportação." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (job.status === "complete" && job.result_csv) {
    if (url.searchParams.get("download") === "1") {
      const date = new Date(job.created_at).toISOString().slice(0, 10);
      return new Response(job.result_csv, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="arcadia-season-${date}.csv"`,
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }
    return Response.json(
      { jobId, processed: job.processed_states, status: "complete", total: job.total_states },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const offset = Number(job.state_offset);
  const remaining = Math.max(0, Number(job.total_states) - offset);
  const limit = Math.min(EXPORT_STATE_CHUNK_SIZE, remaining);
  const stateRows = limit
    ? await db
        .prepare(
          `SELECT state_json
           FROM game_states
           ORDER BY updated_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all<StateRow>()
    : { results: [] as StateRow[] };
  let totalBatteries = Number(job.total_batteries);
  let totalMiners = Number(job.total_miners);
  let totalRacks = Number(job.total_racks);
  for (const row of stateRows.results) {
    try {
      const state = JSON.parse(row.state_json) as {
        batteryCount?: number;
        minerInventory?: unknown[];
        rackMiners?: Record<string, unknown[]>;
        racks?: unknown[];
      };
      totalBatteries += Math.max(0, Number(state.batteryCount ?? 0));
      totalMiners += Array.isArray(state.minerInventory) ? state.minerInventory.length : 0;
      totalMiners += Object.values(state.rackMiners ?? {}).reduce(
        (total, units) => total + (Array.isArray(units) ? units.length : 0),
        0,
      );
      totalRacks += Array.isArray(state.racks) ? state.racks.length : 0;
    } catch {
      // Ignore malformed legacy rows without failing the whole export.
    }
  }
  const processed = Math.min(
    Number(job.total_states),
    offset + stateRows.results.length,
  );
  if (processed < Number(job.total_states) && stateRows.results.length === 0) {
    await db
      .prepare(
        `UPDATE admin_export_jobs
         SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
      )
      .bind("A base mudou durante a exportação. Tente novamente.", now, jobId)
      .run();
    return Response.json(
      { error: "A base mudou durante a exportação. Tente novamente." },
      { status: 409 },
    );
  }
  const complete = processed >= Number(job.total_states);
  if (complete) {
    const resultCsv = await buildCsv(db, user.email, job.created_at, {
      total_batteries: totalBatteries,
      total_miners: totalMiners,
      total_racks: totalRacks,
    });
    await db
      .prepare(
        `UPDATE admin_export_jobs
         SET status = 'complete', processed_states = ?, state_offset = ?,
             total_batteries = ?, total_miners = ?, total_racks = ?,
             result_csv = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(
        processed,
        processed,
        totalBatteries,
        totalMiners,
        totalRacks,
        resultCsv,
        now,
        jobId,
      )
      .run();
    return Response.json(
      { jobId, processed, status: "complete", total: job.total_states },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  await db
    .prepare(
      `UPDATE admin_export_jobs
       SET processed_states = ?, state_offset = ?, total_batteries = ?,
           total_miners = ?, total_racks = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(
      processed,
      processed,
      totalBatteries,
      totalMiners,
      totalRacks,
      now,
      jobId,
    )
    .run();
  return Response.json(
    { jobId, processed, status: "processing", total: job.total_states },
    { headers: { "Cache-Control": "no-store" } },
  );
}
