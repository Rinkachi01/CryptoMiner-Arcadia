export const roomCatalog = [
  {
    id: "room-1",
    label: "SALA 01",
    name: "Oficina Neon",
    priceCma: 0,
    sequence: 1,
  },
  {
    id: "room-2",
    label: "SALA 02",
    name: "Laboratório Noturno 1",
    priceCma: 20,
    sequence: 2,
  },
  {
    id: "room-3",
    label: "SALA 03",
    name: "Laboratório Noturno 2",
    priceCma: 50,
    sequence: 3,
  },
  {
    id: "room-4",
    label: "SALA 04",
    name: "Laboratório Noturno 3",
    priceCma: 100,
    sequence: 4,
  },
  {
    id: "room-5",
    label: "SALA 05",
    name: "Laboratório Noturno 4",
    priceCma: 200,
    sequence: 5,
  },
  {
    id: "room-6",
    label: "SALA 06",
    name: "Laboratório Noturno 5",
    priceCma: 400,
    sequence: 6,
  },
] as const;

export type RoomId = (typeof roomCatalog)[number]["id"];
export type RoomCatalogEntry = (typeof roomCatalog)[number];

export const ROOM_COUNT = roomCatalog.length;

export function isRoomId(value: unknown): value is RoomId {
  return roomCatalog.some((room) => room.id === value);
}

export function getRoomDefinition(roomId: unknown) {
  return roomCatalog.find((room) => room.id === roomId);
}

export function getPreviousRoom(roomId: RoomId) {
  const index = roomCatalog.findIndex((room) => room.id === roomId);
  return index > 0 ? roomCatalog[index - 1] : null;
}

export function normalizeOwnedRoomIds(value: unknown): RoomId[] {
  const requested = new Set(
    Array.isArray(value) ? value.filter(isRoomId) : ["room-1"],
  );
  const owned: RoomId[] = ["room-1"];
  for (const room of roomCatalog.slice(1)) {
    if (!requested.has(room.id)) break;
    owned.push(room.id);
  }
  return owned;
}
