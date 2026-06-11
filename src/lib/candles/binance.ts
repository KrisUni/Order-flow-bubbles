import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../types';
import type { CandleProvider, KlineUpdate } from './types';
import { safeWS } from '../exchanges/safeWS';

const REST = 'https://api.binance.com/api/v3';
const LIMIT = 500;

const INTERVAL_WS_MAP: Record<string, string> = {};
// Binance kline interval strings match directly (1m, 5m, 1h, etc.)

interface BinanceKline {
  t: number; o: string; h: string; l: string; c: string; v: string; V: string;
}

function parseCandle(k: BinanceKline): Candle {
  const vol = parseFloat(k.v);
  const tbv = parseFloat(k.V);
  return {
    time: (Math.floor(k.t / 1000)) as UTCTimestamp,
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: isFinite(vol) ? vol : 0,
    takerBuyVolume: isFinite(tbv) ? tbv : undefined,
  };
}

export const binanceProvider: CandleProvider = {
  name: 'candles',

  async fetchKlines(symbol, interval, startTimeMs) {
    let url = `${REST}/klines?symbol=${symbol}&interval=${interval}&limit=${LIMIT}`;
    if (startTimeMs !== undefined) url += `&startTime=${startTimeMs}`;

    const resp = await fetch(url);
    if (!resp.ok) return [];
    const raw: unknown[][] = await resp.json();

    return raw
      .map((k) => {
        const open  = parseFloat(k[1] as string);
        const high  = parseFloat(k[2] as string);
        const low   = parseFloat(k[3] as string);
        const close = parseFloat(k[4] as string);
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return null;
        const vol = parseFloat(k[5] as string);
        const tbv = parseFloat(k[9] as string);
        return {
          time: (Math.floor((k[0] as number) / 1000)) as UTCTimestamp,
          open, high, low, close,
          volume: isFinite(vol) ? vol : 0,
          takerBuyVolume: isFinite(tbv) ? tbv : undefined,
        } as Candle;
      })
      .filter((c): c is Candle => c !== null);
  },

  openKlineStream(symbol, interval, onUpdate, onStatus) {
    const sym = symbol.toLowerCase();
    void INTERVAL_WS_MAP; // unused — Binance uses interval strings directly

    const conn = safeWS(
      `wss://stream.binance.com:9443/ws/${sym}@kline_${interval}`,
      () => {},
      (data) => {
        const msg = data as { e?: string; k?: BinanceKline & { x?: boolean } };
        if (msg.e !== 'kline' || !msg.k) return;
        const k = msg.k;
        const open  = parseFloat(k.o);
        const high  = parseFloat(k.h);
        const low   = parseFloat(k.l);
        const close = parseFloat(k.c);
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return;
        onUpdate({ candle: parseCandle(k), closed: !!k.x });
      },
      (status) => onStatus(status),
    );

    return () => conn.close();
  },
};
