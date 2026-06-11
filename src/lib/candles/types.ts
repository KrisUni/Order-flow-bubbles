import type { Candle } from '../types';

export interface KlineUpdate {
  candle: Candle;
  closed: boolean;
}

export interface CandleProvider {
  name: string;
  fetchKlines(symbol: string, interval: string, startTimeMs?: number): Promise<Candle[]>;
  openKlineStream(
    symbol: string,
    interval: string,
    onUpdate: (u: KlineUpdate) => void,
    onStatus: (status: string) => void,
  ): () => void;
}
