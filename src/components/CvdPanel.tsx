import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { VolEntry } from '../lib/types';
import { useStore } from '../lib/config';

export interface CvdHandle {
  getChart(): IChartApi | null;
}

interface Props {
  binanceVolRef: React.RefObject<Map<number, VolEntry>>;
  extraVolRef: React.RefObject<Map<number, VolEntry>>;
}

const CvdPanel = forwardRef<CvdHandle, Props>(function CvdPanel(
  { binanceVolRef, extraVolRef },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Baseline'> | null>(null);

  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);

  useImperativeHandle(ref, () => ({
    getChart() { return chartRef.current; },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', visible: false },
      crosshair: { mode: 0 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width: container.clientWidth,
      height: container.clientHeight,
    });
    chartRef.current = chart;

    const series = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 0 },
      topLineColor: 'rgba(34,197,94,0.8)',
      topFillColor1: 'rgba(34,197,94,0.2)',
      topFillColor2: 'rgba(34,197,94,0.02)',
      bottomLineColor: 'rgba(239,68,68,0.8)',
      bottomFillColor1: 'rgba(239,68,68,0.02)',
      bottomFillColor2: 'rgba(239,68,68,0.2)',
    });
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.resize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Reset when symbol or interval changes
  useEffect(() => {
    seriesRef.current?.setData([]);
  }, [symbol, interval]);

  // Recompute CVD every second
  useEffect(() => {
    const id = setInterval(() => {
      const series = seriesRef.current;
      if (!series) return;

      const times = new Set([
        ...binanceVolRef.current.keys(),
        ...extraVolRef.current.keys(),
      ]);
      if (times.size === 0) return;

      const sorted = Array.from(times).sort((a, b) => a - b);
      let running = 0;
      const data = sorted.map((t) => {
        const b = binanceVolRef.current.get(t);
        const e = extraVolRef.current.get(t);
        const buyVol = (b?.buyVol ?? 0) + (e?.buyVol ?? 0);
        const sellVol = (b?.sellVol ?? 0) + (e?.sellVol ?? 0);
        running += buyVol - sellVol;
        return { time: t as UTCTimestamp, value: running };
      });

      series.setData(data);
    }, 1000);

    return () => clearInterval(id);
  }, [binanceVolRef, extraVolRef]);

  return (
    <div className="cvd-panel-wrap">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

export default CvdPanel;
