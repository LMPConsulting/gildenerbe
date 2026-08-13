import { qrMatrix } from '../../cabo/src/qr.js';

/**
 * Der Erzeuger wurde beim Bau modulgenau gegen eine Referenzbibliothek geprüft
 * und mit einem echten Decoder zurückgelesen. Hier stehen die eingefrorenen
 * Ergebnisse, damit spätere Änderungen sofort auffallen.
 */

const packe = (q) => q.module.map((z) => z.map((v) => (v ? '1' : '0')).join('')).join('/');
const summe = (text) => {
  let h = 5381;
  for (const c of text) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h;
};

const KLEIN = '111111101100101111111/100000100100101000001/101110101010101011101/'
  + '101110101001001011101/101110101111001011101/100000100000001000001/'
  + '111111101010101111111/000000000110100000000/111100101010010011101/'
  + '010011010001010110101/111111101101011100011/001101010010100101010/'
  + '011000100110101000001/000000001000110100101/111111100100010110000/'
  + '100000100101110101101/101110100111010001110/101110101101100001110/'
  + '101110101100100100100/100000101011001110001/111111101110011100100';

describe('QR-Erzeuger', () => {
  it('liefert für einen bekannten Text exakt dieselbe Matrix wie geprüft', () => {
    expect(packe(qrMatrix('Hallo Welt 123'))).toBe(KLEIN);
  });

  it('bleibt auch bei größeren Versionen unverändert', () => {
    const faelle = [
      ['CABO-VERBINDUNG-TEST', 2, 25, 4005408757],
      ['x'.repeat(150), 7, 45, 464736149],
      ['z'.repeat(400), 13, 69, 599459892],
    ];
    for (const [text, version, groesse, pruefsumme] of faelle) {
      const q = qrMatrix(text);
      expect(q.version, text.slice(0, 12)).toBe(version);
      expect(q.groesse, text.slice(0, 12)).toBe(groesse);
      expect(summe(packe(q)), text.slice(0, 12)).toBe(pruefsumme);
    }
  });

  it('wählt die kleinste Version, die den Text noch fasst', () => {
    expect(qrMatrix('A').version).toBe(1);
    expect(qrMatrix('a'.repeat(17)).version).toBe(1);
    expect(qrMatrix('a'.repeat(18)).version).toBe(2);
    expect(qrMatrix('a'.repeat(500)).version).toBe(15);
  });

  it('rechnet Größe und Version passend zueinander', () => {
    for (const laenge of [1, 30, 90, 150, 250, 400, 500]) {
      const q = qrMatrix('q'.repeat(laenge));
      expect(q.groesse).toBe(q.version * 4 + 17);
      expect(q.module).toHaveLength(q.groesse);
      expect(q.module[0]).toHaveLength(q.groesse);
    }
  });

  it('setzt die drei Suchmuster mit hellem Trennrand', () => {
    const { groesse, module } = qrMatrix('Testtext für Suchmuster');
    const ecken = [[0, 0], [0, groesse - 7], [groesse - 7, 0]];
    for (const [zy, zx] of ecken) {
      expect(module[zy][zx]).toBe(true);
      expect(module[zy + 1][zx + 1]).toBe(false);          // heller Ring
      expect(module[zy + 3][zx + 3]).toBe(true);           // dunkler Kern
    }
    for (let i = 0; i < 8; i++) expect(module[7][i], `Trennrand ${i}`).toBe(false);
  });

  it('legt die Taktspur alternierend zwischen die Suchmuster', () => {
    const { groesse, module } = qrMatrix('Taktspur prüfen bitte');
    for (let i = 8; i < groesse - 8; i++) {
      expect(module[6][i], `waagrecht ${i}`).toBe(i % 2 === 0);
      expect(module[i][6], `senkrecht ${i}`).toBe(i % 2 === 0);
    }
  });

  it('setzt das immer dunkle Modul', () => {
    for (const text of ['kurz', 'l'.repeat(200)]) {
      const { groesse, module } = qrMatrix(text);
      expect(module[groesse - 8][8]).toBe(true);
    }
  });

  it('verkraftet Umlaute und Sonderzeichen', () => {
    expect(() => qrMatrix('Grüße aus Wien — ß ä ö ü ✓')).not.toThrow();
  });

  it('weigert sich bei zu langem Text, statt Unsinn zu liefern', () => {
    expect(() => qrMatrix('y'.repeat(2000))).toThrow(/zu lang/);
  });
});
