// Auftragstafel am Tor: wer was bestellt hat, wie viel davon schon auf dem
// Laster liegt, was der Auftrag bringt und wo der Laster gerade ist. Ohne
// Auftragsbuch steht dort nur, wie man zu Aufträgen kommt. Frischt sich alle
// 250 ms auf, solange sie offen ist.

import { PRODUKTE } from '../daten.js';
import { werte, auftrag, auftragLohn, TECH_NACH_ID } from '../wirtschaft.js';
import { geld, halme, zahl, dauer } from '../format.js';
import { h, setzeText } from './oberflaeche.js';
import { sichtbarSetzen, solangeOffen } from './bauen.js';

/** Öffnet die Tafel. rueck: { ablehnen() }. Ablehnen gibt es nur, solange keine Pause läuft. */
export function auftragstafelZeigen(ui, s, rueck) {
  if (!werte(s).frei.has('auftraege')) {
    ui.modal({
      ober: 'Auftragstafel', titel: 'Noch keine Aufträge',
      absaetze: [`Mit dem ${TECH_NACH_ID.auftraege.name} aus der Forschung (Verkauf) setzt ein Laster ans Tor. `
        + 'Er holt bestellte Ware ab und zahlt dafür einen Lohn.'],
      knoepfe: [{ text: 'Verstanden', klasse: 'primaer' }],
    });
    return;
  }
  const mengeText = (a, n) => (a.will === 'roh' ? `${halme(n)} Halme` : `${zahl(n)} Stück`);
  const nummer = h('p', { class: 'ober' });
  const kunde = h('h2', {});
  const ware = h('dd', {});
  const stand = h('dd', { class: 'num' });
  const lohn = h('dd', { class: 'num' });
  const fuellung = h('div', { class: 'fuellung' });
  const balken = h('div', { class: 'fortschritt', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fuellung);
  const punkt = h('span', { class: 'statuspunkt' });
  const lasterText = h('span', {});
  const ablehnen = h('button', { class: 'knopf breit', type: 'button' }, 'Ablehnen');
  const frage = h('p', {});
  const rueckfrage = h('div', { class: 'rueckfrage', hidden: true }, frage, h('div', { class: 'rueckfragewahl' },
    h('button', {
      class: 'knopf gefahr', type: 'button',
      onclick: () => { sichtbarSetzen(rueckfrage, false); rueck.ablehnen(); aktualisieren(); },
    }, 'Trotzdem ablehnen'),
    h('button', { class: 'knopf primaer', type: 'button', onclick: () => { sichtbarSetzen(rueckfrage, false); aktualisieren(); } }, 'Behalten')));
  ablehnen.addEventListener('click', () => {
    const A = s.auftrag;
    if (A.geliefert > 0) {
      // Schon Geliefertes wäre weg: erst nachfragen.
      setzeText(frage, `Schon ${mengeText(auftrag(A.nr, A.skip), A.geliefert)} geliefert. Das zählt dann nicht mehr.`);
      sichtbarSetzen(rueckfrage, true);
      sichtbarSetzen(ablehnen, false);
      return;
    }
    rueck.ablehnen();
    aktualisieren();
  });

  function aktualisieren() {
    const A = s.auftrag;
    const a = auftrag(A.nr, A.skip);
    setzeText(nummer, `Auftragstafel · Auftrag ${A.nr + (A.skip || 0) + 1}`);
    setzeText(kunde, a.titel);
    setzeText(ware, a.will === 'roh' ? 'Loses Heu' : PRODUKTE[a.will].name);
    setzeText(stand, `${a.will === 'roh' ? halme(A.geliefert) : zahl(A.geliefert)} / ${mengeText(a, a.menge)}`);
    setzeText(lohn, geld(auftragLohn(s, a)));
    const prozentWert = Math.round(Math.max(0, Math.min(1, A.geliefert / a.menge)) * 100);
    if (fuellung.style.width !== `${prozentWert}%`) {
      fuellung.style.width = `${prozentWert}%`;
      balken.setAttribute('aria-valuenow', String(prozentWert));
    }
    const zustand = s.laster ? s.laster.zustand : 'weg';
    let farbe = 'aus';
    let text = `Nächster Laster in ${dauer(Math.ceil(A.pause))}`;
    if (zustand === 'steht') { farbe = 'gut'; text = 'Der Laster steht am Tor. Was auf seine Ladefläche fällt, zählt.'; }
    else if (zustand === 'kommt' || !(A.pause > 0)) { farbe = 'warn'; text = 'Der Laster ist unterwegs.'; }
    for (const f of ['gut', 'warn', 'aus']) punkt.classList.toggle(f, f === farbe);
    setzeText(lasterText, text);
    const darf = !(A.pause > 0);
    if (!darf) sichtbarSetzen(rueckfrage, false);
    sichtbarSetzen(ablehnen, darf && rueckfrage.hidden);
  }

  const inhalt = h('div', { class: 'auftraginhalt' },
    nummer, kunde,
    h('dl', { class: 'werte' }, h('dt', {}, 'Ware'), ware, h('dt', {}, 'Geliefert'), stand, h('dt', {}, 'Lohn'), lohn),
    balken,
    h('div', { class: 'tafelstatus', role: 'status' }, punkt, lasterText),
    h('p', { class: 'tafelhinweis' }, 'Andere Ware auf der Ladefläche wird normal bezahlt.'),
    ablehnen, rueckfrage);
  aktualisieren();
  ui.modal({ inhalt, klasse: 'auftragstafel', knoepfe: [{ text: 'Schließen', klasse: 'primaer' }] });
  solangeOffen(inhalt, 250, aktualisieren);
}
