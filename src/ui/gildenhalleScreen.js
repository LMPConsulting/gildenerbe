import { BUILDINGS, BUILDING_IDS } from '../data/buildings.js';
import { buildingLevel, buildingCost, buyBuilding } from '../systems/gildenhalle.js';

// The persistent home screen: spend Erbe on Gildenhalle buildings, then send
// out a new hero (who inherits the building bonuses).
export function mountGildenhalle(root, account, { onNewHero, onSaved } = {}) {
  function render() {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'mini gildenhalle';
    wrap.innerHTML = `
      <h1>GILDENERBE</h1>
      <div class="erbe-line">Erbe: <b>${account.meta.erbe}</b> &middot; Läufe: ${account.stats.totalRuns} &middot; Beste Tiefe: ${account.stats.bestZone}</div>
      <div class="buildings">
        ${BUILDING_IDS.map((id) => {
          const lvl = buildingLevel(account.meta, id);
          const b = BUILDINGS[id];
          const max = lvl >= b.maxLevel;
          const cost = buildingCost(id, lvl);
          const afford = account.meta.erbe >= cost && !max;
          return `<div class="bld">
            <div class="bld-info"><b>${b.name}</b> <span class="bld-lvl">Stufe ${lvl}/${b.maxLevel}</span>
              <div class="bld-desc">${b.desc}</div></div>
            <button data-bld="${id}" ${afford ? '' : 'disabled'}>${max ? 'MAX' : cost + ' E'}</button>
          </div>`;
        }).join('')}
      </div>
      <button id="new-hero" class="primary">Neuer Held: Krieger</button>
    `;
    root.appendChild(wrap);
    wrap.querySelectorAll('[data-bld]').forEach((b) => {
      b.onclick = () => { if (buyBuilding(account.meta, b.dataset.bld)) { onSaved && onSaved(); render(); } };
    });
    wrap.querySelector('#new-hero').onclick = () => onNewHero && onNewHero();
  }
  render();
}
