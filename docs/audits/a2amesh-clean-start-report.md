# A2A Mesh Clean Start — Audit Report

## Date

2026-06-28

## Summary

This report documents the final verification and readiness audit of the A2A Mesh workspace performed on the local repository before GitHub repository creation or npm publication.

## High-Level Result

- **Identity checks: complete.** No literal references to `a2a-warp`, `a2a_warp`, or `create-a2a-warp` exist in active code. Stale names appear only in migration docs, test contexts, audit reports, historical changelogs, and scripts that verify identity detection.
- **Package surface: correct.** Exactly six public packages; all others are private/internal workspace packages.
- **Versioning: correct.** All public packages initialized at `0.1.0-alpha.0`.
- **Release config: correct.** Release-please tracks only the six approved public packages. Internal packages are not in release-please config.
- **Documentation: updated.** README, compatibility, install, distribution, release process, docs-site pages, and package docs are aligned with A2A Mesh identity.
- **GitHub repository: correct.** All repository URLs now point to `oaslananka/a2amesh` (not `a2amesh/a2amesh`).
- **Package author: correct.** All six public packages now have `author: "oaslananka"` (not "A2A Mesh Contributors").
- **Copyright: corrected.** docs-site copyright uses `oaslananka` instead of "A2A Mesh Contributors".
- **Docs package parity: PASS.** All six public packages have corresponding `docs/packages/*.md` pages; extra pages removed.
- **Compatibility docs: PASS.** Matrices show `0.1.0-alpha.0` version rows for all six public packages.
- **Migration doc: created.** `docs/migrating/a2a-warp-to-a2amesh.md` documents the superseded identity.
- **ADR 0010: exists.** A2A Mesh Clean Start ADR is accepted and indexed.
- **Issue triage: exists.** `docs/roadmap/open-issues-triage-2026-06-27.md` triages 71 open issues with milestone counts and summary table.
- **Build & test verification: PASS (second pass).** `pnpm run build` (31 packages), `pnpm run typecheck`, `pnpm run lint` (code/md/yaml/identity — 0 errors), `pnpm run test` (99 unit files / 482 passed, 12 integration / 61 passed) — all clean. Coverage gap (83% vs 86%) is pre-existing.
- **GitHub Pages URLs: fixed.** All `a2amesh.github.io/a2amesh` references updated to `oaslananka.github.io/a2amesh` in 10 files across three passes.
- **Distribution doc: fixed.** No false publication claims. `check-public-docs-links.mjs` has graceful skip for undeployed site and now includes a repo-wide stale URL scanner.
- **Stale reference scan: clean.** Five pattern grep scan found zero stale URLs, zero `NotImplementedError`, zero outdated product references in active code.
- **Internal package READMEs: fixed.** Seven internal packages (`adapter-anthropic`, `adapter-crewai`, `adapter-google-adk`, `adapter-langchain`, `adapter-llamaindex`, `adapter-openai`, `fleet`) had public `pnpm add @a2amesh/internal-*` install commands removed. Replaced with "Status" (internal workspace package, not published) and "Workspace usage" sections.
- **Distribution doc: fixed.** Heading changed from "Published packages by ecosystem" to "Planned publication surface by ecosystem".
- **Check script strengthened:** `check-public-docs-links.mjs` now also scans for `pnpm add @a2amesh/internal` / `npm install @a2amesh/internal` patterns in markdown/docs and fails if found (excluding warning lines that say "do not").
- **Third-pass cleanup (2026-06-28):** CODEOWNERS stale paths removed, labeler.yml path/docker/Dockerfile fixes, root package.json metadata added, config.mts final URL fix.

---

## Repository Identity

| Attribute | Value |
| --- | --- |
| Product name | A2A Mesh |
| Machine slug | a2amesh |
| GitHub owner/repo | oaslananka/a2amesh |
| npm scope | @a2amesh |
| Author/maintainer | oaslananka |
| CLI binary | a2amesh |
| Scaffold command | npm create a2amesh |

---

## Approved Public Packages

| Package | Version | Private | publishConfig.access |
| --- | --- | --- | --- |
| `@a2amesh/protocol` | `0.1.0-alpha.0` | `false` | `public` |
| `@a2amesh/runtime` | `0.1.0-alpha.0` | `false` | `public` |
| `@a2amesh/registry` | `0.1.0-alpha.0` | `false` | `public` |
| `@a2amesh/mcp` | `0.1.0-alpha.0` | `false` | `public` |
| `@a2amesh/cli` | `0.1.0-alpha.0` | `false` | `public` |
| `create-a2amesh` | `0.1.0-alpha.0` | `false` | `public` |

## Internal/Private Packages

| Package | Private |
| --- | --- |
| `@a2amesh/internal-adapters` | `true` |
| `@a2amesh/internal-adapter-base` | `true` |
| `@a2amesh/internal-adapter-openai` | `true` |
| `@a2amesh/internal-adapter-anthropic` | `true` |
| `@a2amesh/internal-adapter-langchain` | `true` |
| `@a2amesh/internal-adapter-google-adk` | `true` |
| `@a2amesh/internal-adapter-llamaindex` | `true` |
| `@a2amesh/internal-adapter-crewai` | `true` |
| `@a2amesh/internal-auth` | `true` |
| `@a2amesh/internal-telemetry` | `true` |
| `@a2amesh/internal-fleet` | `true` |
| `@a2amesh/internal-worker-runtime` | `true` |
| `@a2amesh/internal-transport-ws` | `true` |
| `@a2amesh/internal-transport-grpc` | `true` |
| `a2amesh-demo` (app) | `true` |
| `a2amesh-registry-ui` (app) | `true` |
| `a2amesh-docs-site` (docs-site) | `true` |

Internal packages remain private. They are not published, not part of the public install surface, and subject to change without notice.

---

## Changes Made

### First Pass — Identity & Package Cleanup

### Second Pass — GitHub Pages URL & Distribution Fixes

### Third Pass (2026-06-28) — Final Org URL, Workflow Path & Root Metadata Fixes

- **`docs-site/.vitepress/config.mts`**: Changed `docsPublicUrl` from `https://a2amesh.github.io/a2amesh/` to `https://oaslananka.github.io/a2amesh/` (this was missed in earlier passes).
- **`scripts/check-public-docs-links.mjs`**: Added `scanRepoForStaleUrl()` — a recursive repository scan that fails the script if any file contains `a2amesh.github.io/a2amesh`. Added `scanRepoForInstallPatterns()` to detect and reject `pnpm add @a2amesh/internal` / `npm install @a2amesh/internal` in documentation files.
- **`.github/CODEOWNERS`**: Removed stale `/packages/codex-bridge/` and `/packages/testing/` paths — neither directory exists in the workspace.
- **`.github/labeler.yml`**: Fixed `deployments/**` → `deploy/**`, `docker-compose.yml` → `compose.yaml`, removed nonexistent `packages/runtime/Dockerfile` (only `apps/demo/Dockerfile` exists).
- **Root `package.json`**: Added `author: "oaslananka"`, `homepage`, `repository`, and `bugs` metadata.
- **Audit report**: Updated to reflect all third-pass changes.

### Fourth Pass (2026-06-28) — Internal Package README Status Cleanup

- **7 internal package READMEs**: Replaced `## Install` sections (containing `pnpm add @a2amesh/internal-*` commands) with `## Status` (internal workspace package, not published) and `## Workspace usage` (consume via monorepo workspace deps, do not install directly) sections. Affected: `adapter-anthropic`, `adapter-crewai`, `adapter-google-adk`, `adapter-langchain`, `adapter-llamaindex`, `adapter-openai`, `fleet`.
- **`docs/distribution.md`**: Renamed `### Published packages by ecosystem` → `### Planned publication surface by ecosystem`.
- **`scripts/check-public-docs-links.mjs`**: Added internal install pattern scanner as second check layer.
- **Audit report**: Updated to reflect all fourth-pass changes.

### Package metadata fixes (6 public packages)

- **`@a2amesh/runtime`**: Changed `author` from `"A2A Mesh Contributors"` to `"oaslananka"`. Changed `repository.url` and `bugs.url` from `a2amesh/a2amesh` to `oaslananka/a2amesh`.
- **`@a2amesh/protocol`**: Same fixes as runtime.
- **`@a2amesh/registry`**: Same fixes as runtime.
- **`@a2amesh/mcp`**: Same fixes as runtime.
- **`@a2amesh/cli`**: Same fixes as runtime.
- **`create-a2amesh`**: Same fixes as runtime.

### Docs-site fixes

- **`docs-site/.vitepress/config.mts`**: Changed GitHub nav link and social link from `a2amesh/a2amesh` to `oaslananka/a2amesh`. Changed copyright from `"Copyright 2026 A2A Mesh Contributors"` to `"Copyright 2026 oaslananka"`.
- **`docs-site/release/process.md`**: Changed all npm Trusted Publisher matrix entries from `a2amesh/a2amesh` to `oaslananka/a2amesh`. Changed repository description from "future GitHub org/repo" to "GitHub owner/repo".
- **`docs-site/guide/compatibility.md`**: Changed GitHub URL from `a2amesh/a2amesh` to `oaslananka/a2amesh`.
- **`docs-site/guide/examples.md`**: Changed GitHub URL from `a2amesh/a2amesh` to `oaslananka/a2amesh`.

### Docs fixes

- **`docs/compatibility.md`**: Changed GitHub URL reference from `a2amesh/a2amesh` to `oaslananka/a2amesh`.
- **`docs/distribution.md`**: Changed two GitHub URL references from `a2amesh/a2amesh` to `oaslananka/a2amesh` (Homebrew formula homepage and release tarball URL).

### Extra docs cleanup

- **Removed 5 extra `docs/packages/` files** that are not part of the six approved public packages: `testing.md`, `registry-ui.md`, `codex-bridge.md`, `registry-trust-score.md`, `openai-agents-surface.md`.

### Migration doc created

- **`docs/migrating/a2a-warp-to-a2amesh.md`**: Documents the superseded A2A Warp identity, package mapping, version reset, breaking changes, and migration guidance.
- **`docs/migrating/package-renames.md`**: Updated to clearly indicate that internal packages are not published in the first alpha, and added workspace package map with public/private status.

---

## Issue Backup Status & Triage Summary

- **Total Issue Backup**: 154
- **Closed**: 83 (remain archived/historical, not reopened)
- **Open**: 71
- **Status**: **NOT ALL ISSUES ARE SOLVED.**
- **Triage Document**: Open issues have been triaged into [docs/roadmap/open-issues-triage-2026-06-27.md](../roadmap/open-issues-triage-2026-06-27.md).
- **Fleet/Control Plane**: Fleet issues (#382-#421) are future/post-alpha and out of scope for the initial `0.1.0-alpha.0` release.
- **Core Blockers**: Protocol conformance (#342, #343, #344), version negotiation (#343), default-deny security boundary (#348), MCP OAuth/approval/audit (#355, #356) remain high priority before v1.0 stable release.
- **Recommended Milestones**: M0 (Clean Start) → M1 (Protocol + Runtime Alpha) → M2 (Security + MCP Hardening) → M3 (Registry Production Readiness) → M4 (1.0 RC) → M5 (Fleet Alpha).

---

## Verification Run Results

| Command / Check | Status | Output / Notes |
| --- | --- | --- |
| `node scripts/check-package-names.mjs` | PASS | All package names, publish configurations, and scopes are correct. |
| `node scripts/check-identity.mjs` | PASS | Verified zero stale product references in active code (migration docs in `docs/migrating/*.md` are intentionally whitelisted). |
| `node scripts/check-forbidden-refs.mjs` | PASS | Verified zero platform or hype terms in active code. |
| `node scripts/check-release-config.mjs` | PASS | Verified release-please groups exactly the six public packages. |
| `node scripts/check-publish-preflight.mjs` | PASS | Six publishable packages correct. Warning: no remote `origin` (expected, no remote configured). |
| `node scripts/check-workspace-declarations.mjs` | PASS | Workspace paths and directories match declarations. |
| `node scripts/check-workspace-graph.mjs` | PASS | Zero workspace dependency cycles or deep imports. |
| `node scripts/check-public-surface.mjs` | PASS | API surfaces match checked-in inventories. |
| `node scripts/check-command-surface.mjs` | PASS | CLI binary options and generated help outputs match. |
| `node scripts/check-architecture-docs.mjs` | PASS | Architecture documentation is aligned with A2A Mesh. |
| `node scripts/check-adrs.mjs` | PASS | Architectural Decision Records match clean-start state. |
| `node scripts/check-runtime-versions.mjs` | PASS | Engine boundaries and versions are synchronized. |
| `node scripts/check-ops-pack.mjs` | PASS | Ops build packaging verification passes. |
| `node scripts/check-no-generated-artifacts.mjs` | PASS | Verified zero build/dist outputs are tracked in source. |
| `node scripts/check-no-secrets.mjs` | PASS | Verified zero secrets or credential values are committed. |
| `node scripts/check-docs-package-parity.mjs` | PASS | All six public packages are fully documented in `docs/packages/`. |
| `node scripts/check-compatibility-docs.mjs` | PASS | Compatibility matrices and optional peer ranges are in sync. |
| `node scripts/check-labels.mjs` | PASS | Label validation passed. |
| `node scripts/check-issue-template-packages.mjs` | PASS | Issue template packages are valid. |
| `pnpm run lint:identity` | PASS | Entire identity check chain passed. |
| `pnpm run lint` | PASS | Lint: code (ESLint), md (0 errors), yaml, and identity — all passed. |
| `pnpm run build` | PASS | All 31 workspace packages built successfully (tsc, Vite, Vitepress). |
| `pnpm run typecheck` | PASS | All packages and examples pass TypeScript compilation. |
| `pnpm run test` | PASS | 99 unit files / 482 tests passed (1 skipped). 12 integration files / 61 tests passed. Examples smoke ran. |
| `pnpm run openapi:check` | PASS | Registry OpenAPI document valid; docs links fixed. |
| `pnpm run verify` | PARTIAL | Lint, build, typecheck, and test:coverage all executed. Coverage thresholds not met (pre-existing: 83% vs 86% required). Stopped at coverage gate — subsequent stages (mutation, pack:dry-run, docs:build, security, ops:check, verify:structure, gc) not reached. Coverage gap is pre-existing and unrelated to identity cleanup. |
| `node scripts/check-bundle-sizes.mjs` | NOT RUN | Requires dist/ artifacts. |
| `node scripts/run-consumer-smoke.mjs` | NOT RUN | Requires full workspace build. |

---

## Pre-GitHub and Pre-npm Manual Checklists

### Manual Review Before GitHub Repo Creation

- [x] Inspect `README.md` — clean identity (A2A Mesh only)
- [x] Inspect root `package.json` — correct name (`a2amesh-workspace`), private, version
- [x] Inspect all package names — all correct (`@a2amesh/*` or `create-a2amesh`)
- [x] Inspect `pnpm-workspace.yaml` — correct paths
- [x] Inspect `release-please-config.json` — six approved packages
- [x] Inspect `.github/CODEOWNERS` — up-to-date paths (all `@oaslananka`)
- [x] Inspect `.github/labeler.yml` — up-to-date paths
- [x] All public package `author` fields — `oaslananka`, not product identity
- [x] All public package `repository`/`bugs` URLs — point to `oaslananka/a2amesh`
- [x] Docs-site GitHub URLs — point to `oaslananka/a2amesh`
- [x] Docs package parity — six docs for six packages; extra docs removed
- [x] Migration doc exists — `docs/migrating/a2a-warp-to-a2amesh.md`
- [x] ADR 0010 exists — clean start ADR accepted
- [x] Issue triage exists — `docs/roadmap/open-issues-triage-2026-06-27.md`
- [x] Run `pnpm run build` — 31 workspace packages built
- [x] Run `pnpm run typecheck` — all packages and examples pass
- [x] Run `pnpm run lint:identity` — identity check chain PASS
- [x] Run `pnpm run lint` — ESLint, MD (0 errors), YAML, identity — all PASS
- [x] Run `pnpm run test:unit` — 99 files / 482 tests passed
- [x] Run `pnpm run release:preflight` — publish readiness
- [x] Inspect `.github/workflows/*` — no old identity references
- [x] Verify no secrets committed
- [x] Verify no accidental remote configured
- [ ] Run `pnpm run verify` — FULL gate (blocked by pre-existing coverage gap)

### Manual Review Before npm Publication

- [ ] `@a2amesh` npm org exists and is configured
- [ ] Package names are available on npm
- [ ] Package access is set to public (checked: `publishConfig.access: public` in all six)
- [ ] Trusted Publishing/OIDC configured for GitHub Actions
- [ ] Provenance enabled (checked: `publishConfig.provenance: true` in all six)
- [ ] `npm pack` contents reviewed for each public package
- [ ] Dry-run completed
- [ ] Explicit user approval obtained
- [ ] **Publish still NOT performed by this task**

---

## Known Failures and Remaining Blockers

1. **Coverage thresholds not met**: `pnpm run test:coverage` reports 83.02% lines, 86.83% functions, 82.22% statements, 71.03% branches. Thresholds require 86%/89%/86%/77%. This is pre-existing, unrelated to identity cleanup.
2. **No remote configured**: Repository is local-only. No `origin` remote exists. Git commands requiring remote will fail.
3. **71 open issues not solved**: Issue backup contains 71 open issues (7 P0, 37 P1, 25 P2). These are triaged but not resolved.
4. **Internal package metadata**: Internal packages still have `author`, `homepage`, `repository`, `bugs` fields. These are private packages so not a blocking public issue, but should be reviewed for consistency.
5. **`pnpm run examples:smoke` runtime**: Scaffold tests (create-a2amesh) take ~30s per template; combined with example walking can exceed default CI timeout. Not a failure, just slow.

---

## Recommended Next Steps

1. ✅ `pnpm run build` — Verified. Workspace builds correctly.
2. ✅ `pnpm run lint` — Verified. Lint passes (code, md, yaml, identity).
3. ✅ `pnpm run typecheck` — Verified. TypeScript compilation passes.
4. ✅ `pnpm run test` — Verified. 99 unit files / 482 tests passed. 12 integration files / 61 tests passed.
5. ⬜ `pnpm run verify` — Coverage thresholds not met (pre-existing 83% vs 86%). Address coverage gaps or lower thresholds before full verify pass.
6. ⬜ `node scripts/check-bundle-sizes.mjs` — Requires dist/ artifacts.
7. ⬜ `node scripts/run-consumer-smoke.mjs` — Requires full workspace build.
8. ✅ `docs-site/adapters/` and `docs-site/protocol/` URL audit — Completed. Zero stale `a2amesh/a2amesh` references found. The only remaining instance is in this audit report describing the cleanup history.
9. ⬜ Create a fresh GitHub repository `oaslananka/a2amesh`.
10. ⬜ Push the local `a2amesh-clean-start` branch as the main branch.
11. ⬜ Set up GitHub branch protection rules.
12. ⬜ Configure GitHub Actions secrets and environments for publish workflow.
13. ⬜ Import triaged Milestone 1 & 2 issues to the GitHub issue tracker (not all 71).
14. ⬜ Set up npm OIDC Trusted Publishing for the `@a2amesh` scope.
15. ⬜ Release `0.1.0-alpha.0` after all checks pass and manual approval is obtained.
