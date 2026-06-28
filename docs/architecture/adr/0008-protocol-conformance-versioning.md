# ADR-0008: Protocol Conformance Versioning

## Status

Accepted for the 1.0.0 launch baseline.

## Context

A2A Mesh validates Agent2Agent behavior with versioned conformance fixtures under
`tests/conformance/fixtures/`. The current launch baseline includes official A2A
`1.0` fixtures and a2amesh experimental `1.2` profile fixtures, covering agent
cards, message requests, streaming events, push configuration, task responses, and
negative JSON-RPC cases.

Protocol versions can evolve without every consumer upgrading at once. If fixtures are
mutated in place, regressions against older protocol behavior become hard to detect and
docs lose a stable compatibility story.

## Decision

Treat each supported or experimental protocol profile as a versioned conformance
fixture set. New official protocol support must add a new fixture directory and wire
it into the conformance test matrix instead of replacing older fixture semantics.
Experimental profiles must be documented as opt-in until an upstream release makes
the version official.

Existing fixture directories may be corrected only for clear mistakes, and those
corrections must preserve the advertised protocol version. Compatibility documentation
must distinguish supported protocol versions from transport feature parity. Transport
contract tests remain responsible for envelope parity; conformance fixtures remain
responsible for protocol payload compatibility.

When a protocol version is deprecated in the future, the deprecation window must be
documented before fixtures are removed.

## Consequences

Consumers get a stable compatibility signal for each protocol version. The repository can
add newer protocol behavior while keeping older supported behavior under regression
coverage.

The fixture matrix grows with protocol support, so new fixture sets should stay minimal,
focused on observable protocol behavior, and linked from compatibility or architecture
docs when support changes.

## Validation Commands

```bash
pnpm run lint:md
pnpm run docs:build
pnpm run test:conformance
pnpm run test
```

Relevant coverage:

- [`A2A conformance tests`](../../../tests/conformance/a2a-conformance.test.ts)
- [`A2A 1.0 fixtures`](../../../tests/conformance/fixtures/a2a-1.0/agent-card.json)
- [`a2amesh experimental 1.2 fixtures`](../../../tests/conformance/fixtures/a2a-1.2/agent-card.json)
- [`transport contract`](../../../tests/transport-contract/transportContract.ts)
