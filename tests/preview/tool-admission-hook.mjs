#!/usr/bin/env node
// The tool turn's mandatory PreToolUse/PostToolUse hook. argv: <pre|post> <stateDirectory>. The state
// directory (outside the workspace, never readable or writable by a tool) holds the turn's config
// (workspace, call cap, registered operations), the per-step count and the admission record.
// Fail closed: any error in `pre` exits 2, which Claude Code treats as a block.
import { appendFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { admitToolCall, hookOutput, RECORD_EXCERPT_CHARS } from './tool-admission.mjs';

const [mode, stateDirectory] = process.argv.slice(2);
const refuse = error => { process.stderr.write(`tool admission refused: ${error?.message ?? error}`); process.exit(2); };
process.on('uncaughtException', refuse); process.on('unhandledRejection', refuse);
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const call = JSON.parse(raw);
const config = JSON.parse(readFileSync(join(stateDirectory, 'config.json'), 'utf8'));
const record = row => appendFileSync(join(stateDirectory, 'admission.jsonl'), `${JSON.stringify(row)}\n`, { mode: 0o600 });
const clip = value => { const text = JSON.stringify(value ?? null); return text.length > RECORD_EXCERPT_CHARS ? `${text.slice(0, RECORD_EXCERPT_CHARS)}…` : text; };
if (mode === 'post') {
  record({ phase: 'post', id: call.tool_use_id, tool: call.tool_name, result: clip(call.tool_response) });
  process.exit(0);
}
if (mode !== 'pre') throw Error('unknown hook mode');
const counter = join(stateDirectory, 'calls');
const n = (existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0) + 1;
writeFileSync(counter, String(n), { mode: 0o600 });
const decision = admitToolCall(call, config, n, { exists: existsSync, realpath: realpathSync });
record({ phase: 'pre', id: call.tool_use_id, n, tool: call.tool_name, input: clip(call.tool_input), decision: decision.decision,
  reason: decision.reason, ...(decision.kind ? { kind: decision.kind } : {}) });
const output = hookOutput(decision);
if (output) process.stdout.write(JSON.stringify(output));
process.exit(0);
