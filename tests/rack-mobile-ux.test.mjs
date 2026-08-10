import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("celular recebe acesso rápido aos racks sem alterar o mapa de slots", async () => {
  const source = await readFile(
    new URL("../app/ArcadiaGame.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /mobile-rack-dock/);
  assert.match(source, /Acesso rápido aos racks desta sala/);
  assert.match(source, /Deslize e toque para gerenciar/);
  assert.match(source, /rackMinerPosition\(placement\.slotIndex\)/);
  assert.match(styles, /\.mobile-rack-dock\s*\{\s*display:\s*none/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.mobile-rack-dock\s*\{\s*display:\s*grid/);
});

test("gerenciador reorganiza controles e catálogo em telas estreitas", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\.rack-inline-panel \.rack-slot-editor/);
  assert.match(styles, /\.rack-inline-panel \.rack-miner-card/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(styles, /grid-column:\s*1 \/ -1/);
});

test("regra visual final mantém a sala em uma coluna no celular", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const finalDesktopGrid = styles.lastIndexOf(
    "grid-template-columns: minmax(0, 1fr) minmax(300px, 330px);",
  );
  const finalMobileGuard = styles.lastIndexOf("@media (max-width: 900px)");
  const mobileRules = styles.slice(finalMobileGuard);

  assert.ok(finalMobileGuard > finalDesktopGrid);
  assert.match(
    mobileRules,
    /\.mine-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
  assert.match(mobileRules, /\.room-card,[\s\S]*?width:\s*100%/);
  assert.match(mobileRules, /\.room-stage\s*\{[\s\S]*?min-height:\s*280px/);
});

test("celular mantém troca e compra de salas acessíveis sem cobrir os racks", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const finalMobileRules = styles.slice(styles.lastIndexOf("@media (max-width: 620px)"));

  assert.doesNotMatch(source, /<div className="room-mode-badge">/);
  assert.match(finalMobileRules, /\.room-toolbar > div button:last-child\s*\{\s*display:\s*flex/);
  assert.match(finalMobileRules, /\.rooms-modal\s*\{[\s\S]*?min-height:\s*100dvh/);
  assert.match(finalMobileRules, /\.room-store-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});
