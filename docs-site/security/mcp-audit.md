# MCP audit workflow

The MCP bridge includes audit helpers for tool import, allow-list filtering, and approval workflows.

## Helpers

| Helper                  | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `auditMcpTool`          | Scores a tool definition and returns findings.        |
| `decideMcpToolApproval` | Converts findings into `allow`, `review`, or `block`. |
| `createAllowedMcpTools` | Produces the tool names that may be exposed.          |

## Policy inputs

The audit policy supports allowed tools, blocked tools, approval-required tools, sensitive keywords, and maximum description length.

Use this layer before mapping MCP tools into A2A skills. Registry, CLI, and operator workflows can store the audit result alongside the mapped skill so reviewers can understand why a tool is allowed, blocked, or sent to review.
