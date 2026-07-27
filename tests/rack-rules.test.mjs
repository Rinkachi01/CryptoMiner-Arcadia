import assert from "node:assert/strict";
import test from "node:test";
import {
  canInstallAt,
  findNextAvailableSlot,
  getMiner,
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
    { minerId: "byte-spark", slotIndex: 0 },
    { minerId: "amber-core", slotIndex: 2 },
    { minerId: "violet-bit", slotIndex: 5 },
  ];

  assert.equal(findNextAvailableSlot(installed, twoFans), 6);
});

