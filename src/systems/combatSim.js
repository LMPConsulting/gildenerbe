import { makeRng } from '../core/rng.js';
import { rollHit } from './damage.js';
import { armorDR } from './stats.js';
import { getAbility } from '../data/abilities.js';

const SLICE = 50; // ms internal fixed sub-step — keeps step(dt) correct for any dt

export function createCombat({ hero, enemies, seed = 1 }) {
  const rng = makeRng(seed);
  const listeners = new Set();
  const pending = [];
  const state = { hero, enemies, result: null, time: 0 };
  const emit = (type, data) => { for (const fn of listeners) fn({ type, ...data }); };

  const aliveEnemies = () => state.enemies.filter((e) => e.alive);

  function applyDamage(src, target, baseDamage) {
    const dr = armorDR(target.armor, src.level);
    const { amount, crit } = rollHit({ baseDamage, critChance: src.critChance ?? 0.05, targetDR: dr }, rng);
    target.hp = Math.max(0, target.hp - amount);
    emit('damage', { sourceId: src.id, targetId: target.id, amount, crit });
    if (target.hp === 0 && target.alive) { target.alive = false; emit('death', { id: target.id }); }
    return amount;
  }

  function gainRage(unit, amt) {
    if (unit.resource?.type === 'rage') {
      unit.resource.value = Math.min(unit.resource.max, unit.resource.value + amt);
    }
  }

  function autoAttack(unit, target) {
    if (!unit.alive || !target || !target.alive) return;
    applyDamage(unit, target, unit.weaponDmg + unit.ap * 0.3);
    gainRage(unit, 10);
  }

  function processPending() {
    while (pending.length) {
      const id = pending.shift();
      const ab = getAbility(id);
      if (!ab || !state.hero.alive) continue;
      const res = state.hero.resource;
      if (res && res.value < ab.cost) continue;
      if ((state.hero.cooldowns[id] ?? 0) > 0) continue;
      if (res) res.value -= ab.cost;
      state.hero.cooldowns[id] = ab.cooldown;
      const h = state.hero;
      const targets = aliveEnemies();
      // spell vs martial scaling; side-view treats ranged like single-target, nova like aoe
      const base = (coefMul = 1) => ab.spellCoef
        ? h.spellPower * ab.spellCoef * coefMul + h.level * 2
        : h.weaponDmg * (ab.weaponCoef || 1) * coefMul + h.ap * (ab.apCoef || 0);
      if (ab.kind === 'attack' || ab.kind === 'ranged') {
        if (targets[0]) applyDamage(h, targets[0], base());
      } else if (ab.kind === 'aoe' || ab.kind === 'nova') {
        for (const t of targets) applyDamage(h, t, base());
      } else if (ab.kind === 'execute') {
        const t = targets[0];
        if (t) {
          const below = t.hp / t.maxHp <= ab.threshold;
          applyDamage(h, t, ab.spellCoef ? base() : h.weaponDmg * (below ? ab.weaponCoef : ab.weaponCoef * 0.4) + h.ap * ab.apCoef);
        }
      } else if (ab.kind === 'defensive') {
        h.blocking = ab.blockMs;
        h.blockReduce = ab.blockReduce;
      }
      emit('ability', { id, sourceId: h.id });
    }
  }

  function decay(unit, dt) {
    for (const k of Object.keys(unit.cooldowns)) {
      unit.cooldowns[k] = Math.max(0, unit.cooldowns[k] - dt);
    }
    if (unit.blocking > 0) unit.blocking = Math.max(0, unit.blocking - dt);
  }

  function enemyTelegraph(e, dt) {
    if (!e.ai) return;
    if (e.telegraph) {
      e.telegraph.remainingMs -= dt;
      if (e.telegraph.remainingMs <= 0) {
        const sp = e.ai.special;
        const blocked = state.hero.blocking > 0;
        const dr = armorDR(state.hero.armor, e.level);
        const { amount, crit } = rollHit({ baseDamage: e.weaponDmg * sp.mult, critChance: 0.05, targetDR: dr }, rng);
        const dealt = blocked ? Math.round(amount * (1 - (state.hero.blockReduce ?? 0.6))) : amount;
        state.hero.hp = Math.max(0, state.hero.hp - dealt);
        emit('damage', { sourceId: e.id, targetId: state.hero.id, amount: dealt, crit });
        if (state.hero.hp === 0 && state.hero.alive) { state.hero.alive = false; emit('death', { id: state.hero.id }); }
        emit('telegraphResolve', { sourceId: e.id, abilityId: sp.name, blocked });
        e.telegraph = null;
        e.ai.timer = sp.everyMs;
      }
      return;
    }
    e.ai.timer -= dt;
    if (e.ai.timer <= 0) {
      e.telegraph = { abilityId: e.ai.special.name, remainingMs: e.ai.special.castMs };
      emit('telegraphStart', { sourceId: e.id, abilityId: e.ai.special.name, castMs: e.ai.special.castMs });
    }
  }

  function checkPhase(e) {
    if (e.phase2At && !e.enraged && e.alive && e.hp / e.maxHp <= e.phase2At) {
      e.enraged = true;
      e.autoAttackEvery = Math.round(e.autoAttackEvery * 0.7);
      emit('enrage', { id: e.id });
    }
  }

  function checkEnd() {
    if (state.result) return;
    if (!state.hero.alive || state.hero.hp === 0) {
      state.hero.alive = false;
      state.result = 'lost';
      emit('end', { result: 'lost' });
    } else if (aliveEnemies().length === 0) {
      state.result = 'won';
      emit('end', { result: 'won' });
    }
  }

  function tick(dt) {
    processPending();
    checkEnd(); if (state.result) return;

    decay(state.hero, dt);

    state.hero.autoAttackTimer -= dt;
    if (state.hero.autoAttackTimer <= 0) {
      state.hero.autoAttackTimer += state.hero.autoAttackEvery;
      autoAttack(state.hero, aliveEnemies()[0]);
    }
    checkEnd(); if (state.result) return;

    for (const e of aliveEnemies()) {
      enemyTelegraph(e, dt);
      if (state.result) return;
      e.autoAttackTimer -= dt;
      if (e.autoAttackTimer <= 0) {
        e.autoAttackTimer += e.autoAttackEvery;
        autoAttack(e, state.hero);
      }
      checkPhase(e);
    }
    checkEnd();
  }

  function step(dt) {
    if (state.result) return;
    let remaining = dt;
    while (remaining > 0 && !state.result) {
      const s = Math.min(SLICE, remaining);
      state.time += s;
      tick(s);
      remaining -= s;
    }
  }

  function queueAbility(id) {
    const ab = getAbility(id);
    if (!ab || state.result || !state.hero.alive) return false;
    const res = state.hero.resource;
    if (res && res.value < ab.cost) return false;
    if ((state.hero.cooldowns[id] ?? 0) > 0) return false;
    pending.push(id);
    return true;
  }

  return {
    state,
    step,
    queueAbility,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
