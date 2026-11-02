// TradeAgent IV — Rich Message builders (Bot API 10.1+, sendRichMessage).
// Design v8: content-rich BTC chart on top (labeled axes, price line + 7d
// average), verdict heading, Tier 1 open, the LONG tiers (2/3) each in
// their own clearly-labeled collapsible, colored dots, classic quote
// footer. Delivery (telegram.js sendRich) falls back to the classic HTML
// post if Telegram rejects the rich payload.
import { COINS } from './config.js';
import { esc, fmt } from './utils.js';

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

function coinTable(coins, caption) {
  return `<table bordered striped compact><caption>${caption}</caption><tr><th>Coin</th><th>Price</th><th>24h</th><th>7d</th></tr>${coins.map(coinRow).join('')}</table>`;
}

// Rich twin of buildPrice.
// ctx: { btcDominance, fearGreed, best, weakest, btcSpark:number[] }
function buildRichSnapshot(coins, source = '', ctx = null) {
  const tier1 = coins.filter((c) => COINS[c.id]?.tier === 1);
  const tier2 = coins.filter((c) => COINS[c.id]?.tier === 2);
  const tier3 = coins.filter((c) => COINS[c.id]?.tier === 3);
  const btc = coins.find((c) => c.id === 'bitcoin');
  const mood = !btc ? '' : btc.price_change_percentage_24h >= 1 ? 'risk-on' : btc.price_change_percentage_24h <= -1 ? 'risk-off' : Math.abs(btc.price_change_percentage_24h) < 0.3 ? 'flat and indecisive' : 'mixed';
  const verdict = btc ? `BTC $${fmt.price(btc.current_price)} — ${mood}` : 'Market snapshot';
  const green = coins.filter((c) => c.price_change_percentage_24h > 0).length;
  const chart = chartUrl(ctx?.btcSpark);

  let h = '';
  if (chart) h += `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>Bitcoin · last 7 days · price vs its average</figcaption></figure>`;
  h += `<h3>📊 ${esc(verdict)}</h3>`;
  const bits = [];
  if (ctx?.btcDominance) bits.push(`Dominance ${ctx.btcDominance}%`);
  if (ctx?.fearGreed != null) bits.push(`Fear &amp; Greed ${ctx.fearGreed}`);
  if (ctx?.regime) bits.push(`Regime ${ctx.regime.label.replace(/_/g, ' ')} ${ctx.regime.score}`);
  if (bits.length) h += `<p><i>${bits.join(' · ')}</i></p>`;
  if (tier1.length) h += coinTable(tier1, 'Tier 1 — Blue Chips');
  if (tier2.length) h += `<details><summary>Tier 2 — Utility &amp; L2s · ${tier2.length} coins</summary>${coinTable(tier2, '')}</details>`;
  if (tier3.length) h += `<details><summary>Tier 3 — Meme &amp; AI · ${tier3.length} coins</summary>${coinTable(tier3, '')}</details>`;
  const tail = [];
  if (ctx?.best) tail.push(`Best ${esc(ctx.best)}`);
  if (ctx?.weakest) tail.push(`Weakest ${esc(ctx.weakest)}`);
  tail.push(`${green}/${coins.length} green`);
  h += `<p><i>${tail.join(' · ')}</i></p>`;
  h += `<blockquote>📡 TradeAgent IV · AI Crypto Intelligence · @TradeAgentIV</blockquote>`;
  return h;
}

export { buildRichSnapshot, chartUrl };

// ── v6 product builders (same design language as the snapshot) ──────
import { sparkLevels } from './state.js';

const FOOTER = `<blockquote>📡 TradeAgent IV · AI Crypto Intelligence · @TradeAgentIV</blockquote>`;
const tehranTime = (ts) => new Date(ts).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' });
const tehranDay = (ts) => new Date(ts).toLocaleDateString('en-GB', { timeZone: 'Asia/Tehran', weekday: 'short', day: 'numeric', month: 'short' });
const paras = (text) => String(text || '').split(/\n+/).filter(Boolean).map((l) => `<p>${esc(l.trim())}</p>`).join('');
const regimeLine = (s) => `Regime ${s.regime.label.replace(/_/g, ' ')} ${s.regime.score} · Fear &amp; Greed ${s.fearGreed.now ?? '—'} · Dominance ${s.global.btcDominance ? Number(s.global.btcDominance).toFixed(1) : '—'}%`;

function chartFigure(s) {
  const chart = chartUrl(s?.btcSpark);
  return chart ? `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>Bitcoin · last 7 days · price vs its average</figcaption></figure>` : '';
}

function buildRichMorningBrief(s, dateStr) {
  const lv = sparkLevels(s.btcSpark);
  const coinRow = (c) => `<tr><td><b>${esc(COINS[c.id]?.symbol || c.id)}</b></td><td>$${fmt.price(c.current_price)}</td><td>${pct(c.price_change_percentage_24h)}</td><td>${pct(c.price_change_percentage_7d_in_currency)}</td></tr>`;
  const majors = ['bitcoin', 'ethereum', 'solana'].map((id) => s.prices.find((c) => c.id === id)).filter(Boolean);
  const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const movers = [...sorted.slice(0, 3), ...sorted.slice(-3).reverse()];
  const green = s.prices.filter((c) => c.price_change_percentage_24h > 0).length;
  let h = `<h2>🌅 Morning Brief — ${esc(dateStr)}</h2>`;
  h += `<p><i>${regimeLine(s)}</i></p>`;
  if (majors.length) h += `<table bordered striped compact><caption>Overnight — the majors</caption><tr><th>Coin</th><th>Price</th><th>24h</th><th>7d</th></tr>${majors.map(coinRow).join('')}</table>`;
  if (movers.length) h += `<table bordered striped compact><caption>Overnight movers — tracked coins</caption><tr><th>Coin</th><th>Price</th><th>24h</th><th>7d</th></tr>${movers.map(coinRow).join('')}</table>`;
  h += `<p><i>Breadth: ${green}/${s.prices.length} coins green overnight</i></p>`;
  if (lv) h += `<table bordered striped compact><caption>Bitcoin key levels</caption><tr><th></th><th>High</th><th>Low</th></tr><tr><td>24h</td><td>$${fmt.price(lv.h24)}</td><td>$${fmt.price(lv.l24)}</td></tr><tr><td>7d</td><td>$${fmt.price(lv.h7)}</td><td>$${fmt.price(lv.l7)}</td></tr></table>`;
  h += `<table bordered striped compact><caption>Market totals</caption><tr><td>Total market cap</td><td><b>${fmt.cap(s.global.marketCap)}</b></td></tr><tr><td>Volume 24h</td><td><b>${fmt.vol(s.global.volume24h)}</b></td></tr></table>`;
  if (s.news?.length) h += `<p><i>Overnight headline: ${esc(s.news[0].title)}</i></p>`;
  return h + FOOTER;
}

function buildRichFlagship(s, p) {
  const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
  const lv = sparkLevels(s.btcSpark);
  const d = s.derivatives || {};
  const rows = [
    ['BTC price', `$${fmt.price(btc.current_price)}`],
    ['BTC 24h / 7d', `${pct(btc.price_change_percentage_24h)} / ${pct(btc.price_change_percentage_7d_in_currency)}`],
    ...(lv ? [['Range 24h', `$${fmt.price(lv.l24)} – $${fmt.price(lv.h24)}`], ['Range 7d', `$${fmt.price(lv.l7)} – $${fmt.price(lv.h7)}`]] : []),
    ['Funding (BTC)', d.fundingBtc != null ? `${Number(d.fundingBtc).toFixed(3)}%` : '—'],
    ['Deribit OI', d.oiUsd != null ? `$${fmt.vol(d.oiUsd)}` : '—'],
    ['DVOL', d.dvol != null ? Number(d.dvol).toFixed(1) : '—'],
    ['Fear & Greed', `${s.fearGreed.now ?? '—'}${s.fearGreed.yday != null ? ` (was ${s.fearGreed.yday})` : ''}`],
    ['BTC dominance', `${Number(s.global.btcDominance || 0).toFixed(1)}%`],
    ['Stablecoins 7d', s.defi?.stableDelta7dPct != null ? `${s.defi.stableDelta7dPct >= 0 ? '+' : ''}${s.defi.stableDelta7dPct.toFixed(2)}%` : '—'],
  ];
  let h = `<h2>🧠 TradeAgent IV — Market Analysis</h2>`;
  h += `<p><i>${regimeLine(s)}</i></p>`;
  h += `<aside>${esc(p.verdict)}</aside>`;
  h += `<h3>Overview</h3>${paras(p.overview)}`;
  h += `<table bordered striped compact><caption>Market in numbers</caption>${rows.map((r) => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')}</table>`;
  if (p.drivers?.length) h += `<h3>Ranked drivers</h3><ol>${p.drivers.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  h += `<h3>Scenarios</h3>`;
  for (const sc of p.scenarios) {
    const icon = sc.kind === 'BULL' ? '🟢' : sc.kind === 'BEAR' ? '🔴' : '⚪';
    h += `<details><summary>${icon} ${sc.kind.charAt(0) + sc.kind.slice(1).toLowerCase()} case — ${esc(sc.lean)}${sc.level ? ` · trigger $${fmt.price(sc.level)}` : ''}</summary><p>${esc(sc.text)}</p></details>`;
  }
  h += `<p><i>👀 Watch: ${esc(p.watch)}</i></p>`;
  h += `<p><i>Invalidation: ${esc(p.invalidation)}</i></p>`;
  h += `<blockquote expandable>🇮🇷 <b>جمع‌بندی فارسی</b><br/>${esc(p.persian).replace(/(حکم|سطوح|سناریو|مراقبت):/g, '<b>$1:</b>').replace(/\n/g, '<br/>')}</blockquote>`;
  h += `<p><i>⚠️ Educational analysis, not financial advice.</i></p>`;
  return h + FOOTER;
}

function buildRichEventFlash(s, event, aiText) {
  const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
  let h = `<h2>⚡ Event Flash — ${esc(event.title)}</h2>`;
  h += `<table bordered striped compact><tr><th>Actual</th><th>Forecast</th><th>Previous</th></tr><tr><td><b>${esc(event.actual || '—')}</b></td><td>${esc(event.forecast || '—')}</td><td>${esc(event.previous || '—')}</td></tr></table>`;
  h += paras(aiText);
  h += `<p><i>BTC $${fmt.price(btc.current_price)} (${pct(btc.price_change_percentage_24h)}) · ${regimeLine(s)}</i></p>`;
  return h + FOOTER;
}

function buildRichMacroWatch(event) {
  let h = `<h2>👀 Macro Watch — ${esc(event.title)}</h2>`;
  h += `<p><i>Today ${tehranTime(event.ts)} Tehran · ${esc(event.country)} · high impact</i></p>`;
  h += `<table bordered striped compact><tr><th>Forecast</th><th>Previous</th></tr><tr><td>${esc(event.forecast || '—')}</td><td>${esc(event.previous || '—')}</td></tr></table>`;
  h += `<p>The print lands shortly — the result and what it means for the market will follow here within minutes.</p>`;
  return h + FOOTER;
}

function buildRichWeekly(s, week) {
  const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_7d_in_currency || 0) - (a.price_change_percentage_7d_in_currency || 0));
  const glance = [s.prices.find((c) => c.id === 'bitcoin'), s.prices.find((c) => c.id === 'ethereum'), s.prices.find((c) => c.id === 'solana'), sorted[0], sorted[sorted.length - 1]].filter(Boolean);
  const row = (c) => `<tr><td><b>${esc(COINS[c.id]?.symbol || c.id)}</b></td><td>$${fmt.price(c.current_price)}</td><td>${pct(c.price_change_percentage_7d_in_currency)}</td></tr>`;
  const chart = moversChartUrl(sorted.slice(0, 5), sorted.slice(-5).reverse(), '7d');
  let h = chart ? `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>Top movers of the week (7d %)</figcaption></figure>` : '';
  h += `<h2>🗓️ Weekly Deep Dive</h2>`;
  h += `<p><i>${regimeLine(s)}</i></p>`;
  if (week.regimePath) h += `<p><i>Regime path: ${esc(week.regimePath)}</i></p>`;
  h += `<table bordered striped compact><caption>The week at a glance (7d)</caption><tr><th>Coin</th><th>Price</th><th>7d</th></tr>${glance.map(row).join('')}</table>`;
  h += `<details><summary>All ${s.prices.length} coins — 7d performance</summary><table bordered striped compact><tr><th>Coin</th><th>Price</th><th>7d</th></tr>${sorted.map(row).join('')}</table></details>`;
  const sc = week.scorecard;
  if (sc && sc.posts > 0) {
    h += `<table bordered striped compact><caption>📋 Our scenario scorecard — this week</caption><tr><th>Case</th><th>Triggered</th><th>Follow-through</th></tr><tr><td>⚪ Base</td><td>${sc.baseFired}/${sc.posts}</td><td>—</td></tr><tr><td>🟢 Bull</td><td>${sc.bullFired}</td><td>${sc.bullHit} held</td></tr><tr><td>🔴 Bear</td><td>${sc.bearFired}</td><td>${sc.bearHit} held</td></tr></table>`;
  } else {
    h += `<p><i>📋 Scenario scorecard: every flagship call is now recorded — the first graded week appears here next Friday.</i></p>`;
  }
  const ahead = (s.macro?.ahead || []).slice(0, 6);
  if (ahead.length) h += `<table bordered striped compact><caption>Next week's high-impact calendar</caption><tr><th>Day</th><th>Event</th><th></th></tr>${ahead.map((e) => `<tr><td>${tehranDay(e.ts)}</td><td>${esc(e.title)}</td><td>${esc(e.country)}</td></tr>`).join('')}</table>`;
  return h + FOOTER;
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

function buildRichMovers(gl) {
  const gainers = (gl.gainers || []).slice(0, 5);
  const losers = (gl.losers || []).slice(0, 5);
  const chart = moversChartUrl(gainers, losers, '24h');
  const row = (c) => {
    const tracked = c.symbol && Object.values(COINS).some((m) => m.symbol === String(c.symbol).toUpperCase());
    return `<tr><td><b>${esc(String(c.symbol || '?').toUpperCase())}</b>${tracked ? ' ⭐' : ''}</td><td>$${fmt.price(c.current_price)}</td><td>${pct(c.price_change_percentage_24h)}</td></tr>`;
  };
  let h = chart ? `<figure><img src="${chart.replace(/&/g, '&amp;')}"/><figcaption>Market-wide top movers · last 24 hours</figcaption></figure>` : '';
  h += `<h2>🚀 Top Movers — 24h</h2>`;
  if (gainers.length) h += `<table bordered striped compact><caption>🔥 Top gainers</caption><tr><th>Coin</th><th>Price</th><th>24h</th></tr>${gainers.map(row).join('')}</table>`;
  if (losers.length) h += `<table bordered striped compact><caption>🧊 Top losers</caption><tr><th>Coin</th><th>Price</th><th>24h</th></tr>${losers.map(row).join('')}</table>`;
  h += `<p><i>⭐ = tracked by TradeAgent IV · market-wide scan (Binance)</i></p>`;
  return h + FOOTER;
}

function buildRichMacroCalendar(s, dateStr) {
  const evs = [...(s.macro?.today || [])].sort((a, b) => a.ts - b.ts);
  const major = evs.filter((e) => /high|medium/i.test(e.impact || ''));
  const minor = evs.filter((e) => !/high|medium/i.test(e.impact || ''));
  const hasActual = evs.some((e) => e.actual);
  const row = (e) => `<tr><td>${tehranTime(e.ts)}</td><td>${esc(e.title)} (${esc(e.country)})${/high/i.test(e.impact || '') ? ' 🔴' : ''}</td><td>${esc(e.forecast || '—')}</td><td>${esc(e.previous || '—')}</td>${hasActual ? `<td>${esc(e.actual || '—')}</td>` : ''}</tr>`;
  const head = `<tr><th>Time</th><th>Event</th><th>Forecast</th><th>Previous</th>${hasActual ? '<th>Actual</th>' : ''}</tr>`;
  let h = `<h2>🗓️ Macro Calendar — ${esc(dateStr)}</h2>`;
  h += `<p><i>ForexFactory · all times Tehran · 🔴 = high impact</i></p>`;
  if (major.length) h += `<table bordered striped compact>${head}${major.map(row).join('')}</table>`;
  else h += `<p>No medium or high-impact releases today.</p>`;
  if (minor.length) h += `<details><summary>Low-impact releases (${minor.length})</summary><table bordered striped compact>${head}${minor.map(row).join('')}</table></details>`;
  if (s.macro?.nextHighImpact) { const n = s.macro.nextHighImpact; h += `<p><i>Next high-impact: ${esc(n.title)} (${esc(n.country)}) · ${tehranDay(n.ts)} ${tehranTime(n.ts)}</i></p>`; }
  return h + FOOTER;
}

export { buildRichMorningBrief, buildRichFlagship, buildRichEventFlash, buildRichMacroWatch, buildRichWeekly, buildRichMovers, buildRichMacroCalendar, moversChartUrl, tehranTime };
