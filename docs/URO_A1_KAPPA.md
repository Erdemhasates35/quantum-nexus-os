# URO A1 — Provenance-bound critical profitability threshold κ

## Maturity and boundary

Target maturity: L2 for the deterministic arithmetic and unit helpers after CI verification. The source-adapter layer, on-chain quote normalization, provider-program account decoders and execution reconciliation are not claimed to be live or production-active by this module.

The v16 UI, α glyph, historical α-Coupling documents, old backup files and existing telemetry identifiers remain untouched. The new κ calculation is an additive v17 layer. No physical-constant conversion or α-derived profitability threshold exists.

## Economic definition

All amounts are denominated in the exact same quote asset identity. For SPL assets, use the mint address plus cluster identity, not a display ticker alone. For EVM assets, use the chain ID plus contract address.

Let:

- Q = principal borrowed, in quote-asset units.
- s = gross executable route spread, in basis points, measured before explicit DEX fees and price impact.
- r_f = provider flash-loan fee rate, in basis points, if the provider quote supplies a rate.
- F_loan = exact flash-loan cost, in quote-asset units, if the provider calculates a rounded/raw-unit amount.
- F_dex = all route DEX/pool/creator/protocol fees, normalized to quote-asset units.
- S = expected adverse execution shortfall / price impact, in quote-asset units. This is not the user's maximum slippage tolerance.
- B = network base fee, in quote-asset units.
- P = Solana priority fee, in quote-asset units.
- T = Jito tip, in quote-asset units.
- X_j = separately evidenced additional quote-denominated costs, such as Token-2022 transfer fees or protocol-specific charges.

Exactly one flash-loan representation is used:

F_loan = Q × r_f / 10,000

or

F_loan = provider-quoted / program-calculated exact fee amount.

The calculation is:

E_gross = Q × s / 10,000

C_all = F_loan + F_dex + S + B + P + T + Σ X_j

κ = (E_gross − C_all) / C_all

s_BE = 10,000 × C_all / Q

κ is dimensionless. κ > 0 means the modeled gross edge exceeds the listed modeled costs; κ = 0 is break-even; κ < 0 means modeled costs exceed the modeled gross edge. κ is not a probability, a risk-adjusted expected value, an inclusion probability, a guarantee of landing, or an order authorization.

A finite κ requires Q > 0 and C_all > 0. The implementation rejects a zero denominator. The independent risk/authorization plane must still account for uncertainty, failed inclusion, retry policy, adverse selection, exposure limits and actual settlement.

## Preventing fee double counting

The gross spread supplied to this module is required to be pre-fee and pre-price-impact. If a routing quote has already deducted a pool fee, transfer fee or price-impact loss, the adapter must decompose the quote and avoid subtracting the same component again.

The route adapter must keep these separate:

- DEX trade fee and optional creator/protocol fees.
- Token-2022 transfer fees charged by the mint on input/output transfers.
- Price impact / expected execution shortfall against the reference quote.
- User slippage tolerance, which is a transaction bound and not itself an economic loss.
- Recoverable rent, which is capital temporarily locked and not automatically an expense.
- Irrecoverable transaction/network fees, which can be charged even when execution fails.

Every monetary component must be converted from its charged asset (for example SOL/lamports) to the exact quote asset with a timestamped price source. Raw lamports, SPL base units and quote-asset units must never be summed directly.

## Solana fee mechanics

Solana's official fee documentation defines total transaction fee as base fee plus optional priority fee. The base fee is per signature and the currently published value is 5,000 lamports per signature; the base-fee parameter is passed into the helper rather than hard-coded. Fees are deducted before execution, including when a processed transaction fails.

For legacy and v0 messages:

priority_fee_lamports =
  ceil(compute_unit_price_micro_lamports × requested_compute_unit_limit / 1,000,000)

The requested CU limit, not actual CU consumption, determines the fee. Over-requesting the CU limit costs additional lamports. The official compute-budget guide recommends simulation to estimate consumption and then a safety margin; the margin belongs in the transaction builder policy, not as an invented input to κ.

For transaction format v1, the priority fee is an absolute total in lamports stored in the message configuration. It is not a micro-lamports-per-CU price and must not be multiplied by the compute-unit limit. The code exposes separate helpers for legacy/v0 and v1 fee calculation.

Official sources:
- https://solana.com/docs/core/fees/fee-structure
- https://solana.com/docs/core/fees/compute-budget
- https://solana.com/docs/core/transactions/versioned-transactions
- https://solana.com/docs/rpc/json-structures
- https://solana.com/docs/tools/transaction-landing

## Jito cost and landing semantics

Jito bundles contain up to five transactions, execute sequentially and atomically, and compete in an auction. A tip is required for a bundle to be considered. Current tip distribution is exposed through the Jito tip-floor API and websocket; a fixed tip must not be treated as a current competitive bid.

A successful sendBundle response returns a bundle identifier; that receipt is not proof of landing. The adapter must query getBundleStatuses, retain the returned transaction signatures and slot, verify on-chain transaction statuses, require the configured finality level, and reconcile balances/fees from finalized transaction metadata. A missing bundle status is not a successful transaction.

Jito documents tip bidding for sendBundle separately from sendTransaction routing. A bundle's Jito tip is a distinct cost; do not silently combine it with the Solana priority fee or count the same transfer twice.

Sources:
- https://docs.jito.wtf/lowlatencytxnsend/
- https://docs.jito.wtf/api/

## DEX fee adapters

Raydium CPMM documents a trade fee and an optional creator fee as independent buckets. The creator fee is per-pool enabled/disabled and may be charged on the input or output side. Its rates use the product's own fee denominator and the rate fields reside in AmmConfig; the per-pool flag and fee side reside in PoolState. The documentation says current configuration values are admin-mutable and should be read fresh. Raydium's quoter also accounts for Token-2022 transfer fees on input and output.

Therefore:
- Do not apply one global DEX fee constant across Raydium AMM v4, CPMM, CLMM or other DEXs.
- Decode the exact pool/product configuration or use an executable quote with a verified fee breakdown.
- Include optional creator fees and Token-2022 transfer fees exactly once.
- Preserve the fee unit/denominator and quote direction in the provenance record.

Sources:
- https://github.com/raydium-io/raydium-docs-v1/blob/main/products/cpmm/fees.mdx
- https://github.com/raydium-io/raydium-docs-v1/blob/main/reference/fee-comparison.mdx
- https://api-v3.raydium.io/main/cpmm-config

## Flash-loan provider evidence

### Project 0 (formerly marginfi)

The current official TypeScript SDK guide describes flash loans as begin/end instruction bookends in the same transaction. The account must be healthy at the end instruction; the documented flow cannot be nested, called through CPI, or separated across transactions. The current guide states that the flash loan has no fee. A live adapter must still confirm the deployed program/version and transaction constraints rather than infer a zero fee from a library name.

Source:
- https://docs.marginfi.com/typescript-sdk/flash-loans

### Kamino KLend

Kamino's on-chain Reserve configuration contains flash_loan_fee_sf. A reserve with u64::MAX disables flash loans. The implementation converts the stored scaled fraction, calculates fees against the borrowed amount, applies a minimum raw-unit fee, rounds the protocol fee, and can assess an additional referral fee. The repay path transfers the borrowed amount plus referral fee to the reserve and the protocol fee to the fee receiver.

The production adapter must decode the selected reserve's live account state and compute the exact fee, including any referral terms and token decimals. It must not substitute a generic rate or an assumed default. The exact fee amount should be supplied as flash_loan_fee_quote after quote-asset conversion whenever the protocol calculation produces an integer token amount.

Sources:
- https://github.com/Kamino-Finance/klend/blob/master/libs/klend-interface/src/state/reserve.rs
- https://github.com/Kamino-Finance/klend/blob/master/programs/klend/src/state/reserve.rs
- https://github.com/Kamino-Finance/klend/blob/master/programs/klend/src/lending_market/lending_operations.rs
- https://github.com/Kamino-Finance/klend/blob/master/programs/klend/src/handlers/handler_flash_repay_reserve_liquidity.rs

### Save / Solend

No provider-specific live fee or execution contract is adopted in this A1 implementation. Older documentation/references are not sufficient evidence of current mainnet support, reserve configuration or deployed program behavior. A provider adapter is not accepted until its current program ID, current on-chain configuration, fee calculation, atomicity constraints and maintained SDK path are verified.

## Implementation contract

flashloan_engine/kappa.py provides:

- Decimal-only arithmetic and non-finite/negative-cost rejection.
- Field-level SourceEvidence binding: reference, evidence kind, timestamp with UTC offset, raw value, unit and quote asset.
- Explicit opt-in for test/symbolic evidence; non-live evidence is rejected by default.
- Either rate-derived or exact quote-denominated flash-loan fee input, never both.
- Additional independently evidenced route cost components.
- Separate Solana base-fee, legacy/v0 priority-fee and v1 absolute-priority-fee helpers.
- Explicit conversion from lamports to quote-asset units.
- JSON serialization that encodes Decimal values as strings.

The source binding checks that the supplied evidence record matches the numeric input and unit. It does not cryptographically attest that an external RPC/API response is authentic or fresh. Live adapters must independently validate provider identity, signed/raw response provenance where available, account owner/program ID, commitment/finality, observed slot/time, quote freshness and price-source integrity. Freshness policy is venue/route-specific and is deliberately not guessed inside the deterministic arithmetic module.

tests/test_kappa.py uses explicitly marked symbolic fixtures and opts in to non-live evidence. Those fixtures are arithmetic test vectors only; they are not market observations, execution simulations or production defaults.

## Legacy and rollback

The v16 α glyph/footer, old α-Coupling documents, archived HTML and historical alpha telemetry identifiers remain present. This module does not use the fine-structure constant and does not translate α to κ.

All changes are additive on the dedicated URO branch. No v16 source file or legacy component is deleted. Reverting the branch/PR removes this A1 layer without changing the main branch's production configuration.
