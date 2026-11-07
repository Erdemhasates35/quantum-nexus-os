# Quantum Nexus OS v16 — Swarm Execution Contract

This document defines the additive v16 swarm registry contract. It does not claim that an agent is live merely because it is listed.

## Topology

The core execution plane contains ten strategy clusters with three roles each (30 roles). Two cross-cutting groups add ten academic control roles and ten frontier research roles (50 roles total). The additional groups advise, audit, and optimize the ten core clusters; they do not submit transactions.

## Core clusters

| ID | Cluster | Agent 1 | Agent 2 | Agent 3 |
|---|---|---|---|---|
| S01 | Jito atomic arbitrage | Yellowstone Sentinel | SVM Simulator | Bundle Executor and Receipt Sync |
| S02 | Rent reclaim | Account Auditor | SPL Close Planner | Rent Reconciler |
| S03 | Liquidity migration research | Migration Watcher | Token Security Guard | Risk-Gated Execution Planner |
| S04 | Wallet graph intelligence | Graph Analyzer | Risk Assessor | Mirror Auditor |
| S05 | Token-2022 fee intelligence | Transfer Hook Monitor | Fee Harvester | Reward Allocator |
| S06 | Cross-DEX flash arbitrage | Pool Graph Path Finder | Verified Flash-Liquidity Planner | Atomic Settler |
| S07 | Relayer and fee abstraction | Signature Policy | Fee-Payer Risk | Versioned Transaction Dispatcher |
| S08 | Predictive volatility and margin | State Analyzer | Oracle Confidence | Margin Optimizer |
| S09 | Private orderflow and auction | Privacy Router | Bundle Auction Model | Leader Router |
| S10 | Autonomous liquidity rebalancing | Yield Hunter | Impermanent-Loss Guard | Compound Planner |

## Ten academic control roles

1. Market Data Provenance Auditor — validates source, timestamp, and freshness.
2. Microstructure Researcher — models spread, depth, impact, and queue position.
3. Counterfactual Simulator — evaluates scenarios without submitting transactions.
4. Portfolio Risk Scientist — enforces exposure, drawdown, and concentration limits.
5. Capital Efficiency Analyst — measures utilization and opportunity cost.
6. Transaction Forensics — reconciles signatures, instructions, and balance deltas.
7. Fee Calibration Scientist — estimates fees and tips from observed outcomes.
8. Protocol Compliance Auditor — checks program allowlists and instruction policy.
9. Telemetry Reliability Engineer — monitors event integrity, lag, and delivery.
10. Security Threat Analyst — reviews attack surface and credential handling.

## Ten frontier research roles

1. Cross-Chain Intent Researcher — evaluates settlement paths and bridge risk.
2. Intent Routing Optimizer — ranks solver quotes by execution quality.
3. MEV Auction Researcher — studies auction outcomes and bid efficiency.
4. Oracle Anomaly Detector — detects deviation, staleness, and manipulation.
5. Adaptive Hedging Researcher — models delta, gamma, and basis exposure.
6. Yield Quality Analyst — computes net yield after costs and protocol risk.
7. Wallet Reputation Analyst — analyzes public on-chain behavior and sybil signals.
8. Privacy Engineering Researcher — evaluates data minimization and proof systems.
9. Compute Budget Optimizer — optimizes measured compute and account locks.
10. Revenue Attribution Auditor — attributes realized profit and every cost.

## Execution state machine

DESIGNED -> CONNECTED -> OBSERVING -> ARMED -> SUBMITTED -> LANDED -> SETTLED

HALTED is reachable from every state when a risk, data-integrity, or authorization gate fails. A transition must be backed by an event and its evidence.

- A quote is an observation, not a trade.
- A successful simulation is not a submitted transaction.
- A Jito acknowledgement is not proof of landing.
- LANDED requires Jito bundle status plus on-chain signature confirmation.
- SETTLED requires finalized transaction evidence and reconciled token/native balance deltas.
- Unverified PnL is never displayed as realized revenue.

## Wallet connection contract

- Solana browser wallets use Wallet Standard discovery and signing; Phantom and Solflare are supported through that standard.
- MetaMask uses MetaMask Connect for EVM and Solana account sessions.
- Wallet connections expose public addresses and signing capabilities only.
- Optional test-key import is restricted to test clusters and in-memory client-side signing. Key material must never enter logs, telemetry, server requests, repository files, browser storage, or deployment variables.
- No automated transaction is signed or submitted without an explicit user-controlled authorization policy.

## Economic and scientific controls

The fine-structure constant is not a validated arbitrage threshold, tip optimizer, slippage guarantee, or profit predictor. It may be recorded as an experimental feature only. Trade admission must use decoded live pool state, executable quotes, fees, price impact, slippage bounds, transaction simulation, compute budget, tip cost, and a conservative expected-value threshold.

No daily ROI, zero-risk, zero-slippage, or guaranteed-landing claim is valid without a defined measurement window and reproducible on-chain evidence.

## Integration boundary

The existing Supabase private telemetry ingest is the canonical event bridge. New code must use its six supported event kinds and field allowlists. Do not create a parallel public telemetry table or weaken row-level security. Keep the existing database schema additive and preserve all existing records.

Yellowstone gRPC belongs in a long-running worker (Termux ARM64 or a dedicated compute host), not a short-lived browser request. Vercel serves the dashboard, authenticated control plane, and lightweight API routes. The worker publishes validated events to Supabase.

## Activation evidence

A role is operational only when its handler is implemented, configuration is present, health is observed, and a traceable evidence record exists. The registry count is not the active-agent count. Production activation requires passing build, static analysis, integration checks, and a controlled test-cluster execution with reconciled chain evidence.
