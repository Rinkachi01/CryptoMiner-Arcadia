import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  describeArcadeStart,
  formatArcadeCooldown,
} from "../app/arcade-start-rules.ts";

const available = { dayRemaining: 10, hourRemaining: 3 };

test("estado do Arcade explica recarga e limites antes de desativar o botão", () => {
  assert.equal(formatArcadeCooldown(9.2), "10s");
  assert.equal(formatArcadeCooldown(75), "1:15");

  const cooldown = describeArcadeStart({
    cooldownSeconds: 75,
    limits: available,
    loading: false,
    loadingLabel: "CARREGANDO",
    readyLabel: "JOGAR",
  });
  assert.equal(cooldown.disabled, true);
  assert.equal(cooldown.label, "RECARGA 1:15");
  assert.match(cooldown.reason, /evita geração ilimitada/i);

  const hourly = describeArcadeStart({
    cooldownSeconds: 0,
    limits: { dayRemaining: 10, hourRemaining: 0 },
    loading: false,
    loadingLabel: "CARREGANDO",
    readyLabel: "JOGAR",
  });
  assert.equal(hourly.label, "LIMITE DA HORA ATINGIDO");

  const daily = describeArcadeStart({
    cooldownSeconds: 20,
    limits: { dayRemaining: 0, hourRemaining: 0 },
    loading: false,
    loadingLabel: "CARREGANDO",
    readyLabel: "JOGAR",
  });
  assert.equal(daily.label, "LIMITE DIÁRIO ATINGIDO");
});

test("Arcade mostra tutorial rápido e usa o mesmo aviso nos três jogos", async () => {
  const [packet, hash, circuit, notice] = await Promise.all([
    readFile(new URL("../app/PacketCatchView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HashMatchView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CircuitRushView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ArcadeStartNotice.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(packet, /arcade-quick-guide/);
  assert.match(packet, /01 · OBJETIVO/);
  assert.match(packet, /04 · VALIDAÇÃO/);
  for (const source of [packet, hash, circuit]) {
    assert.match(source, /ArcadeStartNotice/);
    assert.match(source, /describeArcadeStart/);
  }
  assert.match(notice, /aria-live="polite"/);
});
