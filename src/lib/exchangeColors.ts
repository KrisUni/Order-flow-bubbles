export const EXCHANGE_COLORS: Record<string, string> = {
  binance:        '#F3BA2F',
  bybit:          '#F7931A',
  okx:            '#4A9EFF',
  kraken:         '#7B5EA7',
  bitstamp:       '#1BCB91',
  coinbase:       '#1652F0',
  'binance-perp': '#9E7520',
  'bybit-perp':   '#A0520D',
  'okx-perp':     '#1A5EBB',
  hyperliquid:    '#00C9A7',
};

export const VENUE_LABELS: Record<string, string> = {
  binance:        'BN',
  bybit:          'BB',
  okx:            'OKX',
  kraken:         'KRK',
  bitstamp:       'BST',
  coinbase:       'CB',
  'binance-perp': 'BNP',
  'bybit-perp':   'BBP',
  'okx-perp':     'OKP',
  hyperliquid:    'HL',
};

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
