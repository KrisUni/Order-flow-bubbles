import type { BigTrade } from './types';
import { useStore } from './config';

let lastFiredAt = 0;
let audioCtx: AudioContext | null = null;

function playBeep(): void {
  if (!audioCtx) audioCtx = new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = 880;
  gain.gain.value = 0.1;
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

export function evaluateAlerts(trade: BigTrade): void {
  const { alertRules, symbol } = useStore.getState();

  for (const rule of alertRules) {
    if (!rule.enabled) continue;
    if (rule.minUsd > 0 && trade.usdValue < rule.minUsd) continue;
    if (rule.pattern !== undefined && trade.pattern !== rule.pattern) continue;
    if (rule.side !== undefined) {
      const tradeSide = trade.isMaker ? 'sell' : 'buy';
      if (tradeSide !== rule.side) continue;
    }

    const now = Date.now();
    if (now - lastFiredAt < 3000) return;
    lastFiredAt = now;

    if (rule.notify && Notification.permission === 'granted') {
      const side = trade.isMaker ? 'SELL' : 'BUY';
      const usdStr =
        trade.usdValue >= 1_000_000
          ? `$${(trade.usdValue / 1_000_000).toFixed(2)}M`
          : `$${(trade.usdValue / 1_000).toFixed(0)}K`;
      const patternPart = trade.pattern ? ` ${trade.pattern}` : '';
      const title = `${symbol} —${patternPart} ${usdStr} ${side}`;
      new Notification(title, {
        body: `Price: ${trade.price.toLocaleString()} · ${trade.exchange ?? 'binance'}`,
      });
    }

    if (rule.sound) playBeep();
  }
}
