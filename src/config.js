// TradeAgent IV — configuration: coin tiers, cron, endpoints, constants.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. CONFIG — 3-TIER COIN SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TIER_1 = {
  bitcoin:      { symbol: 'BTC',  emoji: '₿',   name: 'Bitcoin',     tier: 1 },
  ethereum:     { symbol: 'ETH',  emoji: 'Ξ',   name: 'Ethereum',    tier: 1 },
  solana:       { symbol: 'SOL',  emoji: '◎',   name: 'Solana',      tier: 1 },
  ripple:       { symbol: 'XRP',  emoji: '✕',   name: 'XRP',         tier: 1 },
  binancecoin:  { symbol: 'BNB',  emoji: '🔶',  name: 'BNB',         tier: 1 },
  'tether-gold':{ symbol: 'XAUT', emoji: '🥇',  name: 'Tether Gold', tier: 1 },
};

const TIER_2 = {
  cardano:      { symbol: 'ADA',  emoji: '🔷',  name: 'Cardano',     tier: 2 },
  chainlink:    { symbol: 'LINK', emoji: '🔗',  name: 'Chainlink',   tier: 2 },
  'avalanche-2':{ symbol: 'AVAX', emoji: '❄️',  name: 'Avalanche',   tier: 2 },
  sui:          { symbol: 'SUI',  emoji: '💧',  name: 'Sui',         tier: 2 },
  'hedera-hashgraph': { symbol: 'HBAR', emoji: '🌿', name: 'Hedera', tier: 2 },
  'polygon-ecosystem-token': { symbol: 'POL', emoji: '💜', name: 'Polygon', tier: 2 },
  'injective-protocol': { symbol: 'INJ', emoji: '💉', name: 'Injective', tier: 2 },
  arbitrum:     { symbol: 'ARB',  emoji: '🔷',  name: 'Arbitrum',    tier: 2 },
  optimism:     { symbol: 'OP',   emoji: '🔴',  name: 'Optimism',    tier: 2 },
  cosmos:       { symbol: 'ATOM', emoji: '⚛️',  name: 'Cosmos',      tier: 2 },
  'the-open-network': { symbol: 'TON', emoji: '💎', name: 'Toncoin', tier: 2 },
  polkadot:     { symbol: 'DOT',  emoji: '🔴',  name: 'Polkadot',    tier: 2 },
  litecoin:     { symbol: 'LTC',  emoji: 'Ł',   name: 'Litecoin',    tier: 2 },
  near:         { symbol: 'NEAR', emoji: '🔷',  name: 'NEAR',        tier: 2 },
  aptos:        { symbol: 'APT',  emoji: '🅰️',  name: 'Aptos',       tier: 2 },
  uniswap:      { symbol: 'UNI',  emoji: '🦄',  name: 'Uniswap',     tier: 2 },
  tron:         { symbol: 'TRX',  emoji: '🔺',  name: 'TRON',        tier: 2 },
  hyperliquid:  { symbol: 'HYPE', emoji: '🔥',  name: 'Hyperliquid', tier: 2 },
};

const TIER_3 = {
  'shiba-inu':  { symbol: 'SHIB', emoji: '🐕‍🦺', name: 'Shiba Inu',  tier: 3 },
  dogecoin:     { symbol: 'DOGE', emoji: '🐕',  name: 'Dogecoin',    tier: 3 },
  pepe:         { symbol: 'PEPE', emoji: '🐸',  name: 'Pepe',        tier: 3 },
  dogwifcoin:   { symbol: 'WIF',  emoji: '🧢',  name: 'dogwifhat',   tier: 3 },
  bonk:         { symbol: 'BONK', emoji: '🔨',  name: 'Bonk',        tier: 3 },
  bittensor:    { symbol: 'TAO',  emoji: '🔯',  name: 'Bittensor',   tier: 3 },
  'fetch-ai':   { symbol: 'FET',  emoji: '🤖',  name: 'Fetch.ai',    tier: 3 },
  'render-token':{ symbol: 'RENDER', emoji: '🎨', name: 'Render',   tier: 3 },
};

const COINS = { ...TIER_1, ...TIER_2, ...TIER_3 };
const COIN_IDS = Object.keys(COINS).join(',');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. CRON CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CRON_PRICE   = '*/30 * * * *';
const CRON_BUNDLE  = '0 */8 * * *';
const CRON_MOVERS  = '0 9,15,21 * * *';

// Alert on |24h change| >= pct (above = up-move, below = down-move).
const ALERT_PRESETS = {
  bitcoin:  { pct: 5 },
  ethereum: { pct: 5 },
  solana:   { pct: 7 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. API ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';

// Model audit 2026-11-02 (official catalogs): gemini-3.5-flash superseded,
// gemini-3.1-flash-lite shutdown-announced (2027-05-07). Current chain:
// Primary: Gemini 3.8 Flash (flagship) -> 3.6 Flash -> 2.5 Flash (stable).
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
const GEMINI_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
const GEMINI_FALLBACK_URL_2 = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FNG_URL = 'https://api.alternative.me/fng/?limit=2';

const BINANCE_MAP = {
  bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT', ripple: 'XRPUSDT', 'the-open-network': 'TONUSDT',
  cardano: 'ADAUSDT', dogecoin: 'DOGEUSDT', chainlink: 'LINKUSDT',
  'avalanche-2': 'AVAXUSDT', polkadot: 'DOTUSDT', litecoin: 'LTCUSDT',
  tron: 'TRXUSDT', uniswap: 'UNIUSDT', near: 'NEARUSDT', aptos: 'APTUSDT',
  'tether-gold': 'XAUTUSDT', 'shiba-inu': 'SHIBUSDT', 'polygon-ecosystem-token': 'POLUSDT',
  sui: 'SUIUSDT', pepe: 'PEPEUSDT', arbitrum: 'ARBUSDT', optimism: 'OPUSDT',
  'injective-protocol': 'INJUSDT', bittensor: 'TAOUSDT', 'fetch-ai': 'FETUSDT',
  'render-token': 'RENDERUSDT', bonk: 'BONKUSDT', dogwifcoin: 'WIFUSDT',
  'hedera-hashgraph': 'HBARUSDT', cosmos: 'ATOMUSDT', hyperliquid: 'HYPEUSDT',
};

const SYMBOL_TO_ID = Object.fromEntries(
  Object.entries(COINS).map(([id, c]) => [c.symbol, id])
);

const CMC_SYMBOLS = Object.values(COINS).map(c => c.symbol).join(',');

const FOOTER = `<blockquote>📡 <b>TradeAgent IV</b> · <i>AI Crypto Intelligence</i>\n@TradeAgentIV</blockquote>`;

const AI_MODES = { normal: 'Normal', deep: 'Deep', short: 'Short', emotion: 'Emotion' };
const SCENARIOS = { bullish: 'Bullish', bearish: 'Bearish', neutral: 'Neutral', volatile: 'Volatile' };

const EMOTION_STATES = {
  PANIC:    { emoji: '💀🚨', color: '🔴', tone: 'Short, serious warnings. Market panicking. Focus on capital preservation.' },
  FEAR:     { emoji: '😰🧊', color: '🟠', tone: 'Conservative. Fearful but accumulation opportunities exist.' },
  NEUTRAL:  { emoji: '😐',   color: '⚪', tone: 'Neutral, factual. Sideways market. Balanced analysis.' },
  MOMENTUM: { emoji: '🔥📈', color: '🟢', tone: 'Analytical, optimistic. Upside momentum building.' },
  BREAKOUT: { emoji: '🚀⚡', color: '🟢', tone: 'Controlled excitement. Breakout confirmed. Warn of pullback risk.' },
  FOMO:     { emoji: '🧨📊', color: '🔴', tone: 'Warning with urgency. Extreme greed. Emphasize FOMO danger.' },
};

const STICKER_SET_NAME = 'TradeAgentIVstickers';

export { TIER_1, TIER_2, TIER_3, COINS, COIN_IDS, CRON_PRICE, CRON_BUNDLE, CRON_MOVERS, ALERT_PRESETS, COINGECKO_BASE, CMC_BASE, GEMINI_URL, GEMINI_FALLBACK_URL, GEMINI_FALLBACK_URL_2, OPENROUTER_URL, FNG_URL, BINANCE_MAP, SYMBOL_TO_ID, CMC_SYMBOLS, FOOTER, AI_MODES, SCENARIOS, EMOTION_STATES, STICKER_SET_NAME };
