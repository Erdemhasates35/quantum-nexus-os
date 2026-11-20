# Quantum Nexus Flashloan Engine

Four historical entrypoints are preserved and delegate to one maintained engine:
- `nexus_flashloan.js`
- `nexuss_flashloan.js`
- `nexusss_flashloan.js`
- `nexussss_flashloan.js`

## Setup
```sh
cd flashloan
npm install
cp .env.example .env
```

Set `SOLANA_RPC_URL`, `TEST_PRIVATE_KEY_B58`, and the borrow/risk parameters in the private local `.env`. The SDK uses Jupiter Lend's on-chain flashloan builder and Jupiter Swap API v2 `/build` to create two actual routes (asset → intermediate → asset). It checks the conservative return, protocol fee, slippage and price impact before compiling the atomic transaction.

## Modes
- `EXECUTION_MODE=simulate`: signs with the test wallet and runs a real Solana RPC simulation. It never submits.
- `EXECUTION_MODE=live`: requires `LIVE_PRIVATE_KEY_B58`, `ENABLE_LIVE_EXECUTION=true`, and `ALLOW_MAINNET_EXECUTION=true`; only then submits the simulated atomic transaction and waits for finalized confirmation.

The engine does not generate synthetic quotes, balances, profit, or agent activity. If conservative return does not exceed the configured profit threshold plus fee buffer, the decision is `NO_TRADE`. A NO_TRADE result is a real risk-gate decision, not a simulated profit claim.

The vendored `bigint-buffer` replacement uses bounds-checked pure JavaScript conversions; `toml`, `stream-json`, and `jayson` are pinned to audited releases. `npm audit --audit-level=high` is part of the verification gate.

The SDK and router must be reachable and the configured wallet must have enough SOL for fees and required accounts. A live settlement is reported only after finalized confirmation.
