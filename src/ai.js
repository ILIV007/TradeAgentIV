// TradeAgent IV — AI layer: Gemini chain, OpenRouter fallback, cache, circuit breaker, prompt.
import { GEMINI_URL, GEMINI_FALLBACK_URL, OPENROUTER_URL, GROQ_URL, COINS } from './config.js';
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

// Failure diagnostics: one short line per failed/skipped provider attempt,
// reset at the start of every getAIAnalysis call. Senders surface these in
// the admin failure notify so a silent post explains itself.
let lastAIFailureReasons = [];
// Google geo-blocks the Gemini API by the Worker's egress location, which
// varies per run: one 400 'User location is not supported' means EVERY
// Gemini call from this isolate will 400. Memoize it so later Gemini steps
// skip instantly instead of burning the chain deadline (v6.1.6).
let geminiGeoBlockedUntil = 0;
function noteAIFailure(line) { lastAIFailureReasons.push(line); }
function getLastAIFailureReasons() { return [...lastAIFailureReasons]; }
const shortErr = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 80);

// Returns '' when valid, otherwise a short reason (same checks, same order
// as the old boolean validator).
// Models answer in different markup dialects (HTML <b>, markdown **, ##
// headings, bare heading lines). Judge the CONTENT, not the dialect:
// normalize to the canonical <b> form before counting sections — a draft
// rejected only for its markup was the v6.1.6 'only 1 section' failure.
const AI_SECTIONS = ['Market Overview', 'Bullish Factors', 'Bearish Factors', 'Risk Factors', 'Sector Rotation', 'Tomorrow Watchlist', 'Conclusion'];
function normalizeForValidation(text) {
  let t = cleanMarkdown(text);
  for (const name of AI_SECTIONS) {
    t = t.replace(new RegExp(`^\\s*${name}\\s*:?\\s*$`, 'gim'), `<b>${name}</b>`);
  }
  return t;
}

function aiValidationReason(text) {
  if (!text || typeof text !== 'string') return 'empty response';
  const trimmed = text.trim();

  // Must be reasonably long (AI often returns short garbage on errors)
  if (trimmed.length < 200) return `too short (${trimmed.length} chars)`;

  // Must have at least 3 sections (Market Overview + 2 more), any dialect
  const norm = normalizeForValidation(trimmed);
  const sectionCount = (norm.match(/<b>[^<]+<\/b>/g) || []).length;
  if (sectionCount < 3) return `only ${sectionCount} section${sectionCount === 1 ? '' : 's'}`;

  // Must have Persian separator OR Persian content
  const hasPersian = trimmed.includes('---PERSIAN---') ||
                     trimmed.includes('خلاصه') ||
                     /[؀-ۿ]/.test(trimmed);
  if (!hasPersian) return 'no Persian section';

  // Must have conclusion
  const hasConclusion = norm.includes('Conclusion') || trimmed.includes('نتیجه') || trimmed.includes('جمع‌بندی');
  if (!hasConclusion) return 'no conclusion';

  return '';
}

function isValidAIResponse(text) {
  const reason = aiValidationReason(text);
  if (reason) console.log('[AI] Invalid response:', reason);
  return reason === '';
}

async function tryGeminiDirect(env, prompt, modelUrl, name, raw = false, opts = {}) {
  if (!env.GEMINI_API_KEY) {
    console.log(`[AI] ${name} skipped: No GEMINI_API_KEY`);
    noteAIFailure(`${name}: no key`);
    return null;
  }
  if (Date.now() < geminiGeoBlockedUntil) {
    console.log(`[AI] ${name} skipped: Gemini geo-blocked from this location`);
    noteAIFailure(`${name}: skipped (Gemini geo-blocked)`);
    return null;
  }
  if (await isCircuitOpen(env, name)) {
    console.log(`[AI] ${name} circuit OPEN, skipping`);
    noteAIFailure(`${name}: circuit open`);
    return null;
  }
  try {
    console.log(`[AI] Trying Gemini direct: ${name}...`);
    const res = await fetchWithTimeout(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096, ...(opts.thinkingLevel ? { thinkingConfig: { thinkingLevel: opts.thinkingLevel } } : {}) }
      }),
    }, opts.timeoutMs || 20000);
    
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
    
    if (raw) {
      // Raw mode: any non-empty draft passes; the caller's validator judges it.
      if (text && text.trim()) {
        console.log(`[AI] ${name} SUCCESS (raw), length:`, text.length);
        await closeCircuit(env, name);
        return text.trim();
      }
      console.log(`[AI] ${name} returned empty text`);
      return null;
    }

    if (isValidAIResponse(text)) {
      console.log(`[AI] ${name} SUCCESS, length:`, text.length);
      await closeCircuit(env, name);
      return cleanMarkdown(text.trim());
    }

    console.log(`[AI] ${name} returned empty/invalid text:`, text ? `"${text.slice(0, 50)}..."` : 'null');
    const finishReason = data?.candidates?.[0]?.finishReason;
    noteAIFailure(`${name}: invalid response (${finishReason === 'MAX_TOKENS' ? 'truncated (MAX_TOKENS)' : aiValidationReason(text)})`);
    return null;
  } catch (e) {
    console.error(`[AI] ${name} fail:`, e.message);
    if (e.message.includes('User location is not supported')) {
      geminiGeoBlockedUntil = Date.now() + 30 * 60000;
      noteAIFailure(`${name}: geo-blocked (Gemini API not supported from the worker's egress location)`);
    } else {
      noteAIFailure(`${name}: ${shortErr(e.message)}`);
    }
    if (e.message.includes('429') || e.message.includes('quota') || e.message.includes('exceeded') || e.message.includes('Rate limit')) {
      console.log(`[AI] ${name} 429/quota → tripping circuit`);
      await tripCircuit(env, name);
    }
    return null;
  }
}

async function getAIAnalysis(env, prompt, opts = {}) {
  lastAIFailureReasons = [];
  // Raw mode (v6 flagship/flash): no legacy format gate — the caller's own
  // validator judges the draft — and the legacy cache is neither read nor
  // written, so raw drafts never enter or are served from it.
  const raw = !!opts?.raw;
  const promptHash = raw ? null : await hashPrompt(prompt);

  if (!raw) {
    const cached = await getAICache(env, promptHash);
    if (cached) {
      console.log('[AI] Cache hit for hash:', promptHash);
      return cached;
    }
  }

  // Chain v6.1.6 (architecture fix, 2026-11-11): v6.1.4 put THREE slots on
  // one vendor, so a single Gemini failure mode (egress geo-block 400s,
  // capacity 503s) burned most of the chain, and the two OpenRouter slots
  // shared one extraction bug. Now every step is a different infrastructure,
  // Gemini is geo-aware, and same-platform Workers AI anchors reliability.
  // Steps whose binding/secret is absent skip silently. One global ~90s
  // deadline bounds the chain; every step gets min(cap, rest).
  const deadline = Date.now() + 90000;
  const remain = () => deadline - Date.now();
  const geminiResult = async (t) => {
    const result = { text: t, source: 'Gemini' };
    if (!raw) await setAICache(env, promptHash, result);
    await setConfig(env, 'last_ai_provider', 'Gemini');
    await setConfig(env, 'last_ai_time', fmt.time());
    return result;
  };
  const accept = async (t, source) => {
    const result = { text: raw ? t.trim() : cleanMarkdown(t.trim()), source };
    if (!raw) await setAICache(env, promptHash, result);
    await setConfig(env, 'last_ai_provider', source);
    await setConfig(env, 'last_ai_time', fmt.time());
    return result;
  };

  // STEP 1: Workers AI Qwen3 30B — same platform, cannot geo-block.
  const wai = remain() > 3000 ? await tryWorkersAI(env, prompt, raw, Math.min(25000, remain())) : null;
  if (wai) return await accept(wai, 'Workers AI');

  // STEP 2: Gemini 3.5 Flash-Lite (fast + 500 req/day free when reachable).
  let text = await tryGeminiDirect(env, prompt, GEMINI_URL, 'gemini-3.5-flash-lite', raw, { timeoutMs: Math.min(15000, remain()) });
  if (text) return await geminiResult(text);

  // STEP 3: Groq Llama 3.3 70B — separate infra, ~280 tok/s.
  const groq = remain() > 3000 ? await tryGroq(env, prompt, raw, Math.min(15000, remain())) : null;
  if (groq) return await accept(groq, 'Groq');

  // STEP 4: OpenRouter Nemotron Ultra (reasoning tamed: low effort, 4096 cap).
  const orNemotron = await tryOpenRouter(env, prompt, ['nvidia/nemotron-3-ultra-550b-a55b:free'], raw, promptHash, deadline);
  if (orNemotron) return orNemotron;

  // STEP 5: Gemini 3.6 Flash — skipped instantly while geo-blocked.
  if (remain() > 5000) {
    text = await tryGeminiDirect(env, prompt, GEMINI_FALLBACK_URL, 'gemini-3.6-flash', raw, { timeoutMs: Math.min(12000, remain()), thinkingLevel: 'low' });
    if (text) return await geminiResult(text);
  }

  // STEP 6: OpenRouter final net — Gemma 4 31B, then the free auto-router.
  const orFree = await tryOpenRouter(env, prompt, ['google/gemma-4-31b-it:free', 'openrouter/free'], raw, promptHash, deadline);
  if (orFree) return orFree;

  console.log('[AI] All AI sources failed');
  return null;
}

// One extraction for every OpenAI-shaped API (OpenRouter, Groq): content
// may be a string, an array of parts, or absent while an error rides along
// in a 200 body. v6.1.4 read only the string form and called the rest
// 'empty response'.
function extractChatText(data) {
  if (data?.error) return { text: null, error: data.error.message || 'provider error', finish: null };
  const msg = data?.choices?.[0]?.message;
  let text = null;
  if (typeof msg?.content === 'string') text = msg.content;
  else if (Array.isArray(msg?.content)) text = msg.content.map((p) => p?.text || '').join('');
  return { text: text && text.trim() ? text : null, error: null, finish: data?.choices?.[0]?.finish_reason || null };
}

const WAI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Cloudflare Workers AI runs on the same platform as the Worker itself:
// it cannot be geo-blocked or capacity-starved the way external APIs are,
// which makes it the chain's reliability anchor. Active only when the AI
// binding exists (dashboard step); silently skipped until then.
async function tryWorkersAI(env, prompt, raw, timeoutMs) {
  if (!env.AI) return null;
  try {
    console.log('[AI] Trying Workers AI: Qwen3 30B...');
    const data = await Promise.race([
      env.AI.run(WAI_MODEL, { messages: [{ role: 'user', content: `/no_think\n${prompt}` }], max_tokens: 4096, temperature: 0.3 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)),
    ]);
    const text = data?.response ?? data?.result?.response ?? null;
    if (raw ? (text && text.trim()) : isValidAIResponse(text)) {
      console.log('[AI] Workers AI SUCCESS, length:', text.length);
      return text;
    }
    noteAIFailure(`workers-ai: invalid response (${aiValidationReason(text)})`);
    return null;
  } catch (e) {
    console.error('[AI] workers-ai fail:', e.message);
    noteAIFailure(`workers-ai: ${shortErr(e.message)}`);
    return null;
  }
}

// Groq (OpenAI-shaped, separate infra, very fast). Active only when the
// GROQ_API_KEY secret exists; silently skipped until then.
async function tryGroq(env, prompt, raw, timeoutMs) {
  if (!env.GROQ_API_KEY) return null;
  try {
    console.log('[AI] Trying Groq: Llama 3.3 70B...');
    const res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.3 }),
    }, timeoutMs);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${errText.slice(0, 100)}`);
    }
    const { text, error, finish } = extractChatText(await res.json());
    if (error) throw new Error(error);
    if (raw ? (text && text.trim()) : isValidAIResponse(text)) {
      console.log('[AI] Groq SUCCESS, length:', text.length);
      return text;
    }
    noteAIFailure(`groq: invalid response (${finish === 'length' ? 'truncated' : aiValidationReason(text)})`);
    return null;
  } catch (e) {
    console.error('[AI] groq fail:', e.message);
    noteAIFailure(`groq: ${shortErr(e.message)}`);
    return null;
  }
}

async function tryOpenRouter(env, prompt, models, raw, promptHash, deadline) {
  console.log('[AI] Trying OpenRouter FREE models...');
  if (!env.OPENROUTER_API_KEY) {
    console.log('[AI] No OpenRouter key, giving up');
    noteAIFailure('openrouter: no key');
    return null;
  }

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) { console.log('[AI] Global AI deadline reached, stopping chain'); break; }
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
          max_tokens: 4096,
          temperature: 0.3,
          // Nemotron Ultra is a reasoning model: at 1500 tokens its chain of
          // thought ate the whole budget and content came back empty.
          ...(model.includes('nemotron') ? { reasoning: { effort: 'low', exclude: true } } : {})
        }),
      }, Math.min(model === 'openrouter/free' ? 10000 : 18000, remaining));

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.log(`[AI] ${model} HTTP ${res.status}: ${errText.slice(0, 200)}`);
        noteAIFailure(`openrouter ${getShortModelName(model)}: HTTP ${res.status} ${shortErr(errText)}`.trim());
        if (res.status === 429 && deadline - Date.now() > 6000) {
          console.log(`[AI] ${model} rate limited - waiting 3s before next model...`);
          await new Promise(r => setTimeout(r, 3000));
        }
        continue;
      }

      const data = await res.json();
      const { text, error, finish } = extractChatText(data);
      if (error) {
        console.log(`[AI] ${model} provider error: ${error}`);
        noteAIFailure(`openrouter ${getShortModelName(model)}: ${shortErr(error)}`);
        continue;
      }

      if (raw ? (text && text.trim()) : isValidAIResponse(text)) {
        const result = { text: raw ? text.trim() : cleanMarkdown(text.trim()), source: getShortModelName(model) };
        if (!raw) await setAICache(env, promptHash, result);
        await setConfig(env, 'last_ai_provider', getShortModelName(model));
        await setConfig(env, 'last_ai_time', fmt.time());
        console.log(`[AI] ✅ ${getShortModelName(model)} SUCCESS`);
        return result;
      }
      console.log(`[AI] ${model} returned invalid content`);
      noteAIFailure(`openrouter ${getShortModelName(model)}: invalid response (${finish === 'length' ? 'truncated' : aiValidationReason(text)})`);
    } catch (e) {
      console.error(`[AI] ${model} fail:`, e.message);
      noteAIFailure(`openrouter ${getShortModelName(model)}: ${shortErr(e.message)}`);
    }
  }
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
    if (text && text.toLowerCase().includes('ok')) return { ok: true, source: 'Gemini 3.5 Flash-Lite' };
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

export { getAIAnalysis, getLastAIFailureReasons, testGeminiConnection, buildAIPrompt, isValidAIResponse, stateDigest, buildFlagshipPrompt, buildFlashPrompt, numericCorpus, extractNumbers, validateGrounded, parseFlagship, validateFlagship };

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
