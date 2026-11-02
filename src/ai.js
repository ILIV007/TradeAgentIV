// TradeAgent IV — AI layer: Gemini chain, OpenRouter fallback, cache, circuit breaker, prompt.
import { GEMINI_URL, GEMINI_FALLBACK_URL, GEMINI_FALLBACK_URL_2, OPENROUTER_URL, COINS } from './config.js';
import { fetchWithTimeout, cleanMarkdown, fmt, getShortModelName, hashPrompt } from './utils.js';
import { getConfig, setConfig } from './store.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. AI CACHE & CIRCUIT BREAKER — [FIX v4.2.7] ADDED MISSING FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getAICache(env, hash) {
  if (!env.ALERTS_KV) return null;
  try {
    const raw = await env.ALERTS_KV.get(`ai:cache:${hash}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[AI CACHE] Get error:', e.message);
    return null;
  }
}

async function setAICache(env, hash, result) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put(`ai:cache:${hash}`, JSON.stringify(result), { expirationTtl: 28800 });
  } catch (e) {
    console.error('[AI CACHE] Set error:', e.message);
  }
}

async function isCircuitOpen(env, name) {
  if (!env.ALERTS_KV) return false;
  try {
    const raw = await env.ALERTS_KV.get(`circuit:${name}`);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Date.now() < data.until;
  } catch (e) { return false; }
}

async function tripCircuit(env, name, durationMs = 300000) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put(`circuit:${name}`, JSON.stringify({ until: Date.now() + durationMs }), { expirationTtl: 600 });
    console.log(`[CIRCUIT] ${name} tripped for ${durationMs}ms`);
  } catch (e) {}
}

async function closeCircuit(env, name) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.delete(`circuit:${name}`);
  } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. AI LAYER — Strict validation + Gemini 3.5 primary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isValidAIResponse(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();

  // Must be reasonably long (AI often returns short garbage on errors)
  if (trimmed.length < 200) {
    console.log('[AI] Response too short:', trimmed.length, 'chars');
    return false;
  }

  // Must have at least 3 sections (Market Overview + 2 more)
  const sectionCount = (trimmed.match(/<b>[^<]+<\/b>/g) || []).length;
  if (sectionCount < 3) {
    console.log('[AI] Not enough sections:', sectionCount);
    return false;
  }

  // Must have Persian separator OR Persian content
  const hasPersian = trimmed.includes('---PERSIAN---') || 
                     trimmed.includes('خلاصه') || 
                     /[؀-ۿ]/.test(trimmed);
  if (!hasPersian) {
    console.log('[AI] No Persian section found');
    return false;
  }

  // Must have conclusion
  const hasConclusion = trimmed.includes('Conclusion') || trimmed.includes('نتیجه') || trimmed.includes('جمع‌بندی');
  if (!hasConclusion) {
    console.log('[AI] No conclusion found');
    return false;
  }

  return true;
}

async function tryGeminiDirect(env, prompt, modelUrl, name) {
  if (!env.GEMINI_API_KEY) {
    console.log(`[AI] ${name} skipped: No GEMINI_API_KEY`);
    return null;
  }
  if (await isCircuitOpen(env, name)) {
    console.log(`[AI] ${name} circuit OPEN, skipping`);
    return null;
  }
  try {
    console.log(`[AI] Trying Gemini direct: ${name}...`);
    const res = await fetchWithTimeout(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
      }),
    }, 20000);
    
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${txt.slice(0, 100)}`);
    }
    
    const data = await res.json();
    console.log(`[AI] ${name} raw:`, JSON.stringify(data).slice(0, 250));
    
    let text = null;
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = data.candidates[0].content.parts[0].text;
    } else if (data?.candidates?.[0]?.content?.parts) {
      text = data.candidates[0].content.parts.map(p => p.text).join('');
    }
    
    if (isValidAIResponse(text)) {
      console.log(`[AI] ${name} SUCCESS, length:`, text.length);
      await closeCircuit(env, name);
      return cleanMarkdown(text.trim());
    }
    
    console.log(`[AI] ${name} returned empty/invalid text:`, text ? `"${text.slice(0, 50)}..."` : 'null');
    return null;
  } catch (e) {
    console.error(`[AI] ${name} fail:`, e.message);
    if (e.message.includes('429') || e.message.includes('quota') || e.message.includes('exceeded') || e.message.includes('Rate limit')) {
      console.log(`[AI] ${name} 429/quota → tripping circuit`);
      await tripCircuit(env, name);
    }
    return null;
  }
}

async function getAIAnalysis(env, prompt) {
  const promptHash = await hashPrompt(prompt);
  
  const cached = await getAICache(env, promptHash);
  if (cached) {
    console.log('[AI] Cache hit for hash:', promptHash);
    return cached;
  }

  // STEP 1: Gemini 3.8 Flash Direct (PRIMARY)
  let text = await tryGeminiDirect(env, prompt, GEMINI_URL, 'gemini-3.8-flash');
  
  // STEP 2: Gemini 3.6 Flash Fallback
  if (!text) {
    text = await tryGeminiDirect(env, prompt, GEMINI_FALLBACK_URL, 'gemini-3.6-flash');
  }

  // STEP 3: Gemini 2.5 Flash Fallback
  if (!text) {
    text = await tryGeminiDirect(env, prompt, GEMINI_FALLBACK_URL_2, 'gemini-2.5-flash');
  }

  if (text) {
    const result = { text, source: 'Gemini' };
    await setAICache(env, promptHash, result);
    await setConfig(env, 'last_ai_provider', 'Gemini');
    await setConfig(env, 'last_ai_time', fmt.time());
    return result;
  }

  // STEP 4: OpenRouter :FREE Failover
  console.log('[AI] Gemini family failed, trying OpenRouter FREE models...');
  if (!env.OPENROUTER_API_KEY) {
    console.log('[AI] No OpenRouter key, giving up');
    return null;
  }

  // Free list live-verified against the OpenRouter catalog on 2026-11-02.
  const models = [
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'thinkingmachines/inkling:free',
    'openrouter/free',  // Last resort: auto-select any available free model
  ];

  for (const model of models) {
    try {
      console.log(`[AI] Trying OpenRouter FREE: ${getShortModelName(model)}...`);
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tradeagent.iv',
          'X-Title': 'TradeAgent IV',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.3
        }),
      }, 30000);
      
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.log(`[AI] ${model} HTTP ${res.status}: ${errText.slice(0, 200)}`);
        if (res.status === 429) {
          console.log(`[AI] ${model} rate limited - waiting 3s before next model...`);
          await new Promise(r => setTimeout(r, 3000));
        }
        continue;
      }
      
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      
      if (isValidAIResponse(text)) {
        const result = { text: cleanMarkdown(text.trim()), source: getShortModelName(model) };
        await setAICache(env, promptHash, result);
        await setConfig(env, 'last_ai_provider', getShortModelName(model));
        await setConfig(env, 'last_ai_time', fmt.time());
        console.log(`[AI] ✅ ${getShortModelName(model)} SUCCESS`);
        return result;
      }
      console.log(`[AI] ${model} returned invalid content`);
    } catch (e) { 
      console.error(`[AI] ${model} fail:`, e.message); 
    }
  }

  console.log('[AI] All AI sources failed');
  return null;
}

async function testGeminiConnection(env) {
  if (!env.GEMINI_API_KEY) return { ok: false, error: 'No API key configured' };
  try {
    const res = await fetchWithTimeout(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 }
      })
    }, 10000);
    if (res.status === 429) return { ok: false, error: 'Rate limited (429)', source: 'Gemini' };
    if (res.status === 400) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `Bad Request (400): ${txt.slice(0, 100)}`, source: 'Gemini' };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, source: 'Gemini' };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.toLowerCase().includes('ok')) return { ok: true, source: 'Gemini 3.8' };
    return { ok: false, error: `Unexpected: ${text || 'empty'}`, source: 'Gemini' };
  } catch (e) {
    return { ok: false, error: e.message, source: 'Gemini' };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. AI PROMPT BUILDER — [FIX v4.2.7] Shorter, clearer, proven structure
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildAIPrompt(today, yesterday, mode, scenario, emotion, lang = 'en') {
  const t = today, y = yesterday || {};
  const emo = emotion || { state: 'NEUTRAL', intensity: 50, tone: 'Neutral, factual.' };

  const coinChanges = [];
  const mainCoins = t.coins.filter(c => ['bitcoin', 'ethereum', 'solana'].includes(c.id));
  const otherCoins = t.coins.filter(c => !['bitcoin', 'ethereum', 'solana'].includes(c.id));

  for (const c of mainCoins) {
    const ch24 = c.price_change_percentage_24h || 0;
    const ch7d = c.price_change_percentage_7d_in_currency || t.changes7d?.[c.id] || 0;
    const ch30d = c.price_change_percentage_30d_in_currency || t.changes30d?.[c.id] || 0;
    const info = COINS[c.id];
    coinChanges.push(`${info.symbol}: $${fmt.price(c.current_price)} | 24h: ${fmt.pct(ch24)} | 7d: ${fmt.pct(ch7d)} | 30d: ${fmt.pct(ch30d)} | Vol: ${fmt.vol(c.total_volume)}`);
  }

  if (otherCoins.length) {
    const tier2 = otherCoins.filter(c => COINS[c.id]?.tier === 2).map(c => `${COINS[c.id].symbol} ${fmt.pct(c.price_change_percentage_24h)}`);
    const tier3 = otherCoins.filter(c => COINS[c.id]?.tier === 3).map(c => `${COINS[c.id].symbol} ${fmt.pct(c.price_change_percentage_24h)}`);
    if (tier2.length) coinChanges.push(`Tier 2: ${tier2.join(', ')}`);
    if (tier3.length) coinChanges.push(`Tier 3: ${tier3.join(', ')}`);
  }

  let futuresText = '';
  if (t.futures?.BTCUSDT) {
    const f = t.futures.BTCUSDT;
    futuresText = `\nBTC Futures: Funding: ${f.fundingRate !== null ? f.fundingRate.toFixed(4) + '%' : 'N/A'} | OI: ${f.openInterest !== null ? fmt.vol(f.openInterest) : 'N/A'} | L/S: ${f.longShortRatio !== null ? f.longShortRatio.toFixed(2) : 'N/A'}`;
  }

  let gainersText = '';
  if (t.gainersLosers?.gainers?.length) {
    gainersText = '\nTop Gainers: ' + t.gainersLosers.gainers.slice(0, 3).map(g => `${g.symbol} ${fmt.pct(g.price_change_percentage_24h)}`).join(', ');
  }
  let losersText = '';
  if (t.gainersLosers?.losers?.length) {
    losersText = '\nTop Losers: ' + t.gainersLosers.losers.slice(0, 3).map(g => `${g.symbol} ${fmt.pct(g.price_change_percentage_24h)}`).join(', ');
  }

  const btcDomChange = y.btcDominance != null ? (t.btcDominance - y.btcDominance).toFixed(1) : '0';
  const fngChange = y.fearGreed != null ? (t.fearGreed - y.fearGreed) : 0;

  const modeDesc = {
    normal: 'Standard professional analysis',
    deep: 'Deep institutional-grade analysis with trend structure, sector rotation, risk scenarios',
    short: 'Give only: trend direction, risk level, and 1 actionable insight. Be extremely concise.',
    emotion: `Analysis must match current market emotion: ${emo.state}. ${emo.tone}`,
  };

  const scenDesc = {
    bullish: 'Assume bullish continuation. Emphasize breakout potential and altseason signals.',
    bearish: 'Assume bearish pressure. Emphasize capital flight to safety and support levels.',
    neutral: 'Balanced view. No directional bias unless data strongly supports it.',
    volatile: 'High volatility expected. Emphasize risk management and wide ranges.',
  };

  return `You are TradeAgent IV: a sharp, bilingual crypto market analyst writing for a Telegram channel. You turn raw numbers into a clear verdict — what the market is doing, why, and what matters next.

MODE: ${mode} — ${modeDesc[mode] || modeDesc.normal}
SCENARIO: ${scenario} — ${scenDesc[scenario] || scenDesc.neutral}
EMOTION: ${emo.state} (intensity ${emo.intensity}/100). Tone: ${emo.tone}

${lang === 'fa' ? `Write the analysis ENTIRELY in Persian (native, professional financial Persian; figures in Latin digits), in EXACTLY this shape:

<b>مرور بازار</b> — 2-3 sentences on the overall condition
<b>عوامل صعودی</b> — the positive signals in the data
<b>عوامل نزولی</b> — the negative signals in the data
<b>عوامل ریسک</b> — what could go wrong
<b>چرخش بخشی</b> — which tiers/categories are strong or weak
<b>زیر نظر فردا</b> — what to watch next, from the data
<b>نتیجه‌گیری</b> — one sentence

Do NOT add a ---PERSIAN--- section — the whole analysis is already in Persian.` : `Write the analysis in EXACTLY this shape:

<b>Market Overview</b> — 2-3 sentences on the overall condition
<b>Bullish Factors</b> — the positive signals in the data
<b>Bearish Factors</b> — the negative signals in the data
<b>Risk Factors</b> — what could go wrong
<b>Sector Rotation</b> — which tiers/categories are strong or weak
<b>Tomorrow Watchlist</b> — what to watch next, from the data
<b>Conclusion</b> — one sentence

Then a line containing only:
---PERSIAN---

Then the Persian summary: a <b>خلاصه بازار</b> heading followed by exactly 7 bullets (•), each one line, dense, same meaning as the English — no additions, no omissions.`}

Five hard rules:
1. Analyze ONLY the data below. Never invent support/resistance levels, price targets, or events.
2. Telegram HTML only (<b>, <i>). No markdown syntax anywhere — it renders broken.
3. Never contradict the emotion state: stress risk in FOMO/PANIC, opportunity in FEAR.
4. Complete every section; total under 700 words; compare 24h moves against 7d/30d trends.
5. End the main part with the disclaimer line (in the same language as the analysis): "⚠️ This analysis is for informational purposes only and is not financial advice."

Example of the expected voice (Market Overview only):
<b>Market Overview</b> — A quiet, defensive tape: majors are treading water while alts bleed slowly. Volume is thin, dominance is inching up, and nobody is chasing risk today.

TODAY'S DATA:
Date: ${t.date}
Market Cap: ${fmt.cap(t.totalMarketCap)} | Volume 24H: ${fmt.vol(t.totalVolume)}
BTC Dominance: ${Number(t.btcDominance || 0).toFixed(1)}% ${y.btcDominance != null ? `(change: ${btcDomChange >= 0 ? '+' : ''}${btcDomChange}%)` : ''}
Fear & Greed: ${t.fearGreed}/100 (${t.fearClassification}) ${y.fearGreed != null ? `(change: ${fngChange >= 0 ? '+' : ''}${fngChange})` : ''}

Coins:
${coinChanges.join('\n')}

${futuresText}

${gainersText}
${losersText}

Trending: ${t.trending.map(x => x.item.symbol).join(', ')}

YESTERDAY'S DATA:
${y.date ? `Date: ${y.date}` : 'No historical data'}
${y.btcDominance != null ? `BTC Dominance: ${y.btcDominance}%` : ''}
${y.fearGreed != null ? `Fear & Greed: ${y.fearGreed}/100` : ''}

Write the analysis now.`;
}

export { getAIAnalysis, testGeminiConnection, buildAIPrompt, isValidAIResponse, stateDigest, buildFlagshipPrompt, buildFlashPrompt, numericCorpus, extractNumbers, validateGrounded, parseFlagship, validateFlagship };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// v6 AI PRODUCTS — prompts + grounding/structure validation (§3)
// Method rules enforced here: scenarios not predictions, every number
// from the Market State, ranked driver, invalidation line mandatory.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function stateDigest(s) {
  const btc = s.prices.find((c) => c.id === 'bitcoin') || {};
  const eth = s.prices.find((c) => c.id === 'ethereum') || {};
  const lines = [];
  lines.push(`REGIME: ${s.regime.label} (score ${s.regime.score}/100) — drivers: ${s.regime.reasons.join('; ')}`);
  lines.push(`BTC $${btc.current_price} (24h ${btc.price_change_percentage_24h}%, 7d ${btc.price_change_percentage_7d_in_currency}%) · ETH $${eth.current_price} (24h ${eth.price_change_percentage_24h}%)`);
  const sorted = [...s.prices].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  lines.push(`Breadth: ${s.prices.filter((c) => c.price_change_percentage_24h > 0).length}/${s.prices.length} green · Best ${sorted[0]?.id} ${sorted[0]?.price_change_percentage_24h}% · Weakest ${sorted[sorted.length - 1]?.id} ${sorted[sorted.length - 1]?.price_change_percentage_24h}%`);
  lines.push(`Dominance ${s.global.btcDominance}% · Market cap $${s.global.marketCap} · Volume 24h $${s.global.volume24h}`);
  lines.push(`Fear & Greed ${s.fearGreed.now} (yesterday ${s.fearGreed.yday})`);
  const d = s.derivatives || {};
  lines.push(`Derivatives: funding BTC ${d.fundingBtc}% / ETH ${d.fundingEth}% / SOL ${d.fundingSol}% · Deribit OI $${d.oiUsd} (Δ ${d.oiDeltaPct}%) · DVOL ${d.dvol}`);
  if (s.onchain) lines.push(`On-chain: fast fee ${s.onchain.feeFast} sat/vB · hashrate ${s.onchain.hashrateEHs} EH/s`);
  if (s.defi) lines.push(`Liquidity: DeFi TVL $${s.defi.tvl} · stablecoin supply $${s.defi.stableSupply} (7d ${s.defi.stableDelta7dPct}%)`);
  if (s.macro?.nextHighImpact) { const e = s.macro.nextHighImpact; lines.push(`Next high-impact macro: ${e.title} (${e.country}) at ${new Date(e.ts).toISOString()} · forecast ${e.forecast || '—'} · previous ${e.previous || '—'}`); }
  if (s.news?.length) lines.push('Headlines: ' + s.news.slice(0, 4).map((n) => `[${n.src}] ${n.title}`).join(' | '));
  return lines.join('\n');
}

const GROUND_RULES = `HARD RULES:
- Use ONLY numbers that appear in the DATA block. Never invent a price, level, percentage or figure. If a number is not in the DATA, do not write it.
- No price predictions. Ever. Speak in scenarios with triggers taken from the DATA.
- Your read must agree with the REGIME line; if you argue against it, say so explicitly and why.
- Plain, literate, professional English. No hype, no emojis inside the analysis text.`;

function buildFlagshipPrompt(s, lang = 'en') {
  if (lang === 'fa') {
    return `You are TradeAgent IV, a senior crypto market analyst writing the flagship analysis for a Persian-language Telegram channel. This is the channel's ONLY analysis post — everything else is data. Make it count: sharp, clear, and honest.

LANGUAGE: Write EVERYTHING in Persian — native, professional, journalistic financial Persian, never translation-sounding. Keep every $ amount and figure in Latin digits. Begin EVERY line with a Persian word (never with a Latin word, symbol or number) so every paragraph right-aligns correctly. The === markers and the Lean/Level/Side fields stay in English exactly as specified.

DATA (Market State, the only source you may cite):
${stateDigest(s)}

${GROUND_RULES}

Write the analysis in EXACTLY this format (keep the === markers, nothing before or after):
===VERDICT===
One Persian sentence: the market's state and the single most important driver.
===OVERVIEW===
3-4 Persian lines: what happened and why, led by the main driver. This is the heart of the post — be specific and insightful, not a data readout (the numbers table is shown separately).
===DRIVERS===
Exactly 3 ranked drivers, one Persian line each, most important first, in this form:
1. <driver> — <one short evidence clause with its number>
2. ...
3. ...
===SCENARIOS===
===SCENARIO:BASE===
Lean: UP, DOWN or FLAT
Level: a BTC price level from the DATA, or NONE
Side: ABOVE, BELOW or NONE
Text: (in Persian) the trigger (a level or scheduled event from the DATA) → the likely path if it fires.
===SCENARIO:BULL===
Lean: UP
Level: ...
Side: ABOVE
Text: (in Persian) ...
===SCENARIO:BEAR===
Lean: DOWN
Level: ...
Side: BELOW
Text: (in Persian) ...
===WATCH===
One Persian line: the next event or level that matters, with its time if it is in the DATA.
===INVALIDATION===
One Persian line: the single fact that would invalidate this read.`;
  }
  return `You are TradeAgent IV, a senior crypto market analyst writing the flagship analysis for a Telegram channel. This is the channel's ONLY analysis post — everything else is data. Make it count: sharp, clear, and honest.

DATA (Market State, the only source you may cite):
${stateDigest(s)}

${GROUND_RULES}

Write the analysis in EXACTLY this format (keep the === markers, nothing before or after):
===VERDICT===
One line: the market's state and the single most important driver.
===OVERVIEW===
3-4 lines: what happened and why, led by the main driver. This is the heart of the post — be specific and insightful, not a data readout (the numbers table is shown separately).
===DRIVERS===
Exactly 3 ranked drivers, one line each, most important first, in this form:
1. <driver> — <one short evidence clause with its number>
2. ...
3. ...
===SCENARIOS===
===SCENARIO:BASE===
Lean: UP, DOWN or FLAT
Level: a BTC price level from the DATA, or NONE
Side: ABOVE, BELOW or NONE
Text: the trigger (a level or scheduled event from the DATA) → the likely path if it fires.
===SCENARIO:BULL===
Lean: UP
Level: ...
Side: ABOVE
Text: ...
===SCENARIO:BEAR===
Lean: DOWN
Level: ...
Side: BELOW
Text: ...
===WATCH===
One line: the next event or level that matters, with its time if it is in the DATA.
===INVALIDATION===
One line: the single fact that would invalidate this read.
===PERSIAN===
A summary written NATIVELY in Persian for Persian readers (never a word-by-word translation), with exactly these 4 labeled lines:
حکم: <one sentence — the market verdict>
سطوح: <key support/resistance levels from the DATA, $ figures in Latin digits>
سناریو: <the base case, and what activates the bull and bear cases>
مراقبت: <the next thing to watch, with its time if it is in the DATA>
Compact: at most 40% of the total length.`;
}

function buildFlashPrompt(s, event, lang = 'en') {
  if (lang === 'fa') {
    return `You are TradeAgent IV writing a fast event flash for a Persian-language Telegram channel.

LANGUAGE: Write ONLY in Persian — native, professional financial Persian. Keep figures in Latin digits.

DATA (Market State, the only source you may cite):
${stateDigest(s)}

THE EVENT: ${event.title} (${event.country}) — actual ${event.actual}, forecast ${event.forecast || '—'}, previous ${event.previous || '—'}.

${GROUND_RULES}

Write 5-8 short Persian lines ONLY (no markers): what printed vs expectations → how the market has reacted so far (from the DATA) → what it means for today's scenarios. Start with the event name and the actual figure.`;
  }
  return `You are TradeAgent IV writing a fast event flash for a Telegram channel.

DATA (Market State, the only source you may cite):
${stateDigest(s)}

THE EVENT: ${event.title} (${event.country}) — actual ${event.actual}, forecast ${event.forecast || '—'}, previous ${event.previous || '—'}.

${GROUND_RULES}

Write 5-8 short lines ONLY (no markers, no Persian): what printed vs expectations → how the market has reacted so far (from the DATA) → what it means for today's scenarios. Start with the event name and the actual figure.`;
}

// ── Numeric grounding validator (§3.2 rule 2) ─────────────────────
// Targets the catastrophic failure mode: invented levels/figures.
// Large numbers must match the state (within rounding), mid numbers
// must sit near a state value, small numbers (<20) are counts/hours.
function numericCorpus(s, extra = []) {
  const vals = [];
  const push = (v) => { const n = Number(v); if (Number.isFinite(n)) vals.push(n); };
  for (const c of s.prices || []) { push(c.current_price); push(c.price_change_percentage_24h); push(c.price_change_percentage_7d_in_currency); push(c.price_change_percentage_30d_in_currency); push(c.total_volume); push(c.market_cap); }
  push(s.global?.marketCap); push(s.global?.volume24h); push(s.global?.btcDominance);
  push(s.fearGreed?.now); push(s.fearGreed?.yday);
  const d = s.derivatives || {}; push(d.fundingBtc); push(d.fundingEth); push(d.fundingSol); push(d.oiUsd); push(d.oiDeltaPct); push(d.dvol);
  push(s.onchain?.feeFast); push(s.onchain?.feeHalfHour); push(s.onchain?.hashrateEHs);
  push(s.defi?.tvl); push(s.defi?.stableSupply); push(s.defi?.stableDelta7dPct);
  push(s.regime?.score);
  for (const e of [...(s.macro?.today || []), s.macro?.nextHighImpact, ...(extra || [])]) {
    if (!e) continue;
    for (const k of ['forecast', 'previous', 'actual']) { const n = parseFloat(String(e[k] ?? '').replace(/[^0-9.\-]/g, '')); if (Number.isFinite(n)) vals.push(n); }
  }
  const lv = s._levels; if (lv) { push(lv.h24); push(lv.l24); push(lv.h7); push(lv.l7); }
  vals.push(new Date().getFullYear());
  if (s.prices) vals.push(s.prices.length);
  return vals.filter((v) => v !== 0);
}

function extractNumbers(text) {
  const cleaned = String(text).replace(/\d{1,2}:\d{2}/g, ' ').replace(/===?[A-Z:]+===/g, ' ')
    .replace(/\b\d+\s?(?:h|hr|hrs|hours?|d|days?|w|weeks?|mins?|minutes?)\b/gi, ' ');
  const out = [];
  for (const m of cleaned.matchAll(/\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?([kKmMbB](?![A-Za-z]))?/g)) {
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (m[2]) n *= { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()];
    out.push(n);
  }
  return out;
}

function isGrounded(n, corpus) {
  // Sign carries no grounding information (direction words do), so all
  // comparisons run on absolute values: "down 1.38%" is grounded by -1.38.
  const a = Math.abs(n);
  if (a < 20) return true;
  for (const v of corpus) {
    const av = Math.abs(v);
    if (a >= 100 || av >= 100) {
      if (av > 0 && Math.abs(a - av) / av <= 0.005) return true;
      // rounded forms of big values (78,000 / 78.0k / 3.2B)
      for (const r of [10, 100, 1000]) if (Math.abs(Math.round(av / r) * r - a) / (av || 1) <= 0.005) return true;
    } else if (Math.abs(a - av) <= 1.6) return true;
  }
  return false;
}

function validateGrounded(text, s, extra = []) {
  const corpus = numericCorpus(s, extra);
  const bad = extractNumbers(text).filter((n) => !isGrounded(n, corpus));
  return { ok: bad.length === 0, bad };
}

// ── Flagship structure ──────────────────────────────────────────────
const FLAGSHIP_SECTIONS = ['VERDICT', 'OVERVIEW', 'DRIVERS', 'SCENARIOS', 'WATCH', 'INVALIDATION', 'PERSIAN'];

function parseFlagship(text) {
  const parts = {};
  const re = /===([A-Z:]+)===\s*/g;
  let last = null, m;
  const marks = [];
  while ((m = re.exec(text))) marks.push({ key: m[1], start: m.index, end: re.lastIndex });
  for (let i = 0; i < marks.length; i++) {
    const seg = text.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim();
    parts[marks[i].key] = seg;
  }
  const scenarios = [];
  for (const kind of ['BASE', 'BULL', 'BEAR']) {
    const raw = parts[`SCENARIO:${kind}`] || '';
    const field = (name) => (raw.match(new RegExp(`${name}:\\s*(.+)`)) || [])[1]?.trim() || '';
    const lvl = parseFloat(field('Level').replace(/[^0-9.]/g, ''));
    scenarios.push({
      kind, lean: field('Lean').toUpperCase(), level: Number.isFinite(lvl) ? lvl : null,
      side: field('Side').toUpperCase(),
      text: (raw.split('\n').filter((l) => !/^(Lean|Level|Side):/.test(l)).join(' ').replace(/^Text:\s*/, '') || raw).trim(),
    });
  }
  return {
    verdict: parts.VERDICT || '', overview: parts.OVERVIEW || '',
    drivers: (parts.DRIVERS || '').split(/\n+/).map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean),
    watch: parts.WATCH || '',
    invalidation: parts.INVALIDATION || '', persian: parts.PERSIAN || '', scenarios,
    _sections: Object.keys(parts),
  };
}

function validateFlagship(text, s, lang = 'en') {
  const errors = [];
  const p = parseFlagship(text);
  const required = lang === 'fa' ? FLAGSHIP_SECTIONS.filter((x) => x !== 'PERSIAN') : FLAGSHIP_SECTIONS;
  for (const sec of required) if (!p._sections.includes(sec) && sec !== 'SCENARIOS') errors.push(`missing section ${sec}`);
  if (!p._sections.some((k) => k.startsWith('SCENARIO:'))) errors.push('missing scenarios');
  if (p.verdict.length < 10) errors.push('verdict too short');
  if (p.drivers.length < 3) errors.push('needs exactly 3 ranked drivers');
  for (const sc of p.scenarios) {
    if (!['UP', 'DOWN', 'FLAT'].includes(sc.lean)) errors.push(`${sc.kind}: bad lean`);
    if (!sc.text || sc.text.length < 20) errors.push(`${sc.kind}: text too short`);
    if (sc.level != null && !['ABOVE', 'BELOW'].includes(sc.side)) errors.push(`${sc.kind}: level without side`);
  }
  if (!p.invalidation) errors.push('missing invalidation line');
  if (lang !== 'fa') {
    if (!/[؀-ۿ]/.test(p.persian)) errors.push('persian summary missing');
    for (const f of ['حکم', 'سطوح', 'سناریو', 'مراقبت']) if (!p.persian.includes(f)) errors.push(`persian summary missing field ${f}`);
    if (p.persian.length > text.length * 0.4) errors.push('persian summary over 40%');
  }
  const g = validateGrounded(text, s);
  if (!g.ok) errors.push(`ungrounded numbers: ${g.bad.slice(0, 5).join(', ')}`);
  return { ok: errors.length === 0, errors, parsed: p };
}
