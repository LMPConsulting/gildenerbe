import { SLOTS } from '../systems/hero.js';
import { equipItem } from '../systems/equipment.js';
import { RARITY, SLOT_NAMES } from '../data/affixes.js';
import { draftTalents, applyTalent } from '../systems/talentDraft.js';
import { makeRng } from '../core/rng.js';

const AFFIX_LABEL = { str: 'Str', agi: 'Bew', int: 'Int', sta: 'Aus', crit: 'Krit', ap: 'AP', armor: 'Rüs', hp: 'HP' };

function affixSummary(affixes) {
  return Object.entries(affixes)
    .map(([k, v]) => (k === 'crit' ? `+${Math.round(v * 100)}% Krit` : `+${v} ${AFFIX_LABEL[k] || k}`))
    .join(', ');
}

// Character + inventory screen. Renders hero state; equips items and applies
// talents via the systems modules, then re-renders.
export function mountCharacterScreen(root, hero, { onClose } = {}) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'char';
  root.appendChild(wrap);

  let offer = null; // stable talent offer while a draft is pending
  function ensureOffer() {
    if (hero.pendingDrafts > 0 && !offer) {
      offer = draftTalents(makeRng(hero.level * 131 + hero.talents.length * 7 + 1), 3);
    }
    if (hero.pendingDrafts === 0) offer = null;
  }

  function render() {
    ensureOffer();
    const stats = `HP ${Math.round(hero.hp)}/${hero.maxHp} · AP ${hero.ap} · Krit ${(hero.critChance * 100).toFixed(1)}% · Rüs ${hero.armor} · Waffe ${hero.weaponDmg}`;
    wrap.innerHTML = `
      <div class="char-head">
        <h2>${hero.name} · Stufe ${hero.level}</h2>
        <div class="char-stats">${stats}</div>
      </div>
      ${offer ? `
      <div class="draft">
        <div class="draft-title">Talent wählen (${hero.pendingDrafts} offen)</div>
        <div class="draft-opts">
          ${offer.map((t) => `<button class="draft-opt" data-tid="${t.id}"><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}
        </div>
      </div>` : ''}
      <div class="equip-grid">
        ${SLOTS.map((s) => {
          const it = hero.equipment[s];
          const col = it ? RARITY[it.rarity].color : '#6b5a36';
          return `<div class="equip-slot"><span class="slot-name">${SLOT_NAMES[s] || s}</span><span class="slot-item" style="color:${col}">${it ? it.name : '—'}</span></div>`;
        }).join('')}
      </div>
      <div class="inv">
        <div class="inv-title">Inventar (${hero.inventory.length})</div>
        ${hero.inventory.length === 0 ? '<div class="dim">leer</div>' : hero.inventory.map((it, i) => `
          <div class="inv-row">
            <span class="inv-name" style="color:${RARITY[it.rarity].color}">${it.name}</span>
            <span class="inv-affix">i${it.ilvl} ${affixSummary(it.affixes)}${it.weaponDmg ? ` · Waffe ${it.weaponDmg}` : ''}</span>
            <button class="equip-btn" data-i="${i}">Anlegen</button>
          </div>`).join('')}
      </div>
      <button class="close-btn">Schließen</button>
    `;

    wrap.querySelectorAll('.draft-opt').forEach((b) => {
      b.onclick = () => { applyTalent(hero, b.dataset.tid); offer = null; render(); };
    });
    wrap.querySelectorAll('.equip-btn').forEach((b) => {
      b.onclick = () => { const it = hero.inventory[+b.dataset.i]; if (it) { equipItem(hero, it); render(); } };
    });
    wrap.querySelector('.close-btn').onclick = () => onClose && onClose();
  }

  render();
}
