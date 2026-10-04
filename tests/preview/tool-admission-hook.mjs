#!/usr/bin/env node
// The tool turn's mandatory hook. argv: <pre|post|child-start|child-stop> <stateDirectory>. The state
// directory (outside the workspace, never readable or writable by a tool) holds the turn's config
// (workspace, call cap, subagent budget, MCP reads, the installation's closed operation set, the effect policy), the
// per-step call and subagent slots and the admission record.
// Fail closed: any error in `pre` exits 2, which Claude Code treats as a block. The child rows are records
// only (the harness cannot be blocked from a subagent's start or stop hook), so they never fail the turn.
import { appendFileSync, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { admitToolCall, hookOutput, RECORD_EXCERPT_CHARS, SUBAGENT_TOOLS, webReadHost } from './tool-admission.mjs';

const [mode, stateDirectory] = process.argv.slice(2);
const childRow = mode === 'child-start' || mode === 'child-stop';
const refuse = error => { process.stderr.write(`tool admission refused: ${error?.message ?? error}`); process.exit(childRow ? 0 : 2); };
process.on('uncaughtException', refuse); process.on('unhandledRejection', refuse);
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const call = JSON.parse(raw);
const config = JSON.parse(readFileSync(join(stateDirectory, 'config.json'), 'utf8'));
const record = (row, durable = false) => {
  const path = join(stateDirectory, 'admission.jsonl');
  appendFileSync(path, `${JSON.stringify(row)}\n`, { mode: 0o600 });
  // An effect-doorway decision is durable before the call proceeds (an act follows its durable cause).
  if (durable) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
};
const clip = value => { const text = JSON.stringify(value ?? null); return text.length > RECORD_EXCERPT_CHARS ? `${text.slice(0, RECORD_EXCERPT_CHARS)}…` : text; };
if (childRow) {
  // Rule 114: a started child is a durable fact on this machine before it does anything (synced to disk).
  const fd = openSync(join(stateDirectory, 'admission.jsonl'), 'a', 0o600);
  try { writeSync(fd, `${JSON.stringify({ phase: mode, agent: String(call.agent_id ?? ''), type: String(call.agent_type ?? '') })}\n`); fsyncSync(fd); }
  finally { closeSync(fd); }
  process.exit(0);
}
if (mode === 'post') {
  const agent = SUBAGENT_TOOLS.includes(call.tool_name) && typeof call.tool_response?.agentId === 'string' ? { agent: call.tool_response.agentId } : {};
  record({ phase: 'post', id: call.tool_use_id, tool: call.tool_name, result: clip(call.tool_response), ...agent });
  process.exit(0);
}
if (mode !== 'pre') throw Error('unknown hook mode');
// Hook processes overlap when the harness runs calls in parallel, so a count is not a read-modify-write:
// each call takes the lowest free slot by exclusive create, which the filesystem makes atomic. No more
// than `max` calls can ever hold a slot; a call that finds every slot taken is call max + 1.
const takeSlot = (name, max) => {
  const slots = join(stateDirectory, name);
  mkdirSync(slots, { recursive: true, mode: 0o700 });
  for (let slot = 1; slot <= max; slot++) {
    try { closeSync(openSync(join(slots, String(slot)), 'wx', 0o600)); return slot; }
    catch (error) { if (error?.code !== 'EEXIST') throw error; }
  }
  return max + 1;
};
const bound = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const n = takeSlot('slots', bound(config.maxCalls));
// A subagent slot is spent only by a call that would otherwise be admitted, so a refused shape never uses up the budget.
// A subagent's own subagent takes a slot of the same budget (Rule 114: the turn's one reservation covers the whole tree).
const child = SUBAGENT_TOOLS.includes(call.tool_name) && n <= bound(config.maxCalls)
  && typeof config.children?.type === 'string' && call.tool_input?.subagent_type === config.children.type
  && typeof call.tool_input?.prompt === 'string' && call.tool_input.prompt.trim() ? takeSlot('children', bound(config.children?.max)) : 1;
// A web read's host is resolved here, before the decision, so a name that points at this machine or its network is refused.
let addresses = null;
const target = call.tool_name === 'WebFetch' ? webReadHost(call.tool_input?.url) : { host: null };
if (target.host !== null && !isIP(target.host)) {
  try { addresses = (await lookup(target.host, { all: true, verbatim: true })).map(entry => entry.address); } catch { addresses = null; }
}
// `exists` does not follow symlinks, so a dangling link is present and then refused as unresolvable (resolvedPath).
const exists = path => { try { lstatSync(path); return true; } catch { return false; } };
const decision = admitToolCall(call, config, n, { exists, realpath: realpathSync, addresses: () => addresses }, child, Date.now());
record({ phase: 'pre', id: call.tool_use_id, n, tool: call.tool_name, input: clip(call.tool_input), decision: decision.decision,
  reason: decision.reason, ...(decision.kind ? { kind: decision.kind } : {}), ...(decision.kind === 'subagent' ? { child } : {}),
  ...(typeof call.agent_id === 'string' && call.agent_id ? { agent: call.agent_id } : {}), ...(decision.doorway ? { doorway: decision.doorway } : {}) },
  decision.doorway !== undefined);
const output = hookOutput(decision);
if (output) process.stdout.write(JSON.stringify(output));
process.exit(0);
