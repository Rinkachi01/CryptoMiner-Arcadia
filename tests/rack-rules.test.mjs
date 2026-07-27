import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTERY_HOURS,
  BLOCK_INTERVAL_SECONDS,
  ENERGY_CLAIM_COOLDOWN_HOURS,
  ENERGY_CLAIM_HOURS,
  MAX_ENERGY_HOURS,
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

test("catálogo mantém progressão virtual conservadora", () => {
  const paybackDays = miners.map(calculateVirtualPaybackDays);
  assert.equal(paybackDays.every((days) => days >= 240), true);
  assert.equal(paybackDays.every((days) => days <= 400), true);
  assert.ok(miners.at(-1).powerGh / miners.at(-1).slotSize > miners[0].powerGh);
});
