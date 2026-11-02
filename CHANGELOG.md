# Changelog

All notable changes to TradeAgent IV are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
