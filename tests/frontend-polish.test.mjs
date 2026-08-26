import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mantém os atalhos móveis em uma única faixa", async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  const navigation = game.match(/const navigation:[\s\S]*?= \[([\s\S]*?)\n\];/);
  assert.ok(navigation, "lista principal de navegação não encontrada");
  assert.ok((navigation[1].match(/id:/g) ?? []).length >= 10);
  assert.match(styles, /grid-template-columns:\s*repeat\(10, minmax\(78px, 1fr\)\)/);
  assert.match(styles, /overflow-y:\s*hidden/);
  assert.match(styles, /\.sidebar\s*\{[\s\S]*?overflow-y:\s*auto/);
});

test("minigames definem o idioma antes de renderizar os cards", async () => {
  const packetCatch = await readFile(
    new URL("../app/PacketCatchView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(packetCatch, /useArcadiaLanguage/);
  assert.match(packetCatch, /const english = locale !== "pt-BR"/);
  assert.match(packetCatch, /arcadeGameCards\.map/);
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

test("atalhos CMA abrem Pix e conversão no painel correto", async () => {
  const wallet = await readFile(
    new URL("../app/ConversionView.tsx", import.meta.url),
    "utf8",
  );

  // A crypto rail is the safe initial state; Pix is opt-in from the CMA card.
  assert.match(wallet, /useState<DepositMethod>\("LTC"\)/);
  assert.match(wallet, /data-wallet-action="cma-pix-deposit"/);
  assert.match(wallet, /onClick=\{\(\) => openWalletDeposit\("PIX"\)\}/);
  assert.match(wallet, /aria-controls="wallet-deposit-panel"/);
  assert.match(wallet, /data-wallet-action="convert-to-cma"/);
  assert.match(wallet, /onClick=\{openWalletConvert\}/);
  assert.match(wallet, /id="wallet-convert-panel"/);
  assert.match(wallet, /getElementById\("wallet-convert-panel"\)/);
});

test("atalhos CMA têm affordance visual de clique no staging", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\.staging-shell \.wallet-category-actions button\s*\{[\s\S]*?cursor:\s*pointer/);
  assert.match(styles, /\.staging-shell \.wallet-category-actions button:hover,[\s\S]*?transform:\s*translateY\(-2px\)/);
  assert.match(styles, /\.staging-shell \.wallet-category-actions button:last-child\s*\{[\s\S]*?border-color:\s*rgba\(169, 255, 63/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]*?wallet-category-actions button/);
});

test("central do proprietário separa publicação, depósitos e saques", async () => {
  const dashboard = await readFile(
    new URL("../app/AdminDashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /O que você precisa providenciar/);
  assert.match(dashboard, /DEPÓSITOS \{overview\.launch\.pix\.enabled/);
  assert.match(dashboard, /DEPÓSITOS BTC \/ DOGE \/ LTC/);
  assert.match(dashboard, /CMA não é sacável/);
  assert.match(dashboard, /FILA MANUAL DO PROPRIETÁRIO/i);
  assert.match(dashboard, /admin-sidebar-nav/);
  assert.match(dashboard, /\| "season"/);
  assert.match(dashboard, /Comando executivo/);
  assert.match(dashboard, /CAPITAL OPERACIONAL DO FUNDADOR/);
  assert.match(dashboard, /replenish-owner-wallet/);
  assert.match(dashboard, /hidden=\{adminSection !== "treasury"\}/);
});

test("suporte prioriza o protocolo e recolhe os guias extensos", async () => {
  const support = await readFile(
    new URL("../app/support/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(support, /support-guide-disclosure/);
  assert.match(support, /Abra somente quando precisar/);
  assert.match(support, /Saques\s+BTC, DOGE e LTC/i);
});
