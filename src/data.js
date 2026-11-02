// TradeAgent IV — market data: price failover, movers, futures, global, trending, F&G.
import { COINS, COIN_IDS, BINANCE_MAP, SYMBOL_TO_ID, CMC_SYMBOLS, COINGECKO_BASE, CMC_BASE, FNG_URL, EMOTION_STATES } from './config.js';
import { fetchWithTimeout } from './utils.js';

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

// Guard: a renamed upstream ID must log loudly, never silently drop a coin.
function missingCoinIds(data) {
  const got = new Set((data || []).map(c => c.id));
  return Object.keys(COINS).filter(id => !got.has(id));
}

function checkedCoins(source, data) {
  const missing = missingCoinIds(data);
  if (missing.length) console.error(`[API] ${source} missing coins: ${missing.join(', ')}`);
  return { source, data };
}

async function getCoins(env) {
  try { const cg = await getCoinsCG(env); if (cg?.length) return checkedCoins('CoinGecko', cg); } catch (e) { console.error('[API] CG fail:', e.message); }
  try { const cmc = await getCoinsCMC(env); if (cmc?.length) return checkedCoins('CoinMarketCap', cmc); } catch (e) { console.error('[API] CMC fail:', e.message); }
  try { const bin = await getCoinsBinance(); if (bin?.length) return checkedCoins('Binance', bin); } catch (e) { console.error('[API] Binance fail:', e.message); }
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
    
    const STABLE_BASES = new Set(['USDC', 'FDUSD', 'TUSD', 'DAI', 'USD1', 'USDP', 'EUR', 'GBP']);
    const mapped = data
      .filter(t => t.symbol.endsWith('USDT')
        && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol)
        && parseFloat(t.quoteVolume) > 5000000)
      .map(t => ({
        symbol: t.symbol.replace(/USDT$/, ''),
        current_price: parseFloat(t.lastPrice),
        price_change_percentage_24h: parseFloat(t.priceChangePercent),
      }))
      .filter(t => !STABLE_BASES.has(t.symbol))
      .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    
    if (!mapped.length) {
      console.error('[API] Binance movers: no mapped coins found');
      return null;
    }
    
    console.log(`[API] Binance movers: ${mapped.length} market pairs mapped`);
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

export { calculateEmotionState, api, getCoinsCG, getCoinsCMC, getCoinsBinance, missingCoinIds, getCoins, getTopGainersLosersBinance, getTopGainersLosers, getCategories, getMarketChart, getBinanceFutures, getGlobal, getTrending, getFearGreed };
