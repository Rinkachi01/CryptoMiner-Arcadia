export type AssetType =
  | "miner"
  | "rack"
  | "coin"
  | "room"
  | "uiIcon";

export type AssetManifestEntry = {
  id: string;
  type: AssetType;
  path: string;
  width: number;
  height: number;
  slots: number;
  anchor: { x: number; y: number };
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
  alt: string;
  version: number;
};

export const assetsManifest = {
  cmaCoin: {
    id: "coin_cma_v1",
    type: "coin",
    path: "/assets/brand/cma-coin.png",
    width: 64,
    height: 64,
    slots: 0,
    anchor: { x: 0.5, y: 0.5 },
    alt: "Moeda CMA dourada com emblema de Arcadia",
    version: 1,
  },
  bitcoin: {
    id: "coin_btc_v1",
    type: "coin",
    path: "/assets/coins/btc.svg",
    width: 32,
    height: 32,
    slots: 0,
    anchor: { x: 0.5, y: 0.5 },
    alt: "Símbolo do Bitcoin",
    version: 1,
  },
  dogecoin: {
    id: "coin_doge_v1",
    type: "coin",
    path: "/assets/coins/doge.svg",
    width: 32,
    height: 32,
    slots: 0,
    anchor: { x: 0.5, y: 0.5 },
    alt: "Símbolo do Dogecoin",
    version: 1,
  },
  rackBasic: {
    id: "rack_arcadia_basic_v1",
    type: "rack",
    path: "/assets/racks/rack-basic.png",
    width: 252,
    height: 200,
    slots: 8,
    anchor: { x: 0.5, y: 1 },
    alt: "Rack metálico de quatro prateleiras",
    version: 1,
  },
  roomOne: {
    id: "room_arcadia_workshop_v1",
    type: "room",
    path: "/assets/rooms/arcadia-room-01.gif",
    width: 724,
    height: 543,
    slots: 0,
    anchor: { x: 0.5, y: 1 },
    alt: "Oficina de mineração de Arcadia com luzes animadas",
    version: 1,
  },
  roomTwo: {
    id: "room_arcadia_lab_v1",
    type: "room",
    path: "/assets/rooms/arcadia-room-02.gif",
    width: 724,
    height: 543,
    slots: 0,
    anchor: { x: 0.5, y: 1 },
    alt: "Laboratório de mineração de Arcadia",
    version: 1,
  },
  battery: {
    id: "ui_battery_v1",
    type: "uiIcon",
    path: "/assets/ui/battery.png",
    width: 126,
    height: 100,
    slots: 0,
    anchor: { x: 0.5, y: 0.5 },
    alt: "Bateria de energia",
    version: 1,
  },
  minerOne: {
    id: "miner_byte_spark_v1",
    type: "miner",
    path: "/assets/miners/miner-01.gif",
    width: 74,
    height: 50,
    slots: 1,
    anchor: { x: 0.5, y: 1 },
    rarity: "common",
    alt: "Minerador Byte Spark com uma fan verde",
    version: 1,
  },
  minerTwo: {
    id: "miner_amber_core_v1",
    type: "miner",
    path: "/assets/miners/miner-02.gif",
    width: 74,
    height: 58,
    slots: 1,
    anchor: { x: 0.5, y: 1 },
    rarity: "uncommon",
    alt: "Minerador Amber Core com uma fan âmbar",
    version: 1,
  },
  minerThree: {
    id: "miner_dual_nova_v1",
    type: "miner",
    path: "/assets/miners/miner-03.gif",
    width: 114,
    height: 54,
    slots: 2,
    anchor: { x: 0.5, y: 1 },
    rarity: "rare",
    alt: "Minerador Dual Nova com duas fans",
    version: 1,
  },
  minerFour: {
    id: "miner_cryo_twin_v1",
    type: "miner",
    path: "/assets/miners/miner-04.gif",
    width: 114,
    height: 54,
    slots: 2,
    anchor: { x: 0.5, y: 1 },
    rarity: "rare",
    alt: "Minerador Cryo Twin com duas fans azuis",
    version: 1,
  },
  minerFive: {
    id: "miner_magenta_flux_v1",
    type: "miner",
    path: "/assets/miners/miner-05.gif",
    width: 114,
    height: 54,
    slots: 2,
    anchor: { x: 0.5, y: 1 },
    rarity: "epic",
    alt: "Minerador Magenta Flux com duas fans",
    version: 1,
  },
  minerSix: {
    id: "miner_violet_bit_v1",
    type: "miner",
    path: "/assets/miners/miner-06.gif",
    width: 74,
    height: 50,
    slots: 1,
    anchor: { x: 0.5, y: 1 },
    rarity: "uncommon",
    alt: "Minerador Violet Bit com uma fan roxa",
    version: 1,
  },
  minerSeven: {
    id: "miner_helix_gold_v1",
    type: "miner",
    path: "/assets/miners/miner-07.gif",
    width: 114,
    height: 58,
    slots: 2,
    anchor: { x: 0.5, y: 1 },
    rarity: "legendary",
    alt: "Minerador Helix Gold com duas fans",
    version: 1,
  },
} satisfies Record<string, AssetManifestEntry>;

