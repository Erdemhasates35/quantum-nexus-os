# Quantum Nexus Ecosystem Integration Baseline

## Purpose

This document establishes the non-destructive integration map for the Quantum Nexus production ecosystem. Existing repositories remain independent and are treated as source modules. No repository is deleted, flattened, or replaced.

## Primary source repositories

| Repository | Role | Integration decision |
|---|---|---|
| quantum-nexus-os | Existing Quantum Nexus application/core | Primary application baseline; preserve existing modules |
| quantum-nexus-unified-core | Unified core, swarm/edge/infra modules | Reuse proven interfaces and implementation patterns selectively |
| quantum-nexus-os-omega-admin | Admin/control-plane architecture | Reuse FastAPI, admin, observability, deployment patterns |
| honeycomb-execution-core | Go execution engine | Execution-domain reference and adapter source; Binance + Bitget Futures; paper/live mode contract |

## Honeycomb execution boundary

The Honeycomb core currently defines a Go execution service for Binance and Bitget Futures. Its documented default is paper mode and its HTTP control-plane boundary includes health, status, positions, logs, and order routes. The edge rule is based on net expected edge after fees, funding, slippage, spread, latency cost, and execution risk.

Quantum Nexus should consume that domain through a typed execution contract rather than duplicating order-routing logic in the web or mobile applications.

## Control-plane boundary

Web and Android applications are control clients. They communicate with the API/control plane. The execution engine remains a separate runtime so Termux/mobile orchestration can be lightweight while Linux x64 execution remains available for the production worker path.

## Canonical contracts

1. `ExecutionMode`: `paper | live`
2. `Exchange`: `binance | bitget`
3. `OrderIntent`: symbol, side, order type, quantity, price, leverage, client order id
4. `OrderResult`: accepted/rejected, normalized status, exchange order id, client order id, reason
5. `PositionSnapshot`: exchange, symbol, side, size, entry price, mark price, unrealized PnL
6. `HealthSnapshot`: API, execution engine, market data, persistence, event stream
7. `PaperConfig`: fee, slippage, spread, latency, fill model

## Runtime targets

- Web control plane: Vercel-compatible Next.js deployment
- API: FastAPI-compatible service
- Execution: Go/Linux x64 Honeycomb core
- Mobile: Expo/React Native Android client
- Termux: lightweight operator/worker client and paper runner where practical
- Persistence: PostgreSQL/Supabase-compatible data layer
- Eventing: Redis Streams when available; HTTP/local fallback for development and Termux

## Non-destructive integration rule

When a source repository contains a stronger implementation, copy/adapt the implementation into the target module while retaining the original repository and its history. Prefer additive adapters, shared contracts, compatibility wrappers, and migration layers over destructive rewrites.

## Current source evidence

- `quantum-nexus-os-omega-admin` documents a React/Vite frontend, FastAPI gateway, PostgreSQL/Redis/Qdrant data layer, and observability stack.
- `quantum-nexus-unified-core` identifies itself as a unified monorepo containing Swarm, Solana, Edge Runtime and Infra modules.
- `honeycomb-execution-core` documents Binance + Bitget Futures execution with paper mode as default and a control-plane HTTP interface.

## Production progression

`integration -> build -> test -> deploy -> online verification -> paper operation -> live readiness`

Live execution is a separate operator-controlled stage. This repository integration pass prepares the contracts and infrastructure without pretending that a live exchange connection exists before credentials and runtime configuration are actually supplied.
