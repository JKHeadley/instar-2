#!/usr/bin/env node
// Spike PreToolUse hook: stub of the preview's effect-doorway admission.
// argv: <stateDir> <workspace> <maxCalls> <mode: enforce|observe>
// Deny by default; ordinary in-workspace file tools and sandboxed, non-network,
// non-delete shell are admitted; everything consequential goes to doorwayAdmit(),
// which (stub) refuses every request, like an unregistered effect kind.
import fs from 'node:fs'; import path from 'node:path';
const failClosed = e => { process.stderr.write('admission hook error, refused: ' + (e && e.message)); process.exit(2); };
process.on('uncaughtException', failClosed); process.on('unhandledRejection', failClosed);
const [stateDir, workspace, maxCallsS, mode] = process.argv.slice(2);
const maxCalls = Number(maxCallsS);
let raw = ''; for await (const c of process.stdin) raw += c;
const input = JSON.parse(raw);
const tool = String(input.tool_name || ''); const ti = input.tool_input || {};
const realWs = fs.realpathSync(workspace);
function resolveReal(p) { // physical containment: resolve symlinks of the longest existing prefix
  let abs = path.resolve(realWs, String(p)); let rest = [];
  while (!fs.existsSync(abs)) { rest.unshift(path.basename(abs)); const up = path.dirname(abs); if (up === abs) break; abs = up; }
  return path.join(fs.realpathSync(abs), ...rest);
}
const inside = p => { const r = resolveReal(p); return r === realWs || r.startsWith(realWs + path.sep); };
function doorwayAdmit(kind, detail) { return { admitted: false, reason: `effect-doorway: no registered operation admits ${kind}; refused by default` }; }
const counterFile = path.join(stateDir, 'calls');
const n = (fs.existsSync(counterFile) ? Number(fs.readFileSync(counterFile, 'utf8')) : 0) + 1;
fs.writeFileSync(counterFile, String(n));
let decision = 'allow', reason = 'ordinary in-scope operation';
if (n > maxCalls) { decision = 'deny'; reason = `per-step call cap ${maxCalls} reached (call ${n})`; }
else if (['Read', 'Write', 'Edit', 'NotebookEdit'].includes(tool)) {
  const p = ti.file_path ?? ti.notebook_path; if (!p || !inside(p)) { decision = 'deny'; reason = `path outside workspace: ${p}`; }
} else if (['Glob', 'Grep'].includes(tool)) {
  const p = ti.path ?? realWs; const pat = String(ti.pattern ?? '');
  if (!inside(p) || pat.startsWith('/') || pat.includes('..')) { decision = 'deny'; reason = `search outside workspace: ${p} ${pat}`; }
} else if (tool === 'Bash') {
  const cmd = String(ti.command || '');
  const consequential = [
    [/\b(curl|wget|nc|ncat|ssh|scp|rsync|ftp|telnet|socat|openssl\s+s_client)\b|\bgit\s+(push|fetch|pull|clone)\b|\b(npm|pnpm|yarn|pip3?|brew)\s+(install|publish|add)\b|https?:\/\//, 'network'],
    [/\b(rm|rmdir|unlink|shred|truncate)\b|\bgit\s+(reset|clean)\b/, 'delete'],
    [/\b(security|osascript|launchctl|sudo|kill|pkill|killall|open)\b/, 'host-control'],
    [/\b(mail|sendmail)\b|telegram|slack/i, 'send'],
  ].find(([re]) => re.test(cmd));
  if (consequential) { const a = doorwayAdmit(consequential[1], cmd); decision = a.admitted ? 'allow' : 'deny'; reason = a.reason; }
  else if (ti.dangerouslyDisableSandbox) { decision = 'deny'; reason = 'unsandboxed execution refused'; }
} else if (tool.startsWith('mcp__')) { const a = doorwayAdmit('mcp', tool); decision = 'deny'; reason = a.reason; }
else if (['WebFetch', 'WebSearch'].includes(tool)) { const a = doorwayAdmit('network', JSON.stringify(ti)); decision = 'deny'; reason = a.reason; }
else if (['TodoWrite'].includes(tool)) { /* internal bookkeeping */ }
else { decision = 'deny'; reason = `unregistered tool ${tool}: refused by default`; }
const effective = mode === 'observe' ? 'allow' : decision;
fs.appendFileSync(path.join(stateDir, 'admission.jsonl'), JSON.stringify({ n, tool, input: ti, decision, effective, reason }) + '\n');
if (effective === 'deny') {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
}
process.exit(0);
