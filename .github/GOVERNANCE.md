# Governance

## Roles

- **Maintainer**: @oaslananka — final decisions on direction, releases and security.
- **Contributor**: Anyone with a merged pull request.
- **Adapter Champion**: Responsible for the quality and roadmap of a specific adapter.

## Decision Making

Significant changes such as breaking API changes, new packages or architectural shifts should be proposed as an RFC in GitHub Discussions under Ideas.

- Consensus period: 7 days
- Final decision: maintainer

## Release Process

1. release-please derives release pull requests from Conventional Commits merged to `main`.
2. Contributors verify changes locally with `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, and `pnpm run test`.
3. Merging a release pull request only updates versions and changelogs.
4. Maintainers create the release tag/GitHub Release deliberately, then dispatch the guarded publish workflow.
5. GitHub Actions is the supported CI/CD system for validation, security scanning, artifact preparation, and owner-triggered npm publishing.
