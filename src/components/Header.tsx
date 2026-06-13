import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/config';
import { INTERVALS } from '../lib/constants';
import { SYMBOL_MAP, getMapping } from '../lib/exchanges/symbolMap';
import { resolveSymbol, type ResolvedSymbol } from '../lib/exchanges/resolver';
import { EXCHANGE_COLORS, VENUE_LABELS } from '../lib/exchangeColors';

const STATIC_SYMBOLS = Object.keys(SYMBOL_MAP);

const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e',
  disconnected: '#6b7280',
  connecting: '#f59e0b',
  error: '#ef4444',
};

const EXCHANGES = ['candles', 'binance', 'binance-perp', 'coinbase', 'kraken', 'bybit', 'bybit-perp', 'okx', 'okx-perp', 'bitstamp', 'hyperliquid'] as const;

const VENUE_ORDER = ['binance', 'bybit', 'okx', 'kraken', 'bitstamp', 'coinbase', 'binance-perp', 'bybit-perp', 'okx-perp', 'hyperliquid'] as const;

// Map hyphenated venue key → SymbolMapping camelCase key for getMapping() lookup
const VENUE_TO_MAPPING_KEY: Record<string, string> = {
  'binance-perp': 'binancePerp',
  'bybit-perp': 'bybitPerp',
  'okx-perp': 'okxPerp',
};

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

  // Sync input when symbol changes externally (session restore, etc.)
  useEffect(() => { setInputVal(symbol); }, [symbol]);

  async function handleResolve() {
    const raw = inputVal.trim();
    if (!raw) return;
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
      addRecentSymbol(result.canonical);
      setSymbol(result.canonical);
      setInputVal(result.canonical);
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

  // Venue mapping helper: resolve-chips row reads live mapping so it stays accurate
  // even when resolvedResult is stale (symbol was restored from persistence before resolve ran).
  const currentMapping = getMapping(symbol);
  function isMapped(v: string): boolean {
    if (resolvedResult) return resolvedResult.venues[v as keyof typeof resolvedResult.venues] != null;
    const mk = (VENUE_TO_MAPPING_KEY[v] ?? v) as keyof typeof currentMapping;
    return currentMapping != null && currentMapping[mk] != null;
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

      {/* Always-visible venue status chips — live mapping + connection state */}
      <div className="resolve-chips-row">
        {VENUE_ORDER.map((v) => {
          const mapped = isMapped(v);
          const st = exchangeStatuses[v] ?? 'disconnected';
          const color = EXCHANGE_COLORS[v] ?? '#6b7280';
          let glyph: string;
          let glyphColor: string;
          let chipClass = 'venue-chip';
          if (!mapped) {
            glyph = '–';
            glyphColor = '#4b5563';
            chipClass += ' venue-chip--miss';
          } else if (st === 'connected') {
            glyph = '●';
            glyphColor = color;
            chipClass += ' venue-chip--ok';
          } else if (st === 'error') {
            glyph = '✗';
            glyphColor = '#ef4444';
            chipClass += ' venue-chip--err';
          } else {
            glyph = '◐';
            glyphColor = color;
            chipClass += ' venue-chip--connecting';
          }
          return (
            <span
              key={v}
              className={chipClass}
              title={`${v} — ${mapped ? st : 'not listed'}`}
              style={{ borderColor: mapped ? `${color}40` : undefined }}
            >
              <span className="venue-chip-glyph" style={{ color: glyphColor }}>{glyph}</span>
              {' '}{VENUE_LABELS[v]}
            </span>
          );
        })}
      </div>

      {/* Transient resolve error (error chips only) */}
      {chipsVisible && resolveError && (
        <div className="resolve-chips-row resolve-chips-row--error">
          <span className="resolve-error-msg">{resolveError}</span>
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
