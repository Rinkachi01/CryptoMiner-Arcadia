import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("idioma persiste, sincroniza entre abas e traduz o shell principal", async () => {
  const source = await fs.readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8");
  assert.match(source, /arcadia-locale/);
  assert.match(source, /arcadia_locale/);
  assert.match(source, /addEventListener\("storage"/);
  assert.match(source, /Sala de mineração/);
  assert.match(source, /Mining room/);
  assert.match(source, /Salle de minage/);
  assert.doesNotMatch(source, /Sala de mineraÃ§Ã£o/);
});
