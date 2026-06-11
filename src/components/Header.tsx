import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/config';
import { INTERVALS } from '../lib/constants';
import { SYMBOL_MAP } from '../lib/exchanges/symbolMap';

const SYMBOLS = Object.keys(SYMBOL_MAP);

const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e',
  disconnected: '#6b7280',
  connecting: '#f59e0b',
  error: '#ef4444',
};

const EXCHANGES = ['candles', 'binance', 'kraken', 'bybit', 'okx', 'bitstamp'] as const;

export default function Header() {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const setSymbol = useStore((s) => s.setSymbol);
  const setIntervalStore = useStore((s) => s.setInterval);
  const tradesPanelOpen = useStore((s) => s.tradesPanelOpen);
  const settingsPanelOpen = useStore((s) => s.settingsPanelOpen);
  const sessionPanelOpen = useStore((s) => s.sessionPanelOpen);
  const togglePanel = useStore((s) => s.togglePanel);
  const exchangeStatuses = useStore((s) => s.exchangeStatuses);
  const lastTickMs = useStore((s) => s.lastTickMs);

  // Freshness stamp
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ageSec = lastTickMs > 0 ? Math.floor((nowMs - lastTickMs) / 1000) : null;
  const freshColor = ageSec === null ? 'var(--text-dim)' : ageSec < 5 ? '#22c55e' : ageSec <= 30 ? 'var(--text-dim)' : '#ef4444';
  const freshLabel = ageSec === null ? '–' : ageSec > 30 ? `stale · ${ageSec}s` : `live · ${ageSec}s`;

  // Banner: track when each exchange entered a non-connected state
  const [, setTick] = useState(0);
  const downSinceRef = useRef<Map<string, number>>(new Map());
  const [dismissedKey, setDismissedKey] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  for (const ex of EXCHANGES) {
    const st = exchangeStatuses[ex] ?? 'disconnected';
    if (st === 'connected') {
      downSinceRef.current.delete(ex);
    } else if (!downSinceRef.current.has(ex)) {
      downSinceRef.current.set(ex, now);
    }
  }

  const downExchanges = EXCHANGES.filter((ex) => {
    const st = exchangeStatuses[ex] ?? 'disconnected';
    if (st === 'error') return true;
    if (st === 'disconnected' || st === 'connecting') {
      const since = downSinceRef.current.get(ex) ?? now;
      return now - since > 60_000;
    }
    return false;
  });

  const bannerKey = [...downExchanges].sort().join(',');
  const showBanner = bannerKey.length > 0 && bannerKey !== dismissedKey;

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="header-logo">◉ Bubbles</span>

          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="header-select"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="interval-group">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                className={`interval-btn${interval === iv ? ' active' : ''}`}
                onClick={() => setIntervalStore(iv)}
              >
                {iv}
              </button>
            ))}
          </div>
        </div>

        <div className="header-right">
          <span className="freshness-stamp" style={{ color: freshColor }}>{freshLabel}</span>

          {/* Exchange health dots */}
          <div className="exchange-health">
            {EXCHANGES.map((ex) => {
              const st = exchangeStatuses[ex] ?? 'disconnected';
              return (
                <span
                  key={ex}
                  className="health-dot"
                  title={`${ex}: ${st}`}
                  style={{ background: STATUS_COLOR[st] ?? '#6b7280' }}
                />
              );
            })}
          </div>

          <button
            className={`header-btn${tradesPanelOpen ? ' active' : ''}`}
            onClick={() => togglePanel('trades')}
          >
            Trades
          </button>
          <button
            className={`header-btn${sessionPanelOpen ? ' active' : ''}`}
            onClick={() => togglePanel('session')}
          >
            Session
          </button>
          <button
            className={`header-btn${settingsPanelOpen ? ' active' : ''}`}
            onClick={() => togglePanel('settings')}
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {showBanner && (
        <div className="feed-banner">
          <span>⚠ {downExchanges.map((e) => e.toUpperCase()).join(', ')} feed down — detection running on partial data</span>
          <button className="feed-banner-dismiss" onClick={() => setDismissedKey(bannerKey)}>✕</button>
        </div>
      )}
    </>
  );
}
