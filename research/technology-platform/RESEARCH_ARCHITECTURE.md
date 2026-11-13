# Research Architecture and Technology Reference Map

## 1. Portfolio architecture

Use a federated platform with shared contracts, not a monolithic application.

```text
                    ERDEM TECHNOLOGY PLATFORM
                              |
       +----------------------+----------------------+
       |                      |                      |
  Research Plane         Intelligence Plane      Operations Plane
       |                      |                      |
  Pythia / GPT-NeoX      LLM & agent runtime      GitHub CI/CD
  FinRL / FinRL-Meta     Retrieval / RAG          Vercel control plane
  Qlib / vectorbt        Forecasting / NLP         Supabase telemetry
  scientific compute    feature & policy engine   Termux operator CLI
       |                      |                      |
       +----------------------+----------------------+
                              |
                       Domain Systems
              +---------------+----------------+
              |               |                |
         Quantum Nexus     Honeycomb         Legal AI
         Solana/DeFi       Exchange exec     Provenance
         on-chain data     risk & orders     documents
              |               |                |
              +---------------+----------------+
                              |
                Shared event, identity, data,
                model, telemetry and audit contracts
```

## 2. Reference projects and what to extract

These are external research/reference systems. Their code is not assumed to be installed or production-ready in our portfolio.

### Quantitative finance and execution
- **FinRL / FinRL-Meta:** market environments, data processing, DRL baselines, benchmark protocols and reproducibility. Extract environment/agent/evaluation boundaries; do not assume simulated returns transfer to live markets.
- **Qlib:** data handler, feature/label pipeline, model workflow, experiment tracking and portfolio evaluation.
- **vectorbt:** vectorized research and parameter sweeps; useful for rapid hypothesis rejection.
- **Backtrader:** event-driven backtesting and broker abstractions.
- **LEAN / QuantConnect:** engine architecture, data normalization, brokerage interfaces and deterministic backtest/live parity.
- **Freqtrade:** strategy lifecycle, exchange adapters, dry-run, protections and hyperopt patterns.
- **Hummingbot:** connector architecture, market-making and execution adapters.
- **NautilusTrader:** event-driven execution, typed market data, backtest/live architecture.
- **ABIDES:** agent-based market simulation and market microstructure experiments.

### LLM and agent research
- **Pythia:** checkpoint-wise learning dynamics, controlled model comparisons, interpretability and data-order reproducibility.
- **GPT-NeoX:** distributed autoregressive training stack, configuration-driven experiments, checkpoint and tokenizer handling.
- **OLMo / OLMo-core:** open training recipes, data/model provenance and evaluation discipline.
- **LlamaFactory:** supervised fine-tuning and preference-optimization workflow patterns.
- **TRL:** preference optimization and RLHF algorithm implementations.
- **DSPy:** declarative optimization of LM programs and measurable prompt/program improvements.
- **LangGraph:** explicit stateful orchestration, checkpoints and human/system control boundaries.
- **Ray RLlib:** scalable reinforcement-learning execution and experiment orchestration.
- **vLLM:** high-throughput inference serving and batching.
- **llama.cpp:** quantized local inference and hardware-aware deployment.
- **MLflow / Weights & Biases:** experiment metadata, metrics, artifact lineage and reproducibility.

### Scientific and data engineering
- **DVC:** dataset and artifact versioning.
- **DuckDB / Polars / Apache Arrow:** analytical processing and efficient columnar data interchange.
- **Prefect / Dagster:** observable data and ML workflows.
- **OpenTelemetry:** traces, metrics and logs across services.
- **Great Expectations / Pandera:** data contracts and quality assertions.
- **Hypothesis:** property-based testing.
- **OpenFF / RDKit / OpenMM (domain-dependent):** examples of reproducible scientific-computing pipelines; adopt only when aligned to a specific scientific project.

## 3. Shared platform capabilities

### A. Data plane
- Canonical event envelope: event_id, event_type, schema_version, event_time, observed_time, producer, correlation_id, payload, provenance.
- Market-data normalization: symbol mapping, decimal precision, timestamp normalization, sequence/gap detection, venue metadata.
- Immutable raw event archive plus derived analytical tables.
- Dataset manifests: source, license, checksum, schema, time span, sampling policy, transformation lineage.
- Feature store with point-in-time correctness and explicit availability timestamps.

### B. Intelligence plane
- Model registry: model card, data lineage, code commit, artifact digest, evaluation set, metrics, calibration, intended use, limitations.
- Inference router: local/remote model selection based on latency, cost, quality, hardware and privacy constraints.
- Agent runtime: typed tools, bounded state, retries, idempotency, deadlines, cancellation, event trace.
- Retrieval: hybrid lexical/vector retrieval, source ranking, citations, freshness and access control.
- Evaluation: task-specific golden sets, regression suites, calibration and drift.

### C. Quantitative plane
- Market regime detection and change-point analysis.
- Feature engineering with strict point-in-time joins.
- Forecasts with uncertainty intervals and calibration.
- Strategy selection using walk-forward evidence, not single holdout optimization.
- Portfolio construction with turnover, concentration, leverage and liquidity constraints.
- Backtesting with fees, spread, funding, borrow, slippage, market impact and partial fills.
- Paper/live adapters with identical order and state contracts.
- Post-trade attribution and execution-quality analysis.

### D. Execution plane
- Exchange / chain connectors behind normalized interfaces.
- Order state machine: created → validated → submitted → acknowledged → partially_filled → filled / canceled / rejected / expired.
- Idempotent client order IDs and reconciliation against venue state.
- Latency budget, retry policy, rate-limit adaptation and circuit-breaker recovery.
- Kill switch and close-only mode as operational controls, not workflow blockers.
- Independent risk limits and explicit override audit trail.

### E. Platform operations
- GitHub Actions: unit, integration, type, lint, security/dependency, build, schema compatibility, benchmark smoke tests.
- Supabase: operational telemetry, experiment metadata, workflow state and event storage where appropriate.
- Vercel: operator dashboard, control plane, API/UI delivery; long-running execution remains in a suitable service runtime.
- Termux: mobile diagnostics, repository orchestration, lightweight tests, logs, CLI control and remote administration.
- Cloud GPU: training, large-scale inference, Pythia checkpoint sweeps and large datasets.

## 4. Research-to-production pipeline

1. Hypothesis registration and expected measurable effect.
2. Dataset manifest and point-in-time correctness checks.
3. Baseline reproduction.
4. Ablation study.
5. Robustness tests across time, assets, venues, regimes and random seeds.
6. Cost and latency profiling.
7. Model/strategy card with intended operating envelope.
8. Shadow inference or paper execution.
9. Canary rollout with live telemetry.
10. Promotion only when predefined acceptance metrics are met.
11. Continuous drift, degradation and rollback monitoring.

## 5. Pythia-specific integration

Pythia is an interpretability and training-dynamics research suite, not a financial forecasting model. Integrate it as an experimental model-analysis workbench:
- checkpoint comparison and loss/activation trend analysis;
- tokenizer and dataset provenance;
- memorization and data-contamination studies;
- small-checkpoint inference feasibility tests;
- domain adaptation experiments only with properly licensed, time-split datasets;
- benchmark comparison against simpler baselines.

Do not use the 417 GB deduplicated Pile index-map dataset as a trading dataset. The full corpus is not required to consume pretrained Pythia checkpoints. Training reproduction requires separate compute, storage, data, tokenizer and GPT-NeoX environment planning.

## 6. Performance objectives

Track actual measurements rather than aspirational labels:
- data ingest throughput and freshness lag;
- feature pipeline p50/p95/p99 latency;
- inference tokens/sec, requests/sec, cost/request and quality;
- backtest throughput and reproducibility variance;
- order acknowledgement and fill latency;
- slippage, fees, funding, spread and market impact;
- strategy net return, volatility, drawdown, turnover and capacity;
- service availability, error budget and recovery time;
- developer lead time, CI duration and flaky-test rate;
- cloud spend per experiment and per accepted model.

## 7. Design constraints

- Do not let an LLM directly mutate risk limits or bypass execution contracts.
- Do not infer predictive edge from language-model benchmark scores.
- Prevent look-ahead leakage and survivorship bias.
- Keep all financial results net of realistic costs.
- Keep each domain's data rights, licenses and privacy constraints explicit.
- Preserve independent release cycles and existing production behavior.


## 8. Primary references

- Pythia paper (ICML/PMLR 2023): https://proceedings.mlr.press/v202/biderman23a.html
- GPT-NeoX training library: https://github.com/EleutherAI/gpt-neox
- FinRL / FinRL-Meta documentation: https://github.com/AI4Finance-Foundation/FinRL
- Qlib platform and research documentation: https://github.com/microsoft/qlib
- Qlib paper: https://www.microsoft.com/en-us/research/publication/qlib-an-ai-oriented-quantitative-investment-platform/
- NautilusTrader architecture: https://nautilustrader.io/docs/latest/concepts/architecture/
- ABIDES market simulation: https://github.com/abides-sim/abides
- OLMo open model lifecycle: https://allenai.org/olmo2
- DSPy ICLR 2024 paper: https://proceedings.iclr.cc/paper_files/paper/2024/hash/f1cf02ce09757f57c3b93c0db83181e0-Abstract-Conference.html
- Vercel AI SDK: https://vercel.com/ai-sdk

References are starting points for technical due diligence. Each adoption requires version pinning, license review, dependency and runtime inspection, reproducible benchmarks, and a compatibility assessment against the portfolio's actual code.
