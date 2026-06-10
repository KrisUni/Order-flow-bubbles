import { useRef, useEffect } from 'react';
import { Detector } from './lib/detector';
import type { Candle } from './lib/types';
import type { ChartHandle } from './components/Chart';
import type { CvdHandle } from './components/CvdPanel';
import type { VolEntry } from './lib/types';
import type { LogicalRange } from 'lightweight-charts';
import Chart from './components/Chart';
import CvdPanel from './components/CvdPanel';
import Header from './components/Header';
import StatsStrip from './components/StatsStrip';
import SettingsPanel from './components/SettingsPanel';
import TradesLog from './components/TradesLog';
import SessionManager from './components/SessionManager';
import Legend from './components/Legend';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './lib/config';
import { useBinanceStream } from './hooks/useBinanceStream';
import { useMultiExchangePrice } from './hooks/useMultiExchangePrice';
import { useMultiExchangeTrades } from './hooks/useMultiExchangeTrades';
import type { UTCTimestamp } from 'lightweight-charts';

function App() {
  const chartRef = useRef<ChartHandle | null>(null);
  const cvdRef = useRef<CvdHandle | null>(null);
  const detectorRef = useRef<Detector | null>(new Detector());
  const currentCandleRef = useRef<Candle | null>(null);
  const binanceVolRef = useRef<Map<number, VolEntry>>(new Map());
  const extraVolRef = useRef<Map<number, VolEntry>>(new Map());

  const anyPanelOpen = useStore(
    (s) => s.tradesPanelOpen || s.settingsPanelOpen || s.sessionPanelOpen,
  );
  const showCvd = useStore((s) => s.showCvd);

  const detectionThreshold = useStore((s) => s.detectionThreshold);
  useEffect(() => {
    detectorRef.current?.setThreshold(detectionThreshold);
  }, [detectionThreshold]);

  useBinanceStream(chartRef, detectorRef, currentCandleRef, binanceVolRef);

  useMultiExchangePrice((point) => {
    const t = currentCandleRef.current?.time;
    if (!t) return;
    chartRef.current?.addVWAPPoint(t as UTCTimestamp, point.mid);
  });

  useMultiExchangeTrades(detectorRef, currentCandleRef, extraVolRef);

  // Wire bidirectional time-axis sync between main chart and CVD panel
  useEffect(() => {
    if (!showCvd) return;
    const main = chartRef.current?.getChart();
    const cvd = cvdRef.current?.getChart();
    if (!main || !cvd) return;

    let isSyncing = false;

    const mainHandler = (r: LogicalRange | null) => {
      if (isSyncing || !r) return;
      isSyncing = true;
      cvd.timeScale().setVisibleLogicalRange(r);
      isSyncing = false;
    };
    const cvdHandler = (r: LogicalRange | null) => {
      if (isSyncing || !r) return;
      isSyncing = true;
      main.timeScale().setVisibleLogicalRange(r);
      isSyncing = false;
    };

    main.timeScale().subscribeVisibleLogicalRangeChange(mainHandler);
    cvd.timeScale().subscribeVisibleLogicalRangeChange(cvdHandler);

    return () => {
      main.timeScale().unsubscribeVisibleLogicalRangeChange(mainHandler);
      cvd.timeScale().unsubscribeVisibleLogicalRangeChange(cvdHandler);
    };
  }, [showCvd]);

  return (
    <div className="app">
      <ErrorBoundary label="Header">
        <Header />
      </ErrorBoundary>

      <StatsStrip chartRef={chartRef} />

      <div className="main">
        <div className="chart-wrap">
          <div className="main-chart-area">
            <ErrorBoundary label="Chart">
              <Chart ref={chartRef} binanceVolRef={binanceVolRef} extraVolRef={extraVolRef} />
            </ErrorBoundary>
            <Legend />
          </div>

          {showCvd && (
            <CvdPanel ref={cvdRef} binanceVolRef={binanceVolRef} extraVolRef={extraVolRef} />
          )}
        </div>

        <div className={`panels${anyPanelOpen ? ' panels-open' : ''}`}>
          <ErrorBoundary label="TradesLog">
            <TradesLog chartRef={chartRef} />
          </ErrorBoundary>
          <ErrorBoundary label="Settings">
            <SettingsPanel />
          </ErrorBoundary>
          <ErrorBoundary label="Session">
            <SessionManager />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default App;
