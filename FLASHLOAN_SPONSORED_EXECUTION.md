# Sponsored flashloan execution

The engine supports four economic execution modes:

1. **relayer_reimbursed (A-plan)** — a relayer signs and fronts native gas; the receiver atomically reimburses the relayer in the arbitrage asset only after flashloan repayment and minimum-profit checks pass.
2. **paymaster (B-plan)** — an ERC-4337 Paymaster fronts UserOperation gas. The Paymaster must be independently funded and integrated with an account abstraction EntryPoint. This repository models the economic gate but does not claim a live Paymaster deployment.
3. **builder_bundle (C-plan)** — an external builder/MEV inclusion path may provide alternative inclusion economics. Availability and acceptance are external conditions; the engine never assumes free inclusion.
4. **self_funded (fallback)** — conventional native-balance execution.

## Zero user balance condition

A zero user native balance can be compatible with A-plan/B-plan because another party fronts gas. It does **not** make gas disappear. Every successful on-chain transaction still has an economic gas cost.

The A-plan contract invariant is:

`final_asset_balance >= flashloan_repayment + sponsor_fee + minimum_profit`

If the invariant fails, the entire transaction reverts and the sponsor fee is not paid. This makes gas reimbursement conditional on an actually profitable atomic execution.

## Production boundary

The code is production-oriented and testable, but live execution is not claimed until all external prerequisites are real and verified: deployed receiver, approved route executor, funded relayer/paymaster, RPC access, signer, live liquidity, and a successful on-chain receipt.

No private keys belong in this repository.
