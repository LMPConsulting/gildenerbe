import { SLOTS } from '../systems/hero.js';
import { equipItem, canEquip, compareItem } from '../systems/equipment.js';
import { depositItem, withdrawItem, ensureChest } from '../systems/chest.js';
import { RARITY, SLOT_NAMES, ARMORTYPE_NAME } from '../data/affixes.js';
import { draftTalents, applyTalent } from '../systems/talentDraft.js';
import { makeRng } from '../core/rng.js';
import { drawSprite } from './sprites.js';

const AFFIX_LABEL = { str: 'Str', agi: 'Bew', int: 'Int', sta: 'Aus', crit: 'Krit', ap: 'AP', armor: 'Rüs', hp: 'HP' };

function affixSummary(affixes) {
  return Object.entries(affixes)
    .map(([k, v]) => (k === 'crit' ? `+${Math.round(v * 100)}% Krit` : `+${v} ${AFFIX_LABEL[k] || k}`))
    .join(', ');
}

// Paper-doll arrangement around the hero sprite.
const DOLL_LEFT = ['kopf', 'brust', 'beine', 'fuesse'];
const DOLL_RIGHT = ['waffe', 'haende', 'ring1', 'ring2'];
const DOLL_BOTTOM = ['amulett', 'umhang'];
const EMPTY_COL = '#6b5a36';

const CANVAS_W = 112;
const CANVAS_H = 104;

const STYLE = `
.char2-doll { display: grid; grid-template-columns: 1fr ${CANVAS_W}px 1fr; gap: 6px;
  align-items: center; border: 1px solid #5a4a2a; border-radius: 6px; padding: 8px;
  background: #221c14; }
.char2-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.char2-canvas { display: block; width: ${CANVAS_W}px; height: ${CANVAS_H}px;
  image-rendering: pixelated; margin: 0 auto; }
.char2-row { display: flex; gap: 6px; }
.char2-row .char2-slot { flex: 1; }
.char2-slot { border: 1px solid #5a4a2a; border-radius: 5px; background: #241f17;
  padding: 4px 6px; display: flex; flex-direction: column; gap: 1px; cursor: pointer;
  min-width: 0; text-align: left; }
.char2-slot.char2-sel { border-color: #ffd24a; box-shadow: 0 0 0 1px #ffd24a inset; }
.char2-slot-name { color: #8a7a52; font-size: 9px; letter-spacing: .5px; }
.char2-slot-item { font-weight: bold; font-size: 10px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.char2-tip { border: 1px solid #c8a04a; border-radius: 6px; background: #2a2418;
  padding: 6px 9px; font-size: 11px; }
.char2-tip-name { font-weight: bold; font-size: 12px; }
.char2-tip-line { color: #9a8a62; font-size: 10px; margin-top: 2px; }
.inv-cmp { font-size: 10px; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 1px; }
.inv-up { color: #7bd88f; } .inv-down { color: #e0533d; }
.inv-locked { color: #b06b6b; font-size: 10px; }
.equip-btn:disabled { opacity: .4; }
`;

// Character + inventory screen as a paper-doll view. Renders hero state;
// equips items and applies talents via the systems modules, then re-renders.
export function mountCharacterScreen(root, hero, { onClose, account = null } = {}) {
  if (account) ensureChest(account);
  if (!document.querySelector('style[data-char]')) {
    const st = document.createElement('style');
    st.setAttribute('data-char', '');
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'char';
  root.appendChild(wrap);

  let offer = null;          // stable talent offer while a draft is pending
  let selectedSlot = null;   // paper-doll slot whose tooltip is open
  function ensureOffer() {
    if (hero.pendingDrafts > 0 && !offer) {
      offer = draftTalents(makeRng(hero.level * 131 + hero.talents.length * 7 + 1), 3);
    }
    if (hero.pendingDrafts === 0) offer = null;
  }

  // Any slot not covered by the fixed layout lands in the bottom row.
  const placed = [...DOLL_LEFT, ...DOLL_RIGHT, ...DOLL_BOTTOM];
  const bottom = [...DOLL_BOTTOM, ...SLOTS.filter((s) => !placed.includes(s))];

  function slotLabel(s) {
    const name = SLOT_NAMES[s] || s;
    return s === 'ring1' ? `${name} I` : s === 'ring2' ? `${name} II` : name;
  }

  function slotBox(s) {
    const it = hero.equipment[s];
    const col = it ? RARITY[it.rarity].color : EMPTY_COL;
    return `<div class="char2-slot${selectedSlot === s ? ' char2-sel' : ''}" data-slot="${s}">
      <span class="char2-slot-name">${slotLabel(s)}</span>
      <span class="char2-slot-item" style="color:${col}">${it ? it.name : '—'}</span>
    </div>`;
  }

  function tipHtml() {
    if (!selectedSlot) return '';
    const it = hero.equipment[selectedSlot];
    if (!it) {
      return `<div class="char2-tip">
        <span class="char2-tip-name" style="color:${EMPTY_COL}">${slotLabel(selectedSlot)}</span>
        <div class="char2-tip-line">leer — nichts angelegt</div>
      </div>`;
    }
    const aff = affixSummary(it.affixes || {});
    return `<div class="char2-tip">
      <span class="char2-tip-name" style="color:${RARITY[it.rarity].color}">${it.name}</span>
      <div class="char2-tip-line">${RARITY[it.rarity].label} · i${it.ilvl}${it.weaponDmg ? ` · Waffe ${it.weaponDmg}` : ''}</div>
      ${aff ? `<div class="char2-tip-line">${aff}</div>` : ''}
    </div>`;
  }

  function paintDoll() {
    const cv = wrap.querySelector('.char2-canvas');
    if (!cv) return;
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);
    cv.width = CANVAS_W * dpr;
    cv.height = CANVAS_H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2a2216';                       // plinth shadow
    ctx.fillRect(12, 99, 88, 4);
    ctx.fillStyle = '#43301d';
    ctx.fillRect(20, 100, 72, 2);
    drawSprite(ctx, 'hero', 8, 4, 6);                // hero large, feet on row 100
  }

  function render() {
    ensureOffer();
    const stats = `HP ${Math.round(hero.hp)}/${hero.maxHp} · AP ${hero.ap} · Krit ${(hero.critChance * 100).toFixed(1)}% · Rüs ${hero.armor} · Waffe ${hero.weaponDmg}`;
    wrap.innerHTML = `
      <div class="char-head">
        <h2>${hero.name} · Stufe ${hero.level}</h2>
        <div class="char-stats">${stats}</div>
      </div>
      <div class="char2-doll">
        <div class="char2-col">${DOLL_LEFT.map(slotBox).join('')}</div>
        <div><canvas class="char2-canvas"></canvas></div>
        <div class="char2-col">${DOLL_RIGHT.map(slotBox).join('')}</div>
      </div>
      <div class="char2-row">${bottom.map(slotBox).join('')}</div>
      ${tipHtml()}
      ${offer ? `
      <div class="draft">
        <div class="draft-title">Talent wählen (${hero.pendingDrafts} offen)</div>
        <div class="draft-opts">
          ${offer.map((t) => `<button class="draft-opt" data-tid="${t.id}"><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}
        </div>
      </div>` : ''}
      <div class="inv">
        <div class="inv-title">Inventar (${hero.inventory.length})</div>
        ${hero.inventory.length === 0 ? '<div class="dim">leer</div>' : hero.inventory.map((it, i) => {
          const cmp = compareItem(hero, it);
          const deltas = cmp.rows.map((r) => {
            const lbl = r.key === 'weaponDmg' ? 'Waffe' : (AFFIX_LABEL[r.key] || r.key);
            const val = r.key === 'crit' ? `${r.delta > 0 ? '+' : ''}${Math.round(r.delta * 100)}% Krit` : `${r.delta > 0 ? '+' : ''}${r.delta} ${lbl}`;
            return `<span class="${r.delta > 0 ? 'inv-up' : 'inv-down'}">${val}</span>`;
          }).join('');
          const typeTag = it.armorType ? `${ARMORTYPE_NAME[it.armorType]} · ` : '';
          return `<div class="inv-row">
            <span class="inv-name" style="color:${RARITY[it.rarity].color}">${it.name}</span>
            <span class="inv-affix">${typeTag}i${it.ilvl} ${affixSummary(it.affixes)}${it.weaponDmg ? ` · Waffe ${it.weaponDmg}` : ''}</span>
            ${cmp.usable ? `<div class="inv-cmp">${deltas || '<span class="dim">±0 zum Angelegten</span>'}</div>` : '<div class="inv-locked">🔒 falsche Klasse</div>'}
            <button class="equip-btn" data-i="${i}" ${cmp.usable ? '' : 'disabled'}>Anlegen</button>
            ${account ? `<button class="dep-btn" data-dep="${i}">→Truhe</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${account ? `<div class="inv">
        <div class="inv-title">Truhe der Gilde (${account.chest.length})</div>
        ${account.chest.length === 0 ? '<div class="dim">leer</div>' : account.chest.map((it, i) => `
          <div class="inv-row">
            <span class="inv-name" style="color:${RARITY[it.rarity].color}">${it.name}</span>
            <span class="inv-affix">${it.armorType ? ARMORTYPE_NAME[it.armorType] + ' · ' : ''}i${it.ilvl} ${affixSummary(it.affixes)}</span>
            ${canEquip(hero, it) ? `<button class="take-btn" data-take="${i}">Nehmen</button>` : '<span class="inv-locked">🔒 andere Klasse</span>'}
          </div>`).join('')}
      </div>` : ''}
      <button class="close-btn">Schließen</button>
    `;

    paintDoll();

    wrap.querySelectorAll('.char2-slot').forEach((b) => {
      b.onclick = () => {
        selectedSlot = selectedSlot === b.dataset.slot ? null : b.dataset.slot;
        render();
      };
    });
    wrap.querySelectorAll('.draft-opt').forEach((b) => {
      b.onclick = () => { applyTalent(hero, b.dataset.tid); offer = null; render(); };
    });
    wrap.querySelectorAll('.equip-btn').forEach((b) => {
      b.onclick = () => { const it = hero.inventory[+b.dataset.i]; if (it && canEquip(hero, it)) { equipItem(hero, it); render(); } };
    });
    wrap.querySelectorAll('.dep-btn').forEach((b) => {
      b.onclick = () => { const it = hero.inventory[+b.dataset.dep]; if (it && account && depositItem(account, hero, it)) render(); };
    });
    wrap.querySelectorAll('.take-btn').forEach((b) => {
      b.onclick = () => { const it = account.chest[+b.dataset.take]; if (it && withdrawItem(account, hero, it)) render(); };
    });
    wrap.querySelector('.close-btn').onclick = () => onClose && onClose();
  }

  render();
}
