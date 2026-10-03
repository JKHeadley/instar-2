#!/usr/bin/env node
// The mandatory PreToolUse/PostToolUse hook of a tool turn or a delegated session. argv: <pre|post> <stateDirectory>. The state
// directory (outside the workspace, never readable or writable by a tool) holds the turn's config
// (workspace, call cap, registered operations), the per-step call slots and the admission record.
// Fail closed: any error in `pre` exits 2, which Claude Code treats as a block.
import { execFileSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { admitToolCall, callCost, hookOutput, RECORD_EXCERPT_CHARS } from './tool-admission.mjs';

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
// each call takes the lowest free slots by exclusive create, which the filesystem makes atomic. No more
// than `maxCalls` slots can ever be held; a call that cannot take all it costs is call maxCalls + 1.
const slots = join(stateDirectory, 'slots');
mkdirSync(slots, { recursive: true, mode: 0o700 });
const maxCalls = Number.isSafeInteger(config.maxCalls) && config.maxCalls >= 0 ? config.maxCalls : 0;
const cost = config.harness ? callCost(call) : 1;
let n = maxCalls + 1, taken = 0;
for (let slot = 1; slot <= maxCalls && taken < cost; slot++) {
  try { closeSync(openSync(join(slots, String(slot)), 'wx', 0o600)); n = slot; taken++; }
  catch (error) { if (error?.code !== 'EEXIST') throw error; }
}
if (taken < cost) n = maxCalls + 1;
const decision = admitToolCall(call, config, n, { exists: existsSync, realpath: realpathSync });
record({ phase: 'pre', id: call.tool_use_id, n, tool: call.tool_name, input: clip(call.tool_input), decision: decision.decision,
  reason: decision.reason, ...(decision.kind ? { kind: decision.kind } : {}) });
// A delegated session or a Codex turn (`harness` set) has no per-turn model-call limit of its own, and a refused
// call's result would itself start another model call. So a call past the reserved ceiling ends the harness: the
// marker tells the runner why, and the harness process that ran this hook (found by walking up from this hook's
// parent, by exact PID) is stopped before any further model call can be dispatched.
if (config.harness && n > maxCalls) {
  writeFileSync(join(stateDirectory, 'ceiling'), JSON.stringify({ n, maxCalls, tool: call.tool_name }), { mode: 0o600 });
  stopHarness(config.harness);
  refuse(decision.reason);
}
const output = hookOutput(decision);
if (output) process.stdout.write(JSON.stringify(output));
process.exit(0);

/** Stops the nearest ancestor whose executable is the named harness. Exact PIDs only, read from `ps` for this
 * process's own ancestry; nothing is matched by pattern across other processes. */
function stopHarness(harness) {
  let pid = process.ppid;
  for (let depth = 0; depth < 6 && pid > 1; depth++) {
    const line = execFileSync('/bin/ps', ['-o', 'ppid=,comm=', '-p', String(pid)], { encoding: 'utf8' }).trim();
    const [parent, ...command] = line.split(/\s+/u);
    if (basename(command.join(' ')) === harness) { process.kill(pid, 'SIGTERM'); return; }
    pid = Number(parent);
  }
  throw Error(`no ${harness} ancestor to stop`);
}
