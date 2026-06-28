# a2amesh task

<!-- Synced from scripts/generate-command-docs.mjs. -->

Runs task lifecycle operations including send, stream, status lookup, and cancellation against an A2A endpoint.

## Usage

```text
Usage: a2amesh task [options] [command]

Runs task lifecycle operations including send, stream, status lookup, and cancellation against an
A2A endpoint.

Options:
  -h, --help                        display help for command

Commands:
  send [options] <url> <message>    Send a text message to an A2A endpoint.
  stream [options] <url> <message>  Stream events for a sent task message.
  status [options] <url> <taskId>   Fetch status for an existing task.
  cancel [options] <url> <taskId>   Cancel an existing task.
  help [command]                    display help for command
```

## Subcommands

| Command               | Summary                                 |
| --------------------- | --------------------------------------- |
| `a2amesh task send`   | Send a text message to an A2A endpoint. |
| `a2amesh task stream` | Stream events for a sent task message.  |
| `a2amesh task status` | Fetch status for an existing task.      |
| `a2amesh task cancel` | Cancel an existing task.                |

## Examples

### Send a task message through the task command group. (Linux/macOS)

```bash
a2amesh task send http://127.0.0.1:3000 "hello"
```

### Send a task message through the task command group. (PowerShell)

```powershell
a2amesh task send http://127.0.0.1:3000 "hello"
```

### Stream a task response and inspect task status. (Linux/macOS)

```bash
a2amesh task stream http://127.0.0.1:3000 "hello"
a2amesh task status http://127.0.0.1:3000 task-123
```

### Stream a task response and inspect task status. (PowerShell)

```powershell
a2amesh task stream http://127.0.0.1:3000 "hello"
a2amesh task status http://127.0.0.1:3000 task-123
```
