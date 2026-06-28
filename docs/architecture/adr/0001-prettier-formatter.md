# ADR-0001: Prettier Formatter Authority

## Status

Accepted for the 1.0.0 launch baseline.

## Context

The imported repository already used Prettier and ESLint. Introducing another formatter during the identity rebuild would create unrelated formatting churn.

## Decision

Prettier remains the single formatter authority. ESLint remains responsible for code quality rules.

## Consequences

`pnpm run format:check` is deterministic across supported local and CI environments, and Biome is not added in this launch baseline.
