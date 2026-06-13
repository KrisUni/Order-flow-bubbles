import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/config';
import { INTERVALS } from '../lib/constants';
import { SYMBOL_MAP } from '../lib/exchanges/symbolMap';
import { resolveSymbol, type ResolvedSymbol } from '../lib/exchanges/resolver';

const STATIC_SYMBOLS = Object.keys(SYMBOL_MAP);

const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e',
  disconnected: '#6b7280',
  connecting: '#f59e0b',
  error: '#ef4444',
};

const EXCHANGES = ['candles', 'binance', 'binance-perp', 'coinbase', 'kraken', 'bybit', 'bybit-perp', 'okx', 'okx-perp', 'bitstamp', 'hyperliquid'] as const;

const VENUE_LABELS: Record<string, string> = {
  binance: 'BN', bybit: 'BB', okx: 'OKX', kraken: 'KRK', bitstamp: 'BST',
  coinbase: 'CB', 'binance-perp': 'BNP', 'bybit-perp': 'BBP', 'okx-perp': 'OKP',
  hyperliquid: 'HL',
};
const VENUE_ORDER = ['binance', 'bybit', 'okx', 'kraken', 'bitstamp', 'coinbase', 'binance-perp', 'bybit-perp', 'okx-perp', 'hyperliquid'] as const;

export default function Header() {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const setSymbol = useStore((s) => s.setSymbol);
  const setIntervalStore = useStore((s) => s.setInterval);
  const tradesPanelOpen = useStore((s) => s.tradesPanelOpen);
  const settingsPanelOpen = useStore((s) => s.settingsPanelOpen);
  const togglePanel = useStore((s) => s.togglePanel);
  const exchangeStatuses = useStore((s) => s.exchangeStatuses);
  const lastTickMs = useStore((s) => s.lastTickMs);
  const recentSymbols = useStore((s) => s.recentSymbols);
  const addRecentSymbol = useStore((s) => s.addRecentSymbol);

  // Symbol input state
  const [inputVal, setInputVal] = useState(symbol);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedSymbol | null>(null);
  const [chipsVisible, setChipsVisible] = useState(false);
  const chipsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync input when symbol changes externally (session restore, etc.)
  useEffect(() => { setInputVal(symbol); }, [symbol]);

  function clearChipsTimer() {
    if (chipsTimerRef.current !== null) {
      clearTimeout(chipsTimerRef.current);
      chipsTimerRef.current = null;
    }
  }

  async function handleResolve() {
    const raw = inputVal.trim();
    if (!raw) return;
    clearChipsTimer();
    setResolving(true);
    setResolveError(null);
    setChipsVisible(false);
    try {
      const result = await resolveSymbol(raw);
      if (result.candleSource === null) {
        setResolveError(`No candle source found for "${raw.toUpperCase()}"`);
        setResolvedResult(result);
        setChipsVisible(true);
        return;
      }
      setResolvedResult(result);
      setChipsVisible(true);
      addRecentSymbol(result.canonical);
      setSymbol(result.canonical);
      setInputVal(result.canonical);
      chipsTimerRef.current = setTimeout(() => {
        setChipsVisible(false);
        chipsTimerRef.current = null;
      }, 6000);
    } catch {
      setResolveError(`Could not resolve "${raw.toUpperCase()}"`);
      setChipsVisible(true);
    } finally {
      setResolving(false);
    }
  }

  function handleInputChange(v: string) {
    setInputVal(v);
    if (resolveError) {
      setResolveError(null);
      setChipsVisible(false);
    }
  }

  // Datalist options: recent first, then static (deduped)
  const datalistOptions = [
    ...recentSymbols,
    ...STATIC_SYMBOLS.filter((s) => !recentSymbols.includes(s)),
  ];

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

          <div className="symbol-input-wrap">
            <input
              id="symbol-datalist-input"
              list="symbol-datalist"
              className={`header-input${resolveError ? ' header-input--error' : ''}`}
              value={inputVal}
              disabled={resolving}
              placeholder="e.g. BTCUSDT"
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleResolve(); }}
            />
            <datalist id="symbol-datalist">
              {datalistOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {resolving && <span className="symbol-resolving">resolving…</span>}
          </div>

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
            className={`header-btn${settingsPanelOpen ? ' active' : ''}`}
            onClick={() => togglePanel('settings')}
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {chipsVisible && resolvedResult && (
        <div className={`resolve-chips-row${resolveError ? ' resolve-chips-row--error' : ''}`}>
          {resolveError && <span className="resolve-error-msg">{resolveError}</span>}
          {VENUE_ORDER.map((v) => {
            const active = resolvedResult.venues[v] != null;
            return (
              <span
                key={v}
                className={`venue-chip${active ? ' venue-chip--ok' : ' venue-chip--miss'}`}
                title={resolvedResult.venues[v] ?? 'not found'}
              >
                {VENUE_LABELS[v]} {active ? '✓' : '✗'}
              </span>
            );
          })}
        </div>
      )}

      {showBanner && (
        <div className="feed-banner">
          <span>⚠ {downExchanges.map((e) => e.toUpperCase()).join(', ')} feed down — detection running on partial data</span>
          <button className="feed-banner-dismiss" onClick={() => setDismissedKey(bannerKey)}>✕</button>
        </div>
      )}
    </>
  );
}
