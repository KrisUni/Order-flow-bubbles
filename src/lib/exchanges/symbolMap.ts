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

// Ordered preference for the OHLC price skeleton.
export const CANDLE_FALLBACK: Record<string, ('binance' | 'bybit')[]> = {
  DEFAULT: ['binance', 'bybit'],
  VVVUSDT: ['bybit'],
};

export function candleSourceFor(symbol: string): 'binance' | 'bybit' {
  const chain = CANDLE_FALLBACK[symbol] ?? CANDLE_FALLBACK.DEFAULT;
  return chain[0];
}
