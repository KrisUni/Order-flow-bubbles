import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bubble, BigTrade, ConnectionStatus, AlertRule } from './types';
import { MAX_BUBBLES, MAX_TRADES_LOG, DEFAULT_SYMBOL, DEFAULT_INTERVAL } from './constants';

// ── Persisted config ──────────────────────────────────────────────
export interface AppConfig {
  symbol: string;
  interval: string;
  showPatterns: boolean;
  autoLoadTrades: boolean;
  detectionThreshold: number; // z-score cutoff, default 2.5
  minUsdFilter: number;       // hard min USD value per trade, 0 = disabled
  showContractQty: boolean;   // render qty label on bubble
  showVolumeProfile: boolean; // render volume profile overlay on chart
  showDeltaBubbles: boolean;  // replace trade bubbles with per-candle delta bubbles
  showCvd: boolean;           // show CVD sub-panel below chart
  panelWidth: number;         // side panel width in px, clamped [240, 560]
  includePerps: boolean;      // connect binance-perp, bybit-perp, okx-perp feeds
  alertRules: AlertRule[];
}

const CONFIG_DEFAULTS: AppConfig = {
  symbol: DEFAULT_SYMBOL,
  interval: DEFAULT_INTERVAL,
  showPatterns: true,
  autoLoadTrades: true,
  detectionThreshold: 2.5,
  minUsdFilter: 0,
  showContractQty: false,
  showVolumeProfile: true,
  showDeltaBubbles: false,
  showCvd: true,
  panelWidth: 320,
  includePerps: true,
  alertRules: [],
};

// ── Runtime state (not persisted) ────────────────────────────────
interface RuntimeState {
  bubbles: Bubble[];
  tradesLog: BigTrade[];
  selectedBubbleId: string | null;
  tradesPanelOpen: boolean;
  settingsPanelOpen: boolean;
  sessionPanelOpen: boolean;
  exchangeStatuses: Record<string, ConnectionStatus>;
  lastTickMs: number;
}

const RUNTIME_DEFAULTS: RuntimeState = {
  bubbles: [],
  tradesLog: [],
  selectedBubbleId: null,
  tradesPanelOpen: false,
  settingsPanelOpen: false,
  sessionPanelOpen: false,
  exchangeStatuses: {},
  lastTickMs: 0,
};

// ── Actions ──────────────────────────────────────────────────────
interface AppActions {
  // bubbles
  addBubble: (b: Bubble) => void;
  setBubbles: (bs: Bubble[]) => void;
  replaceBubbles: (bs: Bubble[]) => void; // direct replace, no merge — used by filter rederive
  clearBubbles: () => void;
  selectBubble: (id: string | null) => void;
  // trades log
  addToTradesLog: (t: BigTrade) => void;
  setTradesLog: (trades: BigTrade[]) => void;
  clearTradesLog: () => void;
  // panels
  openPanel: (panel: 'trades' | 'settings' | 'session') => void;
  closePanel: (panel: 'trades' | 'settings' | 'session') => void;
  togglePanel: (panel: 'trades' | 'settings' | 'session') => void;
  // config
  setSymbol: (s: string) => void;
  setInterval: (i: string) => void;
  setShowPatterns: (v: boolean) => void;
  setAutoLoadTrades: (v: boolean) => void;
  setDetectionThreshold: (v: number) => void;
  setMinUsdFilter: (v: number) => void;
  setShowContractQty: (v: boolean) => void;
  setShowVolumeProfile: (v: boolean) => void;
  setShowDeltaBubbles: (v: boolean) => void;
  setShowCvd: (v: boolean) => void;
  setPanelWidth: (w: number) => void;
  setIncludePerps: (v: boolean) => void;
  // alerts
  addAlertRule: (rule: AlertRule) => void;
  updateAlertRule: (id: string, patch: Partial<AlertRule>) => void;
  removeAlertRule: (id: string) => void;
  // exchange status
  setExchangeStatus: (exchange: string, status: ConnectionStatus) => void;
  // live tick
  setLastTick: () => void;
}

type AppState = AppConfig & RuntimeState & AppActions;

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...CONFIG_DEFAULTS,
      ...RUNTIME_DEFAULTS,

      // ── Bubble actions ──
      addBubble: (b) =>
        set((s) => {
          if (s.bubbles.some((existing) => existing.id === b.id)) return s;
          const next = [...s.bubbles, b];
          if (next.length > MAX_BUBBLES) next.splice(0, next.length - MAX_BUBBLES);
          return { bubbles: next };
        }),

      // Batch restore: merge historical bubbles with any live ones already added
      setBubbles: (bs) =>
        set((s) => {
          const historicalIds = new Set(bs.map((b) => b.id));
          const liveOnly = s.bubbles.filter((b) => !historicalIds.has(b.id));
          const next = [...bs, ...liveOnly];
          if (next.length > MAX_BUBBLES) next.splice(0, next.length - MAX_BUBBLES);
          return { bubbles: next };
        }),

      replaceBubbles: (bs) => set({ bubbles: bs }),

      clearBubbles: () => set({ bubbles: [] }),

      selectBubble: (id) => set({ selectedBubbleId: id }),

      // ── Trades log actions ──
      addToTradesLog: (t) =>
        set((s) => {
          if (s.tradesLog.some((existing) => existing.id === t.id)) return s;
          const next = [t, ...s.tradesLog];
          if (next.length > MAX_TRADES_LOG) next.length = MAX_TRADES_LOG;
          return { tradesLog: next };
        }),

      setTradesLog: (trades) => set({ tradesLog: trades }),

      clearTradesLog: () => set({ tradesLog: [] }),

      // ── Panel actions ──
      openPanel: (panel) =>
        set({
          tradesPanelOpen: panel === 'trades' ? true : false,
          settingsPanelOpen: panel === 'settings' ? true : false,
          sessionPanelOpen: panel === 'session' ? true : false,
        }),

      closePanel: (panel) =>
        set((s) => ({
          tradesPanelOpen: panel === 'trades' ? false : s.tradesPanelOpen,
          settingsPanelOpen: panel === 'settings' ? false : s.settingsPanelOpen,
          sessionPanelOpen: panel === 'session' ? false : s.sessionPanelOpen,
        })),

      // Only one panel open at a time — clicking active panel closes it
      togglePanel: (panel) =>
        set((s) => {
          const isOpen =
            panel === 'trades' ? s.tradesPanelOpen :
            panel === 'settings' ? s.settingsPanelOpen :
            s.sessionPanelOpen;
          return {
            tradesPanelOpen: panel === 'trades' ? !isOpen : false,
            settingsPanelOpen: panel === 'settings' ? !isOpen : false,
            sessionPanelOpen: panel === 'session' ? !isOpen : false,
          };
        }),

      // ── Config actions ──
      setSymbol: (symbol) => set({ symbol, bubbles: [], tradesLog: [], selectedBubbleId: null }),
      setInterval: (interval) => set({ interval, bubbles: [], selectedBubbleId: null }),
      setShowPatterns: (showPatterns) => set({ showPatterns }),
      setAutoLoadTrades: (autoLoadTrades) => set({ autoLoadTrades }),
      setDetectionThreshold: (detectionThreshold) => set({ detectionThreshold }),
      setMinUsdFilter: (minUsdFilter) => set({ minUsdFilter }),
      setShowContractQty: (showContractQty) => set({ showContractQty }),
      setShowVolumeProfile: (showVolumeProfile) => set({ showVolumeProfile }),
      setShowDeltaBubbles: (showDeltaBubbles) => set({ showDeltaBubbles }),
      setShowCvd: (showCvd) => set({ showCvd }),
      setPanelWidth: (w) => set({ panelWidth: Math.min(560, Math.max(240, w)) }),
      setIncludePerps: (includePerps) => set({ includePerps }),

      // ── Alert rules ──
      addAlertRule: (rule) => set((s) => ({ alertRules: [...s.alertRules, rule] })),
      updateAlertRule: (id, patch) =>
        set((s) => ({
          alertRules: s.alertRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeAlertRule: (id) =>
        set((s) => ({ alertRules: s.alertRules.filter((r) => r.id !== id) })),

      // ── Exchange status ──
      setExchangeStatus: (exchange, status) =>
        set((s) => ({
          exchangeStatuses: { ...s.exchangeStatuses, [exchange]: status },
        })),

      setLastTick: () => set({ lastTickMs: Date.now() }),
    }),
    {
      name: 'orderflow-config',
      version: 1,
      migrate(persistedState, fromVersion) {
        const s = persistedState as Partial<AppConfig>;
        if (fromVersion < 1) {
          s.autoLoadTrades = true;
        }
        return s;
      },
      partialize: (s) => ({
        symbol: s.symbol,
        interval: s.interval,
        showPatterns: s.showPatterns,
        detectionThreshold: s.detectionThreshold,
        minUsdFilter: s.minUsdFilter,
        autoLoadTrades: s.autoLoadTrades,
        showContractQty: s.showContractQty,
        showVolumeProfile: s.showVolumeProfile,
        showDeltaBubbles: s.showDeltaBubbles,
        showCvd: s.showCvd,
        panelWidth: s.panelWidth,
        includePerps: s.includePerps,
        alertRules: s.alertRules,
      }),
    },
  ),
);
