const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// The operational cockpit is a diagnostic view. Keep the expensive JSON
// consistency comparison focused on recently changed accounts; the indexed
// missing-row count below still covers the complete account set.
const NETWORK_HEALTH_SAMPLE_SIZE = 250;

export type OperationalSeverity = "stable" | "attention" | "critical";

export type OperationalMetrics = {
  expiredPowerBacklog: number;
  invalidStateRows: number;
  latestCheckpointAt: number | null;
  missingNetworkIndexes: number;
  openRiskReviews: number;
  reservedMissionClaims: number;
  staleNetworkIndexes: number;
  stuckGameSessions: number;
  totalAccounts: number;
};

export type OperationalFinding = {
  description: string;
  id: string;
  label: string;
  severity: OperationalSeverity;
  value: number;
};

export type OperationalCheckpoint = {
  createdAt: number;
  id: string;
  metrics: OperationalMetrics;
  status: OperationalSeverity;
};

export type IncidentRunbook = {
  id: string;
  impact: string;
  safeAction: string;
  status: "ready" | "triggered";
  title: string;
  trigger: string;
};

export type OperationalHealthReport = {
  checkedAt: number;
  checkpoints: OperationalCheckpoint[];
  findings: OperationalFinding[];
  metrics: OperationalMetrics;
  runbook: IncidentRunbook[];
  status: OperationalSeverity;
};

type CountRow = { total: number };
type StateIntegrityRow = {
  invalid_state_rows: number;
  total_accounts: number;
};
type NetworkIntegrityRow = {
  missing_network_indexes: number;
  stale_network_indexes: number;
};
type CheckpointRow = {
  created_at: number;
  id: string;
  metrics_json: string;
  status: string;
};

const severityRank: Record<OperationalSeverity, number> = {
  stable: 0,
  attention: 1,
  critical: 2,
};

function severityForCount(
  value: number,
  attentionAt = 1,
  criticalAt = Number.POSITIVE_INFINITY,
): OperationalSeverity {
  if (value >= criticalAt) return "critical";
  if (value >= attentionAt) return "attention";
  return "stable";
}

export function evaluateOperationalHealth(
  metrics: OperationalMetrics,
  now: number,
) {
  const checkpointAge = metrics.latestCheckpointAt
    ? now - metrics.latestCheckpointAt
    : Number.POSITIVE_INFINITY;
  const findings: OperationalFinding[] = [
    {
      id: "state-integrity",
      label: "Estados de conta",
      description:
        metrics.invalidStateRows === 0
          ? "Todos os estados persistidos possuem estrutura JSON legível."
          : "Há estados ilegíveis que precisam de diagnóstico antes de qualquer reparo.",
      severity: severityForCount(metrics.invalidStateRows, 1, 1),
      value: metrics.invalidStateRows,
    },
    {
      id: "network-index",
      label: "Índice da rede global",
      description:
        metrics.missingNetworkIndexes + metrics.staleNetworkIndexes === 0
          ? "Todas as contas estão sincronizadas com o índice global de poder."
          : "Existem contas ausentes ou atrasadas no índice; a economia não foi alterada.",
      severity: severityForCount(
        metrics.missingNetworkIndexes + metrics.staleNetworkIndexes,
        1,
        25,
      ),
      value: metrics.missingNetworkIndexes + metrics.staleNetworkIndexes,
    },
    {
      id: "game-sessions",
      label: "Sessões do Arcade",
      description:
        metrics.stuckGameSessions === 0
          ? "Nenhuma partida ativa ultrapassou o prazo do servidor."
          : "Partidas expiradas continuam ativas e devem ser revisadas sem conceder recompensa.",
      severity: severityForCount(metrics.stuckGameSessions, 1, 10),
      value: metrics.stuckGameSessions,
    },
    {
      id: "mission-claims",
      label: "Resgates de bateria",
      description:
        metrics.reservedMissionClaims === 0
          ? "Nenhum resgate ficou reservado por mais de 30 minutos."
          : "Há resgates interrompidos; confirme o ledger antes de reprocessar qualquer item.",
      severity: severityForCount(metrics.reservedMissionClaims, 1, 5),
      value: metrics.reservedMissionClaims,
    },
    {
      id: "risk-reviews",
      label: "Fila antifraude",
      description:
        metrics.openRiskReviews === 0
          ? "Toda sessão sinalizada já possui decisão do proprietário."
          : "Sessões sinalizadas aguardam revisão manual e continuam preservadas.",
      severity: severityForCount(metrics.openRiskReviews, 1, 20),
      value: metrics.openRiskReviews,
    },
    {
      id: "power-retention",
      label: "Retenção de poder temporário",
      description:
        metrics.expiredPowerBacklog < 500
          ? "O histórico expirado está dentro do limite de retenção operacional."
          : "O volume histórico merece compactação planejada, sem afetar o ledger.",
      severity: severityForCount(metrics.expiredPowerBacklog, 500, 5_000),
      value: metrics.expiredPowerBacklog,
    },
    {
      id: "checkpoint-cadence",
      label: "Checkpoint de integridade",
      description:
        checkpointAge <= 7 * DAY_MS
          ? "Existe uma fotografia recente para comparação operacional."
          : "Registre uma fotografia do estado atual; ela não substitui um backup.",
      severity: checkpointAge <= 7 * DAY_MS ? "stable" : "attention",
      value: metrics.latestCheckpointAt ?? 0,
    },
  ];
  const status = findings.reduce<OperationalSeverity>(
    (highest, finding) =>
      severityRank[finding.severity] > severityRank[highest]
        ? finding.severity
        : highest,
    "stable",
  );
  return { findings, status };
}

export function buildIncidentRunbook(
  metrics: OperationalMetrics,
): IncidentRunbook[] {
  return [
    {
      id: "network-index",
      title: "Índice da rede atrasado",
      trigger: "Conta ausente ou versão do índice anterior ao estado do jogo.",
      impact: "O poder daquela conta pode não entrar no próximo bloco global.",
      safeAction:
        "Congelar mudanças econômicas, comparar estado e índice e executar a sincronização idempotente da conta.",
      status:
        metrics.missingNetworkIndexes + metrics.staleNetworkIndexes > 0
          ? "triggered"
          : "ready",
    },
    {
      id: "stuck-session",
      title: "Partida ou resgate interrompido",
      trigger: "Sessão expirada ativa ou resgate reservado por mais de 30 minutos.",
      impact: "O jogador pode ficar bloqueado ou tentar repetir a mesma recompensa.",
      safeAction:
        "Conferir sessão, idempotência e ledger; encerrar somente o registro inconsistente sem emitir prêmio novo.",
      status:
        metrics.stuckGameSessions + metrics.reservedMissionClaims > 0
          ? "triggered"
          : "ready",
    },
    {
      id: "reward-spike",
      title: "Pico de recompensa suspeita",
      trigger: "Fila antifraude cresce ou uma sessão viola os limites do servidor.",
      impact: "Poder temporário indevido pode distorcer a divisão dos blocos.",
      safeAction:
        "Pausar a origem de recompensa, preservar a prova e revisar a sessão antes de qualquer estorno.",
      status: metrics.openRiskReviews > 0 ? "triggered" : "ready",
    },
    {
      id: "state-recovery",
      title: "Estado de conta ilegível",
      trigger: "O servidor não consegue validar o JSON persistido de uma conta.",
      impact: "Inventário e progresso dessa conta não podem ser carregados com segurança.",
      safeAction:
        "Bloquear escrita na conta afetada, preservar a linha original e reconstruir a partir do ledger em ambiente isolado.",
      status: metrics.invalidStateRows > 0 ? "triggered" : "ready",
    },
  ];
}

export async function ensureOperationsSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS operational_checkpoints (
        id TEXT PRIMARY KEY NOT NULL,
        actor_account_id TEXT NOT NULL,
        status TEXT NOT NULL,
        metrics_json TEXT NOT NULL DEFAULT '{}',
        findings_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS operational_checkpoints_created_at_idx
       ON operational_checkpoints (created_at)`,
    ),
  ]);
}

function parseCheckpoint(row: CheckpointRow): OperationalCheckpoint {
  let metrics: OperationalMetrics;
  try {
    metrics = JSON.parse(row.metrics_json) as OperationalMetrics;
  } catch {
    metrics = {
      expiredPowerBacklog: 0,
      invalidStateRows: 0,
      latestCheckpointAt: null,
      missingNetworkIndexes: 0,
      openRiskReviews: 0,
      reservedMissionClaims: 0,
      staleNetworkIndexes: 0,
      stuckGameSessions: 0,
      totalAccounts: 0,
    };
  }
  return {
    createdAt: Number(row.created_at),
    id: row.id,
    metrics,
    status:
      row.status === "critical" || row.status === "attention"
        ? row.status
        : "stable",
  };
}

export async function readOperationalHealth(
  db: D1Database,
  now: number,
): Promise<OperationalHealthReport> {
  await ensureOperationsSchema(db);
  const reservedBefore = now - 30 * MINUTE_MS;
  const retentionBefore = now - 30 * DAY_MS;
  const [
    states,
    network,
    stuckSessions,
    reservedClaims,
    riskReviews,
    expiredPower,
    checkpointRows,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS total_accounts,
                COALESCE(SUM(CASE WHEN json_valid(state_json) = 0 THEN 1 ELSE 0 END), 0)
                  AS invalid_state_rows
         FROM game_states`,
      )
      .first<StateIntegrityRow>(),
    db
      .prepare(
        `WITH recent_states AS (
           SELECT account_id, state_json
           FROM game_states
           ORDER BY updated_at DESC
           LIMIT ?
         ), missing_indexes AS (
           SELECT COUNT(*) AS total
           FROM game_states AS all_states
           LEFT JOIN account_network_power AS all_network
             ON all_network.account_id = all_states.account_id
           WHERE all_network.account_id IS NULL
         )
         SELECT
           COALESCE((SELECT total FROM missing_indexes), 0)
             AS missing_network_indexes,
           COALESCE(SUM(CASE WHEN network.account_id IS NOT NULL
                              AND json_valid(states.state_json) = 1
                              AND (
                                network.allocation_cma <> COALESCE(
                                  CAST(json_extract(states.state_json,
                                    '$.poolAllocations.cma') AS INTEGER), 100)
                                OR network.allocation_btc <> COALESCE(
                                  CAST(json_extract(states.state_json,
                                    '$.poolAllocations.btc') AS INTEGER), 0)
                                OR network.allocation_doge <> COALESCE(
                                  CAST(json_extract(states.state_json,
                                    '$.poolAllocations.doge') AS INTEGER), 0)
                                OR network.allocation_ltc <> COALESCE(
                                  CAST(json_extract(states.state_json,
                                    '$.poolAllocations.ltc') AS INTEGER), 0)
                                OR network.energy_expires_at <> COALESCE(
                                  CAST(json_extract(states.state_json,
                                    '$.energyExpiresAt') AS INTEGER), 0)
                              )
                             THEN 1 ELSE 0 END), 0)
             AS stale_network_indexes
         FROM recent_states AS states
         LEFT JOIN account_network_power AS network
           ON network.account_id = states.account_id`,
      )
      .bind(NETWORK_HEALTH_SAMPLE_SIZE)
      .first<NetworkIntegrityRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM game_sessions
         WHERE status = 'active' AND expires_at < ?`,
      )
      .bind(now)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM daily_mission_claims
         WHERE status = 'reserved' AND created_at < ?`,
      )
      .bind(reservedBefore)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM game_sessions AS sessions
         LEFT JOIN admin_session_reviews AS reviews
           ON reviews.session_id = sessions.id
         WHERE sessions.risk_level <> 'normal'
           AND reviews.session_id IS NULL`,
      )
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM temporary_power_grants
         WHERE expires_at < ?`,
      )
      .bind(retentionBefore)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT id, status, metrics_json, created_at
         FROM operational_checkpoints
         ORDER BY created_at DESC
         LIMIT 8`,
      )
      .all<CheckpointRow>(),
  ]);
  const checkpoints = (checkpointRows.results ?? []).map(parseCheckpoint);
  const metrics: OperationalMetrics = {
    expiredPowerBacklog: Number(expiredPower?.total ?? 0),
    invalidStateRows: Number(states?.invalid_state_rows ?? 0),
    latestCheckpointAt: checkpoints[0]?.createdAt ?? null,
    missingNetworkIndexes: Number(network?.missing_network_indexes ?? 0),
    openRiskReviews: Number(riskReviews?.total ?? 0),
    reservedMissionClaims: Number(reservedClaims?.total ?? 0),
    staleNetworkIndexes: Number(network?.stale_network_indexes ?? 0),
    stuckGameSessions: Number(stuckSessions?.total ?? 0),
    totalAccounts: Number(states?.total_accounts ?? 0),
  };
  const evaluation = evaluateOperationalHealth(metrics, now);
  return {
    checkedAt: now,
    checkpoints,
    findings: evaluation.findings,
    metrics,
    runbook: buildIncidentRunbook(metrics),
    status: evaluation.status,
  };
}

export async function createOperationalCheckpoint(
  db: D1Database,
  actorAccountId: string,
  now: number,
) {
  const report = await readOperationalHealth(db, now);
  const metrics = { ...report.metrics, latestCheckpointAt: now };
  const evaluation = evaluateOperationalHealth(metrics, now);
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO operational_checkpoints (
        id, actor_account_id, status, metrics_json, findings_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      actorAccountId,
      evaluation.status,
      JSON.stringify(metrics),
      JSON.stringify(evaluation.findings),
      now,
    )
    .run();
  return { id, status: evaluation.status };
}
