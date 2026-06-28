# Third-Party Dependencies

Dependencies are managed by pnpm workspaces. Optional provider SDKs remain peer dependencies where possible so default installs stay focused.

The workspace uses strict peer dependency checks, disables automatic peer installation, and enforces the repository Node and pnpm engines. Runtime packages support Node.js `>=22.22.1 <25`; `@types/node` intentionally stays on the latest Node 22 type line so public packages cannot accidentally compile against Node 25-only APIs while Node 22 remains supported.

As of the May 2026 dependency refresh:

- `eventsource` uses the maintained v4 package with bundled TypeScript types; the deprecated `@types/eventsource` stub is not installed.
- Node-side EventSource headers are attached through the v4 `fetch` override path, with the legacy `{ headers }` option retained only for injected compatible implementations.
- The registry UI builds on Vite 8 and `@vitejs/plugin-react` 6, both within the repository Node engine range.
  The VitePress docs site stays on VitePress 1.6.4 with a scoped Vite 6.4.2 override so it
  receives the current Vite security patch without forcing VitePress onto warning-producing
  Rolldown-backed Vite 8.
- `protobufjs` remains on the latest v7 line (`7.6.0` as of the May 2026 review) because `@grpc/proto-loader@0.8.1` declares `^7.5.5`; overriding it to v8 would exceed the supported dependency contract.

## Update Policy

Renovate must evaluate every workspace package, including `apps/registry-ui` and `docs-site`. UI and documentation dependencies are grouped into workspace-scoped pull requests so changes to browser tooling and the VitePress site are reviewed with their own CI signal instead of being hidden behind broad repository updates.

The repository keeps `minimumReleaseAge` at 3 days while Renovate automerge remains disabled. The shorter delay gives maintainers timely visibility into security and compatibility updates, while the merge still requires review plus the full protected-branch CI gate. Renovate also uses `internalChecksFilter: strict`, so updates that have not satisfied the release-age check remain pending instead of opening branches early.

If third-party dependency automerge is enabled later, raise the third-party `minimumReleaseAge` policy to 14 days before enabling automerge. Internal workspace packages and emergency security fixes can keep separate package rules only when the rule documents the narrower risk and required CI coverage.
