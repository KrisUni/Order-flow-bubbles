import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { getMapping } from './symbolMap';
import { toMs } from './normalizeTime';

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = getMapping(symbol);
  if (!mapping?.bybitPerp) return { close: () => {} };

  const sym = mapping.bybitPerp;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const conn = safeWS(
    'wss://stream.bybit.com/v5/public/linear',
    (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`publicTrade.${sym}`] }));
      if (pingTimer !== null) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, 20_000);
    },
    (data) => {
      const d = data as {
        topic?: string;
        data?: Array<{ p?: string; v?: string; S?: string; T?: number }>;
      };
      if (d.topic?.startsWith('publicTrade.') && Array.isArray(d.data)) {
        for (const t of d.data) {
          if (!t.p || !t.v) continue;
          onTrade({
            price: parseFloat(t.p),
            qty: parseFloat(t.v),
            isMaker: t.S === 'Sell',
            timestamp: t.T !== undefined ? toMs(t.T) : Date.now(),
            exchange: 'bybit-perp',
          });
        }
      }
    },
    (status) => {
      if (status !== 'connected' && pingTimer !== null) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      onStatus(status, 'bybit-perp');
    },
  );

  return {
    close() {
      if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
      conn.close();
    },
  };
}
