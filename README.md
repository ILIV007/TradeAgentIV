- https://t.me/TradeAgentIV
```markdown
# 🚀 TradeAgent IV HYBRID

> **AI-Powered Cryptocurrency Market Intelligence System**
> Serverless • Multi-Model AI • Real-Time Telegram Automation

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-F69652?style=flat-square&logo=cloudflare&logoColor=white)
![Telegram Bot](https://img.shields.io/badge/Telegram-2CA5E0?style=flat-square&logo=telegram&logoColor=white)
![AI Models](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenRouter-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Version](https://img.shields.io/badge/Version-4.3.2--FINAL-orange?style=flat-square)

---

## 📖 Overview

**TradeAgent IV HYBRID** is an advanced, serverless cryptocurrency intelligence system built on **Cloudflare Workers**. It automates Telegram channel posting with real-time market analysis, powered by a proprietary **Emotion Engine** that gauges market psychology.

The system operates on a **100% free AI tier architecture**, using multi-tier API failovers to guarantee maximum uptime with zero infrastructure cost.

---

## ✨ Key Features

### 🧠 Advanced AI Intelligence
- **Multi-Model Failover:** Cascades through Gemini 3.5 Flash → 3.1 Flash-Lite → 2.5 Flash → OpenRouter FREE models automatically.
- **Bilingual Output:** Full English analysis followed by a dense Persian (Farsi) summary.
- **Custom Prompts:** Admins can inject custom focus areas into the AI analysis.

### 📊 3-Tier Coin Tracking
- **Tier 1 (Blue Chips):** BTC, ETH, SOL, XRP, BNB, XAUT
- **Tier 2 (Utility & L2s):** ADA, LINK, AVAX, SUI, HBAR, POL, INJ, ARB, OP, ATOM, TON, DOT, LTC, NEAR, APT, UNI, TRX, HYPE
- **Tier 3 (Meme & AI):** SHIB, DOGE, PEPE, WIF, BONK, TAO, FET, RENDER

### 🎭 Proprietary Emotion Engine
Calculates real-time market psychology using BTC/ETH price action, Fear & Greed Index, and BTC Dominance.

**Emotion States:**
- 💀 **PANIC** — Extreme market crash detected
- 😰 **FEAR** — Conservative accumulation opportunities
- 😐 **NEUTRAL** — Sideways market, balanced analysis
- 🔥 **MOMENTUM** — Upside building, optimistic tone
- 🚀 **BREAKOUT** — Confirmed breakout, pullback warnings
- 🧨 **FOMO** — Extreme greed, risk emphasis

### 🔄 Bulletproof Architecture
- **Multi-API Failover:** CoinGecko → CoinMarketCap → Binance
- **Smart Deduplication (v3):** 10-min gap + 5-min lock + race-proof
- **Circuit Breakers:** Auto-trips failing AI models to prevent quota exhaustion
- **Serverless:** Runs entirely on Cloudflare Workers with KV storage

---

## 🛠️ Tech Stack

- **Runtime:** Cloudflare Workers (JavaScript ES Modules)
- **Storage:** Cloudflare KV (Snapshots, Dedup locks, AI Cache, User States)
- **Data Providers:** CoinGecko, CoinMarketCap, Binance, Alternative.me
- **AI Providers:** Google Gemini, OpenRouter
- **Messaging:** Telegram Bot API (HTML Parse Mode, Inline Keyboards, Webhooks)

---

## ⚙️ Environment Variables

### Secrets & API Keys

- `TELEGRAM_BOT_TOKEN` — Your Telegram Bot API token
- `TELEGRAM_CHANNEL_ID` — Target Telegram channel ID (e.g., `@mychannel` or `-100...`)
- `ADMIN_ID` — Your Telegram User ID (admin panel access)
- `ADMIN_SECRET` — Secure string for `/admin` HTTP authentication
- `COINGECKO_API_KEY` — CoinGecko Demo/Pro API key
- `CMC_API_KEY` — CoinMarketCap Pro API key
- `GEMINI_API_KEY` — Google AI Studio API key
- `OPENROUTER_API_KEY` — OpenRouter API key for fallback models

### KV Namespace Binding

- `ALERTS_KV` — Cloudflare KV Namespace for caching, deduplication, and state storage

---

## 🤖 Bot Commands

### 👤 User Commands

- `/start` — Open the main interactive menu
- `/price` — Live 3-Tier market snapshot
- `/volume` — Top 10 coins by 24h trading volume
- `/daily` — Comprehensive daily market report
- `/trending` — Currently trending coins
- `/fng` — Fear & Greed Index with visual bar
- `/alerts` — Configure custom price alerts
- `/settings` — View bot configuration and API status
- `/help` — List all available commands

### 🛡️ Admin Commands

- `/admin` — Open the interactive Admin Control Panel
- `/sendprice` — Manually push price snapshot to channel
- `/sendai` — Generate and push new AI analysis
- `/sendall` — Push full bundle (Sticker + AI + F&G + Futures)
- `/sendmovers` — Push top gainers and losers
- `/sendfutures` — Push funding rates and open interest
- `/senddaily` — Push daily market report
- `/sendvolume` — Push volume leaders
- `/sendtrending` — Push trending coins
- `/sendfng` — Push Fear & Greed index
- `/aiprompt` — Inject custom prompt for next AI analysis

---

## ⏱️ Automated Cron Schedule

The system uses Cloudflare Cron Triggers for fully autonomous operation:

**Every 30 Minutes** (`*/30 * * * *`)
- Fetches prices
- Checks custom user alerts
- Posts Market Snapshot

**Every 8 Hours** (`0 */8 * * *`)
- Posts the "Bundle"
- Starts with custom Sticker
- Followed by AI Analysis, Fear & Greed, and Futures Funding Rates

**3 Times Daily** (`0 9,15,21 * * *`)
- Posts Top Movers (Gainers & Losers)
- Based on Binance 24h ticker data

---

## 🚀 Deployment

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

### Step 3: Create KV Namespace

```bash
wrangler kv:namespace create ALERTS_KV
```

Add the output to your `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "ALERTS_KV"
id = "your-namespace-id"
```

### Step 4: Deploy the Worker

```bash
wrangler deploy
```

### Step 5: Set Telegram Webhook

```bash
curl -F "url=https://your-worker.subdomain.workers.dev/webhook" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

---

## 📡 HTTP Endpoints

### POST /webhook
Receives Telegram updates. No authentication required (secured by Telegram's secret token mechanism).

### POST /admin
Manual trigger endpoint. Requires `x-admin-secret` header.

**Example:**

```bash
curl -X POST \
  -H "x-admin-secret: YOUR_SECRET" \
  "https://your-worker.workers.dev/admin?type=ai"
```

**Available types:** `price`, `volume`, `daily`, `ai`, `trending`, `fng`, `futures`, `movers`, `all`, `alert`, `sticker`

### GET /debug
System health check and API diagnostics. Requires `x-admin-secret` header.

**Example:**

```bash
curl -H "x-admin-secret: YOUR_SECRET" https://your-worker.workers.dev/debug
```

---

## 🔧 Configuration

### AI Modes

- **Normal** — Standard professional analysis
- **Deep** — Institutional-grade analysis with trend structure and sector rotation
- **Short** — Only trend direction, risk level, and 1 actionable insight
- **Emotion** — Analysis matches current market emotion state

### Scenarios

- **Bullish** — Emphasize breakout potential and altseason signals
- **Bearish** — Emphasize capital flight to safety and support levels
- **Neutral** — Balanced view, no directional bias
- **Volatile** — High volatility expected, emphasize risk management

---

## 📊 Data Sources

### Primary: CoinGecko API
- Full market data
- 7d/30d price changes
- Trending coins
- Categories

### Fallback 1: CoinMarketCap API
- Latest quotes
- Global metrics
- Trending coins

### Fallback 2: Binance API
- 24h ticker data
- Top gainers/losers
- Futures data (funding rates, open interest, long/short ratio)

### Sentiment: Alternative.me
- Fear & Greed Index

---

## 🎨 UI Features

- **Modern HTML Formatting:** Clean Telegram HTML with blockquotes
- **Visual Progress Bars:** For Fear & Greed index
- **Color-Coded Changes:** 🟢 Green for gains, 🔴 Red for losses
- **Tiered Display:** Organized coin listings by market cap tier
- **Sticker Integration:** Auto-sends custom sticker before bundle posts
- **Inline Keyboards:** Interactive admin control panel

---

## 🛡️ Security Features

- **Admin Authentication:** Secret header for HTTP endpoints
- **User ID Verification:** Admin-only commands protected
- **Rate Limiting:** Circuit breakers prevent API quota exhaustion
- **Input Sanitization:** HTML escaping for user-generated content
- **Deduplication:** Prevents spam and race conditions

---

## 📈 Performance Optimizations

- **Timeout Protection:** All fetches capped at 15-25 seconds
- **Parallel Requests:** Uses `Promise.all()` for concurrent API calls
- **Caching:** AI responses cached for 1 hour
- **Sticker Caching:** File IDs cached for 30 days
- **Smart Retry Logic:** Exponential backoff for failed requests

---

## 🐛 Troubleshooting

### AI Analysis Fails
- Check Gemini API key is valid and has quota
- Verify OpenRouter API key if using fallback models
- Check `/debug` endpoint for detailed error messages

### Messages Not Posting
- Ensure bot is admin in the channel with "Post Messages" permission
- Verify `TELEGRAM_CHANNEL_ID` is correct
- Check `/debug` for channel access status

### Price Data Missing
- Verify at least one API key is configured (CoinGecko, CMC, or Binance)
- Check API rate limits
- Review worker logs for specific error messages

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) — Serverless runtime
- [Telegram Bot API](https://core.telegram.org/bots/api) — Messaging platform
- [CoinGecko](https://www.coingecko.com/) — Cryptocurrency data
- [CoinMarketCap](https://coinmarketcap.com/) — Market data
- [Binance](https://binance-docs.github.io/apidocs/) — Exchange data
- [Google Gemini](https://ai.google.dev/) — AI models
- [OpenRouter](https://openrouter.ai/) — AI model routing

---

<div align="center">

**TradeAgent IV** · AI Crypto Intelligence · Built for the decentralized future

[Report Bug](https://github.com/your-username/tradeagent-iv/issues) · [Request Feature](https://github.com/your-username/tradeagent-iv/issues)

</div>
```
