// Overlay panels for the base view: building upgrades, missions, Chronik.
// Owned by the orchestrator (main.js integration); styles live in style.css.
import { BUILDINGS } from '../data/buildings.js';
import { buildingLevel, buildingCost, buyBuilding } from '../systems/gildenhalle.js';
import { CHRONIK_UPGRADES, CHRONIK_IDS, chronikLevel, chronikCost, buyChronik, buildCostMult } from '../systems/chronik.js';
import { MISSIONS, MISSION_IDS, startMission, missionRemainingMs, resolveMissionIfDone } from '../systems/missions.js';
import { buyWall, wallCost, WALL_MAX, repairBase } from '../systems/defense.js';
import { RARITY } from '../data/affixes.js';

function overlay(root) {
  const ov = document.createElement('div');
  ov.className = 'panel-overlay';
  root.appendChild(ov);
  return ov;
}

const fmtMin = (ms) => {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m}min`;
};

// --- Building upgrade panel (also covers wall + repairs via id 'mauer') ---
export function mountBuildingPanel(root, account, buildingId, { onClose, onChanged } = {}) {
  const ov = overlay(root);
  const mult = buildCostMult(account.chronik);

  function render() {
    if (buildingId === 'mauer') {
      const lvl = account.base.wallLevel || 0;
      const max = lvl >= WALL_MAX;
      const cost = Math.round(wallCost(lvl) * mult);
      ov.innerHTML = `
        <div class="panel-box">
          <h3>Mauer &middot; Stufe ${lvl}/${WALL_MAX}</h3>
          <p class="panel-desc">Schützt die Basis bei Überfällen (+Rüstung für den Verteidiger, +25 je Stufe).</p>
          <p class="panel-desc">Basis-Zustand: <b>${account.base.hp}/${account.base.maxHp} HP</b></p>
          <div class="btn-row">
            <button id="p-buy" ${max || account.meta.erbe < cost ? 'disabled' : ''}>${max ? 'MAX' : `Ausbauen (${cost} Erbe)`}</button>
            <button id="p-repair" ${account.base.hp >= account.base.maxHp || account.meta.erbe < 5 ? 'disabled' : ''}>Reparieren (5 Erbe → +10 HP)</button>
          </div>
          <button class="ghost" id="p-close">Schließen</button>
        </div>`;
      ov.querySelector('#p-buy').onclick = () => { buyWall(account, mult); onChanged && onChanged(); render(); };
      ov.querySelector('#p-repair').onclick = () => { repairBase(account, 5); onChanged && onChanged(); render(); };
      ov.querySelector('#p-close').onclick = () => { ov.remove(); onClose && onClose(); };
      return;
    }

    const b = BUILDINGS[buildingId];
    const lvl = buildingLevel(account.meta, buildingId);
    const max = lvl >= b.maxLevel;
    const cost = Math.round(buildingCost(buildingId, lvl) * mult);
    ov.innerHTML = `
      <div class="panel-box">
        <h3>${b.name} &middot; Stufe ${lvl}/${b.maxLevel}</h3>
        <p class="panel-desc">${b.desc}</p>
        ${mult < 1 ? `<p class="panel-desc dim">Baumeister-Rabatt: −${Math.round((1 - mult) * 100)}%</p>` : ''}
        <div class="btn-row">
          <button id="p-buy" ${max || account.meta.erbe < cost ? 'disabled' : ''}>${max ? 'MAX' : `Ausbauen (${cost} Erbe)`}</button>
        </div>
        <button class="ghost" id="p-close">Schließen</button>
      </div>`;
    ov.querySelector('#p-buy').onclick = () => { buyBuilding(account.meta, buildingId, mult); onChanged && onChanged(); render(); };
    ov.querySelector('#p-close').onclick = () => { ov.remove(); onClose && onClose(); };
  }
  render();
  return () => ov.remove();
}

// --- Missions panel ---
export function mountMissionsPanel(root, account, { onClose, onChanged } = {}) {
  const ov = overlay(root);
  let timer = null;

  function render() {
    const now = Date.now();
    const active = account.missions.active;
    const rewards = resolveMissionIfDone(account, now);
    if (rewards) {
      const itemLine = rewards.item
        ? `<div class="drop" style="color:${RARITY[rewards.item.rarity].color}">${rewards.item.name}</div>`
        : '';
      ov.innerHTML = `
        <div class="panel-box">
          <h3>Mission abgeschlossen!</h3>
          <p class="panel-desc">${MISSIONS[rewards.missionId].name}</p>
          <div class="stat">+${rewards.erbe} Erbe</div>
          <div class="stat dim">${Object.entries(rewards.mats).map(([k, v]) => `+${v} ${k}`).join(' · ')}</div>
          ${itemLine}
          <p class="panel-desc dim">Beute-Items landen im Inventar des nächsten Helden über die Waffenkammer-Truhe.</p>
          <button id="p-ok">Weiter</button>
        </div>`;
      // stash mission item for the next hero
      if (rewards.item) {
        account.missionStash = account.missionStash || [];
        account.missionStash.push(rewards.item);
      }
      onChanged && onChanged();
      ov.querySelector('#p-ok').onclick = render;
      return;
    }

    if (active) {
      const rem = missionRemainingMs(account, now);
      ov.innerHTML = `
        <div class="panel-box">
          <h3>Mission läuft</h3>
          <p class="panel-desc">${MISSIONS[active.id].name}</p>
          <div class="stat">Rückkehr in <b>${fmtMin(rem)}</b></div>
          <p class="panel-desc dim">Der Späher kehrt auch zurück, während du spielst oder offline bist.</p>
          <button class="ghost" id="p-close">Schließen</button>
        </div>`;
      ov.querySelector('#p-close').onclick = close;
      if (!timer) timer = setInterval(render, 30000);
      return;
    }

    ov.innerHTML = `
      <div class="panel-box">
        <h3>Missionen</h3>
        <p class="panel-desc">Schicke einen Späher aus — er kehrt nach echter Zeit mit Beute zurück.</p>
        ${MISSION_IDS.map((id) => {
          const m = MISSIONS[id];
          const afford = account.meta.erbe >= (m.cost.erbe || 0);
          return `<div class="mission-row">
            <div><b>${m.name}</b><div class="dim">${m.desc} · ${m.durationMin}min</div></div>
            <button data-m="${id}" ${afford ? '' : 'disabled'}>${m.cost.erbe} E</button>
          </div>`;
        }).join('')}
        <button class="ghost" id="p-close">Schließen</button>
      </div>`;
    ov.querySelectorAll('[data-m]').forEach((b) => {
      b.onclick = () => { startMission(account, b.dataset.m, Date.now()); onChanged && onChanged(); render(); };
    });
    ov.querySelector('#p-close').onclick = close;
  }

  function close() { if (timer) clearInterval(timer); ov.remove(); onClose && onClose(); }
  render();
  return close;
}

// --- Chronik panel (meta-meta upgrades) ---
export function mountChronikPanel(root, account, { onClose, onChanged } = {}) {
  const ov = overlay(root);
  function render() {
    ov.innerHTML = `
      <div class="panel-box">
        <h3>Chronik &middot; ${account.chronik.punkte} Punkte</h3>
        <p class="panel-desc">Bleibt über den Fall der Basis hinaus. Basis ${account.base.generation}. Gefallene Basen: ${account.stats.basesLost || 0}.</p>
        ${CHRONIK_IDS.map((id) => {
          const u = CHRONIK_UPGRADES[id];
          const lvl = chronikLevel(account.chronik, id);
          const max = lvl >= u.maxLevel;
          const cost = chronikCost(id, lvl);
          return `<div class="mission-row">
            <div><b>${u.name}</b> <span class="dim">St. ${lvl}/${u.maxLevel}</span><div class="dim">${u.desc}</div></div>
            <button data-c="${id}" ${max || account.chronik.punkte < cost ? 'disabled' : ''}>${max ? 'MAX' : cost + ' P'}</button>
          </div>`;
        }).join('')}
        <button class="ghost" id="p-close">Schließen</button>
      </div>`;
    ov.querySelectorAll('[data-c]').forEach((b) => {
      b.onclick = () => { buyChronik(account.chronik, b.dataset.c); onChanged && onChanged(); render(); };
    });
    ov.querySelector('#p-close').onclick = () => { ov.remove(); onClose && onClose(); };
  }
  render();
  return () => ov.remove();
}
