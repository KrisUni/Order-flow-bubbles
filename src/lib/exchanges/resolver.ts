import {
  STATIC_OVERRIDES,
  CANDLE_FALLBACK,
  registerSymbol,
  type ResolvedVenues,
} from './symbolMap';

const CACHE_KEY = 'symbol-resolve-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 4000;

export interface ResolvedSymbol {
  canonical: string;
  base: string;
  venues: ResolvedVenues;
  candleSource: 'binance' | 'bybit' | null;
  resolvedAt: number;
}

export function normalizeInput(raw: string): { canonical: string; base: string } {
  const s = raw.trim().toUpperCase();
  const base = s.replace(/(USDT|USDC|USD|PERP)$/g, '').replace(/[-/]$/, '');
  return { canonical: `${base}USDT`, base };
}

// ── Cache helpers ─────────────────────────────────────────────────

function loadCache(): Record<string, ResolvedSymbol> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ResolvedSymbol>) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, ResolvedSymbol>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

// ── Timeout-aware fetch ───────────────────────────────────────────

async function timedFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return r;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Bitstamp pair list cache (module-level, one fetch per session) ─

let bitstampPairsCache: Array<{ url_symbol: string }> | null = null;

async function fetchBitstampPairs(): Promise<Array<{ url_symbol: string }>> {
  if (bitstampPairsCache) return bitstampPairsCache;
  const r = await timedFetch('https://www.bitstamp.net/api/v2/trading-pairs-info/');
  const data = await r.json() as Array<{ url_symbol: string }>;
  bitstampPairsCache = data;
  return data;
}

// ── Per-venue probe functions ─────────────────────────────────────

async function probeBinance(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${base}USDT`);
    if (r.status === 400) return null;
    const json = await r.json() as { symbols?: Array<{ status: string }> };
    return json.symbols?.[0]?.status === 'TRADING' ? `${base}USDT` : null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'binance', base, e);
    return null;
  }
}

async function probeBybit(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(
      `https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=${base}USDT`,
    );
    const json = await r.json() as { result?: { list?: Array<{ status: string }> } };
    const list = json.result?.list ?? [];
    return list.length > 0 && list[0].status === 'Trading' ? `${base}USDT` : null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'bybit', base, e);
    return null;
  }
}

async function probeBybitPerp(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(
      `https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${base}USDT`,
    );
    const json = await r.json() as { result?: { list?: Array<{ status: string }> } };
    const list = json.result?.list ?? [];
    return list.length > 0 && list[0].status === 'Trading' ? `${base}USDT` : null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'bybit-perp', base, e);
    return null;
  }
}

async function probeBinancePerp(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${base}USDT`,
    );
    return r.status === 200 ? `${base}USDT` : null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'binance-perp', base, e);
    return null;
  }
}

async function probeOkx(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(
      `https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=${base}-USDT`,
    );
    const json = await r.json() as { data?: unknown[] };
    return (json.data?.length ?? 0) > 0 ? `${base}-USDT` : null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'okx', base, e);
    return null;
  }
}

async function probeOkxPerp(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(
      `https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${base}-USDT-SWAP`,
    );
    const json = await r.json() as { data?: unknown[] };
    return (json.data?.length ?? 0) > 0 ? `${base}-USDT-SWAP` : null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'okx-perp', base, e);
    return null;
  }
}

async function probeCoinbase(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(`https://api.exchange.coinbase.com/products/${base}-USD`);
    if (r.ok) {
      const json = await r.json() as { id?: string };
      if (json.id) return `${base}-USD`;
    }
    // 404 → try USDC
    const r2 = await timedFetch(`https://api.exchange.coinbase.com/products/${base}-USDC`);
    if (r2.ok) {
      const json2 = await r2.json() as { id?: string };
      if (json2.id) return `${base}-USDC`;
    }
    return null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'coinbase', base, e);
    return null;
  }
}

async function probeKraken(base: string): Promise<string | null> {
  try {
    const r = await timedFetch(`https://api.kraken.com/0/public/AssetPairs?pair=${base}USD`);
    const json = await r.json() as { error?: string[]; result?: Record<string, unknown> };
    if (!json.error?.length && Object.keys(json.result ?? {}).length > 0) {
      return `${base}/USD`;
    }
    // Retry with USDT
    const r2 = await timedFetch(`https://api.kraken.com/0/public/AssetPairs?pair=${base}USDT`);
    const json2 = await r2.json() as { error?: string[]; result?: Record<string, unknown> };
    if (!json2.error?.length && Object.keys(json2.result ?? {}).length > 0) {
      return `${base}/USDT`;
    }
    return null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'kraken', base, e);
    return null;
  }
}

async function probeBitstamp(base: string): Promise<string | null> {
  try {
    const pairs = await fetchBitstampPairs();
    const target = `${base.toLowerCase()}usd`;
    const found = pairs.find((p) => p.url_symbol === target);
    return found ? found.url_symbol : null;
  } catch (e) {
    console.warn('[resolver] probe failed', 'bitstamp', base, e);
    return null;
  }
}

// ── Probe dispatch map ────────────────────────────────────────────

type VenueKey = keyof ResolvedVenues;

const PROBERS: Record<VenueKey, (base: string) => Promise<string | null>> = {
  binance:       probeBinance,
  bybit:         probeBybit,
  okx:           probeOkx,
  kraken:        probeKraken,
  bitstamp:      probeBitstamp,
  coinbase:      probeCoinbase,
  'binance-perp': probeBinancePerp,
  'bybit-perp':  probeBybitPerp,
  'okx-perp':    probeOkxPerp,
};

const ALL_VENUES: VenueKey[] = [
  'binance', 'bybit', 'okx', 'kraken', 'bitstamp',
  'coinbase', 'binance-perp', 'bybit-perp', 'okx-perp',
];

// ── Public API ────────────────────────────────────────────────────

export function registerResolved(entry: ResolvedSymbol): void {
  registerSymbol(entry.canonical, entry.venues, entry.candleSource);
}

export async function resolveSymbol(raw: string): Promise<ResolvedSymbol> {
  const { canonical, base } = normalizeInput(raw);

  // 1. Cache check
  const cache = loadCache();
  const cached = cache[canonical];
  if (cached && Date.now() - cached.resolvedAt < CACHE_TTL) {
    registerResolved(cached);
    return cached;
  }

  // 2. Determine which venues need probing (not covered by static overrides)
  const override = STATIC_OVERRIDES[canonical] ?? {};
  const needsProbe = ALL_VENUES.filter((v) => !(v in override));

  // 3. Run needed probes in parallel
  const probeResults: Partial<ResolvedVenues> = {};
  if (needsProbe.length > 0) {
    const results = await Promise.all(needsProbe.map((v) => PROBERS[v](base)));
    needsProbe.forEach((v, i) => {
      probeResults[v] = results[i];
    });
  }

  // 4. Build venues: static override wins over probe (even explicit null)
  const venues: ResolvedVenues = {
    binance:       'binance'       in override ? override.binance!       : (probeResults.binance       ?? null),
    bybit:         'bybit'         in override ? override.bybit!         : (probeResults.bybit         ?? null),
    okx:           'okx'           in override ? override.okx!           : (probeResults.okx           ?? null),
    kraken:        'kraken'        in override ? override.kraken!        : (probeResults.kraken        ?? null),
    bitstamp:      'bitstamp'      in override ? override.bitstamp!      : (probeResults.bitstamp      ?? null),
    coinbase:      'coinbase'      in override ? override.coinbase!      : (probeResults.coinbase      ?? null),
    'binance-perp': 'binance-perp' in override ? override['binance-perp']! : (probeResults['binance-perp'] ?? null),
    'bybit-perp':  'bybit-perp'    in override ? override['bybit-perp']!  : (probeResults['bybit-perp']  ?? null),
    'okx-perp':    'okx-perp'      in override ? override['okx-perp']!    : (probeResults['okx-perp']    ?? null),
  };

  // 5. Determine candle source (respects CANDLE_FALLBACK overrides)
  const fallbackChain = CANDLE_FALLBACK[canonical] ?? CANDLE_FALLBACK.DEFAULT;
  let candleSource: 'binance' | 'bybit' | null = null;
  for (const src of fallbackChain) {
    if (venues[src]) { candleSource = src; break; }
  }

  const result: ResolvedSymbol = { canonical, base, venues, candleSource, resolvedAt: Date.now() };

  // 6. Register and persist
  registerResolved(result);
  cache[canonical] = result;
  saveCache(cache);

  return result;
}
