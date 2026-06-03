// ═══════════════════════════════════════════════════════════════
//  TRADEAGENT IV PRO — AI-Powered Crypto Intelligence
//  Routes: /webhook | /admin (GET/POST) | /debug
//  AI: Gemini 2.0 Flash Lite (Free Tier)
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
const CRON_AI    = '0 15 * * *';
const CRON_FNG   = '0 21 * * *';

const ALERT_PRESETS = {
  bitcoin:  { above: 110000, below: 95000 },
  ethereum: { above: 4500,   below: 3200 },
  solana:   { above: 250,    below: 180 },
};

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

const BINANCE_MAP = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT',
  ripple: 'XRPUSDT',
  'the-open-network': 'TONUSDT',
};

const SYMBOL_TO_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  TON: 'the-open-network',
};

const CMC_SYMBOLS = 'BTC,ETH,SOL,BNB,XRP,TON';
const FOOTER = `<blockquote>📡 <b>TradeAgent IV</b>\n<i>AI Crypto Intelligence</i>\n@TradeAgentIV</blockquote>`;

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
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const fmt = {
  price: (n) => {
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 1)    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  },
  vol: (n) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${(n / 1e3).toFixed(2)}K`;
  },
  cap: (n) => {
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
  const empty = blocks - filled;
  return '🟩'.repeat(filled) + '⬜'.repeat(empty);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. API HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function api(url, opts = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        ...opts,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TradeAgentIV/1.0',
          ...opts.headers,
        },
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
// 5. NORMALIZERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizeCG(coins) {
  return coins.map(c => ({
    id: c.id,
    current_price: c.current_price,
    price_change_percentage_24h: c.price_change_percentage_24h,
    total_volume: c.total_volume,
    market_cap: c.market_cap,
  }));
}

function normalizeCMC(data) {
  const result = [];
  for (const coin of Object.values(data.data || {})) {
    const id = SYMBOL_TO_ID[coin.symbol];
    if (!id) continue;
    const q = coin.quote?.USD || {};
    result.push({
      id,
      current_price: q.price || 0,
      price_change_percentage_24h: q.percent_change_24h || 0,
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
      id,
      current_price: price,
      price_change_percentage_24h: parseFloat(b.priceChangePercent),
      total_volume: parseFloat(b.volume) * price,
      market_cap: 0,
    };
  });
}

function normalizeCoinCap(data) {
  const result = [];
  const allowed = new Set(Object.keys(COINS));
  for (const asset of data.data || []) {
    if (!allowed.has(asset.id)) continue;
    result.push({
      id: asset.id,
      current_price: parseFloat(asset.priceUsd) || 0,
      price_change_percentage_24h: parseFloat(asset.changePercent24Hr) || 0,
      total_volume: parseFloat(asset.volumeUsd24Hr) || 0,
      market_cap: parseFloat(asset.marketCapUsd) || 0,
    });
  }
  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. PRICE API — FAILOVER: CG → CMC → Binance → CoinCap
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getCoinsCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
  const data = await api(url, { headers: { 'x-cg-demo-api-key': key } });
  return normalizeCG(data);
}

async function getCoinsCMC(env) {
  const key = env.CMC_API_KEY;
  if (!key) return null;
  const url = `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${CMC_SYMBOLS}`;
  const data = await api(url, { headers: { 'X-CMC_PRO_API_KEY': key } });
  return normalizeCMC(data);
}

async function getCoinsBinance() {
  const symbols = Object.values(BINANCE_MAP).map(s => `"${s}"`).join(',');
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`;
  const data = await api(url);
  return normalizeBinance(data);
}

async function getCoinsCoinCap() {
  const url = `https://api.coincap.io/v2/assets?limit=50`;
  const data = await api(url);
  return normalizeCoinCap(data);
}

async function getCoins(env) {
  try {
    const cg = await getCoinsCG(env);
    if (cg && cg.length) return { source: 'CoinGecko', data: cg };
  } catch (e) { console.error('[API] CG prices failed:', e.message); }

  try {
    const cmc = await getCoinsCMC(env);
    if (cmc && cmc.length) return { source: 'CoinMarketCap', data: cmc };
  } catch (e) { console.error('[API] CMC prices failed:', e.message); }

  try {
    const bin = await getCoinsBinance();
    if (bin && bin.length) return { source: 'Binance', data: bin };
  } catch (e) { console.error('[API] Binance prices failed:', e.message); }

  try {
    const cc = await getCoinsCoinCap();
    if (cc && cc.length) return { source: 'CoinCap', data: cc };
  } catch (e) { console.error('[API] CoinCap prices failed:', e.message); }

  throw new Error('All price APIs failed (CG, CMC, Binance, CoinCap)');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. GLOBAL DATA — FAILOVER: CG → CMC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getGlobalCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  return api(`${COINGECKO_BASE}/global`, { headers: { 'x-cg-demo-api-key': key } });
}

async function getGlobalCMC(env) {
  const key = env.CMC_API_KEY;
  if (!key) return null;
  const data = await api(`${CMC_BASE}/global-metrics/quotes/latest`, {
    headers: { 'X-CMC_PRO_API_KEY': key },
  });
  const q = data.data?.quote?.USD || {};
  return {
    data: {
      total_market_cap: { usd: q.total_market_cap || 0 },
      total_volume: { usd: q.total_volume_24h || 0 },
      market_cap_percentage: { btc: data.data?.btc_dominance || 0 },
    },
  };
}

async function getGlobal(env) {
  try {
    const cg = await getGlobalCG(env);
    if (cg) return cg;
  } catch (e) { console.error('[API] CG global failed:', e.message); }

  try {
    const cmc = await getGlobalCMC(env);
    if (cmc) return cmc;
  } catch (e) { console.error('[API] CMC global failed:', e.message); }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. TRENDING — FAILOVER: CG → CMC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getTrendingCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  return api(`${COINGECKO_BASE}/search/trending`, { headers: { 'x-cg-demo-api-key': key } });
}

async function getTrendingCMC(env) {
  const key = env.CMC_API_KEY;
  if (!key) return null;
  const data = await api(`${CMC_BASE}/cryptocurrency/trending/latest?limit=10`, {
    headers: { 'X-CMC_PRO_API_KEY': key },
  });
  return {
    coins: (data.data || []).map(c => ({
      item: {
        symbol: c.symbol,
        name: c.name,
        market_cap_rank: c.cmc_rank || '?',
      },
    })),
  };
}

async function getTrending(env) {
  try {
    const cg = await getTrendingCG(env);
    if (cg) return cg;
  } catch (e) { console.error('[API] CG trending failed:', e.message); }

  try {
    const cmc = await getTrendingCMC(env);
    if (cmc) return cmc;
  } catch (e) { console.error('[API] CMC trending failed:', e.message); }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. FEAR & GREED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getFearGreed() {
  return api('https://api.alternative.me/fng/?limit=1');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. GEMINI AI ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getGeminiAnalysis(env, todayData, yesterdayData) {
  const key = env.GEMINI_API_KEY;
  if (!key) return null;

  const prompt = buildAIPrompt(todayData, yesterdayData);

  try {
    const res = await api(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
        },
      }),
    });

    const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');
    return text.trim();
  } catch (e) {
    console.error('[AI] Gemini failed:', e.message);
    return null;
  }
}

function buildAIPrompt(today, yesterday) {
  const t = today;
  const y = yesterday || {};

  const changes = [];
  for (const c of t.coins) {
    const yc = y.coins?.find(x => x.id === c.id);
    const ch = yc ? (c.current_price - yc.current_price) / yc.current_price * 100 : c.price_change_percentage_24h;
    changes.push(`${COINS[c.id].symbol}: $${fmt.price(c.current_price)} (${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%)`);
  }

  const btcDomChange = y.btcDominance ? (t.btcDominance - y.btcDominance).toFixed(1) : '0';
  const fngChange = y.fearGreed ? (t.fearGreed - y.fearGreed) : 0;

  return `You are "TradeAgent IV", a professional Persian-speaking crypto market intelligence analyst.

Analyze ONLY the provided data. Do NOT use external information. Do NOT invent support/resistance/price targets.

RULES:
- Write in Persian (Farsi)
- Maximum 200 words
- Output valid Telegram HTML tags: <b>, <i>, <blockquote>
- Mention both bullish and bearish scenarios
- Mention risks clearly
- Compare today vs yesterday when data exists
- Professional, confident tone
- End with: "⚠️ این تحلیل صرفاً اطلاع‌رسانی است و توصیه مالی نیست."
- Do NOT use markdown (*, _, #)
- Do NOT use emojis in HTML tags

TODAY'S DATA:
- Date: ${t.date}
- Market Cap: ${fmt.cap(t.totalMarketCap)}
- Volume 24H: ${fmt.vol(t.totalVolume)}
- BTC Dominance: ${t.btcDominance}%
- Fear & Greed: ${t.fearGreed}/100 (${t.fearClassification})
- Coins: ${changes.join(', ')}
- Trending: ${t.trending.map(x => x.item.symbol).join(', ')}

YESTERDAY'S DATA:
${y.date ? `- Date: ${y.date}` : '- No historical data'}
${y.btcDominance ? `- BTC Dominance: ${y.btcDominance}% (change: ${btcDomChange >= 0 ? '+' : ''}${btcDomChange}%)` : ''}
${y.fearGreed ? `- Fear & Greed: ${y.fearGreed}/100 (change: ${fngChange >= 0 ? '+' : ''}${fngChange})` : ''}

Write the analysis now.`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. SNAPSHOT KV (Yesterday Data)
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
// 12. TELEGRAM API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function tgMethod(token, method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  console.log(`[TG] ${method} → ${body.chat_id || 'N/A'}`);

  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      console.log(`[TG] ${method} ← ok=${d.ok}`, d.ok ? '' : d.description);
      if (!d.ok) {
        const err = new Error(d.description || `Telegram API error ${method}`);
        err.code = d.error_code;
        throw err;
      }
      return d;
    } catch (e) {
      console.error(`[TG] ${method} attempt ${i+1} failed:`, e.message);
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

const adminInline = {
  inline_keyboard: [
    [{ text: '📣 Send Prices', callback_data: 'send_price' }, { text: '📣 Send Volume', callback_data: 'send_volume' }],
    [{ text: '📣 Send AI Daily', callback_data: 'send_ai' }, { text: '📣 Send Trending', callback_data: 'send_trending' }],
    [{ text: '📣 Send F&G', callback_data: 'send_fng' }, { text: '📣 Send All', callback_data: 'send_all' }],
    [{ text: '🔙 Back', callback_data: 'back_main' }],
  ],
};

function alertsInline(states) {
  const rows = [];
  for (const [coinId, cfg] of Object.entries(ALERT_PRESETS)) {
    const c = COINS[coinId];
    if (!c) continue;
    const aboveKey = `${coinId}:above`;
    const belowKey = `${coinId}:below`;
    const aboveOn = states[aboveKey] ? '🟢' : '⚪️';
    const belowOn = states[belowKey] ? '🔴' : '⚪️';
    rows.push([
      { text: `${aboveOn} ${c.symbol} > $${fmt.price(cfg.above)}`, callback_data: `toggle:${aboveKey}` },
      { text: `${belowOn} ${c.symbol} < $${fmt.price(cfg.below)}`, callback_data: `toggle:${belowKey}` },
    ]);
  }
  rows.push([{ text: '🔙 Back', callback_data: 'back_main' }]);
  return { inline_keyboard: rows };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14. MESSAGE BUILDERS — HTML EDITION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildPrice(coins, source = '') {
  let m = `📊 <b>LIVE MARKET</b>${source ? ` <i>via ${esc(source)}</i>` : ''}\n\n`;
  m += `<pre>`;
  for (const c of coins) {
    const i = COINS[c.id];
    if (!i) continue;
    const ch = c.price_change_percentage_24h || 0;
    const em = ch >= 0 ? '🟢' : '🔴';
    const sym = i.symbol.padEnd(4, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(10, ' ');
    const chStr = (em + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(8, ' ');
    m += `${sym} ${pr}  ${chStr}\n`;
  }
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildVolume(coins, source = '') {
  let m = `📈 <b>VOLUME REPORT</b>${source ? ` <i>via ${esc(source)}</i>` : ''}\n\n`;
  m += `<pre>`;
  for (const c of coins) {
    const i = COINS[c.id];
    if (!i) continue;
    const sym = i.symbol.padEnd(4, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(10, ' ');
    const vol = fmt.vol(c.total_volume).padStart(10, ' ');
    let line = `${sym} ${pr}  Vol:${vol}`;
    if (c.market_cap) {
      line += `  Cap:${fmt.cap(c.market_cap)}`;
    }
    m += line + '\n';
  }
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildDaily(coins, globalData, trending, fear, source = '') {
  const sorted = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  let m = `📉 <b>DAILY INTELLIGENCE</b>${source ? ` <i>via ${esc(source)}</i>` : ''}\n\n`;

  if (globalData?.data) {
    const g = globalData.data;
    m += `🌍 <b>Global</b>\n`;
    m += `Cap: ${fmt.cap(g.total_market_cap?.usd || 0)} | Vol: ${fmt.vol(g.total_volume?.usd || 0)} | BTC Dom: ${g.market_cap_percentage?.btc?.toFixed(1) || '?'}%\n\n`;
  }

  if (fear?.data?.[0]) {
    const f = fear.data[0];
    const v = parseInt(f.value);
    m += `🧠 <b>Sentiment</b>\n`;
    m += `${getBias(v)}\n\n`;
  }

  m += `<pre>`;
  for (const c of sorted) {
    const i = COINS[c.id];
    if (!i) continue;
    const ch = c.price_change_percentage_24h || 0;
    const em = ch >= 0 ? '🟢' : '🔴';
    const sym = i.symbol.padEnd(4, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(10, ' ');
    const chStr = (em + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(8, ' ');
    let line = `${sym} ${pr}  ${chStr}`;
    if (c.market_cap) {
      line += `  ${fmt.cap(c.market_cap)}`;
    }
    m += line + '\n';
  }
  m += `</pre>\n\n`;

  if (best && COINS[best.id]) {
    const i = COINS[best.id];
    m += `🏆 <b>Leader</b>\n${i.emoji} ${i.symbol}  ${fmt.change(best.price_change_percentage_24h)}\n\n`;
  }
  if (worst && COINS[worst.id]) {
    const i = COINS[worst.id];
    m += `⚠️ <b>Weakest</b>\n${i.emoji} ${i.symbol}  ${fmt.change(worst.price_change_percentage_24h)}\n\n`;
  }
  if (trending?.coins?.length) {
    m += `🔥 <b>Trending</b>\n`;
    for (const t of trending.coins.slice(0, 3)) {
      m += `   ${esc(t.item.symbol)} — ${esc(t.item.name)}\n`;
    }
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
  const f = fear.data[0];
  const v = parseInt(f.value);
  let m = `🧠 <b>MARKET SENTIMENT</b>\n\n`;
  m += `${progressBar(v)} <b>${v}/100</b>\n`;
  m += `${getBias(v)}\n\n`;
  m += `${FOOTER}`;
  return m;
}

async function buildAIAnalysis(aiText, todayData) {
  const t = todayData;
  let m = `🧠 <b>AI MARKET INTELLIGENCE</b>\n`;
  m += `<i>${t.date} • TradeAgent IV</i>\n\n`;

  m += `<blockquote>\n${aiText}\n</blockquote>\n\n`;

  m += `<pre>`;
  m += `BTC  $${fmt.price(t.btcPrice)}  ${t.btcChange >= 0 ? '🟢' : '🔴'}${t.btcChange >= 0 ? '+' : ''}${t.btcChange.toFixed(2)}%\n`;
  m += `ETH  $${fmt.price(t.ethPrice)}  ${t.ethChange >= 0 ? '🟢' : '🔴'}${t.ethChange >= 0 ? '+' : ''}${t.ethChange.toFixed(2)}%\n`;
  m += `SOL  $${fmt.price(t.solPrice)}  ${t.solChange >= 0 ? '🟢' : '🔴'}${t.solChange >= 0 ? '+' : ''}${t.solChange.toFixed(2)}%\n`;
  m += `</pre>\n\n`;

  m += `🌍 Cap: ${fmt.cap(t.totalMarketCap)} | Vol: ${fmt.vol(t.totalVolume)}\n`;
  m += `₿ Dom: ${t.btcDominance}% | 🧠 F&G: ${t.fearGreed}/100\n\n`;

  m += `${FOOTER}`;
  return m;
}

function buildAlert(coinId, price, type) {
  const i = COINS[coinId];
  const t = type === 'above' ? '🚀 ABOVE' : '📉 BELOW';
  return `🚨 <b>${esc(i.symbol)} ALERT</b>\n\n${i.emoji} ${esc(i.name)}\n<b>${t}</b> target!\n\nCurrent: $${fmt.price(price)}\n\n${FOOTER}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. KV HELPERS — OPTIMIZED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getAlertState(env, key) {
  if (!env.ALERTS_KV) return false;
  const v = await env.ALERTS_KV.get(`alert:cfg:${key}`);
  return v === '1';
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
    if (cfg.above) {
      promises.push(
        getAlertState(env, `${coinId}:above`).then(v => { states[`${coinId}:above`] = v; })
      );
    }
    if (cfg.below) {
      promises.push(
        getAlertState(env, `${coinId}:below`).then(v => { states[`${coinId}:below`] = v; })
      );
    }
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
    const price = c.current_price;

    for (const dir of ['above', 'below']) {
      const threshold = cfg[dir];
      if (!threshold) continue;
      const key = `${c.id}:${dir}`;
      if (!states[key]) continue;

      const last = await getAlertLast(env, key);
      let triggered = false;

      if (dir === 'above' && price >= threshold) triggered = true;
      if (dir === 'below' && price <= threshold) triggered = true;

      if (triggered && last !== 'triggered') {
        await sendMessage(env, env.TELEGRAM_CHANNEL_ID, buildAlert(c.id, price, dir));
        await setAlertLast(env, key, 'triggered');
      } else if (!triggered && last) {
        await clearAlertLast(env, key);
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17. DATA COLLECTOR (for AI + Snapshot)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function collectMarketData(env) {
  const [{ source, data }, globalData, trending, fear] = await Promise.all([
    getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
  ]);

  const btc = data.find(c => c.id === 'bitcoin');
  const eth = data.find(c => c.id === 'ethereum');
  const sol = data.find(c => c.id === 'solana');

  const g = globalData?.data || {};
  const f = fear?.data?.[0] || {};
  const fv = parseInt(f.value) || 50;

  return {
    date: fmt.date(),
    time: fmt.time(),
    source,
    coins: data,
    totalMarketCap: g.total_market_cap?.usd || 0,
    totalVolume: g.total_volume?.usd || 0,
    btcDominance: g.market_cap_percentage?.btc || 0,
    fearGreed: fv,
    fearClassification: f.value_classification || 'Neutral',
    trending: trending?.coins || [],
    btcPrice: btc?.current_price || 0,
    btcChange: btc?.price_change_percentage_24h || 0,
    ethPrice: eth?.current_price || 0,
    ethChange: eth?.price_change_percentage_24h || 0,
    solPrice: sol?.current_price || 0,
    solChange: sol?.price_change_percentage_24h || 0,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 18. CHANNEL SENDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ensureChannel(env) {
  if (!env.TELEGRAM_CHANNEL_ID) throw new Error('TELEGRAM_CHANNEL_ID is not set in Worker environment');
}

async function sendChannelPrice(env) {
  try {
    ensureChannel(env);
    const { source, data } = await getCoins(env);
    await checkAlerts(env, data);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildPrice(data, source));
    console.log(`[SEND] Price OK [${source}]`);
  } catch (e) {
    console.error('[SEND] Price FAILED:', e.message);
    throw e;
  }
}

async function sendChannelVolume(env) {
  try {
    ensureChannel(env);
    const { source, data } = await getCoins(env);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildVolume(data, source));
    console.log(`[SEND] Volume OK [${source}]`);
  } catch (e) {
    console.error('[SEND] Volume FAILED:', e.message);
    throw e;
  }
}

async function sendChannelDaily(env) {
  try {
    ensureChannel(env);
    const [{ source, data }, globalData, trending, fear] = await Promise.all([
      getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
    ]);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildDaily(data, globalData, trending, fear, source));
    console.log(`[SEND] Daily OK [${source}]`);
  } catch (e) {
    console.error('[SEND] Daily FAILED:', e.message);
    throw e;
  }
}

async function sendChannelTrending(env) {
  try {
    ensureChannel(env);
    const trending = await getTrending(env);
    if (!trending) {
      await sendMessage(env, env.TELEGRAM_CHANNEL_ID, `🔥 <b>TRENDING COINS</b>\n\nTrending data unavailable.\n\n${FOOTER}`);
      return;
    }
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildTrending(trending));
    console.log('[SEND] Trending OK');
  } catch (e) {
    console.error('[SEND] Trending FAILED:', e.message);
    throw e;
  }
}

async function sendChannelFng(env) {
  try {
    ensureChannel(env);
    const fear = await getFearGreed();
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildFng(fear));
    console.log('[SEND] FNG OK');
  } catch (e) {
    console.error('[SEND] FNG FAILED:', e.message);
    throw e;
  }
}

async function sendChannelAI(env) {
  try {
    ensureChannel(env);
    if (!env.GEMINI_API_KEY) {
      console.log('[AI] No GEMINI_API_KEY, falling back to standard daily report');
      await sendChannelDaily(env);
      return;
    }

    const today = await collectMarketData(env);
    const yesterday = await getSnapshot(env);

    const aiText = await getGeminiAnalysis(env, today, yesterday);
    if (!aiText) {
      console.log('[AI] Gemini returned empty, falling back to standard daily');
      await sendChannelDaily(env);
      return;
    }

    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildAIAnalysis(aiText, today));
    console.log('[SEND] AI Analysis OK');

    // Store today's data as yesterday for next run
    await storeSnapshot(env, today);
  } catch (e) {
    console.error('[SEND] AI FAILED:', e.message);
    throw e;
  }
}

async function sendChannelAll(env) {
  const results = [];
  const senders = [
    { name: 'Price',    fn: sendChannelPrice },
    { name: 'Volume',   fn: sendChannelVolume },
    { name: 'AI Daily', fn: sendChannelAI },
    { name: 'Trending', fn: sendChannelTrending },
    { name: 'F&G',      fn: sendChannelFng },
  ];
  for (const s of senders) {
    try {
      await s.fn(env);
      results.push(`✅ ${s.name}`);
    } catch (e) {
      results.push(`❌ ${s.name}: ${e.message}`);
    }
  }
  console.log('[SEND ALL] Results:\n' + results.join('\n'));
  if (results.every(r => r.startsWith('❌'))) {
    throw new Error('All sends failed. Check logs.');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 19. BOT HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleStart(chatId, userId, env) {
  const admin = isAdmin(userId, env);
  const text = admin
    ? `👋 <b>Welcome Admin!</b>\n\nTradeAgent IV Control Panel.\nSelect an option:`
    : `👋 <b>Welcome to TradeAgent IV!</b>\n\nAI Crypto Intelligence Dashboard.\nSelect an option:`;
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
  sources.push('Binance');
  sources.push('CoinCap');
  const aiStatus = env.GEMINI_API_KEY ? '✅ Active' : '⚠️ Inactive';

  await sendMessage(env, chatId, `⚙️ <b>Settings</b>\n\nChannel: ${env.TELEGRAM_CHANNEL_ID || 'Not set'}\nSources: ${sources.join(', ')}\nAI Analysis: ${aiStatus}\nCron: Active\n\nUse /admin for admin panel.`);
}

async function showAdminPanel(chatId, env) {
  await sendMessage(env, chatId, `📣 <b>Admin Panel</b>\n\nChoose what to send to channel:`, adminInline);
}

async function handleHelp(chatId, env, userId) {
  const admin = isAdmin(userId, env);
  let text = `📖 <b>Commands</b>\n\n`;
  text += `/start — Main menu\n`;
  text += `/price — Live prices\n`;
  text += `/volume — Volume report\n`;
  text += `/daily — Daily report\n`;
  text += `/trending — Trending coins\n`;
  text += `/fng — Market Sentiment\n`;
  text += `/alerts — Alert settings\n`;
  text += `/settings — Bot settings\n`;
  if (admin) {
    text += `\n<b>Admin Commands:</b>\n`;
    text += `/admin — Admin panel\n`;
    text += `/sendprice — Send price to channel\n`;
    text += `/sendvolume — Send volume to channel\n`;
    text += `/sendai — Send AI analysis to channel\n`;
    text += `/senddaily — Send daily to channel\n`;
    text += `/sendall — Send everything to channel\n`;
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

      console.log(`[BOT] ${userId}: ${text}`);

      if (text === '/start') {
        await handleStart(chatId, userId, env);
      } else if (text === '/price' || text === '📊 Prices') {
        await handlePrices(chatId, env);
      } else if (text === '/volume' || text === '📈 Market Report') {
        await handleVolume(chatId, env);
      } else if (text === '/daily') {
        await handleDaily(chatId, env);
      } else if (text === '/trending' || text === '🔥 Trending') {
        await handleTrending(chatId, env);
      } else if (text === '/fng' || text === '🧠 F&G') {
        await handleFng(chatId, env);
      } else if (text === '/alerts' || text === '🚨 Alerts') {
        await handleAlerts(chatId, env);
      } else if (text === '/settings' || text === '⚙️ Settings') {
        await handleSettings(chatId, env);
      } else if (text === '/help') {
        await handleHelp(chatId, env, userId);
      } else if (text === '/admin' || text === '📣 Admin Panel') {
        if (!isAdmin(userId, env)) {
          await sendMessage(env, chatId, '⛔️ <b>Forbidden</b>\n\nYou are not authorized.');
          return;
        }
        await showAdminPanel(chatId, env);
      } else if (text === '/sendprice') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending price to channel...');
        await sendChannelPrice(env);
        await sendMessage(env, chatId, '✅ Price sent to channel!');
      } else if (text === '/sendvolume') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending volume to channel...');
        await sendChannelVolume(env);
        await sendMessage(env, chatId, '✅ Volume sent to channel!');
      } else if (text === '/sendai') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Generating AI analysis...');
        await sendChannelAI(env);
        await sendMessage(env, chatId, '✅ AI analysis sent to channel!');
      } else if (text === '/senddaily') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending daily to channel...');
        await sendChannelDaily(env);
        await sendMessage(env, chatId, '✅ Daily report sent to channel!');
      } else if (text === '/sendall') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending all reports to channel...');
        await sendChannelAll(env);
        await sendMessage(env, chatId, '✅ All reports sent to channel!');
      } else {
        await sendMessage(env, chatId, '❓ Unknown command. Use /help to see options.');
      }
    }

    if (update.callback_query) {
      const q = update.callback_query;
      const chatId = q.message.chat.id;
      const userId = q.from.id;
      const data = q.data;
      const msgId = q.message.message_id;

      console.log(`[BOT] callback: ${data}`);

      await answerCallback(env, q.id);

      if (data.startsWith('send_')) {
        if (!isAdmin(userId, env)) {
          await sendMessage(env, chatId, '⛔️ <b>Forbidden</b>');
          return;
        }
        await sendMessage(env, chatId, '⏳ Sending to channel...');
        try {
          if (data === 'send_price')    await sendChannelPrice(env);
          if (data === 'send_volume')   await sendChannelVolume(env);
          if (data === 'send_ai')       await sendChannelAI(env);
          if (data === 'send_daily')    await sendChannelDaily(env);
          if (data === 'send_trending') await sendChannelTrending(env);
          if (data === 'send_fng')      await sendChannelFng(env);
          if (data === 'send_all')      await sendChannelAll(env);

          const successText = `✅ <b>Sent to channel successfully!</b>\n🕒 ${fmt.time()}`;
          try {
            await editMessage(env, chatId, msgId, successText, adminInline);
          } catch (editErr) {
            if (editErr.message && editErr.message.includes('not modified')) {
              console.log('[BOT] Edit skipped: message already up to date');
            } else {
              throw editErr;
            }
          }
        } catch (e) {
          console.error('[BOT] Send failed:', e.message);
          const errText = `❌ <b>Error:</b> ${esc(e.message)}`;
          try {
            await editMessage(env, chatId, msgId, errText, adminInline);
          } catch (editErr2) {
            if (editErr2.message && editErr2.message.includes('not modified')) {
              console.log('[BOT] Edit skipped on error: not modified');
            } else {
              await sendMessage(env, chatId, errText);
            }
          }
        }
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
        return;
      }
    }
  } catch (err) {
    console.error('[BOT] CRASH:', err.message);
    try {
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) {
        await sendMessage(env, chatId, `❌ <b>Error:</b> ${esc(err.message)}\n\nPlease try again later.`);
      }
    } catch (e) {
      // Ignore
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 21. CRON HANDLER — Optimized Schedule
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
    if (type === 'price')    await sendChannelPrice(env);
    if (type === 'volume')   await sendChannelVolume(env);
    if (type === 'daily')    await sendChannelDaily(env);
    if (type === 'ai')       await sendChannelAI(env);
    if (type === 'trending') await sendChannelTrending(env);
    if (type === 'fng')      await sendChannelFng(env);
    if (type === 'all')      await sendChannelAll(env);
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
    token_preview: env.TELEGRAM_BOT_TOKEN ? env.TELEGRAM_BOT_TOKEN.slice(0, 10) + '...' : 'MISSING',
    channel_id: env.TELEGRAM_CHANNEL_ID || 'MISSING',
    admin_id: env.ADMIN_ID || 'MISSING',
  };

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID) {
    try {
      const me = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getMe', {});
      const botId = me.result.id;
      const member = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getChatMember', {
        chat_id: env.TELEGRAM_CHANNEL_ID,
        user_id: botId,
      });
      checks.channel_access = member.result.status;
      checks.can_post = ['administrator', 'creator'].includes(member.result.status);
    } catch (e) {
      checks.channel_access = `ERROR: ${e.message}`;
      checks.can_post = false;
    }
  }

  try {
    const cg = await getCoinsCG(env);
    checks.coingecko_status = cg ? `✅ OK (${cg.length} coins)` : '⚠️ No API Key';
  } catch (e) {
    checks.coingecko_status = `❌ ${e.message}`;
  }

  try {
    const cmc = await getCoinsCMC(env);
    checks.cmc_status = cmc ? `✅ OK (${cmc.length} coins)` : '⚠️ No API Key';
  } catch (e) {
    checks.cmc_status = `❌ ${e.message}`;
  }

  try {
    const bin = await getCoinsBinance();
    checks.binance_status = `✅ OK (${bin.length} coins)`;
  } catch (e) {
    checks.binance_status = `❌ ${e.message}`;
  }

  try {
    const cc = await getCoinsCoinCap();
    checks.coincap_status = `✅ OK (${cc.length} coins)`;
  } catch (e) {
    checks.coincap_status = `❌ ${e.message}`;
  }

  try {
    if (env.GEMINI_API_KEY) {
      const test = await getGeminiAnalysis(env, { date: fmt.date(), coins: [], totalMarketCap: 0, totalVolume: 0, btcDominance: 0, fearGreed: 50, fearClassification: 'Neutral', trending: [], btcPrice: 0, btcChange: 0, ethPrice: 0, ethChange: 0, solPrice: 0, solChange: 0 }, null);
      checks.gemini_status = test ? '✅ OK' : '⚠️ Empty response';
    } else {
      checks.gemini_status = '⚠️ No API Key';
    }
  } catch (e) {
    checks.gemini_status = `❌ ${e.message}`;
  }

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 23. MAIN ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleHttp(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  console.log(`[HTTP] ${request.method} ${path}`);

  if (path === '/webhook' && request.method === 'POST') {
    return handleWebhook(request, env);
  }

  if (path === '/admin' && (request.method === 'POST' || request.method === 'GET')) {
    return routeAdmin(request, env);
  }

  if (path === '/debug' && request.method === 'GET') {
    return handleDebug(env);
  }

  if (path === '/' && request.method === 'GET') {
    return new Response(
      `TradeAgent IV PRO — AI-Powered Crypto Intelligence\n\nRoutes:\n  POST /webhook  → Telegram webhook\n  POST|GET /admin → Manual trigger (x-admin-secret required)\n  GET  /debug    → Status check + API tests\n\nCron: ${CRON_PRICE}, ${CRON_AI}, ${CRON_FNG}\n`,
      { status: 200 }
    );
  }

  return new Response('Not Found', { status: 404 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 24. EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleHttp(request, env);
    } catch (err) {
      console.error('[FETCH] FATAL:', err.message);
      return new Response(
        `❌ ERROR: ${err.message}\n\n📍 STACK:\n${err.stack}`,
        { status: 500, headers: { 'Content-Type': 'text/plain' } }
      );
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      handleCron(event, env).catch(e => console.error('[CRON] ERROR:', e))
    );
  },
};
