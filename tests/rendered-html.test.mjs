import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readProductSources() {
  const [
    layout,
    page,
    game,
    packetCatch,
    hashMatch,
    circuitRush,
    operatorProgress,
    gamesSummary,
    gameSubmission,
    errorBoundary,
    styles,
  ] =
    await Promise.all([
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/ArcadiaGame.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/PacketCatchView.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/HashMatchView.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/CircuitRushView.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/OperatorProgressPanel.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/api/games/summary/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/GameSubmissionOverlay.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/GameErrorBoundary.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);
  return `${layout}\n${page}\n${game}\n${packetCatch}\n${hashMatch}\n${circuitRush}\n${operatorProgress}\n${gamesSummary}\n${gameSubmission}\n${errorBoundary}\n${styles}`;
}

test("mantém a experiência principal e a conta autoritativa do Arcadia", async () => {
  const source = await readProductSources();

  assert.match(source, /title: "Crypto Miner Arcadia"/i);
  assert.match(source, /Sua sala de mineração/i);
  assert.match(source, /Sala de mineração/i);
  assert.match(source, /Pools/i);
  assert.match(source, /Inventário/i);
  assert.match(source, /Loja/i);
  assert.match(source, /Minigames/i);
  assert.match(source, /Packet Catch/i);
  assert.match(source, /Hash Match/i);
  assert.match(source, /Circuit Rush/i);
  assert.match(source, /Lista de minigames/i);
  assert.match(source, /BOMBA/i);
  assert.match(source, /DIFICULDADE/i);
  assert.match(source, /RECARGA/i);
  assert.match(source, /CONTA NO SERVIDOR/i);
  assert.match(source, /PROGRESSO PROTEGIDO/i);
  assert.match(source, /RACKS NESTA SALA/i);
  assert.match(source, /ENERGIA/i);
  assert.match(source, /ENERGIA PELO ARCADE/i);
  assert.match(source, /REDE PRINCIPAL/i);
  assert.match(source, /Poder total da rede/i);
  assert.match(source, /CRIAR CONTA/i);
  assert.match(source, /progresso no servidor/i);
  assert.match(source, /rack-visual/i);
  assert.match(source, /rack-inline-panel/i);
  assert.match(source, /NÍVEL DO OPERADOR/i);
  assert.match(source, /LIGA DO OPERADOR/i);
  assert.match(source, /CONQUISTAS DE CARREIRA/i);
  assert.match(source, /CONTROLE DE EMISSÃO/i);
  assert.match(source, /ECONOMIA ESTÁVEL/i);
  assert.match(source, /ORÇAMENTO RESTANTE/i);
  assert.match(source, /MISSÕES DIÁRIAS/i);
  assert.match(source, /RESGATAR 1 BATERIA/i);
  assert.match(source, /Tour diário do Arcade/i);
  assert.match(source, /CAIXAS ARCADIA/i);
  assert.match(source, /CHANCES PÚBLICAS/i);
  assert.match(source, /PROTEÇÃO DE AZAR/i);
  assert.match(source, /3 VIDAS/i);
  assert.match(source, /TRANSMISSÃO SEGURA/i);
  assert.match(source, /ENVIANDO PROVA DA PARTIDA/i);
  assert.match(source, /SISTEMA DE RECUPERAÇÃO/i);
  assert.doesNotMatch(source, /createPortal/i);
  assert.doesNotMatch(source, /1 CMA = US\$ 1/i);
  assert.doesNotMatch(source, /BASE DA ECONOMIA/i);
  assert.doesNotMatch(source, />CONSUMO</i);
  assert.doesNotMatch(source, /codex-preview/i);
  assert.doesNotMatch(source, /react-loading-skeleton/i);
});

test("gerenciador de rack importa todas as regras usadas durante a renderização", async () => {
  const source = await readFile(
    new URL("../app/ArcadiaGame.tsx", import.meta.url),
    "utf8",
  );
  const rulesImport = source.match(
    /import\s*\{([\s\S]*?)\}\s*from "\.\/game-rules";/,
  );
  assert.ok(rulesImport, "import das regras do rack não encontrado");
  assert.match(rulesImport[1], /findNextAvailableSlot/);
  assert.match(rulesImport[1], /canInstallAt/);
});
