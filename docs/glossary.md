# Glossary

- Agent: a program that exposes an A2A-compatible endpoint for task execution.
- Agent Card: discovery metadata for an A2A agent, published at `/.well-known/agent-card.json`.
- Artifact: output produced by a task, such as text, file parts, or structured data.
- A2A (Agent2Agent): an open protocol for agent-to-agent communication.
- JSON-RPC: the remote procedure call protocol used for A2A interactions.
- MCP bridge: mapping layer between supported MCP tool shapes and A2A calls.
- Registry: a server that stores and serves agent cards, tracks health, and provides discovery.
- SSE (Server-Sent Events): used for streaming task updates and live registry feeds.
- Task: unit of work with status transitions (submitted, working, completed, failed, etc.).
