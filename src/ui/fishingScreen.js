import { createCast } from '../systems/fishing.js';
import { addMat } from '../systems/materials.js';
import { makeRng } from '../core/rng.js';
import { playSfx } from '../audio/index.js';

let seed = 1;

// Angeln (reflex): cast, wait for the bite window, tap in time to catch a fish.
export function mountFishingScreen(root, run, { onClose } = {}) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mini fishing';
  wrap.innerHTML = `
    <h2>Angeln</h2>
    <div class="pond"><div class="bobber">&#9679;</div></div>
    <div class="mini-status" id="fstatus">Wirf die Angel aus.</div>
    <button id="faction">Auswerfen</button>
    <div class="mini-result" id="fresult"></div>
    <button class="ghost" id="fback">Zurück</button>
  `;
  root.appendChild(wrap);
  const statusEl = wrap.querySelector('#fstatus');
  const btn = wrap.querySelector('#faction');
  const resultEl = wrap.querySelector('#fresult');
  let cast = null, timer = null;

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  function tick() {
    cast.step(80);
    if (cast.state === 'window') {
      statusEl.textContent = 'JETZT! Zuschlagen!';
      btn.textContent = 'Zuschlagen!';
      wrap.classList.add('bite');
    }
    if (cast.state === 'failed') {
      stop(); cast = null; wrap.classList.remove('bite');
      statusEl.textContent = 'Verpasst — nochmal?';
      btn.textContent = 'Auswerfen';
    }
  }

  btn.onclick = () => {
    if (!cast) {
      cast = createCast(makeRng((performance.now() | 0) + seed++));
      resultEl.textContent = '';
      statusEl.textContent = 'Warte auf den Biss…';
      btn.textContent = '…';
      wrap.classList.remove('bite');
      timer = setInterval(tick, 80);
      return;
    }
    if (cast.state === 'window') {
      const fish = cast.tap();
      stop(); wrap.classList.remove('bite');
      if (fish) {
        playSfx('fishSplash');
        addMat(run.materials, 'fisch', 1);
        if (fish.id === 'runenaal') addMat(run.materials, 'kraeuter', 2);
        resultEl.innerHTML = `Gefangen: <b>${fish.name}</b>! (Fisch +1)`;
      }
      statusEl.textContent = 'Nochmal angeln?';
      btn.textContent = 'Auswerfen';
      cast = null;
    } else if (cast.state === 'waiting') {
      cast.tap(); stop(); cast = null;
      statusEl.textContent = 'Zu früh! — nochmal?';
      btn.textContent = 'Auswerfen';
    }
  };
  wrap.querySelector('#fback').onclick = () => { stop(); onClose && onClose(); };
}
