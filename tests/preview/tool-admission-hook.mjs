#!/usr/bin/env node
// The mandatory hook of a tool turn or a delegated session. argv: <pre|post|child-start|child-stop> <stateDirectory>. The
// state directory (outside the workspace, never readable or writable by a tool) holds the turn's config (workspace, call
// cap, subagent budget, MCP reads, the installation's closed operation set, the effect policy, and the host checkpoint's
// address when the route has one), the per-step call and subagent slots and the admission record.
// When the route has a checkpoint (a delegated session step or a Codex tool turn), every tool call asks it
// (admission-gate.mjs) before it runs, so a closed step or a held stop refuses ordinary work too; a delegation or a
// consequential tool is decided there, and its result (or, for a harness wait on its children, the wait's outcome) is
// reported back after. Fail closed: any error in `pre` exits 2, which the harness treats as a block, and an unreachable
// checkpoint refuses. Plan #507: an outward tool request (a web read or search, an MCP or other outward tool, an
// unsandboxed command) first asks the runner's held-secret check (the host checkpoint on a checkpointed route, the turn's
// runner socket otherwise) and is refused if it carries a secret value the runner holds, before anything is done for it
// (a name lookup included); a check that cannot answer refuses (fails closed). The child rows are records only (the harness cannot be blocked from a subagent's start or stop
// hook), so they never fail the turn.
import { appendFileSync, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { connect, isIP } from 'node:net';
import { join } from 'node:path';
import { admitToolCall, CODEX_NETWORK_READ_TOOLS, DELEGATION_TOOLS, DELEGATION_WAIT_TOOLS, HELD_CHECK_MAX_BYTES, hookOutput, outwardText, OUTWARD_TOOLS,
  RECORD_EXCERPT_CHARS, SUBAGENT_TOOLS, webReadHost } from './tool-admission.mjs';

const NETWORK_TOOLS = Object.freeze(['WebFetch', 'WebSearch', ...CODEX_NETWORK_READ_TOOLS]);
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
/** Asks the host checkpoint; anything but its explicit allow is a refusal. */
const ask = async body => {
  const response = await fetch(`${config.gate}/admit`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const verdict = await response.json();
  // The effect owner's doorway decision rides the admission record, as a local doorway decision does (Rule 41).
  const doorway = verdict?.doorway && typeof verdict.doorway === 'object' && typeof verdict.doorway.effect === 'string' ? { doorway: verdict.doorway } : {};
  return verdict?.decision === 'allow' ? { decision: 'allow', reason: String(verdict.reason ?? ''), ...doorway }
    : { decision: 'deny', reason: String(verdict?.reason ?? 'admission checkpoint refused'), ...doorway };
};
// A network read is reported too: one the effect policy names was admitted by the effect owner, which records its result.
const gatedKind = () => DELEGATION_TOOLS.includes(String(call.tool_name)) ? 'delegation'
  : String(call.tool_name).startsWith('mcp__') || Object.hasOwn(OUTWARD_TOOLS, String(call.tool_name))
    || NETWORK_TOOLS.includes(String(call.tool_name))
    || (call.tool_name === 'Bash' && call.tool_input?.dangerouslyDisableSandbox) ? 'effect' : null;
if (mode === 'post') {
  const agent = SUBAGENT_TOOLS.includes(call.tool_name) && typeof call.tool_response?.agentId === 'string' ? { agent: call.tool_response.agentId } : {};
  record({ phase: 'post', id: call.tool_use_id, tool: call.tool_name, result: clip(call.tool_response), ...agent });
  // On a checkpointed route the checkpoint settles the delegation's edge or the effect's record. A report that cannot be
  // made leaves the edge open, and the parent settles it as uncertain when it closes.
  const kind = gatedKind() ?? (DELEGATION_WAIT_TOOLS.includes(String(call.tool_name)) ? 'wait' : null);
  if (kind && typeof config.gate === 'string') {
    try { await ask({ phase: 'post', kind, tool_name: call.tool_name, tool_use_id: call.tool_use_id,
      result_bytes: Buffer.byteLength(JSON.stringify(call.tool_response ?? null)), background: call.tool_input?.run_in_background === true,
      input_excerpt: clip(call.tool_input), result_excerpt: clip(call.tool_response) }); } catch { /* settled by the parent */ }
  }
  process.exit(0);
}
if (mode !== 'pre') throw Error('unknown hook mode');
// Hook processes overlap when the harness runs calls in parallel, so a count is not a read-modify-write:
// each call takes the lowest free slot by exclusive create, which the filesystem makes atomic. No more
// than `max` calls can ever hold a slot; a call that finds every slot taken is call max + 1. (On a checkpointed route the
// model-call ceiling is not this count: it is the host checkpoint's, before every model call.)
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
/** Plan #507: the runner's verdict on text an outward request would carry: null when clear, else the refusal. */
const heldVerdictOf = async text => {
  const refusal = reason => ({ decision: 'deny', reason, kind: 'secret' });
  if (Buffer.byteLength(text) > HELD_CHECK_MAX_BYTES) return refusal('the outward request is too large for the held-secret check, so it is refused');
  let verdict;
  try {
    if (typeof config.gate === 'string') {
      const answer = await ask({ phase: 'pre', kind: 'held', tool_name: call.tool_name, tool_use_id: call.tool_use_id, text });
      verdict = answer.decision === 'allow' ? 'clear' : answer.reason;
    } else if (typeof config.heldCheck === 'string') {
      verdict = await new Promise((resolve, reject) => {
        let answer = '';
        const link = connect(config.heldCheck);
        link.setEncoding('utf8');
        link.setTimeout(10000, () => link.destroy(Error('held-secret check timed out')));
        link.on('connect', () => link.end(`check ${Buffer.from(text, 'utf8').toString('base64')}\n`));
        link.on('data', chunk => { answer += chunk; });
        link.on('end', () => resolve(answer.trim()));
        link.on('error', reject);
      });
    } else verdict = 'unavailable';
  } catch { verdict = 'unavailable'; }
  if (verdict === 'clear') return null;
  return refusal(verdict === 'held' ? 'the request carries a secret value the runner holds'
    : verdict === 'unavailable' || !verdict ? 'the held-secret check is unavailable, so the outward request is refused' : verdict);
};
const outward = n <= bound(config.maxCalls) ? outwardText(call.tool_name, call.tool_input) : null;
const heldDecision = outward === null ? null : await heldVerdictOf(outward);
// A web read's host is resolved here, before the decision, so a name that points at this machine or its network is refused.
let addresses = null;
const target = call.tool_name === 'WebFetch' && heldDecision === null ? webReadHost(call.tool_input?.url) : { host: null };
if (target.host !== null && !isIP(target.host)) {
  try { addresses = (await lookup(target.host, { all: true, verbatim: true })).map(entry => entry.address); } catch { addresses = null; }
}
// `exists` does not follow symlinks, so a dangling link is present and then refused as unresolvable (resolvedPath).
const exists = path => { try { lstatSync(path); return true; } catch { return false; } };
let decision = heldDecision ?? admitToolCall(call, config, n, { exists, realpath: realpathSync, addresses: () => addresses }, child, Date.now());
if (heldDecision !== null) { /* refused before anything else was decided or done for it */ }
else if (decision.decision === 'gate') {
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
record({ phase: 'pre', id: call.tool_use_id, n, tool: call.tool_name, input: heldDecision === null ? clip(call.tool_input) : JSON.stringify('[withheld: an outward request the held-secret check refused]'), decision: decision.decision,
  reason: decision.reason, ...(decision.kind ? { kind: decision.kind } : {}), ...(decision.kind === 'subagent' ? { child } : {}),
  ...(typeof call.agent_id === 'string' && call.agent_id ? { agent: call.agent_id } : {}), ...(decision.doorway ? { doorway: decision.doorway } : {}) },
  decision.doorway !== undefined);
const output = hookOutput(decision);
if (output) process.stdout.write(JSON.stringify(output));
process.exit(0);
