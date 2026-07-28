import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTERY_HOURS,
  BATTERY_PRICE_CMA,
  BLOCK_INTERVAL_SECONDS,
  ENERGY_CLAIM_COOLDOWN_HOURS,
  ENERGY_CLAIM_HOURS,
  MAX_ENERGY_HOURS,
  RACK_PRICE_CMA,
  ROOM_RACK_CAPACITY,
  calculateVirtualPaybackDays,
  canInstallAt,
  findNextAvailableSlot,
  getMiner,
  miners,
  pools,
} from "../app/game-rules.ts";

test("minerador de uma fan ocupa um único slot", () => {
  const oneFan = getMiner("byte-spark");
  assert.ok(oneFan);
  assert.equal(oneFan.slotSize, 1);
  assert.equal(canInstallAt([], oneFan, 1), true);
});

test("minerador de duas fans não atravessa uma prateleira", () => {
  const twoFans = getMiner("dual-nova");
  assert.ok(twoFans);
  assert.equal(twoFans.slotSize, 2);
  assert.equal(canInstallAt([], twoFans, 0), true);
  assert.equal(canInstallAt([], twoFans, 1), false);
});

test("encaixe de duas fans exige dois slots contínuos livres", () => {
  const twoFans = getMiner("dual-nova");
  assert.ok(twoFans);

  const installed = [
    { instanceId: "one", minerId: "byte-spark", slotIndex: 0 },
    { instanceId: "two", minerId: "amber-core", slotIndex: 2 },
    { instanceId: "three", minerId: "violet-bit", slotIndex: 5 },
  ];

  assert.equal(findNextAvailableSlot(installed, twoFans), 6);
});

test("todas as pools usam blocos de dez minutos", () => {
  assert.equal(BLOCK_INTERVAL_SECONDS, 600);
  assert.equal(pools.every((pool) => pool.blockSeconds === 600), true);
});

test("cada sala possui doze posições de rack", () => {
  assert.equal(ROOM_RACK_CAPACITY, 12);
});

test("energia trabalha em ciclos de doze horas", () => {
  assert.equal(BATTERY_HOURS, 12);
  assert.equal(ENERGY_CLAIM_HOURS, 12);
  assert.equal(ENERGY_CLAIM_COOLDOWN_HOURS, 12);
  assert.equal(MAX_ENERGY_HOURS, 96);
});

test("catálogo mantém preços acessíveis e progressão virtual conservadora", () => {
  const paybackDays = miners.map(calculateVirtualPaybackDays);
  assert.equal(
    paybackDays.every((days) => Number.isFinite(days) && days > 0),
    true,
  );
  assert.equal(Math.max(...miners.map((miner) => miner.priceCma)) <= 84, true);
  assert.equal(RACK_PRICE_CMA, 0.35);
  assert.equal(BATTERY_PRICE_CMA, 0.05);
  assert.ok(miners.at(-1).powerGh / miners.at(-1).slotSize > miners[0].powerGh);
});

test("Violet Bit é premium mesmo usando apenas uma fan", () => {
  const violet = getMiner("violet-bit");
  const cryo = getMiner("cryo-twin");
  const magenta = getMiner("magenta-flux");
  assert.ok(violet && cryo && magenta);
  assert.equal(violet.fanCount, 1);
  assert.equal(violet.slotSize, 1);
  assert.equal(violet.powerGh > cryo.powerGh, true);
  assert.equal(violet.priceCma > cryo.priceCma, true);
  assert.equal(violet.powerGh < magenta.powerGh, true);
  assert.equal(violet.priceCma < magenta.priceCma, true);
});
