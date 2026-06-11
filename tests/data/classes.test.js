import { describe, it, expect } from 'vitest';
import { CLASSES, CLASS_IDS, ARMOR_TYPES, RESOURCES } from '../../src/data/classes.js';
import { ABILITIES } from '../../src/data/abilities.js';

describe('classes', () => {
  it('has the three playable classes with distinct armor types', () => {
    expect(CLASS_IDS).toEqual(['krieger', 'schurke', 'magier']);
    const armors = CLASS_IDS.map((id) => CLASSES[id].armorType);
    expect(new Set(armors).size).toBe(3); // platte / leder / stoff all different
    for (const id of CLASS_IDS) expect(ARMOR_TYPES[CLASSES[id].armorType]).toBeTruthy();
  });
  it('every class ability exists and the resource type is known', () => {
    for (const id of CLASS_IDS) {
      const c = CLASSES[id];
      expect(RESOURCES[c.resourceType]).toBeTruthy();
      for (const a of c.abilities) expect(ABILITIES[a], `${id}:${a}`).toBeTruthy();
    }
  });
  it('mage uses a ranged weapon and int; warrior melee/str', () => {
    expect(CLASSES.magier.weapon.kind).toBe('ranged');
    expect(CLASSES.magier.primaryStat).toBe('int');
    expect(CLASSES.krieger.weapon.kind).toBe('melee');
    expect(CLASSES.krieger.primaryStat).toBe('str');
  });
});
