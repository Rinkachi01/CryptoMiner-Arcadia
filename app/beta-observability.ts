import { ensureTaskPreferenceSchema } from "./task-preferences.ts";
import { STARTER_KIT_VERSION } from "./onboarding-rules.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_DAYS = 7;
const COHORT_COUNT = 4;
const SOURCE_DAYS = 35;
const PROOF_RETENTION_DAYS = 30;
const ARCHIVED_PROOF = JSON.stringify({ archived: true, version: 1 });
const energyActions = new Set([
  "claim_energy",
  "daily_mission_battery",
  "use_battery",
]);

type StateRow = {
  account_id: string;
  created_at: number;
  state_json: string;
  updated_at: number;
};

type LedgerActivityRow = {
  account_id: string;
  action: string;
  created_at: number;
};

type OnboardingLedgerRow = LedgerActivityRow & {
  metadata_json: string;
};

type SessionActivityRow = {
  account_id: string;
  started_at: number;
};

type OnboardingSessionRow = {
  account_id: string;
};

type PreferenceCountRow = {
  partner_tasks_mode: string;
  total: number;
};

type CountRow = {
  total: number;
};

type ActivityEvent = {
  accountId: string;
  at: number;
  kind: "arcade" | "energy" | "other";
};

function indexEvents(events: ActivityEvent[]) {
  const indexed = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const accountEvents = indexed.get(event.accountId) ?? [];
    accountEvents.push(event);
    indexed.set(event.accountId, accountEvents);
  }
  return indexed;
}

export type RetentionCohort = {
  arcade7d: number;
  energy7d: number;
  endAt: number;
  measurementComplete: boolean;
  returned7d: number;
  signups: number;
  startAt: number;
};

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function positiveBlockReward(metadataJson: string) {
  try {
    const metadata = JSON.parse(metadataJson) as {
      rewards?: Record<string, unknown>;
    };
    return ["cma", "btc", "doge"].some(
      (symbol) => Number(metadata.rewards?.[symbol] ?? 0) > 0,
    );
  } catch {
    return false;
  }
}

function starterKitVersion(metadataJson: string) {
  try {
    const metadata = JSON.parse(metadataJson) as { version?: unknown };
    return typeof metadata.version === "string" ? metadata.version : null;
  } catch {
    return null;
  }
}

export function buildOnboardingFunnel(
  accounts: StateRow[],
  ledger: OnboardingLedgerRow[],
  sessions: OnboardingSessionRow[],
  now: number,
) {
  const starterEvents = ledger.filter(
    (row) =>
      row.action === "starter_kit_granted" &&
      starterKitVersion(row.metadata_json) === STARTER_KIT_VERSION,
  );
  const starterAccounts = new Set(
    starterEvents.map((row) => row.account_id),
  );
  const actionAccounts = (action: string) =>
    new Set(
      ledger
        .filter(
          (row) =>
            row.action === action && starterAccounts.has(row.account_id),
        )
        .map((row) => row.account_id),
    );
  const installedAccounts = actionAccounts("install_miner");
  for (const account of accounts) {
    if (!starterAccounts.has(account.account_id)) continue;
    try {
      const state = JSON.parse(account.state_json) as {
        rackMiners?: Record<string, unknown[]>;
      };
      if (
        Object.values(state.rackMiners ?? {}).some(
          (placements) => placements.length > 0,
        )
      ) {
        installedAccounts.add(account.account_id);
      }
    } catch {
      // O funil ignora estados antigos malformados.
    }
  }
  const arcadeRecordedAccounts = new Set(
    sessions
      .filter((row) => starterAccounts.has(row.account_id))
      .map((row) => row.account_id),
  );
  const arcadeAccounts = new Set(
    [...arcadeRecordedAccounts].filter((accountId) =>
      installedAccounts.has(accountId),
    ),
  );
  const energyRecordedAccounts = new Set([
    ...actionAccounts("use_battery"),
    ...actionAccounts("claim_energy"),
  ]);
  const energyAccounts = new Set(
    [...energyRecordedAccounts].filter((accountId) =>
      arcadeAccounts.has(accountId),
    ),
  );
  const poolsRecordedAccounts = actionAccounts("apply_allocations");
  const poolsAccounts = new Set(
    [...poolsRecordedAccounts].filter((accountId) =>
      energyAccounts.has(accountId),
    ),
  );
  const blockRecordedAccounts = new Set(
    ledger
      .filter(
        (row) =>
          row.action === "block_settlement" &&
          starterAccounts.has(row.account_id) &&
          positiveBlockReward(row.metadata_json),
      )
      .map((row) => row.account_id),
  );
  const blockAccounts = new Set(
    [...blockRecordedAccounts].filter((accountId) =>
      poolsAccounts.has(accountId),
    ),
  );
  const counts = [
    starterAccounts.size,
    installedAccounts.size,
    arcadeAccounts.size,
    energyAccounts.size,
    poolsAccounts.size,
    blockAccounts.size,
  ];
  const labels = [
    "Kit entregue",
    "Minerador instalado",
    "Arcade concluído",
    "Energia ativada",
    "Pool confirmada",
    "Primeiro bloco",
  ];
  return {
    started7d: new Set(
      starterEvents
        .filter((row) => row.created_at >= now - COHORT_DAYS * DAY_MS)
        .map((row) => row.account_id),
    ).size,
    totalStarted: starterAccounts.size,
    stages: counts.map((accountsAtStage, index) => ({
      id: ["kit", "miner", "arcade", "energy", "pools", "block"][index],
      label: labels[index],
      accounts: accountsAtStage,
      conversionFromStart: percent(accountsAtStage, counts[0]),
      dropoffFromPrevious:
        index === 0
          ? 0
          : Math.max(0, counts[index - 1] - accountsAtStage),
    })),
  };
}

function behaviorComparison(
  accounts: StateRow[],
  eventsByAccount: Map<string, ActivityEvent[]>,
  now: number,
  kind: "arcade" | "energy",
) {
  const eligible = accounts.filter(
    (account) =>
      account.created_at >= now - SOURCE_DAYS * DAY_MS &&
      account.created_at <= now - COHORT_DAYS * DAY_MS,
  );
  let exposed = 0;
  let exposedReturned = 0;
  let unexposed = 0;
  let unexposedReturned = 0;

  for (const account of eligible) {
    const accountEvents = eventsByAccount.get(account.account_id) ?? [];
    const firstDayEnd = account.created_at + DAY_MS;
    const returnEnd = account.created_at + COHORT_DAYS * DAY_MS;
    const usedFeature = accountEvents.some(
      (event) =>
        event.kind === kind &&
        event.at >= account.created_at &&
        event.at < firstDayEnd,
    );
    const returned = accountEvents.some(
      (event) => event.at >= firstDayEnd && event.at <= returnEnd,
    );
    if (usedFeature) {
      exposed += 1;
      if (returned) exposedReturned += 1;
    } else {
      unexposed += 1;
      if (returned) unexposedReturned += 1;
    }
  }

  const exposedRate = percent(exposedReturned, exposed);
  const unexposedRate = percent(unexposedReturned, unexposed);
  return {
    deltaPercentagePoints: exposedRate - unexposedRate,
    exposed,
    exposedRate,
    reliable: exposed >= 5 && unexposed >= 5,
    unexposed,
    unexposedRate,
  };
}

export function buildRetentionCohorts(
  accounts: StateRow[],
  events: ActivityEvent[],
  now: number,
): RetentionCohort[] {
  const eventsByAccount = indexEvents(events);
  return Array.from({ length: COHORT_COUNT }, (_, index) => {
    const endAt = now - index * COHORT_DAYS * DAY_MS;
    const startAt = endAt - COHORT_DAYS * DAY_MS;
    const cohortAccounts = accounts.filter(
      (account) =>
        account.created_at >= startAt && account.created_at < endAt,
    );
    let returned7d = 0;
    let arcade7d = 0;
    let energy7d = 0;
    for (const account of cohortAccounts) {
      const accountEvents = eventsByAccount.get(account.account_id) ?? [];
      const firstDayEnd = account.created_at + DAY_MS;
      const seventhDayEnd = account.created_at + COHORT_DAYS * DAY_MS;
      if (
        accountEvents.some(
          (event) => event.at >= firstDayEnd && event.at <= seventhDayEnd,
        )
      ) {
        returned7d += 1;
      }
      if (
        accountEvents.some(
          (event) =>
            event.kind === "arcade" &&
            event.at >= account.created_at &&
            event.at <= seventhDayEnd,
        )
      ) {
        arcade7d += 1;
      }
      if (
        accountEvents.some(
          (event) =>
            event.kind === "energy" &&
            event.at >= account.created_at &&
            event.at <= seventhDayEnd,
        )
      ) {
        energy7d += 1;
      }
    }
    return {
      arcade7d,
      energy7d,
      endAt,
      measurementComplete: endAt <= now - COHORT_DAYS * DAY_MS,
      returned7d,
      signups: cohortAccounts.length,
      startAt,
    };
  });
}

export async function ensureBetaObservabilitySchema(db: D1Database) {
  await ensureTaskPreferenceSchema(db);
}

export async function readBetaObservability(
  db: D1Database,
  now: number,
) {
  await ensureBetaObservabilitySchema(db);
  const since = now - SOURCE_DAYS * DAY_MS;
  const since7d = now - COHORT_DAYS * DAY_MS;
  const proofCutoff = now - PROOF_RETENTION_DAYS * DAY_MS;
  const [
    accountRows,
    ledgerRows,
    sessionRows,
    preferenceRows,
    eligibleProofs,
    archivedProofs,
    onboardingLedgerRows,
    onboardingSessionRows,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT account_id, created_at, updated_at, state_json
         FROM game_states
         ORDER BY created_at DESC
         LIMIT 10000`,
      )
      .all<StateRow>(),
    db
      .prepare(
        `SELECT account_id, action, created_at
         FROM ledger_entries
         WHERE created_at >= ?
         ORDER BY created_at DESC
         LIMIT 20000`,
      )
      .bind(since)
      .all<LedgerActivityRow>(),
    db
      .prepare(
        `SELECT account_id, started_at
         FROM game_sessions
         WHERE started_at >= ? AND status IN ('completed', 'failed')
         ORDER BY started_at DESC
         LIMIT 20000`,
      )
      .bind(since)
      .all<SessionActivityRow>(),
    db
      .prepare(
        `SELECT partner_tasks_mode, COUNT(*) AS total
         FROM task_preferences
         GROUP BY partner_tasks_mode`,
      )
      .all<PreferenceCountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM game_sessions
         WHERE completed_at < ?
           AND status IN ('completed', 'failed')
           AND risk_level = 'normal'
           AND proof_json NOT IN ('{}', ?)`,
      )
      .bind(proofCutoff, ARCHIVED_PROOF)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM game_sessions
         WHERE proof_json = ?`,
      )
      .bind(ARCHIVED_PROOF)
      .first<CountRow>(),
    db
      .prepare(
        `SELECT account_id, action, metadata_json, created_at
         FROM ledger_entries
         WHERE action IN (
           'starter_kit_granted',
           'install_miner',
           'use_battery',
           'claim_energy',
           'apply_allocations',
           'block_settlement'
         )
         ORDER BY created_at DESC
         LIMIT 50000`,
      )
      .all<OnboardingLedgerRow>(),
    db
      .prepare(
        `SELECT DISTINCT account_id
         FROM game_sessions
         WHERE status IN ('completed', 'failed')
         LIMIT 50000`,
      )
      .all<OnboardingSessionRow>(),
  ]);

  const accounts = accountRows.results ?? [];
  const ledger = ledgerRows.results ?? [];
  const sessions = sessionRows.results ?? [];
  const events: ActivityEvent[] = [
    ...accounts
      .filter((row) => row.updated_at >= since)
      .map((row) => ({
        accountId: row.account_id,
        at: Number(row.updated_at),
        kind: "other" as const,
      })),
    ...ledger.map((row) => ({
      accountId: row.account_id,
      at: Number(row.created_at),
      kind: energyActions.has(row.action)
        ? ("energy" as const)
        : ("other" as const),
    })),
    ...sessions.map((row) => ({
      accountId: row.account_id,
      at: Number(row.started_at),
      kind: "arcade" as const,
    })),
  ];
  const eventsByAccount = indexEvents(events);
  const activeAccounts = new Set(
    events.filter((event) => event.at >= since7d).map((event) => event.accountId),
  );
  const arcadeAccounts = new Set(
    sessions
      .filter((row) => row.started_at >= since7d)
      .map((row) => row.account_id),
  );
  const energyAccounts = new Set(
    ledger
      .filter(
        (row) => row.created_at >= since7d && energyActions.has(row.action),
      )
      .map((row) => row.account_id),
  );
  let expandedPlayers = 0;
  for (const account of accounts) {
    try {
      const state = JSON.parse(account.state_json) as {
        ownedRoomIds?: unknown[];
      };
      if (Array.isArray(state.ownedRoomIds) && state.ownedRoomIds.length > 1) {
        expandedPlayers += 1;
      }
    } catch {
      // Legacy malformed states are excluded from room adoption only.
    }
  }
  const preferenceCounts = (preferenceRows.results ?? []).reduce(
    (counts, row) => {
      if (row.partner_tasks_mode === "ask") counts.ask += Number(row.total);
      if (row.partner_tasks_mode === "disabled") {
        counts.disabled += Number(row.total);
      }
      return counts;
    },
    { ask: 0, disabled: 0 },
  );

  return {
    behaviorSignals: {
      arcade: behaviorComparison(accounts, eventsByAccount, now, "arcade"),
      energy: behaviorComparison(accounts, eventsByAccount, now, "energy"),
      notice:
        "Comparação observacional entre o primeiro dia e o retorno nos dias 2–7. Não demonstra causa.",
    },
    cohorts: buildRetentionCohorts(accounts, events, now),
    definitions: {
      active:
        "Conta com estado salvo, partida ou movimento registrado nos últimos 7 dias.",
      returned:
        "Conta criada antes da janela atual e com atividade nos últimos 7 dias.",
    },
    maintenance: {
      archivedProofs: Number(archivedProofs?.total ?? 0),
      eligibleProofs: Number(eligibleProofs?.total ?? 0),
      retentionDays: PROOF_RETENTION_DAYS,
    },
    onboarding: buildOnboardingFunnel(
      accounts,
      onboardingLedgerRows.results ?? [],
      onboardingSessionRows.results ?? [],
      now,
    ),
    preferences: {
      ...preferenceCounts,
      unset: Math.max(
        0,
        accounts.length - preferenceCounts.ask - preferenceCounts.disabled,
      ),
    },
    summary: {
      activePlayers7d: activeAccounts.size,
      arcadePlayers7d: arcadeAccounts.size,
      energyPlayers7d: energyAccounts.size,
      expandedPlayers,
      newPlayers7d: accounts.filter((row) => row.created_at >= since7d).length,
      returningPlayers7d: accounts.filter(
        (row) => row.created_at < since7d && activeAccounts.has(row.account_id),
      ).length,
      totalPlayers: accounts.length,
    },
    windowDays: COHORT_DAYS,
  };
}

export async function compactEligibleGameProofs(
  db: D1Database,
  now: number,
) {
  const cutoff = now - PROOF_RETENTION_DAYS * DAY_MS;
  const result = await db
    .prepare(
      `UPDATE game_sessions
       SET proof_json = ?
       WHERE completed_at < ?
         AND status IN ('completed', 'failed')
         AND risk_level = 'normal'
         AND proof_json NOT IN ('{}', ?)`,
    )
    .bind(ARCHIVED_PROOF, cutoff, ARCHIVED_PROOF)
    .run();
  return {
    compacted: Number(result.meta.changes ?? 0),
    retentionDays: PROOF_RETENTION_DAYS,
  };
}
