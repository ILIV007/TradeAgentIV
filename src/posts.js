// TradeAgent IV — post builders (pure: data in, Telegram HTML out).
import { COINS, FOOTER, BINANCE_MAP, SYMBOL_TO_ID } from './config.js';
import { esc, fmt, getBias, progressBar } from './utils.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17. MESSAGE BUILDERS — MODERN UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildPrice(coins, source = '', ctx = null) {
  const tier1 = coins.filter(c => COINS[c.id]?.tier === 1);
  const tier2 = coins.filter(c => COINS[c.id]?.tier === 2);
  const tier3 = coins.filter(c => COINS[c.id]?.tier === 3);
  
  let m = `📊 <b>MARKET SNAPSHOT</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${fmt.tehran()} Tehran</i>\n`;
  if (ctx && (ctx.btcDominance || ctx.fearGreed != null)) {
    const bits = [];
    if (ctx.btcDominance) bits.push(`₿ Dom: ${ctx.btcDominance}%`);
    if (ctx.fearGreed != null) bits.push(`🧠 F&G: ${ctx.fearGreed}/100`);
    m += `<i>${bits.join(' · ')}</i>\n`;
  }
  m += `\n`;
  
  if (tier1.length) {
    m += `<b>🏆 Tier 1 — Blue Chips</b>\n<pre>`;
    for (const c of tier1) {
      const i = COINS[c.id];
      const ch = c.price_change_percentage_24h || 0;
      const ch7d = c.price_change_percentage_7d_in_currency || 0;
      const sym = i.symbol.padEnd(6, ' ');
      const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
      const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
      const ch7 = (ch7d >= 0 ? '+' : '') + ch7d.toFixed(1) + '%';
      m += `${sym} ${pr}  ${ch24}  7d:${ch7}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  if (tier2.length) {
    m += `<b>🔷 Tier 2 — Utility</b>\n<pre>`;
    for (const c of tier2) {
      const i = COINS[c.id];
      const ch = c.price_change_percentage_24h || 0;
      const sym = i.symbol.padEnd(6, ' ');
      const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
      const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
      const ch7d = c.price_change_percentage_7d_in_currency;
      const ch7 = ch7d ? `  7d:${(ch7d >= 0 ? '+' : '') + ch7d.toFixed(1)}%` : '';
      m += `${sym} ${pr}  ${ch24}${ch7}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  if (tier3.length) {
    m += `<b>🐸 Tier 3 — Meme & AI</b>\n<pre>`;
    for (const c of tier3) {
      const i = COINS[c.id];
      const ch = c.price_change_percentage_24h || 0;
      const sym = i.symbol.padEnd(6, ' ');
      const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
      const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
      const ch7d = c.price_change_percentage_7d_in_currency;
      const ch7 = ch7d ? `  7d:${(ch7d >= 0 ? '+' : '') + ch7d.toFixed(1)}%` : '';
      m += `${sym} ${pr}  ${ch24}${ch7}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  const perf = coins.filter(c => COINS[c.id]);
  if (perf.length > 1) {
    const sorted = [...perf].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
    const best = sorted[0], worst = sorted[sorted.length - 1];
    m += `⭐ <b>Best:</b> ${COINS[best.id].symbol} ${fmt.pct(best.price_change_percentage_24h)} · ⚠️ <b>Weakest:</b> ${COINS[worst.id].symbol} ${fmt.pct(worst.price_change_percentage_24h)}\n\n`;
  }

  m += `${FOOTER}`;
  return m;
}

async function buildVolume(coins, source = '') {
  const sorted = [...coins].sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0));
  
  let m = `📈 <b>VOLUME LEADERS</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${fmt.tehran()} Tehran</i>\n\n<pre>`;
  
  for (const c of sorted.slice(0, 10)) {
    const i = COINS[c.id]; if (!i) continue;
    const vol = c.total_volume || 0;
    const mc = c.market_cap || 0;
    const ratioNum = mc > 0 ? (vol / mc) * 100 : 0;
    const ratio = mc > 0 ? ratioNum.toFixed(1) : '?';
    const sym = i.symbol.padEnd(6, ' ');
    const volStr = fmt.vol(vol).padStart(12, ' ');
    m += `${sym} Vol:${volStr}  Ratio:${ratio}%${ratioNum >= 15 ? ' ⚡' : ''}\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildDaily(coins, globalData, trending, fear, source = '') {
  const sorted = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const best = sorted[0], worst = sorted[sorted.length - 1];
  
  let m = `📉 <b>DAILY INTELLIGENCE</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${fmt.date()}</i>\n\n`;

  if (globalData?.data) {
    const g = globalData.data;
    m += `<b>🌍 Global Market</b>\n`;
    m += `Cap: ${fmt.cap(g.total_market_cap?.usd || 0)} | Vol: ${fmt.vol(g.total_volume?.usd || 0)} | BTC Dom: ${g.market_cap_percentage?.btc?.toFixed(1) || '?'}%\n\n`;
  }
  
  if (fear?.data?.[0]) {
    const f = fear.data[0], v = parseInt(f.value);
    m += `<b>🧠 Market Sentiment</b>\n`;
    m += `${progressBar(v)} <b>${v}/100</b>\n`;
    m += `${getBias(v)}\n\n`;
  }

  m += `<b>📋 Performance Board</b>\n<pre>`;
  for (const c of sorted) {
    const i = COINS[c.id]; if (!i) continue;
    const ch = c.price_change_percentage_24h || 0;
    const ch7d = c.price_change_percentage_7d_in_currency || 0;
    const sym = i.symbol.padEnd(6, ' ');
    const pr = ('$' + fmt.price(c.current_price)).padStart(12, ' ');
    const ch24 = ((ch >= 0 ? '🟢' : '🔴') + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%').padStart(10, ' ');
    const ch7 = (ch7d >= 0 ? '+' : '') + ch7d.toFixed(1) + '%';
    let line = `${sym} ${pr}  ${ch24}  7d:${ch7}`;
    if (c.market_cap) line += `  ${fmt.cap(c.market_cap)}`;
    m += line + '\n';
  }
  m += `</pre>\n\n`;

  if (best && COINS[best.id]) {
    m += `<b>🏆 Top Performer</b>\n`;
    m += `${COINS[best.id].emoji} ${COINS[best.id].symbol}  ${fmt.change(best.price_change_percentage_24h)}\n\n`;
  }
  if (worst && COINS[worst.id]) {
    m += `<b>⚠️ Weakest Link</b>\n`;
    m += `${COINS[worst.id].emoji} ${COINS[worst.id].symbol}  ${fmt.change(worst.price_change_percentage_24h)}\n\n`;
  }
  
  if (trending?.coins?.length) {
    m += `<b>🔥 Trending Now</b>\n`;
    for (const t of trending.coins.slice(0, 5)) {
      m += `   ${esc(t.item.symbol)} — ${esc(t.item.name)}\n`;
    }
    m += `\n`;
  }
  
  m += `${FOOTER}`;
  return m;
}

async function buildTrending(trending, priceMap = {}) {
  let m = `🔥 <b>TRENDING COINS</b>\n`;
  m += `<i>${fmt.tehran()} Tehran</i>\n\n<pre>`;
  
  if (trending?.coins?.length) {
    let rank = 1;
    for (const t of trending.coins.slice(0, 10)) {
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🔹';
      const sym = esc(t.item.symbol).padEnd(6, ' ');
      const rankStr = ('#' + (t.item.market_cap_rank || '?')).padStart(4, ' ');
      const p = priceMap[t.item.symbol];
      const extra = p ? `  $${fmt.price(p.price)} ${fmt.change(p.change)}` : '';
      m += `${medal} ${sym} ${rankStr}  ${esc(t.item.name)}${extra}\n`;
      rank++;
    }
  } else {
    m += `No trending data available.\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildFng(fear) {
  if (!fear?.data?.[0]) {
    return `🧠 <b>FEAR & GREED INDEX</b>\n\n<i>Data unavailable</i>\n\n${FOOTER}`;
  }
  
  const f = fear.data[0], v = parseInt(f.value);
  const classification = f.value_classification || 'Neutral';
  
  const filled = Math.round((v / 100) * 12);
  const bar = '█'.repeat(filled) + '░'.repeat(12 - filled);
  
  let clsEmoji = '⚪';
  let signalText = 'Balanced market sentiment.';
  if (v >= 75) {
    clsEmoji = '🔴';
    signalText = '⚠️ Extreme greed — consider taking profits.';
  } else if (v >= 55) {
    clsEmoji = '🟡';
    signalText = '📊 Greed detected — caution advised, FOMO zone.';
  } else if (v >= 45) {
    clsEmoji = '⚪';
    signalText = '⚖️ Neutral — wait for clear directional move.';
  } else if (v >= 25) {
    clsEmoji = '🟢';
    signalText = '💎 Fear present — potential accumulation zone.';
  } else {
    clsEmoji = '🟢';
    signalText = '🛡️ Extreme fear — historical buying opportunity.';
  }
  
  let m = `🧠 <b>FEAR & GREED INDEX</b>\n`;
  m += `<i>${f.timestamp ? new Date(f.timestamp * 1000).toISOString().slice(0, 10) : fmt.date()}</i>\n\n`;
  
  m += `<pre>${bar} ${v}/100</pre>\n\n`;
  
  m += `<b>${clsEmoji} ${classification.toUpperCase()}</b>\n`;
  m += `<i>${getBias(v)}</i>\n\n`;
  
  m += `<blockquote>${signalText}</blockquote>\n\n`;

  if (fear.data[1]) {
    const yv = parseInt(fear.data[1].value);
    const d = v - yv;
    m += `<i>Yesterday: ${yv}/100 (${d >= 0 ? '▲' : '▼'} ${Math.abs(d)})</i>\n\n`;
  }
  
  m += `<i>Updated: ${fmt.tehran()} Tehran</i>\n\n`;
  m += `${FOOTER}`;
  return m;
}

async function buildAIAnalysis(aiResult, todayData, emotion) {
  const t = todayData, emo = emotion || { state: 'NEUTRAL', intensity: 50, emoji: '😐', color: '⚪' };
  
  let englishText = aiResult.text || '';
  let persianText = '';

  const SEP = '---PERSIAN---';
  const separatorIndex = englishText.indexOf(SEP);
  if (separatorIndex !== -1) {
    persianText = englishText.substring(separatorIndex + SEP.length).trim();
    englishText = englishText.substring(0, separatorIndex).trim();
  }
  // Models often glue sections/bullets together; un-glue before rendering.
  englishText = englishText.replace(/\s*(<b>(Market Overview|Bullish Factors|Bearish Factors|Risk Factors|Sector Rotation|Tomorrow Watchlist|Conclusion)<\/b>)/g, '\n\n$1').trim();
  if (persianText) {
    persianText = persianText
      .replace(/([^\n])\s*•\s*/g, '$1\n• ')
      .replace(/\s*(⚠️ This analysis)/g, '\n$1');
  }
  let m = `${emo.emoji} <b>MARKET STATE: ${emo.state}</b>\n`;
  m += `${emo.color} Intensity: ${emo.intensity}/100  ·  ${t.mode || 'Normal'} Mode\n\n`;
  
  m += `🧠 <b>AI MARKET INTELLIGENCE</b>\n`;
  m += `<i>${t.date} · ${aiResult.source || 'AI'} · ${t.mode || 'Normal'}</i>\n\n`;
  
  if (englishText) {
    m += `<blockquote>\n${englishText}\n</blockquote>\n\n`;
  }
  
  if (persianText) {
    m += `<b>📋 خلاصه بازار</b>\n`;
    m += `<blockquote expandable>\n${persianText}\n</blockquote>\n\n`;
  }

  m += `<b>📊 Key Metrics</b>\n<pre>`;
  m += `BTC  $${fmt.price(t.btcPrice).padStart(12)}  ${fmt.change(t.btcChange)}\n`;
  m += `ETH  $${fmt.price(t.ethPrice).padStart(12)}  ${fmt.change(t.ethChange)}\n`;
  m += `SOL  $${fmt.price(t.solPrice).padStart(12)}  ${fmt.change(t.solChange)}\n`;
  m += `</pre>\n\n`;

  m += `<b>🌍 Global:</b> Cap ${fmt.cap(t.totalMarketCap)} | Vol ${fmt.vol(t.totalVolume)}\n`;
  m += `<b>₿ Dom:</b> ${Number(t.btcDominance || 0).toFixed(1)}% | <b>🧠 F&G:</b> ${t.fearGreed}/100\n\n`;

  if (t.futures?.BTCUSDT) {
    const f = t.futures.BTCUSDT;
    const parts = [];
    if (f.fundingRate != null) parts.push(`Funding: ${f.fundingRate.toFixed(4)}%`);
    if (f.openInterest != null) parts.push(`OI: ${fmt.vol(f.openInterest)}`);
    if (f.longShortRatio != null) parts.push(`L/S: ${f.longShortRatio.toFixed(2)}`);
    if (parts.length) m += `<b>⚡ Futures Pulse</b>\n` + parts.join(' | ') + '\n\n';
  }

  m += `${FOOTER}`;
  return m;
}

function buildAlert(coinId, price, type, change = 0) {
  const i = COINS[coinId];
  const t = type === 'above' ? '🚀 BIG MOVE UP' : '📉 BIG MOVE DOWN';
  return `🚨 <b>PRICE ALERT</b>\n\n<blockquote>${i.emoji} <b>${esc(i.name)} (${i.symbol})</b>\n${t}\n\n24h move: <b>${fmt.pct(change)}</b>\nCurrent: <code>$${fmt.price(price)}</code></blockquote>\n\n${FOOTER}`;
}

async function buildFutures(futures, prev = {}) {
  let m = `⚡ <b>FUNDING RATES & FUTURES</b>\n`;
  m += `<i>${fmt.tehran()} Tehran</i>\n\n<pre>`;
  
  for (const [sym, f] of Object.entries(futures)) {
    const coinId = Object.keys(BINANCE_MAP).find(k => BINANCE_MAP[k] === sym);
    const info = coinId ? COINS[coinId] : { symbol: sym.replace('USDT', ''), emoji: '•' };
    const fundingEmoji = f.fundingRate > 0.05 ? '🔴' : f.fundingRate < -0.05 ? '🟢' : '⚪';
    m += `${info.emoji} ${info.symbol.padEnd(6)} `;
    m += `${fundingEmoji} Funding: ${f.fundingRate !== null ? f.fundingRate.toFixed(4) + '%' : 'N/A'} `;
    m += `| OI: ${f.openInterest !== null ? fmt.vol(f.openInterest) : 'N/A'} `;
    const prevOi = prev[sym]?.openInterest;
    const oiDelta = (f.openInterest != null && prevOi) ? ` OIΔ:${fmt.pct(((f.openInterest - prevOi) / prevOi) * 100)}` : '';
    m += `| L/S: ${f.longShortRatio !== null ? f.longShortRatio.toFixed(2) : 'N/A'}${oiDelta}\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildMovers(gl) {
  if (!gl || (!gl.gainers?.length && !gl.losers?.length)) {
    return `🚀 <b>TOP MOVERS (24H)</b>\n\n<i>No movers data available</i>\n\n${FOOTER}`;
  }
  
  let m = `🚀 <b>TOP MOVERS (24H)</b>\n`;
  m += `<i>${fmt.tehran()} Tehran</i>\n\n`;
  
  if (gl.gainers?.length) {
    m += `<b>🔥 Top Gainers</b>\n<pre>`;
    for (const g of gl.gainers.slice(0, 5)) {
      const sym = (g.symbol || '?').toString().toUpperCase().padEnd(6);
      const chVal = g.price_change_percentage_24h || 0;
      const ch = ((chVal >= 0 ? '+' : '') + chVal.toFixed(2) + '%').padStart(10);
      const price = g.current_price || 0;
      m += `   🟢 ${SYMBOL_TO_ID[g.symbol] ? '⭐' : '  '}${sym} ${ch}  $${fmt.price(price)}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  if (gl.losers?.length) {
    m += `<b>❄️ Top Losers</b>\n<pre>`;
    for (const l of gl.losers.slice(0, 5)) {
      const sym = (l.symbol || '?').toString().toUpperCase().padEnd(6);
      const chVal = l.price_change_percentage_24h || 0;
      const ch = ((chVal >= 0 ? '+' : '') + chVal.toFixed(2) + '%').padStart(10);
      const price = l.current_price || 0;
      m += `   🔴 ${SYMBOL_TO_ID[l.symbol] ? '⭐' : '  '}${sym} ${ch}  $${fmt.price(price)}\n`;
    }
    m += `</pre>\n\n`;
  }
  
  m += `${FOOTER}`;
  return m;
}

export { buildPrice, buildVolume, buildDaily, buildTrending, buildFng, buildAIAnalysis, buildAlert, buildFutures, buildMovers, buildFlagshipClassic, buildBriefClassic, buildFlashClassic, buildWeeklyClassic, buildMacroCalendarClassic };

// ── v6 classic fallbacks (used when Telegram rejects a rich post) ────
function buildFlagshipClassic(s, p) {
  let m = `🧠 <b>TradeAgent IV — MARKET ANALYSIS</b>\n`;
  m += `<i>Regime ${s.regime.label.replace(/_/g, ' ')} · ${s.regime.score}</i>\n\n`;
  m += `<i>${esc(p.verdict)}</i>\n\n`;
  m += `<b>Overview</b>\n${esc(p.overview)}\n\n`;
  if (p.drivers?.length) m += `<b>Ranked drivers</b>\n` + p.drivers.map((d, i) => `${i + 1}. ${esc(d)}`).join('\n') + '\n\n';
  for (const sc of p.scenarios) m += `<b>${sc.kind} case (${esc(sc.lean)}${sc.level ? ` · trigger $${fmt.price(sc.level)}` : ''})</b>\n${esc(sc.text)}\n\n`;
  m += `👀 <i>Watch: ${esc(p.watch)}</i>\n`;
  m += `<i>Invalidation: ${esc(p.invalidation)}</i>\n\n`;
  m += `<b>جمع‌بندی فارسی</b>\n${esc(p.persian).replace(/(حکم|سطوح|سناریو|مراقبت):/g, '▸ $1:')}\n\n`;
  m += `<i>⚠️ Educational analysis, not financial advice.</i>\n\n${FOOTER}`;
  return m;
}

function buildMacroCalendarClassic(s, dateStr) {
  const evs = [...(s.macro?.today || [])].sort((a, b) => a.ts - b.ts).filter((e) => /high|medium/i.test(e.impact || ''));
  let m = `🗓️ <b>Macro Calendar — ${esc(dateStr)}</b>\n<i>ForexFactory · Tehran times</i>\n\n`;
  m += evs.length ? evs.map((e) => `• ${esc(e.title)} (${esc(e.country)})${/high/i.test(e.impact || '') ? ' 🔴' : ''} — forecast ${esc(e.forecast || '—')} · previous ${esc(e.previous || '—')}`).join('\n') : 'No medium or high-impact releases today.';
  return m + `\n\n${FOOTER}`;
}

function buildBriefClassic(s, dateStr) {
  const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
  let m = `🌅 <b>Morning Brief — ${esc(dateStr)}</b>\n\n`;
  m += `Regime ${s.regime.label.replace(/_/g, ' ')} ${s.regime.score} · F&G ${s.fearGreed.now ?? '—'} · Dominance ${Number(s.global.btcDominance || 0).toFixed(1)}%\n`;
  m += `BTC $${fmt.price(btc.current_price)} (${fmt.pct(btc.price_change_percentage_24h)})\n`;
  const evs = (s.macro?.today || []).slice(0, 5);
  if (evs.length) m += `\n<b>Today's macro:</b>\n` + evs.map((e) => `• ${esc(e.title)} (${esc(e.country)}) — forecast ${esc(e.forecast || '—')} · previous ${esc(e.previous || '—')}`).join('\n') + '\n';
  return m + `\n${FOOTER}`;
}

function buildFlashClassic(s, event, aiText) {
  let m = `⚡ <b>Event Flash — ${esc(event.title)}</b>\n\n`;
  m += `Actual <b>${esc(event.actual || '—')}</b> · Forecast ${esc(event.forecast || '—')} · Previous ${esc(event.previous || '—')}\n\n`;
  m += `${esc(aiText)}\n\n${FOOTER}`;
  return m;
}

function buildWeeklyClassic(s, week) {
  const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_7d_in_currency || 0) - (a.price_change_percentage_7d_in_currency || 0));
  let m = `🗓️ <b>Weekly Deep Dive</b>\n\n`;
  m += `Regime ${s.regime.label.replace(/_/g, ' ')} ${s.regime.score}\n`;
  m += `Best 7d: ${COINS[sorted[0]?.id]?.symbol || ''} ${fmt.pct(sorted[0]?.price_change_percentage_7d_in_currency)}\n`;
  m += `Weakest 7d: ${COINS[sorted[sorted.length - 1]?.id]?.symbol || ''} ${fmt.pct(sorted[sorted.length - 1]?.price_change_percentage_7d_in_currency)}\n\n${FOOTER}`;
  return m;
}
