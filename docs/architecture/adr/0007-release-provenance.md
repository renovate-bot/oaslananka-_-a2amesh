# ADR-0007: Release Provenance

## Status

Accepted for the 1.0.0 launch baseline.

## Context

A2A Mesh publishes multiple npm packages from one monorepo. The release process needs
version and changelog automation, but ordinary CI must not publish packages, create tags,
push container images, or create GitHub Releases.

The repository uses Release Please to propose version and changelog updates. Publishing
is owner-triggered through a dedicated workflow that requires an explicit confirmation
input, packs npm tarballs, smoke-validates release artifacts, writes SHA-256 checksums,
generates a CycloneDX SBOM, emits GitHub artifact attestations, and publishes through npm
Trusted Publishing/OIDC with provenance. Long-lived npm token fallback logic is not part
of the supported release model.

## Decision

Keep Release Please responsible only for release pull requests, versions, and changelog
updates. Keep package publication behind the owner-dispatched publish workflow.

Release artifacts must be produced by `pnpm run release:artifacts` and validated by
`pnpm run release:validate` before publication. The publish workflow must retain
`attestations: write`, must attest npm checksums and the CycloneDX SBOM, and must publish
using npm Trusted Publishing/OIDC provenance.

Do not add npm registry token secrets, private runner requirements, package publishing to
ordinary CI, or agent-driven tag/release creation for the launch baseline.

## Consequences

Every published artifact has a reproducible local preparation command, checksum coverage,
SBOM coverage, and platform provenance. Release PRs can be reviewed like ordinary changes
without implicitly publishing anything.

The tradeoff is an explicit owner action for publication. That is intentional: it keeps
release authority separate from routine CI and agent-authored pull requests.

## Validation Commands

```bash
pnpm run lint:md
pnpm run docs:build
node scripts/check-release-config.mjs
pnpm run verify:structure
```

Relevant coverage:

- [`Release process`](../../release/process.md)
- [`check-release-config.mjs`](../../../scripts/check-release-config.mjs)
- [`prepare-release-artifacts.mjs`](../../../scripts/prepare-release-artifacts.mjs)
- [`validate-release-config.mjs`](../../../scripts/validate-release-config.mjs)
- [`publish workflow`](../../../.github/workflows/publish.yml)
- [`release artifact integration tests`](../../../tests/integration/release-artifacts.test.ts)
