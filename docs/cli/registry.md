# a2amesh registry

<!-- Synced from scripts/generate-command-docs.mjs. -->

Starts a local registry, lists registered agents, and moves registry state between control planes with versioned JSON export files.

## Usage

```text
Usage: a2amesh registry [options] [command]

Starts a local registry, lists registered agents, and moves registry state between control planes
with versioned JSON export files.

Options:
  -h, --help        display help for command

Commands:
  start [options]   Start a local registry server.
  list [options]    List agents registered with a registry.
  export [options]  Export registry agent state to a versioned JSON document.
  import [options]  Import a versioned registry export document.
  help [command]    display help for command
```

## Subcommands

| Command                   | Summary                                                   |
| ------------------------- | --------------------------------------------------------- |
| `a2amesh registry start`  | Start a local registry server.                            |
| `a2amesh registry list`   | List agents registered with a registry.                   |
| `a2amesh registry export` | Export registry agent state to a versioned JSON document. |
| `a2amesh registry import` | Import a versioned registry export document.              |

## Examples

### Start and list a local registry. (Linux/macOS)

```bash
a2amesh registry start --port 3099
a2amesh registry list --url http://127.0.0.1:3099 --json
```

### Start and list a local registry. (PowerShell)

```powershell
a2amesh registry start --port 3099
a2amesh registry list --url http://127.0.0.1:3099 --json
```

### Export and import registry state with control-plane credentials. (Linux/macOS)

```bash
a2amesh registry export --url http://127.0.0.1:3099 --output ./registry-export.json --bearer-token "$REGISTRY_TOKEN"
a2amesh registry import --url http://127.0.0.1:3099 --input ./registry-export.json --bearer-token "$REGISTRY_TOKEN"
```

### Export and import registry state with control-plane credentials. (PowerShell)

```powershell
a2amesh registry export --url http://127.0.0.1:3099 --output .\registry-export.json --bearer-token $env:REGISTRY_TOKEN
a2amesh registry import --url http://127.0.0.1:3099 --input .\registry-export.json --bearer-token $env:REGISTRY_TOKEN
```

## Export Format

`registry export` writes a JSON document with:

- `$schema`: `https://oaslananka.github.io/a2amesh/schemas/registry-export.schema.json`
- `schemaVersion`: currently `1`
- `exportedAt`: ISO timestamp
- `agents`: registered agent records
- `metadata`: source, agent count, tenant ids, and public agent count

The checked-in JSON Schema is `docs/protocol/schemas/registry-export.schema.json`; the docs site serves the same schema under `/schemas/registry-export.schema.json`.

## Authentication

Registries configured with `registrationToken`, `requireAuth`, or JWT auth require control-plane credentials for export and import. Tenant-scoped credentials export records visible to that tenant, including public agents. Imports are idempotent when an incoming record matches an existing agent by `id` or `url`.
