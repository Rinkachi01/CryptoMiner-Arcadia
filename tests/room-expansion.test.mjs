import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyGameAction,
  createInitialGameState,
  normalizeBootstrapState,
} from "../app/game-server.ts";
import {
  ROOM_COUNT,
  normalizeOwnedRoomIds,
  roomCatalog,
} from "../app/room-rules.ts";

const NOW = 1_800_000_000_000;

test("complexo possui seis salas com a progressão econômica definida", () => {
  assert.equal(ROOM_COUNT, 6);
  assert.deepEqual(
    roomCatalog.map((room) => room.priceCma),
    [0, 20, 50, 100, 200, 400],
  );
  assert.deepEqual(
    roomCatalog.slice(1).map((room) => room.name),
    [
      "Laboratório Noturno 1",
      "Laboratório Noturno 2",
      "Laboratório Noturno 3",
      "Laboratório Noturno 4",
      "Laboratório Noturno 5",
    ],
  );
});

test("servidor desconta cada sala uma vez e exige a anterior", () => {
  const initial = createInitialGameState(NOW);
  initial.cmaBalance = 1_000;

  assert.throws(
    () => applyGameAction(initial, "buy_room", { roomId: "room-3" }, NOW),
    /sala anterior|primeiro/i,
  );

  const second = applyGameAction(
    initial,
    "buy_room",
    { roomId: "room-2" },
    NOW,
  );
  assert.equal(second.state.cmaBalance, 980);
  assert.deepEqual(second.state.ownedRoomIds, ["room-1", "room-2"]);
  assert.equal(second.metadata.priceCma, 20);

  const repeated = applyGameAction(
    second.state,
    "buy_room",
    { roomId: "room-2" },
    NOW,
  );
  assert.equal(repeated.state.cmaBalance, 980);

  const third = applyGameAction(
    repeated.state,
    "buy_room",
    { roomId: "room-3" },
    NOW,
  );
  assert.equal(third.state.cmaBalance, 930);
  assert.equal(third.state.activeRoomId, "room-3");
});

test("estado importado mantém somente uma sequência contínua de salas", () => {
  assert.deepEqual(
    normalizeOwnedRoomIds(["room-1", "room-2", "room-4", "room-6"]),
    ["room-1", "room-2"],
  );

  const migrated = normalizeBootstrapState(
    {
      ownedRoomIds: ["room-1", "room-2", "room-3", "room-6"],
      activeRoomId: "room-6",
    },
    NOW,
  );
  assert.deepEqual(migrated.ownedRoomIds, ["room-1", "room-2", "room-3"]);
  assert.equal(migrated.activeRoomId, "room-1");
});

test("cada laboratório preserva racks em posições independentes", () => {
  const initial = createInitialGameState(NOW);
  initial.cmaBalance = 1_000;
  initial.rackInventoryCount = 2;
  const roomPurchase = applyGameAction(
    initial,
    "buy_room",
    { roomId: "room-2" },
    NOW,
  );
  const placed = applyGameAction(
    roomPurchase.state,
    "place_rack",
    { positionIndex: 0, roomId: "room-2" },
    NOW,
  );

  assert.equal(
    placed.state.racks.filter((rack) => rack.roomId === "room-1").length,
    1,
  );
  assert.equal(
    placed.state.racks.filter((rack) => rack.roomId === "room-2").length,
    1,
  );
});

test("interface confirma a compra antes de chamar o servidor", async () => {
  const source = await readFile(
    new URL("../app/ArcadiaGame.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /CONFIRMAR EXPANSÃO/);
  assert.match(source, /SALDO APÓS COMPRA/);
  assert.match(source, /setConfirmingRoomId\(room\.id\)/);
  assert.match(source, /ownedRooms\}\/\{roomDefinitions\.length\}/);
});
