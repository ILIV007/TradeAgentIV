// ═══════════════════════════════════════════════════════════════
//  TRADEAGENT IV — Telegram Bot + Admin Panel + Channel Manager
//  Cloudflare Workers | 1 File | Modular | Production Ready
// ═══════════════════════════════════════════════════════════════

async function handleHttp(request, env) {
  const url = new URL(request.url);
  
  // ===== DEBUG ENDPOINT =====
  if (url.pathname === '/debug' && request.method === 'GET') {
    const checks = {
      has_token: !!env.TELEGRAM_BOT_TOKEN,
      has_channel: !!env.TELEGRAM_CHANNEL_ID,
      has_admin_id: !!env.ADMIN_ID,
      has_admin_secret: !!env.ADMIN_SECRET,
      has_kv: !!env.ALERTS_KV,
      token_preview: env.TELEGRAM_BOT_TOKEN ? env.TELEGRAM_BOT_TOKEN.slice(0, 10) + '...' : 'MISSING',
      channel_id: env.TELEGRAM_CHANNEL_ID || 'MISSING',
      admin_id: env.ADMIN_ID || 'MISSING',
    };
    return new Response(JSON.stringify(checks, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // ==========================
  
  // ... بقیه کد handleHttp ...
}

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
const CRON_PRICE = '*/30 * * * *';   // Every 30 min
const CRON_VOL   = '0 * * * *';      // Every hour
const CRON_DAILY = '0 13 * * *';     // Daily 13:00 UTC

const ALERT_PRESETS = {
  bitcoin:  { above: 110000, below: 95000 },
  ethereum: { above: 4500,   below: 3200 },
  solana:   { above: 250,    below: 180 },
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
// 4. API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function api(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function getCoins() {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
  return api(url);
}

function getGlobal() {
  return api('https://api.coingecko.com/api/v3/global');
}

function getTrending() {
  return api('https://api.coingecko.com/api/v3/search/trending');
}

function getFearGreed() {
  return api('https://api.alternative.me/fng/?limit=1');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. TELEGRAM API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function tgMethod(token, method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.description);
      return d;
    } catch (e) {
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
// 6. KEYBOARDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function mainKeyboard(isAdmin) {
  const kb = [
    [{ text: '📊 Prices' }, { text: '📈 Market Report' }],
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
// 7. MESSAGE BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildPrice(coins) {
  let m = `📊 *Live Prices*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const c of coins) {
    const i = COINS[c.id];
    if (!i) continue;
    m += `${i.emoji} *${i.symbol}*  —  $${fmt.price(c.current_price)}\n`;
    m += `   ${fmt.change(c.price_change_percentage_24h)}\n\n`;
  }
  m += `━━━━━━━━━━━━━━━━━━━━\n🕒 ${fmt.time()} UTC`;
  return m;
}

async function buildVolume(coins) {
  let m = `📈 *Volume & Market Cap*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const c of coins) {
    const i = COINS[c.id];
    if (!i) continue;
    m += `${i.emoji} *${i.symbol}*  —  $${fmt.price(c.current_price)}\n`;
    m += `   📊 Vol 24H: ${fmt.vol(c.total_volume)}\n`;
    m += `   🏦 Cap: ${fmt.cap(c.market_cap)}\n\n`;
  }
  m += `━━━━━━━━━━━━━━━━━━━━\n🕒 ${fmt.time()} UTC`;
  return m;
}

async function buildDaily(coins, globalData, trending, fear) {
  const sorted = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  let m = `📉 *Daily Market Report*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

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
    m += `   24H: ${fmt.change(c.price_change_percentage_24h)}  |  Cap: ${fmt.cap(c.market_cap)}\n\n`;
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
// 8. KV HELPERS
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
// 9. CORE LOGIC
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
// 10. CHANNEL SENDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendChannelPrice(env) {
  const coins = await getCoins();
  await checkAlerts(env, coins);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildPrice(coins));
}

async function sendChannelVolume(env) {
  const coins = await getCoins();
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildVolume(coins));
}

async function sendChannelDaily(env) {
  const [coins, globalData, trending, fear] = await Promise.all([
    getCoins(), getGlobal(), getTrending(), getFearGreed(),
  ]);
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildDaily(coins, globalData, trending, fear));
}

async function sendChannelTrending(env) {
  const trending = await getTrending();
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildTrending(trending));
}

async function sendChannelFng(env) {
  const fear = await getFearGreed();
  await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildFng(fear));
}

async function sendChannelAll(env) {
  await sendChannelPrice(env);
  await sendChannelVolume(env);
  await sendChannelDaily(env);
  await sendChannelTrending(env);
  await sendChannelFng(env);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. BOT HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleStart(chatId, userId, env) {
  const admin = isAdmin(userId, env);
  const text = admin
    ? '👋 *Welcome Admin!*\n\nTradeAgent IV Control Panel.\nSelect an option:'
    : '👋 *Welcome to TradeAgent IV!*\n\nCrypto Dashboard.\nSelect an option:';
  await sendMessage(env, chatId, text, mainKeyboard(admin));
}

async function handlePrices(chatId, env) {
  const coins = await getCoins();
  await sendMessage(env, chatId, await buildPrice(coins));
}

async function handleVolume(chatId, env) {
  const coins = await getCoins();
  await sendMessage(env, chatId, await buildVolume(coins));
}

async function handleDaily(chatId, env) {
  const [coins, globalData, trending, fear] = await Promise.all([
    getCoins(), getGlobal(), getTrending(), getFearGreed(),
  ]);
  await sendMessage(env, chatId, await buildDaily(coins, globalData, trending, fear));
}

async function handleTrending(chatId, env) {
  const trending = await getTrending();
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
  await sendMessage(env, chatId, `⚙️ *Settings*\n\nChannel: ${env.TELEGRAM_CHANNEL_ID || 'Not set'}\nCron Jobs: Active\n\nUse /admin for admin panel.`);
}

async function handleAdmin(chatId, env) {
  await sendMessage(env, chatId, `📣 *Admin Panel*\n\nChoose what to send to channel:`, adminInline);
}

async function handleHelp(chatId, env, userId) {
  const admin = isAdmin(userId, env);
  let text = `📖 *Commands*\n\n`;
  text += `/start — Main menu\n`;
  text += `/price — Live prices\n`;
  text += `/volume — Volume & Market Cap\n`;
  text += `/daily — Daily report\n`;
  text += `/trending — Trending coins\n`;
  text += `/fng — Fear & Greed Index\n`;
  text += `/alerts — Alert settings\n`;
  text += `/settings — Bot settings\n`;
  if (admin) {
    text += `\n*Admin Commands:*\n`;
    text += `/admin — Admin panel\n`;
    text += `/sendprice — Send price to channel\n`;
    text += `/senddaily — Send daily to channel\n`;
  }
  await sendMessage(env, chatId, text);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. WEBHOOK PROCESSOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function processWebhook(update, env) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';

    if (text === '/start') {
      await handleStart(chatId, userId, env);
    } else if (text === '/price' || text === '📊 Prices') {
      await handlePrices(chatId, env);
    } else if (text === '/volume' || text === '📈 Market Report') {
      await handleVolume(chatId, env);
    } else if (text === '/daily') {
      await handleDaily(chatId, env);
    } else if (text === '/trending') {
      await handleTrending(chatId, env);
    } else if (text === '/fng' || text === '🧠 Fear & Greed') {
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
      await handleAdmin(chatId, env);
    } else if (text === '/sendprice') {
      if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
      await sendMessage(env, chatId, '⏳ Sending price to channel...');
      await sendChannelPrice(env);
      await sendMessage(env, chatId, '✅ Price sent to channel!');
    } else if (text === '/senddaily') {
      if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
      await sendMessage(env, chatId, '⏳ Sending daily to channel...');
      await sendChannelDaily(env);
      await sendMessage(env, chatId, '✅ Daily report sent to channel!');
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
        await editMessage(env, chatId, msgId, '✅ *Sent to channel successfully!*', adminInline);
      } catch (e) {
        await editMessage(env, chatId, msgId, `❌ *Error:* ${e.message}`, adminInline);
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
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. CRON HANDLER
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
// 14. HTTP HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleHttp(request, env) {
  const url = new URL(request.url);

  // Telegram Webhook (POST without x-admin-secret header)
  if (request.method === 'POST' && !request.headers.get('x-admin-secret')) {
    try {
      const update = await request.json();
      if (update.update_id) {
        await processWebhook(update, env);
        return new Response('OK', { status: 200 });
      }
    } catch (e) {
      // Not a valid Telegram update, fall through to manual trigger
    }
  }

  // Manual trigger (requires secret)
  if (request.method === 'POST') {
    if (!checkSecret(request, env)) {
      return new Response('Forbidden', { status: 403 });
    }
    const type = url.searchParams.get('type') || 'price';
    try {
      if (type === 'price')    await sendChannelPrice(env);
      if (type === 'volume')   await sendChannelVolume(env);
      if (type === 'daily')    await sendChannelDaily(env);
      if (type === 'trending') await sendChannelTrending(env);
      if (type === 'fng')      await sendChannelFng(env);
      if (type === 'all')      await sendChannelAll(env);
      if (type === 'alert') {
        const coins = await getCoins();
        await checkAlerts(env, coins);
      }
      return new Response('✅ Sent!', { status: 200 });
    } catch (e) {
      return new Response(`❌ ${e.message}`, { status: 500 });
    }
  }

  // GET — Info
  return new Response(
    `TradeAgent IV Bot\n\nWebhook: POST / (Telegram updates)\nManual: POST /?type=price|volume|daily|trending|fng|all|alert\nHeader: x-admin-secret required for manual\n`,
    { status: 200 }
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  async fetch(request, env, ctx) {
    return handleHttp(request, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(event.cron, env));
  },
};
