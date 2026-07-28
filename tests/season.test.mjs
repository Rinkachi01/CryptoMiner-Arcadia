import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateSeasonScore,
  normalizeSeasonDurationDays,
  seasonProgressPercent,
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

test("progresso e duração da temporada respeitam limites seguros", () => {
  assert.equal(seasonProgressPercent(1_000, 2_000, 1_500), 50);
  assert.equal(seasonProgressPercent(1_000, 2_000, 500), 0);
  assert.equal(seasonProgressPercent(1_000, 2_000, 3_000), 100);
  assert.equal(normalizeSeasonDurationDays(2), 7);
  assert.equal(normalizeSeasonDurationDays(120), 90);
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
  assert.match(dashboard, /SEM PRÊMIO FINANCEIRO/);
});

test("ranking competitivo não promete CMA, saque ou retorno financeiro", async () => {
  const [api, panel] = await Promise.all([
    readFile(new URL("../app/api/season/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SeasonPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(api, /sem prêmio em CMA, saque ou vantagem financeira/i);
  assert.match(panel, /RANKING COMPETITIVO/i);
  assert.doesNotMatch(panel, /ROI|rendimento|retorno garantido/i);
});
