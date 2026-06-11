import {
  CAST_COST, canFish, equippedRod, equipRod, createCast, resolveCast, craftRod,
} from '../systems/fishing.js';
import { ROD_TIERS, ROD_ORDER } from '../data/rods.js';
import { MAT_NAMES, hasMats } from '../systems/materials.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

const CSS = `
.fsh { width: min(720px, 96vw); max-height: 92vh; overflow-y: auto; padding-bottom: 8px; }
.fsh-top { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 8px; }
.fsh-gold { color: #ffd76a; font-size: 13px; font-weight: 700; }
.fsh-cols { display: grid; grid-template-columns: 1fr; gap: 10px; width: 100%; }
@media (orientation: landscape) and (min-width: 620px) { .fsh-cols { grid-template-columns: 1fr 1fr; } }
.fsh-col { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.fsh-rod { width: 100%; border: 1px solid #5a4a2a; border-radius: 6px; padding: 6px 8px; font-size: 12px; }
.fsh-rod-name { color: #e8d5ab; font-weight: 700; }
.fsh-durbar { height: 8px; border: 1px solid #5a4a2a; border-radius: 4px; margin-top: 4px; overflow: hidden; background: #17120c; }
.fsh-durfill { height: 100%; background: #1eba5a; transition: width .2s; }
.fsh-durfill.low { background: #c8a04a; }
.fsh-durfill.crit { background: #e0533d; }
.fsh-hint { font-size: 12px; color: #e0a93d; text-align: center; min-height: 16px; }
.fsh-cast { min-height: 44px; min-width: 200px; font-weight: 700; }
.fsh-cast:disabled { opacity: .45; cursor: default; }
.fsh-cast.window { background: #e0533d; color: #fff; }
.fsh-result { font-size: 13px; min-height: 18px; text-align: center; }
.fsh-stars { color: #ffd76a; letter-spacing: 1px; }
.fsh-sec { width: 100%; border: 1px solid #5a4a2a; border-radius: 6px; padding: 8px; }
.fsh-sec-title { font-size: 12px; color: #c8a04a; margin-bottom: 6px; }
.fsh-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; padding: 4px 0; border-bottom: 1px dashed #2e2618; }
.fsh-row:last-child { border-bottom: none; }
.fsh-row small { color: #8a7a52; display: block; }
.fsh-row button { min-height: 34px; font-size: 12px; padding: 4px 10px; }
.fsh-row button:disabled { opacity: .45; cursor: default; }
.fsh-broke { color: #e0533d; font-weight: 700; }
.fsh-pondcount { font-size: 11px; color: #8a7a52; }
`;

function injectStyle() {
  if (document.querySelector('style[data-fish]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-fish', '');
  el.textContent = CSS;
  document.head.appendChild(el);
}

const stars = (q) => '★'.repeat(q) + '☆'.repeat(5 - q);

function costLabel(tier) {
  const parts = [`${tier.craftCost.gold} Gold`];
  for (const [k, v] of Object.entries(tier.craftCost.materials)) parts.push(`${v}× ${MAT_NAMES[k] || k}`);
  return parts.join(' + ');
}

let castSeed = 1;

// Hub-Angeln: Rute ausrüsten, Gold pro Wurf zahlen, im Biss-Fenster "Anschlag!"
// tippen. Gefangene Fische landen im Fischteich (-> Kochen).
export function mountFishingScreen(root, account, { onClose, onChanged } = {}) {
  injectStyle();
  if (!Array.isArray(account.rods)) account.rods = [];
  if (!Array.isArray(account.fishpond)) account.fishpond = [];

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini fishing fsh';
  root.appendChild(wrap);

  let cast = null, castRng = null, timer = null;
  let lastResult = '';
  let settledAt = 0;

  const changed = () => { onChanged && onChanged(); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  function settle() {
    const res = resolveCast(account, cast, castRng);
    stop();
    cast = null; castRng = null;
    settledAt = Date.now();
    if (res.fish) {
      playSfx('fishSplash');
      lastResult = `Gefangen: <b>${res.fish.name}</b> <span class="fsh-stars">${stars(res.fish.quality)}</span> → Fischteich`;
    } else {
      lastResult = 'Nichts gefangen — der Köder ist trotzdem weg.';
    }
    if (res.rodBroke) lastResult += ' <span class="fsh-broke">Deine Rute ist zerbrochen!</span>';
    changed();
    render();
  }

  function tick() {
    if (!cast) return;
    cast.step(80);
    const statusEl = wrap.querySelector('#fsh-status');
    const btn = wrap.querySelector('#fsh-cast');
    if (cast.state === 'window') {
      if (statusEl) statusEl.textContent = 'JETZT!';
      if (btn) { btn.textContent = 'Anschlag!'; btn.classList.add('window'); }
      wrap.classList.add('bite');
    }
    if (cast.state === 'failed') { wrap.classList.remove('bite'); settle(); }
  }

  function startCast() {
    if (cast || !canFish(account)) return;
    castRng = makeRng(((Date.now() ^ (castSeed++ * 0x9e3779b9)) >>> 0) || 1);
    cast = createCast(castRng, equippedRod(account));
    lastResult = '';
    render();
    timer = setInterval(tick, 80);
  }

  function tapCast() {
    if (!cast) {
      if (Date.now() - settledAt < 350) return; // verschluckt Tipper direkt nach Wurf-Ende
      return startCast();
    }
    if (cast.state === 'window') {
      cast.tap(); // fängt den Fisch
      wrap.classList.remove('bite');
      settle();
    } else if (cast.state === 'waiting') {
      cast.tap(); // zu früh -> failed
      settle();
    }
  }

  function hintText() {
    const rod = equippedRod(account);
    if (!rod) return 'Keine Rute! Bau dir unten eine — ohne Rute kein Fang.';
    if ((account.gold || 0) < CAST_COST) return `Zu wenig Gold — jeder Wurf kostet ${CAST_COST} Gold.`;
    return '';
  }

  function rodPanel() {
    const rod = equippedRod(account);
    if (!rod) return '<div class="fsh-rod"><span class="fsh-rod-name">Keine Rute ausgerüstet</span></div>';
    const pct = Math.max(0, Math.round((rod.durability / rod.maxDurability) * 100));
    const cls = pct <= 20 ? 'crit' : pct <= 45 ? 'low' : '';
    return `<div class="fsh-rod">
      <span class="fsh-rod-name">${rod.name}</span> — Haltbarkeit ${rod.durability}/${rod.maxDurability} · Glück +${rod.luck}
      <div class="fsh-durbar"><div class="fsh-durfill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
  }

  function rodsSection() {
    const owned = account.rods.map((r) => {
      const isEq = equippedRod(account) === r;
      return `<div class="fsh-row"><div><b>${r.name}</b> <small>Haltbarkeit ${r.durability}/${r.maxDurability} · Glück +${r.luck}</small></div>
        <button data-equip="${r.id}" ${isEq ? 'disabled' : ''}>${isEq ? 'Ausgerüstet' : 'Ausrüsten'}</button></div>`;
    }).join('') || '<div class="fsh-row"><small>Keine Ruten — Zeit zu schnitzen!</small></div>';

    const craft = ROD_ORDER.map((id) => {
      const t = ROD_TIERS[id];
      const affordable = (account.gold || 0) >= t.craftCost.gold
        && account.materials && hasMats(account.materials, t.craftCost.materials);
      return `<div class="fsh-row"><div><b>${t.name}</b> <small>${t.maxDurability} Würfe · Glück +${t.luck} — ${t.desc}</small>
        <small>${costLabel(t)}</small></div>
        <button data-craft="${id}" ${affordable ? '' : 'disabled'}>Bauen</button></div>`;
    }).join('');

    return `<div class="fsh-sec"><div class="fsh-sec-title">Deine Ruten</div>${owned}</div>
      <div class="fsh-sec"><div class="fsh-sec-title">Ruten bauen (Werkbank)</div>${craft}</div>`;
  }

  function render() {
    const casting = !!cast;
    wrap.innerHTML = `
      <div class="fsh-top"><h2>Angeln</h2><div class="fsh-gold">${account.gold || 0} Gold</div></div>
      <div class="fsh-cols">
        <div class="fsh-col">
          ${rodPanel()}
          <div class="pond"><div class="bobber">&#9679;</div></div>
          <div class="mini-status" id="fsh-status">${casting ? 'Warte auf den Biss…' : 'Wirf die Angel aus.'}</div>
          <button id="fsh-cast" class="fsh-cast" ${!casting && !canFish(account) ? 'disabled' : ''}>
            ${casting ? '…' : `Auswerfen (kostet ${CAST_COST} Gold)`}</button>
          <div class="fsh-hint">${casting ? '' : hintText()}</div>
          <div class="fsh-result" id="fsh-result">${lastResult}</div>
          <div class="fsh-pondcount">Im Fischteich: ${account.fishpond.length} Fisch(e) — verkoche sie in der Küche!</div>
        </div>
        <div class="fsh-col">${rodsSection()}</div>
      </div>
      <button class="ghost" id="fsh-back">Zurück</button>
    `;
    wrap.querySelector('#fsh-cast').onclick = tapCast;
    wrap.querySelector('#fsh-back').onclick = () => {
      if (cast) { cast.state = 'failed'; settle(); } // angefangener Wurf ist bezahlt
      stop();
      onClose && onClose();
    };
    wrap.querySelectorAll('[data-craft]').forEach((b) => {
      b.onclick = () => {
        if (cast) return;
        if (craftRod(account, b.dataset.craft)) {
          playSfx('coin');
          lastResult = `<b>${ROD_TIERS[b.dataset.craft].name}</b> gebaut!`;
          changed();
          render();
        }
      };
    });
    wrap.querySelectorAll('[data-equip]').forEach((b) => {
      b.onclick = () => {
        if (cast) return;
        if (equipRod(account, b.dataset.equip)) { playSfx('click'); changed(); render(); }
      };
    });
  }

  render();
}
