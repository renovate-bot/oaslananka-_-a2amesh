# Official SDKs vs A2A Mesh

A2A Mesh is an independent TypeScript runtime and toolkit. It is not an official
Agent2Agent SDK and should not be described as one.

## Use an official SDK when

- You need first-party language support from the protocol steward.
- Your integration must follow an upstream sample exactly.
- Your organization requires vendor-maintained packages only.
- You want the smallest possible dependency surface for one protocol operation.

## Use A2A Mesh when

- You want runtime, client, registry, adapters, bridge, CLI, and tests in one
  TypeScript monorepo.
- You need local Agent Card validation, conformance output, registry discovery,
  and operator-focused diagnostics.
- You want adapters for provider or framework objects while keeping optional
  provider SDKs as peer dependencies.
- You need package-level boundaries for transports, MCP bridge mapping, schemas,
  telemetry, and authentication helpers.

## How they fit together

A2A Mesh can sit beside official SDK usage. Use official SDKs as the protocol
source of truth when required, and use A2A Mesh for developer experience,
registry operations, local testing, CLI workflows, and production diagnostics.

Do not rely on A2A Mesh to override protocol requirements. Compatibility policy
and conformance fixtures should stay aligned with the latest official release
that the project documents.
