// TradeAgent IV — Market State (v6 §1): ONE structured snapshot of the
// whole market per cycle. Every source is fail-soft (a dead source yields
// null fields, never a dead state); prices are the only hard requirement —
// if all price APIs fail, buildMarketState throws and callers stay silent.
import { COINS, COINGECKO_BASE } from './config.js';
import { getCoins, getGlobal, getFearGreed, getBinanceFutures, api } from './data.js';
import { fetchWithTimeout } from './utils.js';

const safe = (label, fn) => fn().catch((e) => { console.error(`[STATE] ${label}:`, e.message); return null; });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── New sources (all free, no key — live-verified 2026-11-02) ──────────

async function getDeribit() {
  const now = Date.now();
  const [ticker, dvol] = await Promise.all([
    api('https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL'),
    api(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=${now - 86400000}&end_timestamp=${now}&resolution=3600`),
  ]);
  const rows = dvol?.result?.data || [];
  return {
    oiUsd: ticker?.result?.open_interest ?? null,
    dvol: rows.length ? rows[rows.length - 1][4] : null,
  };
}

async function getMempool() {
  const [fees, hr] = await Promise.all([
    safe('mempool fees', () => api('https://mempool.space/api/v1/fees/recommended')),
    safe('mempool hashrate', () => api('https://mempool.space/api/v1/mining/hashrate/3d')),
  ]);
  return {
    feeFast: fees?.fastestFee ?? null,
    feeHalfHour: fees?.halfHourFee ?? null,
    hashrateEHs: hr?.currentHashrate ? hr.currentHashrate / 1e18 : null,
  };
}

async function getDefi() {
  const [chains, stables] = await Promise.all([
    api('https://api.llama.fi/v2/chains'),
    api('https://stablecoins.llama.fi/stablecoins?includePrices=false'),
  ]);
  const tvl = Array.isArray(chains) ? chains.reduce((a, c) => a + (c.tvl || 0), 0) : null;
  const assets = stables?.peggedAssets || [];
  const sum = (k) => assets.reduce((a, x) => a + (x[k]?.peggedUSD || 0), 0);
  const supply = assets.length ? sum('circulating') : null;
  const prevWeek = assets.length ? sum('circulatingPrevWeek') : null;
  return {
    tvl,
    stableSupply: supply,
    stableDelta7dPct: supply && prevWeek ? ((supply - prevWeek) / prevWeek) * 100 : null,
  };
}

async function getMacro() {
  const norm = (arr) => (Array.isArray(arr) ? arr : []).map((e) => ({
    title: e.title, country: e.country, impact: e.impact,
    ts: Date.parse(e.date), forecast: e.forecast || '', previous: e.previous || '', actual: e.actual || '',
  })).filter((e) => !isNaN(e.ts));
  const events = norm(await api('https://nfs.faireconomy.media/ff_calendar_thisweek.json'));
  if (!events.length) return null;
  const nextWeek = norm(await safe('macro nextweek', () => api('https://nfs.faireconomy.media/ff_calendar_nextweek.json')) || []);
  const now = Date.now();
  const tehranToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
  const ahead = [...events, ...nextWeek].filter((e) => e.ts > now && /high/i.test(e.impact || '')).sort((a, b) => a.ts - b.ts).slice(0, 10);
  return {
    today: events.filter((e) => new Date(e.ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }) === tehranToday),
    nextHighImpact: ahead[0] || null,
    ahead,
  };
}

const NEWS_FEEDS = [
  ['CoinTelegraph', 'https://cointelegraph.com/rss'],
  ['Decrypt', 'https://decrypt.co/feed'],
  ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
];
const NEWS_HOT = /hack|exploit|cpi|fomc|federal reserve|rate (cut|hike)|inflation/i;
const NEWS_KEEP = /fed|fomc|cpi|inflation|etf|sec\b|hack|exploit|tariff|liquidat|treasury|oil|war|rate/i;

async function getNews() {
  const items = [];
  await Promise.all(NEWS_FEEDS.map(async ([src, url]) => {
    try {
      const r = await fetchWithTimeout(url, {}, 10000);
      if (!r.ok) return;
      const xml = await r.text();
      for (const m of xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>/g)) {
        const title = m[1].replace(/<[^>]+>/g, '').trim();
        if (title && NEWS_KEEP.test(title)) items.push({ title, src, ts: Date.parse(m[2]) || 0, impact: NEWS_HOT.test(title) ? 'high' : 'normal' });
      }
    } catch (e) { console.error('[STATE] RSS', src, e.message); }
  }));
  return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
}

async function getBtcSpark(env) {
  const key = env.COINGECKO_API_KEY;
  if (!key) return null;
  const data = await api(`${COINGECKO_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=7`, { headers: { 'x-cg-demo-api-key': key } });
  const prices = (data?.prices || []).map((p) => p[1]);
  if (prices.length < 8) return null;
  const step = Math.max(1, Math.floor(prices.length / 200));
  return prices.filter((_, i) => i % step === 0);
}

// ── Regime Engine v2 (plan §2): purely computational, no AI ────────────

function computeRegime(s, prev = null) {
  const btc = (s.prices || []).find((c) => c.id === 'bitcoin') || {};
  const btc24 = btc.price_change_percentage_24h || 0;
  const btc7d = btc.price_change_percentage_7d_in_currency || 0;
  const fng = s.fearGreed?.now ?? 50;
  const fngDelta = (s.fearGreed?.now != null && s.fearGreed?.yday != null) ? s.fearGreed.now - s.fearGreed.yday : 0;
  const funding = s.derivatives?.fundingBtc ?? null;        // % per 8h
  const oiDelta = s.derivatives?.oiDeltaPct ?? null;        // vs prev state
  const dvol = s.derivatives?.dvol ?? null;
  const stableDelta = s.defi?.stableDelta7dPct ?? null;

  const parts = []; // {txt, w} — w = signed contribution
  const add = (txt, w) => { if (w) parts.push({ txt, w }); };
  add(`BTC 7d ${btc7d >= 0 ? '+' : ''}${btc7d.toFixed(1)}%`, clamp(btc7d, -15, 15) * 1.2);
  add(`BTC 24h ${btc24 >= 0 ? '+' : ''}${btc24.toFixed(1)}%`, clamp(btc24, -10, 10) * 1.0);
  add(`Fear & Greed ${fng}${fngDelta ? ` (${fngDelta >= 0 ? '+' : ''}${fngDelta})` : ''}`, (fng - 50) * 0.35 + clamp(fngDelta, -15, 15) * 0.8);
  if (stableDelta != null) add(`Stablecoin supply 7d ${stableDelta >= 0 ? '+' : ''}${stableDelta.toFixed(2)}%`, clamp(stableDelta, -3, 3) * 3);
  if (funding != null && funding > 0.05) add(`Funding hot at ${funding.toFixed(3)}%`, -8);
  if (funding != null && funding < -0.03) add(`Funding negative at ${funding.toFixed(3)}% (shorts crowded)`, 6);
  if (dvol != null && dvol > 60) add(`DVOL elevated at ${dvol.toFixed(0)}`, -5);

  const score = Math.round(clamp(50 + parts.reduce((a, p) => a + p.w, 0), 0, 100));
  let label = score >= 62 ? 'RISK_ON' : score <= 38 ? 'RISK_OFF' : 'RANGE';
  if (fng <= 15 && btc7d < -8) label = 'CAPITULATION';
  else if (fng >= 82 && btc7d > 8) label = 'EUPHORIA';
  else if (funding != null && Math.abs(funding) > 0.05 && oiDelta != null && oiDelta > 5) label = 'SQUEEZE_RISK';

  const reasons = parts.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 3).map((p) => p.txt);
  return { label, score, reasons };
}

// ── Build ────────────────────────────────────────────────────────────────

async function buildMarketState(env, prev = null) {
  const [{ source, data }, globalData, fear] = await Promise.all([getCoins(env), getGlobal(env), getFearGreed()]);
  const [futBtc, futEth, futSol, deribit, onchain, defi, macro, news, btcSpark] = await Promise.all([
    safe('futures BTC', () => getBinanceFutures('BTCUSDT')),
    safe('futures ETH', () => getBinanceFutures('ETHUSDT')),
    safe('futures SOL', () => getBinanceFutures('SOLUSDT')),
    safe('deribit', getDeribit),
    safe('mempool', getMempool),
    safe('defillama', getDefi),
    safe('macro', getMacro),
    safe('news', getNews),
    safe('btc spark', () => getBtcSpark(env)),
  ]);

  const g = globalData?.data || {};
  const oiUsd = deribit?.oiUsd ?? null;
  const prevOi = prev?.derivatives?.oiUsd ?? null;
  const s = {
    ts: Date.now(),
    source,
    prices: data,
    global: {
      marketCap: g.total_market_cap?.usd || 0,
      volume24h: g.total_volume?.usd || 0,
      btcDominance: g.market_cap_percentage?.btc || 0,
    },
    fearGreed: {
      now: fear?.data?.[0] ? parseInt(fear.data[0].value) : null,
      yday: fear?.data?.[1] ? parseInt(fear.data[1].value) : null,
      label: fear?.data?.[0]?.value_classification || null,
    },
    derivatives: {
      fundingBtc: futBtc?.fundingRate ?? null,
      fundingEth: futEth?.fundingRate ?? null,
      fundingSol: futSol?.fundingRate ?? null,
      oiUsd,
      oiDeltaPct: oiUsd && prevOi ? ((oiUsd - prevOi) / prevOi) * 100 : null,
      dvol: deribit?.dvol ?? null,
    },
    onchain,
    defi,
    macro,
    news: news || [],
    btcSpark,
  };
  s.regime = computeRegime(s, prev);
  return s;
}

// Key BTC levels derived from the hourly 7d sparkline (real data only).
function sparkLevels(points) {
  if (!Array.isArray(points) || points.length < 8) return null;
  const last24 = points.slice(-24);
  const mm = (a) => ({ high: Math.max(...a), low: Math.min(...a) });
  return { h24: mm(last24).high, l24: mm(last24).low, h7: mm(points).high, l7: mm(points).low };
}

export { buildMarketState, computeRegime, sparkLevels, getMacro as getMacroEvents };
