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
  assert.ok(msg.includes('₿ Dominance: 60.0%'));
  assert.ok(msg.includes('🧠 Fear & Greed: 37/100'));
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
    // v6.1.11 CPU diet: the stablecoins payload is no longer fetched —
    // the fields stay null and the regime computes without that signal.
    assert.equal(s.defi.stableSupply, null);
    assert.equal(s.defi.stableDelta7dPct, null);
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

const flagshipFaDraft = `===VERDICT===
بیت‌کوین روی $77,900 در محدوده $76,800 تا $81,500 نوسان می‌کند و بازار آرام است
===OVERVIEW===
بیت‌کوین روی $77,900 معامله می‌شود؛ فاندینگ 0.01% و شاخص نوسان 38.5 هر دو آرام‌اند. عرضه استیبل‌کوین $298.7B است.
===DRIVERS===
1. خروجی استیبل‌کوین — عرضه $298.7B و افت 1.39% در ۷ روز
2. اهرم آرام — فاندینگ 0.01% و DVOL روی 38.5
3. شبکه خلوت — کارمزد 2 sat/vB و قیمت بالای کف ۲۴ ساعته $77,200
===SCENARIOS===
===SCENARIO:BASE===
Lean: FLAT
Level: NONE
Side: NONE
Text: تا وقتی قیمت بین $76,800 و $81,500 است، رنج ادامه دارد
===SCENARIO:BULL===
Lean: UP
Level: 81500
Side: ABOVE
Text: بسته‌شدن روزانه بالای $81,500 روند صعودی را فعال می‌کند
===SCENARIO:BEAR===
Lean: DOWN
Level: 76800
Side: BELOW
Text: شکست $76,800 اصلاح عمیق‌تر را فعال می‌کند
===WATCH===
داده PMI امروز ساعت 17:00 تهران با پیش‌بینی 48.5 منتشر می‌شود
===INVALIDATION===
بسته‌شدن روزانه بیرون از محدوده $76,800 تا $81,500 این خوانش را باطل می‌کند`;

test('v6.1 language: FA flagship validates without a summary section; FA builders render Persian; panel has the switch', async () => {
  const { validateFlagship, buildFlagshipPrompt } = await import('../src/ai.js');
  const { buildRichFlagship, buildRichMorningBrief, buildRichMacroCalendar, buildRichMovers } = await import('../src/rich.js');
  const { buildFng } = await import('../src/posts.js');
  const { getAdminInline } = await import('../src/telegram.js');
  const s = v6State();
  const okFa = validateFlagship(flagshipFaDraft, s, 'fa');
  assert.ok(okFa.ok, 'FA draft errors: ' + (okFa.errors || []).join('; '));
  assert.ok(!validateFlagship(flagshipFaDraft, s, 'en').ok, 'same draft must fail EN mode (no English + no summary section)');
  assert.ok(buildFlagshipPrompt(s, 'fa').includes('LANGUAGE'));
  const flag = buildRichFlagship(s, okFa.parsed, 'fa');
  assert.ok(flag.includes('تحلیل بازار') && flag.includes('سناریوی پایه') && !flag.includes('blockquote expandable') && flag.includes('ابطال تحلیل'));
  const brief = buildRichMorningBrief(s, 'دوشنبه', 'fa');
  assert.ok(brief.includes('گزارش صبحگاهی') && brief.includes('سطوح کلیدی بیت‌کوین') && brief.includes('وسعت بازار'));
  const cal = buildRichMacroCalendar(s, 'دوشنبه', 'fa');
  assert.ok(cal.includes('تقویم اقتصادی') && cal.includes('پیش‌بینی'));
  const fng = await buildFng({ data: [{ value: '37', value_classification: 'Fear', timestamp: 1762000000 }, { value: '34' }] }, 'fa');
  assert.ok(fng.includes('شاخص ترس و طمع') && fng.includes('ترس'));
  const kb = getAdminInline('normal', 'neutral', 'true', 'fa');
  const flat = JSON.stringify(kb);
  assert.ok(flat.includes('admin:lang:fa') && flat.includes('فارسی ✓') && flat.includes('send_flagship') && flat.includes('send_brief') && flat.includes('send_macro') && flat.includes('send_weekly'));
});

// ── v6.1.3: AI failure notifies carry per-provider reasons ──────────
const makeKVStub = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, String(v)); },
    delete: async (k) => { m.delete(k); },
  };
};
const tgOkRes = { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => '' };
const httpRes = (status, body, rawText) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => body,
  text: async () => (rawText ?? JSON.stringify(body)),
});
const geminiRes = (text) => httpRes(200, { candidates: [{ content: { parts: [{ text }] } }] });

// Data layer for the legacy AI sender with no CG/CMC keys: Binance prices,
// Binance movers, F&G, futures — all succeeding.
function legacyDataRoute(u) {
  if (u.includes('ticker/24hr?symbols=')) {
    return httpRes(200, Object.values(BINANCE_MAP).map((symbol) => ({ symbol, lastPrice: '100', priceChangePercent: '1.5', volume: '1000' })));
  }
  if (u.includes('ticker/24hr')) return httpRes(200, [
    { symbol: 'BTCUSDT', lastPrice: '78000', priceChangePercent: '2', quoteVolume: '900000000' },
    { symbol: 'ETHUSDT', lastPrice: '2500', priceChangePercent: '-3', quoteVolume: '400000000' },
  ]);
  if (u.includes('alternative.me')) return httpRes(200, { data: [{ value: '37', value_classification: 'Fear' }] });
  if (u.includes('premiumIndex')) return httpRes(200, { lastFundingRate: '0.0001' });
  if (u.includes('openInterest')) return httpRes(200, { openInterest: '1000' });
  if (u.includes('globalLongShortAccountRatio')) return httpRes(200, [{ longShortRatio: '1.1' }]);
  return httpRes(200, {});
}

const legacyValidText = '<b>Market Overview</b> ' + 'A calm, range-bound tape with majors treading water and volume thin across the board. '.repeat(3)
  + '\n<b>Bullish Factors</b> Steady spot demand.\n<b>Bearish Factors</b> Soft alt breadth.\n<b>Conclusion</b> Stay neutral.\n---PERSIAN---\n<b>خلاصه بازار</b>\n• نتیجه روشن است';

test('v6.1.3 legacy AI: total provider failure notifies admin with per-provider reasons', async () => {
  const { sendChannelAI } = await import('../src/senders.js');
  const { getLastAIFailureReasons } = await import('../src/ai.js');
  const kv = makeKVStub({ 'circuit:gemini-3.6-flash': JSON.stringify({ until: Date.now() + 600000 }) });
  const tg = [];
  const seenUrls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return tgOkRes; }
    seenUrls.push(u);
    if (u.includes('gemini-3.8-flash')) return httpRes(429, {}, '{"error":"quota exceeded"}');
    if (u.includes('gemini-3.5-flash-lite')) return geminiRes('<b>Market Overview</b> short take');
    if (u.includes('openrouter.ai')) return httpRes(500, {}, 'upstream boom');
    return legacyDataRoute(u);
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'or', ALERTS_KV: kv };
    await sendChannelAI(env);
    const notify = tg.find((b) => String(b.chat_id) === '999');
    assert.ok(notify, 'admin notify sent');
    assert.ok(notify.text.includes('<b>AI analysis failed</b> — no post was sent to the channel.'), notify.text);
    assert.ok(!seenUrls.some((u) => u.includes('gemini-3.8-flash')), 'v6.1.6: 3.8 removed from the chain, never requested');
    assert.ok(notify.text.includes('• gemini-3.6-flash: circuit open'), notify.text);
    assert.ok(notify.text.includes('• gemini-3.5-flash-lite: invalid response (too short'), notify.text);
    assert.ok(notify.text.includes('openrouter') && notify.text.includes('HTTP 500'), notify.text);
    assert.ok(!tg.some((b) => String(b.chat_id) === '-100123'), 'channel stays silent');
    assert.ok(getLastAIFailureReasons().length >= 5, 'one reason per failed attempt: lite, nemotron, 3.6, gemma, free');
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.3 legacy AI: provider success posts to the channel with no failure notify', async () => {
  const { sendChannelAI } = await import('../src/senders.js');
  const { getLastAIFailureReasons } = await import('../src/ai.js');
  const tg = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return tgOkRes; }
    if (u.includes('generativelanguage.googleapis.com')) return geminiRes(legacyValidText);
    return legacyDataRoute(u);
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'or', ALERTS_KV: makeKVStub() };
    await sendChannelAI(env);
    assert.ok(tg.some((b) => String(b.chat_id) === '-100123'), 'post sent to channel');
    assert.ok(!tg.some((b) => String(b.chat_id) === '999'), 'no admin notify');
    assert.deepEqual(getLastAIFailureReasons(), []);
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.3 flagship: validation failure notify carries the validation errors', async () => {
  const { sendChannelFlagship } = await import('../src/senders.js');
  const coins = Object.keys(COINS).map((id, i) => ({ id, current_price: 100 + i, price_change_percentage_24h: 1, price_change_percentage_7d_in_currency: 2, price_change_percentage_30d_in_currency: 3, total_volume: 10, market_cap: 10 }));
  const tg = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return tgOkRes; }
    // AI answers in the legacy format: passes the provider chain, fails flagship structure.
    if (u.includes('generativelanguage.googleapis.com')) return geminiRes(legacyValidText);
    const route = (x) => {
      if (x.includes('deribit.com') || x.includes('mempool.space')) throw new Error('dead source');
      if (x.includes('/coins/markets')) return coins;
      if (x.includes('/global')) return { data: { total_market_cap: { usd: 3e12 }, total_volume: { usd: 1e11 }, market_cap_percentage: { btc: 57.5 } } };
      if (x.includes('market_chart')) return { prices: Array.from({ length: 50 }, (_, i) => [i, 100 + i]) };
      if (x.includes('alternative.me')) return { data: [{ value: '60', value_classification: 'Greed' }, { value: '55', value_classification: 'Greed' }] };
      if (x.includes('fapi.binance.com/fapi/v1/premiumIndex')) return { lastFundingRate: '0.0002' };
      if (x.includes('openInterest')) return { openInterest: '1000' };
      if (x.includes('globalLongShortAccountRatio')) return [{ longShortRatio: '1.2' }];
      if (x.includes('api.llama.fi/v2/chains')) return [{ tvl: 100 }, { tvl: 50 }];
      if (x.includes('stablecoins.llama.fi')) return { peggedAssets: [{ circulating: { peggedUSD: 200 }, circulatingPrevWeek: { peggedUSD: 190 } }] };
      if (x.includes('faireconomy')) return [];
      return {};
    };
    return httpRes(200, route(u));
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', COINGECKO_API_KEY: 'test', ALERTS_KV: makeKVStub() };
    await sendChannelFlagship(env);
    const notify = tg.find((b) => String(b.chat_id) === '999');
    assert.ok(notify, 'admin notify sent');
    assert.ok(notify.text.includes('<b>Flagship analysis failed validation</b>'), notify.text);
    assert.ok(notify.text.includes('missing section VERDICT'), notify.text);
    assert.ok(!tg.some((b) => String(b.chat_id) === '-100123'), 'channel stays silent');
  } finally { globalThis.fetch = realFetch; }
});

// End-to-end: a valid v6 draft must travel the REAL chain (raw mode) →
// validator → channel post. Regression test for the object-vs-text and
// legacy-format-gate bugs that silently killed every flagship/flash.
const senderCoins = () => Object.keys(COINS).map((id, i) => ({ id, current_price: 100 + i, price_change_percentage_24h: 1, price_change_percentage_7d_in_currency: 2, price_change_percentage_30d_in_currency: 3, total_volume: 10, market_cap: 10 }));
function stateDataRoute(u, coins) {
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
}

// Grounded in the stub state above: BTC $100, spark range $100–$149 (24h low
// $126), dominance 57.5, F&G 60 (yday 55), stablecoin supply $200, TVL $150.
const flagshipE2EDraft = `===VERDICT===
Bitcoin is range-bound at $100 with greed firm at 60 — a quiet, orderly tape.
===OVERVIEW===
BTC trades at $100, up 1% on the day and 2% on the week. Fear and Greed sits at 60, up from 55 yesterday, while dominance holds at 57.5%. Stablecoin supply is $200 and DeFi TVL is $150, so liquidity is steady rather than expanding.
===DRIVERS===
1. Sentiment rebuilding — Fear and Greed at 60, up from 55 yesterday
2. Stable dominance — BTC dominance holds at 57.5% with price at $100
3. Calm leverage — funding is near zero and the $100 to $149 spark range stays orderly
===SCENARIOS===
===SCENARIO:BASE===
Lean: FLAT
Level: NONE
Side: NONE
Text: While BTC holds near $100 inside the $100 to $149 range, the sideways structure persists and moves stay shallow.
===SCENARIO:BULL===
Lean: UP
Level: 149
Side: ABOVE
Text: A close above $149, the recent spark high, would break the range top and invite momentum buyers.
===SCENARIO:BEAR===
Lean: DOWN
Level: 126
Side: BELOW
Text: A break below $126, the recent 24h low zone, would signal the range is failing.
===WATCH===
The next high-impact macro print is the one event that matters for the range.
===INVALIDATION===
A daily close above $149 or below $126 invalidates the range read.
===PERSIAN===
حکم: بیت‌کوین روی $100 در محدوده‌ای آرام نوسان می‌کند
سطوح: حمایت $126 و مقاومت $149 سطوح کلیدی‌اند
سناریو: سناریوی پایه ادامه نوسان نزدیک $100 است
مراقبت: رویداد ماکروی بعدی مهم‌ترین محرک پیش روست`;

test('v6.1.3 flagship end-to-end: valid draft via the real raw chain posts to the channel', async () => {
  const { sendChannelFlagship } = await import('../src/senders.js');
  const coins = senderCoins();
  const kv = makeKVStub();
  const tg = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return tgOkRes; }
    if (u.includes('generativelanguage.googleapis.com')) return geminiRes(flagshipE2EDraft);
    return httpRes(200, stateDataRoute(u, coins));
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', COINGECKO_API_KEY: 'test', ALERTS_KV: kv };
    await sendChannelFlagship(env);
    const channelSends = tg.filter((b) => String(b.chat_id) === '-100123');
    assert.ok(channelSends.length >= 1, 'flagship posted to the channel');
    assert.ok(JSON.stringify(channelSends).includes('orderly tape'), 'the AI verdict reached the channel post');
    assert.ok(!tg.some((b) => String(b.chat_id) === '999'), 'no admin failure notify');
    const recs = JSON.parse((await kv.get('scen:records')) || '[]');
    assert.equal(recs.length, 1, 'scenario ledger recorded the post');
    assert.equal(recs[0].scenarios.length, 3);
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.3 flash end-to-end: AI flash text is used, not the programmatic fallback', async () => {
  const { checkMacroEvents } = await import('../src/senders.js');
  const coins = senderCoins();
  const eventTs = Date.now() - 30 * 60000;
  const tg = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return tgOkRes; }
    if (u.includes('generativelanguage.googleapis.com')) return geminiRes('FLASH-AI-MARKER: CPI printed at 3.2 versus 3.1 expected. Bitcoin holds at $100 while the market digests the release.');
    if (u.includes('ff_calendar_thisweek')) return httpRes(200, [{ title: 'CPI YoY', country: 'USD', impact: 'High', date: new Date(eventTs).toISOString(), forecast: '3.1', previous: '3.0', actual: '3.2' }]);
    return httpRes(200, stateDataRoute(u, coins));
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', COINGECKO_API_KEY: 'test', ALERTS_KV: makeKVStub() };
    await checkMacroEvents(env);
    const channelSends = tg.filter((b) => String(b.chat_id) === '-100123');
    assert.ok(channelSends.length >= 1, 'flash posted to the channel');
    assert.ok(JSON.stringify(channelSends).includes('FLASH-AI-MARKER'), 'AI text used instead of the programmatic fallback');
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.1 FA classic brief carries the full content (majors, movers, levels, totals)', async () => {
  const { buildBriefClassic } = await import('../src/posts.js');
  const s = v6State();
  s._levels = { h24: 78500, l24: 77200, h7: 81500, l7: 76800 };
  const fa = buildBriefClassic(s, 'دوشنبه ۱۱ آبان', 'fa');
  assert.ok(fa.includes('گزارش صبحگاهی') && fa.includes('سطوح کلیدی بیت‌کوین') && fa.includes('تصویر کلی بازار') && fa.includes('برترین حرکت‌های شبانه'));
  assert.ok(fa.includes('$78,500'));
  const en = buildBriefClassic(s, 'Monday', 'en');
  assert.ok(en.includes('Morning Brief') && !en.includes('سطوح'));
});

test('v6.1.6 AI chain: cross-infrastructure, geo-aware, dead models removed', async () => {
  const cfg = await import('../src/config.js');
  assert.ok(cfg.GEMINI_URL.includes('gemini-3.5-flash-lite'), 'first Gemini is Flash-Lite');
  assert.ok(cfg.GEMINI_FALLBACK_URL.includes('gemini-3.6-flash'));
  assert.ok(cfg.GROQ_URL.includes('api.groq.com'));
  const aiSrc = (await import('node:fs')).readFileSync(new URL('../src/ai.js', import.meta.url), 'utf8');
  for (const dead of ['gemini-2.5-flash', 'thinkingmachines/inkling:free', 'GEMINI_FALLBACK_URL_2']) assert.ok(!aiSrc.includes(dead), `dead reference still in ai.js: ${dead}`);
  assert.ok(aiSrc.includes('@cf/qwen/qwen3-30b-a3b-fp8'), 'Workers AI step present');
  assert.ok(aiSrc.includes('llama-3.3-70b-versatile'), 'Groq step present');
  assert.ok(aiSrc.includes('nvidia/nemotron-3-ultra-550b-a55b:free') && aiSrc.includes('google/gemma-4-31b-it:free') && aiSrc.includes('90000'), 'OR steps + global deadline present');
  assert.ok(aiSrc.includes('geminiGeoBlockedUntil'), 'geo-block memo present');
});

test('v6.1.5 rich mode: panel toggle exists, sendRich honors rich_mode=off, legacy AI has a rich builder', async () => {
  const { getAdminInline } = await import('../src/telegram.js');
  const { sendRich } = await import('../src/telegram.js');
  const { buildRichAIAnalysis } = await import('../src/rich.js');
  const kbOff = JSON.stringify(getAdminInline('normal', 'neutral', 'true', 'en', 'off'));
  assert.ok(kbOff.includes('admin:rich_toggle') && kbOff.includes('Rich: ❌ Off'));
  const kbOn = JSON.stringify(getAdminInline('normal', 'neutral', 'true', 'en', 'on'));
  assert.ok(kbOn.includes('Rich: ✅ On'));

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { calls.push(String(url)); return { ok: true, json: async () => ({ ok: true, result: {} }), text: async () => '' }; };
  try {
    const envOff = { TELEGRAM_BOT_TOKEN: 'x', ALERTS_KV: { get: async (k) => (k === 'cfg:rich_mode' ? 'off' : null), put: async () => {}, delete: async () => {} } };
    await sendRich(envOff, '-100', '<h2>rich</h2>', 'classic text', null, 'en');
    assert.ok(calls.some((u) => u.includes('sendMessage')) && !calls.some((u) => u.includes('sendRichMessage')), 'off → classic sendMessage');
    calls.length = 0;
    const envOn = { TELEGRAM_BOT_TOKEN: 'x', ALERTS_KV: { get: async () => null, put: async () => {}, delete: async () => {} } };
    await sendRich(envOn, '-100', '<h2>rich</h2>', 'classic text', null, 'en');
    assert.ok(calls.some((u) => u.includes('sendRichMessage')), 'on → sendRichMessage');
  } finally { globalThis.fetch = realFetch; }

  const today = { date: '2026-11-03', mode: 'Normal', btcPrice: 100000, btcChange: 1.5, ethPrice: 3000, ethChange: -0.5, solPrice: 200, solChange: 2.5, totalMarketCap: 3e12, totalVolume: 1e11, btcDominance: 59.9, fearGreed: 37, futures: null };
  const ai = { text: '<b>Market Overview</b>\nCalm market.\n\n<b>Conclusion</b>\nStay patient.\n\n---PERSIAN---\n• بازار آرام است\n⚠️ This analysis is not financial advice.', source: 'Gemini' };
  const rich = buildRichAIAnalysis(ai, today, { state: 'FEAR', intensity: 55, emoji: '😨', color: '🟠' }, 'en');
  assert.ok(rich.includes('<h3>Market Overview</h3>') && rich.includes('<table') && rich.includes('خلاصه بازار') && rich.includes('blockquote expandable') && !rich.includes('---PERSIAN---'));
});

const AI_OK = '<b>Market Overview</b>\nBitcoin is holding above its key support while breadth slowly improves across large caps and traders wait for confirmation.\n\n<b>Bullish Factors</b>\nSpot demand is steady and funding stays neutral, which leaves room for a squeeze higher if resistance breaks cleanly.\n\n<b>Conclusion</b>\nStay patient and let price confirm the move before adding risk.\n\n---PERSIAN---\n• بازار در وضعیت انتظار است و بیت‌کوین بالای حمایت کلیدی باقی مانده است.\n⚠️ This analysis is not financial advice.';
const AI_MD = '**Market Overview**\nBitcoin is holding above its key support while breadth slowly improves across large caps and traders wait for confirmation.\n\n## Bullish Factors\nSpot demand is steady and funding stays neutral, which leaves room for a squeeze higher if resistance breaks cleanly.\n\nConclusion\nStay patient and let price confirm the move before adding risk.\n\n---PERSIAN---\n• بازار در وضعیت انتظار است و بیت‌کوین بالای حمایت کلیدی باقی مانده است.\n⚠️ This analysis is not financial advice.';
const kvStub = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };

test('v6.1.6 validator judges content, not markup dialect', async () => {
  assert.equal(isValidAIResponse(AI_OK), true);
  assert.equal(isValidAIResponse(AI_MD), true); // **bold** + ## heading + bare Conclusion line
});

test('v6.1.6 chain: Workers AI answers first when the binding exists', async () => {
  const { getAIAnalysis } = await import('../src/ai.js');
  const realFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls++; throw new Error('no HTTP expected'); };
  try {
    const env = { ALERTS_KV: kvStub(), GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o', AI: { run: async () => ({ response: AI_OK }) } };
    const r = await getAIAnalysis(env, 'test prompt');
    assert.ok(r && r.source === 'Workers AI');
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.6 chain: OpenRouter array-part content is extracted (was: empty response)', async () => {
  const { getAIAnalysis } = await import('../src/ai.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('generativelanguage')) return httpRes(503, 'capacity');
    if (u.includes('openrouter')) return httpRes(200, { choices: [{ message: { content: [{ type: 'text', text: AI_OK }] }, finish_reason: 'stop' }] });
    throw new Error('unexpected ' + u);
  };
  try {
    const env = { ALERTS_KV: kvStub(), GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o' };
    const r = await getAIAnalysis(env, 'test prompt');
    assert.ok(r && r.source.toLowerCase().includes('nemotron'), JSON.stringify(r));
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.6 chain: Groq answers when its secret exists', async () => {
  const { getAIAnalysis } = await import('../src/ai.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('generativelanguage')) return httpRes(503, 'capacity');
    if (u.includes('groq.com')) return httpRes(200, { choices: [{ message: { content: AI_OK }, finish_reason: 'stop' }] });
    throw new Error('unexpected ' + u);
  };
  try {
    const env = { ALERTS_KV: kvStub(), GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o', GROQ_API_KEY: 'gk' };
    const r = await getAIAnalysis(env, 'test prompt');
    assert.ok(r && r.source === 'Groq', JSON.stringify(r));
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.6 chain: a Gemini geo-block skips the remaining Gemini steps', async () => {
  const { getAIAnalysis, getLastAIFailureReasons } = await import('../src/ai.js');
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.includes('generativelanguage')) return httpRes(400, '{"error":{"code":400,"message":"User location is not supported for use with the API"}}');
    if (u.includes('openrouter')) return httpRes(200, { choices: [{ message: { content: 'short' }, finish_reason: 'stop' }] });
    throw new Error('unexpected ' + u);
  };
  try {
    const env = { ALERTS_KV: kvStub(), GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o' };
    const r = await getAIAnalysis(env, 'test prompt');
    assert.equal(r, null);
    assert.ok(seen.some((u) => u.includes('gemini-3.5-flash-lite')));
    assert.ok(!seen.some((u) => u.includes('gemini-3.6-flash')), '3.6 must be skipped after a geo-block');
    assert.ok(getLastAIFailureReasons().join(' ').includes('geo-blocked'));
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.7 dispatch: flagship fires on the cron scheduled time, not the wall clock after the slow price send', async () => {
  const { tehranParts, cronDispatch } = await import('../src/senders.js');
  // 2026-11-11 21:00 Tehran = 17:30 UTC (the missed tick).
  const tick = Date.UTC(2026, 10, 11, 17, 30, 0);
  assert.equal(tehranParts(tick).hm, '21:00');
  assert.ok(cronDispatch(tehranParts(tick)).includes('flagship'));
  // One minute later the old code (tehranParts() = Date.now()) would skip it.
  assert.equal(tehranParts(Date.UTC(2026, 10, 11, 17, 31, 0)).hm, '21:01');
  assert.ok(!cronDispatch(tehranParts(Date.UTC(2026, 10, 11, 17, 31, 0))).includes('flagship'));
  // handleCron must pass the event's scheduled time into the dispatch.
  const idxSrc = (await import('node:fs')).readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.ok(idxSrc.includes('event.scheduledTime'), 'handleCron must read event.scheduledTime');
  assert.ok(idxSrc.includes('cronDispatch(tehranParts(tickTs))'), 'dispatch must use the scheduled tick');
});

test('v6.1.8 shared state: price/brief/flagship with a prebuilt state make ZERO data-API fetches', async () => {
  const { sendChannelPrice, sendChannelMorningBrief, sendChannelFlagship } = await import('../src/senders.js');
  const dataHosts = ['coingecko', 'coinmarketcap', 'binance', 'deribit', 'mempool.space', 'llama.fi', 'faireconomy', 'cointelegraph', 'decrypt', 'coindesk', 'alternative.me'];
  const tg = [];
  const dataCalls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => '' }; }
    if (dataHosts.some((h) => u.includes(h))) { dataCalls.push(u); return { ok: false, status: 503, json: async () => ({}), text: async () => 'down' }; }
    return { ok: false, status: 503, json: async () => ({}), text: async () => 'ai down' }; // Gemini / OpenRouter fail fast
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: 999, ALERTS_KV: kvStub() };
    await sendChannelPrice(env, v6State());
    assert.ok(tg.some((b) => String(b.chat_id) === '-100123' && b.rich_message), 'price posted rich');
    await sendChannelMorningBrief(env, v6State());
    assert.ok(tg.filter((b) => String(b.chat_id) === '-100123').length >= 2, 'brief posted');
    await sendChannelFlagship(env, v6State());
    const notify = tg.find((b) => String(b.chat_id) === '999');
    assert.ok(notify && notify.text.includes('Flagship analysis failed validation'), 'flagship AI failure notifies admin instead of dying silently');
    assert.equal(dataCalls.length, 0, `shared state must skip data fetches, got: ${dataCalls.join(', ')}`);
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.9 normalizeTickTs: seconds epoch and ISO strings dispatch like ms epoch', async () => {
  const { normalizeTickTs, tehranParts, cronDispatch } = await import('../src/senders.js');
  const ms = Date.parse('2026-11-12T17:30:00Z');
  assert.equal(tehranParts(normalizeTickTs(ms)).hm, '21:00');
  assert.deepEqual(cronDispatch(tehranParts(normalizeTickTs(ms / 1000))), ['flagship'], 'seconds epoch must not silently skip');
  assert.deepEqual(cronDispatch(tehranParts(normalizeTickTs('2026-11-12T17:30:00Z'))), ['flagship'], 'ISO string must dispatch');
  assert.deepEqual(cronDispatch(tehranParts(normalizeTickTs(String(ms / 1000)))), ['flagship'], 'numeric seconds string must dispatch');
  const garbage = normalizeTickTs('not-a-date');
  assert.ok(Number.isFinite(garbage) && Math.abs(garbage - Date.now()) < 60000, 'garbage falls back to wall clock');
});

// Number-free flagship draft (module scope so the v6.1.9/v6.1.10 stubs share it):
// passes validateFlagship against ANY state — grounding checks numbers only.
const pvCopyDraft = `===VERDICT===\nBitcoin is range-bound and quiet, with no single driver dominating the session.\n===OVERVIEW===\nThe market drifted sideways through the session with low volatility and thin conviction on either side.\nTraders are waiting for the next catalyst rather than chasing price.\n===DRIVERS===\n1. Quiet spot flows — participation stayed light across the majors\n2. Calm leverage — funding stayed muted and liquidations were minimal\n3. Steady structure — price held its recent range without a decisive break\n===SCENARIOS===\n===SCENARIO:BASE===\nLean: FLAT\nLevel: NONE\nSide: NONE\nText: While the range holds, sideways drift continues and dips keep attracting patient bids.\n===SCENARIO:BULL===\nLean: UP\nLevel: NONE\nSide: NONE\nText: A decisive break above the range high would invite momentum buyers back in.\n===SCENARIO:BEAR===\nLean: DOWN\nLevel: NONE\nSide: NONE\nText: A decisive break below the range low would open the door to a deeper correction.\n===WATCH===\nThe next scheduled macro release is the event to watch for a volatility pickup.\n===INVALIDATION===\nA daily close far outside the recent range invalidates this calm read.\n===PERSIAN===\nحکم: بیت‌کوین در محدوده نوسان می‌کند و بازار آرام و خنثی است\nسطوح: حمایت و مقاومت محدوده اخیر سطوح کلیدی امروزند\nسناریو: سناریوی پایه ادامه نوسان در همین محدوده است\nمراقبت: داده‌های کلان پیش رو مهم‌ترین رویداد است`;

test('v6.1.9 loud dispatch: a throw inside the flagship job notifies the admin', async () => {
  const worker = (await import('../src/index.js')).default;
  const { BINANCE_MAP } = await import('../src/config.js');
  // Number-free draft: passes validateFlagship against ANY state (grounding
  // checks numbers only), so the failure below is the send, not validation.
  // (flagshipDraft is defined at module scope below the v6.1.8 tests)
  const tg = [];
  const tickers = Object.values(BINANCE_MAP).map((sym, i) => ({ symbol: sym, lastPrice: String(100 + i), priceChangePercent: '0.5', quoteVolume: '500000000', openPrice: '100' }));
  const klines = Array.from({ length: 168 }, (_, i) => [1700000000000 + i * 3600000, '78000', '78500', '77500', '78200', '10', 0, 0, 0, 0, 0, 0]);
  const RSS = `<?xml version="1.0"?><rss><channel><item><title>Bitcoin holds steady</title><link>https://example.com/a</link><pubDate>Wed, 12 Nov 2026 17:00:00 GMT</pubDate></item></channel></rss>`;
  const realFetch = globalThis.fetch;
  let pricePosted = false;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) {
      const b = JSON.parse(options.body || '{}');
      if (String(b.chat_id) === '999') { tg.push(b); return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => '' }; }
      if (b.rich_message && !pricePosted) { pricePosted = true; tg.push(b); return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => '' }; }
      throw new Error('telegram boom'); // every later channel send fails (rich AND classic fallback)
    }
    if (u.includes('coingecko.com')) return { ok: false, status: 429, json: async () => ({}), text: async () => '429' };
    if (u.includes('api.binance.com') && u.includes('ticker/24hr')) return { ok: true, status: 200, json: async () => tickers, text: async () => '' };
    if (u.includes('api.binance.com') && u.includes('klines')) return { ok: true, status: 200, json: async () => klines, text: async () => '' };
    if (u.includes('api.binance.com')) return { ok: true, status: 200, json: async () => [], text: async () => '' };
    if (u.includes('alternative.me')) return { ok: true, status: 200, json: async () => ({ data: [{ value: '60', value_classification: 'Greed' }] }), text: async () => '' };
    if (u.includes('generativelanguage.googleapis.com')) return { ok: false, status: 400, json: async () => ({}), text: async () => '{"error":{"code":400,"message":"User location is not supported"}}' };
    if (u.includes('openrouter.ai')) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: pvCopyDraft }, finish_reason: 'stop' }] }), text: async () => '' };
    if (u.includes('coindesk') || u.includes('cointelegraph') || u.includes('decrypt')) return { ok: true, status: 200, json: async () => ({}), text: async () => RSS };
    return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
  };
  try {
    const store = new Map();
    const env = { TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: 999, GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o', COINGECKO_API_KEY: 'cg', ALERTS_KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [] }) } };
    let done;
    const ctx = { waitUntil: (p) => { done = p; } };
    await worker.scheduled({ cron: '*/30 * * * *', scheduledTime: Date.parse('2026-11-12T17:30:00Z') }, env, ctx);
    await done;
    assert.ok(pricePosted, 'price snapshot must land first');
    const notify = tg.find((b) => String(b.chat_id) === '999');
    assert.ok(notify && notify.text.includes('[CRON] flagship failed'), 'dispatch throw must notify the admin, not die in console.error');
    assert.ok(notify.text.includes('21:00'), 'notify names the tick');
  } finally { globalThis.fetch = realFetch; }
});

// ── v6.1.10: PV-COPY RULE — manual sends also land in the admin PV ──
// Shared stub: Telegram calls recorded (with the message_id each returned),
// data/AI routes mirror the v6.1.9 replay (CoinGecko 429, Binance fallback,
// Gemini geo-400, OpenRouter returns the number-free flagship draft).
function installPvStub(tg) {
  const tickers = Object.values(BINANCE_MAP).map((sym, i) => ({ symbol: sym, lastPrice: String(100 + i), priceChangePercent: '0.5', quoteVolume: '500000000', openPrice: '100' }));
  const klines = Array.from({ length: 168 }, (_, i) => [1700000000000 + i * 3600000, '78000', '78500', '77500', '78200', '10', 0, 0, 0, 0, 0, 0]);
  const RSS = `<?xml version="1.0"?><rss><channel><item><title>Bitcoin holds steady</title><link>https://example.com/a</link><pubDate>Wed, 12 Nov 2026 17:00:00 GMT</pubDate></item></channel></rss>`;
  let msgId = 100;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) {
      const method = u.split('/').pop();
      const b = JSON.parse(options.body || '{}');
      const res = { ok: true, result: { message_id: ++msgId } };
      tg.push({ method, ...b, _returnedId: res.result.message_id });
      return { ok: true, status: 200, json: async () => res, text: async () => '' };
    }
    if (u.includes('coingecko.com')) return { ok: false, status: 429, json: async () => ({}), text: async () => '429' };
    if (u.includes('api.binance.com') && u.includes('ticker/24hr')) return { ok: true, status: 200, json: async () => tickers, text: async () => '' };
    if (u.includes('api.binance.com') && u.includes('klines')) return { ok: true, status: 200, json: async () => klines, text: async () => '' };
    if (u.includes('api.binance.com')) return { ok: true, status: 200, json: async () => [], text: async () => '' };
    if (u.includes('alternative.me')) return { ok: true, status: 200, json: async () => ({ data: [{ value: '60', value_classification: 'Greed' }] }), text: async () => '' };
    if (u.includes('generativelanguage.googleapis.com')) return { ok: false, status: 400, json: async () => ({}), text: async () => '{"error":{"code":400,"message":"User location is not supported"}}' };
    if (u.includes('openrouter.ai')) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: pvCopyDraft }, finish_reason: 'stop' }] }), text: async () => '' };
    if (u.includes('coindesk') || u.includes('cointelegraph') || u.includes('decrypt')) return { ok: true, status: 200, json: async () => ({}), text: async () => RSS };
    return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
  };
  return () => { globalThis.fetch = realFetch; };
}

test('v6.1.10 PV copy: manual /sendflagship also delivers the channel post to the admin PV', async () => {
  const worker = (await import('../src/index.js')).default;
  const tg = [];
  const restore = installPvStub(tg);
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'or', COINGECKO_API_KEY: 'cg', ALERTS_KV: makeKVStub() };
    const update = { update_id: 1, message: { message_id: 1, chat: { id: 999 }, from: { id: 999 }, text: '/sendflagship' } };
    const res = await worker.fetch(new Request('https://worker/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) }), env, { waitUntil: () => {} });
    assert.equal(res.status, 200);
    const channelPost = tg.find((b) => b.method === 'sendRichMessage' && String(b.chat_id) === '-100123');
    assert.ok(channelPost, 'flagship must post to the channel');
    const copy = tg.find((b) => b.method === 'copyMessage');
    assert.ok(copy, 'manual send must copy the post to the admin PV');
    assert.equal(String(copy.chat_id), '999');
    assert.equal(String(copy.from_chat_id), '-100123');
    assert.equal(copy.message_id, channelPost._returnedId, 'copy must reference the channel message just sent');
    assert.ok(tg.some((b) => b.method === 'sendMessage' && String(b.chat_id) === '999' && b.text.includes('✅ Done!')), 'Done confirmation still sent');
  } finally { restore(); }
});

test('v6.1.10 PV copy: the cron flagship does NOT copy to the admin PV', async () => {
  const worker = (await import('../src/index.js')).default;
  const tg = [];
  const restore = installPvStub(tg);
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'or', COINGECKO_API_KEY: 'cg', ALERTS_KV: makeKVStub() };
    let done;
    const ctx = { waitUntil: (p) => { done = p; } };
    await worker.scheduled({ cron: '*/30 * * * *', scheduledTime: Date.parse('2026-11-12T17:30:00Z') }, env, ctx);
    await done;
    const channelPosts = tg.filter((b) => b.method === 'sendRichMessage' && String(b.chat_id) === '-100123');
    assert.ok(channelPosts.length >= 2, 'price + flagship must both post on the cron tick');
    assert.ok(!tg.some((b) => b.method === 'copyMessage'), 'cron sends must never copy to PV');
  } finally { restore(); }
});

test('v6.1.10 PV copy: copyToAdmin never throws when the copy fails', async () => {
  const { copyToAdmin } = await import('../src/telegram.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('telegram down'); };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999' };
    await copyToAdmin(env, { result: { message_id: 777 } });
    await copyToAdmin(env, null);
    await copyToAdmin(env, 'dedup-skipped');
    await copyToAdmin(env, [{ result: { message_id: 1 } }, { result: {} }]);
  } finally { globalThis.fetch = realFetch; }
});

// ── v6.1.11: CPU diet (free-plan 10ms cron budget) ────────────────
test('v6.1.11 CPU diet: getDefi fetches TVL only, no stablecoins payload', async () => {
  const { buildMarketState, computeRegime } = await import('../src/state.js');
  const coins = senderCoins();
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { seen.push(String(url)); return httpRes(200, stateDataRoute(url, coins)); };
  try {
    const s = await buildMarketState({ COINGECKO_API_KEY: 'cg', ALERTS_KV: makeKVStub() });
    assert.ok(!seen.some((u) => u.includes('stablecoins.llama.fi')), 'stablecoins payload must not be fetched');
    assert.ok(seen.some((u) => u.includes('api.llama.fi/v2/chains')), 'chains TVL still fetched');
    assert.equal(typeof s.defi.tvl, 'number');
    assert.equal(s.defi.stableSupply, null);
    assert.equal(s.defi.stableDelta7dPct, null);
    const r = computeRegime(s);
    assert.ok(['RISK_ON', 'RISK_OFF', 'RANGE', 'CAPITULATION', 'EUPHORIA', 'SQUEEZE_RISK'].includes(r.label), r.label);
    assert.equal(typeof r.score, 'number');
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.11 CPU diet: AI prompt omits the stablecoin segment when it is null (no literal null)', async () => {
  const { stateDigest } = await import('../src/ai.js');
  const s = {
    prices: [
      { id: 'bitcoin', current_price: 78000, price_change_percentage_24h: 1.5, price_change_percentage_7d_in_currency: -2, price_change_percentage_30d_in_currency: -5, total_volume: 1e9, market_cap: 1.5e12 },
      { id: 'ethereum', current_price: 2500, price_change_percentage_24h: -1, price_change_percentage_7d_in_currency: 3, price_change_percentage_30d_in_currency: 0, total_volume: 5e8, market_cap: 3e11 },
    ],
    regime: { label: 'RANGE', score: 52, reasons: ['BTC 7d -2.0%'] },
    global: { btcDominance: 60, marketCap: 2.6e12, volume24h: 5e10 },
    fearGreed: { now: 37, yday: 30 },
    derivatives: { fundingBtc: 0.01, fundingEth: 0.01, fundingSol: 0.01, oiUsd: 1e10, oiDeltaPct: 1, dvol: 40 },
    onchain: null, defi: { tvl: 150, stableSupply: null, stableDelta7dPct: null },
    macro: null, news: [],
  };
  const d = stateDigest(s);
  assert.ok(d.includes('DeFi TVL $150'), 'TVL still in the prompt');
  assert.ok(!d.includes('null'), 'no literal null may reach the AI prompt');
});

test('v6.1.11 CPU diet: sendRich builds the classic fallback only when rich fails', async () => {
  const { sendRich } = await import('../src/telegram.js');
  const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', ALERTS_KV: makeKVStub() };
  const realFetch = globalThis.fetch;
  let built = 0;
  const fallback = () => { built++; return 'CLASSIC'; };
  globalThis.fetch = async (url) => {
    if (String(url).includes('api.telegram.org')) return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }), text: async () => '' };
    throw new Error('unexpected fetch');
  };
  try {
    await sendRich(env, '-100123', '<b>rich</b>', fallback);
    assert.equal(built, 0, 'classic fallback must not be built when rich succeeds');
  } finally { globalThis.fetch = realFetch; }
  let classicSent = null;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('sendRichMessage')) return { ok: false, status: 400, json: async () => ({ ok: false, description: 'bad' }), text: async () => 'bad' };
    if (u.includes('sendMessage')) { classicSent = JSON.parse(options.body); return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => '' }; }
    throw new Error('unexpected fetch ' + u);
  };
  try {
    built = 0;
    await sendRich(env, '-100123', '<b>rich</b>', fallback);
    assert.equal(built, 1, 'classic fallback built exactly once on rich failure');
    assert.ok(classicSent && classicSent.text === 'CLASSIC', 'classic text sent as the fallback');
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.11 CPU diet: watcher reuses the shared state macro without re-fetching the calendar', async () => {
  const { checkMacroEvents } = await import('../src/senders.js');
  const eventTs = Date.now() + 30 * 60000;
  const shared = { macro: { today: [{ title: 'CPI YoY', country: 'USD', impact: 'High', ts: eventTs, forecast: '3.1', previous: '3.0', actual: '' }], ahead: [], nextHighImpact: null } };
  const tg = [];
  const fetched = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    fetched.push(u);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return tgOkRes; }
    throw new Error('no non-telegram fetch expected: ' + u);
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', ALERTS_KV: makeKVStub() };
    await checkMacroEvents(env, shared);
    assert.ok(!fetched.some((u) => u.includes('faireconomy')), 'calendar must not be re-fetched when shared state carries it');
    assert.ok(tg.some((b) => String(b.chat_id) === '-100123'), 'watch post still sent from the shared macro');
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.11 CPU diet: fmt.price cached formatters match toLocaleString output', () => {
  for (const n of [0, 0.00012345, 0.05, 0.5, 1, 9.99, 999.99, 1000, 123456, 78000, 1234567.89]) {
    const expected = !n ? '$0.00'
      : n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : n >= 1 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n >= 0.01 ? n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
    assert.equal(fmt.price(n), expected, `fmt.price(${n})`);
  }
});

test('v6.1.12 flagship truncation: a draft cut off at the token cap notifies with the cause and keeps the rejected draft', async () => {
  const { sendChannelFlagship } = await import('../src/senders.js');
  const coins = senderCoins();
  const kv = makeKVStub();
  const tg = [];
  const orBodies = [];
  // The production 13:00 failure shape: head valid, tail (INVALIDATION +
  // PERSIAN) cut off — the draft the model returns when it hits max_tokens.
  const truncDraft = flagshipE2EDraft.split('===INVALIDATION===')[0].trim();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.telegram.org')) { tg.push(JSON.parse(options.body)); return tgOkRes; }
    // Gemini is geo-blocked in production AND in this process (an earlier
    // test memos the block for 30 min), so the chain reaches OpenRouter —
    // exactly the flagship's real production path.
    if (u.includes('generativelanguage.googleapis.com')) return httpRes(400, {});
    if (u.includes('openrouter.ai')) { orBodies.push(JSON.parse(options.body)); return httpRes(200, { choices: [{ message: { content: truncDraft }, finish_reason: 'length' }] }); }
    return httpRes(200, stateDataRoute(u, coins));
  };
  try {
    const env = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '-100123', ADMIN_ID: '999', GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'or', COINGECKO_API_KEY: 'cg', ALERTS_KV: kv };
    await sendChannelFlagship(env);
    assert.ok(!tg.some((b) => String(b.chat_id) === '-100123'), 'no channel post on rejected draft');
    const notify = tg.find((b) => String(b.chat_id) === '999');
    assert.ok(notify, 'admin got the failure notice');
    const txt = JSON.stringify(notify);
    assert.ok(txt.includes('Flagship analysis failed validation'), 'notice names the failure');
    assert.ok(txt.includes('missing section INVALIDATION'), 'notice lists the missing tail section');
    assert.ok(txt.includes('truncated'), 'notice names the truncation cause');
    assert.ok(txt.includes(`rejected draft: ${truncDraft.length} chars`), 'notice carries the draft length');
    const rej = JSON.parse(await kv.get('flagship:lastRejected'));
    assert.ok(rej && rej.errors.includes('missing section INVALIDATION'), 'rejected draft kept in KV with its errors');
    assert.equal(rej.draft, truncDraft, 'full rejected draft kept for inspection');
    assert.ok(orBodies.length >= 1, 'OpenRouter was asked (initial + retry)');
    assert.ok(orBodies.every((b) => b.max_tokens === 8192), 'flagship asks for 8192 output tokens');
  } finally { globalThis.fetch = realFetch; }
});

test('v6.1.13 grounding: a faithful 2-significant-figure rounding of a big value passes, a far value fails', async () => {
  const { validateGrounded } = await import('../src/ai.js');
  const coin = (market_cap) => ({ id: 'x', current_price: 100, price_change_percentage_24h: 1, price_change_percentage_7d_in_currency: 2, price_change_percentage_30d_in_currency: 3, total_volume: 5e6, market_cap });
  // The 21:00 shape: draft cited $1.6B, true value $1.6234B — a faithful rounding.
  assert.ok(validateGrounded('Market cap $1.6B', { prices: [coin(1623400000)] }).ok);
  // Same citation against a $1.71B truth is NOT a faithful rounding — still rejected.
  const bad = validateGrounded('Market cap $1.6B', { prices: [coin(1710000000)] });
  assert.equal(bad.ok, false);
  assert.ok(bad.bad.includes(1600000000));
  // A wild invention stays rejected: $1.6B against a $85.5B TVL-only state.
  const wild = validateGrounded('TVL $1.6B', { prices: [], defi: { tvl: 8.55e10 } });
  assert.equal(wild.ok, false);
  assert.ok(wild.bad.includes(1600000000));
});

test('v6.1.13 grounding: a figure from a shown headline is grounded', async () => {
  const { validateGrounded } = await import('../src/ai.js');
  const s = { prices: [], news: [{ title: 'ETF inflows hit $1.6B', src: 'X' }] };
  assert.ok(validateGrounded('ETF inflows hit $1.6B', s).ok);
  assert.equal(validateGrounded('ETF inflows hit $2.4B', s).ok, false);
});
