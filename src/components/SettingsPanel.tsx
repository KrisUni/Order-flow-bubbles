import { useState } from 'react';
import { useStore } from '../lib/config';
import PanelShell from './PanelShell';
import { clearAllData } from '../lib/db';
import type { AlertRule, PatternName } from '../lib/types';

const PATTERN_OPTIONS: { value: PatternName; label: string }[] = [
  { value: 'Absorption (Continuation)', label: 'Absorption (Cont.)' },
  { value: 'Absorption (Contrarian)', label: 'Absorption (Cont-R)' },
  { value: 'Acceptance', label: 'Acceptance' },
  { value: 'Rejection', label: 'Rejection' },
];

export default function SettingsPanel() {
  const settingsPanelOpen = useStore((s) => s.settingsPanelOpen);
  const showPatterns = useStore((s) => s.showPatterns);
  const autoLoadTrades = useStore((s) => s.autoLoadTrades);
  const detectionThreshold = useStore((s) => s.detectionThreshold);
  const minUsdFilter = useStore((s) => s.minUsdFilter);
  const showContractQty = useStore((s) => s.showContractQty);
  const showVolumeProfile = useStore((s) => s.showVolumeProfile);
  const showDeltaBubbles = useStore((s) => s.showDeltaBubbles);
  const setShowPatterns = useStore((s) => s.setShowPatterns);
  const setAutoLoadTrades = useStore((s) => s.setAutoLoadTrades);
  const setDetectionThreshold = useStore((s) => s.setDetectionThreshold);
  const setMinUsdFilter = useStore((s) => s.setMinUsdFilter);
  const setShowContractQty = useStore((s) => s.setShowContractQty);
  const setShowDeltaBubbles = useStore((s) => s.setShowDeltaBubbles);
  const setShowVolumeProfile = useStore((s) => s.setShowVolumeProfile);
  const showCvd = useStore((s) => s.showCvd);
  const setShowCvd = useStore((s) => s.setShowCvd);
  const includePerps = useStore((s) => s.includePerps);
  const setIncludePerps = useStore((s) => s.setIncludePerps);
  const alertRules = useStore((s) => s.alertRules);
  const addAlertRule = useStore((s) => s.addAlertRule);
  const updateAlertRule = useStore((s) => s.updateAlertRule);
  const removeAlertRule = useStore((s) => s.removeAlertRule);
  const closePanel = useStore((s) => s.closePanel);

  const [resetting, setResetting] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  function handleAddRule() {
    const rule: AlertRule = {
      id: crypto.randomUUID(),
      enabled: true,
      minUsd: 100_000,
      pattern: undefined,
      side: undefined,
      notify: true,
      sound: false,
    };
    addAlertRule(rule);
  }

  async function handleEnableNotify(ruleId: string, checked: boolean) {
    updateAlertRule(ruleId, { notify: checked });
    if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    }
  }

  async function handleResetDB() {
    if (!confirm('Clear all cached trades and candle history? This cannot be undone.')) return;
    setResetting(true);
    try {
      await clearAllData();
      useStore.getState().clearBubbles();
      useStore.getState().clearTradesLog();
    } finally {
      setResetting(false);
    }
  }

  if (!settingsPanelOpen) return null;

  const usdActive = minUsdFilter > 0;

  return (
    <PanelShell>
      <div className="panel-header">
        <span>Settings</span>
        <button className="panel-close" onClick={() => closePanel('settings')}>
          ✕
        </button>
      </div>

      <div className="panel-body">
        {/* ── Detection threshold ── */}
        <div className="setting-group">
          <div className="setting-group-label">Detection threshold</div>
          <div className="setting-row-slider">
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={detectionThreshold}
              onChange={(e) => setDetectionThreshold(parseFloat(e.target.value))}
              className="threshold-slider"
            />
            <span className="threshold-value">{detectionThreshold.toFixed(1)}σ</span>
          </div>
          <div className="setting-hint">
            Z-score cutoff. Lower = more trades detected. Higher = only extreme outliers.
            <br />
            1.5σ ≈ top 7% · 2.0σ ≈ top 2% · 2.5σ ≈ top 0.6% · 3.0σ ≈ top 0.1%
          </div>
        </div>

        {/* ── Trade size filter ── */}
        <div className="setting-group">
          <div className="setting-group-label">Trade size filter</div>
          <div className="setting-hint" style={{ marginBottom: 8 }}>
            Applied on top of detection threshold. Only bubbles with USD value above both limits are shown.
          </div>

          {/* USD filter row */}
          <label className="setting-row" style={{ alignItems: 'center', marginBottom: 6 }}>
            <input
              type="radio"
              name="filter-mode"
              checked={usdActive}
              onChange={() => setMinUsdFilter(50_000)}
            />
            <span style={{ minWidth: 130 }}>Min trade size (USD)</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={minUsdFilter}
              disabled={!usdActive}
              onChange={(e) => setMinUsdFilter(Math.max(0, parseFloat(e.target.value) || 0))}
              className="min-usd-input"
              style={{ opacity: usdActive ? 1 : 0.4, width: 90 }}
              placeholder="50000"
            />
          </label>

          {/* No filter */}
          <label className="setting-row" style={{ alignItems: 'center' }}>
            <input
              type="radio"
              name="filter-mode"
              checked={!usdActive}
              onChange={() => setMinUsdFilter(0)}
            />
            <span>No filter (show all outliers)</span>
          </label>
        </div>

        {/* ── Pattern classification ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showPatterns}
            onChange={(e) => setShowPatterns(e.target.checked)}
          />
          <span>Show pattern classification</span>
        </label>

        {/* ── Show contract qty on bubbles ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showContractQty}
            onChange={(e) => setShowContractQty(e.target.checked)}
          />
          <span>Show contract qty on bubbles</span>
        </label>

        {/* ── Volume profile ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showVolumeProfile}
            onChange={(e) => setShowVolumeProfile(e.target.checked)}
          />
          <span>Show volume profile</span>
        </label>

        {/* ── Delta bubble mode ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showDeltaBubbles}
            onChange={(e) => setShowDeltaBubbles(e.target.checked)}
          />
          <span>Delta bubbles mode (hides trade bubbles)</span>
        </label>

        {/* ── CVD panel ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showCvd}
            onChange={(e) => setShowCvd(e.target.checked)}
          />
          <span>Show CVD panel</span>
        </label>

        {/* ── Perp feeds ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={includePerps}
            onChange={(e) => setIncludePerps(e.target.checked)}
          />
          <span>Include perpetual futures feeds</span>
        </label>

        {/* ── Auto-load ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={autoLoadTrades}
            onChange={(e) => setAutoLoadTrades(e.target.checked)}
          />
          <span>Load previous session on startup</span>
        </label>

        {/* ── Alerts ── */}
        <div className="setting-group" style={{ marginTop: 4 }}>
          <div className="setting-group-label">Alerts</div>

          {notifPerm === 'denied' && (
            <div className="setting-hint" style={{ color: '#f59e0b' }}>
              Notifications blocked in browser settings.
            </div>
          )}

          {alertRules.map((rule) => (
            <div key={rule.id} className="alert-rule-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => updateAlertRule(rule.id, { enabled: e.target.checked })}
                />
              </label>

              <input
                type="number"
                min="0"
                step="10000"
                value={rule.minUsd}
                onChange={(e) => updateAlertRule(rule.id, { minUsd: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="alert-num-input"
                title="Min USD"
              />

              <select
                value={rule.pattern ?? ''}
                onChange={(e) => updateAlertRule(rule.id, { pattern: (e.target.value as PatternName) || undefined })}
                className="alert-select"
              >
                <option value="">any pattern</option>
                {PATTERN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              <select
                value={rule.side ?? ''}
                onChange={(e) => updateAlertRule(rule.id, { side: (e.target.value as 'buy' | 'sell') || undefined })}
                className="alert-select"
              >
                <option value="">any side</option>
                <option value="buy">buy</option>
                <option value="sell">sell</option>
              </select>

              <label title="Browser notification" style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rule.notify}
                  onChange={(e) => void handleEnableNotify(rule.id, e.target.checked)}
                />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>🔔</span>
              </label>

              <label title="Sound" style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rule.sound}
                  onChange={(e) => updateAlertRule(rule.id, { sound: e.target.checked })}
                />
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>♪</span>
              </label>

              <button
                className="panel-close"
                onClick={() => removeAlertRule(rule.id)}
                title="Remove rule"
                style={{ marginLeft: 'auto' }}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={handleAddRule}
            style={{
              marginTop: 4,
              padding: '4px 8px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            + Add alert
          </button>
        </div>

        {/* ── Danger zone ── */}
        <div className="setting-group" style={{ marginTop: 16 }}>
          <div className="setting-group-label" style={{ color: 'rgba(239,68,68,0.85)' }}>Data</div>
          <button
            onClick={handleResetDB}
            disabled={resetting}
            style={{
              width: '100%',
              padding: '6px 0',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 4,
              color: 'rgba(239,68,68,0.9)',
              cursor: resetting ? 'default' : 'pointer',
              fontSize: 13,
            }}
          >
            {resetting ? 'Clearing…' : 'Clear all cached data'}
          </button>
          <div className="setting-hint" style={{ marginTop: 4 }}>
            Wipes trades, candle history, and detector state. Reload after.
          </div>
        </div>
      </div>
    </PanelShell>
  );
}
