# Repository Portfolio Inventory

**Snapshot date:** 2026-11-12  
**Account scope:** `Erdemhasates35`  
**Selection rule:** personal/original repositories only for implementation; upstream and third-party forks are reference material, never mutation targets.

## 1. Confirmed working set

| Repository | Observed README purpose | Domain | Initial integration role | Evidence |
|---|---|---|---|---|
| `quantum-nexus-os` | Solana orchestration, RPC failover, risk engine, Jito/flash-loan/MEV research, dashboard and agent roles | Quant / Web3 / AI | Portfolio execution research and control plane | README fetched; blob `f515603` |
| `quantum-nexus-os-omega-admin` | React admin, FastAPI, AI router, agents, workflow, PostgreSQL/Redis/vector DB, observability | AI platform / Admin | Shared operator console and agent/workflow patterns | README fetched; blob `179a3b9` |
| `quantum-nexus-unified-core` | Swarm, Solana, Edge Runtime and infrastructure in a monorepo; α-coupling paradigm | Core platform | Candidate shared runtime/contracts | README fetched; blob `2cee825` |
| `honeycomb-execution-core` | Go execution service for Binance/Bitget Futures; paper default; Linux x64 VPS | Execution | Exchange connectivity, order lifecycle, execution metrics | README fetched; blob `42eda53` |
| `honeycomb-omega-x` | Next.js/Vercel control plane; Redis/Postgres state; risk-state machine | Quant control plane | Execution control, dashboards, command routing | README fetched; blob `84cae8d` |
| `crypto-ai-cloud` | GitHub Actions cloud trading; RandomForest, GradientBoosting, neural models; 10-minute automation | ML / Quant | Experiment and scheduled inference patterns | README fetched; blob `dbe8ff2` |
| `ultra-ai-trading-cloud` | Cloud-powered AI trading repository | ML / Quant | Candidate for deeper workflow/code audit | README fetched; blob `7dcd76d` |
| `legal-ai-platform` | Turkish law/ECHR research, source provenance, Supabase, document processing, verification workflows | Legal AI | Provenance graph, citation verification, document intelligence | README fetched; blob `008be30` |
| `eve-slack-agent` | Vercel Eve Slack agent template | Agents / Collaboration | Agent adapters and event-driven collaboration | README fetched; blob `9694b18` |
| `Pythia` | EleutherAI Pythia fork; interpretability, learning dynamics, checkpoints, data reproducibility | LLM research | Research-only model/checkpoint evaluation and interpretability | README fetched; blob `b3ff139` |

## 2. Previously identified personal repositories requiring full verification

These names were previously identified in the account portfolio and are queued for exact metadata/tree inspection:

- `nexus-sovereign`
- `quantum-nexus-unified`
- `smart-futures-arb-ai`
- `nextjs-with-supabase`
- `ArelErdemustunler`
- `ArelSlSuperDepo`

Additional previously identified repositories:
- `honeycomb-terminal`
- `honeycomb_al`
- `honeycomb-execution-core-testnet`
- `quantum-nexus-os-v14*` (exact repository names to be enumerated)
- `nexmon_csi` (ownership/fork status and intended integration to be verified)

## 3. Ownership and fork classification

Every repository must be assigned one of:
- `owned-original`: original repository under the account.
- `owned-fork`: fork under the account; upstream is read-only reference.
- `third-party-upstream`: external reference; never modified.
- `archived-reference`: retained for research; no production dependency without explicit approval.

The GitHub list endpoint returned a 100-item page, including numerous third-party repositories. That page is not treated as 100 original projects. Fork ancestry and ownership flags must be collected from repository metadata before inclusion in the production portfolio.

## 4. Next inventory fields

For each repository, record:
- canonical full name, repository ID, visibility, default branch, fork flag, parent/upstream, archived flag;
- last commit, branch count, open PR/issues, Actions workflow inventory and latest run state;
- root tree, languages, package manifests, build/test/lint commands;
- runtime targets (Termux ARM64, Android, Linux x64, Edge, browser, GPU);
- deploy targets (Vercel, Supabase, GitHub Actions, VPS, device);
- environment-variable names only (never values), secret references, external services;
- data stores, schemas, migrations, APIs, event contracts;
- test coverage, benchmark baselines, operational SLOs;
- license and third-party model/dataset obligations;
- duplicate modules, reusable components, integration candidates;
- evidence links and audit timestamp.

## 5. Priority cohorts

**Cohort A — Platform foundation:** quantum-nexus-os, quantum-nexus-unified-core, quantum-nexus-os-omega-admin.  
**Cohort B — Honeycomb execution:** honeycomb-execution-core, honeycomb-omega-x, honeycomb-terminal, honeycomb_al, honeycomb-execution-core-testnet.  
**Cohort C — Research and AI:** Pythia, crypto-ai-cloud, ultra-ai-trading-cloud, eve-slack-agent.  
**Cohort D — Specialist systems:** legal-ai-platform and remaining scientific/technology repositories.

No repository is merged, renamed, deleted, or rewritten by this inventory.


## 6. Additional repositories identified in the 100-entry owner-affiliated catalog

README-level review also identified:
- `FinRL`: financial reinforcement-learning research framework; see [fork research notes](FORK_RESEARCH_NOTES.md).
- `FinGPT`: financial LLM and sentiment/event intelligence research; see [fork research notes](FORK_RESEARCH_NOTES.md).
- `heretic`: training-free LLM steering and scorer plugins; research-only evaluation candidate.
- `Cirq`: quantum circuit construction, simulation, noise modelling and optimization.
- `agent-skills`: Jupiter ecosystem skills for Codex and Claude Code.
- `claude-code-source-code`: source-analysis repository with an explicit non-commercial/IP notice in its README.
- `AI-Linux`: third-party-origin shell installer reference; upstream attribution appears in its README.

The complete 100-entry owner-affiliated snapshot is in [ACCOUNT_REPOSITORY_CATALOG.md](ACCOUNT_REPOSITORY_CATALOG.md). It includes forks, empty repositories and upstream-derived code; it is not equivalent to 100 original projects.

## 7. Empty / ambiguous repositories observed

- `honeycomb`: README endpoint reports an empty repository.
- `honeycomb-execution-core.`: README endpoint reports an empty repository.
- `honeycomb-al` and `honeycomb_al`: README endpoint returned not-found for the queried path.
- These are retained for exact repository-ID, tree and ancestry reconciliation; no deletion or consolidation is proposed.
