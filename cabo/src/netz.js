// Zwei Handys über das Internet verbinden — für die Fassung auf der Webseite.
//
// Anders als funk.js braucht das kein gemeinsames WLAN und keine Kamera: Der
// Server hält nur einen Raum mit einem kurzen Code offen und reicht Nachrichten
// durch. Er versteht kein Spiel; er merkt sich, wer was noch nicht abgeholt hat.
//
// Nach außen sieht das genauso aus wie eine Direktverbindung — `senden`,
// `verbunden`, `schliessen` — damit die Oberfläche nichts davon wissen muss.

const NETZ_BASIS = (typeof SPIELE_BASIS === 'string' ? SPIELE_BASIS : '.').replace(/\/$/, '');

/** Steht dieser Weg überhaupt zur Verfügung? Nur in der Webfassung. */
export const netzMoeglich = () => typeof SPIELE_BASIS === 'string';

async function ruf(pfad, optionen = {}) {
  const antwort = await fetch(`${NETZ_BASIS}/api${pfad}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...optionen,
  });
  let daten = null;
  try { daten = await antwort.json(); } catch { /* leere Antwort */ }
  if (!antwort.ok) throw new Error((daten && daten.fehler) || `Server meldet ${antwort.status}.`);
  return daten || {};
}

/**
 * Raum aufmachen oder beitreten und danach dauerhaft lauschen.
 *
 * `aufZustand(text, verbunden)` meldet Fortschritt, `aufNachricht(objekt)`
 * liefert alles, was die Gegenseite schickt, `aufCode(code)` den Raumcode,
 * sobald er feststeht.
 */
export function netzAufbauen({ gastgeber, code, aufZustand, aufNachricht, aufCode }) {
  let raum = null;         // { code, sitz, schluessel }
  let ab = 0;
  let offen = false;
  let laeuft = true;
  let fehlversuche = 0;

  const melde = (text, verbunden = offen) => aufZustand?.(text, verbunden);

  async function lauschen() {
    while (laeuft && raum) {
      try {
        const q = new URLSearchParams({
          sitz: String(raum.sitz),
          ab: String(ab),
          voll: offen ? '1' : '0',        // der Server meldet sich, sobald sich das ändert
          schluessel: raum.schluessel,
        });
        const daten = await ruf(`/raum/${raum.code}/holen?${q}`);
        if (!laeuft) return;
        fehlversuche = 0;

        if (daten.voll && !offen) { offen = true; aufZustand?.('verbunden', true); }
        if (!daten.voll && offen) { offen = false; aufZustand?.('getrennt', false); }

        for (const n of daten.nachrichten || []) {
          ab = Math.max(ab, n.nr);
          try { aufNachricht?.(n.inhalt); } catch { /* kaputte Nachricht */ }
        }
        if (typeof daten.stand === 'number') ab = Math.max(ab, Math.min(ab, daten.stand));
      } catch (fehler) {
        if (!laeuft) return;
        fehlversuche += 1;
        if (fehlversuche >= 4) {
          offen = false;
          aufZustand?.(`Verbindung abgerissen: ${fehler.message}`, false);
        }
        // Kurz warten, dann weiter — kurze Aussetzer sollen das Spiel nicht beenden.
        await new Promise((w) => setTimeout(w, Math.min(4000, 500 * fehlversuche)));
      }
    }
  }

  const bereit = (async () => {
    melde(gastgeber ? 'Raum wird geöffnet …' : 'Raum wird gesucht …', false);
    raum = gastgeber
      ? await ruf('/raum', { method: 'POST', body: '{}' })
      : await ruf(`/raum/${String(code || '').trim().toUpperCase()}/beitreten`,
        { method: 'POST', body: '{}' });
    aufCode?.(raum.code);
    melde(gastgeber ? 'Warte auf das zweite Handy …' : 'Verbinde …', false);
    lauschen();
    return raum.code;
  })();

  return {
    bereit,                                   // Promise: fertig, sobald der Raum steht
    get code() { return raum && raum.code; },
    get verbunden() { return offen; },

    senden(objekt) {
      if (!raum) return false;
      ruf(`/raum/${raum.code}/senden`, {
        method: 'POST',
        body: JSON.stringify({ sitz: raum.sitz, schluessel: raum.schluessel, nachricht: objekt }),
      }).catch(() => { /* der Lauscher merkt den Ausfall */ });
      return true;
    },

    schliessen() {
      laeuft = false;
      offen = false;
      raum = null;
    },
  };
}
