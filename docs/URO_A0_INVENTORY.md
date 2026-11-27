# URO A0 — Inventory and truthfulness audit

## Status

Maturity: L2 for exact Git-blob inventory, source classification and static extraction. Semantic truth verification remains a separate review task: source prose, comments, identifiers and regex candidates do not prove live runtime behavior.

The authoritative A0 evidence is the JSON artifact emitted by the URO A0 and A1 Verification workflow. It records the exact checkout commit for each repository and every tracked Git blob, blob SHA, mode, size, file classification, text/binary classification, line-attributed numeric literals, α references, alpha identifiers, claim candidates, Python AST symbols, cross-language symbol candidates, HTML IDs/classes and CSS selectors. Aggregate counts are snapshot-specific and are intentionally kept in the machine-generated artifact rather than copied into this report; this prevents the report's own literals from becoming stale evidence.

## Scope and extraction method

The inventory is built from each checked-out Git commit, using `git ls-tree -r` and `git cat-file --batch`. Each requested blob SHA is compared with the object ID returned by Git before its content is scanned. The scanner therefore analyzes committed Git-object bytes rather than potentially modified worktree files.

UTF-8 text blobs are scanned for line-attributed literals, contextual alpha references, claim candidates and source symbols. Binary and non-UTF-8 blobs remain inventoried by exact path/SHA/mode/size and are not interpreted as source text.

Path-scope classification separates:
- repository source/config;
- generated/dependency content;
- documentation/legal material;
- backups/archives;
- reference/vendor candidates;
- assets;
- tests/fixtures.

Python functions and classes are extracted through Python AST. Other-language functions/types and React components are lexical candidates only. They are not compiler/parser-certified symbol tables. The artifact includes per-scope counts so dependency/vendor/generated candidates are not misrepresented as first-party application code.

A small number of very long lines are excluded only from regex-based cross-language symbol extraction. Git blob acquisition and line-based numeric/alpha extraction still read the full blob bytes. The artifact separately reports skipped lines and Python parse errors.

## Number and claim semantics

- A numeric token is a source literal, not automatically a live price, time, slot, probability, profit or measured KPI.
- The literal inventory is a forensic index. Every entry carries path, line and surrounding source context so its role can be classified as a hard-coded constant, formula coefficient, test vector, UI text, protocol limit, build metadata, or unrelated third-party value.
- `claim_candidates` are lines selected by lexical heuristics (for example, “production”, “guarantees”, “atomic” or “reproducible”). They are review queues, not a declaration that each line is a factual claim.
- Runtime values can only be tagged [CANLI-KAYNAK] after a real source adapter captures the response, source identity, timestamp/slot, unit, freshness and verification evidence. The static source scan cannot make that determination.

## α findings

The static matcher finds both physical-constant references and ordinary uses of the word/character “alpha”. These matches must not be conflated. The artifact retains every hit with file path, line and context.

The engineering-relevant uses found in Nexus include:

- `index.html` logo α: symbolic branding.
- `index.html` footer `α = 0.00729735256`: the physical fine-structure reference appears as display text. The same footer says it is not used as a trading threshold.
- `autonomous-swarm.html` and preserved backups: α and β are symbolic MARL reward weights in a displayed expression, not the physical constant.
- `frontend/public/index.html`: α-Coupled is legacy architecture branding, not a physical coupling model.
- `QUANTUM_NEXUS_ACADEMIC_ANALYSIS_AND_OPTIMIZATION_REPORT.md`: α-Coupling and α-Efficiency are legacy architecture claims. Preserve the document, but do not treat those claims as active engineering specifications.
- `docs/architecture/v16-swarm-execution-contract.md` explicitly rejects the fine-structure constant as an arbitrage threshold or profit predictor.
- `alpha_observations`, `alpha` telemetry kinds and “alpha discovery” are financial-signal/research terminology. They are not the fine-structure constant and must not be renamed on lexical similarity alone.
- Third-party C driver sources and TypeScript DOM/WebGPU declarations contain ordinary alpha-channel/parameter identifiers. They are not Nexus strategy parameters.

The raw match totals include documentation, the audit report itself, third-party/vendor files and generated dependencies. They are not unique physical-constant use counts. No numerical conversion from α to κ is defined; κ is independent of α.

## Heretic source, tests and governance findings

Heretic is the `Erdemhasates35/heretic` fork/reference of `p-e-w/heretic`, licensed under AGPL-3.0. CI checks it out read-only; the fork is not treated as an original Nexus implementation target.

The checked-out source contains these unit-test modules:

- `test_ara_lowrank_equivalence.py`
- `test_chat_template.py`
- `test_config.py`
- `test_keyword_rate.py`
- `test_plugin.py`
- `test_residual_streams.py`

The separate `tests/run_tests.py` runner is a model-output reproducibility harness driven by model-specific `config.toml` and `SHA256SUMS` files. It is not the same as the unit-test suite. CI unit-test results do not certify model/hardware output matrices or model quality.

The root `ETHICS.md` file is absent. The README describes refusal suppression and censorship removal as core functionality. The AGPL-3.0 license is present. The following specifically requested paths are absent from the checked-out tree: `tests/test_reproduce.py`, `tests/test_utils.py`, and `tests/test_system.py`. Their absence does not prove that no related tests exist; the full tracked tests directory is in the evidence artifact.

The plugin protocol is real source code: `ScorerConfig`, `ModifierConfig`, plugin loading/validation, effective plugin-settings export and reproduce serialization are present. The test suite covers several reproducibility/plugin settings paths, but does not yet constitute full model-output reproducibility certification.

## Structural issue — Nexus gitlinks

The Nexus Git tree contains tracked gitlinks while `.gitmodules` is absent. The inventory records every exact path and commit SHA. Gitlink object IDs alone do not identify remote URLs. No URL was invented, no gitlink was initialized, and no repository metadata was rewritten.

This can produce non-fatal checkout/submodule cleanup warnings. Resolve each remote URL, upstream identity, license and pinned commit from authoritative repository metadata before adding a `.gitmodules` mapping.

## Verification protocol

The URO workflow runs:
- repeated κ and existing economics unit tests;
- the existing flashloan quality test set;
- Python bytecode compilation;
- A0 scanner unit tests;
- read-only exact Git-blob inventory for Nexus and Heretic;
- the Heretic locked unit-test suite in a separate job, repeated independently.

The workflow evidence artifact contains the exact source snapshot, per-file hashes, complete path inventory and context-bearing static extraction results. Test results are attached to the exact workflow run/commit; they are not claims about live chain execution, realized PnL or production availability.

## Rollback and preservation

The scanner, tests, κ arithmetic and documentation are additive. No existing Nexus or Heretic file is deleted. Historical α references, HTML backups and schema identifiers remain present. The URO changes remain on the dedicated branch and an unmerged pull request. Production application configuration, production database configuration, wallets and exchange execution settings are unchanged by A0/A1.
