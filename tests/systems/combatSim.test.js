import { describe, it, expect } from 'vitest';
import { createCombat } from '../../src/systems/combatSim.js';
import { createHero } from '../../src/systems/hero.js';
import { makeEnemy } from '../../src/data/enemies.js';

function fight(seed = 1, enemyIds = ['waldwolf']) {
  return createCombat({ hero: createHero('krieger'), enemies: enemyIds.map(makeEnemy), seed });
}

describe('CombatSim auto-attacks', () => {
  it('hero auto-attack lowers enemy hp over time and builds rage', () => {
    const c = fight();
    const enemy = c.state.enemies[0];
    const hpBefore = enemy.hp;
    c.step(2000);
    expect(enemy.hp).toBeLessThan(hpBefore);
    expect(c.state.hero.resource.value).toBeGreaterThan(0);
  });
  it('is deterministic: same seed + same steps => identical enemy hp', () => {
    const a = fight(7); const b = fight(7);
    for (let i = 0; i < 5; i++) { a.step(500); b.step(500); }
    expect(a.state.enemies[0].hp).toBe(b.state.enemies[0].hp);
  });
  it('emits damage events through the subscriber', () => {
    const c = fight();
    const events = [];
    c.on((e) => events.push(e));
    c.step(2000);
    expect(events.some((e) => e.type === 'damage')).toBe(true);
  });
});

describe('CombatSim abilities', () => {
  it('queued heroic_strike spends 15 rage and damages the target', () => {
    const c = fight();
    c.state.hero.resource.value = 50;
    const hp0 = c.state.enemies[0].hp;
    expect(c.queueAbility('heroic_strike')).toBe(true);
    c.step(16);
    expect(c.state.enemies[0].hp).toBeLessThan(hp0);
    expect(c.state.hero.resource.value).toBe(35);
  });
  it('rejects an ability when rage is insufficient', () => {
    const c = fight();
    c.state.hero.resource.value = 5;
    expect(c.queueAbility('heroic_strike')).toBe(false);
  });
  it('rejects an ability still on cooldown', () => {
    const c = fight();
    c.state.hero.resource.value = 100;
    expect(c.queueAbility('whirlwind')).toBe(true); c.step(16);
    expect(c.queueAbility('whirlwind')).toBe(false);
  });
  it('whirlwind hits every alive enemy', () => {
    const c = fight(1, ['waldwolf', 'keiler']);
    c.state.hero.resource.value = 100;
    const before = c.state.enemies.map((e) => e.hp);
    c.queueAbility('whirlwind'); c.step(16);
    c.state.enemies.forEach((e, i) => expect(e.hp).toBeLessThan(before[i]));
  });
  it('execute deals more damage below 20% hp than above', () => {
    const dealt = (hpFrac) => {
      const c = fight();
      c.state.hero.resource.value = 100;
      const e = c.state.enemies[0];
      e.hp = Math.max(1, Math.round(e.maxHp * hpFrac));
      let dmg = 0;
      c.on((ev) => { if (ev.type === 'damage' && ev.sourceId === 'hero') dmg = ev.amount; });
      c.queueAbility('execute'); c.step(16);
      return dmg;
    };
    expect(dealt(0.15)).toBeGreaterThan(dealt(1.0));
  });
});

describe('CombatSim flow + telegraph', () => {
  it('declares won when all enemies die', () => {
    const c = fight();
    c.state.enemies[0].hp = 1;
    let ended = null; c.on((e) => { if (e.type === 'end') ended = e.result; });
    c.step(2000);
    expect(c.state.result).toBe('won'); expect(ended).toBe('won');
  });
  it('declares lost when the hero dies', () => {
    const c = fight();
    c.state.hero.hp = 1;
    c.step(6000);
    expect(c.state.result).toBe('lost');
  });
  it('an active block reduces the boss telegraph hit', () => {
    const measure = (block) => {
      const c = fight(3, ['krell']);
      let started = false, resolvedAtHp = null;
      c.on((e) => {
        if (e.type === 'telegraphStart' && !started) {
          started = true;
          if (block) { c.state.hero.resource.value = 100; c.queueAbility('shield_block'); }
        }
        if (e.type === 'telegraphResolve' && resolvedAtHp === null) {
          resolvedAtHp = c.state.hero.hp;
        }
      });
      for (let i = 0; i < 400 && resolvedAtHp === null && !c.state.result; i++) c.step(50);
      return c.state.hero.maxHp - (resolvedAtHp ?? 0);
    };
    expect(measure(true)).toBeLessThan(measure(false));
  });
});
