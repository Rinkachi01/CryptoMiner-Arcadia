import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sala pública do ranking é somente leitura e exclui contas administrativas", async () => {
  const [route, helper, panel] = await Promise.all([
    readFile(new URL("../app/api/network/leaderboard/room/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/network/leaderboard/public-room.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/LeaderboardPanel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /readPublicRoom/);
  assert.match(helper, /NOT IN \(SELECT account_id FROM admin_owners\)/);
  assert.match(helper, /Cache-Control.*private, no-store/);
  assert.match(helper, /getMiner/);
  assert.doesNotMatch(helper, /cmaBalance/);
  assert.doesNotMatch(helper, /poolAllocations/);
  assert.match(panel, /somente leitura/);
  assert.match(panel, /leaderboard\/room\?accountId/);
  assert.match(panel, /public-room-scene-background/);
  assert.match(panel, /public-room-scene-rack-frame/);
  assert.match(panel, /publicRackMinerPosition/);
});
