# ADR-0002: Garbage Collection Allowlist

## Status

Accepted for the 1.0.0 launch baseline.

## Context

`pnpm run gc` uses Knip to reject unused files, dependencies, binaries, and exports. These entries are intentionally present even though static analysis cannot prove direct source imports:

- `search-insights` is a peer dependency used by the VitePress DocSearch stack.
- SQLite task storage loads `better-sqlite3` dynamically only when that backend is constructed; consumers that use SQLite install it in their application.
- `jscpd` is invoked by `scripts/check-duplicates.mjs` through `pnpm exec`, which Knip cannot prove from a package-script binary reference.
- `gitleaks` is an operator-installed security CLI used by `pnpm run security`.
- `playwright` is invoked inside `apps/registry-ui` through `pnpm --dir apps/registry-ui exec`.

## Decision

Keep the allowlist in `knip.json` narrowly scoped to those entries. Do not add source files, public exports, or package dependencies to the allowlist when they can be removed, referenced from a real script, or made internal.

## Consequences

The garbage-collection gate stays fail-closed for ordinary stale files and exports while preserving required optional/runtime tool surfaces.

`jscpd` is scoped to package, CLI, and app source paths, excluding tests and generated output. The launch threshold is `2%`, which keeps the gate fail-closed for new structural duplication while avoiding false failures from intentionally repetitive protocol/client call shapes.
