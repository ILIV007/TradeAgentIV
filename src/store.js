// TradeAgent IV — KV storage: snapshots, config, user state, dedup.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. SNAPSHOT & CONFIG KV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function storeSnapshot(env, data) {
  if (!env.ALERTS_KV) return;
  try {
    // Dated key = real "yesterday" for the next day; legacy key kept for compat.
    await env.ALERTS_KV.put(`snapshot:${data.date}`, JSON.stringify(data), { expirationTtl: 259200 });
    await env.ALERTS_KV.put('snapshot:yesterday', JSON.stringify(data));
  } catch (e) {}
}

// ── Market State (v6 §1): latest + hourly history in KV ──────────────
async function putMarketState(env, s) {
  if (!env.ALERTS_KV) return;
  try {
    const body = JSON.stringify(s);
    await env.ALERTS_KV.put('state:latest', body);
    const hour = new Date(s.ts).toISOString().slice(0, 13);
    await env.ALERTS_KV.put(`state:hist:${hour}`, body, { expirationTtl: 604800 });
  } catch (e) {}
}

async function getMarketState(env) {
  if (!env.ALERTS_KV) return null;
  try {
    const raw = await env.ALERTS_KV.get('state:latest');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Generic JSON KV helpers (v6 records: scenarios, watcher markers).
async function kvGetJSON(env, key) {
  if (!env.ALERTS_KV) return null;
  try { const raw = await env.ALERTS_KV.get(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

async function kvPutJSON(env, key, value, ttl = null) {
  if (!env.ALERTS_KV) return;
  try { await env.ALERTS_KV.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined); } catch (e) {}
}

async function getSnapshot(env) {
  if (!env.ALERTS_KV) return null;
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const raw = (await env.ALERTS_KV.get(`snapshot:${yesterday}`)) || (await env.ALERTS_KV.get('snapshot:yesterday'));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

async function getConfig(env, key, def) {
  if (!env.ALERTS_KV) return def;
  try {
    const v = await env.ALERTS_KV.get(`cfg:${key}`);
    return v || def;
  } catch (e) { return def; }
}

async function setConfig(env, key, value) {
  if (!env.ALERTS_KV) return;
  try {
    await env.ALERTS_KV.put(`cfg:${key}`, value);
  } catch (e) {}
}

async function getUserState(env, userId) {
  if (!env.ALERTS_KV) return null;
  try {
    return await env.ALERTS_KV.get(`state:${userId}`);
  } catch (e) { return null; }
}

async function setUserState(env, userId, value) {
  if (!env.ALERTS_KV) return;
  try {
    if (value) await env.ALERTS_KV.put(`state:${userId}`, value);
    else await env.ALERTS_KV.delete(`state:${userId}`);
  } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14. DEDUP — v3 FIX (10min Gap + 5min Lock + Race-Proof)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEDUP_SKIPPED = 'dedup-skipped';

async function dedupSend(env, type, fn) {
  if (!env.ALERTS_KV) {
    console.log(`[DEDUP] KV not available, running ${type}`);
    return await fn();
  }
  
  const key = `dedup:send:${type}`;
  const lockKey = `dedup:lock:${type}`;
  const now = Date.now();
  
  try {
    const existing = await env.ALERTS_KV.get(key);
    if (existing) {
      const age = now - parseInt(existing);
      if (age < 600000) {
        console.log(`[DEDUP] Blocked ${type} (age: ${age}ms < 10min)`);
        return DEDUP_SKIPPED;
      }
    }
    
    await env.ALERTS_KV.put(lockKey, now.toString(), { expirationTtl: 300 });
    
    const doubleCheck = await env.ALERTS_KV.get(key);
    if (doubleCheck) {
      const age2 = now - parseInt(doubleCheck);
      if (age2 < 600000) {
        await env.ALERTS_KV.delete(lockKey);
        console.log(`[DEDUP] Race blocked ${type} (age: ${age2}ms)`);
        return DEDUP_SKIPPED;
      }
    }
    
    const result = await fn();
    
    await env.ALERTS_KV.put(key, now.toString(), { expirationTtl: 900 });
    await env.ALERTS_KV.delete(lockKey);
    
    return result;
  } catch (e) {
    console.log(`[DEDUP] Error for ${type}: ${e.message}`);
    try { await env.ALERTS_KV.delete(lockKey); } catch (e2) {}
    throw e;
  }
}

export { storeSnapshot, getSnapshot, getConfig, setConfig, getUserState, setUserState, DEDUP_SKIPPED, dedupSend, putMarketState, getMarketState, kvGetJSON, kvPutJSON };
