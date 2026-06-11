export interface SymbolMapping {
  binance?: string | null;
  kraken?: string | null;
  bybit?: string | null;
  okx?: string | null;
  bitstamp?: string | null;
}

export const SYMBOL_MAP: Record<string, SymbolMapping> = {
  BTCUSDT:  { binance: 'BTCUSDT',  kraken: 'BTC/USDT',  bybit: 'BTCUSDT',  okx: 'BTC-USDT',  bitstamp: 'btcusd'  },
  ETHUSDT:  { binance: 'ETHUSDT',  kraken: 'ETH/USDT',  bybit: 'ETHUSDT',  okx: 'ETH-USDT',  bitstamp: 'ethusd'  },
  SOLUSDT:  { binance: 'SOLUSDT',  kraken: 'SOL/USDT',  bybit: 'SOLUSDT',  okx: 'SOL-USDT'                       },
  BNBUSDT:  { binance: 'BNBUSDT',                        bybit: 'BNBUSDT',  okx: 'BNB-USDT'                       },
  XRPUSDT:  { binance: 'XRPUSDT',  kraken: 'XRP/USDT',  bybit: 'XRPUSDT',  okx: 'XRP-USDT',  bitstamp: 'xrpusd'  },
  ADAUSDT:  { binance: 'ADAUSDT',  kraken: 'ADA/USDT',  bybit: 'ADAUSDT',  okx: 'ADA-USDT'                       },
  DOGEUSDT: { binance: 'DOGEUSDT', kraken: 'DOGE/USDT', bybit: 'DOGEUSDT', okx: 'DOGE-USDT', bitstamp: 'dogeusd' },
  LTCUSDT:  { binance: 'LTCUSDT',  kraken: 'LTC/USDT',  bybit: 'LTCUSDT',  okx: 'LTC-USDT',  bitstamp: 'ltcusd'  },
  VVVUSDT:  { binance: null,        kraken: 'VVV/USD',   bybit: 'VVVUSDT',  okx: null,         bitstamp: null      },
};

// Ordered preference for the OHLC price skeleton.
export const CANDLE_FALLBACK: Record<string, ('binance' | 'bybit')[]> = {
  DEFAULT: ['binance', 'bybit'],
  VVVUSDT: ['bybit'],
};

export function candleSourceFor(symbol: string): 'binance' | 'bybit' {
  const chain = CANDLE_FALLBACK[symbol] ?? CANDLE_FALLBACK.DEFAULT;
  return chain[0];
}
