import type { BigTrade } from './types';
import { MAX_AUTO_CACHE } from './constants';
import { openDB, idbReq } from './db';

const STORE = 'auto-trades';

// Trades are stored per-symbol (not per-interval) so bubbles are visible
// across all timeframes. The `time` field stores raw trade timestamp (seconds)
// so it can be remapped to any candle interval on load.

const pending = new Map<string, BigTrade[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 250;

async function flush(): Promise<void> {
  if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
  if (pending.size === 0) return;
  const batch = new Map(pending);
  pending.clear();
  try {
    const db = await openDB();
    for (const [symbol, queued] of batch) {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const existing = (await idbReq<BigTrade[] | undefined>(store.get(symbol))) ?? [];
      const seen = new Set(existing.map((t) => t.id));
      for (const t of queued) {
        if (!seen.has(t.id)) { existing.push(t); seen.add(t.id); }
      }
      if (existing.length > MAX_AUTO_CACHE) existing.splice(0, existing.length - MAX_AUTO_CACHE);
      await idbReq(store.put(existing, symbol));
    }
  } catch (e) {
    console.error('autoCache flush error', e);
  }
}

// Best-effort flush before tab discard
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flush();
});

export async function getAutoCachedTrades(symbol: string): Promise<BigTrade[]> {
  await flush();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const result = await idbReq<BigTrade[] | undefined>(tx.objectStore(STORE).get(symbol));
    return result ?? [];
  } catch (e) {
    console.error('getAutoCachedTrades error', e);
    return [];
  }
}

export async function appendAutoCachedTrade(symbol: string, trade: BigTrade): Promise<void> {
  const q = pending.get(symbol) ?? [];
  q.push(trade);
  pending.set(symbol, q);
  if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; void flush(); }, FLUSH_MS);
}

export async function clearAutoCache(symbol: string): Promise<void> {
  pending.delete(symbol);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).delete(symbol));
  } catch (e) {
    console.error('clearAutoCache error', e);
  }
}
