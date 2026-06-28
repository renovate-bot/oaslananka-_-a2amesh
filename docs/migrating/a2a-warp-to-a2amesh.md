# A2A Warp to A2A Mesh Migration

This document describes the migration from the historical **A2A Warp** product identity
to **A2A Mesh**.

## Overview

A2A Warp was the original product name and repository identity. It has been superseded
by A2A Mesh. All new development, releases, and documentation use the A2A Mesh identity.

## Key Changes

| Aspect            | Old (A2A Warp)                     | New (A2A Mesh)     |
| ----------------- | ---------------------------------- | ------------------ |
| Product name      | A2A Warp                           | A2A Mesh           |
| Machine slug      | a2a-warp                           | a2amesh            |
| GitHub repository | oaslananka/a2a-warp                | oaslananka/a2amesh |
| npm scope         | @oaslananka/a2a-warp-\*            | @a2amesh/\*        |
| CLI binary        | a2a-warp                           | a2amesh            |
| Scaffold package  | create-a2a-warp / create-a2a-agent | create-a2amesh     |

## Package Mapping

| Old Package Name                | New Package Name  |
| ------------------------------- | ----------------- |
| @oaslananka/a2a-warp-core       | @a2amesh/runtime  |
| @oaslananka/a2a-warp-core-types | @a2amesh/protocol |
| @oaslananka/a2a-warp-schemas    | @a2amesh/protocol |
| @oaslananka/a2a-warp-registry   | @a2amesh/registry |
| @oaslananka/a2a-warp-bridge-mcp | @a2amesh/mcp      |
| @oaslananka/a2a-warp-cli        | @a2amesh/cli      |
| create-a2a-warp                 | create-a2amesh    |
| create-a2a-agent                | create-a2amesh    |

## Version Reset

A2A Mesh starts at **0.1.0-alpha.0**. There is no direct version continuity from
A2A Warp versions (11.0.0, 8.x, 5.x, etc.). Old package versions are historical
and should not be reused or compared as continuations.

## Current Status

- A2A Warp is **superseded**. Old packages should be deprecated, not reused.
- A2A Mesh is the current product identity.
- The repository at oaslananka/a2amesh is the canonical source.
- npm publication requires explicit future approval.
- Old names are historical and appear only in migration, deprecation, test, audit,
  and changelog contexts.

## Breaking Changes

- All import paths change from `@oaslananka/a2a-warp-*` to `@a2amesh/*`.
- CLI binary changes from `a2a-warp` to `a2amesh`.
- The scaffold command changes from `npm create a2a-warp` to `npm create a2amesh`.
- Package versions reset to 0.1.0-alpha.0.
- Internal packages are now prefixed `@a2amesh/internal-*` and are not part of the
  public alpha install surface.

## Rollback

There is no supported rollback path to A2A Warp. Users must migrate forward to
A2A Mesh. Old A2A Warp packages will not receive further updates.
