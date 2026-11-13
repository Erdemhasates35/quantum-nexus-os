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


## 4. Quantum Nexus OS — source-level engine map

### Repository tree composition

- 760 tree entries, 748 blobs; GitHub did not mark the recursive tree as truncated.
- Major top-level areas: nexmon_csi (247 entries), node_modules (144), .next (50), nexus (27), research (26), flashloan_engine (20), logs (17), backups (13), .tools (10), scripts (8), tests (8), config (7), contracts (2).
- File types include C/header sources, TypeScript, Python, JSON, JavaScript, shell scripts and workflow YAML.
- Tracked node_modules, .next, logs and backup/archive paths require provenance and reproducibility review; do not delete in-place.
- nexmon_csi is a wireless channel-state-information research/code subtree. It is a separate scientific/wireless domain, not a financial execution dependency.

### Flashloan engine — observed module responsibilities

- economics.py: Decimal-based gross/net profit, loan fee, swap fee, gas, slippage and priority-cost accounting.
- risk.py: fail-closed threshold checks for route trust, slippage, gas and minimum net profit.
- circuit_breaker.py: consecutive-failure and realized-loss trip conditions.
- optimizer.py: candidate size ranking by net profit, gas efficiency, ROI and latency.
- provenance.py / audit.py: canonical JSON fingerprints, quote-age check and opportunity audit record.
- routes.py: executor allowlist, hop limit and calldata presence validation.
- executor.py: plan-only path; submit returns live_execution_disabled or live_submission_not_implemented.
- live_evm.py: separate direct EVM transaction path; it can preflight and broadcast a signed transaction only when FLASHLOAN_LIVE_EXECUTION=true.
- solana.py: Jupiter quote retrieval and implied-return calculation; no Solana flash-loan transaction execution is implemented.
- binance.py: ticker and signed account read; it is not an on-chain flash-loan lender or a Binance order executor.
- AaveFlashArbReceiver.sol: owner-controlled target allowlist, atomic flashloan callback, repayment/sponsor-fee/minimum-profit invariant.

### Integration and production gaps

- scripts/run_flashloan_engine.py only constructs the orchestrator and prints capabilities; it does not run an end-to-end market-data-to-order cycle.
- The orchestrator's economic/risk evaluation is not wired to the direct LiveEvmExecutor.execute method through a separately deployed Guard authorization boundary.
- SafeExecutor.submit explicitly refuses live submission; direct LiveEvmExecutor.execute is a distinct code path that can broadcast if called with the environment flag and a configured signer.
- Existing tests validate deterministic economics, control boundaries and ABI encoding; they do not prove live RPC execution, deployed receiver correctness, on-chain profit or end-to-end Guard enforcement.
- Contract source exists, but deployment address, verified bytecode, protocol approvals, live liquidity, funded signer and successful transaction receipt were not verified in this audit.
- Before any live integration: require an independent Guard approval bound to chain/asset/amount/route/policy version, verify chain ID and contract bytecode, cap gas/fees, enforce replay/idempotency protection, reconcile receipt and post-state, and test failure/revert handling on a controlled chain.



## 5. Vercel deployment control-plane verification

**Inspection date:** 2026-11-13. Read-only Vercel project/deployment metadata and build events were inspected; no production deployment was initiated.

### quantum-nexus-os
- Project: quantum-nexus-os.
- A READY production deployment exists for main commit 66f5df201a5d5484c21f9ac19d03712c9a3456bd (the Phase 01 merge).
- Production aliases include quantum-nexus-os.vercel.app and the account-scoped main alias.
- Vercel SSO protection is enabled for all deployment types except custom domains. Direct unauthenticated page testing was not completed.
- The newest branch preview deployment was CANCELED; it is not the production deployment.

### honeycomb-omega-x
- The newest deployment record is ERROR with errorCode missing_root_layout.
- Build logs show that deployment upload contained only src/app/page.tsx and package.json; src/app/layout.tsx was absent from that deployment artifact.
- The current GitHub main tree does contain app/layout.tsx. The previously READY production deployment includes layout.tsx and retains the production aliases.
- This points to an incomplete/incorrect deployment artifact or deployment source/root configuration, not proof that the current Git tree lacks a root layout.
- No source code was changed based on this Vercel error.

### legal-ai-platform
- Latest inspected deployment is READY but has target=null (not a production target).
- A previous production deployment is READY and has legal-ai-platform-eta.vercel.app as an alias.
- A more recent main deployment record is ERROR; its build logs were not fully inspected in this pass.
- No new production deployment was initiated.

### Verification boundary
- Vercel control-plane state is not equivalent to an authenticated end-to-end browser test.
- Direct web opening of the three deployment domains was not accessible through the current web inspection path; SSO protection may apply.
- Do not claim all live URLs are fully tested. A separate authenticated browser test must verify login, route rendering, API connectivity, telemetry, and role-based access on each production alias.
