# a2amesh scaffold

<!-- Synced from scripts/generate-command-docs.mjs. -->

Creates a new A2A agent project from a local template, with optional auth, rate limiting, provider adapter, and Dockerfile output.

## Usage

```text
Usage: a2amesh scaffold [options] <agent-name>

Creates a new A2A agent project from a local template, with optional auth, rate limiting, provider
adapter, and Dockerfile output.

Options:
  --adapter <adapter>  Adapter template to use (default: "custom")
  --auth               Include API key authentication
  --rate-limit         Include explicit rate limit configuration
  --docker             Include Dockerfile
  -h, --help           display help for command
```

## Examples

### Create a custom agent scaffold. (Linux/macOS)

```bash
a2amesh scaffold demo-agent --adapter custom
```

### Create a custom agent scaffold. (PowerShell)

```powershell
a2amesh scaffold demo-agent --adapter custom
```

### Create an OpenAI agent scaffold with auth and Docker support. (Linux/macOS)

```bash
a2amesh scaffold openai-agent --adapter openai --auth --docker
```

### Create an OpenAI agent scaffold with auth and Docker support. (PowerShell)

```powershell
a2amesh scaffold openai-agent --adapter openai --auth --docker
```
