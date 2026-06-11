import { useEffect, useRef } from 'react';
import type { Candle, Bubble, VolEntry } from '../lib/types';
import type { ChartHandle } from '../components/Chart';
import type { Detector } from '../lib/detector';
import { classifyTrade } from '../lib/detector';
import { useStore } from '../lib/config';
import { INTERVAL_SECS } from '../lib/constants';
import { getAutoCachedTrades } from '../lib/autoCache';
import {
  loadPriceHistory,
  savePriceHistory,
  mergeCandleIntoHistory,
  saveDetectorWindow,
  loadDetectorWindow,
} from '../lib/priceDB';
import { binanceProvider } from '../lib/candles/binance';
import { bybitProvider } from '../lib/candles/bybit';
import { candleSourceFor } from '../lib/exchanges/symbolMap';
import type { KlineUpdate } from '../lib/candles/types';

const CANDLE_LIMIT = 500;

export function useBinanceStream(
  chartRef: React.RefObject<ChartHandle | null>,
  detectorRef: React.RefObject<Detector | null>,
  currentCandleRef: React.RefObject<Candle | null>,
  closedCandleRef: React.RefObject<Candle | null>,
  compositeVolRef: React.RefObject<Map<number, VolEntry>>,
): void {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const showPatterns = useStore((s) => s.showPatterns);
  const autoLoadTrades = useStore((s) => s.autoLoadTrades);
  const setBubbles = useStore((s) => s.setBubbles);
  const replaceBubbles = useStore((s) => s.replaceBubbles);
  const setTradesLog = useStore((s) => s.setTradesLog);
  const clearBubbles = useStore((s) => s.clearBubbles);
  const clearTradesLog = useStore((s) => s.clearTradesLog);
  const setExchangeStatus = useStore((s) => s.setExchangeStatus);
  const setLastTick = useStore((s) => s.setLastTick);

  const wsRef = useRef<WebSocket[]>([]);
  const closeKlineRef = useRef<(() => void) | null>(null);
  const candlesRef = useRef<Map<number, Candle>>(new Map());
  const prevSymbolRef = useRef<string>(symbol);
  const didMountFilterRef = useRef(false);

  useEffect(() => {
    const symbolChanged = symbol !== prevSymbolRef.current;
    prevSymbolRef.current = symbol;

    clearBubbles();
    if (symbolChanged) clearTradesLog();
    detectorRef.current?.reset();
    candlesRef.current = new Map();
    currentCandleRef.current = null;
    compositeVolRef.current.clear();

    let cancelled = false;

    const provider = candleSourceFor(symbol) === 'bybit' ? bybitProvider : binanceProvider;

    async function init() {
      chartRef.current?.clearChart();
      setExchangeStatus('candles', 'connecting');

      // Restore detector window before stream opens so first trades have context
      const savedWindow = await loadDetectorWindow(symbol, interval);
      if (savedWindow.length > 0) detectorRef.current?.warmup(savedWindow);

      await loadHistory();
      if (cancelled) return;

      if (autoLoadTrades) {
        await loadAutoCached();
      } else if (!symbolChanged) {
        rebuildBubblesFromLog();
      }
      if (cancelled) return;

      openStream();
    }

    async function loadHistory() {
      // 1. Paint from priceDB immediately (fast first paint — no session cache)
      const stored = await loadPriceHistory(symbol, interval);

      if (stored.length > 0) {
        for (const c of stored) {
          candlesRef.current.set(c.time as number, c);
          if (c.takerBuyVolume !== undefined && c.volume !== undefined) {
            compositeVolRef.current.set(c.time as number, { buyVol: c.takerBuyVolume, sellVol: c.volume - c.takerBuyVolume });
          }
        }
        chartRef.current?.setCandles(stored);
        currentCandleRef.current = stored[stored.length - 1] ?? null;
      }

      // 2. Fetch from provider REST — delta if gap small, else latest CANDLE_LIMIT
      try {
        const keys = Array.from(candlesRef.current.keys());
        const lastTime = keys.length > 0 ? keys.reduce((a, b) => Math.max(a, b), 0) : null;
        const intervalSecs = INTERVAL_SECS[interval] ?? 60;
        let startTimeMs: number | undefined;
        let fullRefresh = false;
        if (lastTime) {
          const gapCandles = Math.floor((Date.now() / 1000 - lastTime) / intervalSecs);
          if (gapCandles < CANDLE_LIMIT) {
            startTimeMs = lastTime * 1000;
          } else {
            fullRefresh = true;
          }
        }

        const fresh: Candle[] = await provider.fetchKlines(symbol, interval, startTimeMs);
        if (cancelled) return;

        if (fresh.length > 0) {
          if (fullRefresh) {
            candlesRef.current.clear();
            compositeVolRef.current.clear();
          }
          for (const c of fresh) {
            candlesRef.current.set(c.time as number, c);
            if (c.takerBuyVolume !== undefined && c.volume !== undefined) {
              compositeVolRef.current.set(c.time as number, { buyVol: c.takerBuyVolume, sellVol: c.volume - c.takerBuyVolume });
            }
          }
          const all = Array.from(candlesRef.current.values()).sort(
            (a, b) => (a.time as number) - (b.time as number),
          );
          chartRef.current?.setCandles(all);
          currentCandleRef.current = all[all.length - 1] ?? null;
          await savePriceHistory(symbol, interval, all);
        }
      } catch (e) {
        console.error('loadHistory error', e);
      }
    }

    async function loadAutoCached() {
      try {
        const trades = await getAutoCachedTrades(symbol);
        if (trades.length === 0) return;

        // Apply active USD display filter
        const { minUsdFilter, showPatterns } = useStore.getState();
        const filtered = trades.filter((t) => {
          if (minUsdFilter > 0 && t.usdValue < minUsdFilter) return false;
          return true;
        });

        const intervalSecs = INTERVAL_SECS[interval] ?? 60;

        // Reclassify patterns against current-interval candles.
        // Stored pattern was classified on the original timeframe — it's stale on any other TF.
        // (e.g. bullish on 1m ≠ bullish on 3m — candle OHLC is different)
        const restoredBubbles: Bubble[] = filtered.map((trade) => {
          const candleTime = Math.floor(trade.time / intervalSecs) * intervalSecs;
          const candle = candlesRef.current.get(candleTime);
          const classification = (candle && showPatterns)
            ? classifyTrade(
                { trade: { price: trade.price, qty: trade.qty, isMaker: trade.isMaker, timestamp: trade.time * 1000 }, usdValue: trade.usdValue, zscore: 0 },
                candle,
              )
            : { pattern: undefined, patternSignal: undefined };
          return {
            id: trade.id,
            time: candleTime,
            price: trade.price,
            qty: trade.qty,
            usdValue: trade.usdValue,
            isMaker: trade.isMaker,
            pattern: classification.pattern,
            patternSignal: classification.patternSignal,
            exchange: trade.exchange,
            birthMs: 0, // no pulse — draw immediately static
          };
        });

        setBubbles(restoredBubbles);
        setTradesLog(filtered);
      } catch (e) {
        console.error('loadAutoCached error', e);
      }
    }

    function rebuildBubblesFromLog() {
      const { tradesLog: log, showPatterns: sp } = useStore.getState();
      if (log.length === 0) return;
      const intervalSecs = INTERVAL_SECS[interval] ?? 60;
      const rebuilt: Bubble[] = log.map((trade) => {
        const candleTime = Math.floor(trade.time / intervalSecs) * intervalSecs;
        const candle = candlesRef.current.get(candleTime);
        const classification = (candle && sp)
          ? classifyTrade(
              { trade: { price: trade.price, qty: trade.qty, isMaker: trade.isMaker, timestamp: trade.time * 1000 }, usdValue: trade.usdValue, zscore: 0 },
              candle,
            )
          : { pattern: undefined, patternSignal: undefined };
        return {
          id: trade.id,
          time: candleTime,
          price: trade.price,
          qty: trade.qty,
          usdValue: trade.usdValue,
          isMaker: trade.isMaker,
          pattern: classification.pattern,
          patternSignal: classification.patternSignal,
          exchange: trade.exchange,
          birthMs: 0,
        };
      });
      setBubbles(rebuilt);
    }

    function openStream() {
      const sym = symbol.toLowerCase();

      closeKlineRef.current = provider.openKlineStream(
        symbol,
        interval,
        (update) => { if (!cancelled) handleKline(update); },
        (status) => { if (!cancelled) setExchangeStatus('candles', status as Parameters<typeof setExchangeStatus>[1]); },
      );
    }

    function handleKline({ candle, closed }: KlineUpdate) {
      setLastTick();
      candlesRef.current.set(candle.time as number, candle);
      currentCandleRef.current = candle;

      if (closed) {
        closedCandleRef.current = candle;
        chartRef.current?.addCandle(candle);
        mergeCandleIntoHistory(symbol, interval, candle).catch(console.error);
        const w = detectorRef.current?.getWindow();
        if (w && w.length > 0) saveDetectorWindow(symbol, interval, w).catch(console.error);
      } else {
        chartRef.current?.updateCandle(candle);
      }
    }

    init();

    return () => {
      cancelled = true;
      closeKlineRef.current?.();
      closeKlineRef.current = null;
      setExchangeStatus('candles', 'disconnected');
      const w = detectorRef.current?.getWindow();
      if (w && w.length > 0) saveDetectorWindow(symbol, interval, w).catch(console.error);
    };
  }, [symbol, interval]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-derive bubbles from DB whenever minUsdFilter changes.
  // DB stores all detector-filtered trades; bubbles = USD-filtered display view.
  const minUsdFilter = useStore((s) => s.minUsdFilter);
  useEffect(() => {
    if (!didMountFilterRef.current) { didMountFilterRef.current = true; return; }
    if (!autoLoadTrades) {
      const { bubbles: cur } = useStore.getState();
      replaceBubbles(
        minUsdFilter === 0 ? cur : cur.filter((b) => b.usdValue >= minUsdFilter),
      );
      return;
    }
    async function rederive() {
      const trades = await getAutoCachedTrades(symbol);
      const intervalSecs = INTERVAL_SECS[interval] ?? 60;
      const showPatterns = useStore.getState().showPatterns;
      const filtered = trades.filter((t) => {
        if (minUsdFilter > 0 && t.usdValue < minUsdFilter) return false;
        return true;
      });
      const rederived: Bubble[] = filtered.map((trade) => {
        const candleTime = Math.floor(trade.time / intervalSecs) * intervalSecs;
        const candle = candlesRef.current.get(candleTime);
        const classification = (candle && showPatterns)
          ? classifyTrade(
              { trade: { price: trade.price, qty: trade.qty, isMaker: trade.isMaker, timestamp: trade.time * 1000 }, usdValue: trade.usdValue, zscore: 0 },
              candle,
            )
          : { pattern: undefined, patternSignal: undefined };
        return {
          id: trade.id,
          time: candleTime,
          price: trade.price,
          qty: trade.qty,
          usdValue: trade.usdValue,
          isMaker: trade.isMaker,
          pattern: classification.pattern,
          patternSignal: classification.patternSignal,
          exchange: trade.exchange,
          birthMs: 0,
        };
      });
      // Merge: live bubbles (birthMs > 0) that arrived during the async DB read
      // won't be in `rederived` yet (DB write is async). Keep them so they don't disappear.
      const currentBubbles = useStore.getState().bubbles;
      const liveNotInDB = currentBubbles.filter(
        (b) =>
          b.birthMs > 0 &&
          (minUsdFilter === 0 || b.usdValue >= minUsdFilter) &&
          !rederived.some((r) => r.id === b.id),
      );
      replaceBubbles([...rederived, ...liveNotInDB]);
      setTradesLog(filtered);
    }
    rederive().catch(console.error);
  }, [minUsdFilter, showPatterns]); // eslint-disable-line react-hooks/exhaustive-deps

  // When showPatterns toggles, reclassify bubbles already in state (no DB round-trip needed).
  // This handles the case where autoLoadTrades=false — the rederive effect skips, but we still
  // need to strip/restore patterns on the live bubbles that are currently visible.
  useEffect(() => {
    const store = useStore.getState();
    const reclassified = store.bubbles.map((b) => {
      // b.time is already the candle-bucket timestamp
      const candle = candlesRef.current.get(b.time);
      const classification = (candle && showPatterns)
        ? classifyTrade(
            { trade: { price: b.price, qty: b.qty, isMaker: b.isMaker, timestamp: b.time * 1000 }, usdValue: b.usdValue, zscore: 0 },
            candle,
          )
        : { pattern: undefined, patternSignal: undefined };
      return { ...b, pattern: classification.pattern, patternSignal: classification.patternSignal };
    });
    store.replaceBubbles(reclassified);
  }, [showPatterns]); // eslint-disable-line react-hooks/exhaustive-deps
}
