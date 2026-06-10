// Pure: caller passes Date.now() in. Keeps offline math deterministic & testable.
export function computeElapsedSeconds(lastMs, nowMs, capSeconds) {
  const elapsed = Math.floor((nowMs - lastMs) / 1000);
  if (elapsed < 0) return 0;
  return Math.min(elapsed, capSeconds);
}
