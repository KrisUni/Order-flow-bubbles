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
  if (!mapping?.okxPerp) return { close: () => {} };

  const instId = mapping.okxPerp;

  // Fetch contract value (ctVal) once before opening the stream.
  // sz in OKX SWAP trades is in contracts; qty must be sz * ctVal (base coin).
  let conn: ExchangeConnection | null = null;

  fetch(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${instId}`)
    .then((r) => r.json())
    .then((json: { data?: Array<{ ctVal?: string }> }) => {
      const ctValStr = json.data?.[0]?.ctVal;
      const ctVal = ctValStr ? parseFloat(ctValStr) : NaN;
      if (!isFinite(ctVal) || ctVal <= 0) {
        console.warn(`[okxPerp] ctVal fetch failed for ${instId} — skipping connection`);
        return;
      }

      conn = safeWS(
        'wss://ws.okx.com:8443/ws/v5/public',
        (ws) => {
          ws.send(
            JSON.stringify({
              op: 'subscribe',
              args: [{ channel: 'trades', instId }],
            }),
          );
        },
        (data) => {
          const d = data as {
            arg?: { channel?: string };
            data?: Array<{ px?: string; sz?: string; side?: string; ts?: string }>;
          };
          if (d.arg?.channel === 'trades' && Array.isArray(d.data)) {
            for (const t of d.data) {
              if (!t.px || !t.sz) continue;
              const price = parseFloat(t.px);
              const qty   = parseFloat(t.sz) * ctVal; // contracts → base coin
              if (!isFinite(price) || !isFinite(qty)) continue;
              onTrade({
                price,
                qty,
                isMaker: t.side === 'sell',
                timestamp: t.ts ? toMs(t.ts) : Date.now(),
                exchange: 'okx-perp',
              });
            }
          }
        },
        (status) => onStatus(status, 'okx-perp'),
      );
    })
    .catch((err) => {
      console.warn(`[okxPerp] ctVal fetch error for ${instId}:`, err);
    });

  return {
    close() {
      conn?.close();
    },
  };
}
