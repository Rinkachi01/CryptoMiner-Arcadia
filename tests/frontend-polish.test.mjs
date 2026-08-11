import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mantém os oito atalhos móveis em uma única faixa", async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  const navigation = game.match(/const navigation:[\s\S]*?= \[([\s\S]*?)\n\];/);
  assert.ok(navigation, "lista principal de navegação não encontrada");
  assert.equal((navigation[1].match(/id:/g) ?? []).length, 8);
  assert.match(styles, /grid-template-columns:\s*repeat\(8, minmax\(78px, 1fr\)\)/);
  assert.match(styles, /overflow-y:\s*hidden/);
  assert.match(styles, /\.sidebar\s*\{[\s\S]*?overflow-y:\s*auto/);
});

test("carteira comunica interação e preserva o acesso à conversão", async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(game, /Abrir carteira virtual e escolher a moeda exibida/);
  assert.match(game, /ABRIR CARTEIRA/);
  assert.match(styles, /\.wallet-trigger:hover/);
  assert.match(styles, /\.wallet-conversion-link:hover/);
  assert.match(styles, /\.wallet-menu\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(styles, /\.wallet-balance-row strong\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
});

test("central do proprietário separa publicação, depósitos e saques", async () => {
  const dashboard = await readFile(
    new URL("../app/AdminDashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /O que você precisa providenciar/);
  assert.match(dashboard, /DEPÓSITOS EM HOMOLOGAÇÃO/);
  assert.match(dashboard, /DEPÓSITOS BTC \/ DOGE/);
  assert.match(dashboard, /CMA não é sacável/);
  assert.match(dashboard, /FILA MANUAL DO PROPRIETÁRIO/i);
  assert.match(dashboard, /admin-workspace-tabs/);
  assert.match(dashboard, /type AdminSection = "overview" \| "economy" \| "treasury" \| "community" \| "operations"/);
  assert.match(dashboard, /hidden=\{adminSection !== "treasury"\}/);
});

test("suporte prioriza o protocolo e recolhe os guias extensos", async () => {
  const support = await readFile(
    new URL("../app/support/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(support, /support-guide-disclosure/);
  assert.match(support, /Abra somente quando precisar/);
  assert.match(support, /saques BTC, DOGE e LTC/);
});
