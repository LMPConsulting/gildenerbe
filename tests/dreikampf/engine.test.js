import {
  STAPEL, TYPEN, PUNKTE, ORTE,
  neuerStand, neueRunde, schritt, antworten, bewerten, weiter,
  ergebnis, rundeAbschliessen, rundeAbbrechen, rundeFertig,
  ziehen, passend, aufbereiten, fuehrung, stapelRest, alsCode, ausCode,
} from '../../dreikampf/src/engine.js';

const neu = () => neuerStand(['Monty', 'Christina'], 'Wien');

/** Runde bis zum Ende durchklicken, ohne sich um die Schrittarten zu kümmern. */
function durchspielen(stand, { antwort, ehrlich, gemacht }) {
  let schutz = 0;
  while (!rundeFertig(stand) && schutz++ < 20) {
    const s = schritt(stand);
    if (s.art === 'antwort') antworten(stand, antwort[s.p]);
    else if (s.art === 'urteil') bewerten(stand, stand.aktuell.typ === 'wagnis' ? gemacht : ehrlich[s.ueber]);
    else weiter(stand);
  }
  return stand;
}

describe('Kartenstapel', () => {
  it('hat reichlich Material in allen drei Disziplinen', () => {
    expect(STAPEL.wissen.length).toBeGreaterThanOrEqual(200);
    expect(STAPEL.wahrheit.length).toBeGreaterThanOrEqual(120);
    expect(STAPEL.wagnis.length).toBeGreaterThanOrEqual(100);
  });

  it('vergibt jede id nur einmal', () => {
    for (const typ of TYPEN) {
      const ids = STAPEL[typ].map((k) => k.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('gibt jeder Wissensfrage genau vier verschiedene Antworten', () => {
    for (const k of STAPEL.wissen) {
      expect(k.o, k.id).toHaveLength(4);
      expect(new Set(k.o).size, k.id).toBe(4);
      expect(k.q.length, k.id).toBeGreaterThan(8);
    }
  });

  it('kennzeichnet jede Wahrheitsfrage mit Tiefe und Thema', () => {
    for (const k of STAPEL.wahrheit) {
      expect(['leicht', 'ehrlich', 'tief'], k.id).toContain(k.tiefe);
      expect(typeof k.thema, k.id).toBe('string');
    }
  });

  it('ordnet jede Mutprobe einem bekannten Ort zu', () => {
    for (const k of STAPEL.wagnis) {
      expect(['überall', 'flug', 'stadt', 'abend'], k.id).toContain(k.ort);
    }
  });

  it('deckt jeden Ortsfilter mit genug Karten ab', () => {
    for (const ort of Object.keys(ORTE)) {
      expect(passend('wagnis', ort).length, ort).toBeGreaterThanOrEqual(40);
    }
  });

  it('lässt Wissen und Wahrheit vom Ortsfilter unberührt', () => {
    expect(passend('wissen', 'stadt')).toHaveLength(STAPEL.wissen.length);
    expect(passend('wahrheit', 'flug')).toHaveLength(STAPEL.wahrheit.length);
  });
});

describe('Karten ziehen', () => {
  it('wiederholt keine Karte, solange der Stapel Vorrat hat', () => {
    const s = neu();
    const gezogen = new Set();
    for (let i = 0; i < 60; i++) gezogen.add(ziehen(s, 'wahrheit').id);
    expect(gezogen.size).toBe(60);
  });

  it('setzt den Stapel zurück, wenn er durch ist', () => {
    const s = neu();
    s.ort = 'flug';
    const menge = passend('wagnis', 'flug').length;
    for (let i = 0; i < menge; i++) ziehen(s, 'wagnis');
    expect(ziehen(s, 'wagnis')).toBeTruthy();
    expect(stapelRest(s, 'wagnis').offen).toBe(menge - 1);
  });

  it('zieht mit Ortsfilter nur passende Mutproben', () => {
    const s = neu();
    s.ort = 'stadt';
    for (let i = 0; i < 40; i++) {
      const k = ziehen(s, 'wagnis');
      expect(['stadt', 'überall']).toContain(k.ort);
    }
  });

  it('mischt die Antworten und merkt sich die richtige Position', () => {
    const karte = { id: 'x', cat: 'Test', q: 'Frage?', o: ['richtig', 'a', 'b', 'c'] };
    for (let i = 0; i < 30; i++) {
      const auf = aufbereiten(karte);
      expect(auf.optionen).toHaveLength(4);
      expect(auf.optionen[auf.richtig]).toBe('richtig');
    }
  });

  it('legt die richtige Antwort nicht immer auf dieselbe Position', () => {
    const karte = { id: 'x', cat: 'Test', q: 'Frage?', o: ['richtig', 'a', 'b', 'c'] };
    const plaetze = new Set();
    for (let i = 0; i < 80; i++) plaetze.add(aufbereiten(karte).richtig);
    expect(plaetze.size).toBeGreaterThan(1);
  });
});

describe('Wissen', () => {
  it('gibt beiden 10 Punkte, wenn beide richtig liegen', () => {
    const s = neu();
    neueRunde(s, 'wissen');
    const r = s.aktuell.karte.richtig;
    durchspielen(s, { antwort: [r, r] });
    expect(ergebnis(s.aktuell).deltas).toEqual([PUNKTE.wissenRichtig, PUNKTE.wissenRichtig]);
  });

  it('belohnt die alleinige richtige Antwort mit 15', () => {
    const s = neu();
    neueRunde(s, 'wissen');
    const r = s.aktuell.karte.richtig;
    durchspielen(s, { antwort: [r, (r + 1) % 4] });
    expect(ergebnis(s.aktuell).deltas)
      .toEqual([PUNKTE.wissenRichtig + PUNKTE.wissenAllein, 0]);
  });

  it('gibt niemandem etwas, wenn beide danebenliegen', () => {
    const s = neu();
    neueRunde(s, 'wissen');
    const falsch = (s.aktuell.karte.richtig + 1) % 4;
    durchspielen(s, { antwort: [falsch, falsch] });
    expect(ergebnis(s.aktuell).deltas).toEqual([0, 0]);
  });

  it('fragt zuerst den, der gewählt hat, dann den anderen', () => {
    const s = neu();
    s.dran = 1;
    neueRunde(s, 'wissen');
    expect(s.aktuell.schritte.map((x) => `${x.art}${x.p ?? ''}`))
      .toEqual(['antwort1', 'antwort0', 'auflösung']);
  });

  it('hält die Antwort des ersten Spielers fest', () => {
    const s = neu();
    neueRunde(s, 'wissen');
    antworten(s, 2);
    expect(s.aktuell.antworten[0]).toBe(2);
    expect(s.aktuell.antworten[1]).toBe(null);
    expect(schritt(s).p).toBe(1);
  });
});

describe('Wahrheit', () => {
  it('lässt beide antworten und beide bewerten', () => {
    const s = neu();
    neueRunde(s, 'wahrheit');
    expect(s.aktuell.schritte.map((x) => x.art))
      .toEqual(['reden', 'urteil', 'urteil', 'auflösung']);
  });

  it('gibt 20 Punkte für eine als ehrlich anerkannte Antwort', () => {
    const s = neu();
    neueRunde(s, 'wahrheit');
    durchspielen(s, { ehrlich: [true, true] });
    expect(ergebnis(s.aktuell).deltas).toEqual([PUNKTE.wahrheitEhrlich, PUNKTE.wahrheitEhrlich]);
  });

  it('bewertet jeden einzeln', () => {
    const s = neu();
    neueRunde(s, 'wahrheit');
    durchspielen(s, { ehrlich: [true, false] });
    expect(ergebnis(s.aktuell).deltas).toEqual([PUNKTE.wahrheitEhrlich, 0]);
  });

  it('bringt mehr als eine richtige Wissensantwort', () => {
    expect(PUNKTE.wahrheitEhrlich).toBeGreaterThan(PUNKTE.wissenRichtig + PUNKTE.wissenAllein);
  });

  it('ordnet das Urteil der bewerteten Person zu, nicht der bewertenden', () => {
    const s = neu();
    neueRunde(s, 'wahrheit');
    weiter(s);                       // reden abhaken
    expect(schritt(s)).toMatchObject({ p: 0, ueber: 1 });
    bewerten(s, false);              // Monty findet Christina ausweichend
    bewerten(s, true);               // Christina findet Monty ehrlich
    expect(s.aktuell.urteile).toEqual([true, false]);
  });
});

describe('Wagnis', () => {
  it('trifft nur die Person, die gewählt hat', () => {
    const s = neu();
    s.dran = 1;
    neueRunde(s, 'wagnis');
    durchspielen(s, { gemacht: true });
    expect(ergebnis(s.aktuell).deltas).toEqual([0, PUNKTE.wagnisGemacht]);
  });

  it('zieht Punkte ab, wenn es nicht anerkannt wird', () => {
    const s = neu();
    neueRunde(s, 'wagnis');
    durchspielen(s, { gemacht: false });
    expect(ergebnis(s.aktuell).deltas).toEqual([PUNKTE.wagnisVerweigert, 0]);
  });

  it('bringt mehr als jede andere Disziplin', () => {
    expect(PUNKTE.wagnisGemacht).toBeGreaterThan(PUNKTE.wahrheitEhrlich);
    expect(PUNKTE.wagnisVerweigert).toBeLessThan(0);
  });

  it('lässt den anderen urteilen', () => {
    const s = neu();
    neueRunde(s, 'wagnis');
    weiter(s);
    expect(schritt(s)).toMatchObject({ art: 'urteil', p: 1, ueber: 0 });
  });
});

describe('Runde abschließen', () => {
  it('bucht Punkte, wechselt den Zug und zählt die Runde hoch', () => {
    const s = neu();
    neueRunde(s, 'wagnis');
    durchspielen(s, { gemacht: true });
    rundeAbschliessen(s);
    expect(s.punkte).toEqual([PUNKTE.wagnisGemacht, 0]);
    expect(s.dran).toBe(1);
    expect(s.runde).toBe(2);
    expect(s.aktuell).toBe(null);
  });

  it('schreibt die Runde in den Verlauf, neueste zuerst', () => {
    const s = neu();
    neueRunde(s, 'wagnis');
    durchspielen(s, { gemacht: true });
    rundeAbschliessen(s);
    neueRunde(s, 'wahrheit');
    durchspielen(s, { ehrlich: [true, true] });
    rundeAbschliessen(s);

    expect(s.verlauf).toHaveLength(2);
    expect(s.verlauf[0].typ).toBe('wahrheit');
    expect(s.verlauf[0].runde).toBe(2);
    expect(s.verlauf[1].typ).toBe('wagnis');
  });

  it('führt Statistik pro Person', () => {
    const s = neu();
    neueRunde(s, 'wagnis');
    durchspielen(s, { gemacht: true });
    rundeAbschliessen(s);                     // Monty besteht
    neueRunde(s, 'wagnis');
    durchspielen(s, { gemacht: false });
    rundeAbschliessen(s);                     // Christina kneift

    expect(s.statistik.wagnisGemacht).toEqual([1, 0]);
    expect(s.statistik.wagnisVerweigert).toEqual([0, 1]);
  });

  it('zählt richtige Wissensantworten mit', () => {
    const s = neu();
    neueRunde(s, 'wissen');
    const r = s.aktuell.karte.richtig;
    durchspielen(s, { antwort: [r, (r + 1) % 4] });
    rundeAbschliessen(s);
    expect(s.statistik.wissenRichtig).toEqual([1, 0]);
  });

  it('lässt sich abbrechen, ohne Punkte oder Zug zu verändern', () => {
    const s = neu();
    neueRunde(s, 'wagnis');
    rundeAbbrechen(s);
    expect(s.aktuell).toBe(null);
    expect(s.punkte).toEqual([0, 0]);
    expect(s.dran).toBe(0);
    expect(s.runde).toBe(1);
  });

  it('summiert Punkte über viele Runden hinweg', () => {
    const s = neu();
    for (let i = 0; i < 6; i++) {
      neueRunde(s, 'wahrheit');
      durchspielen(s, { ehrlich: [true, true] });
      rundeAbschliessen(s);
    }
    expect(s.punkte).toEqual([120, 120]);
    expect(s.runde).toBe(7);
    expect(s.dran).toBe(0);
  });
});

describe('Führung', () => {
  it('erkennt Gleichstand', () => {
    const s = neu();
    expect(fuehrung(s)).toMatchObject({ gleich: true, abstand: 0 });
  });

  it('nennt Vorsprung und Abstand', () => {
    const s = neu();
    s.punkte = [70, 45];
    expect(fuehrung(s)).toMatchObject({ gleich: false, vorne: 0, abstand: 25 });
    s.punkte = [45, 70];
    expect(fuehrung(s)).toMatchObject({ vorne: 1, abstand: 25 });
  });
});

describe('Punktestand sichern', () => {
  it('überlebt den Weg durch Code und zurück', () => {
    const s = neu();
    s.punkte = [130, 95];
    s.runde = 12;
    neueRunde(s, 'wahrheit');
    durchspielen(s, { ehrlich: [true, false] });
    rundeAbschliessen(s);

    const zurueck = ausCode(alsCode(s));
    expect(zurueck).toEqual(s);
  });

  it('verkraftet Umlaute in Namen und Fragen', () => {
    const s = neuerStand(['Jürgen', 'Björk'], 'Wien & Umgebung');
    s.punkte = [5, -15];
    const zurueck = ausCode(alsCode(s));
    expect(zurueck.spieler[0].name).toBe('Jürgen');
    expect(zurueck.reise).toBe('Wien & Umgebung');
  });

  it('weist Unsinn ab, statt den Stand zu zerstören', () => {
    expect(ausCode('kein gültiger code')).toBe(null);
    expect(ausCode('')).toBe(null);
    expect(ausCode(btoa('{"v":99}'))).toBe(null);
  });
});
