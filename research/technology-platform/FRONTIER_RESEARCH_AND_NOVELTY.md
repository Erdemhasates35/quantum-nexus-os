# Frontier research agenda — OMNIQUANT AI / CORE VAULT

**Status:** research hypotheses and proposed differentiators, not implemented features or novelty claims.  
**Review date:** 2026-11-13.

## 1. Prior-art boundary

A multi-agent quantitative platform, a layered finance-RL pipeline, an independent risk governor, and a cloud AI trading stack are not individually world-first concepts. Public references already describe:
- FinRL's data/environment/agent layering and research-to-trading pipeline.
- FinRL-X as a modular, production-oriented successor direction.
- FinWorld as an end-to-end financial AI research/deployment platform.
- AxumQuant as a multi-agent live quant system with a hard risk governor and execution layer.
- OpenQnt as an agentic asset-management platform with risk gates and paper/live execution.
- A 2026 survey of agentic quantitative trading across factor mining, portfolio construction, execution and risk management.

These systems are not necessarily equivalent in implementation or evidence quality, but their existence prevents an unqualified claim that OMNIQUANT is the world's first multi-agent quant platform or first AI trading system with a risk gate.

## 2. High-value candidate differentiators

### A. Evidence-bound autonomy ledger
Every proposal and execution receipt is bound to:
- immutable source event IDs and market-data timestamps;
- source/venue sequence and gap status;
- model, strategy and feature artifact digests;
- dataset and transformation lineage;
- calibrated forecast and uncertainty interval;
- regime classification and out-of-sample evaluation record;
- policy version and independent Guard verdict;
- order idempotency key, venue acknowledgement and actual fill receipt;
- post-trade attribution and reconciliation.

**Potential distinction:** the system cannot promote a model or authorize execution without a complete evidence chain. Novelty requires a formal comparison against prior provenance, audit-ledger and policy-gated trading systems.

### B. Independently enforceable risk authority
- Run Guard as a separate service and credential boundary from LLMs, agents and strategy processes.
- Require short-lived, signed, one-intent approvals; bind each approval to instrument, side, notional, venue, expiry, policy version and market-data snapshot.
- Executor rejects missing, stale, replayed, mismatched or duplicate approvals.
- Risk policy changes require controlled versioning, dual control and immutable audit evidence.
- Fail closed on stale account state, market-data gaps, clock drift, reconciliation mismatch, rate-limit exhaustion or service partition.

**Potential distinction:** formal, independently testable separation of decision intelligence and execution authority. A code-level guard function alone is not enough.

### C. Cross-venue and on-chain total-exposure graph
- Consolidate CEX positions, DEX liquidity, lending/borrowing, collateral, bridge exposure, stablecoin concentration, smart-contract dependencies and unsettled transfers.
- Model common-cause risk across chains, venues, custodians and correlated collateral.
- Enforce exposure limits on economic risk, not only per-exchange account balances.

**Potential distinction:** a verified cross-domain exposure graph with live reconciliation and stress-aware limits. Requires actual venue and chain adapters plus independent reference data.

### D. Live-evidence-only strategy promotion
- Use real, timestamped market data and preserve raw source events.
- Evaluate forecasts with Brier score, log loss, calibration curves, confidence intervals and regime-conditional performance.
- Keep chronological walk-forward and untouched holdout boundaries.
- Run shadow inference against live feeds; do not invent fills or PnL.
- Promote only after pre-registered statistical and economic thresholds are met on independent evidence.

**Potential distinction:** a strict evidence-gated promotion system. Calibration and walk-forward validation are established techniques, not new inventions.

### E. Adversarial strategy research with anti-overfit governance
- Competing agents propose hypotheses; an adversarial reviewer searches for leakage, survivorship bias, multiple-testing inflation and capacity constraints.
- Every attempted strategy and parameter search is logged.
- Use purged/embargoed validation when labels overlap, multiple-testing corrections and a sealed final holdout.
- Reject strategies that only work in one regime, venue or narrow period.

**Potential distinction:** a complete autonomous research loop whose search history and rejected hypotheses are auditable. Automated alpha discovery already exists; novelty must be demonstrated beyond orchestration.

### F. LLM research plane with zero execution authority
- Pythia/GPT-NeoX/FinGPT/Heretic-class systems operate as research, extraction, retrieval, coding and evaluation components.
- All claims carry citations, event timestamps, freshness and source confidence.
- LLM outputs are structured proposals, never direct orders or risk-policy mutations.
- Independent deterministic services validate schema, provenance, numerical bounds and authorization.

**Potential distinction:** an evidence-grounded LLM-to-quant workflow with independently enforced authority boundaries. LLM-driven finance research is already an active field.

### G. Scientific-compute and quantum research federation
- Run scientific workloads as isolated jobs with pinned data, source code, runtime and artifact digests.
- Compare quantum methods against classical baselines on identical problem instances.
- Publish only measured advantage under matched resource budgets; otherwise report no advantage.
- Do not route research models into capital allocation without task-specific validation.

**Potential distinction:** cross-domain evidence lineage from scientific discovery to operational decision systems. Quantum advantage cannot be presumed.

### H. Cloud/edge operations with mobile-safe control
- Termux/Android provides signed operator commands, read-only diagnostics and incident response.
- Cloud GPU services perform large-model training and inference.
- Execution services run in stable Linux/server environments with independent Guard deployment.
- Mobile control plane never stores exchange signing keys or unrestricted cloud credentials.

**Potential distinction:** a rigorously permissioned edge-to-cloud operating plane. Termux is an operator interface, not a production exchange engine.

## 3. Novelty verification protocol

No candidate may be labelled "world-first" until all gates pass:

1. Define a narrow, falsifiable claim; avoid broad marketing language.
2. Search peer-reviewed papers, preprints, patents, open-source repositories and commercial product documentation.
3. Build a feature-by-feature prior-art matrix with dates, citations, licenses and implementation evidence.
4. Identify the exact technical difference, not merely a different name or combination of known tools.
5. Publish a reproducible reference implementation and threat model.
6. Benchmark against strong baselines using the same data, compute, cost and latency budgets.
7. Obtain independent replication or external technical review.
8. Publish negative results, limitations and a versioned artifact with checksums.

Until then, use the wording **"candidate research contribution"**, not "world's first".

## 4. Required scorecard

For each candidate record:
- novelty claim and closest prior art;
- exact mechanism and formal specification;
- independent implementation status;
- benchmark dataset and provenance;
- baseline methods and equal-resource comparison;
- latency, throughput, cost and reliability;
- statistical uncertainty and failure cases;
- security threat model and attack tests;
- external replication and publication status.

## 5. References

- FinRL three-layer architecture: https://finrl.readthedocs.io/en/latest/start/three_layer.html
- FinRL repository and FinRL-X direction: https://github.com/AI4Finance-Foundation/FinRL
- FinWorld, *An All-in-One Open-Source Platform for End-to-End Financial AI Research and Deployment*: https://openreview.net/pdf/07462e399a3d0906a45bce1fb7cd28dc762f8e31.pdf
- AxumQuant public architecture overview: https://github.com/axumquant/axum-trading-platform
- OpenQnt: https://github.com/sinatooor/openqnt
- Agentic Quantitative Trading survey: https://ideas.repec.org/p/arx/papers/2608.31041.html
- Qlib: https://github.com/microsoft/qlib
- NautilusTrader architecture: https://nautilustrader.io/docs/latest/concepts/architecture/

This list is a research agenda. It does not assert that the proposed combinations are novel, deployed, profitable or production-ready.
