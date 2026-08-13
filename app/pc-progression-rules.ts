const PC_PLAY_THRESHOLDS = [0, 10, 30, 60, 100, 150] as const;

export function pcLevelForPlays(totalPlays: number): number {
  const plays = Math.max(0, Math.floor(Number.isFinite(totalPlays) ? totalPlays : 0));
  let level = 0;
  for (let index = 1; index < PC_PLAY_THRESHOLDS.length; index += 1) {
    if (plays < PC_PLAY_THRESHOLDS[index]) break;
    level = index;
  }
  return level;
}

export function pcNextPlayTarget(level: number): number {
  const safeLevel = Math.max(0, Math.min(PC_PLAY_THRESHOLDS.length - 1, Math.floor(level)));
  return PC_PLAY_THRESHOLDS[safeLevel];
}

export function pcProgressPercent(totalPlays: number, level: number): number {
  const safeLevel = Math.max(0, Math.min(PC_PLAY_THRESHOLDS.length - 1, Math.floor(level)));
  if (safeLevel >= PC_PLAY_THRESHOLDS.length - 1) return 100;
  const start = PC_PLAY_THRESHOLDS[safeLevel];
  const end = PC_PLAY_THRESHOLDS[safeLevel + 1];
  const plays = Math.max(0, Math.floor(Number.isFinite(totalPlays) ? totalPlays : 0));
  return Math.max(0, Math.min(100, Math.round(((plays - start) / (end - start)) * 100)));
}

export const PC_PLAY_THRESHOLDS_EXPORT = PC_PLAY_THRESHOLDS;
