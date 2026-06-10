import type { ExchangeConnection, ConnectionStatus } from '../types';

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RETRIES = 12;

export function safeWS(
  url: string,
  onOpen: (ws: WebSocket) => void,
  onMessage: (data: unknown) => void,
  onStatus: (status: ConnectionStatus) => void,
): ExchangeConnection {
  let ws: WebSocket | null = null;
  let closed = false;
  let delay = RECONNECT_DELAY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  let lastMessageAt = 0;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let lastParseWarnAt = 0;

  function startWatchdog() {
    stopWatchdog();
    lastMessageAt = Date.now();
    watchdogTimer = setInterval(() => {
      if (Date.now() - lastMessageAt > 30_000) {
        ws?.close();
      }
    }, 10_000);
  }

  function stopWatchdog() {
    if (watchdogTimer !== null) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  }

  function connect() {
    if (closed) return;
    onStatus('connecting');
    ws = new WebSocket(url);

    ws.onopen = () => {
      delay = RECONNECT_DELAY_MS;
      onStatus('connected');
      startWatchdog();
      onOpen(ws!);
    };

    ws.onmessage = (evt) => {
      lastMessageAt = Date.now();
      retryCount = 0;
      const raw = evt.data as string;
      try {
        const data = JSON.parse(raw);
        onMessage(data);
      } catch {
        const now = Date.now();
        if (now - lastParseWarnAt > 60_000) {
          lastParseWarnAt = now;
          console.warn('[safeWS] parse failure', url, raw.slice(0, 200));
        }
      }
    };

    ws.onerror = () => {
      onStatus('error');
    };

    ws.onclose = () => {
      stopWatchdog();
      if (closed) return;
      onStatus('disconnected');
      retryCount += 1;
      if (retryCount > MAX_RETRIES) {
        onStatus('error');
        return;
      }
      retryTimer = setTimeout(() => {
        delay = Math.min(delay * 1.5, MAX_RECONNECT_DELAY_MS);
        connect();
      }, delay);
    };
  }

  connect();

  return {
    close() {
      closed = true;
      stopWatchdog();
      if (retryTimer !== null) clearTimeout(retryTimer);
      ws?.close();
    },
  };
}
