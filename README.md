<div align="center">

# 🫧 Order Flow Bubbles

**Real-time whale-trade visualization for crypto scalpers — nine exchange feeds, one composite tape, zero backend.**

Statistically significant trades rendered as live bubbles on the chart, with pattern classification, CVD, volume profile and alerts. Runs entirely in your browser. No API keys. No server. No subscription.

[Features](#-features) · [Quick Start](#-quick-start) · [How Detection Works](#-how-detection-works) · [Architecture](#-architecture) · [FAQ](#-faq)

![License](https://img.shields.io/badge/license-MIT-blue)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite)
![No backend](https://img.shields.io/badge/backend-none-success)
![No API keys](https://img.shields.io/badge/API%20keys-not%20required-success)

<!-- TODO: replace with a real demo GIF — this is the single highest-impact line in the README -->
<img src="docs/demo.gif" alt="Order Flow Bubbles — live whale trades on BTCUSDT" width="800"/>

</div>

---

## Why

Order-flow tools that show you *who is actually trading* — footprint charts, tape readers, liquidity heatmaps — are either expensive subscriptions or locked to a single exchange. But the raw data is public: every major crypto exchange streams its trade tape over open WebSockets.

**Order Flow Bubbles** taps nine of those feeds simultaneously, merges them into one composite tape, statistically detects the prints that matter, and paints them where they happened on the chart. Open a browser tab and you're reading aggregated cross-exchange whale flow in seconds.

## ✨ Features

**Composite multi-exchange tape** — Binance, Bybit, OKX, Kraken, Bitstamp and Coinbase spot, plus Binance, Bybit and OKX perpetual futures. Volume and delta are aggregated across all venues; perp flow is tagged separately from spot. Any single feed dying never takes the app down.

**Statistical whale detection** — no arbitrary "$100k = whale" thresholds. A rolling z-score model learns each symbol's own trade-size distribution, so detection self-calibrates from BTC to the thinnest altcoin.

**Pattern classification** — every detected trade is classified against its candle zone: **Absorption** (continuation or contrarian), **Acceptance**, **Rejection**. Re-classified automatically when you switch timeframes, because the same print means different things on a 1m and a 15m candle.

**Type any ticker** — a runtime symbol resolver probes all nine venues' public instrument APIs, shows you exactly which exchanges list it, and connects to whatever exists. Works for symbols that aren't on Binance at all.

**Scalper cockpit** — CVD sub-panel synced to the main chart, volume profile with VAH/VAL value-area bands, VWAP, live session stats (delta, buy/sell volume, trades/min, biggest print), candle-close countdown, and per-feed health indicators so silent data degradation is never silent.

**Alerts** — rule engine (size, pattern, side) with browser notifications and audio, firing even for trades below your display filter.

**Persistence without a server** — detected trades and candle history live in IndexedDB. Close the tab, come back tomorrow: your bubbles restore, re-binned and re-classified for whatever timeframe you open.

**Optional AI agent** — a local Python loop that consumes candle-close snapshots, gates setups deterministically (structure-based stops, R:R, confluence scoring), asks a local LLM to approve or veto, and sends qualified signals to Telegram. Signals only — it never trades for you.

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/order-flow-bubbles.git
cd order-flow-bubbles
npm install
npm run dev
```

Open **http://localhost:5173** — that exact origin matters, since your trade history is stored per-origin in the browser. Pick a symbol or type any ticker. That's the entire setup: no accounts, no keys, no config files.

> **Tip:** grant durable storage so the browser never evicts your trade history: the app requests `navigator.storage.persist()` on first run.

## 🔬 How Detection Works

1. Every trade from every connected venue flows into a shared detector maintaining a rolling window of recent trade sizes per symbol.
2. A trade whose size z-score exceeds the threshold (default 2.5σ, adjustable) is flagged as statistically significant.
3. The trade is classified against its candle's structure — where in the range it printed, with or against the candle direction — into Absorption / Acceptance / Rejection.
4. It's drawn as a bubble (scaled by USD size, colored by aggressor side, ringed by pattern) at its exact price and time, logged, persisted, and matched against your alert rules.

Because thresholds are relative to each symbol's own distribution, a $40k print on a microcap and a $4M print on BTC can both be whales.

## 🏗 Architecture

```
9 × WebSocket feeds ─→ normalize ─→ shared z-score detector ─→ classify ─→ bubbles / log / alerts
                                          │
candle skeleton (Binance ▸ Bybit fallback)│ composite volume & CVD (all venues)
                                          ▼
                              IndexedDB (trades · candles · detector state)
```

- **React 18 + TypeScript + Vite 5**, state in **Zustand**, charts via **lightweight-charts**, bubbles on a canvas overlay with dirty-flag rendering.
- Candle OHLC is a *price skeleton* from the best available venue; the signal — volume, delta, detection — is composite across all venues by design.
- Fault tolerance is a hard requirement: every connector reconnects with backoff, a silence watchdog kills half-open sockets, and unlisted venues are skipped per symbol.

## ❓ FAQ

**Is my data sent anywhere?** No. The app talks directly from your browser to exchange public endpoints. There is no backend, no analytics, no telemetry.

**Does it place trades?** No. It visualizes flow and (optionally) sends you signals. Execution is yours.

**Why do bubbles differ between timeframes?** Patterns are classified against candle structure, and a trade sits in different structures on different timeframes. That's a feature.

**Rate limits / bans?** All feeds are public market-data streams within documented limits. No keys, nothing to ban.

## ⚠️ Disclaimer

This is a market **visualization and research tool**, not financial advice and not a trading system. Crypto is volatile; order-flow signals are probabilistic at best. Nothing here constitutes a recommendation to buy or sell anything. Trade at your own risk.

## 🤝 Contributing

Issues and PRs welcome. The codebase favors surgical changes — read `CLAUDE.md` for the working conventions. Good first contributions: new exchange connectors (the connector interface is small), additional candle-skeleton providers, pattern hit-rate analytics.

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
<sub>If this tool helps your trading, a ⭐ helps others find it.</sub>
</div>
