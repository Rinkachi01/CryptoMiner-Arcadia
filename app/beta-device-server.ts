export type ViewportBucket = "small" | "medium" | "large";
export type InputMode = "touch" | "pointer" | "hybrid";
export type BetaTextScale = "comfortable" | "large" | "extra";

export type BetaDeviceProfile = {
  createdAt: number;
  currentInputMode: InputMode;
  currentViewport: ViewportBucket;
  firstInputMode: InputMode;
  firstViewport: ViewportBucket;
  onboardingStage: number;
  textScale: BetaTextScale;
  updatedAt: number;
};

export type AccessibilityAnswers = {
  controlsEasy: boolean;
  motionComfortable: boolean;
  rackClear: boolean;
  textReadable: boolean;
};

export type AccessibilityReview = AccessibilityAnswers & {
  createdAt: number;
  id: string;
  inputMode: InputMode;
  notes: string;
  textScale: BetaTextScale;
  viewport: ViewportBucket;
};

type ProfileRow = {
  created_at: number;
  current_input_mode: string;
  current_viewport: string;
  first_input_mode: string;
  first_viewport: string;
  onboarding_stage: number;
  text_scale: string;
  updated_at: number;
};

type ReviewRow = {
  controls_easy: number;
  created_at: number;
  id: string;
  input_mode: string;
  motion_comfortable: number;
  notes: string;
  rack_clear: number;
  text_readable: number;
  text_scale: string;
  viewport_bucket: string;
};

export function isViewportBucket(value: unknown): value is ViewportBucket {
  return value === "small" || value === "medium" || value === "large";
}

export function isInputMode(value: unknown): value is InputMode {
  return value === "touch" || value === "pointer" || value === "hybrid";
}

export function isBetaTextScale(value: unknown): value is BetaTextScale {
  return value === "comfortable" || value === "large" || value === "extra";
}

function profileFromRow(row: ProfileRow): BetaDeviceProfile {
  return {
    createdAt: Number(row.created_at),
    currentInputMode: isInputMode(row.current_input_mode)
      ? row.current_input_mode
      : "pointer",
    currentViewport: isViewportBucket(row.current_viewport)
      ? row.current_viewport
      : "large",
    firstInputMode: isInputMode(row.first_input_mode)
      ? row.first_input_mode
      : "pointer",
    firstViewport: isViewportBucket(row.first_viewport)
      ? row.first_viewport
      : "large",
    onboardingStage: Math.min(6, Math.max(0, Number(row.onboarding_stage))),
    textScale: isBetaTextScale(row.text_scale)
      ? row.text_scale
      : "comfortable",
    updatedAt: Number(row.updated_at),
  };
}

function reviewFromRow(row: ReviewRow): AccessibilityReview {
  return {
    controlsEasy: row.controls_easy === 1,
    createdAt: Number(row.created_at),
    id: row.id,
    inputMode: isInputMode(row.input_mode) ? row.input_mode : "pointer",
    motionComfortable: row.motion_comfortable === 1,
    notes: row.notes,
    rackClear: row.rack_clear === 1,
    textReadable: row.text_readable === 1,
    textScale: isBetaTextScale(row.text_scale)
      ? row.text_scale
      : "comfortable",
    viewport: isViewportBucket(row.viewport_bucket)
      ? row.viewport_bucket
      : "large",
  };
}

export async function ensureBetaDeviceSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS beta_device_profiles (
        account_id TEXT PRIMARY KEY NOT NULL,
        first_viewport TEXT NOT NULL,
        current_viewport TEXT NOT NULL,
        first_input_mode TEXT NOT NULL,
        current_input_mode TEXT NOT NULL,
        text_scale TEXT DEFAULT 'comfortable' NOT NULL,
        onboarding_stage INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS beta_accessibility_reviews (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        window_key TEXT NOT NULL,
        viewport_bucket TEXT NOT NULL,
        input_mode TEXT NOT NULL,
        text_scale TEXT DEFAULT 'comfortable' NOT NULL,
        text_readable INTEGER NOT NULL,
        controls_easy INTEGER NOT NULL,
        motion_comfortable INTEGER NOT NULL,
        rack_clear INTEGER NOT NULL,
        notes TEXT DEFAULT '' NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS beta_accessibility_account_window_unique
       ON beta_accessibility_reviews (account_id, window_key)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS beta_accessibility_created_at_idx
       ON beta_accessibility_reviews (created_at)`,
    ),
  ]);
}

export async function recordBetaDeviceProfile(
  db: D1Database,
  accountId: string,
  input: {
    inputMode: InputMode;
    onboardingStage: number;
    textScale: BetaTextScale;
    viewport: ViewportBucket;
  },
  now: number,
) {
  await ensureBetaDeviceSchema(db);
  const onboardingStage = Math.min(
    6,
    Math.max(0, Math.floor(input.onboardingStage)),
  );
  await db
    .prepare(
      `INSERT INTO beta_device_profiles (
        account_id, first_viewport, current_viewport,
        first_input_mode, current_input_mode, text_scale,
        onboarding_stage, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        current_viewport = excluded.current_viewport,
        current_input_mode = excluded.current_input_mode,
        text_scale = excluded.text_scale,
        onboarding_stage = MAX(
          beta_device_profiles.onboarding_stage,
          excluded.onboarding_stage
        ),
        updated_at = excluded.updated_at`,
    )
    .bind(
      accountId,
      input.viewport,
      input.viewport,
      input.inputMode,
      input.inputMode,
      input.textScale,
      onboardingStage,
      now,
      now,
    )
    .run();
  return readPersonalBetaDevice(db, accountId);
}

function utcWindowKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

export async function saveAccessibilityReview(
  db: D1Database,
  accountId: string,
  input: {
    answers: AccessibilityAnswers;
    inputMode: InputMode;
    notes: string;
    textScale: BetaTextScale;
    viewport: ViewportBucket;
  },
  now: number,
) {
  await ensureBetaDeviceSchema(db);
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO beta_accessibility_reviews (
        id, account_id, window_key, viewport_bucket, input_mode, text_scale,
        text_readable, controls_easy, motion_comfortable, rack_clear,
        notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, window_key) DO UPDATE SET
        viewport_bucket = excluded.viewport_bucket,
        input_mode = excluded.input_mode,
        text_scale = excluded.text_scale,
        text_readable = excluded.text_readable,
        controls_easy = excluded.controls_easy,
        motion_comfortable = excluded.motion_comfortable,
        rack_clear = excluded.rack_clear,
        notes = excluded.notes,
        created_at = excluded.created_at`,
    )
    .bind(
      id,
      accountId,
      utcWindowKey(now),
      input.viewport,
      input.inputMode,
      input.textScale,
      input.answers.textReadable ? 1 : 0,
      input.answers.controlsEasy ? 1 : 0,
      input.answers.motionComfortable ? 1 : 0,
      input.answers.rackClear ? 1 : 0,
      input.notes,
      now,
    )
    .run();
  return readPersonalBetaDevice(db, accountId);
}

export async function readPersonalBetaDevice(
  db: D1Database,
  accountId: string,
) {
  await ensureBetaDeviceSchema(db);
  const [profile, review] = await Promise.all([
    db
      .prepare(
        `SELECT first_viewport, current_viewport, first_input_mode,
                current_input_mode, text_scale, onboarding_stage,
                created_at, updated_at
         FROM beta_device_profiles
         WHERE account_id = ?`,
      )
      .bind(accountId)
      .first<ProfileRow>(),
    db
      .prepare(
        `SELECT id, viewport_bucket, input_mode, text_scale,
                text_readable, controls_easy, motion_comfortable,
                rack_clear, notes, created_at
         FROM beta_accessibility_reviews
         WHERE account_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(accountId)
      .first<ReviewRow>(),
  ]);
  return {
    profile: profile ? profileFromRow(profile) : null,
    review: review ? reviewFromRow(review) : null,
  };
}
