# Fork Research Notes — Finance, LLMs, Agents, Quantum and Developer Systems

**Inspection date:** 2026-11-12  
**Method:** repository README fetched from the account's owner-affiliated GitHub inventory. README content is direct evidence of declared scope, not proof of implementation quality or fork ancestry.

## 1. FinRL — financial reinforcement learning

**Account repository:** https://github.com/Erdemhasates35/FinRL  
**Observed README:** identifies itself as the original FinRL framework for education, benchmarking and research; describes the FinRL-Meta → FinRL → FinRL-X ecosystem and points production-oriented development toward FinRL-Trading.

### Extract
- data/environment/agent separation;
- Gym-style environment contracts;
- DRL baselines (PPO, SAC, TD3, DDPG, A2C);
- repeatable train/validate/test workflow;
- portfolio and execution cost modelling;
- experiment configuration and benchmark discipline.

### Integrate
- Create an adapter boundary, not a wholesale dependency: `MarketEnvironment`, `AgentPolicy`, `PortfolioState`, `ExecutionSimulator`.
- Compare RL policies against naive, linear, tree-based and supervised forecasting baselines.
- Use chronological walk-forward evaluation, transaction costs, funding, liquidity, market impact and turnover.
- Record seeds, environment version, data manifest and policy artifact digest.
- Treat FinRL-X / FinRL-Trading as a separate upstream reference for modern modular production architecture; inspect its current license and interfaces before adopting any code.

### Do not infer
The existence of DRL algorithms or a high backtest reward does not establish persistent market edge or live profitability.

## 2. FinGPT — financial language models

**Account repository:** https://github.com/Erdemhasates35/FinGPT  
**Observed README:** financial LLM research, financial sentiment analysis, instruction tuning, forecasting and FinGPT benchmark references.

### Extract
- finance-specific text classification and sentiment tasks;
- domain instruction-tuning and LoRA experiment patterns;
- financial benchmark construction;
- retrieval-augmented financial analysis;
- text/news event extraction and structured outputs.

### Integrate
- Start with event extraction and sentiment classification as *features*, not direct order signals.
- Preserve source URL, publication timestamp, ingestion timestamp, entity/ticker mapping, event type and model confidence.
- Add event freshness decay and source reliability evaluation.
- Evaluate sentiment against point-in-time market reactions and out-of-sample outcomes.
- Compare FinGPT-derived features with simple lexical and general-purpose model baselines.
- Separate financial text knowledge from numerical price/volume forecasting.

## 3. Heretic — training-free model steering

**Account repository:** https://github.com/Erdemhasates35/heretic  
**Observed README:** training-free LLM modification via contrastive prompts and scorer plugins; supports on-the-fly 4-bit quantization and scorer-driven optimization.

### Extract
- scorer plugin interface;
- hardware-aware batch-size benchmarking;
- controlled model variants and evaluation;
- quantization-aware inference profiling;
- optimization against explicit behavioral metrics.

### Integrate
- Use the scorer abstraction as an experimental evaluation pattern for domain-specific agent behavior.
- Build a model-behavior benchmark suite for tool correctness, citation faithfulness, structured output validity and task completion.
- Benchmark quantization for memory/latency/quality trade-offs on supported hardware.
- Keep model steering experiments in a research branch and record base-model digest, config, prompts, scorer code and benchmark outputs.

### Important repository constraint
The observed README describes refusal suppression/censorship removal as a default behavior. This is not a suitable default for a platform agent. Use only task-specific, lawful, measurable scorer experiments and retain policy, provenance and capability boundaries. The README's project-specific license and upstream provenance must be checked before reuse.

## 4. Cirq — quantum circuit research

**Account repository:** https://github.com/Erdemhasates35/Cirq  
**Observed README:** Python toolkit for quantum circuits, simulation, noise models, circuit transformations and optimization; README links to Quantum AI documentation and quantumlib/Cirq.

### Extract
- parameterized circuit construction;
- circuit transformation and compilation;
- noise-aware simulation;
- hardware-device abstraction;
- reproducible quantum experiments.

### Potential scientific track
- Explore quantum optimization only for a precisely formulated combinatorial subproblem (e.g. constrained portfolio selection) and compare against classical solvers.
- Build small simulators and noise-aware experiments before any hardware claim.
- Compare solution quality, runtime, sample complexity and total cost with classical baselines.
- Do not claim quantum advantage from toy instances or simulator-only results.

## 5. Agent Skills — tool integration patterns

**Account repository:** https://github.com/Erdemhasates35/agent-skills  
**Observed README:** packages Jupiter ecosystem agent skills for Codex and Claude Code, including swap migration, lending and token verification skills.

### Extract
- portable skill packaging;
- provider-specific adapters;
- single installer entrypoint;
- typed domain knowledge and workflow instructions;
- versioned integration playbooks.

### Integrate
- Create a shared internal skill catalog for Solana, EVM, market data, Supabase, Vercel, legal document analysis, research and Termux operations.
- Define skill manifests with name, version, tool requirements, input/output schemas, tests and provenance.
- Add offline validation and compatibility checks before installing skills in a project.
- Reuse Jupiter-specific skills only where the associated API and terms support the intended use.

## 6. Claude Code source analysis repository

**Account repository:** https://github.com/Erdemhasates35/claude-code-source-code  
**Observed README:** claims source extraction from an Anthropic npm package and contains an explicit notice that the source is Anthropic intellectual property and commercial use is prohibited.

### Research-only treatment
- Use the repository's authored architectural analysis as a study reference only after verifying provenance and rights.
- Do not copy extracted proprietary source into commercial or production code.
- Reimplement general ideas independently from public documentation and clean-room specifications.
- Preserve attribution and licensing evidence for any analysis reused.

## 7. AI-Linux

**Account repository:** https://github.com/Erdemhasates35/AI-Linux  
**Observed README:** beginner-oriented Kali Linux shell installer and basic tool setup; README attributes the original project to Siddhant Saaho and points to SiddhantOffl/AI-Linux.

### Integrate
- Treat as an upstream installer reference, not as an owned original implementation until ancestry is verified.
- Extract only general ideas for an interactive, idempotent Termux setup interface.
- Do not run its Kali-oriented installation commands in Termux without a platform-specific compatibility review.

## 8. Honeycomb repositories with empty or ambiguous README access

The owner inventory contains `honeycomb`, `honeycomb-execution-core.`, `honeycomb-al`, `honeycomb_al`, `honeycomb-execution-core` and `honeycomb-omega-x`. README retrieval reported empty repositories for `honeycomb` and `honeycomb-execution-core.`; README retrieval for two alternate spellings returned not-found. The working repositories with readable README are documented in the portfolio inventory.

Next inspection must compare exact repository IDs, default branches, commit history, fork parent and tree contents to determine whether these are empty placeholders, renamed duplicates or independent codebases.

## 9. Additional account repository domains observed in the owner inventory

The account's owner-affiliated repository listing also includes names associated with:
- blockchain / Solana / EVM: `anchor`, `foundry`, `solidity`, `bitcoin`, `chainvote`, `autoclock-rpc`, `cipher-solana-bot-toolkit`, `token-lists`, `wallet-core`, `nft-contracts`;
- Android / Termux / device: `termux-app`, `termux-packages`, `termux-boot`, `termux-core-package`, `termux-ndk`, `termux-ubuntu`, `android`, `AndronixOrigin`;
- AI / developer agents: `agent-skills`, `claude-code-source-code`, `DeepSeek-Coder-V2`, `llama-coder`, `python-genai`, `eliza`, `eve-slack-agent`;
- scientific / quantum: `Cirq`;
- finance: `FinRL`, `FinGPT`, `crypto-ai-cloud`, `binance-connector-python`, `binance-futures-connector-python`, `binance-public-data`, `bitget-api`;
- infrastructure / observability: `docker`, `grafana`, `datasets`, `jax`, `transformers`, `poetry`, `sqlalchemy`, `black`.

Names alone do not prove repository ownership of code, originality, current relevance, license compatibility or production readiness. Those properties require repository metadata and code-tree inspection.

## 10. Research sources

- FinRL-Meta layered data/environment/agent architecture: https://github.com/AI4Finance-Foundation/FinRL
- Qlib AI-oriented quantitative research platform: https://github.com/microsoft/qlib
- Pythia paper: https://proceedings.mlr.press/v202/biderman23a.html
- FinGPT research: https://github.com/AI4Finance-Foundation/FinGPT
- Cirq documentation: https://quantumai.google/cirq
- Heretic project: https://github.com/p-e-w/heretic
- Agent Skills format: https://agentskills.io/
- NautilusTrader architecture: https://nautilustrader.io/docs/latest/concepts/architecture/

## 11. Prioritized research outcomes

1. FinRL + Qlib + NautilusTrader comparison matrix and adapter design.
2. FinGPT event intelligence benchmark with source-time correctness.
3. Pythia/GPT-NeoX/OLMo model research and checkpoint lineage.
4. Heretic scorer methodology adapted to quality/faithfulness evaluation, not refusal suppression.
5. Cirq-based small-instance quantum optimization study against classical baselines.
6. Cross-provider agent skill registry and compatibility harness.
7. Honeycomb repository ancestry and duplicate resolution.
8. Termux package and Android runtime compatibility matrix.
