// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { standNeu, spielTakt } from '../../heuhaufen3d/src/spiel.js';
import { auftrag, auftragLohn } from '../../heuhaufen3d/src/wirtschaft.js';
import { lauf } from '../../heuhaufen3d/src/welt.js';
import { bauSetzen } from '../../heuhaufen3d/src/bauen.js';
import { netzHolen, automatikSchritt } from '../../heuhaufen3d/src/automatik.js';
import { netzSchalten } from '../../heuhaufen3d/src/versorgung.js';
import { scannerLeeren } from '../../heuhaufen3d/src/maschinen.js';
import { lasterAblehnen } from '../../heuhaufen3d/src/laster.js';
import { geld } from '../../heuhaufen3d/src/format.js';
import { baukatalogZeigen, bauHudBauen } from '../../heuhaufen3d/src/ui/bauen.js';
import { maschinePanelZeigen } from '../../heuhaufen3d/src/ui/maschine.js';
import { auftragstafelZeigen } from '../../heuhaufen3d/src/ui/auftrag.js';

const ALLES = ['foerderband', 'kolbenrechen', 'elektrizitaet', 'strommast', 'weiche', 'silo', 'greifarm', 'drohne', 'auftraege',
  'piepser', 'scanner', 'feilschen', 'rohrwerfer', 'arbeitslampen'];
function hof(seed = 11) {
  const s = standNeu(seed);
  s.geld = 1e7;
  for (const t of ALLES) s.tech[t] = 1;
  s.rev++;
  return s;
}
const laufen = (s, sekunden, dt = 1 / 30) => {
  for (let t = 0; t < sekunden; t += dt) spielTakt(s, dt, [automatikSchritt]);
};

/** Sichtbarer Text, geschützte Leerzeichen als normale. */
const norm = (t) => t.replace(/\s+/g, ' ').trim();
const text = (el) => norm(el.textContent);
/** Texte der Kinder mit Leerzeichen dazwischen (dt/dd, Beschriftung und Wert). */
const teile = (el) => [...el.children].map(text).filter(Boolean).join(' ');
const knopfMit = (wurzel, t) => [...wurzel.querySelectorAll('button')].find((b) => text(b) === t);
function setzen(s, typ, x, z) {
  const r = bauSetzen(s, typ, x, z, 0);
  expect(r.ok, `${typ} bei ${x}, ${z}: ${r.grund}`).toBe(true);
  return r.bau;
}

/** Minimales ui: modal() hängt o.inhalt in den Body und merkt sich o. */
function uiAttrappe() {
  const ui = {
    o: null,
    halter: null,
    modal(o) {
      ui.modalSchliessen();
      ui.o = o;
      ui.halter = document.createElement('div');
      if (o.inhalt) ui.halter.append(o.inhalt);
      document.body.append(ui.halter);
    },
    modalSchliessen() {
      if (ui.halter) ui.halter.remove();
      ui.halter = null;
    },
    modalOffen: () => !!ui.halter,
    toast() {},
  };
  return ui;
}

/** Rückrufe für die Maschinentafel, die wie main.js die Logik aufrufen und mitschreiben. */
function tafelRueck(s, log) {
  return {
    netz: () => netzHolen(s),
    schalten: (b) => { log.push(['schalten', b.typ]); b.aus = !b.aus; },
    einstellen: (b, feld, wert) => { log.push(['einstellen', b.typ, feld, wert]); b[feld] = wert; },
    abbauen: (b) => log.push(['abbauen', b.typ]),
    nadelnNehmen: (b) => { log.push(['nadelnNehmen', b.typ]); scannerLeeren(s, b, []); },
    netzSchalten: (m) => { log.push(['netzSchalten', m.typ]); netzSchalten(s, netzHolen(s), m); },
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  document.body.innerHTML = '';
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('Baukatalog', () => {
  it('öffnet beim ersten Mal den Reiter mit dem Geschenk, sperrt Unerforschtes und wählt per Antippen', () => {
    const s = standNeu(3);
    s.geld = 50;
    for (const t of ['foerderband', 'weiche', 'kolbenrechen']) s.tech[t] = 1;
    s.rev++;
    s.geschenke.rechen = 1;
    const ui = uiAttrappe();
    const gewaehlt = [];
    let abbauen = 0;
    baukatalogZeigen(ui, s, { waehlen: (typ) => gewaehlt.push(typ), abbauen: () => abbauen++ });
    expect(ui.o.titel).toBe('Baukatalog');
    expect(ui.o.ober).toBe('Kasse: 50,00 $'.replace(' $', ' $'));
    const inhalt = ui.o.inhalt;
    const karte = (name) => [...inhalt.querySelectorAll('.baukarte')].find((k) => text(k.querySelector('.bkname')) === name);
    expect([...inhalt.querySelectorAll('.bautab')].map(text)).toEqual(
      ['Heulinien', 'Automatisierung', 'Strom', 'Suche', 'Verarbeitung', 'Wasser', 'Hofbau']);
    expect(text(inhalt.querySelector('.bautab.gewaehlt'))).toBe('Automatisierung');
    expect(inhalt.querySelector('.bautab.gewaehlt').classList.contains('geschenk')).toBe(true);
    expect(text(inhalt.querySelector('.baugeschenke'))).toBe('Geschenk wartet: Kolbenrechen');

    const rechen = karte('Kolbenrechen');
    expect(text(rechen.querySelector('.bkpreis'))).toBe('Geschenk');
    expect(rechen.querySelector('.bkpreis').classList.contains('geschenk')).toBe(true);
    expect(text(rechen.querySelector('.bkstrom'))).toBe('braucht 1 kW');
    const arm = karte('Greifarm');
    expect(arm.disabled).toBe(true);
    expect(arm.classList.contains('gesperrt')).toBe(true);
    expect(text(arm.querySelector('.bkplan'))).toBe('Forschung: Greifarm-Pläne');
    arm.click();
    expect(gewaehlt).toEqual([]);

    knopfMit(inhalt, 'Heulinien').click();
    expect(text(inhalt.querySelector('.bautab.gewaehlt'))).toBe('Heulinien');
    expect(text(karte('Förderband').querySelector('.bkpreis'))).toBe('je Meter 3,00 $');
    expect(karte('Rohrwerfer').disabled).toBe(true);
    expect(text(karte('Rohrwerfer').querySelector('.bkplan'))).toBe('Forschung: Rohrwerfer-Pläne');
    const weiche = karte('Wechselweiche');
    expect(text(weiche.querySelector('.bkpreis'))).toBe('60,00 $');
    expect(weiche.querySelector('.bkpreis').classList.contains('teuer')).toBe(true);
    expect(weiche.querySelector('.bkgebaut').hidden).toBe(true);
    // Zu teuer, aber erforscht: trotzdem wählbar, das Platzieren erklärt den Grund.
    weiche.click();
    expect(gewaehlt).toEqual(['weiche']);
    expect(ui.modalOffen()).toBe(false);
    expect(ui.o.knoepfe.map((k) => k.text)).toEqual(['Abbauen', 'Schließen']);
    ui.o.knoepfe[0].aktion();
    expect(abbauen).toBe(1);
  });

  it('merkt sich den Reiter, zählt Gebautes, nennt Strom und frischt Preise auf', () => {
    const s = hof();
    expect(bauSetzen(s, 'weiche', -8, 9, 0).ok).toBe(true);
    const ui = uiAttrappe();
    baukatalogZeigen(ui, s, { waehlen() {}, abbauen() {} });
    const inhalt = ui.o.inhalt;
    const karte = (name) => [...inhalt.querySelectorAll('.baukarte')].find((k) => text(k.querySelector('.bkname')) === name);
    expect(text(inhalt.querySelector('.bautab.gewaehlt'))).toBe('Heulinien');
    expect(inhalt.querySelector('.baugeschenke').hidden).toBe(true);
    const weiche = karte('Wechselweiche');
    expect(text(weiche.querySelector('.bkgebaut'))).toBe('gebaut: 1');
    expect(text(weiche.querySelector('.bkpreis'))).toBe('63,00 $');
    expect(weiche.querySelector('.bkpreis').classList.contains('teuer')).toBe(false);
    knopfMit(inhalt, 'Strom').click();
    const gen = karte('Heu-Generator');
    expect(text(gen.querySelector('.bkstrom'))).toBe('liefert 15 kW');
    expect(text(gen.querySelector('.bkpreis'))).toBe('330 $');
    expect(karte('Strommast').querySelector('.bkstrom')).toBeNull();
    // Das Spiel läuft weiter: nach einer halben Sekunde stimmt die Farbe wieder.
    s.geld = 10;
    vi.advanceTimersByTime(500);
    expect(gen.querySelector('.bkpreis').classList.contains('teuer')).toBe(true);
    s.geschenke.generator = 2;
    vi.advanceTimersByTime(500);
    expect(text(gen.querySelector('.bkpreis'))).toBe('2 Geschenke');
    expect(text(inhalt.querySelector('.baugeschenke'))).toBe('Geschenke warten: 2× Heu-Generator');
  });
});

describe('Bau-Einblendung', () => {
  it('zeigt Bau, Preis, Grund und die passenden Knöpfe und ruft zurück', () => {
    const ruf = [];
    const rueck = Object.fromEntries(['setzen', 'drehen', 'naeher', 'weiter', 'einrasten', 'abbrechen'].map((n) => [n, () => ruf.push(n)]));
    const hud = bauHudBauen(document.body, rueck);
    expect(hud.el.parentNode).toBe(document.body);
    expect(hud.el.hidden).toBe(true);
    hud.zeigen({ titel: 'Kolbenrechen', zeile: '60,00 $', grund: null, ok: true, schritt: 'setzen', einrasten: null, drehen: true, abstand: true });
    expect(hud.el.hidden).toBe(false);
    expect(document.body.classList.contains('bauend')).toBe(true);
    const sichtbar = (t) => { const b = knopfMit(hud.el, t); return !!b && !b.hidden; };
    const bestaetigen = hud.el.querySelector('.bestaetigen');
    const rast = hud.el.querySelector('.schalter');
    expect(text(hud.el.querySelector('.bhtitel'))).toBe('Kolbenrechen');
    expect(text(hud.el.querySelector('.bhzeile'))).toBe('60,00 $');
    expect(hud.el.querySelector('.bhgrund').hidden).toBe(true);
    expect(text(bestaetigen)).toBe('Hier bauen');
    expect(bestaetigen.classList.contains('matt')).toBe(false);
    expect(rast.hidden).toBe(true);
    expect(['Näher', 'Weiter', 'Drehen'].every(sichtbar)).toBe(true);
    for (const t of ['Näher', 'Weiter', 'Drehen', 'Hier bauen']) knopfMit(hud.el, t).click();
    hud.el.querySelector('.bhzu').click();
    expect(hud.el.querySelector('.bhzu').getAttribute('aria-label')).toBe('Abbrechen');
    expect(ruf).toEqual(['naeher', 'weiter', 'drehen', 'setzen', 'abbrechen']);

    const info = {
      titel: 'Förderband', zeile: 'Band 7,5 m · 22,50 $', grund: 'Ein Band ist im Weg', ok: false, schritt: 'ende',
      einrasten: true, drehen: false, abstand: true,
    };
    hud.zeigen(info);
    expect(text(hud.el.querySelector('.bhtitel'))).toBe('Förderband');
    expect(text(bestaetigen)).toBe('Ende setzen');
    expect(bestaetigen.classList.contains('matt')).toBe(true);
    expect(hud.el.querySelector('.bhkarte').classList.contains('nein')).toBe(true);
    expect(hud.el.querySelector('.bhgrund').hidden).toBe(false);
    expect(text(hud.el.querySelector('.bhgrund'))).toBe('Ein Band ist im Weg');
    expect(rast.hidden).toBe(false);
    expect(text(rast)).toBe('Einrasten: an');
    expect(sichtbar('Drehen')).toBe(false);
    rast.click();
    expect(ruf.at(-1)).toBe('einrasten');

    // Jedes Bild derselbe Stand: kein Zugriff aufs DOM.
    const beobachter = new MutationObserver(() => {});
    beobachter.observe(hud.el, { subtree: true, childList: true, attributes: true, characterData: true });
    hud.zeigen({ ...info });
    hud.zeigen({ ...info });
    expect(beobachter.takeRecords()).toEqual([]);
    hud.zeigen({ ...info, einrasten: false });
    expect(beobachter.takeRecords().length).toBeGreaterThan(0);
    beobachter.disconnect();
    expect(text(rast)).toBe('Einrasten: aus');
    expect(text(hud.el.querySelector('.bestaetigen'))).toBe('Ende setzen');
    hud.zeigen({ ...info, schritt: 'anfang', ok: true });
    expect(text(bestaetigen)).toBe('Anfang setzen');
    expect(bestaetigen.classList.contains('matt')).toBe(false);
    expect(hud.el.querySelector('.bhkarte').classList.contains('nein')).toBe(false);

    hud.zeigen({ titel: 'Abbauen', zeile: '', grund: null, ok: true, schritt: 'abbau', einrasten: null, drehen: false, abstand: false });
    expect(text(bestaetigen)).toBe('Abbauen');
    expect(bestaetigen.classList.contains('gefahr')).toBe(true);
    expect(hud.el.querySelector('.bhzeile').hidden).toBe(true);
    expect([...hud.el.querySelectorAll('.bhreihe')].every((r) => r.hidden)).toBe(true);

    // Antippen der Einblendung erreicht die 3D-Fläche nicht.
    const spion = vi.fn();
    document.body.addEventListener('pointerdown', spion);
    bestaetigen.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    hud.el.querySelector('.bhtitel').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(spion).not.toHaveBeenCalled();
    document.body.removeEventListener('pointerdown', spion);

    hud.verstecken();
    expect(hud.el.hidden).toBe(true);
    expect(document.body.classList.contains('bauend')).toBe(false);
  });
});

describe('Maschinentafel', () => {
  it('Kolbenrechen: Status, Werte, Ein/Aus, Wurfweite und Abbauen', () => {
    const s = hof();
    const r = setzen(s, 'rechen', -10, 8);
    laufen(s, 0.2);
    const ui = uiAttrappe();
    const log = [];
    maschinePanelZeigen(ui, s, r, tafelRueck(s, log));
    expect(ui.o.titel).toBe('Kolbenrechen');
    expect(ui.o.ober).toBe('Automatisierung');
    const inhalt = ui.o.inhalt;
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Kein Strom');
    expect(inhalt.querySelector('.statuspunkt').classList.contains('stoerung')).toBe(true);
    expect(teile(inhalt.querySelector('.werte'))).toBe('Strom nicht angeschlossen');

    const regler = inhalt.querySelector('input[type=range]');
    expect(regler.min).toBe('1');
    expect(regler.max).toBe('5');
    expect(teile(inhalt.querySelector('.regelkopf'))).toBe('Wurfweite 2,5 m');
    regler.value = '4';
    regler.dispatchEvent(new Event('input'));
    expect(log.at(-1)).toEqual(['einstellen', 'rechen', 'weite', 4]);
    expect(r.weite).toBe(4);
    expect(teile(inhalt.querySelector('.regelkopf'))).toBe('Wurfweite 4 m');

    knopfMit(inhalt, 'Ausschalten').click();
    expect(log.at(-1)).toEqual(['schalten', 'rechen']);
    expect(knopfMit(inhalt, 'Einschalten')).toBeDefined();
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Ausgeschaltet');
    expect(inhalt.querySelector('.statuspunkt').classList.contains('aus')).toBe(true);

    const abbau = knopfMit(inhalt, 'Abbauen (+30,00 $ zurück)');
    expect(abbau).toBeDefined();
    abbau.click();
    expect(ui.modalOffen()).toBe(false);
    expect(log.at(-1)).toEqual(['abbauen', 'rechen']);
  });

  it('frischt Status und Werte alle 250 ms auf und hört auf, wenn die Tafel zu ist', () => {
    const s = hof();
    const r = setzen(s, 'rechen', -10, 8);
    laufen(s, 0.2);
    const ui = uiAttrappe();
    maschinePanelZeigen(ui, s, r, tafelRueck(s, []));
    const inhalt = ui.o.inhalt;
    lauf(r).status = 'leer';
    lauf(r).netz = 0;
    lauf(r).strom = 0.5;
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Kein Strom');
    vi.advanceTimersByTime(250);
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Kein Heu in Reichweite');
    expect(inhalt.querySelector('.statuspunkt').classList.contains('warn')).toBe(true);
    expect(teile(inhalt.querySelector('.werte'))).toBe('Strom 50 % von 1 kW');
    ui.modalSchliessen();
    vi.advanceTimersByTime(250);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Wechselweiche: Modus wählen', () => {
    const s = hof();
    const w = setzen(s, 'weiche', -8, 9);
    const ui = uiAttrappe();
    const log = [];
    maschinePanelZeigen(ui, s, w, tafelRueck(s, log));
    const inhalt = ui.o.inhalt;
    expect(ui.o.ober).toBe('Heulinien');
    expect([...inhalt.querySelectorAll('.chip')].map(text)).toEqual(['Abwechselnd', 'Nur links', 'Nur rechts', 'Vorrang links', 'Vorrang rechts']);
    expect(text(inhalt.querySelector('.chip.gewaehlt'))).toBe('Abwechselnd');
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Bereit');
    knopfMit(inhalt, 'Nur links').click();
    expect(log).toEqual([['einstellen', 'weiche', 'modus', 'links']]);
    expect(w.modus).toBe('links');
    expect([...inhalt.querySelectorAll('.chip.gewaehlt')].map(text)).toEqual(['Nur links']);
    expect(knopfMit(inhalt, 'Ausschalten')).toBeDefined();
  });

  it('Scanner mit Nadel: Warnung beim Abbauen, goldener Knopf nimmt die Nadel heraus', () => {
    const s = hof();
    setzen(s, 'mast', -12, -1);
    const sc = setzen(s, 'scanner', -10, -4);
    const n = s.nadeln[0];
    sc.nadeln = [n.nr];
    n.zustand = 'scanner';
    n.bei = sc.id;
    laufen(s, 0.1);
    const ui = uiAttrappe();
    const log = [];
    maschinePanelZeigen(ui, s, sc, tafelRueck(s, log));
    let inhalt = ui.o.inhalt;
    const nadelKnopf = inhalt.querySelector('.nadelknopf');
    expect(nadelKnopf.hidden).toBe(false);
    expect(text(nadelKnopf)).toBe('Nadel herausnehmen');
    expect(teile(inhalt.querySelector('.werte'))).toContain('Nadeln 1 wartet');

    const abbau = knopfMit(inhalt, 'Abbauen (+350 $ zurück)');
    abbau.click();
    const frage = inhalt.querySelector('.rueckfrage');
    expect(frage.hidden).toBe(false);
    expect(text(frage)).toContain('In der Maschine steckt eine Nadel. Sie fällt zurück in den Haufen.');
    expect(abbau.hidden).toBe(true);
    knopfMit(frage, 'Behalten').click();
    expect(frage.hidden).toBe(true);
    expect(abbau.hidden).toBe(false);
    expect(log).toEqual([]);
    abbau.click();
    knopfMit(frage, 'Trotzdem abbauen').click();
    expect(ui.modalOffen()).toBe(false);
    expect(log).toEqual([['abbauen', 'scanner']]);

    maschinePanelZeigen(ui, s, sc, tafelRueck(s, log));
    inhalt = ui.o.inhalt;
    inhalt.querySelector('.nadelknopf').click();
    expect(ui.modalOffen()).toBe(false);
    expect(log.at(-1)).toEqual(['nadelnNehmen', 'scanner']);
    expect(n.zustand).toBe('gefunden');
    // Ohne Nadel kein goldener Knopf und keine Warnung.
    maschinePanelZeigen(ui, s, sc, tafelRueck(s, log));
    expect(ui.o.inhalt.querySelector('.nadelknopf').hidden).toBe(true);
    knopfMit(ui.o.inhalt, 'Abbauen (+350 $ zurück)').click();
    expect(log.at(-1)).toEqual(['abbauen', 'scanner']);
  });

  it('Strommast: Netzbilanz und das ganze Netz schalten', () => {
    const s = hof();
    const m = setzen(s, 'mast', -11, 4);
    setzen(s, 'silo', -11, 6);
    laufen(s, 0.1);
    const ui = uiAttrappe();
    const log = [];
    maschinePanelZeigen(ui, s, m, tafelRueck(s, log));
    const inhalt = ui.o.inhalt;
    expect(ui.o.titel).toBe('Strommast');
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('5 kW da, 2 kW gebraucht, 100 %');
    expect(inhalt.querySelector('.statuspunkt').classList.contains('gut')).toBe(true);
    expect(teile(inhalt.querySelector('.werte'))).toBe('Im Netz 1 Mast, 1 Maschine Hausanschluss verbunden');
    knopfMit(inhalt, 'Netz ausschalten').click();
    expect(log).toEqual([['netzSchalten', 'mast']]);
    expect(m.aus).toBe(true);
    expect(knopfMit(inhalt, 'Netz einschalten')).toBeDefined();
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Netz aus');
    expect(inhalt.querySelector('.statuspunkt').classList.contains('aus')).toBe(true);
    expect(text(inhalt.querySelector('.mtabbau'))).toBe('Abbauen (+20,00 $ zurück)');
  });

  it('Generator: Vorrat als Balken, Leistung und Brennstoff als Werte', () => {
    const s = hof();
    setzen(s, 'mast', -11, 4);
    const gen = setzen(s, 'generator', -11, 6.2);
    laufen(s, 0.1);
    const ui = uiAttrappe();
    const log = [];
    maschinePanelZeigen(ui, s, gen, tafelRueck(s, log));
    const inhalt = ui.o.inhalt;
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Kein Brennstoff');
    expect(inhalt.querySelector('.fortschritt.brenn .fuellung').style.width).toBe('0%');
    gen.brenn = 120;
    laufen(s, 0.1);
    vi.advanceTimersByTime(250);
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Läuft');
    expect(inhalt.querySelector('.fortschritt.brenn .fuellung').style.width).toBe('50%');
    expect(teile(inhalt.querySelector('.werte'))).toBe('Leistung 15 kW Brennstoff 120 Halme');
    knopfMit(inhalt, 'Ausschalten').click();
    expect(log).toEqual([['schalten', 'generator']]);
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Ausgeschaltet');
  });

  it('Greifarm, Rohrwerfer und Lampe: Filter, Richtung, Weite, Helligkeit', () => {
    const s = hof();
    const ui = uiAttrappe();
    const log = [];
    const arm = setzen(s, 'arm', -12, 10);
    maschinePanelZeigen(ui, s, arm, tafelRueck(s, log));
    const chips = [...ui.o.inhalt.querySelectorAll('.chip')].map(text);
    expect(chips.slice(0, 3)).toEqual(['Alles', 'Loses Heu', 'Heuknäuel']);
    expect(chips).toContain('Öko-Ziegel');
    knopfMit(ui.o.inhalt, 'Pressballen').click();
    expect(log.at(-1)).toEqual(['einstellen', 'arm', 'filter', 'ballen']);
    expect(text(ui.o.inhalt.querySelector('.chip.gewaehlt'))).toBe('Pressballen');

    const rw = setzen(s, 'rohrwerfer', -12, -8);
    maschinePanelZeigen(ui, s, rw, tafelRueck(s, log));
    const [richtung, weite] = ui.o.inhalt.querySelectorAll('input[type=range]');
    const kopf = () => [...ui.o.inhalt.querySelectorAll('.regelkopf')].map(teile);
    expect(kopf()).toEqual(['Richtung 0°, geradeaus', 'Weite 8 m']);
    richtung.value = '90';
    richtung.dispatchEvent(new Event('input'));
    expect(log.at(-1).slice(0, 3)).toEqual(['einstellen', 'rohrwerfer', 'winkel']);
    expect(rw.winkel).toBeCloseTo(-Math.PI / 2, 6);
    weite.value = '12.5';
    weite.dispatchEvent(new Event('input'));
    expect(rw.weite).toBe(12.5);
    expect(kopf()).toEqual(['Richtung 90° nach rechts', 'Weite 12,5 m']);
    richtung.value = '-45';
    richtung.dispatchEvent(new Event('input'));
    expect(kopf()[0]).toBe('Richtung 45° nach links');

    const lampe = setzen(s, 'lampe', -15, 10);
    maschinePanelZeigen(ui, s, lampe, tafelRueck(s, log));
    const hell = ui.o.inhalt.querySelector('input[type=range]');
    expect(teile(ui.o.inhalt.querySelector('.regelkopf'))).toBe('Helligkeit 100 %');
    hell.value = '40';
    hell.dispatchEvent(new Event('input'));
    expect(lampe.hell).toBeCloseTo(0.4, 6);
    expect(teile(ui.o.inhalt.querySelector('.regelkopf'))).toBe('Helligkeit 40 %');
    expect(knopfMit(ui.o.inhalt, 'Ausschalten')).toBeDefined();
    // Schieben am Regler darf die 3D-Fläche nicht erreichen.
    const spion = vi.fn();
    document.body.addEventListener('pointerdown', spion);
    hell.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(spion).not.toHaveBeenCalled();
    document.body.removeEventListener('pointerdown', spion);
  });
});

describe('Auftragstafel', () => {
  it('erklärt ohne Auftragsbuch, wie man zu Aufträgen kommt', () => {
    const s = standNeu(5);
    const ui = uiAttrappe();
    auftragstafelZeigen(ui, s, { ablehnen() {} });
    expect(ui.o.titel).toBe('Noch keine Aufträge');
    expect(ui.o.absaetze.join(' ')).toContain('Auftragsbuch');
    expect(ui.o.absaetze.join(' ')).toContain('Laster');
    expect(ui.o.inhalt).toBeFalsy();
  });

  it('zeigt Kunde, Ware, Fortschritt, Lohn und den Laster; Ablehnen erst nach der Pause', () => {
    const s = hof();
    s.auftrag = { nr: 0, skip: 0, geliefert: 0, pause: 12 };
    s.laster.zustand = 'weg';
    const ui = uiAttrappe();
    let abgelehnt = 0;
    auftragstafelZeigen(ui, s, { ablehnen: () => { abgelehnt++; lasterAblehnen(s); } });
    const inhalt = ui.o.inhalt;
    const wert = (name) => {
      const dt = [...inhalt.querySelectorAll('dt')].find((x) => text(x) === name);
      return text(dt.nextElementSibling);
    };
    expect(text(inhalt.querySelector('h2'))).toBe('Pferdehof Lindner');
    expect(text(inhalt.querySelector('.ober'))).toBe('Auftragstafel · Auftrag 1');
    expect(wert('Ware')).toBe('Loses Heu');
    expect(wert('Geliefert')).toBe('0 / 2.000 Halme');
    expect(wert('Lohn')).toBe(norm(geld(auftragLohn(s, auftrag(0)))));
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Nächster Laster in 12 s');
    expect(knopfMit(inhalt, 'Ablehnen').hidden).toBe(true);

    s.auftrag.pause = 0;
    s.laster.zustand = 'steht';
    s.auftrag.geliefert = 500;
    vi.advanceTimersByTime(250);
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Der Laster steht am Tor. Was auf seine Ladefläche fällt, zählt.');
    expect(inhalt.querySelector('.statuspunkt').classList.contains('gut')).toBe(true);
    expect(wert('Geliefert')).toBe('500 / 2.000 Halme');
    expect(inhalt.querySelector('.fortschritt .fuellung').style.width).toBe('25%');
    const ablehnen = knopfMit(inhalt, 'Ablehnen');
    expect(ablehnen.hidden).toBe(false);

    // Schon Geliefertes wäre verloren: erst nachfragen.
    ablehnen.click();
    const frage = inhalt.querySelector('.rueckfrage');
    expect(frage.hidden).toBe(false);
    expect(text(frage)).toContain('Schon 500 Halme geliefert. Das zählt dann nicht mehr.');
    knopfMit(frage, 'Behalten').click();
    expect(abgelehnt).toBe(0);
    expect(frage.hidden).toBe(true);
    knopfMit(inhalt, 'Ablehnen').click();
    knopfMit(frage, 'Trotzdem ablehnen').click();
    expect(abgelehnt).toBe(1);
    expect(text(inhalt.querySelector('h2'))).toBe('Kleintierzucht Wagner');
    expect(text(inhalt.querySelector('.ober'))).toBe('Auftragstafel · Auftrag 2');
    expect(wert('Ware')).toBe('Heuknäuel');
    expect(wert('Geliefert')).toBe('0 / 25 Stück');
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Nächster Laster in 20 s');
    expect(knopfMit(inhalt, 'Ablehnen').hidden).toBe(true);

    // Nichts geliefert: Ablehnen ohne Rückfrage.
    s.auftrag.pause = 0;
    s.laster.zustand = 'kommt';
    vi.advanceTimersByTime(250);
    expect(text(inhalt.querySelector('.tafelstatus'))).toBe('Der Laster ist unterwegs.');
    knopfMit(inhalt, 'Ablehnen').click();
    expect(abgelehnt).toBe(2);
    expect(frage.hidden).toBe(true);
  });
});
