# a2amesh conformance-badge

<!-- Synced from scripts/generate-command-docs.mjs. -->

Reads a conformance report JSON file and generates a Shields.io-style SVG badge showing pass/fail status. Optionally outputs a Markdown image reference.

## Usage

```text
Usage: a2amesh conformance-badge [options] <report-file>

Reads a conformance report JSON file and generates a Shields.io-style SVG badge showing pass/fail
status. Optionally outputs a Markdown image reference.

Arguments:
  report-file      Path to a conformance report JSON file

Options:
  --output <path>  Write SVG badge to a file
  --markdown       Print a Markdown image reference to stdout
  -h, --help       display help for command
```

## Examples

### Generate an SVG badge file. (Linux/macOS)

```bash
a2amesh conformance-badge report.json --output badge.svg
```

### Generate an SVG badge file. (PowerShell)

```powershell
a2amesh conformance-badge report.json --output badge.svg
```

### Print a Markdown image reference to stdout. (Linux/macOS)

```bash
a2amesh conformance-badge report.json --markdown
```

### Print a Markdown image reference to stdout. (PowerShell)

```powershell
a2amesh conformance-badge report.json --markdown
```
