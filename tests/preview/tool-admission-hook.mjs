#!/usr/bin/env node
// The tool turn's mandatory PreToolUse/PostToolUse hook. argv: <pre|post> <stateDirectory>. The state
// directory (outside the workspace, never readable or writable by a tool) holds the turn's config
// (workspace, call cap, registered operations), the per-step call slots and the admission record.
// Fail closed: any error in `pre` exits 2, which Claude Code treats as a block.
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync } from 'node:fs';
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
// Hook processes overlap when the harness runs calls in parallel, so the count is not a read-modify-write:
// each call takes the lowest free slot by exclusive create, which the filesystem makes atomic. No more
// than `maxCalls` calls can ever hold a slot; a call that finds every slot taken is call maxCalls + 1.
const slots = join(stateDirectory, 'slots');
mkdirSync(slots, { recursive: true, mode: 0o700 });
const maxCalls = Number.isSafeInteger(config.maxCalls) && config.maxCalls >= 0 ? config.maxCalls : 0;
let n = maxCalls + 1;
for (let slot = 1; slot <= maxCalls; slot++) {
  try { closeSync(openSync(join(slots, String(slot)), 'wx', 0o600)); n = slot; break; }
  catch (error) { if (error?.code !== 'EEXIST') throw error; }
}
const decision = admitToolCall(call, config, n, { exists: existsSync, realpath: realpathSync });
record({ phase: 'pre', id: call.tool_use_id, n, tool: call.tool_name, input: clip(call.tool_input), decision: decision.decision,
  reason: decision.reason, ...(decision.kind ? { kind: decision.kind } : {}) });
const output = hookOutput(decision);
if (output) process.stdout.write(JSON.stringify(output));
process.exit(0);
