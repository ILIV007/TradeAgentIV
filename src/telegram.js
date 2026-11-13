// TradeAgent IV — Telegram API wrappers, stickers, keyboards.
import { STICKER_SET_NAME, AI_MODES, SCENARIOS, ALERT_PRESETS, COINS } from './config.js';
import { fetchWithTimeout } from './utils.js';
import { getConfig } from './store.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. TELEGRAM API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function tgMethod(token, method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 15000);
      const d = await r.json();
      if (!d.ok) {
        const err = new Error(d.description || `TG ${method} error`);
        err.code = d.error_code; throw err;
      }
      return d;
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('not modified')) throw e;
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function sendRich(env, chatId, richHtml, fallback, markup = null, lang = 'en') {
  // v6.1.11 CPU diet: the classic fallback is LAZY — call sites pass a
  // thunk (() => buildX(...)) and it is built only when rich is off or the
  // rich send fails. Building it eagerly cost ~1.4ms on every price tick
  // for a post that is almost never sent. A plain string still works.
  const resolveFallback = async () => (typeof fallback === 'function' ? await fallback() : fallback);
  // Panel toggle (config rich_mode): off = classic format everywhere.
  if ((await getConfig(env, 'rich_mode', 'on')) === 'off') return sendMessage(env, chatId, await resolveFallback(), markup);
  const body = { chat_id: chatId, rich_message: { html: richHtml } };
  if (markup) body.reply_markup = markup;
  try {
    return await tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendRichMessage', body);
  } catch (e) {
    console.error('[TG] sendRichMessage failed, falling back to HTML:', e.message);
    return sendMessage(env, chatId, await resolveFallback(), markup);
  }
}

async function sendPoll(env, chatId, question, options) {
  const body = { chat_id: chatId, question, options: options.map((text) => ({ text })), is_anonymous: true };
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendPoll', body);
}

// PV-COPY RULE (owner, 2026-11-12): a post sent to the channel MANUALLY
// (panel button, /send* command, /admin trigger) is also delivered to the
// admin PV as an exact copy. The cron path NEVER calls this. Never throws:
// a failed copy must not fail the send itself.
async function copyToAdmin(env, res) {
  if (!env.ADMIN_ID || !res) return;
  const list = Array.isArray(res) ? res : [res];
  for (const r of list) {
    const mid = r?.result?.message_id;
    if (!mid) continue;
    try {
      await tgMethod(env.TELEGRAM_BOT_TOKEN, 'copyMessage', {
        chat_id: env.ADMIN_ID,
        from_chat_id: env.TELEGRAM_CHANNEL_ID,
        message_id: mid,
      });
    } catch (e) {
      console.error('[PV-COPY] failed for msg', mid, e.message);
    }
  }
}

async function sendMessage(env, chatId, text, markup = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (markup) body.reply_markup = markup;

  try {
    return await tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendMessage', body);
  } catch (e) {
    // If HTML parsing fails, retry without parse_mode
    const msg = (e.message || '').toLowerCase();
    if (msg.indexOf("parse entities") !== -1 || msg.indexOf("bad request") !== -1 || msg.indexOf("html") !== -1) {
      console.log('[TG] HTML parse failed, retrying without parse_mode');
      const fallbackBody = { 
        chat_id: chatId, 
        text: text.replace(/<[^>]*>/g, ''), 
        disable_web_page_preview: true 
      };
      if (markup) fallbackBody.reply_markup = markup;
      return await tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendMessage', fallbackBody);
    }
    throw e;
  }
}

async function sendSticker(env, chatId, stickerFileId) {
  return tgMethod(env.TELEGRAM_BOT_TOKEN, 'sendSticker', { chat_id: chatId, sticker: stickerFileId });
}

async function answerCallback(env, queryId, text = null) {
  try {
    const body = { callback_query_id: queryId };
    if (text) body.text = text;
    return await tgMethod(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', body);
  } catch (e) {
    console.log(`[CALLBACK] Silently ignoring: ${e.message}`);
    return null;
  }
}

async function editMessage(env, chatId, messageId, text, markup = null) {
  try {
    const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (markup) body.reply_markup = markup;
    return await tgMethod(env.TELEGRAM_BOT_TOKEN, 'editMessageText', body);
  } catch (e) {
    const msg = (e.message || '').toLowerCase();
    if (msg.includes('not modified')) {
      console.log(`[EDIT] Ignoring "not modified" for msg ${messageId}`);
      return null;
    }
    throw e;
  }
}

async function getStickerFileId(env) {
  if (!env.ALERTS_KV) return null;
  try {
    const cached = await env.ALERTS_KV.get('sticker:file_id');
    if (cached) {
      console.log('[STICKER] Using cached file_id');
      return cached;
    }
    
    console.log(`[STICKER] Fetching set: ${STICKER_SET_NAME}`);
    const set = await tgMethod(env.TELEGRAM_BOT_TOKEN, 'getStickerSet', { name: STICKER_SET_NAME });
    
    if (set.result?.stickers?.length > 0) {
      const fileId = set.result.stickers[0].file_id;
      await env.ALERTS_KV.put('sticker:file_id', fileId, { expirationTtl: 2592000 });
      console.log('[STICKER] Cached new file_id:', fileId.slice(0, 20) + '...');
      return fileId;
    } else {
      console.error('[STICKER] Set exists but empty:', STICKER_SET_NAME);
    }
  } catch (e) {
    console.error(`[STICKER] getStickerSet FAILED: ${e.message} | Set: ${STICKER_SET_NAME}`);
    console.error(`[STICKER] HINT: Bot must be owner/admin of sticker set "${STICKER_SET_NAME}"`);
  }
  return null;
}

async function sendChannelSticker(env) {
  if (!env.TELEGRAM_CHANNEL_ID) {
    console.log('[STICKER] No TELEGRAM_CHANNEL_ID');
    return 'skipped';
  }
  try {
    const fileId = await getStickerFileId(env);
    if (fileId) {
      await sendSticker(env, env.TELEGRAM_CHANNEL_ID, fileId);
      console.log('[STICKER] Sent sticker to channel');
      return 'sent';
    } else {
      console.log('[STICKER] No file_id available, skipping');
      return 'skipped';
    }
  } catch (e) {
    console.error('[STICKER] Send error:', e.message);
    return `error: ${e.message}`;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 16. KEYBOARDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function mainKeyboard(isAdminUser, lang = 'en') {
  const fa = lang === 'fa';
  const kb = fa ? [
    [{ text: '📊 قیمت‌ها' }, { text: '📈 حجم' }, { text: '🔥 ترند' }],
    [{ text: '🧠 تحلیل AI' }, { text: '🧭 ترس و طمع' }, { text: '📉 گزارش بازار' }],
    [{ text: '🚨 هشدارها' }, { text: '⚙️ تنظیمات' }, { text: '❓ راهنما' }],
  ] : [
    [{ text: '📊 Prices' }, { text: '📈 Volume' }, { text: '🔥 Trending' }],
    [{ text: '🧠 AI Analysis' }, { text: '🧭 F&G' }, { text: '📉 Market Report' }],
    [{ text: '🚨 Alerts' }, { text: '⚙️ Settings' }, { text: '❓ Help' }],
  ];
  if (isAdminUser) kb.push([{ text: fa ? '📣 پنل ادمین' : '📣 Admin Panel' }]);
  return { keyboard: kb, resize_keyboard: true };
}

function getAdminInline(mode, scenario, autoPosts, lang = 'en', richMode = 'on') {
  const m = AI_MODES[mode] || AI_MODES.normal;
  const s = SCENARIOS[scenario] || SCENARIOS.neutral;
  const autoStatus = autoPosts === 'true' ? '✅ On' : '⏸ Off';
  return {
    inline_keyboard: [
      [{ text: '──── 🌐 Language · زبان کانال ────', callback_data: 'noop' }],
      [
        { text: `🇬🇧 English${lang === 'en' ? ' ✓' : ''}`, callback_data: 'admin:lang:en' },
        { text: `🇮🇷 فارسی${lang === 'fa' ? ' ✓' : ''}`, callback_data: 'admin:lang:fa' },
      ],
      [{ text: '──── 📤 Send to Channel ────', callback_data: 'noop' }],
      [
        { text: '📈 Price', callback_data: 'send_price' },
        { text: '🌅 Brief', callback_data: 'send_brief' },
        { text: '🧠 Flagship', callback_data: 'send_flagship' },
      ],
      [
        { text: '🗓 Macro Cal', callback_data: 'send_macro' },
        { text: '🚀 Movers', callback_data: 'send_movers' },
        { text: '🗓 Weekly', callback_data: 'send_weekly' },
      ],
      [
        { text: '📉 Volume', callback_data: 'send_volume' },
        { text: '🔥 Trending', callback_data: 'send_trending' },
        { text: '🧭 F&G', callback_data: 'send_fng' },
      ],
      [
        { text: '⚡ Futures', callback_data: 'send_futures' },
        { text: '🤖 AI (legacy)', callback_data: 'send_ai' },
        { text: '📊 All', callback_data: 'send_all' },
      ],
      [{ text: '──── AI Configuration ────', callback_data: 'noop' }],
      [
        { text: `🤖 ${m}`, callback_data: 'admin:ai_mode' },
        { text: `🎛 ${s}`, callback_data: 'admin:scenario' },
      ],
      [
        { text: '🧪 Custom Prompt', callback_data: 'admin:custom' },
        { text: '📤 Resend Last', callback_data: 'admin:resend' },
      ],
      [{ text: '──── System ────', callback_data: 'noop' }],
      [
        { text: '🤖 AI Status', callback_data: 'admin:ai_status' },
        { text: '📊 API Status', callback_data: 'admin:api_status' },
      ],
      [
        { text: `✨ Rich: ${richMode === 'off' ? '❌ Off' : '✅ On'}`, callback_data: 'admin:rich_toggle' },
        { text: `⏸ Auto: ${autoStatus}`, callback_data: 'admin:auto_posts' },
      ],
      [{ text: '🔙 Back to Menu', callback_data: 'back_main' }],
    ],
  };
}

const aiModeInline = {
  inline_keyboard: [
    [{ text: '🤖 Normal', callback_data: 'set_mode:normal' }, { text: '⚡ Deep', callback_data: 'set_mode:deep' }],
    [{ text: '🎯 Short Signal', callback_data: 'set_mode:short' }, { text: '🧠 Emotion', callback_data: 'set_mode:emotion' }],
    [{ text: '🔙 Back to Admin', callback_data: 'admin:page:main' }],
  ],
};

const scenarioInline = {
  inline_keyboard: [
    [{ text: '🚀 Bullish', callback_data: 'set_scenario:bullish' }, { text: '💀 Bearish', callback_data: 'set_scenario:bearish' }],
    [{ text: '⚖️ Neutral', callback_data: 'set_scenario:neutral' }, { text: '🧨 Volatile', callback_data: 'set_scenario:volatile' }],
    [{ text: '🔙 Back to Admin', callback_data: 'admin:page:main' }],
  ],
};

function alertsInline(states) {
  const rows = [];
  for (const [coinId, cfg] of Object.entries(ALERT_PRESETS)) {
    const c = COINS[coinId]; if (!c) continue;
    const aboveKey = `${coinId}:above`, belowKey = `${coinId}:below`;
    const aboveOn = states[aboveKey] ? '🟢' : '⚪️', belowOn = states[belowKey] ? '🔴' : '⚪️';
    rows.push([
      { text: `${aboveOn} ${c.symbol} 🚀 +${cfg.pct}% (24h)`, callback_data: `toggle:${aboveKey}` },
      { text: `${belowOn} ${c.symbol} 📉 -${cfg.pct}% (24h)`, callback_data: `toggle:${belowKey}` },
    ]);
  }
  rows.push([{ text: '🔙 Back', callback_data: 'back_main' }]);
  return { inline_keyboard: rows };
}

export { tgMethod, sendMessage, sendRich, sendPoll, sendSticker, answerCallback, editMessage, getStickerFileId, sendChannelSticker, copyToAdmin, mainKeyboard, getAdminInline, aiModeInline, scenarioInline, alertsInline };
