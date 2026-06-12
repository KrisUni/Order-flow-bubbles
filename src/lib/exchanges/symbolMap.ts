export interface SymbolMapping {
  binance?: string | null;
  kraken?: string | null;
  bybit?: string | null;
  okx?: string | null;
  bitstamp?: string | null;
  coinbase?: string | null;
  binancePerp?: string | null;
  bybitPerp?: string | null;
  okxPerp?: string | null;
}

export const SYMBOL_MAP: Record<string, SymbolMapping> = {
  BTCUSDT:  { binance: 'BTCUSDT',  kraken: 'BTC/USDT',  bybit: 'BTCUSDT',  okx: 'BTC-USDT',  bitstamp: 'btcusd',  coinbase: 'BTC-USD',  binancePerp: 'BTCUSDT',  bybitPerp: 'BTCUSDT',  okxPerp: 'BTC-USDT-SWAP'  },
  ETHUSDT:  { binance: 'ETHUSDT',  kraken: 'ETH/USDT',  bybit: 'ETHUSDT',  okx: 'ETH-USDT',  bitstamp: 'ethusd',  coinbase: 'ETH-USD',  binancePerp: 'ETHUSDT',  bybitPerp: 'ETHUSDT',  okxPerp: 'ETH-USDT-SWAP'  },
  SOLUSDT:  { binance: 'SOLUSDT',  kraken: 'SOL/USDT',  bybit: 'SOLUSDT',  okx: 'SOL-USDT',                       coinbase: 'SOL-USD',  binancePerp: 'SOLUSDT',  bybitPerp: 'SOLUSDT',  okxPerp: 'SOL-USDT-SWAP'  },
  BNBUSDT:  { binance: 'BNBUSDT',                        bybit: 'BNBUSDT',  okx: 'BNB-USDT',                       coinbase: null,       binancePerp: 'BNBUSDT',  bybitPerp: 'BNBUSDT',  okxPerp: 'BNB-USDT-SWAP'  },
  XRPUSDT:  { binance: 'XRPUSDT',  kraken: 'XRP/USDT',  bybit: 'XRPUSDT',  okx: 'XRP-USDT',  bitstamp: 'xrpusd',  coinbase: 'XRP-USD',  binancePerp: 'XRPUSDT',  bybitPerp: 'XRPUSDT',  okxPerp: 'XRP-USDT-SWAP'  },
  ADAUSDT:  { binance: 'ADAUSDT',  kraken: 'ADA/USDT',  bybit: 'ADAUSDT',  okx: 'ADA-USDT',                       coinbase: 'ADA-USD',  binancePerp: 'ADAUSDT',  bybitPerp: 'ADAUSDT',  okxPerp: 'ADA-USDT-SWAP'  },
  DOGEUSDT: { binance: 'DOGEUSDT', kraken: 'DOGE/USDT', bybit: 'DOGEUSDT', okx: 'DOGE-USDT', bitstamp: 'dogeusd', coinbase: 'DOGE-USD', binancePerp: 'DOGEUSDT', bybitPerp: 'DOGEUSDT', okxPerp: 'DOGE-USDT-SWAP' },
  LTCUSDT:  { binance: 'LTCUSDT',  kraken: 'LTC/USDT',  bybit: 'LTCUSDT',  okx: 'LTC-USDT',  bitstamp: 'ltcusd',  coinbase: 'LTC-USD',  binancePerp: 'LTCUSDT',  bybitPerp: 'LTCUSDT',  okxPerp: 'LTC-USDT-SWAP'  },
  VVVUSDT:  { binance: null,        kraken: 'VVV/USD',   bybit: 'VVVUSDT',  okx: null,         bitstamp: null,      coinbase: 'VVV-USD',  binancePerp: null,       bybitPerp: 'VVVUSDT',  okxPerp: null             },
};

// ── Candle skeleton preference ────────────────────────────────────
export const CANDLE_FALLBACK: Record<string, ('binance' | 'bybit')[]> = {
  DEFAULT: ['binance', 'bybit'],
  VVVUSDT: ['bybit'],
};

// ── Venue map type (hyphenated keys) — used by resolver ───────────
export type ResolvedVenues = {
  binance: string | null;
  bybit: string | null;
  okx: string | null;
  kraken: string | null;
  bitstamp: string | null;
  coinbase: string | null;
  'binance-perp': string | null;
  'bybit-perp': string | null;
  'okx-perp': string | null;
};

// Static overrides: curated venue strings that WIN over any probe result.
// Explicit null = "curated not listed" (beats a probe false-positive).
// Missing key = "probe normally".
export const STATIC_OVERRIDES: Record<string, Partial<ResolvedVenues>> = {
  BTCUSDT:  { binance: 'BTCUSDT',  bybit: 'BTCUSDT',  okx: 'BTC-USDT',  kraken: 'BTC/USDT',  bitstamp: 'btcusd',  coinbase: 'BTC-USD',  'binance-perp': 'BTCUSDT',  'bybit-perp': 'BTCUSDT',  'okx-perp': 'BTC-USDT-SWAP'  },
  ETHUSDT:  { binance: 'ETHUSDT',  bybit: 'ETHUSDT',  okx: 'ETH-USDT',  kraken: 'ETH/USDT',  bitstamp: 'ethusd',  coinbase: 'ETH-USD',  'binance-perp': 'ETHUSDT',  'bybit-perp': 'ETHUSDT',  'okx-perp': 'ETH-USDT-SWAP'  },
  SOLUSDT:  { binance: 'SOLUSDT',  bybit: 'SOLUSDT',  okx: 'SOL-USDT',  kraken: 'SOL/USDT',                       coinbase: 'SOL-USD',  'binance-perp': 'SOLUSDT',  'bybit-perp': 'SOLUSDT',  'okx-perp': 'SOL-USDT-SWAP'  },
  BNBUSDT:  { binance: 'BNBUSDT',  bybit: 'BNBUSDT',  okx: 'BNB-USDT',                        coinbase: null,                         'binance-perp': 'BNBUSDT',  'bybit-perp': 'BNBUSDT',  'okx-perp': 'BNB-USDT-SWAP'  },
  XRPUSDT:  { binance: 'XRPUSDT',  bybit: 'XRPUSDT',  okx: 'XRP-USDT',  kraken: 'XRP/USDT',  bitstamp: 'xrpusd',  coinbase: 'XRP-USD',  'binance-perp': 'XRPUSDT',  'bybit-perp': 'XRPUSDT',  'okx-perp': 'XRP-USDT-SWAP'  },
  ADAUSDT:  { binance: 'ADAUSDT',  bybit: 'ADAUSDT',  okx: 'ADA-USDT',  kraken: 'ADA/USDT',                       coinbase: 'ADA-USD',  'binance-perp': 'ADAUSDT',  'bybit-perp': 'ADAUSDT',  'okx-perp': 'ADA-USDT-SWAP'  },
  DOGEUSDT: { binance: 'DOGEUSDT', bybit: 'DOGEUSDT', okx: 'DOGE-USDT', kraken: 'DOGE/USDT', bitstamp: 'dogeusd', coinbase: 'DOGE-USD', 'binance-perp': 'DOGEUSDT', 'bybit-perp': 'DOGEUSDT', 'okx-perp': 'DOGE-USDT-SWAP' },
  LTCUSDT:  { binance: 'LTCUSDT',  bybit: 'LTCUSDT',  okx: 'LTC-USDT',  kraken: 'LTC/USDT',  bitstamp: 'ltcusd',  coinbase: 'LTC-USD',  'binance-perp': 'LTCUSDT',  'bybit-perp': 'LTCUSDT',  'okx-perp': 'LTC-USDT-SWAP'  },
  VVVUSDT:  { binance: null,        bybit: 'VVVUSDT',  okx: null,         kraken: 'VVV/USD',   bitstamp: null,      coinbase: 'VVV-USD',  'binance-perp': null,       'bybit-perp': 'VVVUSDT',  'okx-perp': null              },
};

// ── Runtime registry (camelCase schema, same as SymbolMapping) ────
interface RegistryEntry {
  binance: string | null;
  bybit: string | null;
  okx: string | null;
  kraken: string | null;
  bitstamp: string | null;
  coinbase: string | null;
  binancePerp: string | null;
  bybitPerp: string | null;
  okxPerp: string | null;
  candleSource: 'binance' | 'bybit' | null;
}

const runtimeRegistry = new Map<string, RegistryEntry>();

/** Register a resolved symbol into the in-memory registry.
 *  Called by resolver.ts after probe or cache restore. */
export function registerSymbol(
  canonical: string,
  venues: ResolvedVenues,
  candleSource: 'binance' | 'bybit' | null,
): void {
  runtimeRegistry.set(canonical, {
    binance:     venues.binance,
    bybit:       venues.bybit,
    okx:         venues.okx,
    kraken:      venues.kraken,
    bitstamp:    venues.bitstamp,
    coinbase:    venues.coinbase,
    binancePerp: venues['binance-perp'],
    bybitPerp:   venues['bybit-perp'],
    okxPerp:     venues['okx-perp'],
    candleSource,
  });
}

/** Get the symbol mapping for `canonical`.
 *  Registry entry (from a runtime resolve) takes priority over the static map. */
export function getMapping(canonical: string): SymbolMapping | null {
  const entry = runtimeRegistry.get(canonical);
  if (entry) return entry;
  return SYMBOL_MAP[canonical] ?? null;
}

export function candleSourceFor(symbol: string): 'binance' | 'bybit' {
  const entry = runtimeRegistry.get(symbol);
  if (entry?.candleSource) return entry.candleSource;
  const chain = CANDLE_FALLBACK[symbol] ?? CANDLE_FALLBACK.DEFAULT;
  return chain[0];
}

// ── Module init: pre-populate registry from localStorage cache ────
try {
  const raw = localStorage.getItem('symbol-resolve-cache');
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, {
      canonical?: string;
      venues?: ResolvedVenues;
      candleSource?: 'binance' | 'bybit' | null;
      resolvedAt?: number;
    }>;
    const now = Date.now();
    const TTL = 24 * 60 * 60 * 1000;
    for (const entry of Object.values(parsed)) {
      if (!entry.canonical || !entry.venues || typeof entry.resolvedAt !== 'number') continue;
      if (now - entry.resolvedAt > TTL) continue;
      registerSymbol(entry.canonical, entry.venues, entry.candleSource ?? null);
    }
  }
} catch {
  // localStorage unavailable or corrupt — silently skip
}
