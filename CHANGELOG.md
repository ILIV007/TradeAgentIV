# Changelog

All notable changes to TradeAgent IV are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [6.1.12] — 2026-11-13

### Fixed — flagship AI drafts truncated at the 4096-token cap
- **The 13:00 flagship on 2026-11-13 ran but its draft was rejected**: missing exactly the tail sections (INVALIDATION + PERSIAN) and the invalidation line, while the head (verdict, drivers, scenarios, grounded numbers) was fully valid — the signature of an output cut off at `max_tokens: 4096`. The retry hit the same cap and failed identically. (Same day, the diet worked: macro 08:00, brief 09:30 and movers 12:30 all landed for the first time in days — the silent-miss problem is fixed; this was the AI-output problem underneath it.)
- **Output ceiling raised 4096 → 8192** for Groq, OpenRouter and Gemini direct (all support >=8192 output tokens; Workers AI stays at 4096, the Qwen3-30B cap — and it is unbound in production anyway).
- **Truncation is now visible**: in raw mode a non-empty draft with `finish_reason: 'length'` (OpenRouter/Groq) or `finishReason: 'MAX_TOKENS'` (Gemini) records a `truncated at max_tokens` failure reason instead of passing silently.
- **The failure notice now carries the cause**: AI failure reasons + the rejected draft's length, and the full rejected draft is kept in KV (`flagship:lastRejected`, 7d TTL) with its errors and provider, so the next failure is diagnosable from the notice alone.
- Tests: 51/51 green (1 new: a truncated head-only draft via OpenRouter with `finish_reason: 'length'` posts nothing, notifies with 'truncated' + draft length, keeps the draft in KV, and asserts the 8192 request cap).

## [6.1.11] — 2026-11-12

### Fixed — CPU diet for the free-plan 10ms cron budget
- **The warm flagship tick measured ~14–19ms of CPU against the 10ms free-plan Cron Trigger budget** (docs + profiling, 2026-11-12) — price phase first (~4ms) so it always lands, the kill lands in the first post-price compute. Three wastes cut, expected saving ~7–8ms → tick ~6–8ms:
  1. **DefiLlama stablecoins dropped** (`getDefi` fetches chains TVL only): the ~435KB payload cost ~4–5ms of parse per tick for two lightly-weighted regime inputs. `stableSupply`/`stableDelta7dPct` stay null; every consumer null-guards (regime, AI prompt line now omits the segment when null, rich table shows —, grounding corpus filters the 0s).
  2. **Lazy classic fallback**: `sendRich` now takes the fallback as a thunk and builds it only when rich is off or the rich send fails. Building it eagerly cost ~1.4ms on every price tick.
  3. **Watcher reuses the shared macro**: `checkMacroEvents` takes `shared.macro` when the tick passes the shared state instead of re-fetching + re-parsing the FF calendar (~1.5–2ms). Manual `/admin watch` (no shared state) still fetches.
- Also cached: `Intl.NumberFormat` instances behind `fmt.price` (~100 calls/tick) and the Tehran `DateTimeFormat` behind `tehranParts` — identical output, verified by test.
- Tests: 50/50 green (5 new: no stablecoins fetch + regime still computes; prompt has no literal null; lazy fallback built 0x on rich success / 1x on failure; watcher makes no calendar fetch with shared state; fmt.price output identical). One old test updated to the new contract (stable fields null by design).

## [6.1.10] — 2026-11-12

### Added — PV copy for manual sends (owner rule, 2026-11-12)
- **A post sent to the channel manually is now also delivered to the admin PV.** Manual surfaces: panel buttons, `/send*` commands, custom-prompt AI sends, admin resend, and the `/admin` HTTP trigger. The cron path never copies. Mechanism: each `sendChannel*` sender returns the Telegram result (`message_id`); manual call sites pass it to `copyToAdmin` (new helper in `src/telegram.js`), which issues `copyMessage` from the channel to `ADMIN_ID`. Copy failures are logged only and can never fail the send itself. Verified live before shipping: `copyMessage` of the 22:09 manual flagship (msg 11943) to the admin PV returned 200. `sendChannelAll` returns the array of sent results so every post in a bulk send is copied; the sticker is not copied.

## [6.1.9] — 2026-11-12

### Fixed — silent flagship miss, third in a row (21:00, 2026-11-12)
- **The 21:00 flagship missed AGAIN after v6.1.8 — only the price snapshot posted, third consecutive miss (2026-11-11 21:00, 2026-11-12 13:00 + 21:00).** A full-tick replay of the shipped v6.1.8 code (bad CoinGecko night + production AI failure pattern) totals **40 subrequests, under the 50 cap**, posts the snapshot AND sends the admin failure notice — so the cap theory does not explain this miss, and the AI chain is exonerated again (it would have notified). Two silent paths remain, both console-only:
  1. **`scheduledTime` shape:** a seconds-epoch value replays as hm `21:58`, so `cronDispatch` returns `[]` and every product misses while the price snapshot posts. `normalizeTickTs` now accepts ms epoch, seconds epoch, ISO/numeric strings, and falls back to the wall clock on garbage.
  2. **Dispatch catch:** any throw inside a dispatched job died in `console.error` only. The catch now also calls `notifyAdmin`, so a dispatch failure reaches the admin PV with the job name, tick time and error.

## [6.1.8] — 2026-11-12

### Fixed — one Market State build per tick (subrequest cap)
- **Flagship 13:00 (and brief 09:30, macro 08:00) on 2026-11-12 still missed after the v6.1.7 dispatch fix, with a completely empty admin PV.** Root cause, measured with the real code: one `buildMarketState` costs ~23 subrequests (12 data sources, `api()` retries 3× on failure), and the tick rebuilt it per product — price (23) + watcher + flagship rebuild (23) + AI chain (6) = **55 fetches on a healthy tick, 69 with CoinGecko 429s — over the free-plan 50-subrequest cap**. Past the cap every `fetch()` throws, so the flagship's second build died inside the dispatch catch (no post, no notify — the notify fetch itself was over budget too), while the price post, first in the tick, always survived. Live worker verified v6.1.7 via its root endpoint, so this was not a stale deploy.
- The `*/30` tick now builds the Market State **once** in `handleCron` and shares it with the snapshot, the macro watcher and every dispatched product (senders take an optional shared state; panel/manual sends still build their own). Healthy flagship tick: ~32 subrequests, with headroom for retries and fallbacks.

## [6.1.7] — 2026-11-12

### Fixed — dispatch keyed on the cron's scheduled time
- **Flagship 21:00 on 2026-11-11 never dispatched.** `handleCron` ran `sendChannelPrice` + `checkMacroEvents` BEFORE `cronDispatch(tehranParts())`, and `tehranParts()` defaults to `Date.now()` while `cronDispatch` matches `hm === '21:00'` exactly — a tick overrunning the minute boundary silently skipped its product (no log, no notify). The PV had no AI error, proving the chain never ran.
- Dispatch now uses `event.scheduledTime` (Cloudflare's scheduled fire time for the tick) instead of the post-send wall clock, plus a `[CRON] Dispatch tick` log line. Regression test replays the exact 2026-11-11 21:00 tick.

## [6.1.6] — 2026-11-11

### Fixed — AI provider architecture
- **Cross-infrastructure chain.** v6.1.4 put three of five slots on Gemini, so one failure mode (egress geo-block 400 «User location is not supported», capacity 503s, timeouts) sank the whole run — both failure reports on 2026-11-11 show exactly that. The chain is now: Workers AI → Gemini 3.5 Flash-Lite → Groq → OpenRouter Nemotron → Gemini 3.6 → OpenRouter (Gemma 4 31B → free router). Gemini 3.8 removed (documented capacity collapse, never succeeded in production).
- **Workers AI provider** (`@cf/qwen/qwen3-30b-a3b-fp8`, catalog-verified): runs on the same platform as the Worker, so it cannot be geo-blocked. Activates automatically when the `AI` binding is added in the dashboard; skipped silently until then.
- **Groq provider** (`llama-3.3-70b-versatile`, catalog-verified): activates automatically when the `GROQ_API_KEY` secret is set; skipped silently until then.
- **Geo-block memo:** one Gemini «User location is not supported» 400 marks Gemini blocked for 30 minutes; later Gemini steps skip instantly instead of burning the deadline.
- **OpenRouter empties fixed:** response extraction now handles string content, array-of-parts content and errors embedded in 200 bodies (shared with Groq); Nemotron's reasoning is tamed (`effort: low, exclude: true`) — at the old 1500-token cap its chain-of-thought consumed the whole budget and the answer came back empty.
- **Token budgets:** 1500 → 4096 output tokens on Gemini, OpenRouter and the new providers (the bilingual analysis plus Gemini 3.x thinking no longer truncates mid-format; MAX_TOKENS/length finishes are now named in the failure diagnostics).
- **Validator judges content, not dialect:** drafts are normalized (markdown `**bold**`, `##` headings and bare heading lines become canonical sections) before the section/conclusion checks — a Gemini 3.6 draft was rejected with «only 1 section» purely for answering in markdown.

## [6.1.5] — 2026-11-03

### Added
- **Rich Mode toggle in the admin panel** (System section): one tap switches every rich-capable post between the rich format and the classic format (config key `rich_mode`, honored centrally by `sendRich`; the panel header shows the current state).
- **Rich variant of the legacy AI analysis post**: panel `/sendai`, custom-prompt sends and the Send All bundle previously delivered this post in the classic format only — it now renders rich (section headings, native key-metrics table, Persian summary in an expandable quote) with the classic text kept as fallback.

## [6.1.4] — 2026-11-03

### Changed
- **AI fallback chain rebuilt** (deep-research-backed, report 2026-11-03): the primary is now **Gemini 3.5 Flash-Lite** (fastest, ~500 free req/day) instead of Gemini 3.8 Flash, whose documented Oct–Nov 2026 capacity collapse (late 503s, requests hanging to client timeouts, ~25s TTFT even when healthy) was the root cause of the «AI analysis failed» admin alerts. New order under one ~75s global deadline: 3.5 Flash-Lite (15s) → 3.6 Flash (12s, thinking low) → OpenRouter Nemotron (18s) → 3.8 Flash (remaining budget, thinking low) → openrouter/free. The AI Status panel test now exercises the Lite primary.

### Removed
- **Gemini 2.5 Flash** (deprecated 2026-11-02; 404 for new projects, auto-routes to Flash-Lite from Dec 1) and the dead OpenRouter free models **gemma-4-31b-it:free** (upstream 429, 0/7 days in live probing) and **inkling:free** (403 for plain API calls, retiring Nov 4).

## [6.1.3] — 2026-11-03

### Changed
- **AI failure notifications now say why**: when the legacy AI post or the Flagship fails and the channel stays silent, the admin notification lists one short reason per provider/stage — e.g. `gemini-3.8-flash: HTTP 429 …`, `gemini-3.6-flash: circuit open`, `gemini-2.5-flash: invalid response (only 1 section)`, `openrouter …: HTTP 500 …` — instead of a generic "failed" line. The Flagship notification appends its validation errors (or "AI returned no result" plus the provider reasons). Reason lines are HTML-escaped and capped at 8. No sending behavior changes — only the notification content.

### Fixed
- **Flagship and Event Flash never published end-to-end**: the AI result object (`{text, source}`) was passed to the validators and post builders instead of its text, and the legacy chain's format gate (≥3 `<b>` sections + Persian + conclusion) rejected the v6 `===SECTION===` draft format inside the provider chain — so every Flagship silently failed validation and every Event Flash fell back to the programmatic text. Both products (and the PV flagship preview) now call the chain in a new raw mode — no legacy format gate, no legacy cache — and are judged by their own validators as designed.

## [6.1.2] — 2026-11-02

### Changed
- **Persian posts are rich again**: the v6.1.1 classic-for-FA routing is reverted by owner decision — rich design for both languages, accepting minor bidi quirks in Persian. FA headings (snapshot verdict, flagship masthead) now lead with the Persian text so they can right-align.

## [6.1.1] — 2026-11-02

### Fixed
- **Persian rendering**: rich-message blocks keep LTR grids/alignment, which jumbled Persian text and never right-aligned lines starting with Latin tokens. In FA mode all posts now deliver as classic messages, whose paragraphs auto-detect RTL. The FA Morning Brief classic was rebuilt with the full content (majors, overnight movers, breadth, key levels, market totals, headline), Persian lines carry an RLM mark, and the FA flagship prompt now requires every line to begin with a Persian word.

## [6.1.0] — 2026-11-02

### Added
- **Channel language switch (English / فارسی)**: a language section at the top of the bot's admin panel (config key `lang`) switches EVERY channel post between English and full Persian — snapshot, brief, flagship (the AI writes the entire analysis natively in Persian), movers, macro calendar, event flash + polls, weekly, F&G, futures, alerts and the legacy AI post. Dates and the PV keyboards follow the selected language. Chart images keep English labels (QuickChart's font cannot shape Persian script).

### Changed
- **Admin panel rebuilt**: status header (version, channel language, auto-posts), the language switch, send-now buttons for every product (Price, Brief, Flagship, Macro Calendar, Movers, Weekly, Volume, Trending, F&G, Futures, legacy AI, All), plus the existing AI configuration and system sections. New admin commands: `/sendbrief`, `/sendflagship`, `/sendmacro`, `/sendweekly`. The main-menu "🧠 AI Analysis" button now returns a real flagship analysis in PV (it was dead).

### Fixed
- Alert toggle buttons in PV crashed on a missing import (`getAlertState`/`setAlertState` now exported from senders and imported by the bot).

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
