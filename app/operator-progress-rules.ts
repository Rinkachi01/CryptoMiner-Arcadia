export type OperatorProgress = {
  level: number;
  rank: string;
  league: {
    name: string;
    nextName: string | null;
    currentXp: number;
    targetXp: number;
    progressPercent: number;
  };
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
};

const operatorLeagues = [
  { name: "Recruta", minimumLevel: 1 },
  { name: "Bronze III", minimumLevel: 3 },
  { name: "Bronze II", minimumLevel: 5 },
  { name: "Bronze I", minimumLevel: 7 },
  { name: "Prata III", minimumLevel: 10 },
  { name: "Prata II", minimumLevel: 13 },
  { name: "Prata I", minimumLevel: 16 },
  { name: "Ouro III", minimumLevel: 20 },
  { name: "Ouro II", minimumLevel: 25 },
  { name: "Ouro I", minimumLevel: 31 },
  { name: "Platina", minimumLevel: 38 },
  { name: "Diamante", minimumLevel: 45 },
] as const;

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

export function calculateOperatorLeague(level: number, xp: number) {
  const safeLevel = Math.max(1, Math.floor(level));
  const leagueIndex = operatorLeagues.findLastIndex(
    (league) => safeLevel >= league.minimumLevel,
  );
  const league = operatorLeagues[Math.max(0, leagueIndex)];
  const nextLeague = operatorLeagues[leagueIndex + 1] ?? null;
  const currentXp = xpRequiredForLevel(league.minimumLevel);
  const targetXp = nextLeague
    ? xpRequiredForLevel(nextLeague.minimumLevel)
    : currentXp;
  const progressPercent = nextLeague
    ? Math.min(
        100,
        Math.max(
          0,
          Math.floor(
            ((xp - currentXp) / Math.max(1, targetXp - currentXp)) * 100,
          ),
        ),
      )
    : 100;

  return {
    name: league.name,
    nextName: nextLeague?.name ?? null,
    currentXp,
    targetXp,
    progressPercent,
  };
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
    league: calculateOperatorLeague(level, xp),
    xp,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
  };
}
