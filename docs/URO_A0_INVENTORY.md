# URO A0 — Inventory and truthfulness audit

## State

Maturity: L2 for the read-only inventory and extraction pipeline. Semantic
truth verification remains a separate review task; a source statement is not
proof that the described runtime behavior exists.

The evidence artifact is produced by the URO A0 and A1 Verification workflow.
It records the exact checkout commit for each repository and includes every
tracked Git blob, SHA, mode, file classification, text-literal inventory,
Python AST symbols, cross-language symbol candidates, HTML identifiers and
classes, CSS selectors, α references, alpha-prefixed identifiers, and
claim-candidate lines.

## Scope and classification

- Quantum Nexus OS is scanned from the workflow checkout commit.
- Heretic is scanned from the checked-out Erdemhasates35/heretic fork, with
  upstream identity recorded as p-e-w/heretic.
- UTF-8 text files are scanned line by line. Binary files are inventoried by
  path, Git blob SHA, mode and size; binary contents are not interpreted as
  source text.
- Every numeric token is tagged as a source literal. This does not imply a
  live measurement, operational KPI, validated constant or trading result.
- Prose and code-comment candidates are tagged UNVERIFIED until matched to
  source code, test evidence, official documentation or a mathematical proof.
- Cross-language function and type counts are candidates, not guaranteed
  parser-level declarations. Python function/class counts use the Python AST.

## α findings

The source-level distinctions are:

- index.html logo α: symbolic branding.
- index.html footer α = 0.00729735256: a physical-reference string; the same
  footer explicitly says it is not an unvalidated trading threshold.
- autonomous-swarm.html and its preserved backups: α and β are symbolic MARL
  weighting parameters in the displayed reward expression.
- frontend/public/index.html α-Coupled: legacy architecture branding; it is
  not a physical coupling model.
- QUANTUM_NEXUS_ACADEMIC_ANALYSIS_AND_OPTIMIZATION_REPORT.md: α-Coupling and
  α-Efficiency are legacy architecture claims; preserve the document, but do
  not use those claims as current engineering specifications.
- v16-swarm-execution-contract.md explicitly rejects the fine-structure
  constant as an arbitrage threshold or profit predictor.
- alpha_observations and alpha telemetry are financial-signal/schema names;
  they are not the fine-structure constant and must not be renamed merely
  because of the shared word.

The κ implementation is independent of α. No numerical conversion from α to
κ is defined.

## Heretic test and governance findings

The checked-out Heretic source contains these unit-test modules:

- test_ara_lowrank_equivalence.py
- test_chat_template.py
- test_config.py
- test_keyword_rate.py
- test_plugin.py
- test_residual_streams.py

The separate tests/run_tests.py runner is a model-output reproducibility
harness driven by model-specific config.toml and SHA256SUMS files. It is not
the same as the unit-test suite. The unit-test suite is executed in CI; the
model-specific run is not represented as executed by that unit-test result.

The root ETHICS.md file is absent. The README describes refusal suppression
and censorship removal as core functionality. The AGPL-3.0 license is
present. These facts require a documented research-use policy and legal
review before the platform presents Heretic as a production service.

The following specifically requested test paths are absent from the
checked-out tree: tests/test_reproduce.py, tests/test_utils.py and
tests/test_system.py. Their absence does not prove that no related tests exist;
the full tracked tests directory is included in the evidence artifact.

## Structural finding

The Nexus Git tree contains tracked gitlinks while .gitmodules is absent.
The scanner records the exact paths and commit SHAs. Their repository URLs
cannot be reconstructed from Git object IDs alone. No URL was invented and
no gitlink was initialized or changed. This produces checkout cleanup
warnings but did not fail the A0/A1 test jobs.

## Rollback and preservation

The scanner and κ implementation are additive. No original Nexus or Heretic
file is deleted. The Heretic fork is checked out read-only in CI. The URO
changes remain on a dedicated branch and an unmerged pull request. The
production application, production database and exchange execution settings
are not modified by these additions.
