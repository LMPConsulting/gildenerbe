// Start: Leinwand und Eingabefläche anlegen, Szene bauen, Spielschleife.
// (Erste Fassung: Welt, Haufen, Laufen, Graben, Verkaufen.)

import * as THREE from '../vendor/three.module.min.js';
import { WELT, LADUNGEN_3D, SPIELER } from './daten.js';
import { zufallNeu } from './zufall.js';
import { haufenNeu, haufenSetzen, haufenAbtragen, haufenStrahl, haufenRest } from './haufen.js';
import { szeneBauen } from './grafik/szene3d.js';
import { hofBauen } from './grafik/hof3d.js';
import { haufenAnsichtBauen } from './grafik/haufen3d.js';
import { steuerungBauen } from './steuerung.js';
import { spielerNeu, spielerBewegen, spielerKamera, blickRichtung } from './spieler.js';
import { halme, geld } from './format.js';

function hauptStart() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const leinwand = document.createElement('canvas');
  leinwand.className = 'welt';
  const flaeche = document.createElement('div');
  flaeche.className = 'eingabe';
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = '<div class="kopfleiste"><span class="geld"></span><span class="rest"></span><span class="last"></span></div>'
    + '<div class="fadenkreuz"></div><div class="hinweistext"></div>'
    + '<button class="knopf aktion" aria-label="Aktion">Graben</button><button class="knopf sprung" aria-label="Springen">⤒</button>';
  app.append(leinwand, flaeche, hud);

  const s3 = szeneBauen(leinwand, 'mittel');
  const hof = hofBauen(s3.szene, s3.qualitaet);
  const z = zufallNeu(20260930);
  const hf = haufenNeu({ ...LADUNGEN_3D[0], mitteX: WELT.haufenX, mitteZ: WELT.haufenZ, zufall: z });
  const hAnsicht = haufenAnsichtBauen(s3.szene, hf, s3.qualitaet);
  const sp = spielerNeu();
  const stand = { geld: 0, last: 0 };
  const st = steuerungBauen(flaeche);
  const aktionKnopf = hud.querySelector('.aktion');
  const sprungKnopf = hud.querySelector('.sprung');
  aktionKnopf.addEventListener('pointerdown', (ev) => { ev.preventDefault(); st.aktionDruecken(true); });
  aktionKnopf.addEventListener('pointerup', () => st.aktionDruecken(false));
  aktionKnopf.addEventListener('pointercancel', () => st.aktionDruecken(false));
  sprungKnopf.addEventListener('pointerdown', (ev) => { ev.preventDefault(); st.springenDruecken(); });
  window.addEventListener('resize', () => s3.groesseAnpassen());

  const umgebung = { kollider: hof.kollider, flaechen: [], haufen: hf };
  const strahl = new THREE.Raycaster();
  const hinweis = hud.querySelector('.hinweistext');
  let letzte = performance.now();
  let zeit = 0;
  let stichPause = 0;

  function ziel() {
    const [dx, dy, dz] = blickRichtung(sp);
    const k = s3.kamera.position;
    const treffer = haufenStrahl(hf, k.x, k.y, k.z, dx, dy, dz, SPIELER.reichweite);
    if (treffer) return { art: 'haufen', ...treffer };
    strahl.set(k, new THREE.Vector3(dx, dy, dz));
    strahl.far = SPIELER.reichweite;
    const t = strahl.intersectObject(hof.stand, true);
    if (t.length) return { art: 'stand' };
    return null;
  }

  function schleife(jetzt) {
    const dt = Math.min(0.05, Math.max(0, (jetzt - letzte) / 1000));
    letzte = jetzt;
    zeit += dt;
    const e = st.lesen();
    const tempo = spielerBewegen(sp, e, dt, umgebung);
    spielerKamera(sp, s3.kamera, tempo);
    const zi = ziel();
    stichPause -= dt;
    if (zi && zi.art === 'haufen') {
      aktionKnopf.textContent = 'Graben';
      hinweis.textContent = '';
      if ((e.aktion || e.aktionNeu) && stichPause <= 0) {
        stand.last += haufenAbtragen(hf, zi.x, zi.z, 12, 0.5);
        stichPause = 0.33;
      }
    } else if (zi && zi.art === 'stand') {
      aktionKnopf.textContent = 'Verkaufen';
      hinweis.textContent = stand.last > 0 ? `${halme(stand.last)} Halme verkaufen` : 'Heu verkaufen';
      if (e.aktionNeu && stand.last > 0) {
        stand.geld += stand.last * 0.0222;
        stand.last = 0;
      }
    } else {
      aktionKnopf.textContent = 'Aktion';
      hinweis.textContent = '';
    }
    haufenSetzen(hf, 3);
    hAnsicht.schritt(hf);
    s3.schritt(dt);
    const m = Math.floor(zeit / 60);
    hof.uhr.setze(`${m}:${String(Math.floor(zeit % 60)).padStart(2, '0')}`);
    hud.querySelector('.geld').textContent = geld(stand.geld);
    hud.querySelector('.rest').textContent = `${halme(haufenRest(hf))} Halme`;
    hud.querySelector('.last').textContent = `${halme(stand.last)} in der Hand`;
    s3.zeichnen();
    st.verbraucht();
    requestAnimationFrame(schleife);
  }
  requestAnimationFrame(schleife);
  window.__heuhaufen3d = { s3, hf, sp, stand };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hauptStart);
else hauptStart();
