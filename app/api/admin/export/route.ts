import { env } from "cloudflare:workers";
import {
  claimOrVerifyAdminOwner,
  readAdminRuntimeSettings,
} from "../../../admin-settings";
import { getChatGPTUser } from "../../../chatgpt-auth";

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

async function accountIdFor(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(...values: unknown[]) {
  return values.map(csvCell).join(",");
}

export async function GET() {
  const user = await getChatGPTUser();
  const db = env.DB;
  if (!user || !db) {
    return Response.json({ error: "Faça login para continuar." }, { status: 401 });
  }
  const now = Date.now();
  const accountId = await accountIdFor(user.email);
  const owner = await claimOrVerifyAdminOwner(
    db,
    accountId,
    user.email,
    now,
  );
  if (!owner.allowed) {
    return Response.json(
      { error: "Relatório disponível apenas ao proprietário." },
      { status: 403 },
    );
  }

  const since = now - 30 * 24 * 60 * 60 * 1000;
  const [games, ledger, reviews, stateRows, settings] = await Promise.all([
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
    db
      .prepare("SELECT state_json FROM game_states LIMIT 5000")
      .all<StateRow>(),
    readAdminRuntimeSettings(db),
  ]);

  let totalBatteries = 0;
  let totalMiners = 0;
  let totalRacks = 0;
  for (const row of stateRows.results) {
    try {
      const state = JSON.parse(row.state_json) as {
        batteryCount?: number;
        minerInventory?: unknown[];
        rackMiners?: Record<string, unknown[]>;
        racks?: unknown[];
      };
      totalBatteries += Math.max(0, Number(state.batteryCount ?? 0));
      totalMiners += Array.isArray(state.minerInventory)
        ? state.minerInventory.length
        : 0;
      totalMiners += Object.values(state.rackMiners ?? {}).reduce(
        (total, units) => total + (Array.isArray(units) ? units.length : 0),
        0,
      );
      totalRacks += Array.isArray(state.racks) ? state.racks.length : 0;
    } catch {
      // Malformed legacy rows remain excluded from the aggregate report.
    }
  }

  const lines = [
    csvRow("CRYPTO MINER ARCADIA — RELATÓRIO DA TEMPORADA"),
    csvRow("Gerado em", new Date(now).toISOString()),
    csvRow("Período", "Últimos 30 dias"),
    csvRow("Proprietário", user.email),
    "",
    csvRow("CONTROLES ATUAIS"),
    csvRow("Controle", "Estado ou limite"),
    csvRow("Caixas Arcadia", settings.cratesEnabled ? "Ativo" : "Pausado"),
    csvRow(
      "Poder dos minigames",
      settings.minigamePowerEnabled ? "Ativo" : "Pausado",
    ),
    csvRow(
      "Bateria diária",
      settings.dailyBatteryEnabled ? "Ativo" : "Pausado",
    ),
    csvRow("Alerta de poder GH/s", settings.powerAlertGh),
    csvRow("Alerta de revisões", settings.openReviewAlertCount),
    csvRow("Alerta de caixas", settings.crateAlertCount),
    csvRow(
      "Alerta de concentração %",
      settings.minerConcentrationAlertPercent,
    ),
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
    csvRow("Baterias", totalBatteries),
    csvRow("Mineradores", totalMiners),
    csvRow("Racks instalados", totalRacks),
    "",
    csvRow("REVISÃO ANTIFRAUDE"),
    csvRow("Pendentes", Number(reviews?.pending ?? 0)),
    csvRow("Revisadas", Number(reviews?.reviewed ?? 0)),
    "",
    csvRow(
      "AVISO",
      "Simulação virtual sem depósito, saque ou promessa de retorno.",
    ),
  ];
  const date = new Date(now).toISOString().slice(0, 10);
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="arcadia-season-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
