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
