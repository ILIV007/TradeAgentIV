# AGENTS.md — TradeAgent IV

Guidance for AI agents (and humans) working on this repository. Read this before changing code; the behaviors below are product contracts set by the owner, not implementation details.

## What this is

TradeAgent IV is a free-tier crypto market intelligence bot running as a **single Cloudflare Worker**: scheduled posts to the Telegram channel `@TradeAgentIV` (price snapshot every 30 min, an 8-hourly bundle, movers 3×/day) plus a private-chat bot with an admin panel. Storage is one KV namespace, `ALERTS_KV`. No paid infrastructure.

## Commands

- `npm test` — syntax check for every file in `src/` + the `node:test` suite in `test/`. **Must pass before any PR.**
- Production deploys via Workers Builds on merge to `main`.

## Non-negotiable product rules

1. **The channel never receives error or placeholder posts.** If data for a post type is unavailable, the sender stays silent (log only). "No movers data available"-style messages are bugs, not fallbacks.
2. **Every displayed number goes through `fmt`.** Raw floats (e.g. an unrounded BTC dominance) must never reach a post.
3. **Coin list changes need ID verification.** CoinGecko IDs get renamed (polygon → polygon-ecosystem-token, injective → injective-protocol, dogwifhat → dogwifcoin). Verify each ID against the live CoinGecko API before adding it, and keep the missing-coin guard in `getCoins` — a renamed ID must log loudly, never silently drop a coin from posts.
4. **AI model changes only after a catalog audit.** Verify model IDs and free-tier status against the provider's official catalog (Google AI / OpenRouter) before touching the fallback chain. Model names in logs and status output must match the model actually called.
5. **No secrets or resource IDs in the repo.** Tokens and API keys live in Worker secrets only. The `ALERTS_KV` namespace id is deliberately **not** committed (public repo): the binding is managed in the Cloudflare dashboard; `wrangler.toml` carries only a placeholder comment.
6. **Admin-only actions stay admin-only.** Channel sends, AI config and alert toggles check `isAdmin` — including callback queries, not just commands.
7. **Free tier only.** Data and AI providers must stay within their free quotas; the cron schedule and dedup windows are part of that budget and must not be widened casually.

## Release flow

1. Work on a feature branch; keep `main` untouched until merge.
2. Bump the version in `package.json`, the header of `src/index.js`, and `README.md` together.
3. Open a PR; tests must be green.
4. Squash-merge; Workers Builds deploys from `main`. Verify `GET /` on the live worker after deploy.
5. Telegram/Cloudflare dashboard settings (bot admin in the channel, KV binding, secrets) are manual owner steps — code changes cannot set them.

## Style

Smallest complete diff. Reuse existing helpers before adding new ones. No new runtime dependencies without a strong reason. Keep the Persian plan/history documents in the owner's workspace (not this repo) as the record of product decisions.
