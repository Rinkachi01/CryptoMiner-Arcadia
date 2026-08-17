import { env } from "cloudflare:workers";
import { assetsManifest } from "../../../assets.manifest";
import {
  getInstalledPower,
  getMiner,
  getUsedSlotCount,
  RACK_CAPACITY,
} from "../../../game-rules";
import type { PublicGameState } from "../../../game-server";
import { getArcadiaUser } from "../../../identity-server";
import { getRoomDefinition } from "../../../room-rules";

type PublicRoomRow = {
  account_id: string;
  display_name: string;
  state_json: string;
  temporary_power_gh: number | null;
};

function parsePublicRoom(row: PublicRoomRow, now: number) {
  let state: Partial<PublicGameState> = {};
  try {
    state = JSON.parse(row.state_json) as Partial<PublicGameState>;
  } catch {
    // Keep a safe empty room if an old or malformed state is encountered.
  }

  const roomRacks = Array.isArray(state.racks)
    ? state.racks.filter(
        (rack) =>
          rack &&
          rack.roomId === "room-1" &&
          typeof rack.id === "string" &&
          Number.isInteger(rack.positionIndex) &&
          rack.positionIndex >= 0 &&
          rack.positionIndex < 12,
      )
    : [];
  const racks = roomRacks.map((rack) => {
    const placements = Array.isArray(state.rackMiners?.[rack.id])
      ? state.rackMiners?.[rack.id] ?? []
      : [];
    const miners = placements
      .filter(
        (placement) =>
          placement &&
          typeof placement.instanceId === "string" &&
          Number.isInteger(placement.slotIndex) &&
          placement.slotIndex >= 0 &&
          placement.slotIndex < RACK_CAPACITY,
      )
      .map((placement) => {
        const miner = getMiner(placement.minerId);
        if (!miner) return null;
        return {
          instanceId: placement.instanceId,
          slotIndex: placement.slotIndex,
          miner: {
            id: miner.id,
            name: miner.name,
            asset: miner.asset,
            alt: miner.alt,
            slotSize: miner.slotSize,
            powerGh: miner.powerGh,
            rarity: miner.rarity,
          },
        };
      })
      .filter((placement): placement is NonNullable<typeof placement> => Boolean(placement));

    return {
      id: rack.id,
      positionIndex: rack.positionIndex,
      usedSlots: getUsedSlotCount(
        miners.map((placement) => ({
          instanceId: placement.instanceId,
          minerId: placement.miner.id,
          slotIndex: placement.slotIndex,
        })),
      ),
      miners,
    };
  });

  const minerPowerGh = getInstalledPower(
    racks.flatMap((rack) =>
      rack.miners.map((placement) => ({
        instanceId: placement.instanceId,
        minerId: placement.miner.id,
        slotIndex: placement.slotIndex,
      })),
    ),
  );
  const temporaryPowerGh = Math.max(0, Number(row.temporary_power_gh ?? 0));
  const energyExpiresAt = Number(state.energyExpiresAt ?? 0);
  const energyActive = energyExpiresAt > now;
  const activeMinerPowerGh = energyActive ? minerPowerGh : 0;

  return {
    accountId: row.account_id,
    displayName: row.display_name,
    room: {
      id: "room-1",
      name: getRoomDefinition("room-1")?.name ?? "Oficina Neon",
      asset: assetsManifest.roomOne.path,
      racks,
      rackCount: racks.length,
      minerCount: racks.reduce((total, rack) => total + rack.miners.length, 0),
    },
    power: {
      minerGh: activeMinerPowerGh,
      minigameGh: temporaryPowerGh,
      totalGh: activeMinerPowerGh + temporaryPowerGh,
    },
    energy: {
      active: energyActive,
      expiresAt: energyActive ? energyExpiresAt : null,
    },
  };
}

export async function readPublicRoom(accountId: string) {
  const user = await getArcadiaUser();
  if (!user) {
    return Response.json({ error: "Faça login para ver uma sala." }, { status: 401 });
  }
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(accountId)) {
    return Response.json({ error: "Operador inválido." }, { status: 400 });
  }
  const db = env.DB;
  if (!db) {
    return Response.json({ error: "Sala temporariamente indisponível." }, { status: 503 });
  }
  const now = Date.now();
  try {
    const row = await db
      .prepare(
        `SELECT g.account_id, g.display_name, g.state_json,
                COALESCE((
                  SELECT SUM(power_gh)
                  FROM temporary_power_grants t
                  WHERE t.account_id = g.account_id
                    AND t.starts_at <= ?
                    AND t.expires_at > ?
                ), 0) AS temporary_power_gh
           FROM game_states g
          WHERE g.account_id = ?
            AND g.account_id NOT IN (SELECT account_id FROM admin_owners)
          LIMIT 1`,
      )
      .bind(now, now, accountId)
      .first<PublicRoomRow>();
    if (!row) {
      return Response.json({ error: "Sala pública não encontrada." }, { status: 404 });
    }
    return Response.json(
      { generatedAt: now, room: parsePublicRoom(row, now) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Não foi possível carregar a sala pública." },
      { status: 500 },
    );
  }
}
