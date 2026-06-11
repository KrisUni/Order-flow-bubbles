import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { SYMBOL_MAP } from './symbolMap';

export interface BookTicker {
  bidPrice: number;
  askPrice: number;
  exchange: 'binance';
}

export function connect(
  symbol: string,
  onTicker: (ticker: BookTicker) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.binance) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const sym = mapping.binance.toLowerCase();
  const url = `wss://stream.binance.com:9443/ws/${sym}@bookTicker`;

  return safeWS(
    url,
    () => {},
    (data) => {
      const d = data as { b?: string; a?: string };
      if (d.b !== undefined && d.a !== undefined) {
        onTicker({
          bidPrice: parseFloat(d.b),
          askPrice: parseFloat(d.a),
          exchange: 'binance',
        });
      }
    },
    (status) => onStatus(status, 'binance'),
  );
}

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string; nativeId?: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.binance) return { close: () => {} };

  const sym = mapping.binance.toLowerCase();

  return safeWS(
    `wss://stream.binance.com:9443/ws/${sym}@aggTrade`,
    () => {},
    (data) => {
      const msg = data as { e?: string; p?: string; q?: string; m?: boolean; T?: number; a?: number };
      if (msg.e !== 'aggTrade') return;
      const price = parseFloat(msg.p ?? '');
      const qty   = parseFloat(msg.q ?? '');
      if (!isFinite(price) || !isFinite(qty)) return;
      const ts = msg.T ?? Date.now();
      onTrade({
        price,
        qty,
        isMaker: !!msg.m,
        timestamp: ts,
        exchange: 'binance',
        nativeId: `binance-${msg.a}-${ts}`,
      });
    },
    (status) => onStatus(status, 'binance'),
  );
}
