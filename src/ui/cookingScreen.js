import { RECIPES, RECIPE_ORDER, buffValue, buffLabel } from '../data/foods.js';
import { canCook, cook, eat } from '../systems/cooking.js';
import { MAT_NAMES } from '../systems/materials.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

const CSS = `
.cok { width: min(720px, 96vw); max-height: 92vh; overflow-y: auto; padding-bottom: 8px; }
.cok-top { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 8px; }
.cok-buff { width: 100%; border: 1px solid #1eba5a; border-radius: 6px; padding: 6px 8px;
  font-size: 12px; color: #9fe8b8; background: rgba(30,186,90,.08); }
.cok-buff b { color: #d6ffe4; }
.cok-cols { display: grid; grid-template-columns: 1fr; gap: 10px; width: 100%; }
@media (orientation: landscape) and (min-width: 620px) { .cok-cols { grid-template-columns: 1fr 1fr; } }
.cok-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.cok-sec { width: 100%; border: 1px solid #5a4a2a; border-radius: 6px; padding: 8px; }
.cok-sec-title { font-size: 12px; color: #c8a04a; margin-bottom: 6px; }
.cok-row { display: flex; justify-content: space-between; align-items: center; gap: 8px;
  font-size: 12px; padding: 4px 0; border-bottom: 1px dashed #2e2618; }
.cok-row:last-child { border-bottom: none; }
.cok-row small { color: #8a7a52; display: block; }
.cok-row button { min-height: 34px; font-size: 12px; padding: 4px 10px; white-space: nowrap; }
.cok-row button:disabled { opacity: .45; cursor: default; }
.cok-stars { color: #ffd76a; letter-spacing: 1px; font-size: 11px; }
.cok-empty { font-size: 12px; color: #8a7a52; padding: 2px 0; }
.cok-toast { font-size: 13px; min-height: 18px; text-align: center; width: 100%; }
.cok-perfect { color: #ffd76a; font-weight: 700; }
.cok-herbs { font-size: 11px; color: #cdbf9a; }
`;

function injectStyle() {
  if (document.querySelector('style[data-cook]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-cook', '');
  el.textContent = CSS;
  document.head.appendChild(el);
}

const stars = (q) => '★'.repeat(q) + '☆'.repeat(5 - q);

let cookSeed = 1;

// Küche: Fische aus dem Teich + Kräuter -> Gerichte mit Stat-Buffs.
// "Essen" setzt account.pendingFood; der nächste Held startet gestärkt.
export function mountCookingScreen(root, account, { onClose, onChanged } = {}) {
  injectStyle();
  if (!Array.isArray(account.fishpond)) account.fishpond = [];
  if (!Array.isArray(account.larder)) account.larder = [];

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini cok';
  root.appendChild(wrap);

  let toast = '';
  const changed = () => { onChanged && onChanged(); };

  function pondSection() {
    const counts = new Map();
    for (const f of account.fishpond) {
      const c = counts.get(f.id) || { ...f, n: 0 };
      c.n += 1;
      counts.set(f.id, c);
    }
    const rows = [...counts.values()]
      .sort((a, b) => a.quality - b.quality)
      .map((f) => `<div class="cok-row"><div><b>${f.n}×</b> ${f.name} <span class="cok-stars">${stars(f.quality)}</span></div></div>`)
      .join('') || '<div class="cok-empty">Leer — wirf am Teich die Angel aus!</div>';
    const herbs = (account.materials && account.materials.kraeuter) || 0;
    return `<div class="cok-sec"><div class="cok-sec-title">Fischteich (${account.fishpond.length})</div>${rows}
      <div class="cok-herbs">Vorrat: ${herbs}× ${MAT_NAMES.kraeuter}</div></div>`;
  }

  function recipeRows() {
    return RECIPE_ORDER.map((id) => {
      const r = RECIPES[id];
      const need = [`${r.fishCount}× Fisch (Q${r.minQuality}+)`];
      if (r.herbs > 0) need.push(`${r.herbs}× ${MAT_NAMES.kraeuter}`);
      const preview = buffLabel(r.stat, buffValue(r, r.minQuality));
      const runsNote = (r.runs || 1) > 1 ? ` · hält ${r.runs} Läufe` : '';
      return `<div class="cok-row"><div><b>${r.name}</b> <small>${need.join(' + ')} → ${preview}${runsNote} (bessere Fische → mehr)</small>
        <small>${r.desc}</small></div>
        <button data-cook="${id}" ${canCook(account, id) ? '' : 'disabled'}>Kochen</button></div>`;
    }).join('');
  }

  function larderSection() {
    const rows = account.larder.map((f) => {
      const label = buffLabel(f.buff.stat, f.buff.value);
      const runsNote = (f.runs || 1) > 1 ? ` · ${f.runs} Läufe` : '';
      return `<div class="cok-row"><div><b>${f.name}</b>${f.perfect ? ' <span class="cok-perfect">Perfekt!</span>' : ''}
        <small>${label}${runsNote} · ${f.servings} Portion(en)</small></div>
        <button data-eat="${f.id}">Essen</button></div>`;
    }).join('') || '<div class="cok-empty">Nichts auf Vorrat — koch etwas!</div>';
    return `<div class="cok-sec"><div class="cok-sec-title">Vorratskammer</div>${rows}</div>`;
  }

  function buffBanner() {
    const p = account.pendingFood;
    if (!p) return '';
    const runsNote = p.runsLeft > 1 ? ` (${p.runsLeft} Läufe)` : '';
    return `<div class="cok-buff">Marschverpflegung: <b>${buffLabel(p.stat, p.value)}</b> durch ${p.label}${runsNote} — wirkt auf den nächsten Helden.</div>`;
  }

  function render() {
    wrap.innerHTML = `
      <div class="cok-top"><h2>Kochen</h2><div class="cok-herbs">${account.gold || 0} Gold</div></div>
      ${buffBanner()}
      <div class="cok-toast">${toast}</div>
      <div class="cok-cols">
        <div class="cok-col">${pondSection()}${larderSection()}</div>
        <div class="cok-col"><div class="cok-sec"><div class="cok-sec-title">Rezepte</div>${recipeRows()}</div></div>
      </div>
      <button class="ghost" id="cok-back">Zurück</button>
    `;
    wrap.querySelector('#cok-back').onclick = () => { onClose && onClose(); };
    wrap.querySelectorAll('[data-cook]').forEach((b) => {
      b.onclick = () => {
        const rng = makeRng(((Date.now() ^ (cookSeed++ * 0x85ebca6b)) >>> 0) || 1);
        const food = cook(account, b.dataset.cook, rng);
        if (!food) return;
        playSfx('loot');
        toast = `<b>${food.name}</b> gekocht: ${buffLabel(food.buff.stat, food.buff.value)}`
          + (food.perfect ? ' — <span class="cok-perfect">Perfekt gegart, +1 Portion!</span>' : '');
        changed();
        render();
      };
    });
    wrap.querySelectorAll('[data-eat]').forEach((b) => {
      b.onclick = () => {
        const f = account.larder.find((x) => x.id === b.dataset.eat);
        if (!eat(account, b.dataset.eat)) return;
        playSfx('levelUp');
        toast = `Gegessen: <b>${f.name}</b> — der nächste Held startet mit ${buffLabel(f.buff.stat, f.buff.value)}.`;
        changed();
        render();
      };
    });
  }

  render();
}
