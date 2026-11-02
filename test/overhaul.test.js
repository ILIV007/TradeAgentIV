import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COINS, BINANCE_MAP } from '../src/config.js';
import { fmt } from '../src/utils.js';
import { missingCoinIds, getTopGainersLosers, calculateEmotionState } from '../src/data.js';
import { buildAlert, buildAIAnalysis, buildPrice, buildMovers, buildTrending, buildFng } from '../src/posts.js';
import { buildAIPrompt, isValidAIResponse } from '../src/ai.js';
import { DEDUP_SKIPPED } from '../src/store.js';

test('coin list uses current CoinGecko IDs (renamed coins not dropped)', () => {
  assert.equal(Object.keys(COINS).length, 32);
  for (const id of ['polygon-ecosystem-token', 'injective-protocol', 'dogwifcoin']) {
    assert.ok(COINS[id], `missing ${id}`);
    assert.ok(BINANCE_MAP[id], `no Binance pair for ${id}`);
  }
  for (const dead of ['polygon', 'injective', 'dogwifhat']) assert.ok(!COINS[dead], `dead id ${dead}`);
});

test('missingCoinIds reports exactly the absent coins', () => {
  const full = Object.keys(COINS).map(id => ({ id }));
  assert.deepEqual(missingCoinIds(full), []);
  const partial = full.filter(c => c.id !== 'injective-protocol');
  assert.deepEqual(missingCoinIds(partial), ['injective-protocol']);
  assert.equal(missingCoinIds(null).length, 32);
});

test('buildAlert: valid HTML, percentage move shown', () => {
  const msg = buildAlert('bitcoin', 80000, 'above', 5.24);
  assert.ok(!msg.includes('<<blockquote>'));
  assert.ok(msg.includes('<blockquote>'));
  assert.ok(msg.includes('BIG MOVE UP'));
  assert.ok(msg.includes('+5.24%'));
});

const todayFixture = {
  date: '2026-11-02', mode: 'normal',
  btcPrice: 78058, btcChange: 0.23, ethPrice: 2283, ethChange: 0.61, solPrice: 94.25, solChange: -1.33,
  totalMarketCap: 2.61e12, totalVolume: 48.09e9, btcDominance: 59.96618263803912, fearGreed: 37,
  futures: { BTCUSDT: { fundingRate: null, openInterest: null, longShortRatio: null } },
};

test('AI post rounds BTC dominance and omits empty Futures Pulse', async () => {
  const ai = { text: '<b>Market Overview</b> — Calm.<b>Bullish Factors</b> — Some.\n---PERSIAN---\n<b>خلاصه بازار</b>\n• یک• دو', source: 'Gemini' };
  const msg = await buildAIAnalysis(ai, todayFixture, null);
  assert.ok(msg.includes('60.0%'));
  assert.ok(!msg.includes('59.966'));
  assert.ok(!msg.includes('Futures Pulse'));
});

test('AI post un-glues sections, Persian bullets and keeps first Persian char', async () => {
  const ai = { text: '<b>Market Overview</b> — Calm.<b>Bullish Factors</b> — Some.\n---PERSIAN---\n<b>خلاصه بازار</b>\n• اول• دوم• سوم ⚠️ This analysis is for informational purposes only and is not financial advice.', source: 'Gemini' };
  const msg = await buildAIAnalysis(ai, todayFixture, null);
  assert.ok(msg.includes('Calm.\n\n<b>Bullish Factors</b>'));
  assert.ok(msg.includes('<b>خلاصه بازار</b>'));
  assert.ok(msg.includes('• اول\n• دوم\n• سوم'));
});

test('snapshot v2: context line, best/weakest, tier-2 7d', async () => {
  const coins = [
    { id: 'bitcoin', current_price: 78000, price_change_percentage_24h: 1.5, price_change_percentage_7d_in_currency: -2 },
    { id: 'chainlink', current_price: 11, price_change_percentage_24h: -4, price_change_percentage_7d_in_currency: -9.5 },
  ];
  const msg = await buildPrice(coins, 'CoinGecko', { btcDominance: '60.0', fearGreed: 37 });
  assert.ok(msg.includes('₿ Dom: 60.0%'));
  assert.ok(msg.includes('🧠 F&G: 37/100'));
  assert.ok(msg.includes('Tehran'));
  assert.ok(msg.includes('Best:</b> BTC'));
  assert.ok(msg.includes('Weakest:</b> LINK'));
  assert.ok(msg.includes('7d:-9.5%'), 'tier-2 shows 7d change');
});

test('movers: tracked coins starred, untracked not', async () => {
  const msg = await buildMovers({
    gainers: [{ symbol: 'BTC', current_price: 78000, price_change_percentage_24h: 5 }, { symbol: 'XYZ', current_price: 1, price_change_percentage_24h: 50 }],
    losers: [{ symbol: 'DOGE', current_price: 0.07, price_change_percentage_24h: -8 }],
  });
  assert.ok(msg.includes('⭐BTC'));
  assert.ok(!msg.includes('⭐XYZ'));
  assert.ok(msg.includes('⭐DOGE'));
});

test('movers source is market-wide (Binance, volume-filtered, no leveraged/stable)', async () => {
  const payload = [
    { symbol: 'BTCUSDT', lastPrice: '78000', priceChangePercent: '5', quoteVolume: '900000000' },
    { symbol: 'XYZUSDT', lastPrice: '2', priceChangePercent: '50', quoteVolume: '20000000' },
    { symbol: 'USDCUSDT', lastPrice: '1', priceChangePercent: '0.1', quoteVolume: '500000000' },
    { symbol: 'BTCUPUSDT', lastPrice: '10', priceChangePercent: '99', quoteVolume: '50000000' },
    { symbol: 'TINYUSDT', lastPrice: '1', priceChangePercent: '500', quoteVolume: '100' },
    { symbol: 'ETHUSDT', lastPrice: '2300', priceChangePercent: '-7', quoteVolume: '400000000' },
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => payload });
  try {
    const gl = await getTopGainersLosers({});
    assert.equal(gl.gainers[0].symbol, 'XYZ', 'market-wide top gainer, not just tracked coins');
    assert.ok(!gl.gainers.some(g => ['USDC', 'BTCUP', 'TINY'].includes(g.symbol)));
    assert.equal(gl.losers[0].symbol, 'ETH');
  } finally { globalThis.fetch = realFetch; }
});

test('trending shows live price when a map is provided', async () => {
  const trending = { coins: [{ item: { symbol: 'BTC', name: 'Bitcoin', market_cap_rank: 1 } }] };
  const msg = await buildTrending(trending, { BTC: { price: 78000, change: 1.5 } });
  assert.ok(msg.includes('$78,000'));
});

test('F&G shows yesterday delta', async () => {
  const fear = { data: [{ value: '37', value_classification: 'Fear' }, { value: '30', value_classification: 'Fear' }] };
  const msg = await buildFng(fear);
  assert.ok(msg.includes('Yesterday: 30/100 (▲ 7)'));
});

test('AI prompt: fresh structure with separator contract and data', () => {
  const today = {
    date: '2026-11-02', coins: [{ id: 'bitcoin', current_price: 78000, price_change_percentage_24h: 1, price_change_percentage_7d_in_currency: -2, price_change_percentage_30d_in_currency: -5, total_volume: 1e9 }],
    totalMarketCap: 2.6e12, totalVolume: 5e10, btcDominance: 60, fearGreed: 37, fearClassification: 'Fear',
    trending: [], futures: {}, gainersLosers: null,
  };
  const p = buildAIPrompt(today, {}, 'normal', 'neutral', { state: 'NEUTRAL', intensity: 44, tone: 'Neutral, factual.' });
  assert.ok(p.includes('Five hard rules'));
  assert.ok(p.includes('---PERSIAN---'));
  assert.ok(p.includes('BTC: $78,000'));
  assert.ok(p.includes('BTC Dominance: 60.0%'));
});

test('AI validation accepts a well-formed bilingual answer, rejects junk', () => {
  const good = '<b>Market Overview</b> ' + 'x'.repeat(120) + '\n<b>Bullish Factors</b> y\n<b>Risk Factors</b> z\n<b>Conclusion</b> done\n---PERSIAN---\n<b>خلاصه بازار</b>\n• نتیجه روشن است';
  assert.equal(isValidAIResponse(good), true);
  assert.equal(isValidAIResponse('too short'), false);
  assert.equal(isValidAIResponse(null), false);
});

test('emotion engine states', () => {
  assert.equal(calculateEmotionState({ btcChange: -30, ethChange: -20, fearGreed: 5 }).state, 'PANIC');
  assert.equal(calculateEmotionState({ btcChange: 0, ethChange: 0, fearGreed: 50 }).state, 'NEUTRAL');
  assert.equal(calculateEmotionState({ btcChange: 20, ethChange: 15, fearGreed: 90 }).state, 'FOMO');
});

test('fmt sanity + dedup sentinel', () => {
  assert.equal(fmt.price(1234.5), '1,235');
  assert.equal(fmt.cap(2.61e12), '$2.61T');
  assert.match(fmt.tehran(), /\d{2}:\d{2}/);
  assert.equal(DEDUP_SKIPPED, 'dedup-skipped');
});

test('rich snapshot v8: content chart, tier1 open, long tiers collapsible, quote footer', async () => {
  const { buildRichSnapshot, chartUrl } = await import('../src/rich.js');
  const fixture = Object.keys((await import('../src/config.js')).COINS).map((id, i) => ({ id, current_price: 100 + i, price_change_percentage_24h: i - 10, price_change_percentage_7d_in_currency: i - 5 }));
  fixture[0] = { ...fixture[0], id: 'bitcoin', current_price: 111, price_change_percentage_24h: 1.2 };
  const spark = Array.from({ length: 168 }, (_, i) => 100 + Math.sin(i / 9) * 5 + i / 20);
  const html = buildRichSnapshot(fixture, 'CoinGecko', { btcDominance: '60.0', fearGreed: 37, best: 'BTC +1.0%', weakest: 'SOL -1.4%', btcSpark: spark });
  assert.ok(chartUrl([1, 2]) === null && chartUrl(spark).startsWith('https://quickchart.io/'));
  assert.ok(html.includes('<figure><img src="https://quickchart.io/chart') && html.includes('<h3>📊 BTC $111.00 — risk-on</h3>'));
  assert.ok(html.includes('striped compact'));
  assert.ok((html.match(/<details>/g) || []).length === 2 && html.indexOf('<table') < html.indexOf('<details>'));
  assert.ok(html.includes('<blockquote>📡 TradeAgent IV · AI Crypto Intelligence · @TradeAgentIV</blockquote>'));
  assert.ok(html.includes('🟢') && html.includes('🔴'));
  assert.ok(!html.includes('tg-button') && !html.includes('Tehran'));
  assert.ok(html.length < 32768);
});

test('regime engine: risk-on, capitulation and squeeze are computational', async () => {
  const { computeRegime } = await import('../src/state.js');
  const base = { prices: [{ id: 'bitcoin', price_change_percentage_24h: 3, price_change_percentage_7d_in_currency: 9 }], fearGreed: { now: 72, yday: 63 }, derivatives: { fundingBtc: 0.01, oiDeltaPct: 2, dvol: 45 }, defi: { stableDelta7dPct: 0.8 } };
  const on = computeRegime(base);
  assert.equal(on.label, 'RISK_ON');
  assert.ok(on.score >= 62 && on.reasons.length === 3 && on.reasons.some(r => r.includes('BTC 7d')));

  const cap = computeRegime({ ...base, prices: [{ id: 'bitcoin', price_change_percentage_24h: -6, price_change_percentage_7d_in_currency: -14 }], fearGreed: { now: 11, yday: 20 } });
  assert.equal(cap.label, 'CAPITULATION');

  const sq = computeRegime({ prices: [{ id: 'bitcoin', price_change_percentage_24h: 0.5, price_change_percentage_7d_in_currency: 1 }], fearGreed: { now: 50, yday: 50 }, derivatives: { fundingBtc: 0.09, oiDeltaPct: 8, dvol: 40 }, defi: null });
  assert.equal(sq.label, 'SQUEEZE_RISK');
});

test('market state assembles all sources and survives dead ones', async () => {
  const realFetch = globalThis.fetch;
  const coins = Object.keys(COINS).map((id, i) => ({ id, current_price: 100 + i, price_change_percentage_24h: 1, price_change_percentage_7d_in_currency: 2, price_change_percentage_30d_in_currency: 3, total_volume: 10, market_cap: 10 }));
  const route = (url) => {
    const u = String(url);
    if (u.includes('deribit.com') || u.includes('mempool.space')) throw new Error('dead source');
    if (u.includes('/coins/markets')) return coins;
    if (u.includes('/global')) return { data: { total_market_cap: { usd: 3e12 }, total_volume: { usd: 1e11 }, market_cap_percentage: { btc: 57.5 } } };
    if (u.includes('market_chart')) return { prices: Array.from({ length: 50 }, (_, i) => [i, 100 + i]) };
    if (u.includes('alternative.me')) return { data: [{ value: '60', value_classification: 'Greed' }, { value: '55', value_classification: 'Greed' }] };
    if (u.includes('fapi.binance.com/fapi/v1/premiumIndex')) return { lastFundingRate: '0.0002' };
    if (u.includes('openInterest')) return { openInterest: '1000' };
    if (u.includes('globalLongShortAccountRatio')) return [{ longShortRatio: '1.2' }];
    if (u.includes('api.llama.fi/v2/chains')) return [{ tvl: 100 }, { tvl: 50 }];
    if (u.includes('stablecoins.llama.fi')) return { peggedAssets: [{ circulating: { peggedUSD: 200 }, circulatingPrevWeek: { peggedUSD: 190 } }] };
    if (u.includes('faireconomy')) return [];
    return {};
  };
  globalThis.fetch = async (url) => {
    const body = route(url);
    return { ok: true, status: 200, json: async () => body, text: async () => String(body) };
  };
  try {
    const { buildMarketState } = await import('../src/state.js');
    const s = await buildMarketState({ COINGECKO_API_KEY: 'test' });
    assert.equal(s.prices.length, 32);
    assert.equal(s.fearGreed.now, 60);
    assert.equal(s.fearGreed.yday, 55);
    assert.equal(s.global.btcDominance, 57.5);
    assert.equal(s.derivatives.fundingBtc, 0.02);
    assert.equal(s.derivatives.oiUsd, null); // deribit dead → fail-soft
    assert.ok(s.onchain && s.onchain.feeFast === null && s.onchain.hashrateEHs === null); // dead source degrades to null fields
    assert.equal(s.defi.tvl, 150);
    assert.ok(Math.abs(s.defi.stableDelta7dPct - 5.26) < 0.01);
    assert.ok(Array.isArray(s.btcSpark) && s.btcSpark.length >= 8);
    assert.ok(s.regime && typeof s.regime.score === 'number' && Array.isArray(s.regime.reasons));
  } finally { globalThis.fetch = realFetch; }
});

const v6State = () => ({
  ts: Date.now(), source: 'CoinGecko',
  prices: [
    { id: 'bitcoin', current_price: 77910, price_change_percentage_24h: -0.2, price_change_percentage_7d_in_currency: -3.1, price_change_percentage_30d_in_currency: -5, total_volume: 4e10, market_cap: 1.5e12 },
    { id: 'ethereum', current_price: 2560, price_change_percentage_24h: 0.8, price_change_percentage_7d_in_currency: -1.2, price_change_percentage_30d_in_currency: -2, total_volume: 2e10, market_cap: 3e11 },
    { id: 'solana', current_price: 190, price_change_percentage_24h: 1.5, price_change_percentage_7d_in_currency: 2.5, price_change_percentage_30d_in_currency: 1, total_volume: 5e9, market_cap: 9e10 },
  ],
  global: { marketCap: 3.9e12, volume24h: 1.6e11, btcDominance: 57.4 },
  fearGreed: { now: 60, yday: 55, label: 'Greed' },
  derivatives: { fundingBtc: 0.01, fundingEth: 0.012, fundingSol: 0.02, oiUsd: 6.5e8, oiDeltaPct: 1.2, dvol: 38.5 },
  onchain: { feeFast: 2, feeHalfHour: 2, hashrateEHs: 1049 },
  defi: { tvl: 8.55e10, stableSupply: 2.987e11, stableDelta7dPct: -1.39 },
  macro: { today: [{ title: 'ISM Manufacturing PMI', country: 'USD', impact: 'High', ts: Date.now() + 3600000, forecast: '48.5', previous: '48.2', actual: '' }], nextHighImpact: null, ahead: [] },
  news: [{ title: 'Bitcoin holds steady ahead of PMI', src: 'Decrypt', ts: Date.now(), impact: 'normal' }],
  btcSpark: Array.from({ length: 168 }, (_, i) => 79000 - i * 6 + Math.sin(i / 8) * 300),
  regime: { label: 'RANGE', score: 52, reasons: ['Fear & Greed 60 (+5)'] },
  _levels: { h24: 78500, l24: 77200, h7: 81500, l7: 76800 },
});

const flagshipDraft = `===VERDICT===
Bitcoin is range-bound at $77,910 with greed rebuilding — the PMI print is today's ranked driver.
===OVERVIEW===
BTC trades at $77,910, down 0.2% on the day and 3.1% on the week. Fear and Greed sits at 60, up from 55 yesterday. Dominance is 57.4%.
===DRIVERS===
1. Stablecoin outflows — supply is $298.7B, down 1.39% in 7 days, so sideline money is shrinking
2. Calm leverage — funding is 0.01% and DVOL is 38.5, with Deribit open interest at $650M (up 1.2%)
3. Quiet network, steady structure — fees are 2 sat/vB and price holds above the 24h low of $77,200 inside the $76,800 to $81,500 range
===SCENARIOS===
===SCENARIO:BASE===
Lean: FLAT
Level: NONE
Side: NONE
Text: While BTC holds between $76,800 and $81,500, the range persists and dips toward $77,200 keep attracting bids.
===SCENARIO:BULL===
Lean: UP
Level: 81500
Side: ABOVE
Text: A daily close above $81,500 breaks the 7-day high and opens continuation toward fresh momentum.
===SCENARIO:BEAR===
Lean: DOWN
Level: 76800
Side: BELOW
Text: A break below $76,800, the 7-day low, would confirm a deeper correction leg.
===WATCH===
ISM Manufacturing PMI lands today; forecast 48.5 versus 48.2 previous.
===INVALIDATION===
A daily close outside $76,800–$81,500 invalidates the range read.
===PERSIAN===
حکم: بیت‌کوین در محدوده $76,800 تا $81,500 نوسان می‌کند و بازار آرام و خنثی است
سطوح: حمایت $77,200 و مقاومت $81,500 سطوح کلیدی امروزند
سناریو: سناریوی پایه ادامه نوسان در همین محدوده است؛ شکست هر سمت، مسیر بعدی را مشخص می‌کند
مراقبت: داده PMI امروز با پیش‌بینی 48.5 مهم‌ترین رویداد پیش روست`;

test('v6 grounding validator: state numbers pass, invented levels fail', async () => {
  const { validateGrounded } = await import('../src/ai.js');
  const s = v6State();
  assert.ok(validateGrounded('BTC at $77,910, dominance 57.4%, F&G 60, DVOL 38.5', s).ok);
  const bad = validateGrounded('BTC will bounce from the $64,250 support zone', s);
  assert.equal(bad.ok, false);
  assert.ok(bad.bad.includes(64250));
});

test('v6 flagship: structure + grounding validation and parsing', async () => {
  const { validateFlagship, parseFlagship } = await import('../src/ai.js');
  const s = v6State();
  const v = validateFlagship(flagshipDraft, s);
  assert.ok(v.ok, v.errors.join('; '));
  assert.equal(v.parsed.scenarios.length, 3);
  assert.equal(v.parsed.scenarios[1].level, 81500);
  assert.equal(v.parsed.scenarios[1].side, 'ABOVE');

  const invented = flagshipDraft.replace('$81,500', '$91,500').replace('81500', '91500');
  assert.equal(validateFlagship(invented, s).ok, false);
  const noScenarios = flagshipDraft.split('===SCENARIOS===')[0];
  assert.equal(validateFlagship(noScenarios, s).ok, false);
  const p = parseFlagship(flagshipDraft);
  assert.ok(p.verdict.includes('range-bound') && p.invalidation.includes('invalidates'));
});

test('v6 rich builders render all four products in the approved pattern', async () => {
  const { buildRichMorningBrief, buildRichFlagship, buildRichEventFlash, buildRichWeekly } = await import('../src/rich.js');
  const { parseFlagship } = await import('../src/ai.js');
  const s = v6State();
  const brief = buildRichMorningBrief(s, 'Monday 2 November');
  assert.ok(brief.includes('Morning Brief') && brief.includes('Overnight — the majors') && brief.includes('Overnight movers') && brief.includes('Market totals') && !brief.includes('<figure>'));
  const flag = buildRichFlagship(s, parseFlagship(flagshipDraft));
  assert.ok(flag.includes('<aside>') && flag.includes('TradeAgent IV — Market Analysis') && flag.includes('Market in numbers') && (flag.match(/<details>/g) || []).length === 3);
  assert.ok(flag.includes('<blockquote expandable>') && flag.includes('جمع‌بندی فارسی') && !flag.includes('<figure>'));
  const ev = { title: 'ISM Manufacturing PMI', country: 'USD', impact: 'High', ts: Date.now(), forecast: '48.5', previous: '48.2', actual: '49.1' };
  const flash = buildRichEventFlash(s, ev, 'PMI beat expectations at 49.1.');
  assert.ok(flash.includes('Event Flash') && flash.includes('<b>49.1</b>'));
  const weekly = buildRichWeekly(s, { regimePath: 'Mon RANGE 52', scorecard: { posts: 4, baseFired: 2, bullFired: 1, bullHit: 1, bearFired: 1, bearHit: 0 } });
  assert.ok(weekly.includes('Weekly Deep Dive') && weekly.includes('scorecard') && weekly.includes('2/4'));
  for (const html of [brief, flag, flash, weekly]) assert.ok(html.includes('<blockquote>📡 TradeAgent IV') && html.length < 32768);
});

test('v6 scorecard: triggers and follow-through are graded from the price path', async () => {
  const { evaluateScorecard } = await import('../src/senders.js');
  const t0 = 1700000000000;
  const rec = { ts: t0, btc: 77910, scenarios: [
    { kind: 'BASE', lean: 'FLAT', level: null, side: 'NONE' },
    { kind: 'BULL', lean: 'UP', level: 81500, side: 'ABOVE' },
    { kind: 'BEAR', lean: 'DOWN', level: 76800, side: 'BELOW' },
  ] };
  const pathUp = [{ ts: t0 + 3600000, btc: 79000 }, { ts: t0 + 7200000, btc: 82000 }, { ts: t0 + 90000000, btc: 83500 }];
  const sc = evaluateScorecard([rec], pathUp);
  assert.equal(sc.posts, 1); assert.equal(sc.bullFired, 1); assert.equal(sc.bullHit, 1); assert.equal(sc.baseFired, 0);
  const pathFlat = [{ ts: t0 + 3600000, btc: 78000 }, { ts: t0 + 90000000, btc: 77500 }];
  const sc2 = evaluateScorecard([rec], pathFlat);
  assert.equal(sc2.baseFired, 1); assert.equal(sc2.bullFired, 0);
});

test('v6.1 movers chart + rich movers + macro calendar builders', async () => {
  const { buildRichMovers, buildRichMacroCalendar, moversChartUrl } = await import('../src/rich.js');
  const gl = {
    gainers: [{ symbol: 'HYPE', current_price: 35, price_change_percentage_24h: 12.4 }, { symbol: 'TRX', current_price: 0.28, price_change_percentage_24h: 2.0 }],
    losers: [{ symbol: 'NEAR', current_price: 4.1, price_change_percentage_24h: -6.4 }],
  };
  assert.ok(moversChartUrl(gl.gainers, gl.losers, '24h').includes('horizontalBar'));
  const movers = buildRichMovers(gl);
  assert.ok(movers.includes('<figure>') && movers.includes('Top Movers — 24h') && movers.includes('⭐'));
  const cal = buildRichMacroCalendar(v6State(), 'Monday 2 November');
  assert.ok(cal.includes('Macro Calendar') && cal.includes('ISM Manufacturing PMI') && cal.includes('ForexFactory'));
});

test('v6.1 cron dispatch: products fire by Tehran clock on the 30-min pattern', async () => {
  const { cronDispatch } = await import('../src/senders.js');
  assert.deepEqual(cronDispatch({ weekday: 'Mon', hm: '08:00' }), ['macro']);
  assert.deepEqual(cronDispatch({ weekday: 'Mon', hm: '09:30' }), ['brief']);
  assert.deepEqual(cronDispatch({ weekday: 'Tue', hm: '13:00' }), ['flagship']);
  assert.deepEqual(cronDispatch({ weekday: 'Tue', hm: '21:00' }), ['flagship']);
  assert.deepEqual(cronDispatch({ weekday: 'Fri', hm: '20:00' }), ['weekly']);
  assert.deepEqual(cronDispatch({ weekday: 'Sat', hm: '20:00' }), []);
  assert.deepEqual(cronDispatch({ weekday: 'Wed', hm: '10:00' }), []);
});

test('v6.2 movers fallback is market-wide: top-250 scan, stables excluded, shape normalized', async () => {
  const realFetch = globalThis.fetch;
  const fake = [];
  for (let i = 0; i < 30; i++) fake.push({ symbol: `C${i}`, current_price: 10 + i, price_change_percentage_24h: i - 15, market_cap: 1e9 - i });
  fake.push({ symbol: 'USDT', current_price: 1, price_change_percentage_24h: 25, market_cap: 1e11 });
  fake.push({ symbol: 'WBTC', current_price: 77000, price_change_percentage_24h: -30, market_cap: 1e10 });
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => fake, text: async () => '' });
  try {
    const { getTopGainersLosersCG } = await import('../src/data.js');
    const gl = await getTopGainersLosersCG({ COINGECKO_API_KEY: 'test' });
    assert.ok(gl.gainers.every((g) => g.symbol !== 'USDT') && gl.losers.every((g) => g.symbol !== 'WBTC'));
    assert.equal(gl.gainers[0].symbol, 'C29');
    assert.equal(gl.gainers[0].price_change_percentage_24h, 14);
    assert.ok(typeof gl.gainers[0].current_price === 'number');
    assert.equal(gl.losers[0].symbol, 'C0');
  } finally { globalThis.fetch = realFetch; }
});
