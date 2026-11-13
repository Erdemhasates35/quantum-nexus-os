# Multi-repository tree and runtime audit — priority portfolio

**Snapshot:** 2026-11-13  
**Method:** GitHub REST repository metadata, recursive default-branch Git trees, selected source/manifests/workflows.  
**Scope boundary:** this is a targeted tree/source audit of priority repositories, not a full semantic audit of every repository in the account.

## 1. Verified repository structure

| Repository | Tree entries | Blob files | Workflows | Verified observation |
|---|---:|---:|---:|---|
| quantum-nexus-os | 760 | 748 | Existing root workflows | 12 gitlinks; no .gitmodules; tracked logs/backups/archive |
| quantum-nexus-os-omega-admin | 89 | 60 | 0 | Multi-package Next.js/TypeScript and Python API; Dockerfiles and Compose |
| quantum-nexus-unified-core | 9,121 | 8,374 | 0 | 8,361 tracked files under app/node_modules; root and app package manifests |
| honeycomb-execution-core | 2,335 | 1,899 | 2 | 1,511 paths with backup/recovery/broken naming; Go, Node and Python manifests |
| honeycomb-omega-x | 26 | 23 | 0 | Small Next.js control-plane repository; no execution engine tree |
| crypto-ai-cloud | 5 | 3 | 1 | Python model script plus 10-minute scheduled workflow; code contains live Binance Futures market-order calls |
| ultra-ai-trading-cloud | 5 | 3 | 1 | Workflow existed without its referenced trading script or requirements manifest; credential cleanup merged separately |
| legal-ai-platform | 127 | 77 | 1 | Next.js/Supabase application with deployment workflow |
| eve-slack-agent | 17 | 13 | 0 | Small agent template; not a verified production deployment |

Tree counts are snapshots, not performance or completeness claims. No tree in this table was truncated by GitHub's recursive tree response.

## 2. P0/P1 technical findings

### A. quantum-nexus-unified-core — tracked node_modules

- 8,361 tracked blobs are under app/node_modules.
- Root .gitignore contains only .vercel and .env*.local patterns; it does not exclude node_modules.
- Root and app each contain a package.json; package-lock.json files exist at both root and app.
- No GitHub Actions workflow was found in the default-branch tree.
- README declares "Production Ready", but that statement is not build, deployment, security or test evidence.

**Decision:** do not delete or regenerate tracked dependencies in this audit. First capture lockfile and package-tree checksums, establish the intended workspace boundary, and compare a clean reproducible install in a separate branch. Then propose removal of vendored node_modules only with a verified lockfile and explicit review.

### B. honeycomb-execution-core — execution success was not a venue receipt

- README describes a Go Binance/Bitget Futures service and states paper mode is the default.
- The Go router used hardcoded edge-cost constants instead of a connected live order-book/edge provider.
- In live mode it logged that a signed REST order would be connected later, but still inserted a local position and returned Success=true without sending or receiving a venue order.
- Close marked a local position closed without a venue close receipt.
- The router therefore could misrepresent an internal state mutation as an executed exchange order.
- PR #10 was merged on 2026-11-13. The Go router now fails closed for live and paper orders until real adapters are connected; Go tests and go vet passed in GitHub Actions. No live adapter is claimed.
- 1,511 tracked paths have backup/recovery/broken/yedek-style names. Preserve them; classify before any cleanup.
- The repository has Go, Node and Python manifests. Treat this as a polyglot repository until service boundaries and dependency ownership are documented.

### C. crypto-ai-cloud — real-order path lacks independent risk evidence

- The Python script initializes CCXT Binance Futures with sandbox=false.
- It calls create_market_buy_order / create_market_sell_order and sets leverage; this is a real-market order path when valid exchange secrets are supplied.
- It has no stop-loss or take-profit code in the reviewed source.
- Position sizing uses a fraction of the current capital and leverage up to 10x; no independent Guard service is connected.
- When reported USDT balance is zero, the script substitutes the configured initial capital of 20.0 as current capital. That is not an observed account balance and must not be reported as real equity.
- The model trains on recent OHLCV samples without a chronological out-of-sample evaluation in the reviewed path.
- Confidence is calculated as 1 minus the standard deviation of three model predictions. This is not a calibrated probability or empirically validated confidence score.
- The prior GitHub Actions workflow scheduled execution every 10 minutes and injected exchange credentials from GitHub Secrets.
- On 2026-11-13 the workflow was changed on main to manual-only, execution-disabled status; no secrets are loaded and no trading script is started.
- The Python source still contains a direct live order path if invoked outside that workflow. Keep it excluded until the independent Guard and controls are implemented.

**Decision:** exclude this engine from autonomous capital allocation until account-state handling, independent Guard approval, calibrated confidence, loss controls, idempotency, reconciliation, live telemetry and out-of-sample evidence are implemented and verified. No live order was submitted during this audit.

### D. ultra-ai-trading-cloud — credential and entrypoint defect

- The previous public workflow contained literal Binance and Bitget credential values.
- The workflow also referenced ultra_cloud_system.py, absent from the default-branch tree, and no requirements.txt existed.
- PR #1 was merged on 2026-11-13. Current workflow removes literal credentials, removes scheduled execution, requires GitHub Secrets and fails closed if source/dependency manifests are missing.
- The exposed values may remain in Git history. They must be revoked/rotated at the exchanges; a file update cannot revoke credentials or erase history.

### E. honeycomb-omega-x — control plane, not an execution engine

- 23 blob files, one package manifest, no workflow files in the default tree.
- README describes a Vercel control plane and separate Linux VPS execution core.
- Package manifest uses Next.js 14.2.5, React 18 and ESLint 8.
- No current deployment was validated in this tree review.

**Decision:** integrate only as a future operator UI adapter after authentication, API contracts, telemetry and deployment checks. Do not treat it as an order engine.

### F. Other platform repositories

- quantum-nexus-os-omega-admin: multi-package workspace with Next.js frontends, Python API, Dockerfiles and Compose; no workflow files observed in its default tree.
- legal-ai-platform: Next.js/Supabase project with package lockfile and deployment workflow; preserve a separate legal-data/privacy/security boundary.
- eve-slack-agent: minimal Vercel Eve template with evolving dependencies; use as a template/reference until exact runtime and deployment are pinned.

## 3. Integration decisions

1. No direct bulk-copy of these repositories into one runtime.
2. Integrate via versioned adapters and shared event contracts only after ownership, license, runtime, security and test evidence is recorded.
3. Exclude all live order paths from OMNIQUANT until the independent Guard and venue receipt checks are enforced.
4. Keep all existing backup/recovery files and vendored dependency trees untouched until a checksum-backed cleanup PR is reviewed.
5. Do not claim a deployment, scheduled run, live trade, profitability or model calibration without corresponding run/receipt/telemetry evidence.
