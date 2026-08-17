import { ensureTaskPreferenceSchema } from "./task-preferences.ts";
import { STARTER_KIT_VERSION } from "./onboarding-rules.ts";
import { ensureBetaDeviceSchema } from "./beta-device-server.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_DAYS = 7;
const COHORT_COUNT = 4;
const SOURCE_DAYS = 35;
const PROOF_RETENTION_DAYS = 30;
const ARCHIVED_PROOF = JSON.stringify({ archived: true, version: 1 });
// Observability is a diagnostic view, not a full database export. Keep its
// working set deliberately small so a busy server cannot exhaust Worker RAM.
const OBS_ACCOUNT_LIMIT = 500;
const OBS_ACTIVITY_LIMIT = 1_000;
const OBS_PROOF_LIMIT = 500;
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
  game_id: string;
};

type PreferenceCountRow = {
  partner_tasks_mode: string;
  total: number;
};

type CountRow = {
  total: number;
};

type DeviceProfileRow = {
  account_id: string;
  first_input_mode: string;
  first_viewport: string;
  text_scale: string;
};

type AccessibilityReviewRow = {
  controls_easy: number;
  input_mode: string;
  motion_comfortable: number;
  rack_clear: number;
  text_readable: number;
  viewport_bucket: string;
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
  const arcadeGamesByAccount = new Map<string, Set<string>>();
  for (const row of sessions) {
    if (!starterAccounts.has(row.account_id)) continue;
    const games = arcadeGamesByAccount.get(row.account_id) ?? new Set<string>();
    games.add(row.game_id);
    arcadeGamesByAccount.set(row.account_id, games);
  }
  const arcadeRecordedAccounts = new Set(
    [...arcadeGamesByAccount.entries()]
      .filter(([, games]) => games.size >= 3)
      .map(([accountId]) => accountId),
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

export function buildDeviceOnboardingBreakdown(
  accounts: StateRow[],
  ledger: OnboardingLedgerRow[],
  sessions: OnboardingSessionRow[],
  profiles: DeviceProfileRow[],
  now: number,
) {
  const profileByAccount = new Map(
    profiles.map((profile) => [profile.account_id, profile]),
  );
  const fullFunnel = buildOnboardingFunnel(accounts, ledger, sessions, now);
  const starterAccounts = new Set(
    ledger
      .filter(
        (row) =>
          row.action === "starter_kit_granted" &&
          starterKitVersion(row.metadata_json) === STARTER_KIT_VERSION,
      )
      .map((row) => row.account_id),
  );
  const profiled = [...starterAccounts].filter((accountId) =>
    profileByAccount.has(accountId),
  ).length;

  const groupBy = (
    dimension: "first_viewport" | "first_input_mode",
    groups: Array<{ id: string; label: string }>,
  ) =>
    groups.map((group) => {
      const ids = new Set(
        accounts
          .filter((account) => {
            const profile = profileByAccount.get(account.account_id);
            return group.id === "unclassified"
              ? !profile
              : profile?.[dimension] === group.id;
          })
          .map((account) => account.account_id),
      );
      const funnel = buildOnboardingFunnel(
        accounts.filter((account) => ids.has(account.account_id)),
        ledger.filter((row) => ids.has(row.account_id)),
        sessions.filter((row) => ids.has(row.account_id)),
        now,
      );
      return {
        ...group,
        totalStarted: funnel.totalStarted,
        stages: funnel.stages,
      };
    });

  return {
    coverage: {
      percent: percent(profiled, fullFunnel.totalStarted),
      profiled,
      total: fullFunnel.totalStarted,
    },
    inputModes: groupBy("first_input_mode", [
      { id: "touch", label: "Toque" },
      { id: "pointer", label: "Mouse/ponteiro" },
      { id: "hybrid", label: "Híbrido" },
      { id: "unclassified", label: "Sem perfil" },
    ]),
    viewports: groupBy("first_viewport", [
      { id: "small", label: "Tela pequena" },
      { id: "medium", label: "Tela média" },
      { id: "large", label: "Tela grande" },
      { id: "unclassified", label: "Sem perfil" },
    ]),
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
  await Promise.all([
    ensureTaskPreferenceSchema(db),
    ensureBetaDeviceSchema(db),
  ]);
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
    deviceProfileRows,
    accessibilityReviewRows,
    totalAccounts,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT account_id, created_at, updated_at,
                substr(state_json, 1, 16384) AS state_json
         FROM game_states
         WHERE created_at >= ? OR updated_at >= ?
         ORDER BY created_at DESC
         LIMIT ${OBS_ACCOUNT_LIMIT}`,
      )
      .bind(since, since)
      .all<StateRow>(),
    db
      .prepare(
        `SELECT account_id, action, created_at
         FROM ledger_entries
         WHERE created_at >= ?
         ORDER BY created_at DESC
         LIMIT ${OBS_ACTIVITY_LIMIT}`,
      )
      .bind(since)
      .all<LedgerActivityRow>(),
    db
      .prepare(
        `SELECT account_id, started_at
         FROM game_sessions
         WHERE started_at >= ? AND status IN ('completed', 'failed')
         ORDER BY started_at DESC
         LIMIT ${OBS_ACTIVITY_LIMIT}`,
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
         AND created_at >= ?
         ORDER BY created_at DESC
         LIMIT ${OBS_PROOF_LIMIT}`,
      )
      .bind(since)
      .all<OnboardingLedgerRow>(),
    db
      .prepare(
        `SELECT DISTINCT account_id, game_id
         FROM game_sessions
         WHERE status IN ('completed', 'failed')
           AND started_at >= ?
         LIMIT ${OBS_PROOF_LIMIT}`,
      )
      .bind(since)
      .all<OnboardingSessionRow>(),
    db
      .prepare(
        `SELECT account_id, first_viewport, first_input_mode, text_scale
         FROM beta_device_profiles
         LIMIT ${OBS_PROOF_LIMIT}`,
      )
      .all<DeviceProfileRow>(),
    db
      .prepare(
        `SELECT viewport_bucket, input_mode, text_readable, controls_easy,
                motion_comfortable, rack_clear
         FROM beta_accessibility_reviews
         WHERE created_at >= ?
         ORDER BY created_at DESC
           LIMIT ${OBS_PROOF_LIMIT}`,
      )
      .bind(now - 30 * DAY_MS)
      .all<AccessibilityReviewRow>(),
    db.prepare("SELECT COUNT(*) AS total FROM game_states").first<CountRow>(),
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
  const deviceProfiles = deviceProfileRows.results ?? [];
  const accessibilityReviews = accessibilityReviewRows.results ?? [];
  const accessibilityRate = (key: keyof Pick<
    AccessibilityReviewRow,
    "controls_easy" | "motion_comfortable" | "rack_clear" | "text_readable"
  >) =>
    percent(
      accessibilityReviews.filter((review) => Number(review[key]) === 1)
        .length,
      accessibilityReviews.length,
    );

  return {
    accessibility: {
      controlsEasyRate: accessibilityRate("controls_easy"),
      largeTextProfiles: deviceProfiles.filter(
        (profile) => profile.text_scale !== "comfortable",
      ).length,
      motionComfortableRate: accessibilityRate("motion_comfortable"),
      rackClearRate: accessibilityRate("rack_clear"),
      reviews30d: accessibilityReviews.length,
      textReadableRate: accessibilityRate("text_readable"),
      touchReviews: accessibilityReviews.filter(
        (review) =>
          review.input_mode === "touch" || review.input_mode === "hybrid",
      ).length,
    },
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
    deviceFunnel: buildDeviceOnboardingBreakdown(
      accounts,
      onboardingLedgerRows.results ?? [],
      onboardingSessionRows.results ?? [],
      deviceProfiles,
      now,
    ),
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
        Number(totalAccounts?.total ?? accounts.length) -
          preferenceCounts.ask -
          preferenceCounts.disabled,
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
      totalPlayers: Number(totalAccounts?.total ?? accounts.length),
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
