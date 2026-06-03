- @TradeAgentIV

# 🚀 TradeAgent IV — AI-Powered Crypto Intelligence

**An un-sleeping, intelligent crypto assistant that watches the market 24/7, analyzes trends with AI, and delivers daily intelligence directly to your Telegram channel.**

Built on **Cloudflare Workers**, TradeAgent IV is designed to be fast, reliable, and completely serverless. It doesn't just fetch prices; it understands the market.

---

## ✨ Key Features

- 🧠 **AI Market Analysis:** Uses **Gemini 2.0 Flash Lite** to generate daily Persian market intelligence based on real-time data.
- 🛡️ **Smart Failover System:** Never misses a beat. If CoinGecko fails, it switches to CMC, then Binance, then CoinCap automatically.
- 📊 **Live Market Reports:** Price, Volume, and Daily Intelligence reports with beautiful HTML formatting.
- 🚨 **Custom Alerts:** Set "Above" and "Below" price thresholds for BTC, ETH, and SOL.
- 🔥 **Trending Coins:** Daily updates on the hottest coins in the market.
- 🧠 **Fear & Greed Index:** Visual market sentiment tracking.
- ⏰ **Automated Cron Jobs:** Scheduled reports without manual intervention.
- 💾 **Stateful Storage:** Uses Cloudflare KV to remember alert states and historical data for AI comparison.

---

## 🏗️ Architecture

| Component | Technology |
| :--- | :--- |
| **Runtime** | Cloudflare Workers (Edge) |
| **Database** | Cloudflare KV (Key-Value) |
| **AI Engine** | Google Gemini 2.0 Flash Lite |
| **Data Sources** | CoinGecko, CoinMarketCap, Binance, CoinCap |
| **Messaging** | Telegram Bot API |

---

## ⚙️ Environment Variables

Set these in your Cloudflare Worker settings:

| Variable | Description | Required? |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot Token from @BotFather | ✅ Yes |
| `TELEGRAM_CHANNEL_ID` | The ID of your Telegram Channel (e.g., `@mychannel`) | ✅ Yes |
| `ADMIN_ID` | Your Telegram User ID (for admin access) | ✅ Yes |
| `ADMIN_SECRET` | A secret string for HTTP admin routes | ✅ Yes |
| `GEMINI_API_KEY` | Google AI API Key for Gemini | ⚠️ Optional (Falls back to standard report) |
| `COINGECKO_API_KEY` | CoinGecko Demo API Key | ⚠️ Optional |
| `CMC_API_KEY` | CoinMarketCap Pro API Key | ⚠️ Optional |
| `ALERTS_KV` | **KV Namespace Binding** (Name it `ALERTS_KV`) | ✅ Yes |

---

## 🚀 Setup & Deployment

1. **Clone the repo:**
   ```bash
   git clone https://github.com/ILIV007/TradeAgentIV.git
   cd TradeAgentIV
   ```

2. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   ```

3. **Create a KV Namespace:**
   ```bash
   wrangler kv:namespace create ALERTS_KV
   ```
   *Copy the `id` from the output.*

4. **Update `wrangler.toml`:**
   Add the KV binding and your secrets:
   ```toml
   [[kv_namespaces]]
   binding = "ALERTS_KV"
   id = "your-kv-namespace-id-here"

   [triggers]
   crons = ["*/30 * * * *", "0 15 * * *", "0 21 * * *"]
   ```

5. **Deploy:**
   ```bash
   wrangler deploy
   ```

6. **Set Webhook:**
   Visit: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-worker.workers.dev/webhook`

---

## 🤖 Bot Commands

### 📱 User Commands
| Command | Description |
| :--- | :--- |
| `/start` | Main menu & welcome message |
| `/price` | Live prices for BTC, ETH, SOL, BNB, XRP, TON |
| `/volume` | 24h Volume & Market Cap report |
| `/daily` | Full daily intelligence report |
| `/trending` | Top 10 trending coins |
| `/fng` | Fear & Greed Index (Market Sentiment) |
| `/alerts` | Manage price alerts |
| `/settings` | View bot configuration |

### 🛡️ Admin Commands
| Command | Description |
| :--- | :--- |
| `/admin` | Open the Admin Control Panel |
| `/sendprice` | Manually send price report to channel |
| `/sendvolume` | Manually send volume report to channel |
| `/sendai` | Manually trigger AI analysis |
| `/senddaily` | Manually send daily report |
| `/sendall` | Send all reports to channel |

---

## 🌐 HTTP Endpoints

| Route | Method | Description |
| :--- | :--- | :--- |
| `/webhook` | `POST` | Telegram Webhook receiver |
| `/admin` | `GET/POST` | Manual trigger (Requires `x-admin-secret` header) |
| `/debug` | `GET` | Status check & API connectivity test |
| `/` | `GET` | Welcome page with route info |

**Example Admin Trigger:**
```bash
curl -X GET "https://your-worker.workers.dev/admin?type=ai" \
  -H "x-admin-secret: YOUR_SECRET"
```

---

## ⏰ Cron Schedule

| Schedule | Task |
| :--- | :--- |
| `*/30 * * * *` | Every 30 minutes: Price Report + Alert Check |
| `0 15 * * *` | Daily at 15:00 UTC: AI Market Analysis |
| `0 21 * * *` | Daily at 21:00 UTC: Fear & Greed Index |

---

## 📝 License

MIT License. Use it, modify it, and make it yours.

**Made with ❤️ for the Crypto Community**
