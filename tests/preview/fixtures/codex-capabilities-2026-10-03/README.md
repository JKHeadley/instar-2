Recorded live 2026-10-03 against codex-cli 0.156.1 (`codex exec --json`, hooks installed with `-c hooks.*`,
`--dangerously-bypass-hook-trust`, `-c web_search="live"`), with the operator's own login home and its two
installed MCP servers. The probe hook logged every PreToolUse/PostToolUse input it was sent and refused any
tool whose name contains `send`.

- `hook-input.jsonl`: the hook inputs in order: a web search (`webrun`), a subagent spawn
  (`collaborationspawn_agent`) and its wait (`collaborationwait_agent`), a read-only MCP call
  (`mcp__threadline__threadline_agents`), and an MCP send (`mcp__threadline__threadline_send`) the hook refused,
  so it has no PostToolUse input.
- `events.jsonl`: the turn's event stream: `web_search`, `collab_tool_call`, `mcp_tool_call` items, the hook-trust
  notice and the user-config warning the operator's own config.toml produced (a reviewed login home has no such
  warning), and no item for the refused send.
