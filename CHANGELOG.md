# Changelog

All notable changes to TradeAgent IV are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [6.0.0] — 2026-11-02

The market-desk release: the bot now builds one unified picture of the market and reasons over it.

### Added
- **Market State layer** (`src/state.js`): every cycle assembles prices, global metrics, Fear & Greed (today + yesterday), Binance funding, Deribit open interest + DVOL, mempool.space fees/hashrate, DefiLlama TVL + stablecoin supply/flows, the ForexFactory calendar (Tehran-day bucketing, next high-impact, week ahead) and keyword-filtered RSS headlines into one structured object, persisted to KV (`state:latest` + hourly history). Every source is fail-soft; prices remain the only hard requirement.
- **Regime Engine v2**: a purely computational regime (RISK_ON / RISK_OFF / RANGE / SQUEEZE_RISK / CAPITULATION / EUPHORIA) with a 0–100 score and its top numeric drivers — printed on posts and fed to the AI so tone follows the data.
- **Rich delivery**: channel posts are sent rich-first (`sendRichMessage`, Bot API 10.1+) with automatic fallback to the classic HTML format. The price snapshot uses the approved design: a content-rich BTC chart (labeled axes + average line), verdict heading, native tier tables (Tier 1 open, long tiers in labeled collapsibles), and the classic quote footer.
- **Flagship Analysis** (13:00 + 21:00 Tehran, replaces the 8-hourly AI bundle) — the channel's only analysis post: verdict, overview, three ranked drivers, a market-in-numbers table rendered from the state, three data-triggered scenarios (Base/Bull/Bear), a mandatory invalidation line, and the Persian summary folded into an expandable quote. Charts belong to the price post only; every other post is informational. A **numeric grounding validator** rejects any draft containing a figure that does not exist in the Market State — a rejected draft is rewritten once, then the channel stays silent.
- **Morning Brief** (09:30 Tehran): overnight moves, regime, and real BTC key levels from the 7-day series.
- **Macro Calendar** (08:00 Tehran): a dedicated daily ForexFactory post — today's releases at Tehran times with forecast/previous (actuals when printed), high-impact marked, low-impact folded.
- **Macro Watch + Event Flash**: ~75 minutes before a high-impact print the channel gets a watch post and an event poll; minutes after the release, an Event Flash with actual vs forecast vs previous closes the loop. A once-a-day spike poll fires on ±5% BTC days.
- **Weekly Deep Dive** (Friday 20:00 Tehran): a 7d top-movers chart, week performance for all 32 coins, the regime path, next week's calendar — and a **scenario scorecard** grading the week's own flagship calls (triggers fired + 24h follow-through) from the recorded scenario ledger.
- **Top Movers** posts are rich now, with a market-wide 24h bar chart (top gainers/losers) above the tables.
- **Scheduling**: the cron pattern count is unchanged from production (3). The v6 products ride the existing 30-minute pattern, dispatched by Tehran clock (calendar 08:00, brief 09:30, flagship 13:00/21:00, weekly Fri 20:00, macro watcher every tick).

### Changed
- The 8-hourly bundle keeps its sticker + F&G + futures posts; the AI analysis moves to the flagship slots.
- Version unified at 6.0.0.

## [5.1.0] — 2026-11-02

Final release of the 5.x line — ships the full overhaul described under 5.0.0 below (developed as 5.0.0, released as 5.1.0).

The channel-strategy expansion — Macro Watch (ForexFactory calendar), market-moving RSS news, event-anchored polls, chart images, on-chain context, and a redesigned AI analysis system that reasons over a unified market-state — is planned as **v6.0.0** (see the v6 plan).

## [5.0.0] — 2026-11-02

Full overhaul (repo, code, and posts).

### Added
- Test suite (`node:test`, 14 tests) and a GitHub Actions CI workflow.
- `AGENTS.md` with the project's product contracts.
- Snapshot context line (BTC dominance + Fear & Greed), best/weakest line, 7d change for Tier 2/3, Tehran-time headers on channel posts.
- Trending posts now show live prices; Fear & Greed shows yesterday's value and delta.
- Futures post covers 6 symbols and shows open-interest change vs the last snapshot.
- Optional `TELEGRAM_WEBHOOK_SECRET` verification for the webhook.

### Changed
- Split the 2,472-line `src/index.js` monolith into focused modules (`config`, `utils`, `data`, `ai`, `store`, `telegram`, `posts`, `senders`, `bot`, `index`).
- AI chain refreshed after a catalog audit: Gemini 3.8 Flash → 3.6 Flash → 2.5 Flash → live-verified free OpenRouter models (the previous OpenRouter free list was 6/7 retired). Fresh, shorter analysis prompt with five hard rules and a worked example.
- Top Movers now scans the whole Binance USDT market (volume-filtered, stable/leveraged pairs excluded) instead of only the 32 tracked coins; tracked coins are ⭐-marked.
- Price alerts became percentage-move alerts (±5% BTC/ETH, ±7% SOL on 24h change) — absolute thresholds silently went stale.
- AI failure no longer posts a fallback report to the channel: the bot stays silent and notifies the admin in private chat.
- `wrangler.toml` worker name corrected to `tradeagentiv` (matches the deployed Worker); version unified across repo (was 2.5.0 in package.json vs 4.3.2 in code).

### Fixed
- Three tracked coins silently vanished from every post because their CoinGecko IDs were renamed: POL (`polygon` → `polygon-ecosystem-token`), INJ (`injective` → `injective-protocol`), WIF (`dogwifhat` → `dogwifcoin`). A missing-coin guard now logs any future rename loudly. Verified live: 32/32 coins return.
- Movers/Trending/Futures senders posted placeholder "data unavailable" messages to the channel when their source failed; they now stay silent.
- AI post printed BTC dominance as a raw float (`59.96618263803912%`) and an empty "Futures Pulse" heading when futures data was null.
- AI post sections and Persian bullets arrived glued together; the builder now separates them, and the Persian separator off-by-one is fixed.
- `buildAlert` had a `<<blockquote>` typo that broke alert HTML.
- "Yesterday" snapshots were overwritten by every AI run (every 8h); snapshots are now stored under dated keys.
- `fetchWithTimeout` never aborted the underlying fetch; it now uses `AbortController`.
- Send-all reported ✅ for sends that were actually dedup-skipped; it now reports skips honestly.
- Alert toggle buttons in private chat had no admin check and controlled channel-wide alerts; they are admin-only now.
- Plain chat text in private chat no longer gets an "Unknown command" reply; unknown *commands* still do.
- `/debug` no longer exposes the token preview, channel ID or admin ID; the 500 handler no longer returns stack traces; the Gemini API key is sent via header instead of the URL.
- Stale AI model names in logs/status (models were called "2.0 Flash" / "1.5 Flash-8b" while actually being 3.5 / 2.5) — names now match the models called.

## [4.3.2] — 2026-06-07

Last release of the single-file era (v4.3.2-FINAL): Gemini migration, 3-tier coins, Emotion Engine, dedup v3, sticker bundle.
