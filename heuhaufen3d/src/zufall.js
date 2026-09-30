// Reproduzierbarer Zufall (mulberry32). Der Zustand ist eine einzige Zahl und
// liegt im Spielstand, damit ein geladener Stand genauso weiterwürfelt:
// zufallNeu(stand.rng) setzt fort, f.zustand() liefert den neuen Wert.

export function zufallNeu(zustand) {
  let a = (zustand >>> 0) || 1;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.zustand = () => a;
  return f;
}
