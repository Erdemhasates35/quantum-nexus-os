# Evidence, Reproducibility and Benchmark Protocol

## 1. Evidence states

Every claim or task is assigned exactly one state:
- **Observed:** directly retrieved from source, API, file or command output.
- **Implemented:** code or configuration committed.
- **Tested:** named test executed with recorded exit status/output.
- **Measured:** benchmark executed with workload and environment recorded.
- **Deployed:** deployment platform confirms a deployment and target.
- **Proposed:** design or work item not yet implemented.

A README statement such as "production ready" is not deployment or test evidence.

## 2. Experiment identity

Every experiment record includes:
- experiment_id;
- repository and commit SHA;
- dataset ID, version, manifest and checksums;
- configuration hash;
- model/strategy ID and artifact digest;
- random seed;
- runtime, OS, CPU/GPU and memory;
- start/end timestamps;
- command and exit status;
- metrics and raw artifact locations.

## 3. Quantitative evaluation

Report:
- gross and net returns;
- fees, spread, slippage, funding, borrow and market impact;
- volatility, Sharpe/Sortino with assumptions;
- maximum drawdown and recovery;
- turnover, exposure, concentration and leverage;
- trade count, win/loss distribution and tail losses;
- capacity and liquidity constraints;
- latency and fill quality;
- performance by time window, asset, venue and regime.

Use chronological splits, walk-forward evaluation, purging/embargo where overlapping labels require it, and a final untouched holdout. Record every attempted configuration to expose selection bias.

## 4. ML/LLM evaluation

Report task-specific metrics, calibration, confidence intervals, inference latency, throughput, token cost, memory, energy/compute cost where available, and failure taxonomy. Compare against naive and simple baselines. Evaluate distribution shift and prompt/data contamination.

## 5. Statistical discipline

- Pre-register primary metrics and acceptance thresholds.
- Use multiple seeds for stochastic methods.
- Report confidence intervals and sample sizes.
- Correct for multiple comparisons when many strategies/configurations are tested.
- Distinguish statistical significance from economic significance.
- Include negative results and failed runs in experiment history.

## 6. Performance engineering

For each optimization, capture baseline and candidate under equivalent conditions:
- p50/p95/p99 latency;
- throughput;
- CPU and memory;
- network and storage I/O;
- cost per task;
- error and retry rates;
- quality/performance trade-off.

Accept an optimization only when its benefit is measured and its quality impact is understood.

## 7. Operational evidence

Each release should link:
- source commit;
- CI run;
- test report;
- artifact checksum;
- deployment ID;
- smoke-test output;
- telemetry dashboard;
- rollback target.

## 8. Data and model provenance

Record dataset license, source, collection date, transformations, filters, deduplication, tokenizer, model license, training/inference code and third-party dependencies. Do not assume a repository's Apache/MIT code license automatically grants rights to every linked dataset or model artifact.
