export type OperatorProgress = {
  level: number;
  rank: string;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
};

export function operatorXp(totalPlays: number, totalWins: number) {
  return Math.max(0, totalPlays) * 18 + Math.max(0, totalWins) * 120;
}

export function xpRequiredForLevel(level: number) {
  const safeLevel = Math.max(1, Math.floor(level));
  return (safeLevel - 1) * safeLevel * 90;
}

function operatorRank(level: number) {
  if (level >= 25) return "Arquiteto da Rede";
  if (level >= 18) return "Mestre de Operações";
  if (level >= 12) return "Especialista Arcadia";
  if (level >= 7) return "Técnico de Mineração";
  if (level >= 3) return "Operador de Campo";
  return "Recruta da Rede";
}

export function calculateOperatorProgress(
  totalPlays: number,
  totalWins: number,
): OperatorProgress {
  const xp = operatorXp(totalPlays, totalWins);
  let level = 1;
  while (level < 50 && xp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }
  const currentLevelXp = xpRequiredForLevel(level);
  const nextLevelXp = xpRequiredForLevel(level + 1);
  const progressPercent =
    level >= 50
      ? 100
      : Math.min(
          100,
          Math.floor(
            ((xp - currentLevelXp) /
              Math.max(1, nextLevelXp - currentLevelXp)) *
              100,
          ),
        );
  return {
    level,
    rank: operatorRank(level),
    xp,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
  };
}
