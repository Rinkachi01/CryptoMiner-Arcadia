import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateSeasonScore,
  ALCHEMY_SEASON_LEVELS,
  ALCHEMY_SEASON_PREMIUM_MAX_PRICE_CMA,
  ALCHEMY_SEASON_PREMIUM_PRICE_CMA,
  ALCHEMY_SEASON_SLUG,
  alchemyRewards,
  compareSeasonSnapshots,
  normalizeSeasonDurationDays,
  seasonLevelForXp,
  seasonPremiumMaxPriceCma,
  isSeasonRewardUnlocked,
  isSeasonTrackUnlocked,
  seasonProgressPercent,
  seasonXpRequiredForLevel,
  seasonBannerPathForCampaign,
  seasonLevelsForCampaign,
  SPACE_RACE_DURATION_DAYS,
  SPACE_RACE_LEVELS,
  SPACE_RACE_PREMIUM_PRICE_CMA,
  spaceRaceRewardsForEnvironment,
  spaceRaceRewards,
} from "../app/season-rules.ts";
import {
  DAILY_MINIGAME_ROTATION_QUESTS,
  dailyQuestsForActivity,
  weeklyQuestsForCampaign,
} from "../app/season-server.ts";

test("missão diária de minigame percorre todos os jogos em ciclo determinístico", () => {
  const rotated = Array.from(
    { length: DAILY_MINIGAME_ROTATION_QUESTS.length },
    (_, day) => dailyQuestsForActivity(day).at(-1)?.gameId,
  );
  assert.deepEqual(rotated, [
    "packet-catch",
    "hash-match",
    "circuit-rush",
    "coin-link",
    "sky-dash",
    "crypto-2048",
  ]);
  assert.equal(
    dailyQuestsForActivity(DAILY_MINIGAME_ROTATION_QUESTS.length).at(-1)?.gameId,
    "packet-catch",
  );
  assert.equal(new Set(rotated).size, 6);
});

test("passe oficial unifica as recompensas sem AMC em 21 níveis contínuos", () => {
  const productionRewards = spaceRaceRewardsForEnvironment(false);
  assert.equal(productionRewards.length, 21);
  assert.deepEqual(
    productionRewards.map((reward) => reward.level),
    Array.from({ length: 21 }, (_, index) => index + 1),
  );
  assert.equal(
    productionRewards.some((reward) => reward.reward.type === "season_currency"),
    false,
  );
  assert.equal(spaceRaceRewardsForEnvironment(true).length, spaceRaceRewards.length);
});

test("Alchemy Pass tem 60 níveis, banner e distribuição de mineradores para fusão", () => {
  assert.equal(ALCHEMY_SEASON_LEVELS, 60);
  assert.equal(seasonLevelsForCampaign(ALCHEMY_SEASON_SLUG), 60);
  assert.equal(seasonBannerPathForCampaign(ALCHEMY_SEASON_SLUG), "/assets/seasons/alchemy/banner.png");
  assert.equal(ALCHEMY_SEASON_PREMIUM_PRICE_CMA, 100);
  assert.equal(ALCHEMY_SEASON_PREMIUM_MAX_PRICE_CMA, 300);
  const byTrack = (track) => alchemyRewards.filter((reward) => reward.track === track);
  const freeMiners = byTrack("free").filter((reward) => reward.reward.type === "miner");
  const premiumMiners = byTrack("premium").filter((reward) => reward.reward.type === "miner");
  assert.equal(freeMiners.length, 13);
  assert.equal(freeMiners.filter((reward) => (reward.reward.minerLevel ?? 1) === 1).length, 11);
  assert.equal(freeMiners.filter((reward) => reward.reward.minerLevel === 2).length, 2);
  assert.deepEqual(
    [...new Set(freeMiners.map((reward) => reward.reward.minerId))],
    ["alchemy-crystal-s2"],
  );
  assert.equal(premiumMiners.length, 20);
  assert.equal(premiumMiners.filter((reward) => (reward.reward.minerLevel ?? 1) === 1).length, 8);
  assert.equal(premiumMiners.filter((reward) => reward.reward.minerLevel === 2).length, 11);
  assert.equal(premiumMiners.filter((reward) => reward.reward.minerLevel === 3).length, 1);
  assert.deepEqual(
    [...new Set(premiumMiners.map((reward) => reward.reward.minerId))].sort(),
    ["alchemy-cauldron-s2", "alchemy-orrery-s2", "alchemy-spellbook-s2", "alchemy-tower-s2"].sort(),
  );
  for (const reward of alchemyRewards.filter((item) => item.reward.type === "miner")) {
    assert.equal(
      ["alchemy-desk-s2", "alchemy-lantern-s2", "alchemy-alembic-s2", "alchemy-mana-s2", "alchemy-forge-s2"].includes(reward.reward.minerId),
      false,
    );
  }
  for (const reward of alchemyRewards.filter((item) => item.reward.type === "season_currency")) {
    assert.equal(Number.isInteger(reward.reward.quantity), true);
    assert.equal(reward.reward.quantity >= (reward.track === "free" ? 50 : 100), true);
  }
  for (const reward of alchemyRewards.filter((item) => item.reward.type === "parts")) {
    assert.equal(reward.reward.quantity <= 150, true);
  }
  assert.equal(alchemyRewards.some((reward) => reward.title.includes("Hack Arcano")), false);
  assert.equal(alchemyRewards.some((reward) => reward.reward.type === "rack"), true);
});

test("XP reforçado do Alchemy staging completa 60 níveis em 70 dias", () => {
  const required = seasonXpRequiredForLevel(ALCHEMY_SEASON_LEVELS, ALCHEMY_SEASON_LEVELS);
  const dailyMissionXp = dailyQuestsForActivity(0, true).reduce((total, quest) => total + quest.xp, 0);
  const weeklyXp = weeklyQuestsForCampaign(true).reduce((total, quest) => total + quest.xp, 0);
  const loginXp = 10 * [20, 30, 40, 50, 60, 80, 100].reduce((total, xp) => total + xp, 0);
  const availableXp = 70 * dailyMissionXp + 10 * weeklyXp + loginXp;

  assert.equal(dailyMissionXp, 150);
  assert.equal(weeklyXp, 195);
  assert.equal(required, 16225);
  assert.equal(availableXp, 16250);
  assert.equal(availableXp >= required, true);
});

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
  assert.equal(seasonPremiumMaxPriceCma(1, false), 100);
  assert.equal(seasonPremiumMaxPriceCma(1, true), 71);
  assert.equal(seasonPremiumMaxPriceCma(50, true), 2);
  assert.equal(spaceRaceRewards.some((item) => item.track === "free"), true);
  assert.equal(spaceRaceRewards.some((item) => item.track === "premium"), true);
  assert.equal(
    spaceRaceRewards.filter((item) => item.reward.type === "miner").length,
    8,
  );
});

test("Orbit Pass Max tem posse própria e libera a trilha sem fabricar XP", async () => {
  const [server, route, panel, recovery] = await Promise.all([
    readFile(new URL("../app/season-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/season/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SeasonPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recovery-server.ts", import.meta.url), "utf8"),
  ]);
  assert.match(server, /CREATE TABLE IF NOT EXISTS season_pass_max/);
  assert.match(server, /maxUnlocked: Boolean\(maxPass\)/);
  assert.match(server, /progress\.maxUnlocked/);
  assert.match(server, /seasonPricePolicyForCampaign\(season\.campaign_slug\)\.premiumPriceCma/);
  assert.doesNotMatch(server, /xpToGrant/);
  assert.match(server, /quest_id != 'buy-premium-max'/);
  assert.match(route, /Orbit Pass Max ativado/);
  assert.match(panel, /ORBIT PASS MAX ATIVO/);
  assert.match(panel, /RESGATAR · MAX/);
  assert.match(recovery, /"season_pass_max"/);
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
  assert.match(panel, /RANKING DE XP/i);
  assert.match(panel, /durationDays/);
  assert.match(panel, /Giveaways semanais/i);
  assert.doesNotMatch(panel, /ROI|rendimento|retorno garantido/i);
});

test("Orbit Pass Max libera as duas trilhas no mesmo nível de XP", () => {
  assert.equal(isSeasonRewardUnlocked(1, 50, false), false);
  assert.equal(isSeasonRewardUnlocked(1, 50, true), true);
  assert.equal(isSeasonTrackUnlocked("free", false, true), true);
  assert.equal(isSeasonTrackUnlocked("premium", false, true), true);
  assert.equal(isSeasonTrackUnlocked("premium", false, false), false);
});

test("as chaves de resgate usam a mesma virada diária no navegador e no servidor", async () => {
  const [server, panel, seasonRoute, gameRoute] = await Promise.all([
    readFile(new URL("../app/season-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SeasonPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/season/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(server, /daily_\$\{dailyResetWindow\(now\)\.windowKey\}/);
  assert.match(server, /dailyWindowIndex\(now\)[\s\S]*dailyWindowIndex\(overview\.season\.startsAt\)/);
  assert.match(panel, /daily_\$\{dailyWindowKey\(data\.serverTime\)\}/);
  assert.doesNotMatch(seasonRoute, /registerSeasonDailyLogin\(env\.DB, accountId, now\).*catch/);
  assert.doesNotMatch(gameRoute, /registerSeasonDailyLogin\(context\.db/);
});
