import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../types';
import type { CandleProvider } from './types';
import { safeWS } from '../exchanges/safeWS';
import { SYMBOL_MAP } from '../exchanges/symbolMap';

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '1d': 'D',
};

export const bybitProvider: CandleProvider = {
  name: 'candles',

  async fetchKlines(symbol, interval, startTimeMs) {
    const sym = SYMBOL_MAP[symbol]?.bybit ?? symbol;
    const mapped = INTERVAL_MAP[interval] ?? interval;
    let url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}&interval=${mapped}&limit=500`;
    if (startTimeMs !== undefined) url += `&start=${startTimeMs}`;

    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = (await resp.json()) as {
      result?: { list?: string[][] };
    };
    const list = json.result?.list;
    if (!Array.isArray(list)) return [];

    // Bybit returns newest-first — reverse
    return list
      .slice()
      .reverse()
      .map((k) => {
        const open  = parseFloat(k[1]);
        const high  = parseFloat(k[2]);
        const low   = parseFloat(k[3]);
        const close = parseFloat(k[4]);
        const vol   = parseFloat(k[5]);
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return null;
        return {
          time: (Number(k[0]) / 1000) as UTCTimestamp,
          open, high, low, close,
          volume: isFinite(vol) ? vol : 0,
          takerBuyVolume: undefined, // Bybit klines have no taker split
        } as Candle;
      })
      .filter((c): c is Candle => c !== null);
  },

  openKlineStream(symbol, interval, onUpdate, onStatus) {
    const sym = SYMBOL_MAP[symbol]?.bybit ?? symbol;
    const mapped = INTERVAL_MAP[interval] ?? interval;
    const topic = `kline.${mapped}.${sym}`;

    let currentWs: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const conn = safeWS(
      'wss://stream.bybit.com/v5/public/spot',
      (ws) => {
        currentWs = ws;
        ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (currentWs?.readyState === WebSocket.OPEN) {
            currentWs.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20_000);
      },
      (data) => {
        const msg = data as {
          topic?: string;
          data?: Array<{
            start: number;
            open: string; high: string; low: string; close: string;
            volume: string;
            confirm: boolean;
          }>;
        };
        if (msg.topic !== topic || !Array.isArray(msg.data) || !msg.data[0]) return;
        const k = msg.data[0];
        const open  = parseFloat(k.open);
        const high  = parseFloat(k.high);
        const low   = parseFloat(k.low);
        const close = parseFloat(k.close);
        if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return;
        const vol = parseFloat(k.volume);
        const candle: Candle = {
          time: (k.start / 1000) as UTCTimestamp,
          open, high, low, close,
          volume: isFinite(vol) ? vol : 0,
          takerBuyVolume: undefined,
        };
        onUpdate({ candle, closed: k.confirm === true });
      },
      (status) => onStatus(status),
    );

    return () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      conn.close();
    };
  },
};
