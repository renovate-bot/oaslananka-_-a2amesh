# Policy engine

A2A Mesh includes a deterministic policy engine for tenant, skill, tool, and action checks.

## Decisions

| Decision | Meaning                                              |
| -------- | ---------------------------------------------------- |
| `allow`  | The request can proceed.                             |
| `review` | The request needs a human or external approval step. |
| `block`  | The request is stopped.                              |

When multiple rules match, the strictest decision wins: `block`, then `review`, then `allow`.

## Usage

Rules can match tenant, principal, skill id, tool id, action, and attributes. `simulate()` returns the final decision, matched rule metadata, and human-readable reasons. `can()` returns `true` only for `allow`.
