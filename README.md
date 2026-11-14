# 🚀 TradeAgent IV

> **AI-Powered Cryptocurrency Market Intelligence on Telegram**
> Serverless • Multi-Model AI • Real-Time Channel Automation

- Channel: https://t.me/TradeAgentIV
- Our hub: https://t.me/ILIVIR3

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-F69652?style=flat-square&logo=cloudflare&logoColor=white)
![Telegram Bot](https://img.shields.io/badge/Telegram-2CA5E0?style=flat-square&logo=telegram&logoColor=white)
![AI Models](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenRouter-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Version](https://img.shields.io/badge/Version-6.1.19-orange?style=flat-square)

---

## 📖 Overview

**TradeAgent IV** is a serverless cryptocurrency intelligence system on **Cloudflare Workers**. It posts market updates to a Telegram channel on a schedule and answers in private chat, powered by a custom **Emotion Engine** that gauges market psychology. It runs entirely on free tiers with multi-layer failover for both market data and AI.

**Golden rule:** the channel never receives error or placeholder posts. If data for a post is unavailable, the bot stays silent and only logs it.

---

## 📡 Channel Posts

| Post | Schedule (UTC) | Notes |
|---|---|---|
| 📊 Market Snapshot | every 30 min | 32 coins in 3 tiers, BTC dominance + Fear & Greed context line, best/weakest of the day, Tehran time |
| 🧠 AI Market Intelligence | every 8 h (bundle) | Full English analysis + dense Persian summary, emotion-aware; preceded by a sticker, followed by F&G and Futures |
| 🧠 Fear & Greed | bundle + on demand | Visual bar, signal interpretation, yesterday's value and delta |
| ⚡ Futures | bundle + on demand | Funding / open interest / long-short for BTC, ETH, SOL, XRP, HYPE, DOGE, with OI change vs the last snapshot |
| 🚀 Top Movers | 09:00 / 15:00 / 21:00 | Top gainers/losers across the **whole Binance USDT market** (volume-filtered); tracked coins are ⭐-marked |
| 🚨 Move Alerts | on threshold cross | Fires when a tracked coin's 24h move crosses ±5% (BTC/ETH) or ±7% (SOL) |

On demand via the bot/admin: Volume Leaders (⚡ = unusual volume), Daily Intelligence, Trending Coins (with live prices).

## ✨ Key Features

- **Multi-API failover:** CoinGecko → CoinMarketCap → Binance for prices; Binance for futures and movers; Alternative.me for Fear & Greed. Coin IDs are monitored — a renamed upstream ID logs loudly instead of silently dropping a coin.
- **Multi-model AI failover:** Gemini 3.5 Flash-Lite → Workers AI (Qwen3 30B) → Groq Llama 3.3 70B → OpenRouter Nemotron 3 Ultra → Gemini 3.6 Flash → OpenRouter Gemma 4 31B → free OpenRouter models, with per-model circuit breakers and an 8-hour KV response cache. If every provider fails, the channel stays silent and the admin is notified in private chat.
- **Bilingual AI output:** structured English analysis followed by a compact Persian summary, with a custom **Emotion Engine** (💀 PANIC · 😰 FEAR · 😐 NEUTRAL · 🔥 MOMENTUM · 🚀 BREAKOUT · 🧨 FOMO) computed from BTC/ETH action, Fear & Greed and BTC dominance.
- **Smart deduplication:** 10-minute gap + lock per post type; the send-all bundle reports dedup skips honestly.
- **3-tier coin tracking (32 coins):**
  - **Tier 1 — Blue Chips:** BTC, ETH, SOL, XRP, BNB, XAUT
  - **Tier 2 — Utility & L2s:** ADA, LINK, AVAX, SUI, HBAR, POL, INJ, ARB, OP, ATOM, TON, DOT, LTC, NEAR, APT, UNI, TRX, HYPE
  - **Tier 3 — Meme & AI:** SHIB, DOGE, PEPE, WIF, BONK, TAO, FET, RENDER

---

## 🛠️ Tech Stack & Layout

- **Runtime:** Cloudflare Workers (JavaScript ES modules, no runtime dependencies)
- **Storage:** Cloudflare KV (`ALERTS_KV`) — snapshots, dedup, AI cache, config, user state
- **Tests:** `node:test` — run `npm test`

```
src/
  config.js    coins, cron schedule, endpoints, constants
  utils.js     formatting, escaping, fetch timeouts
  data.js      price failover, movers, futures, global, trending, F&G
  ai.js        Gemini/OpenRouter chains, prompt, cache, circuit breakers
  store.js     KV: snapshots, config, user state, dedup
  telegram.js  Telegram API, stickers, keyboards
  posts.js     post builders (pure: data in, Telegram HTML out)
  senders.js   alert logic, data collection, channel senders
  bot.js       private-chat handlers, webhook processing
  index.js     cron handler + HTTP router (entry point)
```

---

## ⚙️ Configuration

Worker secrets / vars:

- `TELEGRAM_BOT_TOKEN` — Telegram Bot API token
- `TELEGRAM_CHANNEL_ID` — target channel (e.g. `@TradeAgentIV` or `-100...`)
- `ADMIN_ID` — admin's Telegram user ID
- `ADMIN_SECRET` — secret header value for `/admin` and `/debug`
- `TELEGRAM_WEBHOOK_SECRET` — *(optional, recommended)* Telegram webhook `secret_token`; when set, webhook calls without it are rejected
- `COINGECKO_API_KEY`, `CMC_API_KEY` — market data keys (Binance is the keyless fallback)
- `GEMINI_API_KEY`, `OPENROUTER_API_KEY` — AI provider keys

**KV binding:** the `ALERTS_KV` namespace binding is managed in the Cloudflare dashboard. The namespace ID is intentionally **not** committed to this public repo (see the note in `wrangler.toml`).

---

## 🤖 Bot Commands

**Users:** `/start` main menu · `/price` · `/volume` · `/daily` (`/mar
...[truncated 1643 chars]