# OMNIQUANT CORE — integration boundary and release gates

## Implemented in this branch
- Provider-neutral typed observation and trade-intent contracts.
- Standalone, fail-closed risk policy evaluator with explicit kill switch, freshness, notional, exposure, daily-loss, leverage, slippage and liquidity checks.
- Deterministic unit tests for approval and rejection boundaries.

## Explicitly not implemented or certified
- No exchange/broker connectors, wallet signing, order routing, market-data subscription, custody, or live execution.
- No FinRL/Pythia/GPT-NeoX/Heretic model weights or source trees are copied or merged.
- No live-market backtest or paper-trading claim is made. No synthetic market performance is reported.
- No 24/7 service, failover cluster, cloud intelligence endpoint, UI, or revenue claim is certified.

## Mandatory production integration sequence
1. Inventory each source repository at commit/tree/file level; record ownership, license, fork ancestry, manifests, runtime, workflows, and test evidence.
2. Integrate through adapters and versioned contracts; preserve upstream provenance and avoid bulk source copying.
3. Connect live market-data providers with source timestamps, sequence numbers, gap detection, and independent freshness checks.
4. Feed account state from authenticated venue/broker read APIs; reject missing, stale, inconsistent, or unreconciled state.
5. Place the Guard service in a separate deployment and credential boundary. The execution service must independently verify signed, unexpired Guard approvals and enforce idempotency.
6. Only after venue-specific conformance tests, real-data quality checks, operational controls, security review, and explicit operator authorization may live order placement be enabled.

## No-simulation interpretation
Unit tests validate deterministic software contracts and policy boundaries; they are not trading backtests or evidence of profitability. No generated market path is used as performance evidence.
