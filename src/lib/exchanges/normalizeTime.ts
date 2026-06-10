/** Normalize an exchange timestamp to integer milliseconds.
 *  Values below 1e12 are assumed to be in seconds (any real ms
 *  timestamp after 2001 exceeds 1e12). Accepts number or numeric string. */
export function toMs(ts: number | string): number {
  const n = typeof ts === 'string' ? parseFloat(ts) : ts;
  if (!isFinite(n) || n <= 0) return Date.now();
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}
