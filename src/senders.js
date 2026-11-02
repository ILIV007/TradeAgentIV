// TradeAgent IV — alert logic, market-data collection, channel senders.
import { COINS, ALERT_PRESETS, FOOTER } from './config.js';
import { fmt, esc } from './utils.js';
import { getCoins, getGlobal, getTrending, getFearGreed, getTopGainersLosers, getCategories, getMarketChart, getBinanceFutures, calculateEmotionState } from './data.js';
import { getAIAnalysis, buildAIPrompt, buildFlagshipPrompt, buildFlashPrompt, validateFlagship, validateGrounded } from './ai.js';
import { buildPrice, buildVolume, buildDaily, buildTrending, buildFng, buildAIAnalysis, buildAlert, buildFutures, buildMovers, buildFlagshipClassic, buildBriefClassic, buildFlashClassic, buildWeeklyClassic, buildMacroCalendarClassic } from './posts.js';
import { sendMessage, sendRich, sendPoll, sendChannelSticker } from './telegram.js';
import { dedupSend, DEDUP_SKIPPED, getConfig, getSnapshot, storeSnapshot, getMarketState, putMarketState, kvGetJSON, kvPutJSON } from './store.js';
import { buildMarketState, getMacroEvents, sparkLevels } from './state.js';
import { buildRichSnapshot, buildRichMorningBrief, buildRichFlagship, buildRichEventFlash, buildRichMacroWatch, buildRichWeekly, buildRichMovers, buildRichMacroCalendar, tehranTime } from './rich.js';

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
    // v6: the snapshot is built from the unified Market State (persisted
    // to KV for the AI cycle) and delivered rich-first with the classic
    // HTML post as automatic fallback.
    const s = await getFreshState(env);
    await checkAlerts(env, s.prices);
    const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
    const sym = (c) => COINS[c.id]?.symbol || c.id;
    const ctx = {
      btcDominance: s.global.btcDominance ? s.global.btcDominance.toFixed(1) : null,
      fearGreed: s.fearGreed.now,
      best: sorted.length ? `${sym(sorted[0])} +${(sorted[0].price_change_percentage_24h || 0).toFixed(1)}%` : null,
      weakest: sorted.length ? `${sym(sorted[sorted.length - 1])} ${(sorted[sorted.length - 1].price_change_percentage_24h || 0).toFixed(1)}%` : null,
      btcSpark: s.btcSpark,
      regime: s.regime,
    };
    await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichSnapshot(s.prices, s.source, ctx), await buildPrice(s.prices, s.source, ctx));
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
    await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichMovers(gl), await buildMovers(gl));
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

export { trendingPriceMap, getAllAlertStates, checkAlerts, collectMarketData, sendChannelPrice, sendChannelVolume, sendChannelDaily, sendChannelTrending, sendChannelFng, sendChannelAI, sendChannelFutures, sendChannelMovers, sendChannelAll, sendChannelMorningBrief, sendChannelFlagship, sendChannelWeekly, sendChannelMacroCalendar, checkMacroEvents, evaluateScorecard, getFreshState, tehranParts, cronDispatch };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// v6 SENDERS — Morning Brief, Flagship, Weekly, Macro Watcher
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function notifyAdmin(env, text) {
  if (env.ADMIN_ID) { try { await sendMessage(env, env.ADMIN_ID, text); } catch (e) {} }
}

async function getFreshState(env) {
  const prev = await getMarketState(env);
  const s = await buildMarketState(env, prev);
  s._levels = sparkLevels(s.btcSpark);
  await putMarketState(env, s);
  return s;
}

async function sendChannelMorningBrief(env) {
  ensureChannel(env);
  return await dedupSend(env, 'brief', async () => {
    const s = await getFreshState(env);
    const dateStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' });
    await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichMorningBrief(s, dateStr), buildBriefClassic(s, dateStr));
  });
}

async function sendChannelFlagship(env) {
  ensureChannel(env);
  return await dedupSend(env, 'flagship', async () => {
    const s = await getFreshState(env);
    const prompt = buildFlagshipPrompt(s);
    let text = await getAIAnalysis(env, prompt);
    let v = text ? validateFlagship(text, s) : null;
    if (!v?.ok) {
      const errs = v ? v.errors.join('; ') : 'AI unavailable';
      console.error('[FLAGSHIP] draft rejected:', errs);
      text = await getAIAnalysis(env, `${prompt}\n\nIMPORTANT: a previous draft was rejected (${errs}). Rewrite completely, fixing every issue.`);
      v = text ? validateFlagship(text, s) : null;
    }
    if (!v?.ok) {
      await notifyAdmin(env, '⚠️ <b>Flagship analysis failed validation</b> — no post was sent to the channel.');
      return;
    }
    await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichFlagship(s, v.parsed), buildFlagshipClassic(s, v.parsed));
    const recs = (await kvGetJSON(env, 'scen:records')) || [];
    recs.push({ ts: Date.now(), btc: s.prices.find((c) => c.id === 'bitcoin')?.current_price || 0, scenarios: v.parsed.scenarios.map(({ kind, lean, level, side }) => ({ kind, lean, level, side })) });
    await kvPutJSON(env, 'scen:records', recs.slice(-40));
  });
}

function evaluateScorecard(records, path) {
  const out = { posts: records.length, baseFired: 0, bullFired: 0, bullHit: 0, bearFired: 0, bearHit: 0 };
  for (const rec of records) {
    const win = path.filter((p) => p.ts > rec.ts && p.btc > 0);
    if (!win.length) continue;
    const evalSide = (sc, isBull) => {
      if (!sc || sc.level == null) return { fired: false };
      const idx = win.findIndex((p) => (isBull ? p.btc > sc.level : p.btc < sc.level));
      if (idx < 0) return { fired: false };
      const later = win.find((p) => p.ts >= win[idx].ts + 86400000) || win[win.length - 1];
      return { fired: true, hit: isBull ? later.btc > sc.level : later.btc < sc.level };
    };
    const bull = evalSide(rec.scenarios.find((x) => x.kind === 'BULL'), true);
    const bear = evalSide(rec.scenarios.find((x) => x.kind === 'BEAR'), false);
    if (bull.fired) { out.bullFired++; if (bull.hit) out.bullHit++; }
    if (bear.fired) { out.bearFired++; if (bear.hit) out.bearHit++; }
    if (!bull.fired && !bear.fired) out.baseFired++;
  }
  return out;
}

async function sendChannelWeekly(env) {
  ensureChannel(env);
  return await dedupSend(env, 'weekly', async () => {
    const s = await getFreshState(env);
    let path = [], regimePath = '';
    try {
      if (env.ALERTS_KV?.list) {
        const { keys } = await env.ALERTS_KV.list({ prefix: 'state:hist:' });
        const states = [];
        for (const k of keys.slice(-200)) { const st = await kvGetJSON(env, k.name); if (st) states.push(st); }
        states.sort((a, b) => a.ts - b.ts);
        path = states.map((st) => ({ ts: st.ts, btc: st.prices?.find((c) => c.id === 'bitcoin')?.current_price || 0 })).filter((p) => p.btc > 0);
        const byDay = {};
        for (const st of states) { const day = new Date(st.ts).toLocaleDateString('en-GB', { timeZone: 'Asia/Tehran', weekday: 'short' }); if (!byDay[day] && st.regime) byDay[day] = st.regime; }
        regimePath = Object.entries(byDay).map(([d, r]) => `${d} ${r.label.replace(/_/g, ' ')} ${r.score}`).join(' → ');
      }
    } catch (e) { console.error('[WEEKLY] history read fail:', e.message); }
    const now = Date.now();
    path.push({ ts: now, btc: s.prices.find((c) => c.id === 'bitcoin')?.current_price || 0 });
    const recs = ((await kvGetJSON(env, 'scen:records')) || []).filter((r) => now - r.ts <= 7 * 86400000);
    const week = { regimePath, scorecard: evaluateScorecard(recs, path) };
    await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichWeekly(s, week), buildWeeklyClassic(s, week));
  });
}

const macroKey = (e) => `${e.title}|${e.ts}`;

async function checkMacroEvents(env) {
  ensureChannel(env);
  const macro = await getMacroEvents().catch(() => null);
  if (!macro) return;
  const now = Date.now();
  const markers = (await kvGetJSON(env, 'watch:markers')) || { watched: [], flashed: [], spikeDay: '' };
  let dirty = false;
  const events = [...(macro.today || []), ...(macro.ahead || [])].filter((e) => /high/i.test(e.impact || ''));
  const seen = new Set();
  for (const e of events) {
    const key = macroKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.ts > now && e.ts - now <= 75 * 60000 && !markers.watched.includes(key)) {
      await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichMacroWatch(e), `👀 <b>Macro Watch — ${esc(e.title)}</b>\nForecast ${esc(e.forecast || '—')} · Previous ${esc(e.previous || '—')}\n\n${FOOTER}`);
      await sendPoll(env, env.TELEGRAM_CHANNEL_ID, `📊 ${e.title} (${e.country}) prints at ${tehranTime(e.ts)} Tehran — beat or miss?`, ['Beat expectations 📈', 'In line ⚖️', 'Miss expectations 📉']).catch(() => {});
      markers.watched.push(key); dirty = true;
    }
    if (e.actual && e.ts <= now && now - e.ts <= 3 * 3600000 && !markers.flashed.includes(key)) {
      const s = await getFreshState(env);
      let aiText = await getAIAnalysis(env, buildFlashPrompt(s, e));
      if (aiText && !validateGrounded(aiText, s, [e]).ok) aiText = null;
      if (!aiText) {
        const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
        aiText = `${e.title} printed at ${e.actual} versus ${e.forecast || '—'} expected (previous ${e.previous || '—'}). Bitcoin trades at $${fmt.price(btc.current_price)} (${fmt.pct(btc.price_change_percentage_24h)} on the day) as the market digests the release.`;
      }
      await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichEventFlash(s, e, aiText), buildFlashClassic(s, e, aiText));
      markers.flashed.push(key); dirty = true;
    }
  }
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
  if (markers.spikeDay !== todayStr) {
    const s = await getMarketState(env);
    const btc = s?.prices?.find((c) => c.id === 'bitcoin');
    if (s && btc && Math.abs(btc.price_change_percentage_24h || 0) >= 5) {
      const dir = btc.price_change_percentage_24h > 0 ? 'surged' : 'dropped';
      await sendMessage(env, env.TELEGRAM_CHANNEL_ID, `🎯 <b>Sharp move:</b> BTC has ${dir} ${fmt.pct(btc.price_change_percentage_24h)} in 24h to $${fmt.price(btc.current_price)}. One question for the channel 👇`);
      await sendPoll(env, env.TELEGRAM_CHANNEL_ID, `BTC ${fmt.pct(btc.price_change_percentage_24h)} in 24h — what is this move?`, ['The start of a real trend 🚀', 'A trap — reversal coming 🪤', 'Noise — range continues ⚖️']).catch(() => {});
      markers.spikeDay = todayStr; dirty = true;
    }
  }
  if (dirty) await kvPutJSON(env, 'watch:markers', { watched: markers.watched.slice(-30), flashed: markers.flashed.slice(-30), spikeDay: markers.spikeDay });
}

async function sendChannelMacroCalendar(env) {
  ensureChannel(env);
  return await dedupSend(env, 'macro', async () => {
    const s = await getFreshState(env);
    const dateStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' });
    await sendRich(env, env.TELEGRAM_CHANNEL_ID, buildRichMacroCalendar(s, dateStr), buildMacroCalendarClassic(s, dateStr));
  });
}

// The cron PATTERN count never changes (3, as in production). The */30
// price cron additionally dispatches the daily products by Tehran clock
// so each post lands at its own time.
function tehranParts(ts = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts));
  const g = (t) => parts.find((x) => x.type === t)?.value;
  return { weekday: g('weekday'), hm: `${g('hour')}:${g('minute')}` };
}

function cronDispatch(parts) {
  const out = [];
  if (parts.hm === '08:00') out.push('macro');
  if (parts.hm === '09:30') out.push('brief');
  if (parts.hm === '13:00' || parts.hm === '21:00') out.push('flagship');
  if (parts.weekday === 'Fri' && parts.hm === '20:00') out.push('weekly');
  return out;
}
