// TradeAgent IV — private-chat handlers and webhook processing.
import { COINS, TIER_1, TIER_2, TIER_3, AI_MODES, SCENARIOS, FOOTER, ALERT_PRESETS } from './config.js';
import { esc, fmt, isAdmin } from './utils.js';
import { getCoins, getGlobal, getTrending, getFearGreed, getCoinsCG, getCoinsBinance, getBinanceFutures, getTopGainersLosers } from './data.js';
import { testGeminiConnection } from './ai.js';
import { buildPrice, buildVolume, buildDaily, buildTrending, buildFng, buildAIAnalysis } from './posts.js';
import { sendMessage, editMessage, answerCallback, mainKeyboard, getAdminInline, aiModeInline, scenarioInline, alertsInline } from './telegram.js';
import { getConfig, setConfig, getUserState, setUserState } from './store.js';
import { getAllAlertStates, trendingPriceMap, sendChannelPrice, sendChannelVolume, sendChannelDaily, sendChannelTrending, sendChannelFng, sendChannelAI, sendChannelFutures, sendChannelMovers, sendChannelAll } from './senders.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 21. BOT HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleStart(chatId, userId, env) {
  const admin = isAdmin(userId, env);
  const text = admin
    ? `👋 <b>Welcome Admin!</b>\n\nTradeAgent IV Control Panel.`
    : `👋 <b>Welcome to TradeAgent IV!</b>\n\nAI Crypto Intelligence Dashboard.`;
  await sendMessage(env, chatId, text, mainKeyboard(admin));
}

async function handlePrices(chatId, env) {
  const [{ source, data }, globalData, fear] = await Promise.all([getCoins(env), getGlobal(env), getFearGreed()]);
  const ctx = { btcDominance: Number(globalData?.data?.market_cap_percentage?.btc || 0).toFixed(1), fearGreed: fear?.data?.[0] ? parseInt(fear.data[0].value) : null };
  await sendMessage(env, chatId, await buildPrice(data, source, ctx));
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
    await sendMessage(env, chatId, `🔥 <b>TRENDING COINS</b>\n\n<i>Data unavailable</i>\n\n${FOOTER}`);
    return;
  }
  await sendMessage(env, chatId, await buildTrending(trending, await trendingPriceMap(env)));
}

async function handleFng(chatId, env) {
  const fear = await getFearGreed();
  await sendMessage(env, chatId, await buildFng(fear));
}

async function handleAlerts(chatId, env) {
  const states = await getAllAlertStates(env);
  let text = `🚨 <b>Move Alert Settings</b>\n\nChannel alerts when the 24h move crosses a threshold:\n\n`;
  for (const [coinId, cfg] of Object.entries(ALERT_PRESETS)) {
    const c = COINS[coinId];
    text += `${c.emoji} <b>${c.symbol}</b> — ±${cfg.pct}% (24h)\n\n`;
  }
  await sendMessage(env, chatId, text, alertsInline(states));
}

async function handleSettings(chatId, env) {
  const sources = [];
  if (env.COINGECKO_API_KEY) sources.push('CoinGecko');
  if (env.CMC_API_KEY) sources.push('CoinMarketCap');
  sources.push('Binance');
  
  const aiStatus = env.GEMINI_API_KEY ? '✅ Gemini' : '⚠️ Off';
  const orStatus = env.OPENROUTER_API_KEY ? '✅ OpenRouter' : '⚠️ Off';
  const mode = await getConfig(env, 'ai_mode', 'normal');
  const scenario = await getConfig(env, 'scenario', 'neutral');
  const autoPosts = await getConfig(env, 'auto_posts', 'true');

  await sendMessage(env, chatId,
    `⚙️ <b>Settings</b>\n\n` +
    `Channel: ${env.TELEGRAM_CHANNEL_ID || 'Not set'}\n` +
    `Coins: ${Object.keys(COINS).length} (T1:${Object.keys(TIER_1).length} T2:${Object.keys(TIER_2).length} T3:${Object.keys(TIER_3).length})\n` +
    `Sources: ${sources.join(', ')}\n` +
    `AI: ${aiStatus} | ${orStatus}\n` +
    `Mode: ${AI_MODES[mode]} | Scenario: ${SCENARIOS[scenario]}\n` +
    `Auto Posts: ${autoPosts === 'true' ? 'On' : 'Off'}\n\n` +
    `Use /admin for admin panel.`
  );
}

async function showAdminPanel(chatId, env) {
  const mode = await getConfig(env, 'ai_mode', 'normal');
  const scenario = await getConfig(env, 'scenario', 'neutral');
  const autoPosts = await getConfig(env, 'auto_posts', 'true');
  await sendMessage(env, chatId, `📣 <b>Admin Control Panel</b>\n\nManage posts, AI config, and system status:`, getAdminInline(mode, scenario, autoPosts));
}

async function handleHelp(chatId, env, userId) {
  const admin = isAdmin(userId, env);
  let text = `📖 <b>TradeAgent IV Commands</b>\n\n`;
  text += `/start — Main menu\n`;
  text += `/price — Live prices\n`;
  text += `/volume — Volume leaders\n`;
  text += `/daily — Daily report\n`;
  text += `/marketreport — Daily market report (alias)\n`;
  text += `/trending — Hot coins\n`;
  text += `/fng — Fear & Greed index\n`;
  text += `/feargreed — Fear & Greed (alias)\n`;
  text += `/fg — Fear & Greed (short alias)\n`;
  text += `/alerts — Alert settings\n`;
  text += `/settings — Bot config\n`;
  text += `/help — This menu\n`;
  
  if (admin) {
    text += `\n<b>Admin Commands:</b>\n`;
    text += `/admin — Admin panel\n`;
    text += `/sendprice — Send snapshot to channel\n`;
    text += `/sendvolume — Send volume to channel\n`;
    text += `/sendai — Send AI analysis to channel\n`;
    text += `/senddaily — Send daily report to channel\n`;
    text += `/sendfutures — Send funding rates to channel\n`;
    text += `/sendmovers — Send top movers to channel\n`;
    text += `/sendall — Send everything to channel\n`;
    text += `/aiprompt — Custom AI prompt\n`;
  }
  await sendMessage(env, chatId, text);
}

async function handleAIStatus(chatId, env) {
  const geminiTest = await testGeminiConnection(env);
  const lastProvider = await getConfig(env, 'last_ai_provider', 'Unknown');
  const lastTime = await getConfig(env, 'last_ai_time', 'Never');
  
  let text = `🤖 <b>AI System Status</b>\n\n`;
  text += `<b>Gemini 3.8 Flash:</b> ${geminiTest.ok ? '✅ Active' : `⚠️ ${geminiTest.error}`}\n`;
  text += `<b>OpenRouter:</b> ${env.OPENROUTER_API_KEY ? '✅ Configured' : '⚠️ No Key'}\n`;
  text += `<b>Last Provider:</b> ${lastProvider}\n`;
  text += `<b>Last Analysis:</b> ${lastTime}\n`;
  text += `\nUse /debug for full API diagnostics.`;
  await sendMessage(env, chatId, text);
}

async function handleAPIStatus(chatId, env) {
  const checks = [];
  try { const cg = await getCoinsCG(env); checks.push(`CoinGecko: ${cg ? '✅' : '⚠️'}`); } catch(e) { checks.push(`CoinGecko: ❌`); }
  try { const bin = await getCoinsBinance(); checks.push(`Binance: ${bin ? '✅' : '⚠️'}`); } catch(e) { checks.push(`Binance: ❌`); }
  try { const f = await getBinanceFutures('BTCUSDT'); checks.push(`Futures: ${f.fundingRate != null ? '✅' : '⚠️'}`); } catch(e) { checks.push(`Futures: ❌`); }
  try { const fng = await getFearGreed(); checks.push(`F&G: ${fng?.data ? '✅' : '⚠️'}`); } catch(e) { checks.push(`F&G: ❌`); }
  try { const mov = await getTopGainersLosers(env); checks.push(`Movers: ${mov ? '✅' : '⚠️'}`); } catch(e) { checks.push(`Movers: ❌`); }
  
  let text = `📊 <b>API Health Check</b>\n\n${checks.join('\n')}\n\nUse /debug for detailed report.`;
  await sendMessage(env, chatId, text);
}

async function handleAutoPosts(chatId, env, msgId = null) {
  const current = await getConfig(env, 'auto_posts', 'true');
  const newVal = current === 'true' ? 'false' : 'true';
  await setConfig(env, 'auto_posts', newVal);
  const statusText = `⏸ <b>Auto Posts</b>\n\nStatus: ${newVal === 'true' ? '✅ Enabled' : '⏸ Disabled'}\n\nCron jobs will ${newVal === 'true' ? 'run normally' : 'be skipped'}.`;
  
  if (msgId) {
    const mode = await getConfig(env, 'ai_mode', 'normal');
    const scenario = await getConfig(env, 'scenario', 'neutral');
    await editMessage(env, chatId, msgId, statusText, getAdminInline(mode, scenario, newVal));
  } else {
    await sendMessage(env, chatId, statusText);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 22. WEBHOOK PROCESSOR — FIXED COMMAND ROUTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function processWebhook(update, env, ctx) {
  try {
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text || '';

      const state = await getUserState(env, userId);
      if (state === 'awaiting_prompt' && text !== '/cancel') {
        await setUserState(env, userId, null);
        await sendMessage(env, chatId, '⏳ Processing custom prompt...');
        try {
          await sendChannelAI(env, text);
          await sendMessage(env, chatId, '✅ Custom AI analysis sent to channel!');
        } catch (e) {
          await sendMessage(env, chatId, `❌ Error: ${esc(e.message)}`);
        }
        return;
      }
      if (state === 'awaiting_prompt' && text === '/cancel') {
        await setUserState(env, userId, null);
        await sendMessage(env, chatId, '❌ Cancelled.');
        return;
      }

      console.log(`[BOT] ${userId}: ${text}`);

      if (text === '/start') await handleStart(chatId, userId, env);
      else if (text === '/price' || text === '📊 Prices') await handlePrices(chatId, env);
      else if (text === '/volume' || text === '📈 Volume') await handleVolume(chatId, env);
      else if (text === '/daily' || text === '📉 Market Report' || text === '📈 Market Report' || text === '/marketreport') await handleDaily(chatId, env);
      else if (text === '/trending' || text === '🔥 Trending') await handleTrending(chatId, env);
      else if (text === '/fng' || text === '🧭 F&G' || text === '🧠 F&G' || text === '/feargreed' || text === '/fg') await handleFng(chatId, env);
      else if (text === '/alerts' || text === '🚨 Alerts') await handleAlerts(chatId, env);
      else if (text === '/settings' || text === '⚙️ Settings') await handleSettings(chatId, env);
      else if (text === '/help' || text === '❓ Help') await handleHelp(chatId, env, userId);
      else if (text === '/admin' || text === '📣 Admin Panel') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ <b>Access Denied</b>'); return; }
        await showAdminPanel(chatId, env);
      }
      else if (text === '/sendprice') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending snapshot...'); await sendChannelPrice(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendvolume') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending volume...'); await sendChannelVolume(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendai') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Generating AI analysis...'); 
        try {
          await sendChannelAI(env); 
          await sendMessage(env, chatId, '✅ Done!');
        } catch (e) {
          await sendMessage(env, chatId, `❌ AI Failed: ${esc(e.message)}`);
        }
      }
      else if (text === '/senddaily') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending daily report...'); await sendChannelDaily(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendfutures') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending futures...'); await sendChannelFutures(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendmovers') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending movers...'); await sendChannelMovers(env); await sendMessage(env, chatId, '✅ Done!');
      }
      else if (text === '/sendall') {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending all reports...'); 
        try {
          await sendChannelAll(env, ctx); 
          await sendMessage(env, chatId, '✅ All done! Sticker sent first.');
        } catch (e) {
          await sendMessage(env, chatId, `❌ Error: ${esc(e.message)}`);
        }
      }
      else if (text.startsWith('/aiprompt')) {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        const prompt = text.replace('/aiprompt', '').trim();
        if (!prompt) {
          await sendMessage(env, chatId, '🧪 <b>Custom AI Prompt</b>\n\nEnter your prompt below, or use /cancel.\n\nExample: "Focus on Ethereum staking flows and macro correlation"');
          await setUserState(env, userId, 'awaiting_prompt');
          return;
        }
        await sendMessage(env, chatId, '⏳ Processing...');
        try {
          await sendChannelAI(env, prompt);
          await sendMessage(env, chatId, '✅ Custom AI sent to channel!');
        } catch (e) {
          await sendMessage(env, chatId, `❌ AI Failed: ${esc(e.message)}`);
        }
      }
      else if (text.startsWith('/')) {
        await sendMessage(env, chatId, '❓ Unknown command. Use /help for available commands.');
      }
    }

    if (update.callback_query) {
      const q = update.callback_query;
      const chatId = q.message.chat.id;
      const userId = q.from.id;
      const data = q.data;
      const msgId = q.message.message_id;

      await answerCallback(env, q.id);

      if (data === 'noop') return;

      if (data.startsWith('send_')) {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        await sendMessage(env, chatId, '⏳ Sending to channel...');
        try {
          if (data === 'send_price') await sendChannelPrice(env);
          if (data === 'send_volume') await sendChannelVolume(env);
          if (data === 'send_ai') await sendChannelAI(env);
          if (data === 'send_trending') await sendChannelTrending(env);
          if (data === 'send_fng') await sendChannelFng(env);
          if (data === 'send_all') await sendChannelAll(env, ctx);
          if (data === 'send_futures') await sendChannelFutures(env);
          if (data === 'send_movers') await sendChannelMovers(env);
          const mode = await getConfig(env, 'ai_mode', 'normal');
          const scenario = await getConfig(env, 'scenario', 'neutral');
          const autoPosts = await getConfig(env, 'auto_posts', 'true');
          await editMessage(env, chatId, msgId, `✅ <b>Sent!</b>\n🕒 ${fmt.time()}`, getAdminInline(mode, scenario, autoPosts));
        } catch (e) {
          const mode = await getConfig(env, 'ai_mode', 'normal');
          const scenario = await getConfig(env, 'scenario', 'neutral');
          const autoPosts = await getConfig(env, 'auto_posts', 'true');
          await editMessage(env, chatId, msgId, `❌ <b>Error:</b> ${esc(e.message)}`, getAdminInline(mode, scenario, autoPosts));
        }
        return;
      }

      if (data === 'admin:ai_mode') {
        if (!isAdmin(userId, env)) return;
        await editMessage(env, chatId, msgId, `🤖 <b>Select AI Mode</b>\n\nCurrent: ${AI_MODES[await getConfig(env, 'ai_mode', 'normal')]}`, aiModeInline);
        return;
      }

      if (data === 'admin:scenario') {
        if (!isAdmin(userId, env)) return;
        await editMessage(env, chatId, msgId, `🎛 <b>Select Scenario</b>\n\nCurrent: ${SCENARIOS[await getConfig(env, 'scenario', 'neutral')]}`, scenarioInline);
        return;
      }

      if (data.startsWith('set_mode:')) {
        if (!isAdmin(userId, env)) return;
        const mode = data.replace('set_mode:', '');
        await setConfig(env, 'ai_mode', mode);
        const scenario = await getConfig(env, 'scenario', 'neutral');
        const autoPosts = await getConfig(env, 'auto_posts', 'true');
        await editMessage(env, chatId, msgId, `📣 <b>Admin Panel</b>\n\n✅ AI Mode: <b>${AI_MODES[mode]}</b>`, getAdminInline(mode, scenario, autoPosts));
        return;
      }

      if (data.startsWith('set_scenario:')) {
        if (!isAdmin(userId, env)) return;
        const scenario = data.replace('set_scenario:', '');
        await setConfig(env, 'scenario', scenario);
        const mode = await getConfig(env, 'ai_mode', 'normal');
        const autoPosts = await getConfig(env, 'auto_posts', 'true');
        await editMessage(env, chatId, msgId, `📣 <b>Admin Panel</b>\n\n✅ Scenario: <b>${SCENARIOS[scenario]}</b>`, getAdminInline(mode, scenario, autoPosts));
        return;
      }

      if (data === 'admin:custom') {
        if (!isAdmin(userId, env)) return;
        await sendMessage(env, chatId, '🧪 <b>Custom AI Prompt</b>\n\nEnter your prompt below, or use /cancel.\n\nExample: "Focus on Ethereum staking flows and macro correlation"');
        await setUserState(env, userId, 'awaiting_prompt');
        return;
      }

      if (data === 'admin:resend') {
        if (!isAdmin(userId, env)) return;
        await sendMessage(env, chatId, '⏳ Resending last AI analysis...');
        try {
          const lastResult = env.ALERTS_KV ? JSON.parse(await env.ALERTS_KV.get('last:ai_result') || 'null') : null;
          const lastToday = env.ALERTS_KV ? JSON.parse(await env.ALERTS_KV.get('last:today') || 'null') : null;
          const lastEmotion = env.ALERTS_KV ? JSON.parse(await env.ALERTS_KV.get('last:emotion') || 'null') : null;
          if (lastResult && lastToday) {
            await sendMessage(env, env.TELEGRAM_CHANNEL_ID, await buildAIAnalysis(lastResult, lastToday, lastEmotion));
            await sendMessage(env, chatId, '✅ Resent to channel!');
          } else {
            await sendMessage(env, chatId, '⚠️ No previous analysis found.');
          }
        } catch (e) {
          await sendMessage(env, chatId, `❌ Error: ${esc(e.message)}`);
        }
        return;
      }

      if (data === 'admin:ai_status') {
        if (!isAdmin(userId, env)) return;
        await handleAIStatus(chatId, env);
        return;
      }

      if (data === 'admin:api_status') {
        if (!isAdmin(userId, env)) return;
        await handleAPIStatus(chatId, env);
        return;
      }

      if (data === 'admin:auto_posts') {
        if (!isAdmin(userId, env)) return;
        await handleAutoPosts(chatId, env, msgId);
        return;
      }

      if (data === 'admin:page:main') {
        if (!isAdmin(userId, env)) return;
        const mode = await getConfig(env, 'ai_mode', 'normal');
        const scenario = await getConfig(env, 'scenario', 'neutral');
        const autoPosts = await getConfig(env, 'auto_posts', 'true');
        await editMessage(env, chatId, msgId, `📣 <b>Admin Control Panel</b>\n\nManage posts, AI config, and system status:`, getAdminInline(mode, scenario, autoPosts));
        return;
      }

      if (data.startsWith('toggle:')) {
        if (!isAdmin(userId, env)) { await sendMessage(env, chatId, '⛔️ Forbidden'); return; }
        const key = data.replace('toggle:', '');
        const current = await getAlertState(env, key);
        await setAlertState(env, key, !current);
        const states = await getAllAlertStates(env);
        await editMessage(env, chatId, msgId, `🚨 <b>Alert Settings</b>\n\nUpdated!`, alertsInline(states));
        return;
      }

      if (data === 'back_main') {
        const admin = isAdmin(userId, env);
        await sendMessage(env, chatId, '👋 <b>Main Menu</b>', mainKeyboard(admin));
      }
    }
  } catch (err) {
    console.error('[BOT] CRASH:', err.message);
    try {
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) await sendMessage(env, chatId, `❌ <b>Error:</b> ${esc(err.message)}`);
    } catch (e) {}
  }
}

export { processWebhook };
