// Single damage roll. All randomness comes from the injected seeded rng,
// so combat outcomes are reproducible.
export function rollHit({ baseDamage, critChance, critMult = 2, targetDR = 0 }, rng) {
  const crit = rng.chance(critChance);
  const variance = rng.float(0.9, 1.1);
  const amount = Math.round(baseDamage * (crit ? critMult : 1) * (1 - targetDR) * variance);
  return { amount, crit };
}
