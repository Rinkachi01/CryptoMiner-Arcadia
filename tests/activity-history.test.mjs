import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  presentGameSession,
  presentLedgerActivity,
} from "../app/activity-rules.ts";

test("traduz o ledger em atividades pessoais compreensíveis", () => {
  const purchase = presentLedgerActivity("buy_miners", { quantity: 2 });
  assert.equal(purchase.category, "economy");
  assert.match(purchase.title, /2 mineradores/);

  const allocation = presentLedgerActivity("apply_allocations", {
    allocations: { cma: 40, btc: 30, doge: 20, ltc: 10 },
  });
  assert.equal(allocation.category, "mining");
  assert.match(
    allocation.description,
    /CMA 40% · BTC 30% · DOGE 20% · LTC 10%/,
  );
});

test("diferencia vitória e encerramento sem recompensa no Arcade", () => {
  const win = presentGameSession("packet-catch", "completed", 480, 4);
  const failed = presentGameSession("hash-match", "failed", 0, 3);
  assert.match(win.title, /Packet Catch concluído/);
  assert.match(win.description, /480 pontos/);
  assert.match(failed.title, /Hash Match encerrado/);
  assert.match(failed.description, /sem recompensa/);
});

test("sincronização não duplica no histórico o bloco já registrado", () => {
  const sync = presentLedgerActivity("sync", {
    settledBlocks: 1,
    settlementRecordedSeparately: true,
  });
  assert.equal(sync.title, "Conta sincronizada");
  assert.match(
    presentLedgerActivity("block_settlement", { settledBlocks: 1 }).title,
    /Bloco de mineração processado/,
  );
});

test("histórico é pessoal, autenticado e lido de fontes autoritativas", async () => {
  const [route, panel, career] = await Promise.all([
    readFile(new URL("../app/api/activity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ActivityPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CareerView.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /getArcadiaUser/);
  assert.match(route, /WHERE account_id = \?/);
  assert.match(route, /ledger_entries/);
  assert.match(route, /game_sessions/);
  assert.match(route, /walletRewards/);
  assert.match(route, /economicLedger: "all_time"/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(panel, /Seu histórico, sem mistério/);
  assert.match(panel, /Filtrar histórico/);
  assert.match(panel, /✓ SERVIDOR/);
  assert.match(panel, /últimos \{data\.retention\.visibleDays\} dias/);
  assert.match(panel, /item\.walletRewards\.map/);
  assert.match(career, /Meu histórico/);
  assert.match(career, /<ActivityPanel/);
});

test("crédito CMA administrativo é identificado sem fingir ser mineração", () => {
  const grant = presentLedgerActivity("admin_test_cma_grant", {});
  assert.equal(grant.category, "economy");
  assert.match(grant.title, /Crédito administrativo/);
  assert.match(grant.description, /virtual|equilibrar/i);
});

test("resumo pessoal não promete retorno financeiro", async () => {
  const panel = await readFile(
    new URL("../app/ActivityPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(panel, /ROI|lucro|rendimento|retorno garantido/i);
  assert.match(panel, /CMA RECEBIDO/);
  assert.match(panel, /CMA UTILIZADO/);
});
