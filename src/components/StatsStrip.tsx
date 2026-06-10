import { useState, useEffect } from 'react';
import type { ChartHandle } from './Chart';
import { useStore } from '../lib/config';
import { INTERVAL_SECS } from '../lib/constants';
import type { BigTrade } from '../lib/types';

interface Props {
  chartRef: React.RefObject<ChartHandle | null>;
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtCountdown(secs: number, intervalSecs: number): string {
  if (intervalSecs >= 3600) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Stats {
  delta: number;
  buySum: number;
  sellSum: number;
  tradesPerMin: number;
  biggest: BigTrade | null;
  bubblesCount: number;
  countdown: number;
  intervalSecs: number;
}

function computeStats(): Stats {
  const s = useStore.getState();
  const now = Math.floor(Date.now() / 1000);
  const intervalSecs = INTERVAL_SECS[s.interval] ?? 60;

  let delta = 0, buySum = 0, sellSum = 0;
  let biggest: BigTrade | null = null;
  let recentCount = 0;

  for (const t of s.tradesLog) {
    const signed = t.isMaker ? -t.usdValue : t.usdValue;
    delta += signed;
    if (t.isMaker) sellSum += t.usdValue;
    else buySum += t.usdValue;
    if (!biggest || t.usdValue > biggest.usdValue) biggest = t;
    if (t.time >= now - 300) recentCount++;
  }

  const countdown = intervalSecs - (now % intervalSecs);

  return {
    delta,
    buySum,
    sellSum,
    tradesPerMin: recentCount / 5,
    biggest,
    bubblesCount: s.bubbles.length,
    countdown,
    intervalSecs,
  };
}

export default function StatsStrip({ chartRef }: Props) {
  const [stats, setStats] = useState<Stats>(computeStats);
  const selectBubble = useStore((s) => s.selectBubble);

  useEffect(() => {
    const id = setInterval(() => setStats(computeStats()), 1000);
    return () => clearInterval(id);
  }, []);

  function handleBiggestClick() {
    if (!stats.biggest) return;
    selectBubble(stats.biggest.id);
    chartRef.current?.scrollToTime(stats.biggest.time);
  }

  const { delta, buySum, sellSum, tradesPerMin, biggest, bubblesCount, countdown, intervalSecs } = stats;
  const countdownColor = countdown <= 10 ? '#ef4444' : 'var(--text)';

  return (
    <div className="stats-strip">
      <span className="stats-item">
        <span className="stats-label">Δ Session</span>
        <span style={{ color: delta >= 0 ? '#22c55e' : '#ef4444' }}>{fmtCompact(delta)}</span>
      </span>
      <span className="stats-sep">·</span>
      <span className="stats-item">
        <span className="stats-label">Buys</span>
        <span style={{ color: '#22c55e' }}>{fmtCompact(buySum)}</span>
      </span>
      <span className="stats-sep">·</span>
      <span className="stats-item">
        <span className="stats-label">Sells</span>
        <span style={{ color: '#ef4444' }}>{fmtCompact(sellSum)}</span>
      </span>
      <span className="stats-sep">·</span>
      <span className="stats-item">
        <span className="stats-label">Trades/min</span>
        <span>{tradesPerMin.toFixed(1)}</span>
      </span>
      <span className="stats-sep">·</span>
      <span className="stats-item">
        <span className="stats-label">Biggest</span>
        {biggest ? (
          <button className="stats-biggest-btn" onClick={handleBiggestClick}>
            <span style={{ color: biggest.isMaker ? '#ef4444' : '#22c55e' }}>
              {fmtCompact(biggest.usdValue).replace(/^[+-]/, '')}
            </span>
          </button>
        ) : (
          <span>—</span>
        )}
      </span>
      <span className="stats-sep">·</span>
      <span className="stats-item">
        <span className="stats-label">Bubbles</span>
        <span>{bubblesCount}</span>
      </span>
      <span className="stats-sep">·</span>
      <span className="stats-item">
        <span className="stats-label">Closes</span>
        <span style={{ color: countdownColor, fontVariantNumeric: 'tabular-nums' }}>
          {fmtCountdown(countdown, intervalSecs)}
        </span>
      </span>
    </div>
  );
}
