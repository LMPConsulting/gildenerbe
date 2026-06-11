import { ENCHANT_COST, enchantChance, applyEnchant } from '../systems/enchanting.js';
import { mountRunePuzzleScreen } from './runePuzzleScreen.js';
import { hasMats, MAT_NAMES } from '../systems/materials.js';
import { RARITY } from '../data/affixes.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

let injected = false;
function inject() {
  if (injected || document.querySelector('style[data-ench]')) return; injected = true;
  const st = document.createElement('style'); st.dataset.ench = '1';
  st.textContent = `
    .ench { width:min(720px,96vw); max-height:92vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
    .ench-item { display:flex; justify-content:space-between; align-items:center; gap:8px; border:1px solid #5a4a2a; border-radius:6px; padding:8px 10px; font-size:13px; }
    .ench-item small { display:block; color:#8a7a52; }
    .ench-item button { min-height:38px; }
    .ench-item button:disabled { opacity:.4; }
    .ench-result { text-align:center; font-size:14px; min-height:20px; }
    .ench-ok { color:#7bd88f; } .ench-bad { color:#e0533d; }
  `;
  document.head.appendChild(st);
}

const costStr = (cost) => Object.entries(cost).map(([k, v]) => `${v}× ${MAT_NAMES[k] || k}`).join(' + ');
let enchSeed = 1;

// account.enchantables: items the orchestrator gathered (hero gear/inv + chest).
export function mountEnchantScreen(root, account, { onClose, onChanged } = {}) {
  inject();
  if (!account.materials) account.materials = {};
  let result = '';

  function render() {
    root.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'ench panel-box'; root.appendChild(wrap);
    const items = (account.enchantables || []).filter((it) => it && it.slot);
    wrap.innerHTML = `<h3>Verzauberungskammer</h3>
      <p class="panel-desc">Verzaubere Ausrüstung mit gesammelten Materialien. Löse das Runen-Rätsel schnell → höhere Erfolgschance.</p>
      <div class="ench-result ${/Erfolg/.test(result) ? 'ench-ok' : /fehl/.test(result) ? 'ench-bad' : ''}">${result}</div>
      <div class="ench-list"></div>
      <button class="ghost" id="ench-close">Schließen</button>`;
    const list = wrap.querySelector('.ench-list');
    if (!items.length) list.innerHTML = '<p class="panel-desc dim">Keine verzauberbaren Gegenstände. Hol welche aus Truhe oder Inventar.</p>';
    for (const it of items) {
      const cost = ENCHANT_COST(it);
      const afford = hasMats(account.materials, cost);
      const row = document.createElement('div'); row.className = 'ench-item';
      row.innerHTML = `<div><b style="color:${RARITY[it.rarity]?.color || '#fff'}">${it.name}</b>
        <small>iLvl ${it.ilvl} · Kosten: ${costStr(cost)}</small></div>
        <button ${afford ? '' : 'disabled'}>Verzaubern</button>`;
      row.querySelector('button').onclick = () => startPuzzle(it);
      list.appendChild(row);
    }
    wrap.querySelector('#ench-close').onclick = () => onClose && onClose();
  }

  function startPuzzle(item) {
    root.innerHTML = '';
    const diff = item.ilvl >= 8 ? 3 : item.ilvl >= 4 ? 2 : 1;
    mountRunePuzzleScreen(root, {
      difficulty: diff, seed: (enchSeed++ * 2654435761) >>> 0,
      onClose: render,
      onSolve: (quality) => {
        const r = applyEnchant(item, quality, makeRng(((Date.now() ^ (enchSeed * 40503)) >>> 0) || 1), account.materials);
        if (r.success) { playSfx('levelUp'); result = `Erfolg (${Math.round(enchantChance(quality) * 100)}%)! +${r.affix.value} ${r.affix.name}`; }
        else if (r.paid) { playSfx('coin'); result = `Verzauberung fehlgeschlagen (${Math.round(enchantChance(quality) * 100)}% Chance) — Materialien verbraucht.`; }
        else result = 'Nicht genug Materialien.';
        onChanged && onChanged();
        render();
      },
    });
  }
  render();
  return () => { root.innerHTML = ''; };
}
