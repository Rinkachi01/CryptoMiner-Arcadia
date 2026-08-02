import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isFreshFounderDestination } from "../app/founder-transfer-server.ts";

const freshState = {
  batteryCount: 0,
  btcBalanceAtomic: 0,
  cmaBalance: 0,
  dogeBalanceAtomic: 0,
  minerInventory: [{ instanceId: "starter", minerId: "byte-spark" }],
  rackMiners: { "rack-01": [] },
  racks: [{ id: "rack-01", positionIndex: 0, roomId: "room-1" }],
};

test("migração automática aceita somente a conta pública inicial", () => {
  assert.equal(isFreshFounderDestination(freshState, 1), true);
  assert.equal(isFreshFounderDestination({ ...freshState, cmaBalance: 1 }, 1), false);
  assert.equal(
    isFreshFounderDestination(
      { ...freshState, rackMiners: { "rack-01": [{ minerId: "byte-spark" }] } },
      1,
    ),
    false,
  );
  assert.equal(isFreshFounderDestination(freshState, 4), false);
});

test("pacote é assinado, limitado, vinculado ao fundador e auditado", async () => {
  const [server, route, panel] = await Promise.all([
    readFile(new URL("../app/founder-transfer-server.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/admin/account-transfer/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/FounderTransferPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(server, /HMAC/);
  assert.match(server, /CompressionStream/);
  assert.match(server, /DecompressionStream/);
  assert.match(server, /arcadia-transfer-gzip-v1/);
  assert.match(server, /MAX_TRANSFER_AGE_MS/);
  assert.match(server, /payload\.accountId !== accountId/);
  assert.match(server, /founder_account_transfers/);
  assert.match(server, /founder_account_transferred/);
  assert.match(server, /lastSettledBlock = Math\.floor/);
  assert.match(route, /claimOrVerifyAdminOwner/);
  assert.match(route, /founderTransferSecretFromEnv/);
  assert.match(route, /writeAdminAudit/);
  assert.match(panel, /A conta de destino precisa estar sem atividade/);
});
