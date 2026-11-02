// TradeAgent IV — post builders (pure: data in, Telegram HTML out).
import { COINS, BINANCE_MAP, SYMBOL_TO_ID } from './config.js';
import { esc, fmt, progressBar } from './utils.js';
import { L, footerClassic, regimeName, fngName, biasText, fngSignal, timeStr, RLM } from './i18n.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17. MESSAGE BUILDERS — MODERN UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function buildPrice(coins, source = '', ctx = null, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  const tier1 = coins.filter(c => COINS[c.id]?.tier === 1);
  const tier2 = coins.filter(c => COINS[c.id]?.tier === 2);
  const tier3 = coins.filter(c => COINS[c.id]?.tier === 3);
  
  let m = `📊 <b>${T.snapshot}</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${timeStr(lang)} ${T.tehran}</i>\n`;
  if (ctx && (ctx.btcDominance || ctx.fearGreed != null)) {
    const bits = [];
    if (ctx.btcDominance) bits.push(`₿ ${T.dominance}: ${ctx.btcDominance}%`);
    if (ctx.fearGreed != null) bits.push(`🧠 ${T.fearGreed}: ${ctx.fearGreed}/100`);
    m += `<i>${lang === 'fa' ? RLM : ''}${bits.join(' · ')}</i>\n`;
  }
  m += `\n`;
  
  if (tier1.length) {
    m += `<b>🏆 ${T.tier1}</b>\n<pre>`;
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
    m += `<b>🔷 ${T.tier2}</b>\n<pre>`;
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
    m += `<b>🐸 ${T.tier3}</b>\n<pre>`;
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
    m += `${lang === 'fa' ? RLM : ''}⭐ <b>${T.best}:</b> ${COINS[best.id].symbol} ${fmt.pct(best.price_change_percentage_24h)} · ⚠️ <b>${T.weakest}:</b> ${COINS[worst.id].symbol} ${fmt.pct(worst.price_change_percentage_24h)}\n\n`;
  }

  m += `${FOOTER}`;
  return m;
}

async function buildVolume(coins, source = '', lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  const sorted = [...coins].sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0));
  
  let m = `📈 <b>${T.volume}</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${timeStr(lang)} ${T.tehran}</i>\n\n<pre>`;
  
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

async function buildDaily(coins, globalData, trending, fear, source = '', lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  const sorted = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const best = sorted[0], worst = sorted[sorted.length - 1];
  
  let m = `📉 <b>${T.daily}</b>${source ? ` <i>· ${esc(source)}</i>` : ''}\n`;
  m += `<i>${fmt.date()}</i>\n\n`;

  if (globalData?.data) {
    const g = globalData.data;
    m += `<b>🌍 ${T.globalMarket}</b>\n`;
    m += `${T.cap}: ${fmt.cap(g.total_market_cap?.usd || 0)} | ${T.vol}: ${fmt.vol(g.total_volume?.usd || 0)} | BTC ${T.dominance}: ${g.market_cap_percentage?.btc?.toFixed(1) || '?'}%\n\n`;
  }
  
  if (fear?.data?.[0]) {
    const f = fear.data[0], v = parseInt(f.value);
    m += `<b>🧠 ${T.sentiment}</b>\n`;
    m += `${progressBar(v)} <b>${v}/100</b>\n`;
    m += `${biasText(v, lang)}\n\n`;
  }

  m += `<b>📋 ${T.perfBoard}</b>\n<pre>`;
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
    m += `<b>🏆 ${T.topPerformer}</b>\n`;
    m += `${COINS[best.id].emoji} ${COINS[best.id].symbol}  ${fmt.change(best.price_change_percentage_24h)}\n\n`;
  }
  if (worst && COINS[worst.id]) {
    m += `<b>⚠️ ${T.weakestLink}</b>\n`;
    m += `${COINS[worst.id].emoji} ${COINS[worst.id].symbol}  ${fmt.change(worst.price_change_percentage_24h)}\n\n`;
  }
  
  if (trending?.coins?.length) {
    m += `<b>🔥 ${T.trendingNow}</b>\n`;
    for (const t of trending.coins.slice(0, 5)) {
      m += `   ${esc(t.item.symbol)} — ${esc(t.item.name)}\n`;
    }
    m += `\n`;
  }
  
  m += `${FOOTER}`;
  return m;
}

async function buildTrending(trending, priceMap = {}, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  let m = `🔥 <b>${T.trending}</b>\n`;
  m += `<i>${timeStr(lang)} ${T.tehran}</i>\n\n<pre>`;
  
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
    m += `${T.noTrending}\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildFng(fear, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  if (!fear?.data?.[0]) {
    return `🧠 <b>${T.fng}</b>\n\n<i>${T.unavailable}</i>\n\n${FOOTER}`;
  }
  const f = fear.data[0], v = parseInt(f.value);
  const filled = Math.round((v / 100) * 12);
  const bar = '█'.repeat(filled) + '░'.repeat(12 - filled);
  const clsEmoji = v >= 75 ? '🔴' : v >= 55 ? '🟡' : v >= 45 ? '⚪' : '🟢';
  let m = `🧠 <b>${T.fng}</b>\n`;
  m += `<i>${f.timestamp ? new Date(f.timestamp * 1000).toISOString().slice(0, 10) : fmt.date()}</i>\n\n`;
  m += `<pre>${bar} ${v}/100</pre>\n\n`;
  m += `<b>${clsEmoji} ${fngName(v, lang)}</b>\n`;
  m += `<i>${biasText(v, lang)}</i>\n\n`;
  m += `<blockquote>${fngSignal(v, lang)}</blockquote>\n\n`;
  if (fear.data[1]) {
    const yv = parseInt(fear.data[1].value);
    const d = v - yv;
    m += `<i>${T.yesterday}: ${yv}/100 (${d >= 0 ? '▲' : '▼'} ${Math.abs(d)})</i>\n\n`;
  }
  m += `<i>${T.updated}: ${timeStr(lang)} ${T.tehran}</i>\n\n`;
  m += `${FOOTER}`;
  return m;
}

async function buildAIAnalysis(aiResult, todayData, emotion, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
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
  let m = `${emo.emoji} <b>${T.marketState}: ${emo.state}</b>\n`;
  m += `${emo.color} ${T.intensity}: ${emo.intensity}/100  ·  ${t.mode || 'Normal'} ${T.mode}\n\n`;
  
  m += `🧠 <b>${T.aiIntel}</b>\n`;
  m += `<i>${t.date} · ${aiResult.source || 'AI'} · ${t.mode || 'Normal'}</i>\n\n`;
  
  if (englishText) {
    m += `<blockquote>\n${englishText}\n</blockquote>\n\n`;
  }
  
  if (persianText && lang !== 'fa') {
    m += `<b>📋 خلاصه بازار</b>\n`;
    m += `<blockquote expandable>\n${persianText}\n</blockquote>\n\n`;
  }

  m += `<b>📊 ${T.keyMetrics}</b>\n<pre>`;
  m += `BTC  $${fmt.price(t.btcPrice).padStart(12)}  ${fmt.change(t.btcChange)}\n`;
  m += `ETH  $${fmt.price(t.ethPrice).padStart(12)}  ${fmt.change(t.ethChange)}\n`;
  m += `SOL  $${fmt.price(t.solPrice).padStart(12)}  ${fmt.change(t.solChange)}\n`;
  m += `</pre>\n\n`;

  m += `<b>🌍 ${T.global}:</b> ${T.cap} ${fmt.cap(t.totalMarketCap)} | ${T.vol} ${fmt.vol(t.totalVolume)}\n`;
  m += `<b>₿ ${T.dominance}:</b> ${Number(t.btcDominance || 0).toFixed(1)}% | <b>🧠 ${T.fearGreed}:</b> ${t.fearGreed}/100\n\n`;

  if (t.futures?.BTCUSDT) {
    const f = t.futures.BTCUSDT;
    const parts = [];
    if (f.fundingRate != null) parts.push(`${T.funding}: ${f.fundingRate.toFixed(4)}%`);
    if (f.openInterest != null) parts.push(`OI: ${fmt.vol(f.openInterest)}`);
    if (f.longShortRatio != null) parts.push(`L/S: ${f.longShortRatio.toFixed(2)}`);
    if (parts.length) m += `<b>⚡ ${T.futuresPulse}</b>\n` + parts.join(' | ') + '\n\n';
  }

  m += `${FOOTER}`;
  return m;
}

function buildAlert(coinId, price, type, change = 0, lang = 'en') {
  const T = L(lang);
  const i = COINS[coinId];
  const t = type === 'above' ? `🚀 ${T.moveUp}` : `📉 ${T.moveDown}`;
  return `🚨 <b>${T.priceAlert}</b>\n\n<blockquote>${i.emoji} <b>${esc(i.name)} (${i.symbol})</b>\n${t}\n\n${T.move24}: <b>${fmt.pct(change)}</b>\n${T.current}: <code>$${fmt.price(price)}</code></blockquote>\n\n${footerClassic(lang)}`;
}

async function buildFutures(futures, prev = {}, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  let m = `⚡ <b>${T.futures}</b>\n`;
  m += `<i>${timeStr(lang)} ${T.tehran}</i>\n\n<pre>`;
  
  for (const [sym, f] of Object.entries(futures)) {
    const coinId = Object.keys(BINANCE_MAP).find(k => BINANCE_MAP[k] === sym);
    const info = coinId ? COINS[coinId] : { symbol: sym.replace('USDT', ''), emoji: '•' };
    const fundingEmoji = f.fundingRate > 0.05 ? '🔴' : f.fundingRate < -0.05 ? '🟢' : '⚪';
    m += `${info.emoji} ${info.symbol.padEnd(6)} `;
    m += `${fundingEmoji} ${T.funding}: ${f.fundingRate !== null ? f.fundingRate.toFixed(4) + '%' : 'N/A'} `;
    m += `| OI: ${f.openInterest !== null ? fmt.vol(f.openInterest) : 'N/A'} `;
    const prevOi = prev[sym]?.openInterest;
    const oiDelta = (f.openInterest != null && prevOi) ? ` OIΔ:${fmt.pct(((f.openInterest - prevOi) / prevOi) * 100)}` : '';
    m += `| L/S: ${f.longShortRatio !== null ? f.longShortRatio.toFixed(2) : 'N/A'}${oiDelta}\n`;
  }
  
  m += `</pre>\n\n${FOOTER}`;
  return m;
}

async function buildMovers(gl, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  if (!gl || (!gl.gainers?.length && !gl.losers?.length)) {
    return `🚀 <b>${T.moversTitle}</b>\n\n<i>${T.noMovers}</i>\n\n${FOOTER}`;
  }
  
  let m = `🚀 <b>${T.moversTitle}</b>\n`;
  m += `<i>${timeStr(lang)} ${T.tehran}</i>\n\n`;
  
  if (gl.gainers?.length) {
    m += `<b>🔥 ${T.topGainers}</b>\n<pre>`;
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
    m += `<b>❄️ ${T.topLosers}</b>\n<pre>`;
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
function buildFlagshipClassic(s, p, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  let m = `🧠 <b>${T.analysis}</b>\n`;
  m += `<i>${T.regime} ${regimeName(s.regime.label, lang)} · ${s.regime.score}</i>\n\n`;
  m += `<i>${esc(p.verdict)}</i>\n\n`;
  m += `<b>${T.overview}</b>\n${esc(p.overview)}\n\n`;
  if (p.drivers?.length) m += `<b>${T.drivers}</b>\n` + p.drivers.map((d, i) => `${i + 1}. ${esc(d)}`).join('\n') + '\n\n';
  for (const sc of p.scenarios) { const cn = sc.kind === 'BULL' ? T.caseBull : sc.kind === 'BEAR' ? T.caseBear : T.caseBase; m += `<b>${cn} (${esc(T.lean[sc.lean] || sc.lean)}${sc.level ? ` · ${T.trigger} $${fmt.price(sc.level)}` : ''})</b>\n${esc(sc.text)}\n\n`; }
  m += `👀 <i>${T.watch}: ${esc(p.watch)}</i>\n`;
  m += `<i>${T.invalidation}: ${esc(p.invalidation)}</i>\n\n`;
  if (lang !== 'fa' && p.persian) m += `<b>جمع‌بندی فارسی</b>\n${esc(p.persian).replace(/(حکم|سطوح|سناریو|مراقبت):/g, '▸ $1:')}\n\n`;
  m += `<i>${T.disclaimer}</i>\n\n${FOOTER}`;
  return m;
}

function buildMacroCalendarClassic(s, dateStr, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  const evs = [...(s.macro?.today || [])].sort((a, b) => a.ts - b.ts).filter((e) => /high|medium/i.test(e.impact || ''));
  let m = `🗓️ <b>${T.macroCal} — ${esc(dateStr)}</b>\n<i>${T.macroSub}</i>\n\n`;
  m += evs.length ? evs.map((e) => `• ${esc(e.title)} (${esc(e.country)})${/high/i.test(e.impact || '') ? ' 🔴' : ''} — ${T.forecast} ${esc(e.forecast || '—')} · ${T.previous} ${esc(e.previous || '—')}`).join('\n') : T.macroNone;
  return m + `\n\n${FOOTER}`;
}

function buildBriefClassic(s, dateStr, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
  let m = `🌅 <b>${T.brief} — ${esc(dateStr)}</b>\n\n`;
  m += `${T.regime} ${regimeName(s.regime.label, lang)} ${s.regime.score} · ${T.fearGreed} ${s.fearGreed.now ?? '—'} · ${T.dominance} ${Number(s.global.btcDominance || 0).toFixed(1)}%\n\n`;
  if (lang === 'fa') {
    const row = (c) => `${RLM}<b>${esc(COINS[c.id]?.symbol || c.id)}</b> — $${fmt.price(c.current_price)} · ۲۴س ${fmt.pct(c.price_change_percentage_24h)} · ۷ر ${fmt.pct(c.price_change_percentage_7d_in_currency)}`;
    const majors = ['bitcoin', 'ethereum', 'solana'].map((id) => s.prices.find((c) => c.id === id)).filter(Boolean);
    m += `<b>${T.majorsCap}</b>\n` + majors.map(row).join('\n') + '\n\n';
    const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
    const movers = [...sorted.slice(0, 3), ...sorted.slice(-3).reverse()];
    m += `<b>${T.briefMoversCap}</b>\n` + movers.map(row).join('\n') + '\n\n';
    const green = s.prices.filter((c) => c.price_change_percentage_24h > 0).length;
    m += `${RLM}${T.breadth}: ${green}/${s.prices.length} ${T.breadthTail}\n\n`;
    const lv = s._levels;
    if (lv) m += `<b>${T.levelsCap}</b>\n${RLM}۲۴ ساعته — ${T.high} $${fmt.price(lv.h24)} · ${T.low} $${fmt.price(lv.l24)}\n${RLM}۷ روزه — ${T.high} $${fmt.price(lv.h7)} · ${T.low} $${fmt.price(lv.l7)}\n\n`;
    m += `<b>${T.totalsCap}</b>\n${RLM}${T.totalCap}: ${fmt.cap(s.global.marketCap)} · ${T.vol24}: ${fmt.vol(s.global.volume24h)}\n`;
    if (s.news?.length) m += `\n${RLM}${T.headline}: ${esc(s.news[0].title)}\n`;
    return m + `\n${FOOTER}`;
  }
  m += `BTC $${fmt.price(btc.current_price)} (${fmt.pct(btc.price_change_percentage_24h)})\n`;
  const evs = (s.macro?.today || []).slice(0, 5);
  if (evs.length) m += `\n<b>${T.macroCal}:</b>\n` + evs.map((e) => `• ${esc(e.title)} (${esc(e.country)}) — ${T.forecast} ${esc(e.forecast || '—')} · ${T.previous} ${esc(e.previous || '—')}`).join('\n') + '\n';
  return m + `\n${FOOTER}`;
}

function buildFlashClassic(s, event, aiText, lang = 'en') {
  const T = L(lang);
  let m = `⚡ <b>${T.flash} — ${esc(event.title)}</b>\n\n`;
  m += `${T.actual} <b>${esc(event.actual || '—')}</b> · ${T.forecast} ${esc(event.forecast || '—')} · ${T.previous} ${esc(event.previous || '—')}\n\n`;
  m += `${esc(aiText)}\n\n${footerClassic(lang)}`;
  return m;
}

function buildWeeklyClassic(s, week, lang = 'en') {
  const T = L(lang);
  const FOOTER = footerClassic(lang);
  const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_7d_in_currency || 0) - (a.price_change_percentage_7d_in_currency || 0));
  let m = `🗓️ <b>${T.weekly}</b>\n\n`;
  m += `${T.regime} ${regimeName(s.regime.label, lang)} ${s.regime.score}\n`;
  m += `${T.best} 7d: ${COINS[sorted[0]?.id]?.symbol || ''} ${fmt.pct(sorted[0]?.price_change_percentage_7d_in_currency)}\n`;
  m += `${T.weakest} 7d: ${COINS[sorted[sorted.length - 1]?.id]?.symbol || ''} ${fmt.pct(sorted[sorted.length - 1]?.price_change_percentage_7d_in_currency)}\n\n${FOOTER}`;
  return m;
}
