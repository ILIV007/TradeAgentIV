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

function buildAIPrompt(today, yesterday, mode, scenario, emotion) {
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

Write the analysis in EXACTLY this shape:

<b>Market Overview</b> — 2-3 sentences on the overall condition
<b>Bullish Factors</b> — the positive signals in the data
<b>Bearish Factors</b> — the negative signals in the data
<b>Risk Factors</b> — what could go wrong
<b>Sector Rotation</b> — which tiers/categories are strong or weak
<b>Tomorrow Watchlist</b> — what to watch next, from the data
<b>Conclusion</b> — one sentence

Then a line containing only:
---PERSIAN---

Then the Persian summary: a <b>خلاصه بازار</b> heading followed by exactly 7 bullets (•), each one line, dense, same meaning as the English — no additions, no omissions.

Five hard rules:
1. Analyze ONLY the data below. Never invent support/resistance levels, price targets, or events.
2. Telegram HTML only (<b>, <i>). No markdown syntax anywhere — it renders broken.
3. Never contradict the emotion state: stress risk in FOMO/PANIC, opportunity in FEAR.
4. Complete every section; total under 700 words; compare 24h moves against 7d/30d trends.
5. End the English part (before the separator) with: "⚠️ This analysis is for informational purposes only and is not financial advice."

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

export { getAIAnalysis, testGeminiConnection, buildAIPrompt, isValidAIResponse };
