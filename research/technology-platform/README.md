# Erdem Technology Platform — Research & Engineering Workspace

A cross-repository research, architecture, and implementation program spanning quantitative systems, AI/LLM research, autonomous agents, scientific computing, legal intelligence, blockchain infrastructure, Android/Termux engineering, and production operations.

## Operating model

- **Portfolio-first:** classify every owned repository by domain, maturity, dependency, runtime, and integration value before moving code.
- **Evidence-first:** every capability is tagged as implemented, tested, deployed, measured, or proposed. These states are never conflated.
- **Composable:** shared capabilities are published as versioned contracts and libraries; domain systems retain independent release cycles.
- **Research-to-production:** paper/research findings become reproducible experiments, then benchmarked modules, then controlled production integrations.
- **Device-aware:** Android/Termux is the mobile control, diagnostics, lightweight compute, and remote orchestration plane; GPU/cloud/Linux x64 workloads run where the hardware and ABI fit.
- **Performance-led:** optimize measured throughput, latency, cost, reliability, model quality, developer cycle time, and economic outcomes.

## Documents

- [Portfolio inventory](REPOSITORY_INVENTORY.md)
- [Reference architectures and research map](RESEARCH_ARCHITECTURE.md)
- [Engineering backlog and acceptance matrix](IMPLEMENTATION_BACKLOG.md)
- [Termux / Android engineering playbook](TERMUX_ANDROID_PLAYBOOK.md)
- [Evidence and benchmark protocol](EVIDENCE_PROTOCOL.md)
- [100-entry account repository catalog](ACCOUNT_REPOSITORY_CATALOG.md)
- [Fork research notes: FinRL, FinGPT, Heretic, Cirq, agents](FORK_RESEARCH_NOTES.md)

## Initial repository set

Confirmed from repository README retrieval on 2026-11-12:
- `Erdemhasates35/quantum-nexus-os`
- `Erdemhasates35/quantum-nexus-os-omega-admin`
- `Erdemhasates35/quantum-nexus-unified-core`
- `Erdemhasates35/honeycomb-execution-core`
- `Erdemhasates35/honeycomb-omega-x`
- `Erdemhasates35/crypto-ai-cloud`
- `Erdemhasates35/ultra-ai-trading-cloud`
- `Erdemhasates35/legal-ai-platform`
- `Erdemhasates35/eve-slack-agent`
- `Erdemhasates35/Pythia`

This is a verified working set, not a claim that the full account inventory is complete. The portfolio inventory document keeps observed facts separate from inference.

## OMNIQUANT CORE implementation boundary

- [OMNIQUANT CORE boundary and production gates](OMNIQUANT_CORE_BOUNDARY.md)
- [Phase 02 read-only repository evidence scanner](PHASE_02_AUDIT_SCANNER.md)
- [Quantum Nexus OS forensic findings](CORE_REPOSITORY_FORENSIC_FINDINGS.md)
- Scanner: `tools/repo_audit.py`; tests: `tests/test_repo_audit.py`
- [Python package configuration](pyproject.toml)
- `src/omniquant_core/`: typed observation/intent/guard contracts and standalone fail-closed risk evaluator.
- `tests/test_omniquant_core.py`: deterministic risk-policy and contract tests.
- The Scout → Cartographer → Judge → Guard → Executor multi-agent runtime, cloud intelligence adapters, live market feeds, order execution, and command-center UI remain unimplemented; see the boundary document before any production integration.

## Architecture principle

The platform is not one giant runtime. It is a federation of bounded systems connected through explicit event schemas, APIs, model contracts, telemetry, and reproducible experiment records.
