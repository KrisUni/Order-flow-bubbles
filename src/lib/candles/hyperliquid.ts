import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../types';
import type { CandleProvider } from './types';
import { safeWS } from '../exchanges/safeWS';
import { getMapping } from '../exchanges/symbolMap';

const VALID_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d']);
const INTERVAL_SECS_MAP: Record<string, number> = {
  '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400,
};
const CANDLE_LIMIT = 500;

function getCoin(symbol: string): string {
  return getMapping(symbol)?.hyperliquid ?? symbol.replace(/(USDT|USDC|USD)$/, '');
}

interface HLCandle {
  t: number; T: number; s: string; i: string;
  o: string; h: string; l: string; c: string; v: string; n: number;
}

export const hyperliquidProvider: CandleProvider = {
  name: 'candles',

  async fetchKlines(symbol, interval, startTimeMs) {
    if (!VALID_INTERVALS.has(interval)) {
      throw new Error(`[hyperliquid] unsupported interval: ${interval}`);
    }
    const coin = getCoin(symbol);
    const endTime = Date.now();
    const start = startTimeMs ?? endTime - CANDLE_LIMIT * (INTERVAL_SECS_MAP[interval] ?? 60) * 1000;

    const resp = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: { coin, interval, startTime: start, endTime },
      }),
    });
    if (!resp.ok) return [];
    const raw = (await resp.json()) as HLCandle[];
    if (!Array.isArray(raw)) return [];

    return raw.map((k) => {
      const open  = parseFloat(k.o);
      const high  = parseFloat(k.h);
      const low   = parseFloat(k.l);
      const close = parseFloat(k.c);
      if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return null;
      const vol = parseFloat(k.v);
      return {
        time: Math.floor(k.t / 1000) as UTCTimestamp,
        open, high, low, close,
        volume: isFinite(vol) ? vol : 0,
        takerBuyVolume: undefined,
      } as Candle;
    }).filter((c): c is Candle => c !== null);
  },

  openKlineStream(symbol, interval, onUpdate, onStatus) {
    if (!VALID_INTERVALS.has(interval)) {
      throw new Error(`[hyperliquid] unsupported interval: ${interval}`);
    }
    const coin = getCoin(symbol);
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let lastOpenTimeMs: number | null = null;
    let lastCandle: Candle | null = null;

    const conn = safeWS(
      'wss://api.hyperliquid.xyz/ws',
      (ws) => {
        // Reset close-detection state on every (re)connect
        lastOpenTimeMs = null;
        lastCandle = null;
        ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'candle', coin, interval } }));
        if (pingTimer !== null) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, 30_000);
      },
      (data) => {
        const msg = data as {
          channel?: string;
          data?: { t: number; o: string; h: string; l: string; c: string; v: string };
        };
        if (msg.channel !== 'candle' || !msg.data) return;
        const k = msg.data;
        const open  = parseFloat(k.o);
        const high  = parseFloat(k.h);
        const low   = parseFloat(k.l);
        const close = parseFloat(k.c);
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return;
        const vol = parseFloat(k.v);
        const candle: Candle = {
          time: Math.floor(k.t / 1000) as UTCTimestamp,
          open, high, low, close,
          volume: isFinite(vol) ? vol : 0,
          takerBuyVolume: undefined,
        };

        if (lastOpenTimeMs === null) {
          // First update after (re)connect — seed state only
          lastOpenTimeMs = k.t;
          lastCandle = candle;
          onUpdate({ candle, closed: false });
        } else if (k.t !== lastOpenTimeMs) {
          // New open time → previous candle is now closed
          if (lastCandle) onUpdate({ candle: lastCandle, closed: true });
          lastOpenTimeMs = k.t;
          lastCandle = candle;
          onUpdate({ candle, closed: false });
        } else {
          // Same candle, in-progress tick
          lastCandle = candle;
          onUpdate({ candle, closed: false });
        }
      },
      (status) => {
        if (status !== 'connected' && pingTimer !== null) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        onStatus(status);
      },
    );

    return () => {
      if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
      conn.close();
    };
  },
};
