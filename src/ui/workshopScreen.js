import { MAT_NAMES } from '../systems/materials.js';
import { RARITY } from '../data/affixes.js';
import { mountFishingScreen } from './fishingScreen.js';
import { mountCraftScreen } from './craftScreen.js';
import { mountRunePuzzleScreen } from './runePuzzleScreen.js';
import { enchantItem, enchantValue } from '../systems/enchanting.js';

// Werkstatt hub: materials + the three profession minigames.
export function mountWorkshopScreen(root, run, { onClose } = {}) {
  const hero = run.hero;

  function hub() {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'mini workshop';
    wrap.innerHTML = `
      <h2>Werkstatt</h2>
      <div class="mat-line">${['kupfererz', 'eisenerz', 'kupferbarren', 'eisenbarren', 'kraeuter', 'fisch'].map((k) => `${MAT_NAMES[k]}: <b>${run.materials[k] || 0}</b>`).join(' &middot; ')}</div>
      <div class="hub-btns">
        <button id="w-fish">Angeln</button>
        <button id="w-craft">Schmieden</button>
        <button id="w-ench">Verzaubern</button>
      </div>
      <button class="ghost" id="w-back">Zurück</button>
    `;
    root.appendChild(wrap);
    wrap.querySelector('#w-fish').onclick = () => mountFishingScreen(root, run, { onClose: hub });
    wrap.querySelector('#w-craft').onclick = () => mountCraftScreen(root, run, { onClose: hub });
    wrap.querySelector('#w-ench').onclick = enchantPick;
    wrap.querySelector('#w-back').onclick = () => onClose && onClose();
  }

  function enchantPick() {
    const items = [...Object.values(hero.equipment).filter(Boolean), ...hero.inventory];
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'mini';
    wrap.innerHTML = `
      <h2>Verzaubern</h2>
      <div class="rune-hint">Wähle ein Ausrüstungsstück, dann löse das Runen-Puzzle.</div>
      <div class="ench-list">${items.length
        ? items.map((it, i) => `<button class="ench-item" data-i="${i}" style="color:${RARITY[it.rarity].color}">${it.name}${it.enchanted ? ' ✦' : ''}</button>`).join('')
        : '<div class="dim">keine Items</div>'}</div>
      <button class="ghost" id="e-back">Zurück</button>
    `;
    root.appendChild(wrap);
    wrap.querySelectorAll('.ench-item').forEach((b) => {
      b.onclick = () => {
        const item = items[+b.dataset.i];
        mountRunePuzzleScreen(root, {
          onSolve: (q) => {
            const key = item.slot === 'waffe' ? 'ap' : 'str';
            enchantItem(hero, item, { key, value: enchantValue(q, key) });
            hub();
          },
          onClose: enchantPick,
        });
      };
    });
    wrap.querySelector('#e-back').onclick = hub;
  }

  hub();
}
