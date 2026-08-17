import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [game, arcade, career, progress, admin, inbox, styles] = await Promise.all([
  readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/PacketCatchView.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/CareerView.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/OperatorProgressPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/AdminDashboard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/OperatorInbox.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);
const firstDay = await readFile(
  new URL("../app/FirstDayPanel.tsx", import.meta.url),
  "utf8",
);

test("Arcade mostra os jogos sem carregar carreira e temporada antes deles", () => {
  assert.match(arcade, /games-hub-body/);
  assert.doesNotMatch(arcade, /OperatorProgressPanel|SeasonPanel/);
  assert.match(career, /Visão geral/);
  assert.doesNotMatch(career, /SeasonPanel/);
  assert.doesNotMatch(career, /Missões e carreira/);
});

test("guia de entrada leva o jogador às áreas certas sem overlay escuro", () => {
  assert.match(game, /<OperatorInbox/);
  assert.match(inbox, /Conquiste e ative energia/);
  assert.match(inbox, /Instale seu primeiro rack/);
  assert.match(inbox, /Distribua 100% do poder/);
  assert.match(inbox, /Tour do Arcade/);
  assert.match(inbox, /aria-modal="false"/);
  assert.doesNotMatch(inbox, /backdrop|overlay/);
  assert.match(styles, /\.operator-inbox/);
});

test("Central do Operador mantém somente visão geral, indicações e histórico", () => {
  assert.match(game, /Central do operador/);
  assert.match(game, /<CareerView/);
  assert.match(career, /Meu histórico/);
  assert.match(career, /ActivityPanel/);
  assert.match(career, /Indicações/);
  assert.doesNotMatch(career, /label: "Temporada"/);
  assert.doesNotMatch(career, /missions-tab-layout/);
  assert.match(progress, /show-\$\{section\}/);
  assert.match(progress, /economy-guard-panel/);
  assert.doesNotMatch(progress, /operator-career-panel/);
});

test("jogo e painel administrativo compartilham três escalas de leitura", () => {
  for (const scale of ["comfortable", "large", "extra"]) {
    assert.match(game, new RegExp(scale));
    assert.match(admin, new RegExp(scale));
  }
  assert.match(game, /arcadia-text-scale/);
  assert.match(admin, /arcadia-text-scale/);
  assert.match(styles, /--readable-meta: 0\.78rem/);
  assert.match(styles, /--admin-readable-meta: 0\.78rem/);
  assert.match(styles, /font-size: var\(--readable-meta\) !important/);
});

test("controles e navegação mantêm áreas de toque acessíveis", () => {
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /grid-template-columns: repeat\(6/);
  assert.match(game, /Tamanho do texto/);
  assert.match(admin, /Tamanho do texto/);
  assert.match(firstDay, /aria-current/);
  assert.match(firstDay, /Continuar: \$\{nextStepLabel\}/);
  assert.match(styles, /scroll-snap-type: x proximity/);
  assert.match(game, /event\.currentTarget\.blur\(\)/);
});
