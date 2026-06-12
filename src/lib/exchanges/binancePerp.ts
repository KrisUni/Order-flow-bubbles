import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { getMapping } from './symbolMap';

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string; nativeId?: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = getMapping(symbol);
  if (!mapping?.binancePerp) return { close: () => {} };

  const sym = mapping.binancePerp.toLowerCase();

  return safeWS(
    `wss://fstream.binance.com/ws/${sym}@aggTrade`,
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
        exchange: 'binance-perp',
        nativeId: `binance-perp-${msg.a}-${ts}`,
      });
    },
    (status) => onStatus(status, 'binance-perp'),
  );
}
