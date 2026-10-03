#!/usr/bin/env node
// The mandatory PreToolUse/PostToolUse hook of a tool turn or a delegated session. argv: <pre|post> <stateDirectory>. The state
// directory (outside the workspace, never readable or writable by a tool) holds the turn's config (workspace, tool-call
// cap, and the host checkpoint's address when the route has one), the per-step tool-call slots and the admission record.
// When the route has a checkpoint, every tool call asks it (admission-gate.mjs) before it runs, so a closed step or a held
// stop refuses ordinary work too; a delegation or a consequential tool is decided there, and its result (or, for a
// harness wait on its children, the wait's outcome) is reported back after. Fail closed: any error in `pre` exits 2,
// which the harness treats as a block, and an unreachable checkpoint refuses.
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { admitToolCall, DELEGATION_TOOLS, DELEGATION_WAIT_TOOLS, hookOutput, RECORD_EXCERPT_CHARS } from './tool-admission.mjs';

const [mode, stateDirectory] = process.argv.slice(2);
const refuse = error => { process.stderr.write(`tool admission refused: ${error?.message ?? error}`); process.exit(2); };
process.on('uncaughtException', refuse); process.on('unhandledRejection', refuse);
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const call = JSON.parse(raw);
const config = JSON.parse(readFileSync(join(stateDirectory, 'config.json'), 'utf8'));
const record = row => appendFileSync(join(stateDirectory, 'admission.jsonl'), `${JSON.stringify(row)}\n`, { mode: 0o600 });
const clip = value => { const text = JSON.stringify(value ?? null); return text.length > RECORD_EXCERPT_CHARS ? `${text.slice(0, RECORD_EXCERPT_CHARS)}…` : text; };
/** Asks the host checkpoint; anything but its explicit allow is a refusal. */
const ask = async body => {
  const response = await fetch(`${config.gate}/admit`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const verdict = await response.json();
  return verdict?.decision === 'allow' ? { decision: 'allow', reason: String(verdict.reason ?? '') }
    : { decision: 'deny', reason: String(verdict?.reason ?? 'admission checkpoint refused') };
};
const gatedKind = () => DELEGATION_TOOLS.includes(String(call.tool_name)) ? 'delegation'
  : String(call.tool_name).startsWith('mcp__') || (call.tool_name === 'Bash' && call.tool_input?.dangerouslyDisableSandbox) ? 'effect' : null;
if (mode === 'post') {
  record({ phase: 'post', id: call.tool_use_id, tool: call.tool_name, result: clip(call.tool_response) });
  // The checkpoint settles the delegation's edge or the effect's record. A report that cannot be made leaves the edge
  // open, and the parent settles it as uncertain when it closes.
  const kind = gatedKind() ?? (DELEGATION_WAIT_TOOLS.includes(String(call.tool_name)) ? 'wait' : null);
  if (kind && typeof config.gate === 'string') {
    try { await ask({ phase: 'post', kind, tool_name: call.tool_name, tool_use_id: call.tool_use_id,
      result_bytes: Buffer.byteLength(JSON.stringify(call.tool_response ?? null)), background: call.tool_input?.run_in_background === true,
      input_excerpt: clip(call.tool_input), result_excerpt: clip(call.tool_response) }); } catch { /* settled by the parent */ }
  }
  process.exit(0);
}
if (mode !== 'pre') throw Error('unknown hook mode');
// Hook processes overlap when the harness runs calls in parallel, so the count is not a read-modify-write:
// each call takes the lowest free slot by exclusive create, which the filesystem makes atomic. No more
// than `maxCalls` slots can ever be held; a call that finds none is call maxCalls + 1 and is refused. (The
// model-call ceiling is not this count: it is the host checkpoint's, before every model call.)
const slots = join(stateDirectory, 'slots');
mkdirSync(slots, { recursive: true, mode: 0o700 });
const maxCalls = Number.isSafeInteger(config.maxCalls) && config.maxCalls >= 0 ? config.maxCalls : 0;
let n = maxCalls + 1;
for (let slot = 1; slot <= maxCalls; slot++) {
  try { closeSync(openSync(join(slots, String(slot)), 'wx', 0o600)); n = slot; break; }
  catch (error) { if (error?.code !== 'EEXIST') throw error; }
}
let decision = admitToolCall(call, config, n, { exists: existsSync, realpath: realpathSync });
if (decision.decision === 'gate') {
  const kind = decision.kind;
  try { decision = { ...(await ask({ phase: 'pre', kind, tool_name: call.tool_name, tool_input: call.tool_input ?? null,
    tool_use_id: call.tool_use_id })), kind }; }
  catch (error) { decision = { decision: 'deny', reason: `admission checkpoint unreachable: ${error?.message ?? error}`, kind }; }
} else if (decision.decision === 'allow' && typeof config.gate === 'string') {
  // Ordinary work keeps its local scope decision (and its confined-shell rewrite), and runs only while the step's claim
  // is open and no stop is held: the checkpoint is the live authority for both.
  let live;
  try { live = await ask({ phase: 'pre', kind: 'tool', tool_name: call.tool_name, tool_use_id: call.tool_use_id }); }
  catch (error) { live = { decision: 'deny', reason: `admission checkpoint unreachable: ${error?.message ?? error}` }; }
  if (live.decision !== 'allow') decision = { decision: 'deny', reason: live.reason, kind: 'stop' };
}
record({ phase: 'pre', id: call.tool_use_id, n, tool: call.tool_name, input: clip(call.tool_input), decision: decision.decision,
  reason: decision.reason, ...(decision.kind ? { kind: decision.kind } : {}) });
const output = hookOutput(decision);
if (output) process.stdout.write(JSON.stringify(output));
process.exit(0);
