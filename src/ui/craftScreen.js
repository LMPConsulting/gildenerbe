import { SMELT, CRAFT } from '../data/recipes.js';
import { smelt, craft } from '../systems/crafting.js';
import { hasMats, MAT_NAMES } from '../systems/materials.js';
import { RARITY } from '../data/affixes.js';
import { makeRng } from '../core/rng.js';

let seed = 1;
const costStr = (cost) => Object.entries(cost).map(([k, v]) => `${v} ${MAT_NAMES[k]}`).join(', ');

// Schmieden: smelt ore->bars, craft bars->gear with a perfect-cast quality bar.
export function mountCraftScreen(root, run, { onClose } = {}) {
  const hero = run.hero;
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini craft';
  root.appendChild(wrap);

  const matLine = () => ['kupfererz', 'eisenerz', 'kupferbarren', 'eisenbarren', 'kraeuter', 'fisch']
    .map((k) => `${MAT_NAMES[k]}: <b>${run.materials[k] || 0}</b>`).join(' &middot; ');

  function render() {
    wrap.innerHTML = `
      <h2>Schmieden</h2>
      <div class="mat-line">${matLine()}</div>
      <div class="craft-sec"><div class="sec-title">Schmelzen</div>
        ${Object.entries(SMELT).map(([k, r]) => `<div class="craft-row"><span>${r.name} <small>(${costStr(r.in)})</small></span><button data-smelt="${k}" ${hasMats(run.materials, r.in) ? '' : 'disabled'}>Schmelzen</button></div>`).join('')}
      </div>
      <div class="craft-sec"><div class="sec-title">Herstellen</div>
        ${Object.entries(CRAFT).map(([k, r]) => `<div class="craft-row"><span>${r.name} <small>(${costStr(r.in)})</small></span><button data-craft="${k}" ${hasMats(run.materials, r.in) ? '' : 'disabled'}>Schmieden</button></div>`).join('')}
      </div>
      <div class="mini-result" id="cresult"></div>
      <button class="ghost" id="cback">Zurück</button>
    `;
    wrap.querySelectorAll('[data-smelt]').forEach((b) => { b.onclick = () => { smelt(run.materials, b.dataset.smelt); render(); }; });
    wrap.querySelectorAll('[data-craft]').forEach((b) => { b.onclick = () => openCast(b.dataset.craft); });
    wrap.querySelector('#cback').onclick = () => onClose && onClose();
  }

  function openCast(recipeKey) {
    const ov = document.createElement('div');
    ov.className = 'cast-overlay';
    ov.innerHTML = `
      <div class="cast-title">Perfektes Wirken — triff die Mitte!</div>
      <div class="cast-bar"><div class="cast-zone"></div><div class="cast-marker"></div></div>
      <button id="cast-hit">Schlagen!</button>`;
    wrap.appendChild(ov);
    const marker = ov.querySelector('.cast-marker');
    let pos = 0, dir = 1, raf = 0;
    function step() {
      pos += dir * 2.4;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      marker.style.left = pos + '%';
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    ov.querySelector('#cast-hit').onclick = () => {
      cancelAnimationFrame(raf);
      const quality = 1 - Math.abs(pos - 50) / 50;
      ov.remove();
      const item = craft(run.materials, recipeKey, quality, makeRng((performance.now() | 0) + seed++));
      render();
      const res = wrap.querySelector('#cresult');
      if (item) {
        hero.inventory.push(item);
        res.innerHTML = `Hergestellt: <b style="color:${RARITY[item.rarity].color}">${item.name}</b> · Qualität ${(quality * 100) | 0}% — im Inventar.`;
      }
    };
  }
  render();
}
