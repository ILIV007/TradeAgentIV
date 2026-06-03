// ═══════════════════════════════════════════════════════════════
//  TRADEAGENT IV ULTIMATE — AI-Powered Crypto Intelligence
//  Routes: /webhook | /admin (GET/POST) | /debug
//  AI: Gemini 2.0 Flash Lite + OpenRouter Failover (DeepSeek/Qwen)
//  Emotion Engine: Panic → Fear → Neutral → Momentum → Breakout → FOMO
// ═══════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COINS = {
  bitcoin:           { symbol: 'BTC', emoji: '₿',   name: 'Bitcoin' },
  ethereum:          { symbol: 'ETH', emoji: 'Ξ',   name: 'Ethereum' },
  solana:            { symbol: 'SOL', emoji: '◎',   name: 'Solana' },
  binancecoin:       { symbol: 'BNB', emoji: '🔶',  name: 'BNB' },
  ripple:            { symbol: 'XRP', emoji: '✕',   name: 'XRP' },
  'the-open-network':{ symbol: 'TON', emoji: '💎',  name: 'Toncoin' },
};

const COIN_IDS   = Object.keys(COINS).join(',');
const CRON_PRICE = '*/30 * * * *';
const CRON_AI    = '0 15 * * *';   // 15:00 UTC = 18:30 Iran (Daylight) / 19:30 Iran (Standard)
const CRON_FNG   = '0 21 * * *';   // 21:00 UTC = 00:30 Iran+1d

const ALERT_PRESETS = {
  bitcoin:  { above: 110000, below: 95000 },
  ethereum: { above: 4500,   below: 3200 },
  solana:   { above: 250,    below: 180 },
};

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const BINANCE_MAP = {
  bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT', ripple: 'XRPUSDT', 'the-open-network': 'TONUSDT',
};

const SYMBOL_TO_ID = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  BNB: 'binancecoin', XRP: 'ripple', TON: 'the-open-network',
};

const CMC_SYMBOLS = 'BTC,ETH,SOL,BNB,XRP,TON';
const FOOTER = `<blockquote>📡 <b>TradeAgent IV</b>\n<i>AI Crypto Intelligence</i>\n@TradeAgentIV</blockquote>`;

const AI_MODES = { normal: 'Normal', deep: 'Deep', short: 'Short', emotion: 'Emotion' };
const SCENARIOS = { bullish: 'Bullish', bearish: 'Bearish', neutral: 'Neutral', volatile: 'Volatile' };
const EMOTION_STATES = {
  PANIC:    { emoji: '💀🚨', tone: 'Short, serious warnings. Market is panicking. Focus on capital preservation and risk.' },
  FEAR:     { emoji: '😰🧊', tone: 'Conservative. Market is fearful but accumulation opportunities exist. Highlight opportunities.' },
  NEUTRAL:  { emoji: '😐',   tone: 'Neutral, factual. Market is sideways. Provide balanced analysis.' },
  MOMENTUM: { emoji: '🔥📈', tone: 'Analytical and optimistic. Upside momentum building. Highlight opportunities.' },
  BREAKOUT: { emoji: '🚀⚡', tone: 'Controlled excitement. Price breakout confirmed. Confirm trend strength but warn of pullback risk.' },
  FOMO:     { emoji: '🧨📊', tone: 'Warning with urgency. Market is in extreme greed. Emphasize FOMO risk and danger of entry at highs.' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. SECURITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isAdmin(userId, env) {
  return String(userId) === String(env.ADMIN_ID);
}

function checkSecret(request, env) {
  return request.headers.get('x-admin-secret') === env.ADMIN_SECRET;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. UTILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function esc(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const fmt = {
  price: (n) => {
    if (!n) return '$0.00';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 1)    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
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
  if (v >= 75) return '😱 Extreme Greed — 🔴 Caution';
  if (v >= 55) return '😊 Greed — 🟡 FOMO Zone';
  if (v >= 45) return '😐 Neutral — 🟢 Balanced';
  if (v >= 25) return '😰 Fear — 🟢 Accumulation';
  return '😨 Extreme Fear — 🟢 Opportunity';
}

function progressBar(value, max = 100, blocks = 10) {
  const filled = Math.round((value / max) * blocks);
  return '🟩'.repeat(filled) + '⬜'.repeat(blocks - filled);
}

function getShortModelName(fullName) {
  if (!fullName) return 'AI';
  const lower = fullName.toLowerCase();
  if (lower.includes('gemini')) return 'Gemini';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('qwen')) return 'Qwen';
  return fullName;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. EMOTION ENGINE
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
// 5. API HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function api(url, opts = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        ...opts,
        headers: { Accept: 'application/json', 'User-Agent': 'TradeAgentIV/2.0', ...opts.headers },
      });
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
// 6. PRICE API — FAILOVER: CG → CMC → Binance → CoinCap
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizeCG(coins) {
  return coins.map(c => ({
    id: c.id, current_price: c.current_price,
    price_change_percentage_24h: c.price_change_percentage_24h,
    total_volume: c.total_volume, market_cap: c.market_cap,
  }));
}

function normalizeCMC(data) {
  const result = [];
  for (const coin of Object.values(data.data || {})) {
    const id = SYMBOL_TO_ID[coin.symbol];
    if (!id) continue;
    const q = coin.quote?.USD || {};
    result.push({ id, current_price: q.price || 0, price_change_percentage_24h: q.percent_change_24h || 0, total_volume: q.volume_24h || 0, market_cap: q.market_cap || 0 });
  }
  return result;
}

function normalizeBinance(data) {
  return data.map(b => {
    const id = Object.keys(BINANCE_MAP).find(k => BINANCE_MAP[k] === b.symbol);
    const price = parseFloat(b.lastPrice);
    return { id, current_price: price, price_change_percentage_24h: parseFloat(b.priceChangePercent), total_volume: parseFloat(b.volume) * price, market_cap: 0 };
  });
}

function normalizeCoinCap(data) {
  const result = []; const allowed = new Set(Object.keys(COINS));
  for (const asset of data.data || []) {
    if (!allowed.has(asset.id)) continue;
    result.push({ id: asset.id, current_price: parseFloat(asset.priceUsd) || 0, price_change_percentage_24h: parseFloat(asset.changePercent24Hr) || 0, total_volume: parseFloat(asset.volumeUsd24Hr) || 0, market_cap: parseFloat(asset.marketCapUsd) || 0 });
  }
  return result;
}

async function getCoinsCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
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

async function getCoinsCoinCap() {
  return normalizeCoinCap(await api(`https://api.coincap.io/v2/assets?limit=50`));
}

async function getCoins(env) {
  try { const cg = await getCoinsCG(env); if (cg?.length) return { source: 'CoinGecko', data: cg }; } catch (e) { console.error('[API] CG fail:', e.message); }
  try { const cmc = await getCoinsCMC(env); if (cmc?.length) return { source: 'CoinMarketCap', data: cmc }; } catch (e) { console.error('[API] CMC fail:', e.message); }
  try { const bin = await getCoinsBinance(); if (bin?.length) return { source: 'Binance', data: bin }; } catch (e) { console.error('[API] Binance fail:', e.message); }
  try { const cc = await getCoinsCoinCap(); if (cc?.length) return { source: 'CoinCap', data: cc }; } catch (e) { console.error('[API] CoinCap fail:', e.message); }
  throw new Error('All price APIs failed');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. ENHANCED DATA: Top Gainers, Categories, Charts, Futures
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getTopGainersLosers(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  try {
    const data = await api(`${COINGECKO_BASE}/coins/top_gainers_losers?vs_currency=usd&duration=24h`, { headers: { 'x-cg-demo-api-key': key } });
    return { gainers: (data.top_gainers || []).slice(0, 5), losers: (data.top_losers || []).slice(0, 5) };
  } catch (e) { console.error('[API] Gainers fail:', e.message); return null; }
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
// 8. GLOBAL & TRENDING — FAILOVER
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
  return { data: { total_market_cap: { usd: q.total_market_cap || 0 }, total_volume: { usd: q.total_volume_24h || 0 }, market_cap_percentage: { btc: data.data?.btc_dominance || 0 } } };
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

function getFearGreed() {
  return api('https://api.alternative.me/fng/?limit=1');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. AI LAYER — GEMINI + OPENROUTER FAILOVER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getAIAnalysis(env, prompt) {
  if (env.GEMINI_API_KEY) {
    try {
      const res = await api(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 800 } }),
      });
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text: text.trim(), source: 'Gemini' };
    } catch (e) { console.error('[AI] Gemini fail:', e.message); }
  }

  if (!env.OPENROUTER_API_KEY) return null;

  const models = [
    'google/gemini-2.5-flash-preview-05-20',
    'deepseek/deepseek-chat',
    'qwen/qwen-2.5-72b-instruct',
  ];

  for (const model of models) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tradeagent.iv',
          'X-Title': 'TradeAgent IV',
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.3 }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return { text: text.trim(), source: getShortModelName(model) };
    } catch (e) { console.error(`[AI] ${model} fail:`, e.message); }
  }

  return null;
}

async function testGeminiConnection(env) {
  if (!env.GEMINI_API_KEY) return { ok: false, error: 'No API key' };
  try {
    const res = await api(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 }
      })
    });
    const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.toLowerCase().includes('ok')) return { ok: true, source: 'Gemini' };
    return { ok: false, error: 'Unexpected response' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function buildAIPrompt(today, yesterday, mode, scenario, emotion) {
  const t = today, y = yesterday || {};
  const emo = emotion || { state: 'NEUTRAL', intensity: 50, tone: 'Neutral, factual.' };

  const coinChanges = [];
  for (const c of t.coins) {
    const yc = y.coins?.find(x => x.id === c.id);
    const ch24 = c.price_change_percentage_24h || 0;
    const ch7d = t.changes7d?.[c.id] || 0;
    const ch30d = t.changes30d?.[c.id] || 0;
    const info = COINS[c.id];
    coinChanges.push(`${info.symbol}: $${fmt.price(c.current_price)} | 24h: ${fmt.pct(ch24)} | 7d: ${fmt.pct(ch7d)} | 30d: ${fmt.pct(ch30d)} | Vol: ${fmt.vol(c.total_volume)}`);
  }

  let futuresText = '';
  if (t.futures) {
    for (const [sym, f] of Object.entries(t.futures)) {
      if (f.fundingRate != null || f.openInterest != null) {
        futuresText += `\n${sym}: Funding: ${f.fundingRate !== null ? f.fundingRate.toFixed(4) + '%' : 'N/A'} | OI: ${f.openInterest !== null ? fmt.vol(f.openInterest) : 'N/A'} | L/S: ${f.longShortRatio !== null ? f.longShortRatio.toFixed(2) : 'N/A'}`;
      }
    }
  }

  let gainersText = '';
  if (t.gainersLosers?.gainers?.length) {
    gainersText = '\nTop Gainers: ' + t.gainersLosers.gainers.slice(0, 3).map(g => `${g.symbol} ${fmt.pct(g.price_change_percentage_24h)}`).join(', ');
  }
  let losersText = '';
  if (t.gainersLosers?.losers?.length) {
    losersText = '\nTop Losers: ' + t.gainersLosers.losers.slice(0, 3).map(g => `${g.symbol} ${fmt.pct(g.price_change_percentage_24h)}`).join(', ');
  }

  let catText = '';
  if (t.categories?.length) {
    catText = '\nCategory Performance:\n' + t.categories.map(c => `  ${c.name}: ${fmt.pct(c.change)}`).join('\n');
  }

  const btcDomChange = y.btcDominance ? (t.btcDominance - y.btcDominance).toFixed(1) : '0';
  const fngChange = y.fearGreed ? (t.fearGreed - y.fearGreed) : 0;

  const modeDesc = {
    normal: 'Standard professional analysis',
    deep: 'Deep institutional-grade analysis with trend structure, sector rotation, risk scenarios, and institutional behavior',
    short: 'Give only: trend direction, risk level, and 1 actionable insight. Be extremely concise.',
    emotion: `Analysis must match the current market emotion: ${emo.state}. ${emo.tone}`,
  };

  const scenDesc = {
    bullish: 'Assume bullish continuation. Emphasize breakout potential and altseason signals.',
    bearish: 'Assume bearish pressure. Emphasize capital flight to safety and support levels.',
    neutral: 'Balanced view. No directional bias unless data strongly supports it.',
    volatile: 'High volatility expected. Emphasize risk management and wide ranges.',
  };

  return `You are "TradeAgent IV", a professional English-speaking crypto market intelligence analyst.

CURRENT MODE: ${mode} — ${modeDesc[mode] || modeDesc.normal}
CURRENT SCENARIO: ${scenario} — ${scenDesc[scenario] || scenDesc.neutral}
MARKET EMOTION: ${emo.state} (Intensity: ${emo.intensity}/100)
REQUIRED TONE: ${emo.tone}

Analyze ONLY the provided data. Do NOT use external information. Do NOT invent support/resistance/price targets. Do NOT use markdown (*, _, #).

OUTPUT STRUCTURE:
1. <b>Market Overview</b> — 2-3 sentences on overall market condition
2. <b>Bullish Factors</b> — Positive signals from data
3. <b>Bearish Factors</b> — Negative signals from data
4. <b>Risk Factors</b> — What could go wrong
5. <b>Sector Rotation</b> — Which categories are strong/weak
6. <b>Tomorrow Watchlist</b> — Key levels/events to watch
7. <b>Conclusion</b> — 1 sentence summary

RULES:
- Write in English
- Maximum 500 words
- Use valid Telegram HTML tags only: <b>, <i>, <blockquote>
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
BTC Dominance: ${t.btcDominance}% ${y.btcDominance ? `(change: ${btcDomChange >= 0 ? '+' : ''}${btcDomChange}%)` : ''}
Fear & Greed: ${t.fearGreed}/100 (${t.fearClassification}) ${y.fearGreed ? `(change: ${fngChange >= 0 ? '+' : ''}${fngChange})` : ''}

Coins:
${coinChanges.join('\n')}

${futuresText}

${gainersText}
${losersText}

Trending: ${t.trending.map(x => x.item.symbol).join(', ')}

${catText}

YESTERDAY'S DATA:
${y.date ? `Date: ${y.date}` : 'No historical data'}
${y.btcDominance ? `BTC Dominance: ${y.btcDominance}%` : ''}
${y.fearGreed ? `Fear & Greed: ${y.fearGreed}/100` : ''}

Write the analysis now.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. SNAPSHOT KV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function storeSnapshot(env, data) {
  if (!env.ALERTS_KV) return;
  await env.ALERTS_KV.put('snapshot:yesterday', JSON.stringify(data));
}

async function getSnapshot(env) {
  if (!env.ALERTS_KV) return null;
  const raw = await env.ALERTS_KV.get('snapshot:yesterday');
  return raw ? JSON.parse(raw) : null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. CONFIG KV HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getConfig(env, key, def) {
  if (!env.ALERTS_KV) return def;
  const v = await env.ALERTS_KV.get(`cfg:${key}`);
  return v || def;
}

async function setConfig(env, key, value) {
  if (!env.ALERTS_KV) return;
  await env.ALERTS_KV.put(`cfg:${key}`, value);
}

async function getUserState(env, userId) {
  if (!env.ALERTS_KV) return null;
  return env.ALERTS_KV.get(`state:${userId}`);
}

async function setUserState(env, userId, value) {
  if (!env.ALERTS_KV) return;
  if (value) await env.ALERTS_KV.put(`state:${userId}`, value);
  else await env.ALERTS_KV.delete(`state:${userId}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. TELEGRAM API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function tgMethod(token, method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!d.ok) {
        const err = new Error(d.description || `TG ${method} error`);
        err.code = d.error_code; throw err;
      }
      return d;
    } catch (e) {
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

async function answerCallback(env, queryId, text = null) {
  const body = { callback_query_id: queryId };
  if (text) body.text = text;
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', body);
}

async function editMessage(env, chatId, messageId, text, markup = null) {
  const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (markup) body.reply_markup = markup;
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'editMessageText', body);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. KEYBOARDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function mainKeyboard(isAdmin) {
  const kb = [
    [{ text: '📊 Prices' }, { text: '📈 Market Report' }],
    [{ text: '🔥 Trending' }, { text: '🧠 F&G' }],
    [{ text: '🚨 Alerts' }, { text: '⚙️ Settings' }],
  ];
  if (isAdmin) kb.push([{ text: '📣 Admin Panel' }]);
  return { keyboard: kb, resize_keyboard: true };
}

function getAdminInline(mode, scenario) {
  const m = AI_MODES[mode] || AI_MODES.normal;
  const s = SCENARIOS[scenario] || SCENARIOS.neutral;
  return {
    inline_keyboard: [
      [{ text: '📈 Send Price', callback_data: 'send_price' }, { text: '📉 Send Volume', callback_data: 'send_volume' }],
      [{ text: '🧠 Send AI', callback_data: 'send_ai' }, { text: '🔥 Send Trending', callback_data: 'send_trending' }],
      [{ text: '🧠 Send F&G', callback_data: 'send_fng' }, { text: '📊 Send All', callback_data: 'send_all' }],
      [{ text: '──── AI Config ────', callback_data: 'noop' }],
      [{ text: `🤖 Mode: ${m}`, callback_data: 'admin:ai_mode' }],
      [{ text: `🎛 Scenario: ${s}`, callback_data: 'admin:scenario' }],
      [{ text: '🧪 Custom Prompt', callback_data: 'admin:custom' }, { text: '📤 Resend Last', callback_data: 'admin:resend' }],
      [{ text: '🔙 Back', callback_data: 'back_main' }],
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
// 14. MESSAGE BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildPrice(coins, source = '') {
  let m = `📊 <b>LIVE MARKET</b>${source ? ` <i>via ${esc(source)}</i>` : ''}\n\n<pre>`;
  for (const c of coins) {
    const i = COINS[c.id]; if (!i) continue;
    const ch = c.price_change_percentage_24h || 0;
    const sym = i.symbol.padEnd(4, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(10, ' ');
    const chStr = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(8, ' ');
    m += `${sym} ${pr}  ${chStr}\n`;
  }
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildVolume(coins, source = '') {
  let m = `📈 <b>VOLUME REPORT</b>${source ? ` <i>via ${esc(source)}</i>` : ''}\n\n<pre>`;
  for (const c of coins) {
    const i = COINS[c.id]; if (!i) continue;
    const sym = i.symbol.padEnd(4, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(10, ' ');
    const vol = fmt.vol(c.total_volume).padStart(10, ' ');
    let line = `${sym} ${pr}  Vol:${vol}`;
    if (c.market_cap) line += `  Cap:${fmt.cap(c.market_cap)}`;
    m += line + '\n';
  }
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildDaily(coins, globalData, trending, fear, source = '') {
  const sorted = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const best = sorted[0], worst = sorted[sorted.length - 1];
  let m = `📉 <b>DAILY INTELLIGENCE</b>${source ? ` <i>via ${esc(source)}</i>` : ''}\n\n`;

  if (globalData?.data) {
    const g = globalData.data;
    m += `🌍 <b>Global</b>\nCap: ${fmt.cap(g.total_market_cap?.usd || 0)} | Vol: ${fmt.vol(g.total_volume?.usd || 0)} | BTC Dom: ${g.market_cap_percentage?.btc?.toFixed(1) || '?'}%\n\n`;
  }
  if (fear?.data?.[0]) {
    m += `🧠 <b>Sentiment</b>\n${getBias(parseInt(fear.data[0].value))}\n\n`;
  }

  m += `<pre>`;
  for (const c of sorted) {
    const i = COINS[c.id]; if (!i) continue;
    const ch = c.price_change_percentage_24h || 0;
    const sym = i.symbol.padEnd(4, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(10, ' ');
    const chStr = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(8, ' ');
    let line = `${sym} ${pr}  ${chStr}`;
    if (c.market_cap) line += `  ${fmt.cap(c.market_cap)}`;
    m += line + '\n';
  }
  m += `</pre>\n\n`;

  if (best && COINS[best.id]) m += `🏆 <b>Leader</b>\n${COINS[best.id].emoji} ${COINS[best.id].symbol}  ${fmt.change(best.price_change_percentage_24h)}\n\n`;
  if (worst && COINS[worst.id]) m += `⚠️ <b>Weakest</b>\n${COINS[worst.id].emoji} ${COINS[worst.id].symbol}  ${fmt.change(worst.price_change_percentage_24h)}\n\n`;
  if (trending?.coins?.length) {
    m += `🔥 <b>Trending</b>\n`;
    for (const t of trending.coins.slice(0, 3)) m += `   ${esc(t.item.symbol)} — ${esc(t.item.name)}\n`;
    m += `\n`;
  }
  m += `${FOOTER}`;
  return m;
}

async function buildTrending(trending) {
  let m = `🔥 <b>TRENDING COINS</b>\n\n`;
  if (trending?.coins?.length) {
    m += `<pre>`;
    for (const t of trending.coins.slice(0, 10)) {
      const sym = esc(t.item.symbol).padEnd(6, ' ');
      const rank = ('#' + (t.item.market_cap_rank || '?')).padStart(4, ' ');
      m += `${sym} ${rank}  ${esc(t.item.name)}\n`;
    }
    m += `</pre>\n\n`;
  } else {
    m += `No trending data available.\n\n`;
  }
  m += `${FOOTER}`;
  return m;
}

async function buildFng(fear) {
  if (!fear?.data?.[0]) return `🧠 <b>MARKET SENTIMENT</b>\n\nData unavailable.\n\n${FOOTER}`;
  const f = fear.data[0], v = parseInt(f.value);
  return `🧠 <b>MARKET SENTIMENT</b>\n\n${progressBar(v)} <b>${v}/100</b>\n${getBias(v)}\n\n${FOOTER}`;
}

async function buildAIAnalysis(aiResult, todayData, emotion) {
  const t = todayData, emo = emotion || { state: 'NEUTRAL', intensity: 50, emoji: '😐' };
  let m = `${emo.emoji} <b>MARKET STATE: ${emo.state}</b> | Intensity: ${emo.intensity}/100\n\n`;
  m += `🧠 <b>AI MARKET INTELLIGENCE</b>\n`;
  m += `<i>${t.date} • ${aiResult.source || 'AI'} • ${t.mode || 'Normal'} Mode</i>\n\n`;
  m += `<blockquote>\n${aiResult.text}\n</blockquote>\n\n`;

  m += `<pre>`;
  m += `BTC  $${fmt.price(t.btcPrice)}  ${fmt.change(t.btcChange)}\n`;
  m += `ETH  $${fmt.price(t.ethPrice)}  ${fmt.change(t.ethChange)}\n`;
  m += `SOL  $${fmt.price(t.solPrice)}  ${fmt.change(t.solChange)}\n`;
  m += `</pre>\n\n`;

  m += `🌍 Cap: ${fmt.cap(t.totalMarketCap)} | Vol: ${fmt.vol(t.totalVolume)}\n`;
  m += `₿ Dom: ${t.btcDominance}% | 🧠 F&G: ${t.fearGreed}/100\n\n`;

  if (t.futures?.BTCUSDT) {
    const f = t.futures.BTCUSDT;
    m += `📊 <b>Futures</b>\n`;
    if (f.fundingRate != null) m += `Funding: ${f.fundingRate.toFixed(4)}%\n`;
    if (f.openInterest != null) m += `OI: ${fmt.vol(f.openInterest)}\n`;
    if (f.longShortRatio != null) m += `L/S Ratio: ${f.longShortRatio.toFixed(2)}\n`;
    m += `\n`;
  }

  m += `${FOOTER}`;
  return m;
}

function buildAlert(coinId, price, type) {
  const i = COINS[coinId];
  const t = type === 'above' ? '🚀 ABOVE' : '📉 BELOW';
  return `🚨 <b>${esc(i.symbol)} ALERT</b>\n\n${i.emoji} ${esc(i.name)}\n<b>${t}</b> target!\n\nCurrent: $${fmt.price(price)}\n\n${FOOTER}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. KV HELPERS — ALERTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getAlertState(env, key) {
  if (!env.ALERTS_KV) return false;
  return (await env.ALERTS_KV.get(`alert:cfg:${key}`)) === '1';
}

async function setAlertState(env, key, enabled) {
  if (!env.ALERTS_KV) return;
  if (enabled) await env.ALERTS_KV.put(`alert:cfg:${key}`, '1');
  else await env.ALERTS_KV.delete(`alert:cfg:${key}`);
}

async function getAlertLast(env, key) {
  if (!env.ALERTS_KV) return null;
  return env.ALERTS_KV.get(`alert:last:${key}`);
}

async function setAlertLast(env, key, val) {
  if (!env.ALERTS_KV) return;
  await env.ALERTS_KV.put(`alert:last:${key}`, val);
}

async function clearAlertLast(env, key) {
  if (!env.ALERTS_KV) return;
  await env.ALERTS_KV.delete(`alert:last:${key}`);
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 16. CORE LOGIC — ALERTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
// 17. DATA COLLECTOR (Enhanced)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function collectMarketData(env) {
  const [{ source, data }, globalData, trending, fear, gainersLosers, categories] = await Promise.all([
    getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
    getTopGainersLosers(env).catch(() => null),
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
    for (const [id, sym] of Object.entries({ bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT' })) {
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
// 18. CHANNEL SENDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ensureChannel(env) {
  if (!env.TELEGRAM_CHANNEL_ID) throw new Error('TELEGRAM_CHANNEL_ID not set');
}

async function sendChannelPrice(env) {
  ensureChannel(env);
  const { source, data } = await getCoins(env);
  await checkAlerts(env, data);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildPrice(data, source));
}

async function sendChannelVolume(env) {
  ensureChannel(env);
  const { source, data } = await getCoins(env);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildVolume(data, source));
}

async function sendChannelDaily(env) {
  ensureChannel(env);
  const [{ source, data }, globalData, trending, fear] = await Promise.all([
    getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
  ]);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildDaily(data, globalData, trending, fear, source));
}

async function sendChannelTrending(env) {
  ensureChannel(env);
  const trending = await getTrending(env);
  if (!trending) {
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, `🔥 <b>TRENDING COINS</b>\n\nTrending data unavailable.\n\n${FOOTER}`);
    return;
  }
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildTrending(trending));
}

async function sendChannelFng(env) {
  ensureChannel(env);
  const fear = await getFearGreed();
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildFng(fear));
}

async function sendChannelAI(env, customPrompt = null) {
  ensureChannel(env);
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

  if (!aiResult) {
    console.log('[AI] All AI sources failed, falling back to daily');
    await sendChannelDaily(env);
    return;
  }

  if (env.ALERTS_KV) {
    await env.ALERTS_KV.put('last:ai_result', JSON.stringify(aiResult));
    await env.ALERTS_KV.put('last:today', JSON.stringify(today));
    await env.ALERTS_KV.put('last:emotion', JSON.stringify(emotion));
  }

  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildAIAnalysis(aiResult, today, emotion));
  await storeSnapshot(env, today);
}

async function sendChannelAll(env) {
  const results = [];
  const senders = [
    { name: 'Price', fn: sendChannelPrice }, { name: 'Volume', fn: sendChannelVolume },
    { name: 'AI Daily', fn: sendChannelAI }, { name: 'Trending', fn: sendChannelTrending },
    { name: 'F&G', fn: sendChannelFng },
  ];
  for (const s of senders) {
    try { await s.fn(env); results.push(`✅ ${s.name}`); }
    catch (e) { results.push(`❌ ${s.name}: ${e.message}`); }
  }
  console.log('[SEND ALL]\n' + results.join('\n'));
  if (results.every(r => r.startsWith('❌'))) throw new Error('All sends failed');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 19. BOT HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleStart(chatId, userId, env) {
  const admin = isAdmin(userId, env);
  const text = admin ? `👋 <b>Welcome Admin!</b>\n\nTradeAgent IV Ultimate Control Panel.` : `👋 <b>Welcome to TradeAgent IV!</b>\n\nAI Crypto Intelligence Dashboard.`;
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
    await sendMessage(env, chatId, `🔥 <b>TRENDING COINS</b>\n\nTrending data unavailable.\n\n${FOOTER}`);
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
  let text = `🚨 <b>Alert Settings</b>\n\nToggle alerts on/off:\n\n`;
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
  sources.push('Binance', 'CoinCap');
  const aiStatus = env.GEMINI_API_KEY ? '✅ Gemini' : '⚠️ Off';
  const orStatus = env.OPENROUTER_API_KEY ? '✅ OpenRouter' : '⚠️ Off';
  const mode = await getConfig(env, 'ai_mode', 'normal');
  const scenario = await getConfig(env, 'scenario', 'neutral');

  await sendMessage(env, chatId, `⚙️ <b>Settings</b>\n\nChannel: ${env.TELEGRAM_CHANNEL_ID || 'Not set'}\nSources: ${sources.join(', ')}\nAI: ${aiStatus} | ${orStatus}\nMode: ${AI_MODES[mode]}\nScenario: ${SCENARIOS[scenario]}\n\nUse /admin for admin panel.`);
}

async function showAdminPanel(chatId, env) {
  const mode = await getConfig(env, 'ai_mode', 'normal');
  const scenario = await getConfig(env, 'scenario', 'neutral');
  await sendMessage(env, chatId, `📣 <b>Admin Panel</b>\n\nChoose action or configure AI:`, getAdminInline(mode, scenario));
}

async function handleHelp(chatId, env, userId) {
  const admin = isAdmin(userId, env);
  let text = `📖 <b>Commands</b>\n\n/start — Main menu\n/price — Live prices\n/volume — Volume report\n/daily — Daily report\n/trending — Trending coins\n/fng — Market Sentiment\n/alerts — Alert settings\n/settings — Bot settings\n/aiprompt — Custom AI prompt (admin)\n`;
  if (admin) {
    text += `\n<b>Admin Commands:</b>\n/admin — Admin panel\n/sendprice — Send price to channel\n/sendvolume — Send volume to channel\n/sendai — Send AI analysis to channel\n/senddaily — Send daily to channel\n/sendall — Send everything to channel\n/aiprompt — Custom AI prompt\n`;
  }
  await sendMessage(env, chatId, text);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 20. WEBHOOK PROCESSOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function processWebhook(update, env) {
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
      else if (text === '/volume' || text === '📈 Market Report') await handleVolume(chatId, env);
      else if (text === '/daily') await handleDaily(chatId, env);
      else if (text === '/trending' || text === '🔥 Trending') await handleTrending(chatId, env);
      else if (text === '/fng' || text === '🧠 F&G') await handleFng(chatId, env);
      else if (text === '/alerts' || text === '🚨 Alerts') await handleAlerts(chatId, env);
      else if (text === '/settings' || text === '⚙️ Settings') await handleSettings(chatId, env);
      else if (text === '/help') await handleHelp(chatId, env, userId);
      else if (text === '/admin' || text === '📣 Admin Panel') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ <b>Forbidden</b>'); return; }
        await showAdminPanel(chatId, env);
      }
      else if (text === '/sendprice') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending...'); await sendChannelPrice(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendvolume') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending...'); await sendChannelVolume(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendai') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Generating AI...'); await sendChannelAI(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/senddaily') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending...'); await sendChannelDaily(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendall') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending all...'); await sendChannelAll(env); await sendMessage(env, chatId, '✅ Done!');
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
        await sendChannelAI(env, prompt);
        await sendMessage(env, chatId, '✅ Custom AI sent to channel!');
      }
      else {
        await sendMessage(env, chatId, '❓ Unknown command. Use /help.');
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
          if (data === 'send_all') await sendChannelAll(env);
          await editMessage(env, chatId, msgId, `✅ <b>Sent!</b>\n🕒 ${fmt.time()}`, getAdminInline(await getConfig(env, 'ai_mode', 'normal'), await getConfig(env, 'scenario', 'neutral')));
        } catch (e) {
          await editMessage(env, chatId, msgId, `❌ <b>Error:</b> ${esc(e.message)}`, getAdminInline(await getConfig(env, 'ai_mode', 'normal'), await getConfig(env, 'scenario', 'neutral')));
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
        await editMessage(env, chatId, msgId, `📣 <b>Admin Panel</b>\n\n✅ AI Mode set to: <b>${AI_MODES[mode]}</b>`, getAdminInline(mode, await getConfig(env, 'scenario', 'neutral')));
        return;
      }

      if (data.startsWith('set_scenario:')) {
        if (!isAdmin(userId, env)) return;
        const scenario = data.replace('set_scenario:', '');
        await setConfig(env, 'scenario', scenario);
        await editMessage(env, chatId, msgId, `📣 <b>Admin Panel</b>\n\n✅ Scenario set to: <b>${SCENARIOS[scenario]}</b>`, getAdminInline(await getConfig(env, 'ai_mode', 'normal'), scenario));
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
            await sendMessage(env, chatId, '✅ Resent!');
          } else {
            await sendMessage(env, chatId, '⚠️ No previous analysis found.');
          }
        } catch (e) {
          await sendMessage(env, chatId, `❌ Error: ${esc(e.message)}`);
        }
        return;
      }

      if (data === 'admin:page:main') {
        if (!isAdmin(userId, env)) return;
        await editMessage(env, chatId, msgId, `📣 <b>Admin Panel</b>\n\nChoose action:`, getAdminInline(await getConfig(env, 'ai_mode', 'normal'), await getConfig(env, 'scenario', 'neutral')));
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
// 21. CRON HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleCron(event, env) {
  const cron = event.cron;
  try {
    if (cron.includes('price') || cron === CRON_PRICE) await sendChannelPrice(env);
    else if (cron.includes('ai') || cron === CRON_AI) await sendChannelAI(env);
    else if (cron.includes('fng') || cron === CRON_FNG) await sendChannelFng(env);
    else await sendChannelPrice(env);
  } catch (err) {
    console.error(`[CRON ERROR] ${cron}: ${err.message}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 22. HTTP ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleWebhook(request, env) {
  try {
    const update = await request.json();
    if (update?.update_id) {
      await processWebhook(update, env);
      return new Response('OK', { status: 200 });
    }
    return new Response('Not a Telegram update', { status: 200 });
  } catch (e) {
    console.error('[WEBHOOK] Parse error:', e.message);
    return new Response('OK', { status: 200 });
  }
}

async function routeAdmin(request, env) {
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
    if (type === 'all') await sendChannelAll(env);
    if (type === 'alert') {
      const { data } = await getCoins(env);
      await checkAlerts(env, data);
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

  for (const [name, fn] of [['coingecko', getCoinsCG], ['cmc', getCoinsCMC], ['binance', getCoinsBinance], ['coincap', getCoinsCoinCap]]) {
    try {
      const r = name === 'binance' || name === 'coincap' ? await fn() : await fn(env);
      checks[`${name}_status`] = r ? `✅ OK (${r.length || (r.data ? r.data.length : '?')} items)` : '⚠️ No Key';
    } catch (e) { checks[`${name}_status`] = `❌ ${e.message}`; }
  }

  const geminiTest = await testGeminiConnection(env);
  checks.gemini_status = geminiTest.ok ? `✅ ${geminiTest.source}` : `❌ ${geminiTest.error}`;

  try {
    const f = await getBinanceFutures('BTCUSDT');
    checks.futures_status = f.fundingRate != null ? `✅ OK (Funding: ${f.fundingRate.toFixed(4)}%)` : '⚠️ No data';
  } catch (e) { checks.futures_status = `❌ ${e.message}`; }

  return new Response(JSON.stringify(checks, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleHttp(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  console.log(`[HTTP] ${request.method} ${path}`);

  if (path === '/webhook' && request.method === 'POST') return handleWebhook(request, env);
  if (path === '/admin' && (request.method === 'POST' || request.method === 'GET')) return routeAdmin(request, env);
  if (path === '/debug' && request.method === 'GET') return handleDebug(env);
  if (path === '/' && request.method === 'GET') {
    return new Response(
      `TradeAgent IV ULTIMATE — AI-Powered Crypto Intelligence\n\nRoutes:\n  POST /webhook  → Telegram webhook\n  POST|GET /admin → Manual trigger (x-admin-secret required)\n  GET  /debug    → Status check + API tests\n\nCron: ${CRON_PRICE}, ${CRON_AI}, ${CRON_FNG}\nAI Failover: Gemini → OpenRouter (Gemini/DeepSeek/Qwen)\n`,
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
      return await handleHttp(request, env);
    } catch (err) {
      console.error('[FETCH] FATAL:', err.message);
      return new Response(`❌ ERROR: ${err.message}\n\n📍 STACK:\n${err.stack}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(event, env).catch(e => console.error('[CRON] ERROR:', e)));
  },
};
