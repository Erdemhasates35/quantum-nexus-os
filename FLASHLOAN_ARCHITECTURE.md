# Flash-loan / arbitrage architecture

## Scope
The engine separates opportunity discovery, exact economics, transaction planning and execution. A flash loan is atomic: principal plus fee must be repaid before the transaction completes or the transaction reverts.

## Supported research surfaces
- Ethereum / Polygon / Gnosis: Aave V3 transaction planning.
- Solana: Jupiter quote discovery and adapter boundary.
- Binance: market/account observation only. Binance API keys do not create an on-chain flash loan and cannot be used as a substitute for a DeFi lender.

## Economic gate
Net edge = gross executable spread - flash-loan fee - swap fees - gas - priority fees - slippage - other measured costs.
No route is classified executable unless the net edge exceeds the configured minimum.

## Eight differentiators
1. Decimal-exact cost accounting instead of binary floating-point P/L.
2. Chain-specific lender abstraction instead of one pseudo-universal transaction path.
3. Pre-trade economic proof before transaction construction.
4. Atomic repayment invariant in the EVM receiver.
5. Binance/CEX data explicitly separated from on-chain atomic execution.
6. Route calldata treated as data, not trusted executable source code.
7. Deterministic tests for zero, negative and positive-edge cases.
8. Full auditability: every opportunity can be represented as a structured economic record.

## What it is not
It is not a guaranteed-profit machine, not a zero-cost system, and not a claim that Binance API credentials provide flash-loan liquidity. Gas, priority fees, lender fees and adverse execution remain real costs. Live deployment requires chain-specific RPC, deployed receiver/executor contracts, funded transaction fees, protocol approvals and a controlled signer.
