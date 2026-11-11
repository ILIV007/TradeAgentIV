// ═══════════════════════════════════════════════════════════════
//  TRADEAGENT IV HYBRID v6.1.6 — Gemini Migration
// ═══════════════════════════════════════════════════════════════
// Worker entry: cron + HTTP router (webhook, /admin, /debug).
import { CRON_PRICE, CRON_BUNDLE, CRON_MOVERS, COINS, TIER_1, TIER_2, TIER_3 } from './config.js';
import { checkSecret } from './utils.js';
import { getCoins, getCoinsCG, getCoinsCMC, getCoinsBinance, getBinanceFutures, getFearGreed, getTopGainersLosers } from './data.js';
import { testGeminiConnection } from './ai.js';
import { tgMethod, getStickerFileId, sendChannelSticker } from './telegram.js';
import { getConfig } from './store.js';
import { checkAlerts, sendChannelPrice, sendChannelVolume, sendChannelDaily, sendChannelAI, sendChannelTrending, sendChannelFng, sendChannelFutures, sendChannelMovers, sendChannelAll, sendChannelMorningBrief, sendChannelFlagship, sendChannelWeekly, sendChannelMacroCalendar, checkMacroEvents, tehranParts, cronDispatch } from './senders.js';
import { processWebhook } from './bot.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 23. CRON HANDLER — Sticker FIRST in bundle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleCron(event, env) {
  const cron = event.cron;
  console.log(`[CRON] Triggered: ${cron}`);
  
  try {
    const autoPosts = await getConfig(env, 'auto_posts', 'true');
    if (autoPosts !== 'true') {
      console.log(`[CRON] Auto-posts disabled, skipping ${cron}`);
      return;
    }
    
    if (cron === CRON_PRICE) {
      console.log('[CRON] Price + Alerts (30min)');
      await sendChannelPrice(env);
      // v6 products ride this pattern, dispatched by Tehran clock.
      await checkMacroEvents(env).catch((e) => console.error('[CRON] Watcher:', e.message));
      const dispatch = { macro: sendChannelMacroCalendar, brief: sendChannelMorningBrief, flagship: sendChannelFlagship, weekly: sendChannelWeekly };
      for (const job of cronDispatch(tehranParts())) {
        try { await dispatch[job](env); console.log(`[CRON] ✅ dispatched ${job}`); }
        catch (e) { console.error(`[CRON] ❌ ${job}:`, e.message); }
      }
    }
    else if (cron === CRON_BUNDLE) {
      console.log('[CRON] Bundle: Sticker + AI + F&G + Funding (8h)');
      try {
        await sendChannelSticker(env);
        console.log('[CRON] ✅ Sticker sent first');
      } catch (e) {
        console.error(`[CRON] ❌ Sticker: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 2000));
      
      const tasks = [
        { name: 'AI', fn: sendChannelAI, delay: 0 },
        { name: 'F&G', fn: sendChannelFng, delay: 5000 },
        { name: 'Futures', fn: sendChannelFutures, delay: 10000 },
      ];
      for (const task of tasks) {
        if (task.delay > 0) await new Promise(r => setTimeout(r, task.delay));
        try {
          await task.fn(env);
          console.log(`[CRON] ✅ ${task.name}`);
        } catch (e) {
          console.error(`[CRON] ❌ ${task.name}: ${e.message}`);
        }
      }
    }
    else if (cron === CRON_MOVERS) {
      console.log('[CRON] Top Movers (09:00/15:00/21:00 UTC)');
      await sendChannelMovers(env);
    }
    else {
      console.log(`[CRON] Unknown pattern: ${cron}`);
    }
  } catch (err) {
    console.error(`[CRON ERROR] ${cron}: ${err.message}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 24. HTTP ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleWebhookReq(request, env, ctx) {
  if (env.TELEGRAM_WEBHOOK_SECRET && request.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const update = await request.json();
    if (update?.update_id) {
      await processWebhook(update, env, ctx);
      return new Response('OK', { status: 200 });
    }
    return new Response('Not a Telegram update', { status: 200 });
  } catch (e) {
    console.error('[WEBHOOK] Parse error:', e.message);
    return new Response('OK', { status: 200 });
  }
}

async function routeAdmin(request, env, ctx) {
  if (!checkSecret(request, env)) {
    return new Response('Forbidden: x-admin-secret header missing or invalid', { status: 403 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'price';
  try {
    if (type === 'price') await sendChannelPrice(env);
    if (type === 'volume') await sendChannelVolume(env);
    if (type === 'daily') await sendChannelDaily(env);
    if (type === 'ai') await sendChannelAI(env);
    if (type === 'trending') await sendChannelTrending(env);
    if (type === 'fng') await sendChannelFng(env);
    if (type === 'futures') await sendChannelFutures(env);
    if (type === 'movers') await sendChannelMovers(env);
    if (type === 'all') await sendChannelAll(env, ctx);
    if (type === 'alert') {
      const { data } = await getCoins(env);
      await checkAlerts(env, data);
    }
    if (type === 'macro') await sendChannelMacroCalendar(env);
    if (type === 'brief') await sendChannelMorningBrief(env);
    if (type === 'flagship') await sendChannelFlagship(env);
    if (type === 'weekly') await sendChannelWeekly(env);
    if (type === 'watch') await checkMacroEvents(env);
    if (type === 'sticker') {
      await sendChannelSticker(env);
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
    has_openrouter_key: !!env.OPENROUTER_API_KEY,
    coin_count: Object.keys(COINS).length,
    tier1: Object.keys(TIER_1).length,
    tier2: Object.keys(TIER_2).length,
    tier3: Object.keys(TIER_3).length,
    version: '6.1.6',
  };

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID) {
    try {
      const me = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getMe', {});
      const member = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getChatMember', { chat_id: env.TELEGRAM_CHANNEL_ID, user_id: me.result.id });
      checks.channel_access = member.result.status;
      checks.can_post = ['administrator', 'creator'].includes(member.result.status);
    } catch (e) {
      checks.channel_access = `ERROR: ${e.message}`;
      checks.can_post = false;
    }
  }

  for (const [name, fn] of [['coingecko', getCoinsCG], ['cmc', getCoinsCMC], ['binance', getCoinsBinance]]) {
    try {
      const r = name === 'binance' ? await fn() : await fn(env);
      checks[`${name}_status`] = r ? `✅ OK (${r.length || (r.data ? r.data.length : '?')} items)` : '⚠️ No Key';
    } catch (e) { checks[`${name}_status`] = `❌ ${e.message}`; }
  }

  const geminiTest = await testGeminiConnection(env);
  checks.gemini_status = geminiTest.ok ? `✅ ${geminiTest.source}` : `⚠️ ${geminiTest.error}`;

  try {
    const f = await getBinanceFutures('BTCUSDT');
    checks.futures_status = f.fundingRate != null ? `✅ OK (Funding: ${f.fundingRate.toFixed(4)}%)` : '⚠️ No data';
  } catch (e) { checks.futures_status = `❌ ${e.message}`; }

  try {
    const fng = await getFearGreed();
    checks.fng_status = fng?.data ? `✅ OK (${fng.data[0].value}/100)` : '⚠️ No data';
  } catch (e) { checks.fng_status = `❌ ${e.message}`; }

  try {
    const movers = await getTopGainersLosers(env);
    checks.movers_status = movers ? `✅ OK (G:${movers.gainers?.length || 0} L:${movers.losers?.length || 0})` : '⚠️ No data';
  } catch (e) { checks.movers_status = `❌ ${e.message}`; }

  try {
    const stickerId = await getStickerFileId(env);
    checks.sticker_status = stickerId ? `✅ OK (${stickerId.slice(0, 20)}...)` : '⚠️ No sticker cached';
  } catch (e) { checks.sticker_status = `❌ ${e.message}`; }

  return new Response(JSON.stringify(checks, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleHttp(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  console.log(`[HTTP] ${request.method} ${path}`);

  if (path === '/webhook' && request.method === 'POST') return handleWebhookReq(request, env, ctx);
  if (path === '/admin' && request.method === 'POST') return routeAdmin(request, env, ctx);
  if (path === '/debug' && request.method === 'GET') {
    if (!checkSecret(request, env)) {
      return new Response('Forbidden: x-admin-secret required', { status: 403 });
    }
    return handleDebug(env);
  }
  if (path === '/' && request.method === 'GET') {
    return new Response(
      `TradeAgent IV HYBRID v6.1.6 — AI-Powered Crypto Intelligence\n\n` +
      `Backend: v6.1.6 (Market State, Regime Engine v2, rich delivery, flagship AI products, macro watcher)\n` +
      `UI: Plain <blockquote> for all sections + Gemini Priority + Updated Commands\n\n` +
      `Routes:\n` +
      `  POST /webhook  → Telegram webhook\n` +
      `  POST /admin    → Manual trigger (x-admin-secret required)\n` +
      `  GET  /debug    → Status check + API tests (admin secret required)\n\n` +
      `Cron: ${CRON_PRICE}, ${CRON_BUNDLE}, ${CRON_MOVERS}\n` +
      `Coins: ${Object.keys(COINS).length} (T1:${Object.keys(TIER_1).length} T2:${Object.keys(TIER_2).length} T3:${Object.keys(TIER_3).length})\n` +
      `AI: Gemini 3.5 Flash-Lite → Gemini 3.6 Flash → OpenRouter Nemotron → Gemini 3.8 Flash → openrouter/free\n` +
      `Movers: Binance 24h ticker (no CMC required)\n` +
      `Dedup: v3 (10min gap + 5min lock + race-proof)\n` +
      `F&G: Modern visual bar + signal interpretation\n` +
      `Persian: Plain <blockquote> (stable across all clients)\n` +
      `Sticker: Auto-send after bundle via getStickerSet\n` +
      `Timeout: All fetches capped at 15-25s with AbortController\n` +
      `SendAll/Cron: Sticker FIRST, then posts with 2s gap\n` +
      `AI Fail: Silent in channel + admin notified in PV\n` +
      `EditMsg: "not modified" errors ignored silently (case-insensitive)
  AI Validation: Structure check (length, sections, Persian, conclusion)
  Timeout: AbortController on every fetch\n` +
      `Cost: 100% FREE — All AI models use :free tier or Gemini free tier\n`,
      { status: 200 }
    );
  }
  return new Response('Not Found', { status: 404 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 25. EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleHttp(request, env, ctx);
    } catch (err) {
      console.error('[FETCH] FATAL:', err.message, err.stack);
      return new Response('❌ Internal error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(event, env).catch(e => console.error('[CRON] ERROR:', e)));
  },
};
