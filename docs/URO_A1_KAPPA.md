# URO A1 — Nexus critical profitability threshold κ

## Status and scope

Maturity target: L2 for the deterministic arithmetic component after the
repository CI checks pass. Live-source integration remains unverified. This
document does not claim live trading activation.

The v16 HTML, legacy documents, backups, identifiers and historical α
references remain unchanged. The v17 κ calculation is additive.

## Definition

All monetary inputs are normalized into one quote asset. Let:

- Q: borrowed principal in quote-asset units.
- s: gross executable route spread in basis points.
- r_f: flash-loan fee rate in basis points.
- F_dex: sum of actual route DEX fees in quote-asset units.
- S: expected slippage/price-impact cost in quote-asset units.
- G: base/network execution cost converted to quote-asset units.
- P: priority fee converted to quote-asset units.
- T: Jito tip converted to quote-asset units.

Inputs must come from an executable route quote, provider fee terms, chain
simulation/current fee data and contemporaneous quote-asset conversion.
The arithmetic module refuses missing provenance references. It does not
fetch or invent any input.

E_gross = Q × s / 10,000
C_loan = Q × r_f / 10,000
C_all = C_loan + F_dex + S + G + P + T
κ = (E_gross − C_all) / C_all
s_BE = 10,000 × C_all / Q

κ is dimensionless. κ > 0 means modeled gross edge exceeds modeled costs;
κ = 0 is break-even; κ < 0 means modeled costs exceed gross edge. κ is not a
probability, confidence score, landing guarantee or substitute for a separate
risk and authorization gate. A finite κ requires C_all > 0; the implementation
rejects a zero denominator.

## Cost-source normalization

All quote-denominated monetary values must use the same quote asset. If a
fee is charged in SOL or another asset, convert it using an identified,
time-aligned price source and record that source reference. Never add raw
lamports, token units and USDC without conversion.

For Solana legacy/v0 transactions, the official fee model describes a base
signature fee plus a priority fee calculated from requested compute-unit
price multiplied by requested compute-unit limit, rounded up from
micro-lamports to lamports. The v1 transaction format handles priority fees
differently; adapters must branch on transaction version.
Sources:
- https://solana.com/docs/core/fees/fee-structure
- https://solana.com/docs/core/fees/compute-budget
- https://solana.com/docs/tools/transaction-landing

Jito documents bundles as sequential and atomic, with all bundle transactions
landing in order or none. The tip remains a distinct economic cost and must
be read from bundle configuration and confirmed settlement data:
- https://docs.jito.wtf/bundles/

DEX fees are pool/product specific and must be read from the selected pool's
current on-chain configuration or executable quote. Raydium documents
different fee denominators and product-specific fee handling; hardcoding one
universal DEX fee is invalid:
- https://docs.raydium.io/
- https://github.com/raydium-io/raydium-docs-v1/blob/main/products/cpmm/fees.mdx
- https://github.com/raydium-io/raydium-docs-v1/blob/main/reference/fee-comparison.mdx

## Implementation

flashloan_engine/kappa.py provides immutable input/output records,
finite-decimal validation, non-negative cost validation, required field-level
provenance references, quote-unit contract, break-even spread and κ.

tests/test_kappa.py uses symbolic unit-test fixtures only. These fixtures are
not market observations, execution simulations or production defaults.

## Legacy preservation

The v16 α glyph and footer, legacy α-coupling references, archived HTML and
legacy telemetry identifiers are preserved. The fine-structure constant is
not used by this module. No conversion from α to κ exists or is valid.

## Activation boundary

The κ arithmetic is usable only after callers supply current, source-backed
values. This addition does not connect a Solana RPC, Yellowstone stream, Jito
Block Engine, DEX quote adapter, oracle or production database. It does not
submit or sign transactions. A live strategy must independently validate pool
state, token decimals, transfer fees, route-level DEX fees, compute budget,
base fee, priority fee, Jito tip, slippage, flash-loan terms, finality and
realized balance deltas before execution.

## Rollback

The implementation is additive on a dedicated branch. Reverting the branch
or its PR removes the κ additions without changing v16 files or production
configuration. Existing files are not deleted or overwritten.
