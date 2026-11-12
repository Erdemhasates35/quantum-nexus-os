# Implementation Backlog and Acceptance Matrix

## Priority scale
- **P0:** platform-wide prerequisite with immediate leverage.
- **P1:** high-value domain capability.
- **P2:** research expansion and advanced optimization.
- **P3:** optional frontier work after evidence of value.

## EPIC 00 — Portfolio intelligence (P0)
1. Enumerate all owned repositories with fork ancestry and metadata.
2. Capture default branch, commit, languages, manifests, workflows, deployments, services and dependencies.
3. Generate a repository relationship graph and duplicate-capability map.
4. Identify dormant, empty, scaffold-only and production repositories.
5. Produce per-repository evidence cards and integration readiness scores.

**Acceptance:** all owned repositories have stable IDs and an evidence-backed inventory; forks/upstreams are distinguished; no source repository is modified by the inventory job.

## EPIC 01 — Shared engineering platform (P0)
1. Shared typed event envelope and schema registry.
2. Shared configuration and environment-variable schema.
3. Shared structured logging, metrics and tracing.
4. Shared retry, idempotency, timeout and circuit-breaker primitives.
5. Shared test fixtures and contract-test harness.
6. Shared CLI for status, diagnostics, repository checks and deployment visibility.

**Acceptance:** at least two independent services consume each shared contract; backward compatibility is tested.

## EPIC 02 — Data and research foundation (P0)
1. Dataset manifest and checksum verifier.
2. Data quality and schema validation.
3. Point-in-time feature joins.
4. Dataset version and experiment lineage.
5. Reproducible baseline runner.
6. Artifact registry and model/strategy cards.

**Acceptance:** experiments can be recreated from commit + data manifest + config + seed + artifact digest.

## EPIC 03 — Quantitative research and execution (P1)
1. Market-data adapters and normalized symbols.
2. Regime detection and event classification.
3. Feature store and feature selection.
4. Forecast baselines (naive, linear, tree, neural).
5. Calibration and uncertainty.
6. Portfolio optimizer with constraints.
7. Vectorized research engine.
8. Event-driven simulator.
9. Fee/funding/spread/slippage/impact model.
10. Walk-forward and purged time-series validation.
11. Execution-quality attribution.
12. Exchange and chain adapter conformance tests.

**Acceptance:** net-of-cost results beat declared baselines across multiple out-of-sample windows and remain within risk/capacity constraints.

## EPIC 04 — Honeycomb execution system (P1)
1. Standardize order lifecycle schema across Go/Rust services.
2. Normalize exchange connector interfaces.
3. Reconcile local and venue order/position state.
4. Add idempotent order submission and deduplication.
5. Measure p50/p95/p99 execution latency.
6. Add queue/backpressure and rate-limit adaptation.
7. Add risk-state telemetry and post-trade attribution.
8. Keep paper, shadow and live modes on the same contract.

**Acceptance:** deterministic integration tests for partial fill, timeout, duplicate submission, cancel/replace, disconnect/reconnect and reconciliation.

## EPIC 05 — AI/LLM research platform (P1)
1. Model registry and model cards.
2. Provider-neutral inference router.
3. Prompt/program versioning.
4. Retrieval with source provenance.
5. Golden evaluation sets and regression tests.
6. Pythia checkpoint explorer.
7. GPT-NeoX experiment configuration registry.
8. Quantization and local inference benchmark suite.
9. Agent state graph, typed tools and trace replay.
10. Human feedback and evaluation-data capture.

**Acceptance:** every model result links to model version, prompt/config, source set, evaluation and latency/cost record.

## EPIC 06 — Scientific computing (P1/P2)
1. Research notebook templates with pinned environments.
2. Data and code provenance.
3. Unit-aware numerical interfaces where relevant.
4. Reproducible random seeds and deterministic settings.
5. Statistical testing and uncertainty reporting.
6. Compute profiling and hardware compatibility matrix.
7. Domain-specific workflow modules only after repository inventory identifies concrete projects.

**Acceptance:** independent rerun reproduces declared outputs within specified numerical tolerances.

## EPIC 07 — Legal and document intelligence (P1)
1. Shared document ingestion and extraction.
2. Citation graph and source versioning.
3. Claim-evidence relation schema.
4. Provenance-preserving retrieval.
5. Multilingual OCR and structured document parsing.
6. Evaluation sets for citation correctness and retrieval recall.

**Acceptance:** every asserted legal proposition is traceable to a source span and source version.

## EPIC 08 — Android / Termux engineering (P0)
1. Read-only environment preflight.
2. ARM64 package compatibility matrix.
3. Disk/RAM-aware workload scheduler.
4. Lightweight local test runner.
5. Remote compute and GitHub orchestration.
6. Offline-first diagnostic bundle.
7. Process/log/thermal/battery monitoring.
8. No-root installation and recovery scripts.
9. Storage-aware model cache and dataset manifest.
10. Mobile dashboard/CLI for system status.

**Acceptance:** all scripts run without root; dry-run and actual output are distinguishable; no destructive defaults; workload selection uses measured capacity.

## EPIC 09 — Delivery and observability (P0)
1. CI quality matrix across Python, Go, Rust, TypeScript and Solidity.
2. Build caching and dependency caching.
3. Changed-path selective tests.
4. Integration environment and seeded fixtures.
5. Release provenance and artifact checksums.
6. Supabase operational telemetry schema.
7. Vercel dashboard with service health and experiment status.
8. Alert routing and incident timeline.
9. Automated rollback and post-deploy smoke tests.

**Acceptance:** every production release has a commit, build, test, artifact and deployment record.

## EPIC 10 — Advanced optimization (P2/P3)
1. Bayesian optimization for strategy/model hyperparameters.
2. Multi-objective optimization: return, drawdown, capacity, latency, compute cost.
3. Population-based training where justified.
4. Contextual bandits for bounded routing/selection tasks.
5. Offline RL with conservative evaluation and simulator validation.
6. Multi-agent market simulation.
7. Causal analysis and counterfactual evaluation.
8. Continual learning with drift detection and rollback.
9. Automated research agent that proposes experiments but cannot self-certify results.
10. Cost-aware scheduling across Android, CPU cloud and GPU cloud.

**Acceptance:** advanced method must outperform a simpler baseline on pre-registered metrics and holdout periods after compute and operational costs.

## Global definition of done
- Code is committed on an isolated branch.
- Tests and lint/type checks are executed and results recorded.
- Benchmark comparisons include baseline and environment.
- No untracked generated artifacts or credentials.
- Documentation and operational instructions are updated.
- Existing data and production behavior remain intact.
- Deployment status is stated from observed platform evidence only.
