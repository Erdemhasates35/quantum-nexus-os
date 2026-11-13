# Repository ownership and provenance audit — priority portfolio

**Audit date:** 2026-11-13  
**Evidence:** GitHub REST repository metadata for each exact repository path.  
**Interpretation:** fork=true is direct evidence of fork ancestry; fork=false only means GitHub does not mark the repository as a fork. It does not independently prove authorship or third-party license clearance.

## A. Confirmed account-owned non-fork candidates

| Repository | Visibility | Default branch | Primary language | License metadata | Status |
|---|---|---|---|---|---|
| quantum-nexus-os | Public | main | C | MIT | Candidate for implementation; 760-entry tree reviewed; 12 unresolved gitlinks |
| quantum-nexus-os-omega-admin | Private | main | TypeScript | Not declared | Candidate; full tree/dependency review pending |
| quantum-nexus-unified-core | Public | main | TypeScript | Not declared | Candidate; full tree/dependency review pending |
| honeycomb-execution-core | Public | main | Python | Not declared | Candidate; README describes execution service; source/runtime audit pending |
| honeycomb-omega-x | Public | main | TypeScript | Not declared | Candidate; README describes control plane; source/runtime audit pending |
| crypto-ai-cloud | Public | main | Python | Not declared | Candidate; last updated 2025-09-30; activity/maintenance review required |
| ultra-ai-trading-cloud | Public | main | Not detected | Not declared | Candidate; last updated 2025-12-29; source audit pending |
| legal-ai-platform | Public | main | TypeScript | Not declared | Candidate; separate legal-data and privacy boundary required |
| eve-slack-agent | Private | main | TypeScript | Not declared | Candidate; private repository; access-controlled audit required |
| honeycomb | Public | main | Not detected | Not declared | Non-fork metadata; README endpoint was empty; inspect tree before assigning purpose |
| honeycomb-al | Private | main | JavaScript | Not declared | Non-fork metadata; private source audit pending |
| honeycomb_al | Private | main | JavaScript | Not declared | Non-fork metadata; private source audit pending |
| nexus-sovereign | Public | main | Not detected | Not declared | Candidate; README/tree inspection pending |
| quantum-nexus-unified | Public | main | Not detected | Not declared | Candidate; README/tree inspection pending |
| smart-futures-arb-ai | Public | main | Not detected | Not declared | Candidate; README/tree inspection pending |
| nextjs-with-supabase | Private | main | Not detected | Not declared | Candidate; private source audit pending |
| ArelErdemustunler | Public | main | Not detected | Not declared | Candidate; project role pending |
| ArelSlSuperDepo | Public | main | Not detected | Not declared | Candidate; project role pending |

## B. Confirmed forks — reference-only, do not modify

| Account repository | Parent / upstream | License metadata | Intended treatment |
|---|---|---|---|
| pythia | EleutherAI/pythia | Apache-2.0 | Research reference; checkpoints/interpretability adapter only |
| FinRL | AI4Finance-Foundation/FinRL | MIT | Research reference; adapter and evaluation protocol only |
| FinGPT | AI4Finance-Foundation/FinGPT | MIT | Research reference; source-attributed NLP/financial feature adapter only |
| heretic | p-e-w/heretic | AGPL-3.0 | Research reference; license compatibility review before any distribution |
| Cirq | quantumlib/Cirq | Apache-2.0 | Scientific reference; isolated quantum research workloads |
| agent-skills | jup-ag/agent-skills | MIT | Reference; select compatible skills and preserve provenance |
| claude-code-source-code | happynocode/claude-code-source-code; source field reports sanbuphy/learn-coding-agent | No license metadata | Do not copy into product; source/IP rights unresolved |
| AI-Linux | SiddhantOffl/AI-Linux | No license metadata | Do not execute in Termux or integrate as an installer; third-party provenance and commands require review |

## C. Repository names not accessible at audit time

| Name | API result | Treatment |
|---|---|---|
| honeycomb-terminal | HTTP 404 / Not Found | No assumption that it exists; retain as unresolved historical name |
| honeycomb-execution-core-testnet | HTTP 404 / Not Found | No assumption that it exists; retain as unresolved historical name |

## D. Portfolio policy decisions

1. Only Section A repositories may be considered for implementation, and only after source history, license, dependencies, security and tests are reviewed.
2. Section B forks remain read-only research sources. No commits, branch changes or copied code are made in those repositories.
3. Missing license metadata is a release blocker for code redistribution until provenance and rights are established.
4. AGPL-3.0 Heretic requires a deliberate legal compatibility review before incorporating or distributing derivative/combined work.
5. No private repository content is included in public reports beyond metadata already returned by the authenticated GitHub connection.
6. The 100-entry owner-affiliated catalog is not 100 original repositories. This document is a priority cohort only, not a claim that every repository has been fully audited.

## E. Next required evidence

- Capture commit ancestry and contributors for every Section A candidate.
- Retrieve full recursive trees and all package/build manifests.
- Identify workflow files, latest CI outcomes, deployment targets and runtime requirements.
- Read source modules and tests for all strategy, execution, risk and data pipelines.
- Produce dependency SBOMs and license inventory before any code-level merge.
- Reconcile the unresolved names and 12 gitlinks without deleting or rewriting any source.
