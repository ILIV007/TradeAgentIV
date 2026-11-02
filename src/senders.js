// TradeAgent IV — alert logic, market-data collection, channel senders.
import { COINS, ALERT_PRESETS, FOOTER } from './config.js';
import { fmt } from './utils.js';
import { getCoins, getGlobal, getTrending, getFearGreed, getTopGainersLosers, getCategories, getMarketChart, getBinanceFutures, calculateEmotionState } from './data.js';
import { getAIAnalysis, buildAIPrompt } from './ai.js';
import { buildPrice, buildVolume, buildDaily, buildTrending, buildFng, buildAIAnalysis, buildAlert, buildFutures, buildMovers } from './posts.js';
import { sendMessage, sendChannelSticker } from './telegram.js';
import { dedupSend, DEDUP_SKIPPED, getConfig, getSnapshot, storeSnapshot } from './store.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 18. ALERTS KV & LOGIC
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
    promises.push(getAlertState(env, `${coinId}:above`).then(v => { states[`${coinId}:above`] = v; }));
    promises.push(getAlertState(env, `${coinId}:below`).then(v => { states[`${coinId}:below`] = v; }));
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
    const ch = c.price_change_percentage_24h || 0;
    for (const dir of ['above', 'below']) {
      const key = `${c.id}:${dir}`;
      if (!states[key]) continue;
      const last = await getAlertLast(env, key);
      let triggered = false;
      if (dir === 'above' && ch >= cfg.pct) triggered = true;
      if (dir === 'below' && ch <= -cfg.pct) triggered = true;

      if (triggered && last !== 'triggered') {
        await sendMessage(env, env.TELEGRAM_CHANNEL_ID, buildAlert(c.id, c.current_price, dir, ch));
        await setAlertLast(env, key, 'triggered');
      } else if (!triggered && last) {
        await clearAlertLast(env, key);
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 19. DATA COLLECTOR
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
// 20. CHANNEL SENDERS — DEDUP v3 + AI Fallback Bypass Dedup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ensureChannel(env) {
  if (!env.TELEGRAM_CHANNEL_ID) throw new Error('TELEGRAM_CHANNEL_ID not set');
}

async function sendChannelPrice(env) {
  ensureChannel(env);
  return await dedupSend(env, 'price', async () => {
    const [{ source, data }, globalData, fear] = await Promise.all([getCoins(env), getGlobal(env), getFearGreed()]);
    await checkAlerts(env, data);
    const ctx = { btcDominance: Number(globalData?.data?.market_cap_percentage?.btc || 0).toFixed(1), fearGreed: fear?.data?.[0] ? parseInt(fear.data[0].value) : null };
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildPrice(data, source, ctx));
  });
}

async function sendChannelVolume(env) {
  ensureChannel(env);
  return await dedupSend(env, 'volume', async () => {
    const { source, data } = await getCoins(env);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildVolume(data, source));
  });
}

async function sendChannelDaily(env) {
  ensureChannel(env);
  return await dedupSend(env, 'daily', async () => {
    const [{ source, data }, globalData, trending, fear] = await Promise.all([
      getCoins(env), getGlobal(env), getTrending(env), getFearGreed(),
    ]);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildDaily(data, globalData, trending, fear, source));
  });
}

async function sendChannelTrending(env) {
  ensureChannel(env);
  return await dedupSend(env, 'trending', async () => {
    const trending = await getTrending(env);
    if (!trending) { console.log('[TRENDING] No data, staying silent'); return; }
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildTrending(trending, await trendingPriceMap(env)));
  });
}

async function sendChannelFng(env) {
  ensureChannel(env);
  return await dedupSend(env, 'fng', async () => {
    const fear = await getFearGreed();
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildFng(fear));
  });
}

async function sendChannelAI(env, customPrompt = null) {
  ensureChannel(env);
  return await dedupSend(env, 'ai', async () => {
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
      console.error('[AI] Analysis failed from all providers; staying silent in channel');
      if (env.ADMIN_ID) {
        try { await sendMessage(env, env.ADMIN_ID, '⚠️ <b>AI analysis failed</b> — no post was sent to the channel.'); } catch (e) {}
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
  return await dedupSend(env, 'futures', async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'HYPEUSDT', 'DOGEUSDT'];
    const futures = {};
    for (const sym of symbols) {
      futures[sym] = await getBinanceFutures(sym);
    }
    const hasData = Object.values(futures).some(f => f && (f.fundingRate != null || f.openInterest != null));
    if (!hasData) { console.log('[FUTURES] No data, staying silent'); return; }
    const snap = await getSnapshot(env);
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildFutures(futures, snap?.futures || {}));
  });
}

async function sendChannelMovers(env) {
  ensureChannel(env);
  return await dedupSend(env, 'movers', async () => {
    console.log('[MOVERS] Starting send...');
    const gl = await getTopGainersLosers(env);
    console.log('[MOVERS] Data:', gl ? `G:${gl.gainers?.length} L:${gl.losers?.length}` : 'null');
    if (!gl || (!gl.gainers?.length && !gl.losers?.length)) { console.log('[MOVERS] No data, staying silent'); return; }
    await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildMovers(gl));
  });
}

async function sendWithTimeout(fn, env, name, timeoutMs = 35000) {
  return Promise.race([
    fn(env),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} timeout after ${timeoutMs}ms`)), timeoutMs))
  ]);
}

async function sendChannelAll(env, ctx) {
  await dedupSend(env, 'all_bundle', async () => {
    try {
      await sendChannelSticker(env);
      console.log('[SEND ALL] ✅ Sticker sent first');
    } catch (e) {
      console.error('[SEND ALL] ❌ Sticker failed:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
    
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
        const r = await sendWithTimeout(s.fn, env, s.name, 35000);
        results.push(r === DEDUP_SKIPPED ? `⏭️ ${s.name} (dedup)` : `✅ ${s.name}`);
      }
      catch (e) { 
        results.push(`❌ ${s.name}: ${e.message}`); 
      }
    }
    console.log('[SEND ALL]\n' + results.join('\n'));
    if (results.every(r => r.startsWith('❌'))) throw new Error('All sends failed');
  });
}

async function trendingPriceMap(env) {
  try {
    const { data } = await getCoins(env);
    const map = {};
    for (const c of data) if (COINS[c.id]) map[COINS[c.id].symbol] = { price: c.current_price, change: c.price_change_percentage_24h };
    return map;
  } catch (e) { return {}; }
}

export { trendingPriceMap, getAllAlertStates, checkAlerts, collectMarketData, sendChannelPrice, sendChannelVolume, sendChannelDaily, sendChannelTrending, sendChannelFng, sendChannelAI, sendChannelFutures, sendChannelMovers, sendChannelAll };
