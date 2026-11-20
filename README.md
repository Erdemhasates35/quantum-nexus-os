# QUANTUM NEXUS OS v16

Quantum Nexus OS v16 currently publishes a static control dashboard and a versioned 60-role architecture registry.

## Verified dashboard capabilities

- Vercel root dashboard: HTTP 200.
- Published role registry: HTTP 200 and valid JSON.
- Registry topology: 10 strategy clusters, 30 core role definitions, 20 academic role profiles and 10 frontier research role definitions.
- Phantom and Solflare connect through injected Solana wallet providers; MetaMask connects through the injected EVM provider.
- Wallet connection exposes public addresses only. The dashboard does not sign or submit transactions.

## Execution boundary

A registry definition is not an active worker. A role is operational only when its handler, provider, configuration, health check and traceable evidence are all present.

The v16 dashboard is not an autonomous trading engine and does not claim live order execution or realized trading revenue. The separate `flashloan_engine` package contains research/economic validation components and an EVM executor boundary; the `SafeExecutor.submit` path currently fails closed, and the separate live EVM executor is not connected to the dashboard or certified by the dashboard's deployment.

## Security

- Private keys must never be stored in browser code, committed files or logs.
- Legacy mainnet signer scripts containing an embedded wallet key were removed from the active tree. Any key ever committed to Git history must be treated as compromised and rotated; deleting current files does not rewrite historical commits.
- Wallet connection is not transaction authorization.
- A quote, model output, simulated result or bundle acknowledgement is not a settled trade.
- Realized PnL requires finalized transaction evidence and reconciled balance deltas.

## Deployment

- Dashboard: https://quantum-nexus-os.vercel.app
- Registry: https://quantum-nexus-os.vercel.app/config/agent-registry.v16.json
- Source: https://github.com/Erdemhasates35/quantum-nexus-os
