- https://t.me/TradeAgentIV

```markdown
# 🚀 TradeAgent IV HYBRID

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-F69652?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![AI Powered](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenRouter-blueviolet?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)]()

**TradeAgent IV HYBRID** is an advanced, serverless, AI-powered cryptocurrency market intelligence system. Designed as a Cloudflare Worker, it automates Telegram channel posting, provides real-time market analysis, and features a proprietary "Emotion Engine" to gauge market sentiment. 

Built with a **100% free AI tier architecture**, it leverages multi-tier API failovers to ensure maximum uptime without incurring infrastructure costs.

---

## ✨ Key Features

### 🧠 Advanced AI Intelligence
* **Multi-Model Failover:** Automatically cascades through Gemini 3.5 Flash → 3.1 Flash-Lite → 2.5 Flash → OpenRouter FREE models.
* **Bilingual Output:** Generates comprehensive English market analysis followed by a dense, optimized Persian (Farsi) summary.
* **Custom Prompts:** Admins can inject custom contexts or focus areas directly into the AI analysis.

### 📊 3-Tier Coin Tracking System
* **Tier 1 (Blue Chips):** BTC, ETH, SOL, XRP, BNB, XAUT.
* **Tier 2 (Utility & L2s):** ADA, LINK, AVAX, SUI, HBAR, POL, INJ, ARB, OP, ATOM, TON, DOT, LTC, NEAR, APT, UNI, TRX, HYPE.
* **Tier 3 (Meme & AI):** SHIB, DOGE, PEPE, WIF, BONK, TAO, FET, RENDER.

### 🎭 Proprietary Emotion Engine
Calculates real-time market psychology based on BTC/ETH price action, Fear & Greed Index, and BTC Dominance.
* **States:** 💀 PANIC · 😰 FEAR · 😐 NEUTRAL · 🔥 MOMENTUM · 🚀 BREAKOUT · 🧨 FOMO
* Dynamically adjusts AI tone, risk warnings, and visual indicators based on the calculated emotion.

### 🔄 Bulletproof Architecture
* **Multi-API Failover:** CoinGecko → CoinMarketCap → Binance for price data.
* **Smart Deduplication (v3):** Prevents spam with a 10-minute gap, 5-minute lock, and race-condition proofing.
* **Circuit Breakers:** Automatically trips and bypasses failing AI models to prevent quota exhaustion.
* **Serverless:** Runs entirely on Cloudflare Workers with KV storage for state management.

---

## 🛠️ Tech Stack

* **Runtime:** Cloudflare Workers (JavaScript/ES Modules)
* **Storage:** Cloudflare KV (Snapshots, Dedup locks, AI Cache, User States)
* **Data Providers:** CoinGecko API, CoinMarketCap API, Binance API, Alternative.me (F&G)
* **AI Providers:** Google Gemini API, OpenRouter API
* **Messaging:** Telegram Bot API (HTML Parse Mode, Inline Keyboards, Webhooks)

---

## ⚙️ Environment Variables

To deploy, configure the following variables and bindings in your Cloudflare Worker settings:

### Secrets & API Keys
| Variable | Description |
| :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot API token. |
| `TELEGRAM_CHANNEL_ID` | The ID of the target Telegram channel (e.g., `@mychannel` or `-100...`). |
| `ADMIN_ID` | Your Telegram User ID (for admin panel access). |
| `ADMIN_SECRET` | A secure string for authenticating `/admin` HTTP requests. |
| `COINGECKO_API_KEY` | CoinGecko Demo/Pro API key. |
| `CMC_API_KEY` | CoinMarketCap Pro API key. |
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini models. |
| `OPENROUTER_API_KEY` | OpenRouter API key for fallback free models. |

### KV Namespace Binding
| Binding Name | Description |
| :--- | :--- |
| `ALERTS_KV` | Cloudflare KV Namespace used for caching, deduplication, and state storage. |

---

## 🤖 Bot Commands

### 👤 User Commands
| Command | Description |
| :--- | :--- |
| `/start` | Open the main interactive menu. |
| `/price` | Live 3-Tier market snapshot. |
| `/volume` | Top 10 coins by 24h trading volume. |
| `/daily` | Comprehensive daily market report. |
| `/trending` | Currently trending coins on CoinGecko/CMC. |
| `/fng` | Fear & Greed Index with visual progress bar. |
| `/alerts` | Configure custom price alerts (Above/Below). |
| `/settings` | View current bot configuration and API status. |
| `/help` | List all available commands. |

### 🛡️ Admin Commands
| Command | Description |
| :--- | :--- |
| `/admin` | Open the interactive Admin Control Panel. |
| `/sendprice` | Manually push a price snapshot to the channel. |
| `/sendai` | Generate and push a new AI analysis. |
| `/sendall` | Push the full bundle (Sticker + AI + F&G + Futures). |
| `/sendmovers` | Push top gainers and losers. |
| `/aiprompt` | Inject a custom prompt for the next AI analysis. |

---

## ⏱️ Automated Cron Schedule

The system utilizes Cloudflare Cron Triggers for fully autonomous operation:

* **Every 30 Minutes (`*/30 * * * *`):** Fetches prices, checks custom user alerts, and posts the Market Snapshot.
* **Every 8 Hours (`0 */8 * * *`):** Posts the "Bundle" — Starts with a custom Sticker, followed by AI Analysis, Fear & Greed, and Futures Funding Rates.
* **3 Times Daily (`0 9,15,21 * * *`):** Posts Top Movers (Gainers & Losers) based on Binance 24h ticker data.

---

## 🚀 Deployment

1. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   ```
2. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```
3. **Create KV Namespace:**
   ```bash
   wrangler kv:namespace create ALERTS_KV
   ```
   *(Add the output to your `wrangler.toml`)*
4. **Deploy the Worker:**
   ```bash
   wrangler deploy
   ```
5. **Set Telegram Webhook:**
   ```bash
   curl -F "url=https://your-worker.subdomain.workers.dev/webhook" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
   ```

---

## 📡 HTTP Endpoints

* `POST /webhook` — Receives Telegram updates.
* `POST /admin` — Manual trigger endpoint (Requires `x-admin-secret` header).
  * Example: `curl -X POST -H "x-admin-secret: YOUR_SECRET" "https://your-worker.workers.dev/admin?type=ai"`
* `GET /debug` — System health check and API diagnostics (Requires `x-admin-secret` header).

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">
  <i>TradeAgent IV · AI Crypto Intelligence · Built for the decentralized future.</i>
</p>
```

## 📝 License

MIT License. Use it, modify it, and make it yours.

**Made with ❤️ for the Crypto Community**
