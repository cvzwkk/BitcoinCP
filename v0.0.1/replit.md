# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **api-server** — Express API. Live multi-venue BTC order book feeds (Bitfinex, Coinbase, Kraken, OKX via WS; Uniswap/PancakeSwap via GeckoTerminal REST poll), microprice, multi-horizon predictor, paper trading engine (10Hz, multi-position one-per-horizon, $10 entries, autoTrade=on, vol-scaled SL/TP, time stop = horizon), AI insights/chat. Prediction tracker (`/api/predictions/*`) records each emitted prediction (sampled 1Hz/horizon), resolves at horizon expiry against current microprice, classifies as hit/miss/flat (FLAT_THRESHOLD_BPS=0.5), keeps 1-min rolling buckets (max 120) and last 5000 resolved per horizon. Plus: BTC on-chain data (`/api/btc/*` — mempool, blocks, fees, difficulty, stock-to-flow), wallets (`/api/wallet/*` — address lookup, BIP44/49/84/86 + multisig generation, balance scan, PSBT send via mempool.space; BIP86 sending intentionally disabled), Lightning (`/api/lightning/*` — bolt11 decode, LNURL/lightning-address resolution, lnurl-pay invoice request, network stats via mempool.space), on-chain assets (`/api/onchain/assets/:address` — Ordinals/BRC-20/Runes via Hiro). Note: Binance WS is geo-blocked from Replit infra (HTTP 451) so it was removed.
- **hft-btc** — React + Vite dashboard at `/`. 12 tabs: Live, Control, History, Accuracy (per-horizon hit/miss/flat counts, decisive accuracy, pie + stacked-bar + time-series charts via recharts, recent resolved list, reset), AI Assist, Stock-to-Flow (Plan-B model overlay), Mempool (tip/blocks/fees/difficulty), Address (lookup any BTC address), Create Wallet (single-sig BIP44/49/84/86 + multisig P2WSH/P2SH-P2WSH/P2SH), Open / Send (load wallet from mnemonic, scan UTXOs, sign & broadcast PSBT — testnet recommended), Lightning (network stats, bolt11 decode, LNURL/lightning-address pay invoice generation), Assets (Ordinals/BRC-20/Runes at any address). Polls snapshot 4Hz.
- **mockup-sandbox** — design canvas (unused for this build).
