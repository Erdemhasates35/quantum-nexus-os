# Phase 02 — repository evidence scanner

## Purpose
The earlier 100-entry owner-affiliated catalog was not a complete original-project inventory and only a limited set of README files had been inspected. This scanner closes the metadata and default-branch tree discovery gap through the authenticated GitHub REST API.

## Safety properties
- GET requests only; no repository contents, settings, branches, releases or secrets are changed.
- Requires GITHUB_TOKEN or GH_TOKEN in the environment. The token is never printed or written to reports.
- Requests repositories with owner affiliation and filters them to the requested owner login.
- Records fork, parent and source metadata; fork repositories are classified as reference-only.
- Recursively inventories default-branch Git trees and identifies manifests and GitHub Actions workflows.
- Writes JSON and Markdown evidence into a new directory. Existing output directories are rejected to prevent overwrite.
- Reports truncated trees and API failures explicitly.

## Run from a cloned working copy
Set a fine-grained token with read-only repository metadata and contents permissions, then run:

    python research/technology-platform/tools/repo_audit.py --owner Erdemhasates35 --output-dir repo-audit-UTC_TIMESTAMP

The script accepts GITHUB_TOKEN or GH_TOKEN. Avoid placing token values in shell history.

## Evidence boundary
The report is complete only if pagination finishes and every repository tree is non-truncated. It does not inspect source-code semantics, dependency resolution, test execution, deployment state, secret values or license compatibility. A non-fork repository is only a candidate for originality review; commit history, authorship and provenance still require verification.

## Tests
Pure classification and tree parsing tests are in tests/test_repo_audit.py. They do not represent market simulation or live trading evidence.
