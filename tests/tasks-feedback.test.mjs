import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  betaFeedbackCategories,
  betaFeedbackStatuses,
  isBetaFeedbackCategory,
  isBetaFeedbackStatus,
} from "../app/feedback-rules.ts";

test("Central de Tarefas separa missões internas de parceiros futuros", async () => {
  const [game, tasks] = await Promise.all([
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TasksView.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(game, /id: "tasks", label: "Tarefas"/);
  assert.match(tasks, /Pesquisas ainda não conectadas/);
  assert.match(tasks, /Nenhum anúncio ou pesquisa paga está ativo/);
  assert.match(tasks, /Recompensa não monetária/);
  assert.doesNotMatch(tasks, /ganhe CMA|ganhe BTC|ganhe DOGE/i);
});

test("feedback do beta é autenticado, validado e persistido por conta", async () => {
  const [route, admin, migration] = await Promise.all([
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0010_nosy_scarlet_witch.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.deepEqual(betaFeedbackCategories, [
    "interface",
    "racks",
    "economy",
    "minigames",
    "tasks",
  ]);
  assert.equal(isBetaFeedbackCategory("economy"), true);
  assert.equal(isBetaFeedbackCategory("payment"), false);
  assert.deepEqual(betaFeedbackStatuses, [
    "new",
    "reviewing",
    "planned",
    "resolved",
  ]);
  assert.equal(isBetaFeedbackStatus("planned"), true);
  assert.equal(isBetaFeedbackStatus("ignored"), false);
  assert.match(route, /getArcadiaUser/);
  assert.match(route, /message\.length < 10/);
  assert.match(route, /INSERT INTO beta_feedback/);
  assert.match(route, /30_000/);
  assert.match(admin, /readAdminBetaFeedback/);
  assert.match(admin, /set-feedback-status/);
  assert.match(admin, /beta_feedback_status_updated/);
  assert.match(admin, /block_settlement/);
  assert.match(admin, /rewardsAtomic/);
  assert.match(migration, /CREATE TABLE `beta_feedback`/);
});

test("sala prioriza energia e não exibe feed decorativo abaixo da operação", async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const operationStart = game.indexOf('<aside className="operation-panel">');
  const operationEnd = game.indexOf("</aside>", operationStart);
  const operation = game.slice(operationStart, operationEnd);

  assert.ok(operation.indexOf("<EnergyCard") < operation.indexOf("allocation-summary-card"));
  assert.doesNotMatch(operation, /ATIVIDADE RECENTE/);
  assert.match(styles, /\.metric-strip article \{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.metric-strip em \{[\s\S]*grid-column: 2/);
});
