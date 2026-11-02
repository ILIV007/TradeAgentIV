// TradeAgent IV — Rich Message builders (Bot API 10.1+, sendRichMessage).
// Design v8: content-rich BTC chart on top (labeled axes, price line + 7d
// average), verdict heading, Tier 1 open, the LONG tiers (2/3) each in
// their own clearly-labeled collapsible, colored dots, classic quote
// footer. Delivery (telegram.js sendRich) falls back to the classic HTML
// post if Telegram rejects the rich payload.
import { COINS } from './config.js';
import { esc, fmt } from './utils.js';
import { L, footerRich, regimeName } from './i18n.js';

const pct = (v) => (v == null || isNaN(v) ? '—' : v > 0 ? `🟢 +${Number(v).toFixed(1)}%` : v < 0 ? `🔴 ${Number(v).toFixed(1)}%` : '⚪ 0.0%');

// Real chart, not decoration: labeled date axis, $ price axis, the price
// line plus its moving average over the same window. Rendered by
// QuickChart (public URL, no key) from CoinGecko sparkline points.
function chartUrl(points) {
  if (!Array.isArray(points) || points.length < 8) return null;
  const step = Math.max(1, Math.floor(points.length / 48));
  const pts = points.filter((_, i) => i % step === 0);
  const now = Date.now();
  const labels = pts.map((_, i) => {
    const d = new Date(now - (pts.length - 1 - i) * step * 3600e3);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const win = Math.max(2, Math.floor(pts.length / 4));
  const sma = pts.map((_, i) => i < win - 1 ? null : Math.round(pts.slice(i - win + 1, i + 1).reduce((a, b) => a + b, 0) / win));
  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'BTC/USD', data: pts.map((n) => Math.round(n)), borderColor: '#f7931a', borderWidth: 3, pointRadius: 0, fill: true, backgroundColor: 'rgba(247,147,26,0.12)' },
        { label: 'Average', data: sma, borderColor: '#8a94a6', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false },
      ],
    },
    options: {
      legend: { position: 'bottom', labels: { boxWidth: 14, fontSize: 22 } },
      title: { display: true, text: 'Bitcoin — last 7 days', fontSize: 26, fontColor: '#222' },
      scales: {
        xAxes: [{ ticks: { maxTicksLimit: 7, fontSize: 20 }, gridLines: { display: false } }],
        yAxes: [{ ticks: { maxTicksLimit: 5, fontSize: 20 }, gridLines: { color: 'rgba(0,0,0,0.07)' } }],
      },
    },
  };
  return `https://quickchart.io/chart?w=1200&h=640&bkg=white&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

function coinRow(c) {
  const meta = COINS[c.id] || {};
  return `<tr><td><b>${esc(meta.symbol || c.symbol || c.id)}</b></td><td>$${fmt.price(c.current_price)}</td><td>${pct(c.price_change_percentage_24h)}</td><td>${pct(c.price_change_percentage_7d_in_currency)}</td></tr>`;
}

function coinTable(coins, caption, lang = 'en') {
  const t = L(lang);
  return `<table bordered striped compact><caption>${caption}</caption><tr><th>${t.coin}</th><th>${t.price}</th><th>24h</th><th>7d</th></tr>${coins.map(coinRow).join('')}</table>`;
}

// Rich twin of buildPrice.
// ctx: { btcDominance, fearGreed, best, weakest, btcSpark:number[] }
function buildRichSnapshot(coins, source = '', ctx = null, lang = 'en') {
  const t = L(lang);
  const tier1 = coins.filter((c) => COINS[c.id]?.tier === 1);
  const tier2 = coins.filter((c) => COINS[c.id]?.tier === 2);
  const tier3 = coins.filter((c) => COINS[c.id]?.tier === 3);
  const btc = coins.find((c) => c.id === 'bitcoin');
  const moodKey = !btc ? '' : btc.price_change_percentage_24h >= 1 ? 'risk-on' : btc.price_change_percentage_24h <= -1 ? 'risk-off' : Math.abs(btc.price_change_percentage_24h) < 0.3 ? 'flat and indecisive' : 'mixed';
  const mood = t.mood[moodKey] || moodKey;
  const verdict = btc ? (lang === 'fa' ? `${mood} — BTC $${fmt.price(btc.current_price)}` : `BTC $${fmt.price(btc.current_price)} — ${mood}`) : t.snapshot;
  const green = coins.filter((c) => c.price_change_percentage_24h > 0).length;
  const chart = chartUrl(ctx?.btcSpark);

  let h = '';
  if (chart) h += `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>${t.chartCaption}</figcaption></figure>`;
  h += `<h3>📊 ${esc(verdict)}</h3>`;
  const bits = [];
  if (ctx?.btcDominance) bits.push(`${t.dominance} ${ctx.btcDominance}%`);
  if (ctx?.fearGreed != null) bits.push(`${t.fearGreed} ${ctx.fearGreed}`);
  if (ctx?.regime) bits.push(`${t.regime} ${regimeName(ctx.regime.label, lang)} ${ctx.regime.score}`);
  if (bits.length) h += `<p><i>${bits.join(' · ')}</i></p>`;
  if (tier1.length) h += coinTable(tier1, t.tier1, lang);
  if (tier2.length) h += `<details><summary>${t.tier2} · ${tier2.length} ${t.coinsWord}</summary>${coinTable(tier2, '', lang)}</details>`;
  if (tier3.length) h += `<details><summary>${t.tier3} · ${tier3.length} ${t.coinsWord}</summary>${coinTable(tier3, '', lang)}</details>`;
  const tail = [];
  if (ctx?.best) tail.push(`${t.best} ${esc(ctx.best)}`);
  if (ctx?.weakest) tail.push(`${t.weakest} ${esc(ctx.weakest)}`);
  tail.push(`${green}/${coins.length} ${t.greenTail}`);
  h += `<p><i>${tail.join(' · ')}</i></p>`;
  h += footerRich(lang);
  return h;
}

export { buildRichSnapshot, chartUrl };

// ── v6 product builders (same design language as the snapshot) ──────
import { sparkLevels } from './state.js';


const tehranTime = (ts) => new Date(ts).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' });
const tehranDay = (ts) => new Date(ts).toLocaleDateString('en-GB', { timeZone: 'Asia/Tehran', weekday: 'short', day: 'numeric', month: 'short' });
const paras = (text) => String(text || '').split(/\n+/).filter(Boolean).map((l) => `<p>${esc(l.trim())}</p>`).join('');
const regimeLine = (s, lang = 'en') => { const t = L(lang); return `${t.regime} ${regimeName(s.regime.label, lang)} ${s.regime.score} · ${t.fearGreed} ${s.fearGreed.now ?? '—'} · ${t.dominance} ${s.global.btcDominance ? Number(s.global.btcDominance).toFixed(1) : '—'}%`; };

function chartFigure(s) {
  const chart = chartUrl(s?.btcSpark);
  return chart ? `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>${t.chartCaption}</figcaption></figure>` : '';
}

function buildRichMorningBrief(s, dateStr, lang = 'en') {
  const t = L(lang);
  const lv = sparkLevels(s.btcSpark);
  const coinRow = (c) => `<tr><td><b>${esc(COINS[c.id]?.symbol || c.id)}</b></td><td>$${fmt.price(c.current_price)}</td><td>${pct(c.price_change_percentage_24h)}</td><td>${pct(c.price_change_percentage_7d_in_currency)}</td></tr>`;
  const majors = ['bitcoin', 'ethereum', 'solana'].map((id) => s.prices.find((c) => c.id === id)).filter(Boolean);
  const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const movers = [...sorted.slice(0, 3), ...sorted.slice(-3).reverse()];
  const green = s.prices.filter((c) => c.price_change_percentage_24h > 0).length;
  let h = `<h2>🌅 ${t.brief} — ${esc(dateStr)}</h2>`;
  h += `<p><i>${regimeLine(s, lang)}</i></p>`;
  if (majors.length) h += `<table bordered striped compact><caption>${t.majorsCap}</caption><tr><th>${t.coin}</th><th>${t.price}</th><th>24h</th><th>7d</th></tr>${majors.map(coinRow).join('')}</table>`;
  if (movers.length) h += `<table bordered striped compact><caption>${t.briefMoversCap}</caption><tr><th>${t.coin}</th><th>${t.price}</th><th>24h</th><th>7d</th></tr>${movers.map(coinRow).join('')}</table>`;
  h += `<p><i>${t.breadth}: ${green}/${s.prices.length} ${t.breadthTail}</i></p>`;
  if (lv) h += `<table bordered striped compact><caption>${t.levelsCap}</caption><tr><th></th><th>${t.high}</th><th>${t.low}</th></tr><tr><td>24h</td><td>$${fmt.price(lv.h24)}</td><td>$${fmt.price(lv.l24)}</td></tr><tr><td>7d</td><td>$${fmt.price(lv.h7)}</td><td>$${fmt.price(lv.l7)}</td></tr></table>`;
  h += `<table bordered striped compact><caption>${t.totalsCap}</caption><tr><td>${t.totalCap}</td><td><b>${fmt.cap(s.global.marketCap)}</b></td></tr><tr><td>${t.vol24}</td><td><b>${fmt.vol(s.global.volume24h)}</b></td></tr></table>`;
  if (s.news?.length) h += `<p><i>${t.headline}: ${esc(s.news[0].title)}</i></p>`;
  return h + footerRich(lang);
}

function buildRichFlagship(s, p, lang = 'en') {
  const t = L(lang);
  const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
  const lv = sparkLevels(s.btcSpark);
  const d = s.derivatives || {};
  const rows = [
    [t.numBtcPrice, `$${fmt.price(btc.current_price)}`],
    [t.numBtcCh, `${pct(btc.price_change_percentage_24h)} / ${pct(btc.price_change_percentage_7d_in_currency)}`],
    ...(lv ? [[t.numRange24, `$${fmt.price(lv.l24)} – $${fmt.price(lv.h24)}`], [t.numRange7, `$${fmt.price(lv.l7)} – $${fmt.price(lv.h7)}`]] : []),
    [t.numFunding, d.fundingBtc != null ? `${Number(d.fundingBtc).toFixed(3)}%` : '—'],
    [t.numOi, d.oiUsd != null ? `$${fmt.vol(d.oiUsd)}` : '—'],
    [t.numDvol, d.dvol != null ? Number(d.dvol).toFixed(1) : '—'],
    [t.numFng, `${s.fearGreed.now ?? '—'}${s.fearGreed.yday != null ? ` (${t.was} ${s.fearGreed.yday})` : ''}`],
    [t.numDom, `${Number(s.global.btcDominance || 0).toFixed(1)}%`],
    [t.numStables, s.defi?.stableDelta7dPct != null ? `${s.defi.stableDelta7dPct >= 0 ? '+' : ''}${s.defi.stableDelta7dPct.toFixed(2)}%` : '—'],
  ];
  let h = `<h2>🧠 ${t.analysis}</h2>`;
  h += `<p><i>${regimeLine(s, lang)}</i></p>`;
  h += `<aside>${esc(p.verdict)}</aside>`;
  h += `<h3>${t.overview}</h3>${paras(p.overview)}`;
  h += `<table bordered striped compact><caption>${t.numbers}</caption>${rows.map((r) => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')}</table>`;
  if (p.drivers?.length) h += `<h3>${t.drivers}</h3><ol>${p.drivers.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  h += `<h3>${t.scenarios}</h3>`;
  for (const sc of p.scenarios) {
    const icon = sc.kind === 'BULL' ? '🟢' : sc.kind === 'BEAR' ? '🔴' : '⚪';
    const caseName = sc.kind === 'BULL' ? t.caseBull : sc.kind === 'BEAR' ? t.caseBear : t.caseBase;
    h += `<details><summary>${icon} ${caseName} — ${esc(t.lean[sc.lean] || sc.lean)}${sc.level ? ` · ${t.trigger} $${fmt.price(sc.level)}` : ''}</summary><p>${esc(sc.text)}</p></details>`;
  }
  h += `<p><i>👀 ${t.watch}: ${esc(p.watch)}</i></p>`;
  h += `<p><i>${t.invalidation}: ${esc(p.invalidation)}</i></p>`;
  if (lang !== 'fa' && p.persian) h += `<blockquote expandable>🇮🇷 <b>جمع‌بندی فارسی</b><br/>${esc(p.persian).replace(/(حکم|سطوح|سناریو|مراقبت):/g, '<b>$1:</b>').replace(/\n/g, '<br/>')}</blockquote>`;
  h += `<p><i>${t.disclaimer}</i></p>`;
  return h + footerRich(lang);
}

function buildRichEventFlash(s, event, aiText, lang = 'en') {
  const t = L(lang);
  const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
  let h = `<h2>⚡ ${t.flash} — ${esc(event.title)}</h2>`;
  h += `<table bordered striped compact><tr><th>${t.actual}</th><th>${t.forecast}</th><th>${t.previous}</th></tr><tr><td><b>${esc(event.actual || '—')}</b></td><td>${esc(event.forecast || '—')}</td><td>${esc(event.previous || '—')}</td></tr></table>`;
  h += paras(aiText);
  h += `<p><i>BTC $${fmt.price(btc.current_price)} (${pct(btc.price_change_percentage_24h)}) · ${regimeLine(s, lang)}</i></p>`;
  return h + footerRich(lang);
}

function buildRichMacroWatch(event, lang = 'en') {
  const t = L(lang);
  let h = `<h2>👀 ${t.watchTitle} — ${esc(event.title)}</h2>`;
  h += `<p><i>${t.todayAt} ${tehranTime(event.ts)} ${t.tehran} · ${esc(event.country)} · ${t.highImpact}</i></p>`;
  h += `<table bordered striped compact><tr><th>${t.forecast}</th><th>${t.previous}</th></tr><tr><td>${esc(event.forecast || '—')}</td><td>${esc(event.previous || '—')}</td></tr></table>`;
  h += `<p>${t.watchText}</p>`;
  return h + footerRich(lang);
}

function buildRichWeekly(s, week, lang = 'en') {
  const t = L(lang);
  const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_7d_in_currency || 0) - (a.price_change_percentage_7d_in_currency || 0));
  const glance = [s.prices.find((c) => c.id === 'bitcoin'), s.prices.find((c) => c.id === 'ethereum'), s.prices.find((c) => c.id === 'solana'), sorted[0], sorted[sorted.length - 1]].filter(Boolean);
  const row = (c) => `<tr><td><b>${esc(COINS[c.id]?.symbol || c.id)}</b></td><td>$${fmt.price(c.current_price)}</td><td>${pct(c.price_change_percentage_7d_in_currency)}</td></tr>`;
  const chart = moversChartUrl(sorted.slice(0, 5), sorted.slice(-5).reverse(), '7d');
  let h = chart ? `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>${t.weeklyChartCap}</figcaption></figure>` : '';
  h += `<h2>🗓️ ${t.weekly}</h2>`;
  h += `<p><i>${regimeLine(s, lang)}</i></p>`;
  if (week.regimePath) h += `<p><i>${t.regimePath}: ${esc(week.regimePath)}</i></p>`;
  h += `<table bordered striped compact><caption>${t.glanceCap}</caption><tr><th>${t.coin}</th><th>${t.price}</th><th>7d</th></tr>${glance.map(row).join('')}</table>`;
  h += `<details><summary>${t.allCoins} ${s.prices.length} ${t.allCoinsTail}</summary><table bordered striped compact><tr><th>${t.coin}</th><th>${t.price}</th><th>7d</th></tr>${sorted.map(row).join('')}</table></details>`;
  const sc = week.scorecard;
  if (sc && sc.posts > 0) {
    h += `<table bordered striped compact><caption>${t.scorecardCap}</caption><tr><th>${t.scCase}</th><th>${t.scTrig}</th><th>${t.scFollow}</th></tr><tr><td>⚪ ${t.caseBase}</td><td>${sc.baseFired}/${sc.posts}</td><td>—</td></tr><tr><td>🟢 ${t.caseBull}</td><td>${sc.bullFired}</td><td>${sc.bullHit} ${t.scHeld}</td></tr><tr><td>🔴 ${t.caseBear}</td><td>${sc.bearFired}</td><td>${sc.bearHit} ${t.scHeld}</td></tr></table>`;
  } else {
    h += `<p><i>${t.scorecardEmpty}</i></p>`;
  }
  const ahead = (s.macro?.ahead || []).slice(0, 6);
  if (ahead.length) h += `<table bordered striped compact><caption>${t.aheadCap}</caption><tr><th>${t.day}</th><th>${t.event}</th><th></th></tr>${ahead.map((e) => `<tr><td>${tehranDay(e.ts)}</td><td>${esc(e.title)}</td><td>${esc(e.country)}</td></tr>`).join('')}</table>`;
  return h + footerRich(lang);
}

// Horizontal bar chart of top movers (QuickChart). items: normalized
// coins (gainers desc, losers desc by negativity) for '24h', or state
// prices sorted by 7d change for '7d'.
function moversChartUrl(gainers, losers, field) {
  const key = field === '7d' ? 'price_change_percentage_7d_in_currency' : 'price_change_percentage_24h';
  const sym = (c) => COINS[c.id]?.symbol || (c.symbol || c.id || '?');
  const items = [
    ...gainers.map((c) => ({ label: sym(c), v: c[key] || 0 })),
    ...losers.map((c) => ({ label: sym(c), v: c[key] || 0 })),
  ].filter((x) => x.v !== 0);
  if (items.length < 2) return null;
  const cfg = {
    type: 'horizontalBar',
    data: {
      labels: items.map((x) => x.label),
      datasets: [{ data: items.map((x) => Number(x.v.toFixed(1))), backgroundColor: items.map((x) => (x.v >= 0 ? '#16a34a' : '#dc2626')) }],
    },
    options: {
      legend: { display: false },
      title: { display: true, text: `Top movers — ${field} (%)`, fontSize: 26, fontColor: '#222' },
      scales: {
        xAxes: [{ ticks: { fontSize: 20 }, gridLines: { color: 'rgba(0,0,0,0.07)' } }],
        yAxes: [{ ticks: { fontSize: 22 }, gridLines: { display: false } }],
      },
    },
  };
  return `https://quickchart.io/chart?w=1200&h=${140 + items.length * 62}&bkg=white&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

function buildRichMovers(gl, lang = 'en') {
  const t = L(lang);
  const gainers = (gl.gainers || []).slice(0, 5);
  const losers = (gl.losers || []).slice(0, 5);
  const chart = moversChartUrl(gainers, losers, '24h');
  const row = (c) => {
    const tracked = c.symbol && Object.values(COINS).some((m) => m.symbol === String(c.symbol).toUpperCase());
    return `<tr><td><b>${esc(String(c.symbol || '?').toUpperCase())}</b>${tracked ? ' ⭐' : ''}</td><td>$${fmt.price(c.current_price)}</td><td>${pct(c.price_change_percentage_24h)}</td></tr>`;
  };
  let h = chart ? `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>${t.moversCaption}</figcaption></figure>` : '';
  h += `<h2>🚀 ${t.moversRich}</h2>`;
  if (gainers.length) h += `<table bordered striped compact><caption>🔥 ${t.topGainers}</caption><tr><th>${t.coin}</th><th>${t.price}</th><th>24h</th></tr>${gainers.map(row).join('')}</table>`;
  if (losers.length) h += `<table bordered striped compact><caption>🧊 ${t.topLosers}</caption><tr><th>${t.coin}</th><th>${t.price}</th><th>24h</th></tr>${losers.map(row).join('')}</table>`;
  h += `<p><i>${t.moversNote}</i></p>`;
  return h + footerRich(lang);
}

function buildRichMacroCalendar(s, dateStr, lang = 'en') {
  const t = L(lang);
  const evs = [...(s.macro?.today || [])].sort((a, b) => a.ts - b.ts);
  const major = evs.filter((e) => /high|medium/i.test(e.impact || ''));
  const minor = evs.filter((e) => !/high|medium/i.test(e.impact || ''));
  const hasActual = evs.some((e) => e.actual);
  const row = (e) => `<tr><td>${tehranTime(e.ts)}</td><td>${esc(e.title)} (${esc(e.country)})${/high/i.test(e.impact || '') ? ' 🔴' : ''}</td><td>${esc(e.forecast || '—')}</td><td>${esc(e.previous || '—')}</td>${hasActual ? `<td>${esc(e.actual || '—')}</td>` : ''}</tr>`;
  const head = `<tr><th>${t.time}</th><th>${t.event}</th><th>${t.forecast}</th><th>${t.previous}</th>${hasActual ? `<th>${t.actual}</th>` : ''}</tr>`;
  let h = `<h2>🗓️ ${t.macroCal} — ${esc(dateStr)}</h2>`;
  h += `<p><i>${t.macroSub}</i></p>`;
  if (major.length) h += `<table bordered striped compact>${head}${major.map(row).join('')}</table>`;
  else h += `<p>${t.macroNone}</p>`;
  if (minor.length) h += `<details><summary>${t.minor} (${minor.length})</summary><table bordered striped compact>${head}${minor.map(row).join('')}</table></details>`;
  if (s.macro?.nextHighImpact) { const n = s.macro.nextHighImpact; h += `<p><i>${t.nextHigh}: ${esc(n.title)} (${esc(n.country)}) · ${tehranDay(n.ts)} ${tehranTime(n.ts)}</i></p>`; }
  return h + footerRich(lang);
}

export { buildRichMorningBrief, buildRichFlagship, buildRichEventFlash, buildRichMacroWatch, buildRichWeekly, buildRichMovers, buildRichMacroCalendar, moversChartUrl, tehranTime };
