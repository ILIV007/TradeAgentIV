// TradeAgent IV — pure helpers: formatting, escaping, timeouts, emotion inputs.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. SECURITY & UTILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isAdmin(userId, env) {
  return String(userId) === String(env.ADMIN_ID);
}

function checkSecret(request, env) {
  return request.headers.get('x-admin-secret') === env.ADMIN_SECRET;
}

function esc(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch(e => {
      if (e.name === 'AbortError') throw new Error(`Timeout after ${timeoutMs}ms`);
      throw e;
    })
    .finally(() => clearTimeout(timeoutId));
}

function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/__(.*?)__/g, '<b>$1</b>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/```/g, '');
}

// v6.1.11 CPU diet: fmt.price runs ~100x per tick; constructing a
// NumberFormat per call is pure overhead. Same output as toLocaleString
// with the same options — verified by the fmt.price test below.
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const nf68 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
const fmt = {
  price: (n) => {
    if (!n) return '$0.00';
    if (n >= 1000) return nf0.format(n);
    if (n >= 1)    return nf2.format(n);
    if (n >= 0.01) return nf4.format(n);
    return nf68.format(n);
  },
  vol: (n) => {
    if (!n) return '$0';
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${(n / 1e3).toFixed(2)}K`;
  },
  cap: (n) => {
    if (!n) return '$0';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
    return `$${(n / 1e6).toFixed(2)}M`;
  },
  change: (n) => {
    const v = n || 0;
    return `${v >= 0 ? '🟢' : '🔴'} ${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  },
  time: () => new Date().toISOString().slice(0, 16).replace('T', ' '),
  tehran: () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tehran', hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
  date: () => new Date().toISOString().slice(0, 10),
  pct: (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`,
};

function getBias(fearValue) {
  const v = parseInt(fearValue);
  if (v >= 75) return '😱 Extreme Greed — 🔴 Caution!';
  if (v >= 55) return '😊 Greed — 🟡 FOMO Zone';
  if (v >= 45) return '😐 Neutral — ⚪ Balanced';
  if (v >= 25) return '😰 Fear — 🟢 Accumulation';
  return '😨 Extreme Fear — 🟢 Opportunity!';
}

function progressBar(value, max = 100, blocks = 10) {
  const filled = Math.round((value / max) * blocks);
  return '🟩'.repeat(filled) + '⬜'.repeat(blocks - filled);
}

function getShortModelName(fullName) {
  if (!fullName) return 'AI';
  const clean = fullName.replace(/:free$/i, '').replace(/:paid$/i, '');
  const lower = clean.toLowerCase();
  if (lower.includes('gemini')) return 'Gemini';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('qwen')) return 'Qwen';
  if (lower.includes('claude')) return 'Claude';
  if (lower.includes('gpt')) return 'GPT';
  if (lower.includes('llama')) return 'Llama';
  if (lower.includes('kimi')) return 'Kimi';
  if (lower.includes('gemma')) return 'Gemma';
  return clean;
}

async function hashPrompt(prompt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export { isAdmin, checkSecret, esc, fetchWithTimeout, cleanMarkdown, fmt, getBias, progressBar, getShortModelName, hashPrompt };
