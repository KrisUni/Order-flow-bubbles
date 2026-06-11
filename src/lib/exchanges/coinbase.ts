import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { SYMBOL_MAP } from './symbolMap';

export interface BookTicker {
  bidPrice: number;
  askPrice: number;
  exchange: 'coinbase';
}

export function connect(
  symbol: string,
  onTicker: (ticker: BookTicker) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.coinbase) return { close: () => {} };

  const productId = mapping.coinbase;

  return safeWS(
    'wss://ws-feed.exchange.coinbase.com',
    (ws) => {
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          product_ids: [productId],
          channels: ['ticker', 'heartbeat'],
        }),
      );
    },
    (data) => {
      const msg = data as {
        type?: string;
        best_bid?: string;
        best_ask?: string;
      };
      if (msg.type !== 'ticker') return;
      if (!msg.best_bid || !msg.best_ask) return;
      const bid = parseFloat(msg.best_bid);
      const ask = parseFloat(msg.best_ask);
      if (!isFinite(bid) || !isFinite(ask)) return;
      onTicker({ bidPrice: bid, askPrice: ask, exchange: 'coinbase' });
    },
    (status) => onStatus(status, 'coinbase'),
  );
}

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string; nativeId?: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.coinbase) return { close: () => {} };

  const productId = mapping.coinbase;

  return safeWS(
    'wss://ws-feed.exchange.coinbase.com',
    (ws) => {
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          product_ids: [productId],
          channels: ['matches', 'heartbeat'],
        }),
      );
    },
    (data) => {
      const msg = data as {
        type?: string;
        trade_id?: number;
        product_id?: string;
        price?: string;
        size?: string;
        side?: string;
        time?: string;
      };
      if (msg.type !== 'match' && msg.type !== 'last_match') return;
      if (!msg.price || !msg.size) return;

      const price = parseFloat(msg.price);
      const qty   = parseFloat(msg.size);
      if (!isFinite(price) || !isFinite(qty)) return;

      // Coinbase `side` is the MAKER's side:
      //   side === 'sell' → resting sell hit → taker bought (aggressive buy, green) → isMaker: false
      //   side === 'buy'  → resting buy hit  → taker sold  (aggressive sell, red)  → isMaker: true
      onTrade({
        price,
        qty,
        isMaker: msg.side === 'buy',
        timestamp: msg.time ? Date.parse(msg.time) : Date.now(),
        exchange: 'coinbase',
        nativeId: `coinbase-${msg.trade_id}`,
      });
    },
    (status) => onStatus(status, 'coinbase'),
  );
}
