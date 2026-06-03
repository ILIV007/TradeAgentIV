// ═══════════════════════════════════════════════════════════════
//  TRADEAGENT IV — Multi-API Failover Edition
//  Sources: CoinGecko → CoinMarketCap → Binance → CoinCap
//  Routes: /webhook | /admin (GET/POST) | /debug
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
const CRON_VOL   = '0 * * * *';
const CRON_DAILY = '0 13 * * *';

const ALERT_PRESETS = {
  bitcoin:  { above: 110000, below: 95000 },
  ethereum: { above: 4500,   below: 3200 },
  solana:   { above: 250,    below: 180 },
};

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';

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
// 5. NORMALIZERS (همه APIها را به فرمت واحد تبدیل می‌کند)
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
  for (const [_, coin] of Object.entries(data.data || {})) {
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
  for (const asset of data.data || []) {
    const id = Object.keys(COINS).find(k => COINS[k].symbol === asset.symbol);
    if (!id) continue;
    result.push({
      id,
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
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h&x_cg_demo_api_key=${key}`;
  const data = await api(url);
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
  const ids = Object.keys(COINS).join(',');
  const url = `https://api.coincap.io/v2/assets?ids=${ids}`;
  const data = await api(url);
  return normalizeCoinCap(data);
}

async function getCoins(env) {
  // 1. CoinGecko
  try {
    const cg = await getCoinsCG(env);
    if (cg && cg.length) return { source: 'coingecko', data: cg };
  } catch (e) { console.error('[API] CG prices failed:', e.message); }

  // 2. CoinMarketCap
  try {
    const cmc = await getCoinsCMC(env);
    if (cmc && cmc.length) return { source: 'coinmarketcap', data: cmc };
  } catch (e) { console.error('[API] CMC prices failed:', e.message); }

  // 3. Binance
  try {
    const bin = await getCoinsBinance();
    if (bin && bin.length) return { source: 'binance', data: bin };
  } catch (e) { console.error('[API] Binance prices failed:', e.message); }

  // 4. CoinCap
  try {
    const cc = await getCoinsCoinCap();
    if (cc && cc.length) return { source: 'coincap', data: cc };
  } catch (e) { console.error('[API] CoinCap prices failed:', e.message); }

  throw new Error('All price APIs failed (CG, CMC, Binance, CoinCap)');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. GLOBAL DATA — FAILOVER: CG → CMC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getGlobalCG(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  return api(`${COINGECKO_BASE}/global?x_cg_demo_api_key=${key}`);
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
  return api(`${COINGECKO_BASE}/search/trending?x_cg_demo_api_key=${key}`);
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
// 10. TELEGRAM API
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
  const body = { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true };
  if (markup) body.reply_markup = markup;
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendMessage', body);
}

async function answerCallback(env, queryId, text = null) {
  const body = { callback_query_id: queryId };
  if (text) body.text = text;
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', body);
}

async function editMessage(env, chatId, messageId, text, markup = null) {
  const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', disable_web_page_preview: true };
  if (markup) body.reply_markup = markup;
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'editMessageText', body);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. KEYBOARDS
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
    [{ text: '📣 Send Daily', callback_data: 'send_daily' }, { text: '📣 Send Trending', callback_data: 'send_trending' }],
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
// 12. MESSAGE BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildPrice(coins, source = '') {
  let m = `📊 *Live Prices*${source ? ` \\[${source}\\]` : ''}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const c of coins) {
    const i = COINS[c.id];
    if (!i) continue;
    m += `${i.emoji} *${i.symbol}*  —  $${fmt.price(c.current_price)}\n`;
    m += `   ${fmt.change(c.price_change_percentage_24h)}\n\n`;
  }
  m += `━━━━━━━━━━━━━━━━━━━━\n🕒 ${fmt.time()} UTC`;
  return m;
}

async function buildVolume(coins, source = '') {
  let m = `📈 *Volume Report*${source ? ` \\[${source}\\]` : ''}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const c of coins) {
    const i = COINS[c.id];
    if (!i) continue;
    m += `${i.emoji} *${i.symbol}*  —  $${fmt.price(c.current_price)}\n`;
    m += `   📊 Vol 24H: ${fmt.vol(c.total_volume)}\n`;
    if (c.market_cap) m += `   🏦 Cap: ${fmt.cap(c.market_cap)}\n`;
    m += `\n`;
  }
  m += `━━━━━━━━━━━━━━━━━━━━\n🕒 ${fmt.time()} UTC`;
  return m;
}

async function buildDaily(coins, globalData, trending, fear, source = '') {
  const sorted = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  let m = `📉 *Daily Market Report*${source ? ` \\[${source}\\]` : ''}\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (globalData?.data) {
    const g = globalData.data;
    m += `🌍 *Global*\n   Cap: ${fmt.cap(g.total_market_cap?.usd || 0)}\n   Vol: ${fmt.vol(g.total_volume?.usd || 0)}\n   BTC Dom: ${g.market_cap_percentage?.btc?.toFixed(1) || '?'}%\n\n`;
  }
  if (fear?.data?.[0]) {
    const f = fear.data[0];
    const v = parseInt(f.value);
    const em = v >= 75 ? '😱' : v >= 55 ? '😊' : v >= 45 ? '😐' : v >= 25 ? '😰' : '😨';
    m += `🧠 *Fear & Greed*\n   ${em} ${v}/100 — ${f.value_classification}\n\n`;
  }

  m += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const c of sorted) {
    const i = COINS[c.id];
    if (!i) continue;
    m += `${i.emoji} *${i.symbol}*  —  $${fmt.price(c.current_price)}\n`;
    m += `   24H: ${fmt.change(c.price_change_percentage_24h)}`;
    if (c.market_cap) m += `  |  Cap: ${fmt.cap(c.market_cap)}`;
    m += `\n\n`;
  }

  if (best && COINS[best.id]) {
    const i = COINS[best.id];
    m += `🏆 *Top Gainer*\n${i.emoji} ${i.symbol}  ${fmt.change(best.price_change_percentage_24h)}\n\n`;
  }
  if (worst && COINS[worst.id]) {
    const i = COINS[worst.id];
    m += `⚠️ *Top Loser*\n${i.emoji} ${i.symbol}  ${fmt.change(worst.price_change_percentage_24h)}\n\n`;
  }
  if (trending?.coins?.length) {
    m += `🔥 *Trending*\n`;
    for (const t of trending.coins.slice(0, 3)) {
      m += `   ${t.item.symbol} — ${t.item.name}\n`;
    }
    m += `\n`;
  }
  m += `━━━━━━━━━━━━━━━━━━━━\n📅 ${fmt.date()} UTC`;
  return m;
}

async function buildTrending(trending) {
  let m = `🔥 *Trending Coins*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (trending?.coins?.length) {
    for (const t of trending.coins.slice(0, 10)) {
      m += `   ${t.item.symbol} — ${t.item.name}\n`;
      m += `   Rank: #${t.item.market_cap_rank || '?'}\n\n`;
    }
  } else {
    m += `No trending data available.\n`;
  }
  m += `━━━━━━━━━━━━━━━━━━━━\n🕒 ${fmt.time()} UTC`;
  return m;
}

async function buildFng(fear) {
  if (!fear?.data?.[0]) return `🧠 *Fear & Greed*\n\nData unavailable.`;
  const f = fear.data[0];
  const v = parseInt(f.value);
  const em = v >= 75 ? '😱' : v >= 55 ? '😊' : v >= 45 ? '😐' : v >= 25 ? '😰' : '😨';
  return `🧠 *Fear & Greed Index*\n━━━━━━━━━━━━━━━━━━━━\n\n${em} *${v}/100*\nClassification: ${f.value_classification}\n\n━━━━━━━━━━━━━━━━━━━━\n🕒 ${fmt.time()} UTC`;
}

function buildAlert(coinId, price, type) {
  const i = COINS[coinId];
  const t = type === 'above' ? '🚀 ABOVE' : '📉 BELOW';
  return `🚨 *${i.symbol} ALERT*\n\n${i.emoji} ${i.name}\n${t} target!\n\nCurrent: $${fmt.price(price)}\n🕒 ${fmt.time()} UTC\n📡 @TradeAgentIV`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. KV HELPERS
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
  for (const coinId of Object.keys(ALERT_PRESETS)) {
    const cfg = ALERT_PRESETS[coinId];
    if (cfg.above) states[`${coinId}:above`] = await getAlertState(env, `${coinId}:above`);
    if (cfg.below) states[`${coinId}:below`] = await getAlertState(env, `${coinId}:below`);
  }
  return states;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14. CORE LOGIC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function checkAlerts(env, coins) {
  if (!env.ALERTS_KV) return;
  for (const c of coins) {
    const cfg = ALERT_PRESETS[c.id];
    if (!cfg) continue;
    const price = c.current_price;

    for (const dir of ['above', 'below']) {
      const threshold = cfg[dir];
      if (!threshold) continue;
      const key = `${c.id}:${dir}`;
      const enabled = await getAlertState(env, key);
      if (!enabled) continue;

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
// 15. CHANNEL SENDERS
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
      await sendMessage(env, env.TELEGRAM_CHANNEL_ID, '🔥 *Trending*\n\nTrending data unavailable. No API key configured or all sources failed.');
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

async function sendChannelAll(env) {
  const results = [];
  const senders = [
    { name: 'Price',    fn: sendChannelPrice },
    { name: 'Volume',   fn: sendChannelVolume },
    { name: 'Daily',    fn: sendChannelDaily },
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
// 16. BOT HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleStart(chatId, userId, env) {
  const admin = isAdmin(userId, env);
  const text = admin
    ? '👋 *Welcome Admin!*\n\nTradeAgent IV Control Panel.\nSelect an option:'
    : '👋 *Welcome to TradeAgent IV!*\n\nCrypto Dashboard.\nSelect an option:';
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
    await sendMessage(env, chatId, '🔥 *Trending*\n\nTrending data unavailable. No API key configured or all sources failed.');
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
  let text = `🚨 *Alert Settings*\n\nToggle alerts on/off:\n\n`;
  for (const [coinId, cfg] of Object.entries(ALERT_PRESETS)) {
    const c = COINS[coinId];
    text += `${c.emoji} *${c.symbol}*\n`;
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
  sources.push('Binance (fallback)');
  sources.push('CoinCap (fallback)');

  await sendMessage(env, chatId, `⚙️ *Settings*\n\nChannel: ${env.TELEGRAM_CHANNEL_ID || 'Not set'}\nData Sources: ${sources.join(', ')}\nCron Jobs: Active\n\nUse /admin for admin panel.`);
}

async function showAdminPanel(chatId, env) {
  await sendMessage(env, chatId, `📣 *Admin Panel*\n\nChoose what to send to channel:`, adminInline);
}

async function handleHelp(chatId, env, userId) {
  const admin = isAdmin(userId, env);
  let text = `📖 *Commands*\n\n`;
  text += `/start — Main menu\n`;
  text += `/price — Live prices\n`;
  text += `/volume — Volume report\n`;
  text += `/daily — Daily report\n`;
  text += `/trending — Trending coins\n`;
  text += `/fng — Fear & Greed Index\n`;
  text += `/alerts — Alert settings\n`;
  text += `/settings — Bot settings\n`;
  if (admin) {
    text += `\n*Admin Commands:*\n`;
    text += `/admin — Admin panel\n`;
    text += `/sendprice — Send price to channel\n`;
    text += `/sendvolume — Send volume to channel\n`;
    text += `/senddaily — Send daily to channel\n`;
    text += `/sendall — Send everything to channel\n`;
  }
  await sendMessage(env, chatId, text);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17. WEBHOOK PROCESSOR
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
          await sendMessage(env, chatId, '⛔️ *Forbidden*\n\nYou are not authorized.');
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
          await sendMessage(env, chatId, '⛔️ *Forbidden*');
          return;
        }
        await sendMessage(env, chatId, '⏳ Sending to channel...');
        try {
          if (data === 'send_price')    await sendChannelPrice(env);
          if (data === 'send_volume')   await sendChannelVolume(env);
          if (data === 'send_daily')    await sendChannelDaily(env);
          if (data === 'send_trending') await sendChannelTrending(env);
          if (data === 'send_fng')      await sendChannelFng(env);
          if (data === 'send_all')      await sendChannelAll(env);

          const successText = `✅ *Sent to channel successfully!*\n🕒 ${fmt.time()}`;
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
          const errText = `❌ *Error:* ${e.message}`;
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
        await editMessage(env, chatId, msgId, `🚨 *Alert Settings*\n\nUpdated!`, alertsInline(states));
        return;
      }

      if (data === 'back_main') {
        const admin = isAdmin(userId, env);
        await sendMessage(env, chatId, '👋 *Main Menu*', mainKeyboard(admin));
        return;
      }
    }
  } catch (err) {
    console.error('[BOT] CRASH:', err.message);
    try {
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) {
        await sendMessage(env, chatId, `❌ *Error:* ${err.message}\n\nPlease try again later.`);
      }
    } catch (e) {
      // Ignore
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 18. CRON HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleCron(cron, env) {
  try {
    switch (cron) {
      case CRON_PRICE: await sendChannelPrice(env); break;
      case CRON_VOL:   await sendChannelVolume(env); break;
      case CRON_DAILY: await sendChannelDaily(env);  break;
      default:         await sendChannelPrice(env);
    }
  } catch (err) {
    console.error(`[CRON ERROR] ${cron}: ${err.message}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 19. HTTP ROUTER
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

  // Test APIs
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

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 20. MAIN ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleHttp(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  console.log(`[HTTP] ${request.method} ${path}`);

  if (path === '/webhook' && request.method === 'POST') {
    return handleWebhook(request, env);
  }

  // FIX: /admin now accepts BOTH GET and POST
  if (path === '/admin' && (request.method === 'POST' || request.method === 'GET')) {
    return routeAdmin(request, env);
  }

  if (path === '/debug' && request.method === 'GET') {
    return handleDebug(env);
  }

  if (path === '/' && request.method === 'GET') {
    return new Response(
      `TradeAgent IV Bot — Multi-API Failover\n\nRoutes:\n  POST /webhook  → Telegram webhook\n  POST|GET /admin → Manual trigger (x-admin-secret required)\n  GET  /debug    → Status check + API tests\n\nCron: ${CRON_PRICE}, ${CRON_VOL}, ${CRON_DAILY}\n`,
      { status: 200 }
    );
  }

  return new Response('Not Found', { status: 404 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 21. EXPORT
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
      handleCron(event.cron, env).catch(e => console.error('[CRON] ERROR:', e))
    );
  },
};
