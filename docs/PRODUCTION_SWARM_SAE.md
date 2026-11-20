# Quantum Nexus OS — Swarm + SAE integration contract

Updated: 2026-11-20

## Production status

<badge>DEFERRED — NOT PRODUCTION</badge>

The Swarm / Pythia Sparse Autoencoder (SAE) integration is a contract only. It
is not imported by the deployed Next.js application and does not perform model
inference, generate activations, route agent work, or authorize trades.

The contract lives at `src/contracts/swarm_sae_contract.py`. It intentionally
fails closed unless a real inference executor is injected. Scout and
Cartographer also require a real trained SAE and real residual-stream input.
No synthetic activations or feature identifiers are permitted.

## Outstanding integration prerequisites

1. Implement and verify a real Pythia model forward pass and residual stream.
2. Load a pinned, checksum-verified TopK / BatchTopK SAE checkpoint.
3. Provide an inference executor with bounded timeouts, audit correlation IDs,
   and explicit model/version provenance.
4. Add independent policy and risk authorization; this contract is not an
   execution or trading authorization layer.
5. Run hardware, latency, numerical, and model-quality validation before any
   production promotion.

Until these prerequisites are completed, the module remains disabled and must
not be described as production-ready.
