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
  if (!mapping?.hyperliquid) return { close: () => {} };

  const coin = mapping.hyperliquid;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const conn = safeWS(
    'wss://api.hyperliquid.xyz/ws',
    (ws) => {
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } }));
      if (pingTimer !== null) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: 'ping' }));
        }
      }, 30_000);
    },
    (data) => {
      const d = data as {
        channel?: string;
        data?: Array<{ px: string; sz: string; side: string; time: number; tid: number }>;
      };
      if (d.channel === 'trades' && Array.isArray(d.data)) {
        for (const t of d.data) {
          if (!t.px || !t.sz) continue;
          onTrade({
            price: parseFloat(t.px),
            qty: parseFloat(t.sz),
            isMaker: t.side === 'A',
            timestamp: t.time,
            exchange: 'hyperliquid',
            nativeId: `hyperliquid-${t.tid}`,
          });
        }
      }
    },
    (status) => {
      if (status !== 'connected' && pingTimer !== null) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      onStatus(status, 'hyperliquid');
    },
  );

  return {
    close() {
      if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
      conn.close();
    },
  };
}
