// ═══════════════════════════════════════════════════════════════
//  TRADEAGENT IV HYBRID v4.2.6-FINAL — AI Prompt Fix + Free Models Only
//  FIXES: Reverted to PROVEN v3.7 prompt, OpenRouter :free models restored,
//         Gemini 2.5/2.0/1.5 cascade, Persian blockquote expandable,
//         "not modified" case-insensitive, AI fallback bypasses dedup
// ═══════════════════════════════════════════════════════════════

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
  polygon:      { symbol: 'POL',  emoji: '💜',  name: 'Polygon',     tier: 2 },
  injective:    { symbol: 'INJ',  emoji: '💉',  name: 'Injective',   tier: 2 },
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
  dogwifhat:    { symbol: 'WIF',  emoji: '🧢',  name: 'dogwifhat',   tier: 3 },
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

const ALERT_PRESETS = {
  bitcoin:  { above: 110000, below: 95000 },
  ethereum: { above: 4500,   below: 3200 },
  solana:   { above: 250,    below: 180 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. API ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_FALLBACK_URL_2 = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FNG_URL = 'https://api.alternative.me/fng/?limit=1';

const BINANCE_MAP = {
  bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT', ripple: 'XRPUSDT', 'the-open-network': 'TONUSDT',
  cardano: 'ADAUSDT', dogecoin: 'DOGEUSDT', chainlink: 'LINKUSDT',
  'avalanche-2': 'AVAXUSDT', polkadot: 'DOTUSDT', litecoin: 'LTCUSDT',
  tron: 'TRXUSDT', uniswap: 'UNIUSDT', near: 'NEARUSDT', aptos: 'APTUSDT',
  'tether-gold': 'XAUTUSDT', 'shiba-inu': 'SHIBUSDT', polygon: 'POLUSDT',
  sui: 'SUIUSDT', pepe: 'PEPEUSDT', arbitrum: 'ARBUSDT', optimism: 'OPUSDT',
  injective: 'INJUSDT', bittensor: 'TAOUSDT', 'fetch-ai': 'FETUSDT',
  'render-token': 'RENDERUSDT', bonk: 'BONKUSDT', dogwifhat: 'WIFUSDT',
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. SECURITY & UTILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isAdmin(userId, env) {
  return String(userId) === String(env.ADMIN_ID);
}

function checkSecret(request, env) {
  return request.headers.get('x-admin-secret') === env.ADMIN_SECRET;
}

function esc(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// [FIX v4.2.6-FINAL] fetchWithTimeout with configurable timeout
function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/__(.*?)__/g, '<b>$1</b>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/```/g, '');
}

const fmt = {
  price: (n) => {
    if (!n) return '$0.00';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 1)    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 0.01) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  },
  vol: (n) => {
    if (!n) return '$0';
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${(n / 1e3).toFixed(2)}K`;
  },
  cap: (n) => {
    if (!n) return '$0';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
    return `$${(n / 1e6).toFixed(2)}M`;
  },
  change: (n) => {
    const v = n || 0;
    return `${v >= 0 ? '🟢' : '🔴'} ${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  },
  time: () => new Date().toISOString().slice(0, 16).replace('T', ' '),
  date: () => new Date().toISOString().slice(0, 10),
  pct: (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`,
};

function getBias(fearValue) {
  const v = parseInt(fearValue);
  if (v >= 75) return '😱 Extreme Greed — 🔴 Caution!';
  if (v >= 55) return '😊 Greed — 🟡 FOMO Zone';
  if (v >= 45) return '😐 Neutral — ⚪ Balanced';
  if (v >= 25) return '😰 Fear — 🟢 Accumulation';
  return '😨 Extreme Fear — 🟢 Opportunity!';
}

function progressBar(value, max = 100, blocks = 10) {
  const filled = Math.round((value / max) * blocks);
  return '🟩'.repeat(filled) + '⬜'.repeat(blocks - filled);
}

function getShortModelName(fullName) {
  if (!fullName) return 'AI';
  const clean = fullName.replace(/:free$/i, '').replace(/:paid$/i, '');
  const lower = clean.toLowerCase();
  if (lower.includes('gemini')) return 'Gemini';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('qwen')) return 'Qwen';
  if (lower.includes('claude')) return 'Claude';
  if (lower.includes('gpt')) return 'GPT';
  if (lower.includes('llama')) return 'Llama';
  if (lower.includes('kimi')) return 'Kimi';
  if (lower.includes('gemma')) return 'Gemma';
  return clean;
}

async function hashPrompt(prompt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. EMOTION ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function calculateEmotionState(data) {
  const btc = data.btcChange || 0;
  const eth = data.ethChange || 0;
  const fng = data.fearGreed || 50;
  const dom = data.btcDominanceChange || 0;
  
  let score = btc * 2.5 + eth * 1.5 + (fng - 50) * 1.2 + dom * 2;
  
  let state, intensity;
  if (score <= -60) { state = 'PANIC'; intensity = Math.min(100, Math.abs(score)); }
  else if (score <= -20) { state = 'FEAR'; intensity = Math.min(100, Math.abs(score) * 1.5); }
  else if (score <= 15) { state = 'NEUTRAL'; intensity = 30 + Math.abs(score); }
  else if (score <= 45) { state = 'MOMENTUM'; intensity = Math.min(100, 50 + score); }
  else if (score <= 70) { state = 'BREAKOUT'; intensity = Math.min(100, 60 + score); }
  else { state = 'FOMO'; intensity = Math.min(100, 80 + score * 0.5); }
  
  intensity = Math.round(Math.max(0, Math.min(100, intensity)));
  return { state, intensity, ...EMOTION_STATES[state] };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. API HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function api(url, opts = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetchWithTimeout(url, {
        ...opts,
        headers: { Accept: 'application/json', 'User-Agent': 'TradeAgentIV/4.2', ...opts.headers },
      }, 15000);
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status} ${txt.slice(0, 100)}`);
      }
      return await r.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. PRICE API — FAILOVER: CG → CMC → Binance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizeCG(coins) {
  return coins.map(c => ({
    id: c.id, current_price: c.current_price,
    price_change_percentage_24h: c.price_change_percentage_24h,
    price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency,
    price_change_percentage_30d_in_currency: c.price_change_percentage_30d_in_currency,
    total_volume: c.total_volume, market_cap: c.market_cap,
  }));
}

function normalizeCMC(data) {
  const result = [];
  for (const coin of Object.values(data.data || {})) {
    const id = SYMBOL_TO_ID[coin.symbol];
    if (!id) continue;
    const q = coin.quote?.USD || {};
    result.push({
      id, current_price: q.price || 0,
      price_change_percentage_24h: q.percent_change_24h || 0,
      price_change_percentage_7d_in_currency: q.percent_change_7d || 0,
      price_change_percentage_30d_in_currency: q.percent_change_30d || 0,
      total_volume: q.volume_24h || 0,
      market_cap: q.market_cap || 0,
    });
  }
  return result;
}

function normalizeBinance(data) {
  return data.map(b => {
    const id = Object.keys(BINANCE_MAP).find(k => BINANCE_MAP[k] === b.symbol);
    const price = parseFloat(b.lastPrice);
    return {
      id, current_price: price,
      price_change_percentage_24h: parseFloat(b.priceChangePercent),
      price_change_percentage_7d_in_currency: 0,
      price_change_percentage_30d_in_currency: 0,
      total_volume: parseFloat(b.volume) * price,
      market_cap: 0,
    };
  });
}

async function getCoinsCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d`;
  return normalizeCG(await api(url, { headers: { 'x-cg-demo-api-key': key } }));
}

async function getCoinsCMC(env) {
  const key = env.CMC_API_KEY;
  if (!key) return null;
  const url = `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${CMC_SYMBOLS}`;
  return normalizeCMC(await api(url, { headers: { 'X-CMC_PRO_API_KEY': key } }));
}

async function getCoinsBinance() {
  const symbols = Object.values(BINANCE_MAP).map(s => `"${s}"`).join(',');
  return normalizeBinance(await api(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`));
}

async function getCoins(env) {
  try { const cg = await getCoinsCG(env); if (cg?.length) return { source: 'CoinGecko', data: cg }; } catch (e) { console.error('[API] CG fail:', e.message); }
  try { const cmc = await getCoinsCMC(env); if (cmc?.length) return { source: 'CoinMarketCap', data: cmc }; } catch (e) { console.error('[API] CMC fail:', e.message); }
  try { const bin = await getCoinsBinance(); if (bin?.length) return { source: 'Binance', data: bin }; } catch (e) { console.error('[API] Binance fail:', e.message); }
  throw new Error('All price APIs failed');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. ENHANCED DATA APIs — MOVERS FIX (Binance Primary)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getTopGainersLosersBinance() {
  try {
    console.log('[API] Fetching movers from Binance...');
    const data = await api('https://api.binance.com/api/v3/ticker/24hr');
    if (!Array.isArray(data)) {
      console.error('[API] Binance movers: response not array');
      return null;
    }
    
    const ourSymbols = new Set(Object.values(BINANCE_MAP));
    const mapped = data
      .filter(t => ourSymbols.has(t.symbol))
      .map(t => {
        const id = Object.keys(BINANCE_MAP).find(k => BINANCE_MAP[k] === t.symbol);
        return {
          symbol: COINS[id]?.symbol || id,
          current_price: parseFloat(t.lastPrice),
          price_change_percentage_24h: parseFloat(t.priceChangePercent),
        };
      })
      .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    
    if (!mapped.length) {
      console.error('[API] Binance movers: no mapped coins found');
      return null;
    }
    
    console.log(`[API] Binance movers: ${mapped.length} coins mapped`);
    return {
      gainers: mapped.slice(0, 5),
      losers: mapped.slice(-5).reverse(),
    };
  } catch (e) { 
    console.error('[API] Binance Movers fail:', e.message); 
    return null; 
  }
}

async function getTopGainersLosersCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  try {
    const data = await api(`${COINGECKO_BASE}/coins/top_gainers_losers?vs_currency=usd&duration=24h`, { headers: { 'x-cg-demo-api-key': key } });
    return { gainers: (data.top_gainers || []).slice(0, 5), losers: (data.top_losers || []).slice(0, 5) };
  } catch (e) { console.error('[API] CG Gainers fail:', e.message); return null; }
}

async function getTopGainersLosers(env) {
  const bin = await getTopGainersLosersBinance();
  if (bin) return bin;
  
  if (env.COINGECKO_API_KEY) {
    const cg = await getTopGainersLosersCG(env);
    if (cg) return cg;
  }
  
  console.error('[API] All movers sources failed');
  return null;
}

async function getCategories(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  try {
    const data = await api(`${COINGECKO_BASE}/coins/categories`, { headers: { 'x-cg-demo-api-key': key } });
    return (data || []).slice(0, 8).map(c => ({ name: c.name, change: c.market_cap_change_24h || 0 }));
  } catch (e) { console.error('[API] Categories fail:', e.message); return null; }
}

async function getMarketChart(coinId, days, env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return 0;
  try {
    const data = await api(`${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`, { headers: { 'x-cg-demo-api-key': key } });
    const prices = data.prices;
    if (!prices || prices.length < 2) return 0;
    const first = prices[0][1], last = prices[prices.length - 1][1];
    return ((last - first) / first) * 100;
  } catch (e) { console.error(`[API] Chart ${coinId} fail:`, e.message); return 0; }
}

async function getBinanceFutures(symbol) {
  try {
    const [funding, oi, ls] = await Promise.all([
      api(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`).catch(() => null),
      api(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`).catch(() => null),
      api(`https://fapi.binance.com/fapi/v1/globalLongShortAccountRatio?symbol=${symbol}&period=1d&limit=1`).catch(() => null),
    ]);
    return {
      fundingRate: funding ? parseFloat(funding.lastFundingRate) * 100 : null,
      openInterest: oi ? parseFloat(oi.openInterest) : null,
      longShortRatio: ls && ls[0] ? parseFloat(ls[0].longShortRatio) : null,
    };
  } catch (e) { console.error('[API] Futures fail:', e.message); return {}; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. GLOBAL & TRENDING — FAILOVER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getGlobalCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  return api(`${COINGECKO_BASE}/global`, { headers: { 'x-cg-demo-api-key': key } });
}

async function getGlobalCMC(env) {
  const key = env.CMC_API_KEY;
  if (!key) return null;
  const data = await api(`${CMC_BASE}/global-metrics/quotes/latest`, { headers: { 'X-CMC_PRO_API_KEY': key } });
  const q = data.data?.quote?.USD || {};
  return {
    data: {
      total_market_cap: { usd: q.total_market_cap || 0 },
      total_volume: { usd: q.total_volume_24h || 0 },
      market_cap_percentage: { btc: data.data?.btc_dominance || 0 }
    }
  };
}

async function getGlobal(env) {
  try { const cg = await getGlobalCG(env); if (cg) return cg; } catch (e) {}
  try { const cmc = await getGlobalCMC(env); if (cmc) return cmc; } catch (e) {}
  return null;
}

async function getTrendingCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  return api(`${COINGECKO_BASE}/search/trending`, { headers: { 'x-cg-demo-api-key': key } });
}

async function getTrendingCMC(env) {
  const key = env.CMC_API_KEY;
  if (!key) return null;
  const data = await api(`${CMC_BASE}/cryptocurrency/trending/latest?limit=10`, { headers: { 'X-CMC_PRO_API_KEY': key } });
  return { coins: (data.data || []).map(c => ({ item: { symbol: c.symbol, name: c.name, market_cap_rank: c.cmc_rank || '?' } })) };
}

async function getTrending(env) {
  try { const cg = await getTrendingCG(env); if (cg) return cg; } catch (e) {}
  try { const cmc = await getTrendingCMC(env); if (cmc) return cmc; } catch (e) {}
  return null;
}

async function getFearGreed() {
  try {
    return await api(FNG_URL);
  } catch (e) {
    console.error('[API] F&G fail:', e.message);
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. AI LAYER — GEMINI DIRECT → OPENROUTER :FREE FAILOVER (v4.2.6-FINAL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AI_CACHE_TTL = 3600;
const CIRCUIT_TTL = 300;

async function getAICache(env, promptHash) {
  if (!env.ALERTS_KV) return null;
  try {
    const cached = await env.ALERTS_KV.get(`ai:cache:${promptHash}`);
    return cached ? JSON.parse(cached) : null;
  } catch (e) { return null; }
}

async function setAICache(env, promptHash, result) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put(`ai:cache:${promptHash}`, JSON.stringify(result), { expirationTtl: AI_CACHE_TTL });
  } catch (e) {}
}

async function isCircuitOpen(env, name) {
  if (!env.ALERTS_KV) return false;
  try {
    const state = await env.ALERTS_KV.get(`circuit:${name}`);
    return state === 'open';
  } catch (e) { return false; }
}

async function tripCircuit(env, name) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put(`circuit:${name}`, 'open', { expirationTtl: CIRCUIT_TTL });
  } catch (e) {}
}

async function closeCircuit(env, name) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.delete(`circuit:${name}`);
  } catch (e) {}
}

// ── GEMINI DIRECT API (priority) ──
async function tryGeminiDirect(env, prompt, modelUrl, name) {
  if (!env.GEMINI_API_KEY) {
    console.log(`[AI] ${name} skipped: No GEMINI_API_KEY`);
    return null;
  }
  if (await isCircuitOpen(env, name)) {
    console.log(`[AI] ${name} circuit OPEN, skipping`);
    return null;
  }
  try {
    console.log(`[AI] Trying Gemini direct: ${name}...`);
    const res = await fetchWithTimeout(`${modelUrl}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
      }),
    }, 20000);
    
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${txt.slice(0, 100)}`);
    }
    
    const data = await res.json();
    console.log(`[AI] ${name} raw:`, JSON.stringify(data).slice(0, 250));
    
    let text = null;
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = data.candidates[0].content.parts[0].text;
    } else if (data?.candidates?.[0]?.content?.parts) {
      text = data.candidates[0].content.parts.map(p => p.text).join('');
    }
    
    if (text && text.length > 30) {
      console.log(`[AI] ${name} SUCCESS, length:`, text.length);
      await closeCircuit(env, name);
      return cleanMarkdown(text.trim());
    }
    console.log(`[AI] ${name} returned empty/short text`);
    return null;
  } catch (e) {
    console.error(`[AI] ${name} fail:`, e.message);
    if (e.message.includes('429') || e.message.includes('quota') || e.message.includes('exceeded') || e.message.includes('Rate limit')) {
      console.log(`[AI] ${name} 429/quota → tripping circuit`);
      await tripCircuit(env, name);
    }
    return null;
  }
}

async function getAIAnalysis(env, prompt) {
  const promptHash = await hashPrompt(prompt);
  
  const cached = await getAICache(env, promptHash);
  if (cached) {
    console.log('[AI] Cache hit for hash:', promptHash);
    return cached;
  }

  // ── STEP 1: Gemini 2.5 Flash Direct (PRIMARY) ──
  let text = await tryGeminiDirect(env, prompt, GEMINI_URL, 'gemini-2.5-flash');
  
  // ── STEP 2: Gemini 2.0 Flash Fallback ──
  if (!text) {
    text = await tryGeminiDirect(env, prompt, GEMINI_FALLBACK_URL, 'gemini-2.0-flash');
  }

  // ── STEP 3: Gemini 1.5 Flash Fallback ──
  if (!text) {
    text = await tryGeminiDirect(env, prompt, GEMINI_FALLBACK_URL_2, 'gemini-1.5-flash');
  }

  if (text) {
    const result = { text, source: 'Gemini' };
    await setAICache(env, promptHash, result);
    await setConfig(env, 'last_ai_provider', 'Gemini');
    await setConfig(env, 'last_ai_time', fmt.time());
    return result;
  }

  // ── STEP 4: OpenRouter :FREE Failover ──
  console.log('[AI] Gemini family failed, trying OpenRouter FREE models...');
  if (!env.OPENROUTER_API_KEY) {
    console.log('[AI] No OpenRouter key, giving up');
    return null;
  }

  // [FIX v4.2.6-FINAL] ALL models must have :free suffix for zero cost
  const models = [
    'google/gemini-2.5-flash-preview:free',
    'deepseek/deepseek-chat-v3-0324:free',
    'meta-llama/llama-4-maverick:free',
    'qwen/qwen3-235b-a22b:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
  ];

  for (const model of models) {
    try {
      console.log(`[AI] Trying OpenRouter FREE: ${getShortModelName(model)}...`);
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tradeagent.iv',
          'X-Title': 'TradeAgent IV',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 900,
          temperature: 0.3
        }),
      }, 20000);
      
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.log(`[AI] ${model} HTTP ${res.status}: ${errText.slice(0, 100)}`);
        continue;
      }
      
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        const result = { text: cleanMarkdown(text.trim()), source: getShortModelName(model) };
        await setAICache(env, promptHash, result);
        await setConfig(env, 'last_ai_provider', getShortModelName(model));
        await setConfig(env, 'last_ai_time', fmt.time());
        console.log(`[AI] ✅ ${getShortModelName(model)} SUCCESS`);
        return result;
      }
    } catch (e) { 
      console.error(`[AI] ${model} fail:`, e.message); 
    }
  }

  console.log('[AI] All OpenRouter FREE models failed');
  return null;
}

async function testGeminiConnection(env) {
  if (!env.GEMINI_API_KEY) return { ok: false, error: 'No API key configured' };
  try {
    const res = await fetchWithTimeout(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 }
      })
    }, 10000);
    if (res.status === 429) return { ok: false, error: 'Rate limited (429)', source: 'Gemini' };
    if (res.status === 400) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `Bad Request (400): ${txt.slice(0, 100)}`, source: 'Gemini' };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, source: 'Gemini' };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.toLowerCase().includes('ok')) return { ok: true, source: 'Gemini' };
    return { ok: false, error: `Unexpected: ${text || 'empty'}`, source: 'Gemini' };
  } catch (e) {
    return { ok: false, error: e.message, source: 'Gemini' };
  }
}

// [FIX v4.2.6-FINAL] PROVEN v3.7 prompt structure + correct yesterday data
function buildAIPrompt(today, yesterday, mode, scenario, emotion) {
  const t = today, y = yesterday || {};
  const emo = emotion || { state: 'NEUTRAL', intensity: 50, tone: 'Neutral, factual.' };

  const coinChanges = [];
  const mainCoins = t.coins.filter(c => ['bitcoin', 'ethereum', 'solana'].includes(c.id));
  const otherCoins = t.coins.filter(c => !['bitcoin', 'ethereum', 'solana'].includes(c.id));

  for (const c of mainCoins) {
    const ch24 = c.price_change_percentage_24h || 0;
    const ch7d = c.price_change_percentage_7d_in_currency || t.changes7d?.[c.id] || 0;
    const ch30d = c.price_change_percentage_30d_in_currency || t.changes30d?.[c.id] || 0;
    const info = COINS[c.id];
    coinChanges.push(`${info.symbol}: $${fmt.price(c.current_price)} | 24h: ${fmt.pct(ch24)} | 7d: ${fmt.pct(ch7d)} | 30d: ${fmt.pct(ch30d)} | Vol: ${fmt.vol(c.total_volume)}`);
  }

  if (otherCoins.length) {
    const tier2 = otherCoins.filter(c => COINS[c.id]?.tier === 2).map(c => `${COINS[c.id].symbol} ${fmt.pct(c.price_change_percentage_24h)}`);
    const tier3 = otherCoins.filter(c => COINS[c.id]?.tier === 3).map(c => `${COINS[c.id].symbol} ${fmt.pct(c.price_change_percentage_24h)}`);
    if (tier2.length) coinChanges.push(`Tier 2: ${tier2.join(', ')}`);
    if (tier3.length) coinChanges.push(`Tier 3: ${tier3.join(', ')}`);
  }

  let futuresText = '';
  if (t.futures?.BTCUSDT) {
    const f = t.futures.BTCUSDT;
    futuresText = `\nBTC Futures: Funding: ${f.fundingRate !== null ? f.fundingRate.toFixed(4) + '%' : 'N/A'} | OI: ${f.openInterest !== null ? fmt.vol(f.openInterest) : 'N/A'} | L/S: ${f.longShortRatio !== null ? f.longShortRatio.toFixed(2) : 'N/A'}`;
  }

  let gainersText = '';
  if (t.gainersLosers?.gainers?.length) {
    gainersText = '\nTop Gainers: ' + t.gainersLosers.gainers.slice(0, 3).map(g => `${g.symbol} ${fmt.pct(g.price_change_percentage_24h)}`).join(', ');
  }
  let losersText = '';
  if (t.gainersLosers?.losers?.length) {
    losersText = '\nTop Losers: ' + t.gainersLosers.losers.slice(0, 3).map(g => `${g.symbol} ${fmt.pct(g.price_change_percentage_24h)}`).join(', ');
  }

  const btcDomChange = y.btcDominance != null ? (t.btcDominance - y.btcDominance).toFixed(1) : '0';
  const fngChange = y.fearGreed != null ? (t.fearGreed - y.fearGreed) : 0;

  const modeDesc = {
    normal: 'Standard professional analysis',
    deep: 'Deep institutional-grade analysis with trend structure, sector rotation, risk scenarios',
    short: 'Give only: trend direction, risk level, and 1 actionable insight. Be extremely concise.',
    emotion: `Analysis must match current market emotion: ${emo.state}. ${emo.tone}`,
  };

  const scenDesc = {
    bullish: 'Assume bullish continuation. Emphasize breakout potential and altseason signals.',
    bearish: 'Assume bearish pressure. Emphasize capital flight to safety and support levels.',
    neutral: 'Balanced view. No directional bias unless data strongly supports it.',
    volatile: 'High volatility expected. Emphasize risk management and wide ranges.',
  };

  return `You are "TradeAgent IV", a professional bilingual crypto market intelligence analyst.

CURRENT MODE: ${mode} — ${modeDesc[mode] || modeDesc.normal}
CURRENT SCENARIO: ${scenario} — ${scenDesc[scenario] || scenDesc.neutral}
MARKET EMOTION: ${emo.state} (Intensity: ${emo.intensity}/100)
REQUIRED TONE: ${emo.tone}

Analyze ONLY the provided data. Do NOT use external information. Do NOT invent support/resistance/price targets.

CRITICAL FORMAT RULES:
- NEVER use markdown syntax like **bold**, *italic*, _, # header, or \`\`\`code\`\`\`.
- Use ONLY Telegram HTML tags: <b> for bold, <i> for italic.
- If you use markdown ** or *, the message will be broken and unreadable.

OUTPUT STRUCTURE — You must output EXACTLY in this format:

First write the FULL ENGLISH ANALYSIS with these sections:
1. <b>Market Overview</b> — 2-3 sentences on overall market condition
2. <b>Bullish Factors</b> — Positive signals from data
3. <b>Bearish Factors</b> — Negative signals from data
4. <b>Risk Factors</b> — What could go wrong
5. <b>Sector Rotation</b> — Which categories are strong/weak
6. <b>Tomorrow Watchlist</b> — Key levels/events to watch
7. <b>Conclusion</b> — 1 sentence summary

Then add this EXACT separator on its own line:
---PERSIAN---

Then write the COMPACT PERSIAN TRANSLATION. Keep it SHORT and DENSE.
Use bullet points (•) only. Each bullet max 1 line. No paragraphs.
Translate EXACTLY — same meaning, same points, no additions, no omissions.

Persian structure:
<b>خلاصه بازار</b>
• [1-line Persian bullet]
• [1-line Persian bullet]
• [1-line Persian bullet]
• [1-line Persian bullet]
• [1-line Persian bullet]
• [1-line Persian bullet]
• [1-line Persian bullet]

RULES:
- English sections in English, Persian section in Persian (Farsi)
- Maximum 700 words total
- Use valid Telegram HTML tags only: <b>, <i>
- Match tone with emotion state
- NEVER contradict the emotion state
- Emphasize risk in FOMO/Panic states
- Emphasize opportunity in Fear states
- Mention funding rates and open interest if abnormal
- Compare 7D/30D trends vs 24h
- End with: "⚠️ This analysis is for informational purposes only and is not financial advice."

TODAY'S DATA:
Date: ${t.date}
Market Cap: ${fmt.cap(t.totalMarketCap)} | Volume 24H: ${fmt.vol(t.totalVolume)}
BTC Dominance: ${t.btcDominance}% ${y.btcDominance != null ? `(change: ${btcDomChange >= 0 ? '+' : ''}${btcDomChange}%)` : ''}
Fear & Greed: ${t.fearGreed}/100 (${t.fearClassification}) ${y.fearGreed != null ? `(change: ${fngChange >= 0 ? '+' : ''}${fngChange})` : ''}

Coins:
${coinChanges.join('\n')}

${futuresText}

${gainersText}
${losersText}

Trending: ${t.trending.map(x => x.item.symbol).join(', ')}

YESTERDAY'S DATA:
${y.date ? `Date: ${y.date}` : 'No historical data'}
${y.btcDominance != null ? `BTC Dominance: ${y.btcDominance}%` : ''}
${y.fearGreed != null ? `Fear & Greed: ${y.fearGreed}/100` : ''}

Write the analysis now.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. SNAPSHOT & CONFIG KV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function storeSnapshot(env, data) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put('snapshot:yesterday', JSON.stringify(data));
  } catch (e) {}
}

async function getSnapshot(env) {
  if (!env.ALERTS_KV) return null;
  try {
    const raw = await env.ALERTS_KV.get('snapshot:yesterday');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

async function getConfig(env, key, def) {
  if (!env.ALERTS_KV) return def;
  try {
    const v = await env.ALERTS_KV.get(`cfg:${key}`);
    return v || def;
  } catch (e) { return def; }
}

async function setConfig(env, key, value) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put(`cfg:${key}`, value);
  } catch (e) {}
}

async function getUserState(env, userId) {
  if (!env.ALERTS_KV) return null;
  try {
    return await env.ALERTS_KV.get(`state:${userId}`);
  } catch (e) { return null; }
}

async function setUserState(env, userId, value) {
  if (!env.ALERTS_KV) return;
  try {
    if (value) await env.ALERTS_KV.put(`state:${userId}`, value);
    else await env.ALERTS_KV.delete(`state:${userId}`);
  } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. DEDUP — v3 FIX (10min Gap + 5min Lock + Race-Proof)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function dedupSend(env, type, fn) {
  if (!env.ALERTS_KV) {
    console.log(`[DEDUP] KV not available, running ${type}`);
    return await fn();
  }
  
  const key = `dedup:send:${type}`;
  const lockKey = `dedup:lock:${type}`;
  const now = Date.now();
  
  try {
    const existing = await env.ALERTS_KV.get(key);
    if (existing) {
      const age = now - parseInt(existing);
      if (age < 600000) {
        console.log(`[DEDUP] Blocked ${type} (age: ${age}ms < 10min)`);
        return;
      }
    }
    
    await env.ALERTS_KV.put(lockKey, now.toString(), { expirationTtl: 300 });
    
    const doubleCheck = await env.ALERTS_KV.get(key);
    if (doubleCheck) {
      const age2 = now - parseInt(doubleCheck);
      if (age2 < 600000) {
        await env.ALERTS_KV.delete(lockKey);
        console.log(`[DEDUP] Race blocked ${type} (age: ${age2}ms)`);
        return;
      }
    }
    
    const result = await fn();
    
    await env.ALERTS_KV.put(key, now.toString(), { expirationTtl: 900 });
    await env.ALERTS_KV.delete(lockKey);
    
    return result;
  } catch (e) {
    console.log(`[DEDUP] Error for ${type}: ${e.message}`);
    try { await env.ALERTS_KV.delete(lockKey); } catch (e2) {}
    throw e;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. TELEGRAM API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// [FIX v4.2.6-FINAL] tgMethod with case-insensitive "not modified" handling
async function tgMethod(token, method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 15000);
      const d = await r.json();
      if (!d.ok) {
        const err = new Error(d.description || `TG ${method} error`);
        err.code = d.error_code; throw err;
      }
      return d;
    } catch (e) {
      // [FIX] Don't retry "not modified" errors — case insensitive
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('not modified')) throw e;
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function sendMessage(env, chatId, text, markup = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (markup) body.reply_markup = markup;
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendMessage', body);
}

async function sendSticker(env, chatId, stickerFileId) {
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendSticker', { chat_id: chatId, sticker: stickerFileId });
}

async function answerCallback(env, queryId, text = null) {
  try {
    const body = { callback_query_id: queryId };
    if (text) body.text = text;
    return await tgMethod(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', body);
  } catch (e) {
    console.log(`[CALLBACK] Silently ignoring: ${e.message}`);
    return null;
  }
}

// [FIX v4.2.6-FINAL] Case-insensitive "not modified" check
async function editMessage(env, chatId, messageId, text, markup = null) {
  try {
    const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (markup) body.reply_markup = markup;
    return await tgMethod(env.TELEGRAM_BOT_TOKEN, 'editMessageText', body);
  } catch (e) {
    const msg = (e.message || '').toLowerCase();
    if (msg.includes('not modified')) {
      console.log(`[EDIT] Ignoring "not modified" for msg ${messageId}`);
      return null;
    }
    throw e;
  }
}

async function getStickerFileId(env) {
  if (!env.ALERTS_KV) return null;
  try {
    const cached = await env.ALERTS_KV.get('sticker:file_id');
    if (cached) {
      console.log('[STICKER] Using cached file_id');
      return cached;
    }
    
    console.log(`[STICKER] Fetching set: ${STICKER_SET_NAME}`);
    const set = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getStickerSet', { name: STICKER_SET_NAME });
    
    if (set.result?.stickers?.length > 0) {
      const fileId = set.result.stickers[0].file_id;
      await env.ALERTS_KV.put('sticker:file_id', fileId, { expirationTtl: 2592000 });
      console.log('[STICKER] Cached new file_id:', fileId.slice(0, 20) + '...');
      return fileId;
    } else {
      console.error('[STICKER] Set exists but empty:', STICKER_SET_NAME);
    }
  } catch (e) {
    console.error(`[STICKER] getStickerSet FAILED: ${e.message} | Set: ${STICKER_SET_NAME}`);
    console.error(`[STICKER] HINT: Bot must be owner/admin of sticker set "${STICKER_SET_NAME}"`);
  }
  return null;
}

async function sendChannelSticker(env) {
  if (!env.TELEGRAM_CHANNEL_ID) {
    console.log('[STICKER] No TELEGRAM_CHANNEL_ID');
    return;
  }
  try {
    const fileId = await getStickerFileId(env);
    if (fileId) {
      await sendSticker(env, env.TELEGRAM_CHANNEL_ID, fileId);
      console.log('[STICKER] Sent sticker to channel');
    } else {
      console.log('[STICKER] No file_id available, skipping');
    }
  } catch (e) {
    console.error('[STICKER] Send error:', e.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14. KEYBOARDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function mainKeyboard(isAdmin) {
  const kb = [
    [{ text: '📊 Prices' }, { text: '📈 Volume' }, { text: '🔥 Trending' }],
    [{ text: '🧠 AI Analysis' }, { text: '🧭 F&G' }, { text: '📉 Market Report' }],
    [{ text: '🚨 Alerts' }, { text: '⚙️ Settings' }, { text: '❓ Help' }],
  ];
  if (isAdmin) kb.push([{ text: '📣 Admin Panel' }]);
  return { keyboard: kb, resize_keyboard: true };
}

function getAdminInline(mode, scenario, autoPosts) {
  const m = AI_MODES[mode] || AI_MODES.normal;
  const s = SCENARIOS[scenario] || SCENARIOS.neutral;
  const autoStatus = autoPosts === 'true' ? '✅ On' : '⏸ Off';
  return {
    inline_keyboard: [
      [
        { text: '📈 Price', callback_data: 'send_price' },
        { text: '📉 Volume', callback_data: 'send_volume' },
        { text: '🧠 AI', callback_data: 'send_ai' },
      ],
      [
        { text: '🔥 Trending', callback_data: 'send_trending' },
        { text: '🧠 F&G', callback_data: 'send_fng' },
        { text: '📊 All', callback_data: 'send_all' },
      ],
      [
        { text: '⚡ Futures', callback_data: 'send_futures' },
        { text: '🚀 Movers', callback_data: 'send_movers' },
      ],
      [{ text: '──── AI Configuration ────', callback_data: 'noop' }],
      [
        { text: `🤖 ${m}`, callback_data: 'admin:ai_mode' },
        { text: `🎛 ${s}`, callback_data: 'admin:scenario' },
      ],
      [
        { text: '🧪 Custom Prompt', callback_data: 'admin:custom' },
        { text: '📤 Resend Last', callback_data: 'admin:resend' },
      ],
      [{ text: '──── System ────', callback_data: 'noop' }],
      [
        { text: '🤖 AI Status', callback_data: 'admin:ai_status' },
        { text: '📊 API Status', callback_data: 'admin:api_status' },
      ],
      [
        { text: `⏸ Auto: ${autoStatus}`, callback_data: 'admin:auto_posts' },
      ],
      [{ text: '🔙 Back to Menu', callback_data: 'back_main' }],
    ],
  };
}

const aiModeInline = {
  inline_keyboard: [
    [{ text: '🤖 Normal', callback_data: 'set_mode:normal' }, { text: '⚡ Deep', callback_data: 'set_mode:deep' }],
    [{ text: '🎯 Short Signal', callback_data: 'set_mode:short' }, { text: '🧠 Emotion', callback_data: 'set_mode:emotion' }],
    [{ text: '🔙 Back to Admin', callback_data: 'admin:page:main' }],
  ],
};

const scenarioInline = {
  inline_keyboard: [
    [{ text: '🚀 Bullish', callback_data: 'set_scenario:bullish' }, { text: '💀 Bearish', callback_data: 'set_scenario:bearish' }],
    [{ text: '⚖️ Neutral', callback_data: 'set_scenario:neutral' }, { text: '🧨 Volatile', callback_data: 'set_scenario:volatile' }],
    [{ text: '🔙 Back to Admin', callback_data: 'admin:page:main' }],
  ],
};

function alertsInline(states) {
  const rows = [];
  for (const [coinId, cfg] of Object.entries(ALERT_PRESETS)) {
    const c = COINS[coinId]; if (!c) continue;
    const aboveKey = `${coinId}:above`, belowKey = `${coinId}:below`;
    const aboveOn = states[aboveKey] ? '🟢' : '⚪️', belowOn = states[belowKey] ? '🔴' : '⚪️';
    rows.push([
      { text: `${aboveOn} ${c.symbol} > $${fmt.price(cfg.above)}`, callback_data: `toggle:${aboveKey}` },
      { text: `${belowOn} ${c.symbol} < $${fmt.price(cfg.below)}`, callback_data: `toggle:${belowKey}` },
    ]);
  }
  rows.push([{ text: '🔙 Back', callback_data: 'back_main' }]);
  return { inline_keyboard: rows };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. MESSAGE BUILDERS — MODERN UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildPrice(coins, source = '') {
  const tier1 = coins.filter(c => COINS[c.id]?.tier === 1);
  const tier2 = coins.filter(c => COINS[c.id]?.tier === 2);
  const tier3 = coins.filter(c => COINS[c.id]?.tier === 3);
  
  let m = `📊 <b>MARKET SNAPSHOT</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${fmt.time()} UTC</i>\n\n`;
  
  if (tier1.length) {
    m += `<b>🏆 Tier 1 — Blue Chips</b>\n<pre>`;
    for (const c of tier1) {
      const i = COINS[c.id];
      const ch = c.price_change_percentage_24h || 0;
      const ch7d = c.price_change_percentage_7d_in_currency || 0;
      const sym = i.symbol.padEnd(6, ' ');
      const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
      const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
      const ch7 = (ch7d >= 0 ? '+' : '') + ch7d.toFixed(1) + '%';
      m += `${sym} ${pr}  ${ch24}  7d:${ch7}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  if (tier2.length) {
    m += `<b>🔷 Tier 2 — Utility</b>\n<pre>`;
    for (const c of tier2) {
      const i = COINS[c.id];
      const ch = c.price_change_percentage_24h || 0;
      const sym = i.symbol.padEnd(6, ' ');
      const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
      const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
      m += `${sym} ${pr}  ${ch24}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  if (tier3.length) {
    m += `<b>🐸 Tier 3 — Meme & AI</b>\n<pre>`;
    for (const c of tier3) {
      const i = COINS[c.id];
      const ch = c.price_change_percentage_24h || 0;
      const sym = i.symbol.padEnd(6, ' ');
      const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
      const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
      m += `${sym} ${pr}  ${ch24}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  m += `${FOOTER}`;
  return m;
}

async function buildVolume(coins, source = '') {
  const sorted = [...coins].sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0));
  
  let m = `📈 <b>VOLUME LEADERS</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${fmt.time()} UTC</i>\n\n<pre>`;
  
  for (const c of sorted.slice(0, 10)) {
    const i = COINS[c.id]; if (!i) continue;
    const vol = c.total_volume || 0;
    const mc = c.market_cap || 0;
    const ratio = mc > 0 ? ((vol / mc) * 100).toFixed(1) : '?';
    const sym = i.symbol.padEnd(6, ' ');
    const volStr = fmt.vol(vol).padStart(12, ' ');
    m += `${sym} Vol:${volStr}  Ratio:${ratio}%\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildDaily(coins, globalData, trending, fear, source = '') {
  const sorted = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const best = sorted[0], worst = sorted[sorted.length - 1];
  
  let m = `📉 <b>DAILY INTELLIGENCE</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${fmt.date()}</i>\n\n`;

  if (globalData?.data) {
    const g = globalData.data;
    m += `<b>🌍 Global Market</b>\n`;
    m += `Cap: ${fmt.cap(g.total_market_cap?.usd || 0)} | Vol: ${fmt.vol(g.total_volume?.usd || 0)} | BTC Dom: ${g.market_cap_percentage?.btc?.toFixed(1) || '?'}%\n\n`;
  }
  
  if (fear?.data?.[0]) {
    const f = fear.data[0], v = parseInt(f.value);
    m += `<b>🧠 Market Sentiment</b>\n`;
    m += `${progressBar(v)} <b>${v}/100</b>\n`;
    m += `${getBias(v)}\n\n`;
  }

  m += `<b>📋 Performance Board</b>\n<pre>`;
  for (const c of sorted) {
    const i = COINS[c.id]; if (!i) continue;
    const ch = c.price_change_percentage_24h || 0;
    const ch7d = c.price_change_percentage_7d_in_currency || 0;
    const sym = i.symbol.padEnd(6, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
    const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
    const ch7 = (ch7d >= 0 ? '+' : '') + ch7d.toFixed(1) + '%';
    let line = `${sym} ${pr}  ${ch24}  7d:${ch7}`;
    if (c.market_cap) line += `  ${fmt.cap(c.market_cap)}`;
    m += line + '\n';
  }
  m += `</pre>\n\n`;

  if (best && COINS[best.id]) {
    m += `<b>🏆 Top Performer</b>\n`;
    m += `${COINS[best.id].emoji} ${COINS[best.id].symbol}  ${fmt.change(best.price_change_percentage_24h)}\n\n`;
  }
  if (worst && COINS[worst.id]) {
    m += `<b>⚠️ Weakest Link</b>\n`;
    m += `${COINS[worst.id].emoji} ${COINS[worst.id].symbol}  ${fmt.change(worst.price_change_percentage_24h)}\n\n`;
  }
  
  if (trending?.coins?.length) {
    m += `<b>🔥 Trending Now</b>\n`;
    for (const t of trending.coins.slice(0, 5)) {
      m += `   ${esc(t.item.symbol)} — ${esc(t.item.name)}\n`;
    }
    m += `\n`;
  }
  
  m += `${FOOTER}`;
  return m;
}

async function buildTrending(trending) {
  let m = `🔥 <b>TRENDING COINS</b>\n`;
  m += `<i>${fmt.time()} UTC</i>\n\n<pre>`;
  
  if (trending?.coins?.length) {
    let rank = 1;
    for (const t of trending.coins.slice(0, 10)) {
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🔹';
      const sym = esc(t.item.symbol).padEnd(6, ' ');
      const rankStr = ('#' + (t.item.market_cap_rank || '?')).padStart(4, ' ');
      m += `${medal} ${sym} ${rankStr}  ${esc(t.item.name)}\n`;
      rank++;
    }
  } else {
    m += `No trending data available.\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildFng(fear) {
  if (!fear?.data?.[0]) {
    return `🧠 <b>FEAR & GREED INDEX</b>\n\n<i>Data unavailable</i>\n\n${FOOTER}`;
  }
  
  const f = fear.data[0], v = parseInt(f.value);
  const classification = f.value_classification || 'Neutral';
  
  const filled = Math.round((v / 100) * 12);
  const bar = '█'.repeat(filled) + '░'.repeat(12 - filled);
  
  let clsEmoji = '⚪';
  let signalText = 'Balanced market sentiment.';
  if (v >= 75) {
    clsEmoji = '🔴';
    signalText = '⚠️ Extreme greed — consider taking profits.';
  } else if (v >= 55) {
    clsEmoji = '🟡';
    signalText = '📊 Greed detected — caution advised, FOMO zone.';
  } else if (v >= 45) {
    clsEmoji = '⚪';
    signalText = '⚖️ Neutral — wait for clear directional move.';
  } else if (v >= 25) {
    clsEmoji = '🟢';
    signalText = '💎 Fear present — potential accumulation zone.';
  } else {
    clsEmoji = '🟢';
    signalText = '🛡️ Extreme fear — historical buying opportunity.';
  }
  
  let m = `🧠 <b>FEAR & GREED INDEX</b>\n`;
  m += `<i>${f.timestamp ? new Date(f.timestamp * 1000).toISOString().slice(0, 10) : fmt.date()}</i>\n\n`;
  
  m += `<pre>${bar} ${v}/100</pre>\n\n`;
  
  m += `<b>${clsEmoji} ${classification.toUpperCase()}</b>\n`;
  m += `<i>${getBias(v)}</i>\n\n`;
  
  m += `<blockquote>${signalText}</blockquote>\n\n`;
  
  m += `<i>Updated: ${fmt.time()} UTC</i>\n\n`;
  m += `${FOOTER}`;
  return m;
}

// [FIX v4.2.6-FINAL] Persian MUST be in <blockquote expandable>
async function buildAIAnalysis(aiResult, todayData, emotion) {
  const t = todayData, emo = emotion || { state: 'NEUTRAL', intensity: 50, emoji: '😐', color: '⚪' };
  
  let englishText = aiResult.text || '';
  let persianText = '';
  
  const separatorIndex = englishText.indexOf('---PERSIAN---');
  if (separatorIndex !== -1) {
    persianText = englishText.substring(separatorIndex + 14).trim();
    englishText = englishText.substring(0, separatorIndex).trim();
  }
  let m = `${emo.emoji} <b>MARKET STATE: ${emo.state}</b>\n`;
  m += `${emo.color} Intensity: ${emo.intensity}/100  ·  ${t.mode || 'Normal'} Mode\n\n`;
  
  m += `🧠 <b>AI MARKET INTELLIGENCE</b>\n`;
  m += `<i>${t.date} · ${aiResult.source || 'AI'} · ${t.mode || 'Normal'}</i>\n\n`;
  
  if (englishText) {
    m += `<blockquote>\n${cleanMarkdown(englishText)}\n</blockquote>\n\n`;
  }
  
  if (persianText) {
    m += `<b>📋 خلاصه بازار</b>\n`;
    m += `<blockquote expandable>\n${cleanMarkdown(persianText)}\n</blockquote>\n\n`;
  }

  m += `<b>📊 Key Metrics</b>\n<pre>`;
  m += `BTC  $${fmt.price(t.btcPrice).padStart(12)}  ${fmt.change(t.btcChange)}\n`;
  m += `ETH  $${fmt.price(t.ethPrice).padStart(12)}  ${fmt.change(t.ethChange)}\n`;
  m += `SOL  $${fmt.price(t.solPrice).padStart(12)}  ${fmt.change(t.solChange)}\n`;
  m += `</pre>\n\n`;

  m += `<b>🌍 Global:</b> Cap ${fmt.cap(t.totalMarketCap)} | Vol ${fmt.vol(t.totalVolume)}\n`;
  m += `<b>₿ Dom:</b> ${t.btcDominance}% | <b>🧠 F&G:</b> ${t.fearGreed}/100\n\n`;

  if (t.futures?.BTCUSDT) {
    const f = t.futures.BTCUSDT;
    m += `<b>⚡ Futures Pulse</b>\n`;
    const parts = [];
    if (f.fundingRate != null) parts.push(`Funding: ${f.fundingRate.toFixed(4)}%`);
    if (f.openInterest != null) parts.push(`OI: ${fmt.vol(f.openInterest)}`);
    if (f.longShortRatio != null) parts.push(`L/S: ${f.longShortRatio.toFixed(2)}`);
    m += parts.join(' | ') + '\n\n';
  }

  m += `${FOOTER}`;
  return m;
}

function buildAlert(coinId, price, type) {
  const i = COINS[coinId];
  const t = type === 'above' ? '🚀 ABOVE TARGET' : '📉 BELOW TARGET';
  return `🚨 <b>PRICE ALERT</b>\n\n<<blockquote>${i.emoji} <b>${esc(i.name)} (${i.symbol})</b>\n${t}\n\nCurrent: <code>$${fmt.price(price)}</code></blockquote>\n\n${FOOTER}`;
}

async function buildFutures(futures) {
  let m = `⚡ <b>FUNDING RATES & FUTURES</b>\n`;
  m += `<i>${fmt.time()} UTC</i>\n\n<pre>`;
  
  for (const [sym, f] of Object.entries(futures)) {
    const coinId = Object.keys(BINANCE_MAP).find(k => BINANCE_MAP[k] === sym);
    const info = coinId ? COINS[coinId] : { symbol: sym.replace('USDT', ''), emoji: '•' };
    const fundingEmoji = f.fundingRate > 0.05 ? '🔴' : f.fundingRate < -0.05 ? '🟢' : '⚪';
    m += `${info.emoji} ${info.symbol.padEnd(6)} `;
    m += `${fundingEmoji} Funding: ${f.fundingRate !== null ? f.fundingRate.toFixed(4) + '%' : 'N/A'} `;
    m += `| OI: ${f.openInterest !== null ? fmt.vol(f.openInterest) : 'N/A'} `;
    m += `| L/S: ${f.longShortRatio !== null ? f.longShortRatio.toFixed(2) : 'N/A'}\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildMovers(gl) {
  if (!gl || (!gl.gainers?.length && !gl.losers?.length)) {
    return `🚀 <b>TOP MOVERS (24H)</b>\n\n<i>No movers data available</i>\n\n${FOOTER}`;
  }
  
  let m = `🚀 <b>TOP MOVERS (24H)</b>\n`;
  m += `<i>${fmt.time()} UTC</i>\n\n`;
  
  if (gl.gainers?.length) {
    m += `<b>🔥 Top Gainers</b>\n<pre>`;
    for (const g of gl.gainers.slice(0, 5)) {
      const sym = (g.symbol || '?').toString().toUpperCase().padEnd(6);
      const chVal = g.price_change_percentage_24h || 0;
      const ch = ((chVal >= 0 ? '+' : '') + chVal.toFixed(2) + '%').padStart(10);
      const price = g.current_price || 0;
      m += `   🟢 ${sym} ${ch}  $${fmt.price(price)}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  if (gl.losers?.length) {
    m += `<b>❄️ Top Losers</b>\n<pre>`;
    for (const l of gl.losers.slice(0, 5)) {
      const sym = (l.symbol || '?').toString().toUpperCase().padEnd(6);
      const chVal = l.price_change_percentage_24h || 0;
      const ch = ((chVal >= 0 ? '+' : '') + chVal.toFixed(2) + '%').padStart(10);
      const price = l.current_price || 0;
      m += `   🔴 ${sym} ${ch}  $${fmt.price(price)}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  m += `${FOOTER}`;
  return m;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 16. ALERTS KV & LOGIC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getAlertState(env, key) {
  if (!env.ALERTS_KV) return false;
  try {
    return (await env.ALERTS_KV.get(`alert:cfg:${key}`)) === '1';
  } catch (e) { return false; }
}

async function setAlertState(env, key, enabled) {
  if (!env.ALERTS_KV) return;
  try {
    if (enabled) await env.ALERTS_KV.put(`alert:cfg:${key}`, '1');
    else await env.ALERTS_KV.delete(`alert:cfg:${key}`);
  } catch (e) {}
}

async function getAlertLast(env, key) {
  if (!env.ALERTS_KV) return null;
  try {
    return await env.ALERTS_KV.get(`alert:last:${key}`);
  } catch (e) { return null; }
}

async function setAlertLast(env, key, val) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put(`alert:last:${key}`, val);
  } catch (e) {}
}

async function clearAlertLast(env, key) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.delete(`alert:last:${key}`);
  } catch (e) {}
}

async function getAllAlertStates(env) {
  const states = {};
  if (!env.ALERTS_KV) return states;
  const promises = [];
  for (const coinId of Object.keys(ALERT_PRESETS)) {
    const cfg = ALERT_PRESETS[coinId];
    if (cfg.above) promises.push(getAlertState(env, `${coinId}:above`).then(v => { states[`${coinId}:above`] = v; }));
    if (cfg.below) promises.push(getAlertState(env, `${coinId}:below`).then(v => { states[`${coinId}:below`] = v; }));
  }
  await Promise.all(promises);
  return states;
}

async function checkAlerts(env, coins) {
  if (!env.ALERTS_KV) return;
  const states = await getAllAlertStates(env);
  for (const c of coins) {
    const cfg = ALERT_PRESETS[c.id];
    if (!cfg) continue;
    for (const dir of ['above', 'below']) {
      const threshold = cfg[dir];
      if (!threshold) continue;
      const key = `${c.id}:${dir}`;
      if (!states[key]) continue;
      const last = await getAlertLast(env, key);
      let triggered = false;
      if (dir === 'above' && c.current_price >= threshold) triggered = true;
      if (dir === 'below' && c.current_price <= threshold) triggered = true;

      if (triggered && last !== 'triggered') {
        await sendMessage(env, env.TELEGRAM_CHANNEL_ID, buildAlert(c.id, c.current_price, dir));
        await setAlertLast(env, key, 'triggered');
      } else if (!triggered && last) {
        await clearAlertLast(env, key);
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17. DATA COLLECTOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function collectMarketData(env) {
  const [{ source, data }, globalData, trending, fear, gainersLosers, categories] = await Promise.all([
    getCoins(env),
    getGlobal(env),
    getTrending(env),
    getFearGreed(),
    getTopGainersLosers(env).catch(e => { console.error('[COLLECT] Movers error:', e.message); return null; }),
    getCategories(env).catch(() => null),
  ]);

  const changes7d = {}, changes30d = {};
  if (env.COINGECKO_API_KEY) {
    const chartCoins = ['bitcoin', 'ethereum', 'solana'];
    await Promise.all(chartCoins.map(async (id) => {
      changes7d[id] = await getMarketChart(id, 7, env);
      changes30d[id] = await getMarketChart(id, 30, env);
    }));
  }

  const futures = {};
  if (env.ENABLE_FUTURES !== 'false') {
    for (const [id, sym] of Object.entries({ bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', solana: 'SOLUSDT' })) {
      futures[sym] = await getBinanceFutures(sym);
    }
  }

  const btc = data.find(c => c.id === 'bitcoin');
  const eth = data.find(c => c.id === 'ethereum');
  const sol = data.find(c => c.id === 'solana');

  const g = globalData?.data || {};
  const f = fear?.data?.[0] || {};
  const fv = parseInt(f.value) || 50;

  return {
    date: fmt.date(), time: fmt.time(), source, coins: data,
    totalMarketCap: g.total_market_cap?.usd || 0,
    totalVolume: g.total_volume?.usd || 0,
    btcDominance: g.market_cap_percentage?.btc || 0,
    fearGreed: fv, fearClassification: f.value_classification || 'Neutral',
    trending: trending?.coins || [],
    btcPrice: btc?.current_price || 0, btcChange: btc?.price_change_percentage_24h || 0,
    ethPrice: eth?.current_price || 0, ethChange: eth?.price_change_percentage_24h || 0,
    solPrice: sol?.current_price || 0, solChange: sol?.price_change_percentage_24h || 0,
    changes7d, changes30d, gainersLosers, categories, futures,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 18. CHANNEL SENDERS — DEDUP v3 + [FIX v4.2.6-FINAL] AI Fallback Bypass Dedup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ensureChannel(env) {
  if (!env.TELEGRAM_CHANNEL_ID) throw new Error('TELEGRAM_CHANNEL_ID not set');
}

async function sendChannelPrice(env) {
  ensureChannel(env);
  await dedupSend(env, 'price', async () => {
    const { source, data } = await getCoins(env);
    await checkAlerts(env, data);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildPrice(data, source));
  });
}

async function sendChannelVolume(env) {
  ensureChannel(env);
  await dedupSend(env, 'volume', async () => {
    const { source, data } = await getCoins(env);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildVolume(data, source));
  });
}

async function sendChannelDaily(env) {
  ensureChannel(env);
  await dedupSend(env, 'daily', async () => {
    const [{ source, data }, globalData, trending, fear] = await Promise.all([
      getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
    ]);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildDaily(data, globalData, trending, fear, source));
  });
}

async function sendChannelTrending(env) {
  ensureChannel(env);
  await dedupSend(env, 'trending', async () => {
    const trending = await getTrending(env);
    if (!trending) {
      await sendMessage(env, env.TELEGRAM_CHANNEL_ID, `🔥 <b>TRENDING COINS</b>\n\n<i>Data unavailable</i>\n\n${FOOTER}`);
      return;
    }
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildTrending(trending));
  });
}

async function sendChannelFng(env) {
  ensureChannel(env);
  await dedupSend(env, 'fng', async () => {
    const fear = await getFearGreed();
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildFng(fear));
  });
}

// [FIX v4.2.6-FINAL] AI fallback bypasses dedup — sends Daily Report directly if AI fails
async function sendChannelAI(env, customPrompt = null) {
  ensureChannel(env);
  await dedupSend(env, 'ai', async () => {
    const mode = await getConfig(env, 'ai_mode', 'normal');
    const scenario = await getConfig(env, 'scenario', 'neutral');

    const today = await collectMarketData(env);
    const yesterday = await getSnapshot(env);

    const yesterdayMarketCap = yesterday?.totalMarketCap || today.totalMarketCap;
    today.yesterdayMarketCap = yesterdayMarketCap;
    today.btcDominanceChange = today.btcDominance - (yesterday?.btcDominance || today.btcDominance);
    const emotion = calculateEmotionState(today);
    today.mode = mode;

    let aiResult;
    if (customPrompt) {
      const fullPrompt = `${customPrompt}\n\nDATA:\n${JSON.stringify(today, null, 2)}`;
      aiResult = await getAIAnalysis(env, fullPrompt);
    } else {
      const prompt = buildAIPrompt(today, yesterday, mode, scenario, emotion);
      aiResult = await getAIAnalysis(env, prompt);
    }

    // [FIX v4.2.6-FINAL] Fallback to Daily Report if AI completely fails — BYPASS DEDUP
    if (!aiResult) {
      console.log('[AI] Analysis failed, falling back to Daily Report (bypass dedup)');
      try {
        const [{ source, data }, globalData, trending, fear] = await Promise.all([
          getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
        ]);
        await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildDaily(data, globalData, trending, fear, source));
      } catch (e) {
        console.error('[AI] Fallback daily also failed:', e.message);
      }
      return;
    }

    if (env.ALERTS_KV) {
      try {
        await env.ALERTS_KV.put('last:ai_result', JSON.stringify(aiResult));
        await env.ALERTS_KV.put('last:today', JSON.stringify(today));
        await env.ALERTS_KV.put('last:emotion', JSON.stringify(emotion));
      } catch (e) {}
    }

    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildAIAnalysis(aiResult, today, emotion));
    await storeSnapshot(env, today);
  });
}

async function sendChannelFutures(env) {
  ensureChannel(env);
  await dedupSend(env, 'futures', async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const futures = {};
    for (const sym of symbols) {
      futures[sym] = await getBinanceFutures(sym);
    }
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildFutures(futures));
  });
}

async function sendChannelMovers(env) {
  ensureChannel(env);
  await dedupSend(env, 'movers', async () => {
    console.log('[MOVERS] Starting send...');
    const gl = await getTopGainersLosers(env);
    console.log('[MOVERS] Data:', gl ? `G:${gl.gainers?.length} L:${gl.losers?.length}` : 'null');
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildMovers(gl));
  });
}

async function sendWithTimeout(fn, env, name, timeoutMs = 35000) {
  return Promise.race([
    fn(env),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} timeout after ${timeoutMs}ms`)), timeoutMs))
  ]);
}

// [FIX v4.2.6-FINAL] Sticker FIRST, then posts with 2s gap
async function sendChannelAll(env, ctx) {
  await dedupSend(env, 'all_bundle', async () => {
    // 1. STICKER FIRST
    try {
      await sendChannelSticker(env);
      console.log('[SEND ALL] ✅ Sticker sent first');
    } catch (e) {
      console.error('[SEND ALL] ❌ Sticker failed:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
    
    // 2. Then other posts
    const results = [];
    const senders = [
      { name: 'Price', fn: sendChannelPrice }, 
      { name: 'Volume', fn: sendChannelVolume },
      { name: 'AI Daily', fn: sendChannelAI }, 
      { name: 'Trending', fn: sendChannelTrending },
      { name: 'F&G', fn: sendChannelFng }, 
      { name: 'Futures', fn: sendChannelFutures },
      { name: 'Movers', fn: sendChannelMovers },
    ];
    for (const s of senders) {
      try { 
        await sendWithTimeout(s.fn, env, s.name, 35000);
        results.push(`✅ ${s.name}`); 
      }
      catch (e) { 
        results.push(`❌ ${s.name}: ${e.message}`); 
      }
    }
    console.log('[SEND ALL]\n' + results.join('\n'));
    if (results.every(r => r.startsWith('❌'))) throw new Error('All sends failed');
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 19. BOT HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleStart(chatId, userId, env) {
  const admin = isAdmin(userId, env);
  const text = admin
    ? `👋 <b>Welcome Admin!</b>\n\nTradeAgent IV Control Panel.`
    : `👋 <b>Welcome to TradeAgent IV!</b>\n\nAI Crypto Intelligence Dashboard.`;
  await sendMessage(env, chatId, text, mainKeyboard(admin));
}

async function handlePrices(chatId, env) {
  const { source, data } = await getCoins(env);
  await sendMessage(env, chatId, await buildPrice(data, source));
}

async function handleVolume(chatId, env) {
  const { source, data } = await getCoins(env);
  await sendMessage(env, chatId, await buildVolume(data, source));
}

async function handleDaily(chatId, env) {
  const [{ source, data }, globalData, trending, fear] = await Promise.all([
    getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
  ]);
  await sendMessage(env, chatId, await buildDaily(data, globalData, trending, fear, source));
}

async function handleTrending(chatId, env) {
  const trending = await getTrending(env);
  if (!trending) {
    await sendMessage(env, chatId, `🔥 <b>TRENDING COINS</b>\n\n<i>Data unavailable</i>\n\n${FOOTER}`);
    return;
  }
  await sendMessage(env, chatId, await buildTrending(trending));
}

async function handleFng(chatId, env) {
  const fear = await getFearGreed();
  await sendMessage(env, chatId, await buildFng(fear));
}

async function handleAlerts(chatId, env) {
  const states = await getAllAlertStates(env);
  let text = `🚨 <b>Price Alert Settings</b>\n\nToggle alerts for target prices:\n\n`;
  for (const [coinId, cfg] of Object.entries(ALERT_PRESETS)) {
    const c = COINS[coinId];
    text += `${c.emoji} <b>${c.symbol}</b>\n`;
    if (cfg.above) text += `   Above: $${fmt.price(cfg.above)}\n`;
    if (cfg.below) text += `   Below: $${fmt.price(cfg.below)}\n`;
    text += `\n`;
  }
  await sendMessage(env, chatId, text, alertsInline(states));
}

async function handleSettings(chatId, env) {
  const sources = [];
  if (env.COINGECKO_API_KEY) sources.push('CoinGecko');
  if (env.CMC_API_KEY) sources.push('CoinMarketCap');
  sources.push('Binance');
  
  const aiStatus = env.GEMINI_API_KEY ? '✅ Gemini' : '⚠️ Off';
  const orStatus = env.OPENROUTER_API_KEY ? '✅ OpenRouter' : '⚠️ Off';
  const mode = await getConfig(env, 'ai_mode', 'normal');
  const scenario = await getConfig(env, 'scenario', 'neutral');
  const autoPosts = await getConfig(env, 'auto_posts', 'true');

  await sendMessage(env, chatId,
    `⚙️ <b>Settings</b>\n\n` +
    `Channel: ${env.TELEGRAM_CHANNEL_ID || 'Not set'}\n` +
    `Coins: ${Object.keys(COINS).length} (T1:${Object.keys(TIER_1).length} T2:${Object.keys(TIER_2).length} T3:${Object.keys(TIER_3).length})\n` +
    `Sources: ${sources.join(', ')}\n` +
    `AI: ${aiStatus} | ${orStatus}\n` +
    `Mode: ${AI_MODES[mode]} | Scenario: ${SCENARIOS[scenario]}\n` +
    `Auto Posts: ${autoPosts === 'true' ? 'On' : 'Off'}\n\n` +
    `Use /admin for admin panel.`
  );
}

async function showAdminPanel(chatId, env) {
  const mode = await getConfig(env, 'ai_mode', 'normal');
  const scenario = await getConfig(env, 'scenario', 'neutral');
  const autoPosts = await getConfig(env, 'auto_posts', 'true');
  await sendMessage(env, chatId, `📣 <b>Admin Control Panel</b>\n\nManage posts, AI config, and system status:`, getAdminInline(mode, scenario, autoPosts));
}

async function handleHelp(chatId, env, userId) {
  const admin = isAdmin(userId, env);
  let text = `📖 <b>TradeAgent IV Commands</b>\n\n`;
  text += `/start — Main menu\n`;
  text += `/price — Live prices\n`;
  text += `/volume — Volume leaders\n`;
  text += `/daily — Daily report\n`;
  text += `/marketreport — Daily market report (alias)\n`;
  text += `/trending — Hot coins\n`;
  text += `/fng — Fear & Greed index\n`;
  text += `/feargreed — Fear & Greed (alias)\n`;
  text += `/fg — Fear & Greed (short alias)\n`;
  text += `/alerts — Alert settings\n`;
  text += `/settings — Bot config\n`;
  text += `/help — This menu\n`;
  
  if (admin) {
    text += `\n<b>Admin Commands:</b>\n`;
    text += `/admin — Admin panel\n`;
    text += `/sendprice — Send snapshot to channel\n`;
    text += `/sendvolume — Send volume to channel\n`;
    text += `/sendai — Send AI analysis to channel\n`;
    text += `/senddaily — Send daily report to channel\n`;
    text += `/sendfutures — Send funding rates to channel\n`;
    text += `/sendmovers — Send top movers to channel\n`;
    text += `/sendall — Send everything to channel\n`;
    text += `/aiprompt — Custom AI prompt\n`;
  }
  await sendMessage(env, chatId, text);
}

async function handleAIStatus(chatId, env) {
  const geminiTest = await testGeminiConnection(env);
  const lastProvider = await getConfig(env, 'last_ai_provider', 'Unknown');
  const lastTime = await getConfig(env, 'last_ai_time', 'Never');
  
  let text = `🤖 <b>AI System Status</b>\n\n`;
  text += `<b>Gemini 2.5 Flash:</b> ${geminiTest.ok ? '✅ Active' : `⚠️ ${geminiTest.error}`}\n`;
  text += `<b>OpenRouter:</b> ${env.OPENROUTER_API_KEY ? '✅ Configured' : '⚠️ No Key'}\n`;
  text += `<b>Last Provider:</b> ${lastProvider}\n`;
  text += `<b>Last Analysis:</b> ${lastTime}\n`;
  text += `\nUse /debug for full API diagnostics.`;
  await sendMessage(env, chatId, text);
}

async function handleAPIStatus(chatId, env) {
  const checks = [];
  try { const cg = await getCoinsCG(env); checks.push(`CoinGecko: ${cg ? '✅' : '⚠️'}`); } catch(e) { checks.push(`CoinGecko: ❌`); }
  try { const bin = await getCoinsBinance(); checks.push(`Binance: ${bin ? '✅' : '⚠️'}`); } catch(e) { checks.push(`Binance: ❌`); }
  try { const f = await getBinanceFutures('BTCUSDT'); checks.push(`Futures: ${f.fundingRate != null ? '✅' : '⚠️'}`); } catch(e) { checks.push(`Futures: ❌`); }
  try { const fng = await getFearGreed(); checks.push(`F&G: ${fng?.data ? '✅' : '⚠️'}`); } catch(e) { checks.push(`F&G: ❌`); }
  try { const mov = await getTopGainersLosers(env); checks.push(`Movers: ${mov ? '✅' : '⚠️'}`); } catch(e) { checks.push(`Movers: ❌`); }
  
  let text = `📊 <b>API Health Check</b>\n\n${checks.join('\n')}\n\nUse /debug for detailed report.`;
  await sendMessage(env, chatId, text);
}

async function handleAutoPosts(chatId, env, msgId = null) {
  const current = await getConfig(env, 'auto_posts', 'true');
  const newVal = current === 'true' ? 'false' : 'true';
  await setConfig(env, 'auto_posts', newVal);
  const statusText = `⏸ <b>Auto Posts</b>\n\nStatus: ${newVal === 'true' ? '✅ Enabled' : '⏸ Disabled'}\n\nCron jobs will ${newVal === 'true' ? 'run normally' : 'be skipped'}.`;
  
  if (msgId) {
    const mode = await getConfig(env, 'ai_mode', 'normal');
    const scenario = await getConfig(env, 'scenario', 'neutral');
    await editMessage(env, chatId, msgId, statusText, getAdminInline(mode, scenario, newVal));
  } else {
    await sendMessage(env, chatId, statusText);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 20. WEBHOOK PROCESSOR — FIXED COMMAND ROUTING + KEYBOARD EMOJI VARIANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function processWebhook(update, env, ctx) {
  try {
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text || '';

      const state = await getUserState(env, userId);
      if (state === 'awaiting_prompt' && text !== '/cancel') {
        await setUserState(env, userId, null);
        await sendMessage(env, chatId, '⏳ Processing custom prompt...');
        try {
          await sendChannelAI(env, text);
          await sendMessage(env, chatId, '✅ Custom AI analysis sent to channel!');
        } catch (e) {
          await sendMessage(env, chatId, `❌ Error: ${esc(e.message)}`);
        }
        return;
      }
      if (state === 'awaiting_prompt' && text === '/cancel') {
        await setUserState(env, userId, null);
        await sendMessage(env, chatId, '❌ Cancelled.');
        return;
      }

      console.log(`[BOT] ${userId}: ${text}`);

      if (text === '/start') await handleStart(chatId, userId, env);
      else if (text === '/price' || text === '📊 Prices') await handlePrices(chatId, env);
      else if (text === '/volume' || text === '📈 Volume') await handleVolume(chatId, env);
      else if (text === '/daily' || text === '📉 Market Report' || text === '📈 Market Report' || text === '/marketreport') await handleDaily(chatId, env);
      else if (text === '/trending' || text === '🔥 Trending') await handleTrending(chatId, env);
      else if (text === '/fng' || text === '🧭 F&G' || text === '🧠 F&G' || text === '/feargreed' || text === '/fg') await handleFng(chatId, env);
      else if (text === '/alerts' || text === '🚨 Alerts') await handleAlerts(chatId, env);
      else if (text === '/settings' || text === '⚙️ Settings') await handleSettings(chatId, env);
      else if (text === '/help' || text === '❓ Help') await handleHelp(chatId, env, userId);
      else if (text === '/admin' || text === '📣 Admin Panel') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ <b>Access Denied</b>'); return; }
        await showAdminPanel(chatId, env);
      }
      else if (text === '/sendprice') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending snapshot...'); await sendChannelPrice(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendvolume') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending volume...'); await sendChannelVolume(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendai') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Generating AI analysis...'); 
        try {
          await sendChannelAI(env); 
          await sendMessage(env, chatId, '✅ Done!');
        } catch (e) {
          await sendMessage(env, chatId, `❌ AI Failed: ${esc(e.message)}`);
        }
      }
      else if (text === '/senddaily') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending daily report...'); await sendChannelDaily(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendfutures') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending futures...'); await sendChannelFutures(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendmovers') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending movers...'); await sendChannelMovers(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendall') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending all reports...'); 
        try {
          await sendChannelAll(env, ctx); 
          await sendMessage(env, chatId, '✅ All done! Sticker sent first.');
        } catch (e) {
          await sendMessage(env, chatId, `❌ Error: ${esc(e.message)}`);
        }
      }
      else if (text.startsWith('/aiprompt')) {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        const prompt = text.replace('/aiprompt', '').trim();
        if (!prompt) {
          await sendMessage(env, chatId, '🧪 <b>Custom AI Prompt</b>\n\nEnter your prompt below, or use /cancel.\n\nExample: "Focus on Ethereum staking flows and macro correlation"');
          await setUserState(env, userId, 'awaiting_prompt');
          return;
        }
        await sendMessage(env, chatId, '⏳ Processing...');
        try {
          await sendChannelAI(env, prompt);
          await sendMessage(env, chatId, '✅ Custom AI sent to channel!');
        } catch (e) {
          await sendMessage(env, chatId, `❌ AI Failed: ${esc(e.message)}`);
        }
      }
      else {
        await sendMessage(env, chatId, '❓ Unknown command. Use /help for available commands.');
      }
    }

    if (update.callback_query) {
      const q = update.callback_query;
      const chatId = q.message.chat.id;
      const userId = q.from.id;
      const data = q.data;
      const msgId = q.message.message_id;

      await answerCallback(env, q.id);

      if (data === 'noop') return;

      if (data.startsWith('send_')) {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending to channel...');
        try {
          if (data === 'send_price') await sendChannelPrice(env);
          if (data === 'send_volume') await sendChannelVolume(env);
          if (data === 'send_ai') await sendChannelAI(env);
          if (data === 'send_trending') await sendChannelTrending(env);
          if (data === 'send_fng') await sendChannelFng(env);
          if (data === 'send_all') await sendChannelAll(env, ctx);
          if (data === 'send_futures') await sendChannelFutures(env);
          if (data === 'send_movers') await sendChannelMovers(env);
          const mode = await getConfig(env, 'ai_mode', 'normal');
          const scenario = await getConfig(env, 'scenario', 'neutral');
          const autoPosts = await getConfig(env, 'auto_posts', 'true');
          await editMessage(env, chatId, msgId, `✅ <b>Sent!</b>\n🕒 ${fmt.time()}`, getAdminInline(mode, scenario, autoPosts));
        } catch (e) {
          const mode = await getConfig(env, 'ai_mode', 'normal');
          const scenario = await getConfig(env, 'scenario', 'neutral');
          const autoPosts = await getConfig(env, 'auto_posts', 'true');
          await editMessage(env, chatId, msgId, `❌ <b>Error:</b> ${esc(e.message)}`, getAdminInline(mode, scenario, autoPosts));
        }
        return;
      }

      if (data === 'admin:ai_mode') {
        if (!isAdmin(userId, env)) return;
        await editMessage(env, chatId, msgId, `🤖 <b>Select AI Mode</b>\n\nCurrent: ${AI_MODES[await getConfig(env, 'ai_mode', 'normal')]}`, aiModeInline);
        return;
      }

      if (data === 'admin:scenario') {
        if (!isAdmin(userId, env)) return;
        await editMessage(env, chatId, msgId, `🎛 <b>Select Scenario</b>\n\nCurrent: ${SCENARIOS[await getConfig(env, 'scenario', 'neutral')]}`, scenarioInline);
        return;
      }

      if (data.startsWith('set_mode:')) {
        if (!isAdmin(userId, env)) return;
        const mode = data.replace('set_mode:', '');
        await setConfig(env, 'ai_mode', mode);
        const scenario = await getConfig(env, 'scenario', 'neutral');
        const autoPosts = await getConfig(env, 'auto_posts', 'true');
        await editMessage(env, chatId, msgId, `📣 <b>Admin Panel</b>\n\n✅ AI Mode: <b>${AI_MODES[mode]}</b>`, getAdminInline(mode, scenario, autoPosts));
        return;
      }

      if (data.startsWith('set_scenario:')) {
        if (!isAdmin(userId, env)) return;
        const scenario = data.replace('set_scenario:', '');
        await setConfig(env, 'scenario', scenario);
        const mode = await getConfig(env, 'ai_mode', 'normal');
        const autoPosts = await getConfig(env, 'auto_posts', 'true');
        await editMessage(env, chatId, msgId, `📣 <b>Admin Panel</b>\n\n✅ Scenario: <b>${SCENARIOS[scenario]}</b>`, getAdminInline(mode, scenario, autoPosts));
        return;
      }

      if (data === 'admin:custom') {
        if (!isAdmin(userId, env)) return;
        await sendMessage(env, chatId, '🧪 <b>Custom AI Prompt</b>\n\nEnter your prompt below, or use /cancel.\n\nExample: "Focus on Ethereum staking flows and macro correlation"');
        await setUserState(env, userId, 'awaiting_prompt');
        return;
      }

      if (data === 'admin:resend') {
        if (!isAdmin(userId, env)) return;
        await sendMessage(env, chatId, '⏳ Resending last AI analysis...');
        try {
          const lastResult = env.ALERTS_KV ? JSON.parse(await env.ALERTS_KV.get('last:ai_result') || 'null') : null;
          const lastToday = env.ALERTS_KV ? JSON.parse(await env.ALERTS_KV.get('last:today') || 'null') : null;
          const lastEmotion = env.ALERTS_KV ? JSON.parse(await env.ALERTS_KV.get('last:emotion') || 'null') : null;
          if (lastResult && lastToday) {
            await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildAIAnalysis(lastResult, lastToday, lastEmotion));
            await sendMessage(env, chatId, '✅ Resent to channel!');
          } else {
            await sendMessage(env, chatId, '⚠️ No previous analysis found.');
          }
        } catch (e) {
          await sendMessage(env, chatId, `❌ Error: ${esc(e.message)}`);
        }
        return;
      }

      if (data === 'admin:ai_status') {
        if (!isAdmin(userId, env)) return;
        await handleAIStatus(chatId, env);
        return;
      }

      if (data === 'admin:api_status') {
        if (!isAdmin(userId, env)) return;
        await handleAPIStatus(chatId, env);
        return;
      }

      if (data === 'admin:auto_posts') {
        if (!isAdmin(userId, env)) return;
        await handleAutoPosts(chatId, env, msgId);
        return;
      }

      if (data === 'admin:page:main') {
        if (!isAdmin(userId, env)) return;
        const mode = await getConfig(env, 'ai_mode', 'normal');
        const scenario = await getConfig(env, 'scenario', 'neutral');
        const autoPosts = await getConfig(env, 'auto_posts', 'true');
        await editMessage(env, chatId, msgId, `📣 <b>Admin Control Panel</b>\n\nManage posts, AI config, and system status:`, getAdminInline(mode, scenario, autoPosts));
        return;
      }

      if (data.startsWith('toggle:')) {
        const key = data.replace('toggle:', '');
        const current = await getAlertState(env, key);
        await setAlertState(env, key, !current);
        const states = await getAllAlertStates(env);
        await editMessage(env, chatId, msgId, `🚨 <b>Alert Settings</b>\n\nUpdated!`, alertsInline(states));
        return;
      }

      if (data === 'back_main') {
        const admin = isAdmin(userId, env);
        await sendMessage(env, chatId, '👋 <b>Main Menu</b>', mainKeyboard(admin));
      }
    }
  } catch (err) {
    console.error('[BOT] CRASH:', err.message);
    try {
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) await sendMessage(env, chatId, `❌ <b>Error:</b> ${esc(err.message)}`);
    } catch (e) {}
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 21. CRON HANDLER — [FIX v4.2.6-FINAL] Sticker FIRST in bundle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleCron(event, env) {
  const cron = event.cron;
  console.log(`[CRON] Triggered: ${cron}`);
  
  try {
    const autoPosts = await getConfig(env, 'auto_posts', 'true');
    if (autoPosts !== 'true') {
      console.log(`[CRON] Auto-posts disabled, skipping ${cron}`);
      return;
    }
    
    if (cron === CRON_PRICE) {
      console.log('[CRON] Price + Alerts (30min)');
      await sendChannelPrice(env);
    }
    else if (cron === CRON_BUNDLE) {
      console.log('[CRON] Bundle: Sticker + AI + F&G + Funding (8h)');
      // [FIX v4.2.6-FINAL] Sticker FIRST
      try {
        await sendChannelSticker(env);
        console.log('[CRON] ✅ Sticker sent first');
      } catch (e) {
        console.error(`[CRON] ❌ Sticker: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 2000));
      
      const tasks = [
        { name: 'AI', fn: sendChannelAI, delay: 0 },
        { name: 'F&G', fn: sendChannelFng, delay: 5000 },
        { name: 'Futures', fn: sendChannelFutures, delay: 10000 },
      ];
      for (const task of tasks) {
        if (task.delay > 0) await new Promise(r => setTimeout(r, task.delay));
        try {
          await task.fn(env);
          console.log(`[CRON] ✅ ${task.name}`);
        } catch (e) {
          console.error(`[CRON] ❌ ${task.name}: ${e.message}`);
        }
      }
    }
    else if (cron === CRON_MOVERS) {
      console.log('[CRON] Top Movers (09:00/15:00/21:00 UTC)');
      await sendChannelMovers(env);
    }
    else {
      console.log(`[CRON] Unknown pattern: ${cron}`);
    }
  } catch (err) {
    console.error(`[CRON ERROR] ${cron}: ${err.message}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 22. HTTP ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleWebhookReq(request, env, ctx) {
  try {
    const update = await request.json();
    if (update?.update_id) {
      await processWebhook(update, env, ctx);
      return new Response('OK', { status: 200 });
    }
    return new Response('Not a Telegram update', { status: 200 });
  } catch (e) {
    console.error('[WEBHOOK] Parse error:', e.message);
    return new Response('OK', { status: 200 });
  }
}

async function routeAdmin(request, env, ctx) {
  if (!checkSecret(request, env)) {
    return new Response('Forbidden: x-admin-secret header missing or invalid', { status: 403 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'price';
  try {
    if (type === 'price') await sendChannelPrice(env);
    if (type === 'volume') await sendChannelVolume(env);
    if (type === 'daily') await sendChannelDaily(env);
    if (type === 'ai') await sendChannelAI(env);
    if (type === 'trending') await sendChannelTrending(env);
    if (type === 'fng') await sendChannelFng(env);
    if (type === 'futures') await sendChannelFutures(env);
    if (type === 'movers') await sendChannelMovers(env);
    if (type === 'all') await sendChannelAll(env, ctx);
    if (type === 'alert') {
      const { data } = await getCoins(env);
      await checkAlerts(env, data);
    }
    if (type === 'sticker') {
      await sendChannelSticker(env);
    }
    return new Response('✅ Sent!', { status: 200 });
  } catch (e) {
    return new Response(`❌ ${e.message}`, { status: 500 });
  }
}

async function handleDebug(env) {
  const checks = {
    has_token: !!env.TELEGRAM_BOT_TOKEN,
    has_channel: !!env.TELEGRAM_CHANNEL_ID,
    has_admin_id: !!env.ADMIN_ID,
    has_admin_secret: !!env.ADMIN_SECRET,
    has_kv: !!env.ALERTS_KV,
    has_coingecko_key: !!env.COINGECKO_API_KEY,
    has_cmc_key: !!env.CMC_API_KEY,
    has_gemini_key: !!env.GEMINI_API_KEY,
    has_openrouter_key: !!env.OPENROUTER_API_KEY,
    token_preview: env.TELEGRAM_BOT_TOKEN ? env.TELEGRAM_BOT_TOKEN.slice(0, 10) + '...' : 'MISSING',
    channel_id: env.TELEGRAM_CHANNEL_ID || 'MISSING',
    admin_id: env.ADMIN_ID || 'MISSING',
    coin_count: Object.keys(COINS).length,
    tier1: Object.keys(TIER_1).length,
    tier2: Object.keys(TIER_2).length,
    tier3: Object.keys(TIER_3).length,
    version: '4.2.6-FINAL',
  };

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID) {
    try {
      const me = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getMe', {});
      const member = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getChatMember', { chat_id: env.TELEGRAM_CHANNEL_ID, user_id: me.result.id });
      checks.channel_access = member.result.status;
      checks.can_post = ['administrator', 'creator'].includes(member.result.status);
    } catch (e) {
      checks.channel_access = `ERROR: ${e.message}`;
      checks.can_post = false;
    }
  }

  for (const [name, fn] of [['coingecko', getCoinsCG], ['cmc', getCoinsCMC], ['binance', getCoinsBinance]]) {
    try {
      const r = name === 'binance' ? await fn() : await fn(env);
      checks[`${name}_status`] = r ? `✅ OK (${r.length || (r.data ? r.data.length : '?')} items)` : '⚠️ No Key';
    } catch (e) { checks[`${name}_status`] = `❌ ${e.message}`; }
  }

  const geminiTest = await testGeminiConnection(env);
  checks.gemini_status = geminiTest.ok ? `✅ ${geminiTest.source}` : `⚠️ ${geminiTest.error}`;

  try {
    const f = await getBinanceFutures('BTCUSDT');
    checks.futures_status = f.fundingRate != null ? `✅ OK (Funding: ${f.fundingRate.toFixed(4)}%)` : '⚠️ No data';
  } catch (e) { checks.futures_status = `❌ ${e.message}`; }

  try {
    const fng = await getFearGreed();
    checks.fng_status = fng?.data ? `✅ OK (${fng.data[0].value}/100)` : '⚠️ No data';
  } catch (e) { checks.fng_status = `❌ ${e.message}`; }

  try {
    const movers = await getTopGainersLosers(env);
    checks.movers_status = movers ? `✅ OK (G:${movers.gainers?.length || 0} L:${movers.losers?.length || 0})` : '⚠️ No data';
  } catch (e) { checks.movers_status = `❌ ${e.message}`; }

  try {
    const stickerId = await getStickerFileId(env);
    checks.sticker_status = stickerId ? `✅ OK (${stickerId.slice(0, 20)}...)` : '⚠️ No sticker cached';
  } catch (e) { checks.sticker_status = `❌ ${e.message}`; }

  return new Response(JSON.stringify(checks, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleHttp(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  console.log(`[HTTP] ${request.method} ${path}`);

  if (path === '/webhook' && request.method === 'POST') return handleWebhookReq(request, env, ctx);
  if (path === '/admin' && request.method === 'POST') return routeAdmin(request, env, ctx);
  if (path === '/debug' && request.method === 'GET') {
    if (!checkSecret(request, env)) {
      return new Response('Forbidden: x-admin-secret required', { status: 403 });
    }
    return handleDebug(env);
  }
  if (path === '/' && request.method === 'GET') {
    return new Response(
      `TradeAgent IV HYBRID v4.2.6-FINAL — AI-Powered Crypto Intelligence\n\n` +
      `Backend: v4.2 (3-Tier, Emotion, Futures, HYPE, Dedup v3, Modern UI)\n` +
      `UI: Collapsible Persian (blockquote expandable) + Gemini Priority + Updated Commands\n\n` +
      `Routes:\n` +
      `  POST /webhook  → Telegram webhook\n` +
      `  POST /admin    → Manual trigger (x-admin-secret required)\n` +
      `  GET  /debug    → Status check + API tests (admin secret required)\n\n` +
      `Cron: ${CRON_PRICE}, ${CRON_BUNDLE}, ${CRON_MOVERS}\n` +
      `Coins: ${Object.keys(COINS).length} (T1:${Object.keys(TIER_1).length} T2:${Object.keys(TIER_2).length} T3:${Object.keys(TIER_3).length})\n` +
      `AI: Gemini 2.5 Flash (primary) → Gemini 2.0 → Gemini 1.5 → OpenRouter :FREE\n` +
      `Movers: Binance 24h ticker (no CMC required)\n` +
      `Dedup: v3 (10min gap + 5min lock + race-proof)\n` +
      `F&G: Modern visual bar + signal interpretation\n` +
      `Persian: Collapsible <blockquote expandable> (no flag)\n` +
      `Sticker: Auto-send after bundle via getStickerSet\n` +
      `Timeout: All fetches capped at 15-25s to prevent hangs\n` +
      `SendAll/Cron: Sticker FIRST, then posts with 2s gap\n` +
      `AI Fail: Falls back to Daily Report directly (bypass dedup)\n` +
      `EditMsg: "not modified" errors ignored silently (case-insensitive)\n` +
      `Cost: 100% FREE — All AI models use :free tier or Gemini free tier\n`,
      { status: 200 }
    );
  }
  return new Response('Not Found', { status: 404 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 23. EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleHttp(request, env, ctx);
    } catch (err) {
      console.error('[FETCH] FATAL:', err.message);
      return new Response(`❌ ERROR: ${err.message}\n\n📍 STACK:\n${err.stack}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(event, env).catch(e => console.error('[CRON] ERROR:', e)));
  },
};
