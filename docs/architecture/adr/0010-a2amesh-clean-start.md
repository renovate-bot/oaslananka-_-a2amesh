# A2A Mesh Clean Start

## Date

2026-06-27

## Status

Accepted

## Context

The repository has been structured as a clean-start release of the A2A Mesh workspace.
No remote repository or npm package is to be created or pushed until the local source
tree has passed a complete identity, package-surface, release-governance,
documentation, and security review.

The previous workspace layout exposed most implementation modules as independently
publishable packages. That surface is too broad for a clean alpha because adapter,
transport, authentication, telemetry, Fleet, and worker contracts are not yet stable
enough to carry long-lived public compatibility obligations.

## Decision

The product is established as **A2A Mesh**, with machine slug and repository slug
`a2amesh` and npm scope `@a2amesh`. Its positioning is:

> A2A Mesh is a production-grade TypeScript runtime, registry, MCP bridge, and
> future control plane for A2A-native agent systems.

This is a semantic clean-start. Public package directories and metadata will reflect
the new architecture.

The planned repository metadata points to `oaslananka/a2amesh`. This is prospective
metadata only: this decision does not create, contact, or push to that repository.

## Package Surface

The first alpha has exactly six public, publishable packages:

- `@a2amesh/protocol`
- `@a2amesh/runtime`
- `@a2amesh/registry`
- `@a2amesh/mcp`
- `@a2amesh/cli`
- `create-a2amesh`

`@a2amesh/protocol` owns protocol types, generated JSON Schema artifacts,
compatibility metadata, and future protocol tooling. `@a2amesh/runtime` is the main
runtime package. Registry operations are presented through the `a2amesh registry`
command tree. The scaffold command shown to users is `npm create a2amesh`.

## Internal Package Boundary

Every package outside the approved public list remains private. Internal packages may
use an explicit `@a2amesh/internal-*` workspace name, but must set `private: true`,
must not set public publish metadata, and must not be described as a stable public
contract.

This policy covers authentication, telemetry, policy, artifacts, Fleet,
worker-runtime, adapter-base, provider adapters, the adapters aggregate package,
WebSocket and gRPC transports, provider workers, examples, applications, and
experimental control-plane surfaces. Optional provider dependencies must not be
forced onto runtime consumers.

## Versioning Policy

All six public packages begin at `0.1.0-alpha.0` and use lockstep versioning for the
initial alpha series. Internal packages may also use `0.1.0-alpha.0` for workspace consistency,
but their private status is authoritative.

## Release Policy

Release Please tracks only the six approved public packages. Release automation may
prepare release pull requests and changelogs, but ordinary CI must not publish npm
packages, create Git tags or GitHub Releases, push container images, or mutate remote
state.

## No-Publish Policy

GitHub repository creation is forbidden until local verification is complete. npm
publication and npm login are forbidden until the user gives separate, explicit
future approval. No task in this clean-start pass may create a remote, push a branch,
publish a package, read or add an npm token, or introduce fallback token credentials.

When publication is separately approved, it remains owner-triggered, requires an
explicit confirmation, and uses npm Trusted Publishing/OIDC and provenance without
long-lived npm tokens.

## Fleet Future Policy

Fleet, worker runtime, policy engine, artifact store, sandboxed worktrees, approval
workflows, Mission Control, and provider-specific workers are future/internal
capabilities. They remain private and experimental until each contract is separately
reviewed and promoted. Their incompleteness is not a release blocker for the first
A2A Mesh alpha unless an existing required quality gate depends on them.

## Code and Asset Structure

Valuable implementation code is preserved while resetting identity and publication boundaries.
The public and internal directory map aligns with the new layout, including:

- `@a2amesh/protocol` (in `packages/protocol`)
- `@a2amesh/runtime` (in `packages/runtime`)
- `@a2amesh/registry` (in `packages/registry`)
- `@a2amesh/mcp` (in `packages/mcp`)
- `@a2amesh/cli` (in `packages/cli`)
- `create-a2amesh` (in `packages/create-a2amesh`)

All workspace references, source imports, TypeScript project references, generators,
tests, package inventories, release configuration, CLI documentation, examples, and
operations assets move with those boundaries.

The clean start is performed only on the local `a2amesh-clean-start` branch. No remote
is configured or used.

## Consequences

The smaller public surface makes the alpha easier to secure, document, test, and
evolve without accidental compatibility promises. Consolidating protocol types and
schemas creates a single protocol authority, while keeping adapters and transports
private prevents unstable contracts and heavy optional dependencies from leaking into
the runtime install path.

The reset requires coordinated directory renames and broad updates across manifests,
imports, documentation, generated artifacts, CI, release scripts, operations assets,
and package checks.

## Quality Gates

Completion requires evidence for all of the following:

- package-surface and private status checks for all workspaces
- public package metadata, version, export, and package-content validation
- release configuration and Trusted Publishing/OIDC guardrails
- CLI binary, generated command documentation, and scaffold parity
- protocol schemas, OpenAPI, and public-surface inventory parity
- lint, typecheck, tests, build, documentation build, and package dry-runs
- no generated artifacts, secrets, unsupported remote operations, or hidden publish
  paths
- a tracked final audit report with pre-GitHub and pre-npm manual review checklists

Failures are reported honestly and recorded as blockers; a check is not described as
passing unless it was actually run and succeeded.

## Validation Commands

```bash
pnpm run lint:md
pnpm run docs:build
pnpm run lint:identity
node scripts/check-release-config.mjs
node scripts/check-public-surface.mjs
pnpm run release:preflight
pnpm run verify
```
