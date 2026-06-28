# GitHub Configuration Agent Map

Responsibility: workflows, issue templates, pull request template, CODEOWNERS, Dependabot, ruleset examples, and repository security configuration.

Allowed imports: not applicable.

Test commands:

```bash
pnpm run lint:yaml
node scripts/check-forbidden-refs.mjs
```

Feature rule: use GitHub-hosted runners only, pin third-party actions, keep default permissions read-only, and keep required/security jobs fail-closed.
