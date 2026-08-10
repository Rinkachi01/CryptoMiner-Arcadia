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
