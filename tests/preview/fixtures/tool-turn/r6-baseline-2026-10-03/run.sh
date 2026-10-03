#!/bin/bash
# usage: run.sh <label>   (VARIANT=baseline|fixed). Residual-6 configuration check; one harness turn.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); LABEL=$1
CLAUDE=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/claude-cli-2.1.280/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
CFG=/Users/Shared/instar-preview-s2/config; PHOME=/Users/Shared/instar-preview-s2/home
D=$HERE/runs/$LABEL; mkdir -p "$D/ws" "$D/state"; chmod 700 "$D/ws"
WS=$(cd "$D/ws" && pwd -P); cp "$HERE/check.sh" "$WS/check.sh"
DUMMY=/tmp/w4tr-r6-dummy.sock
EXTRA_NET=""; [ "${VARIANT:-baseline}" = fixed ] && EXTRA_NET=', "allowUnixSockets": [], "allowAllUnixSockets": false'
cat > "$D/settings.json" <<JSON
{
  "sandbox": {
    "enabled": true, "failIfUnavailable": true, "autoAllowBashIfSandboxed": true, "allowUnsandboxedCommands": false,
    "network": { "allowedDomains": ["example.com"]$EXTRA_NET },
    "filesystem": { "allowWrite": ["$WS"], "denyRead": ["$CFG", "$HERE/runs", "/Users", "/Volumes"], "allowRead": ["$WS"] }
  },
  "permissions": { "allow": ["Bash", "Read", "Write", "Edit", "Glob", "Grep"], "deny": ["Read(/$CFG/**)", "Edit(/$CFG/**)", "Agent", "Task"] },
  "hooks": { "PreToolUse": [ { "matcher": "*", "hooks": [ { "type": "command", "command": "$(which node) $HERE/admit.mjs $D/state $WS 6 enforce" } ] } ] }
}
JSON
/usr/local/bin/node "$HERE/listener.mjs" "$DUMMY" "$D/listener.txt" & LPID=$!
sleep 1
cd "$WS"
env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin HOME="$PHOME" CLAUDE_CONFIG_DIR="$CFG" CLAUDE_CODE_MAX_RETRIES=0 \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 MAX_THINKING_TOKENS=0 \
  "$CLAUDE" --print --output-format stream-json --verbose --model claude-sonnet-5 \
  --setting-sources "" --settings "$D/settings.json" --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --disable-slash-commands --no-session-persistence --permission-mode default \
  --max-turns 4 --max-budget-usd 0.5 --tools "Bash,Read,Write,Edit,Glob,Grep" \
  --disallowedTools Agent Task CronCreate CronDelete CronList RemoteTrigger SendMessage TaskStop EnterWorktree ExitWorktree WebSearch WebFetch NotebookEdit ToolSearch ListAgents ReportFindings ScheduleWakeup Workflow \
  < "$HERE/prompt.txt" > "$D/out.jsonl" 2> "$D/err.txt"
echo "exit=$? label=$LABEL variant=${VARIANT:-baseline} at=$(date -u +%FT%TZ)" | tee "$D/exit.txt"
kill "$LPID" 2>/dev/null; rm -f "$DUMMY"
cat "$D/listener.txt"
