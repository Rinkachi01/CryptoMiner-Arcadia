import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateSeasonScore,
  compareSeasonSnapshots,
  normalizeSeasonDurationDays,
  seasonLevelForXp,
  seasonProgressPercent,
  seasonXpRequiredForLevel,
  SPACE_RACE_DURATION_DAYS,
  SPACE_RACE_LEVELS,
  SPACE_RACE_PREMIUM_PRICE_CMA,
  spaceRaceRewards,
} from "../app/season-rules.ts";

test("pontuação da temporada privilegia vitória e dificuldade validada", () => {
  assert.equal(
    calculateSeasonScore({ highestDifficulty: 4, plays: 5, wins: 3 }),
    450,
  );
  assert.equal(
    calculateSeasonScore({ highestDifficulty: 2, plays: 20, wins: 0 }) <
      calculateSeasonScore({ highestDifficulty: 5, plays: 5, wins: 4 }),
    true,
  );
});

test("comparação econômica usa o primeiro e o último snapshot", () => {
  const comparison = compareSeasonSnapshots([
    {
      createdAt: 3_000,
      metrics: {
        activePlayers24h: 8,
        games24h: 30,
        powerGranted24h: 900,
        totalPlayers: 14,
      },
    },
    {
      createdAt: 1_000,
      metrics: {
        activePlayers24h: 3,
        games24h: 10,
        powerGranted24h: 200,
        totalPlayers: 5,
      },
    },
  ]);
  assert.deepEqual(comparison, {
    activePlayers24hDelta: 5,
    fromAt: 1_000,
    games24hDelta: 20,
    powerGranted24hDelta: 700,
    toAt: 3_000,
    totalPlayersDelta: 9,
  });
  assert.equal(compareSeasonSnapshots([]), null);
});

test("progresso e duração da temporada respeitam limites seguros", () => {
  assert.equal(seasonProgressPercent(1_000, 2_000, 1_500), 50);
  assert.equal(seasonProgressPercent(1_000, 2_000, 500), 0);
  assert.equal(seasonProgressPercent(1_000, 2_000, 3_000), 100);
  assert.equal(normalizeSeasonDurationDays(2), 7);
  assert.equal(normalizeSeasonDurationDays(120), 120);
});

test("Corrida Espacial tem 120 dias, 50 níveis e folga de XP", () => {
  assert.equal(SPACE_RACE_DURATION_DAYS, 120);
  assert.equal(SPACE_RACE_LEVELS, 50);
  assert.equal(SPACE_RACE_PREMIUM_PRICE_CMA, 29);
  assert.equal(seasonXpRequiredForLevel(50), 12_250);
  assert.equal(seasonLevelForXp(12_249), 49);
  assert.equal(seasonLevelForXp(12_250), 50);
  assert.equal(spaceRaceRewards.some((item) => item.track === "free"), true);
  assert.equal(spaceRaceRewards.some((item) => item.track === "premium"), true);
  assert.equal(
    spaceRaceRewards.filter((item) => item.reward.type === "miner").length,
    8,
  );
});

test("temporadas e snapshots são persistentes e administrados pelo proprietário", async () => {
  const [server, adminRoute, dashboard, migration] = await Promise.all([
    readFile(new URL("../app/season-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0007_panoramic_natasha_romanoff.sql", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(migration, /CREATE TABLE `seasons`/);
  assert.match(migration, /CREATE TABLE `season_snapshots`/);
  assert.match(server, /status IN \('completed', 'failed'\)/);
  assert.match(adminRoute, /season_snapshot_created/);
  assert.match(adminRoute, /season_closed/);
  assert.match(adminRoute, /activate-space-race/);
  assert.match(dashboard, /ATIVAR CORRIDA ESPACIAL/);
  assert.match(server, /readSeasonEconomicReport/);
  assert.match(server, /readyForEconomyReview/);
  assert.match(dashboard, /RELATÓRIO ECONÔMICO DO CICLO/);
  assert.match(dashboard, /MANTER ECONOMIA ATUAL/);
  assert.match(dashboard, /Nenhum preço ou valor de bloco é alterado/);
});

test("temporada não promete saque ou retorno financeiro", async () => {
  const [api, panel] = await Promise.all([
    readFile(new URL("../app/api/season/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SeasonPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(api, /sem prêmio em CMA, saque ou vantagem financeira/i);
  assert.match(panel, /RANKING DE OPERADORES/i);
  assert.match(panel, /durationDays/);
  assert.match(panel, /Giveaways semanais/i);
  assert.doesNotMatch(panel, /ROI|rendimento|retorno garantido/i);
});
