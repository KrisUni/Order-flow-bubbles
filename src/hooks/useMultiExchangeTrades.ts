import { useEffect, useRef } from 'react';
import type { ExchangeConnection, Bubble, Candle, VolEntry } from '../lib/types';
import type { Detector } from '../lib/detector';
import { classifyTrade } from '../lib/detector';
import { useStore } from '../lib/config';
import { INTERVAL_SECS } from '../lib/constants';
import { appendAutoCachedTrade } from '../lib/autoCache';
import { evaluateAlerts } from '../lib/alerts';
import * as Kraken from '../lib/exchanges/kraken';
import * as Bybit from '../lib/exchanges/bybit';
import * as Okx from '../lib/exchanges/okx';
import * as Bitstamp from '../lib/exchanges/bitstamp';
import * as Binance from '../lib/exchanges/binance';
import type { RawTrade } from '../lib/detector';

export function useMultiExchangeTrades(
  detectorRef: React.RefObject<Detector | null>,
  currentCandleRef: React.RefObject<Candle | null>,
  closedCandleRef: React.RefObject<Candle | null>,
  compositeVolRef: React.RefObject<Map<number, VolEntry>>,
): void {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const addBubble = useStore((s) => s.addBubble);
  const addToTradesLog = useStore((s) => s.addToTradesLog);
  const setExchangeStatus = useStore((s) => s.setExchangeStatus);

  const connectionsRef = useRef<ExchangeConnection[]>([]);

  useEffect(() => {
    connectionsRef.current.forEach((c) => c.close());
    connectionsRef.current = [];

    const intervalSecs = INTERVAL_SECS[interval] ?? 60;
    let tradeSeq = 0;

    function handleTrade(trade: RawTrade & { exchange: string; nativeId?: string }) {
      const detector = detectorRef.current;
      if (!detector) return;

      const candleTime =
        Math.floor(trade.timestamp / 1000 / intervalSecs) * intervalSecs;

      // Accumulate ALL trades into compositeVolRef (base asset units, per candle bin)
      const existing = compositeVolRef.current.get(candleTime) ?? { buyVol: 0, sellVol: 0 };
      if (trade.isMaker) existing.sellVol += trade.qty;
      else               existing.buyVol  += trade.qty;
      compositeVolRef.current.set(candleTime, existing);

      const result = detector.processTrade(trade);
      if (!result) return;

      if (!currentCandleRef.current) return;

      const tradeTime = Math.floor(trade.timestamp / 1000);
      const id = trade.nativeId ?? `${trade.exchange}-${trade.timestamp}-${tradeSeq++}`;

      const { minUsdFilter, showPatterns } = useStore.getState();

      // Classify against closed candle (final OHLC); fall back to live candle
      const classifyCandle = closedCandleRef.current ?? currentCandleRef.current;
      const classification = (classifyCandle && showPatterns)
        ? classifyTrade(result, classifyCandle)
        : {};

      const logEntry = {
        id,
        time: tradeTime,
        price: trade.price,
        qty: trade.qty,
        usdValue: result.usdValue,
        isMaker: trade.isMaker,
        pattern: classification.pattern,
        patternSignal: classification.patternSignal,
        exchange: trade.exchange,
      };

      appendAutoCachedTrade(symbol, logEntry).catch(console.error);
      evaluateAlerts(logEntry);

      if (minUsdFilter > 0 && result.usdValue < minUsdFilter) return;

      const bubble: Bubble = {
        id,
        time: candleTime,
        price: trade.price,
        qty: trade.qty,
        usdValue: result.usdValue,
        isMaker: trade.isMaker,
        pattern: classification.pattern,
        patternSignal: classification.patternSignal,
        exchange: trade.exchange,
        birthMs: Date.now(),
      };

      addBubble(bubble);
      addToTradesLog(logEntry);
    }

    function onStatus(exchange: string) {
      return (status: Parameters<typeof setExchangeStatus>[1], ex?: string) =>
        setExchangeStatus(ex ?? exchange, status);
    }

    connectionsRef.current = [
      Kraken.connectTrades(symbol, handleTrade, onStatus('kraken')),
      Bybit.connectTrades(symbol, handleTrade, onStatus('bybit')),
      Okx.connectTrades(symbol, handleTrade, onStatus('okx')),
      Bitstamp.connectTrades(symbol, handleTrade, onStatus('bitstamp')),
      Binance.connectTrades(symbol, handleTrade, onStatus('binance')),
    ];

    return () => {
      connectionsRef.current.forEach((c) => c.close());
      connectionsRef.current = [];
    };
  }, [symbol, interval]); // eslint-disable-line react-hooks/exhaustive-deps
}
