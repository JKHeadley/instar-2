// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule, runner side: the call cap reserves a tool turn's whole liability
// before dispatch (MF4) and retains it; a short allowance answers without tools; the trace closes exactly one
// reserved turn; the workspace is private and fresh; status names exactly the tools; and a stop ends a live
// turn, descendants included, by the launch's own process group within the declared bound.
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
import { SUBSCRIPTION_TOOL_LIMITS, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { capabilityBriefing, TOOLS_BRIEFING } from './briefing.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { prepareToolTurn, pruneToolTurns, readToolTrace, runToolTurn, toolStatusLines, toolTurnEligible, workspaceBytes, TOOL_HOOK_SCRIPT } from './tool-turn.mjs';
// @ts-expect-error The physical host remains JavaScript.
import { createResourceOwner } from '../../scripts/resource-owner.mjs';

const key = new Uint8Array(32).fill(7);
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const dir = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-turn-'))); roots.push(root); return root; };
const journalAt = (root: string, maxCalls: number) => openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis',
  bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
  expires: 9_999_999_999_999, maxCalls, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });

it('reserves the whole tool-turn liability against the call cap, retains it, and refuses a reservation past the cap', () => {
  const root = dir(), extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1;
  const journal = journalAt(root, extra + 2);
  const id = 'telegram:12345678:update:5';
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: extra, at: 1 });
  expect(journal.view.calls).toBe(extra);
  expect(journal.view.toolTurns).toMatchObject({ invocations: 1, reservedCalls: extra, open: [`${id}#0`] });
  journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, consistent: true, workspaceBytes: 11, at: 2,
    calls: [{ n: 1, tool: 'Write', input: '{}', decision: 'allow', reason: 'r', result: '"ok"' },
      { n: 2, tool: 'Bash', input: '{"command":"curl x"}', decision: 'deny', reason: 'effect doorway', kind: 'network', result: null }] });
  // The reservation is retained after the trace: the subscription charge is unknown, never settled down.
  expect(journal.view.calls).toBe(extra);
  expect(journal.view.toolTurns).toMatchObject({ toolCalls: 1, toolRefusals: 1, open: [] });
  // Past the cap: a second whole-liability reservation would exceed it, so the journal refuses the row.
  expect(() => journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 1, calls: extra, at: 3 })).toThrow(/reservation or cap/u);
  expect(journal.view.calls).toBe(extra);
  // A refusal is recorded instead, and a trace never closes a turn that was not reserved.
  journal.append({ kind: 'tool-turn', phase: 'refused', id, reason: 'call cap', at: 4 });
  expect(journal.view.toolTurns?.refusedCap).toBe(1);
  expect(() => journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 7, consistent: true, workspaceBytes: 0, calls: [], at: 5 }))
    .toThrow(/tool trace order/u);
  // Replay reaches the same projection.
  const reopened = journalAt(root, extra + 2);
  expect(reopened.view.calls).toBe(extra);
  expect(reopened.view.toolTurns).toEqual(journal.view.toolTurns);
});

it('allocates a private, empty workspace and a separate admission state per turn, and keeps bounded history', () => {
  const root = dir();
  const turn = prepareToolTurn({ root, operation: 'telegram:1:update:2', attempt: 0, operations: SINGLE_MACHINE_PROFILE.operations });
  expect(readdirSync(turn.workspace)).toEqual([]);
  for (const path of [turn.workspace, turn.stateDirectory]) expect(lstatSync(path).mode & 0o777).toBe(0o700);
  expect(turn.workspace.startsWith(join(root, 'tool-turns'))).toBe(true);
  expect(turn.stateDirectory.startsWith(turn.workspace)).toBe(false);
  expect(JSON.parse(readFileSync(join(turn.stateDirectory, 'config.json'), 'utf8'))).toEqual({ workspace: turn.workspace,
    maxCalls: SUBSCRIPTION_TOOL_LIMITS.maxToolCalls, maxWriteBytes: SUBSCRIPTION_TOOL_LIMITS.maxWriteBytes,
    operations: [...SINGLE_MACHINE_PROFILE.operations] });
  expect(turn.hook).toEqual({ node: process.execPath, script: TOOL_HOOK_SCRIPT });
  // The same attempt is never reused: a repeat allocation refuses rather than sharing a workspace.
  expect(() => prepareToolTurn({ root, operation: 'telegram:1:update:2', attempt: 0, operations: [] })).toThrow();
  writeFileSync(join(turn.workspace, 'note.txt'), 'hello reuse');
  expect(workspaceBytes(turn.workspace)).toBe(11);
  expect(readToolTrace(turn.stateDirectory)).toMatchObject({ calls: [], consistent: true });
  for (let i = 1; i <= 4; i++) {
    const t = prepareToolTurn({ root, operation: `telegram:1:update:${String(i + 2)}`, attempt: i, operations: [] });
    utimesSync(join(t.workspace, '..'), i * 1000, i * 1000);
  }
  utimesSync(join(turn.workspace, '..'), 0, 0);
  expect(pruneToolTurns(root, 2)).toEqual({ removed: 3, failed: 0 });
  expect(existsSync(turn.workspace)).toBe(false);
  expect(readdirSync(join(root, 'tool-turns'))).toHaveLength(2);
});

it('runs tools only for answer turns and scheduled work, never for reviews, summaries or benchmark reruns', () => {
  for (const id of ['telegram:8820318295:update:120', 'obligation:commitment:3:1790000000000']) expect(toolTurnEligible(id)).toBe(true);
  for (const id of ['telegram:1:update:2:reply-review', 'telegram:1:update:2:revision-review', 'summary:12', 'summary:12:review',
    'retrospective:3', 'retrospective:3:rerun:0', 'index:1']) expect(toolTurnEligible(id)).toBe(false);
});

it('tells the agent and the operator exactly which tools exist, and that MCP, subagents, web search and network do not', () => {
  const read = () => JSON.stringify({ generation: 'g', commit: 'c', launchers: { 'tests/preview/journal-agent.mjs': [] } });
  const withTools = capabilityBriefing(read, { providerAttempts: 50, expiresAt: 1, tools: true }).text;
  expect(withTools).toContain(TOOLS_BRIEFING);
  for (const name of SUBSCRIPTION_TOOL_NAMES) expect(TOOLS_BRIEFING).toContain(name);
  expect(TOOLS_BRIEFING).toMatch(/no MCP, subagents, web or network/u);
  // No longer than the no-tools line it replaces: the floor packet has no slack.
  expect(Buffer.byteLength(TOOLS_BRIEFING)).toBeLessThanOrEqual(Buffer.byteLength('Nothing unlisted is available: no tools, browsing, running code '
    + 'or acting outside this chat, and no message you start yourself beyond the listed answers to later-time requests.'));
  expect(withTools).not.toContain('no tools, browsing, running code');
  const without = capabilityBriefing(read, { providerAttempts: 50, expiresAt: 1 }).text;
  expect(without).toContain('Nothing unlisted is available: no tools, browsing, running code');
  expect(without).not.toContain(TOOLS_BRIEFING);
  const fallback = capabilityBriefing(() => { throw Error('absent'); }, { providerAttempts: 1, expiresAt: 1, tools: true }).text;
  expect(fallback).toContain(TOOLS_BRIEFING); expect(fallback).not.toContain('You have no tools');
  const view = { toolTurns: { invocations: 2, reservedCalls: 14, refusedCap: 1, toolCalls: 5, toolRefusals: 2, inconsistent: 0, open: [] } };
  expect(toolStatusLines(view, true)).toEqual([
    'Tools: Read, Write, Edit, Glob, Grep, Bash, in a private per-turn workspace; no MCP servers, subagents, web search or network.',
    'Tool turns: 2 run (14 model attempts reserved for them), 5 tool calls admitted, 2 refused, 1 turns answered without tools because the call allowance was short.']);
  expect(toolStatusLines({ toolTurns: { ...view.toolTurns, open: ['x#3'] } }, true)[1]).toContain('1 without a recorded trace yet');
  expect(toolStatusLines(view, false)).toEqual([]);
});

it('ends a live turn on stop by its own process group, descendants included, within the declared bound', { timeout: 20000 }, async () => {
  const root = dir();
  // A stand-in harness: it starts a shell child (as Bash would), records both pids, then waits forever.
  const harness = join(root, 'harness.mjs'), pids = join(root, 'pids.json');
  writeFileSync(harness, `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const child = spawn('/bin/sh', ['-c', 'while :; do /bin/sleep 1; done'], { stdio: 'ignore' });
writeFileSync(${JSON.stringify(pids)}, JSON.stringify({ harness: process.pid, child: child.pid })); setInterval(() => {}, 1000);`);
  const owner = createResourceOwner();
  await owner.attach({});
  let stop = false;
  const started = performance.now();
  const run = owner.execute({ executable: process.execPath, args: [harness], cwd: root, env: { PATH: '/usr/bin:/bin' }, stdin: '',
    timeout: 15000, maxBytes: 65536, stopped: () => stop }, 'answer');
  while (!existsSync(pids)) await new Promise(resolve => setTimeout(resolve, 50));
  const { harness: harnessPid, child } = JSON.parse(readFileSync(pids, 'utf8'));
  const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  expect(alive(harnessPid) && alive(child)).toBe(true);
  stop = true; const stoppedAt = performance.now();
  const result = await run;
  const ended = performance.now() - stoppedAt;
  expect(result).toMatchObject({ limited: true, localLimit: null, stdout: '' });
  expect(alive(harnessPid)).toBe(false); expect(alive(child)).toBe(false);
  // Declared bound: observed within one 25 ms poll, the group SIGKILLed at once, quiescence verified in ≤ 2 s.
  expect(ended).toBeLessThan(3000);
  expect(performance.now() - started).toBeLessThan(15000);
});

it('runs one tool turn: refuses to the text-only answer on a short allowance or prompt room, journals every trace, refuses a bypass', async () => {
  const extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1, id = 'telegram:12345678:update:9';
  const base = (journal: ReturnType<typeof journalAt>, root: string, invoke: (turn: { workspace: string; stateDirectory: string }) => Promise<unknown>) => ({
    journal, root, id, prepared: '{"q":1}', promptLimit: 32768, deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations,
    now: () => 10, redactText: (text: string) => text.replace('SECRET', '[redacted]'), fallback: async () => ({ result: 'text-only' }), invoke });
  // Short allowance: refused, recorded, answered without tools, nothing reserved or launched.
  let root = dir(), journal = journalAt(root, extra - 1), launched = 0;
  expect(await runToolTurn(base(journal, root, async () => { launched++; }))).toEqual({ result: 'text-only' });
  expect([journal.view.calls, journal.view.toolTurns?.refusedCap, launched]).toEqual([0, 1, 0]);
  // The other side of the cap: exactly enough allowance runs the turn.
  root = dir(); journal = journalAt(root, extra);
  const rows: { kind: string; phase?: string }[] = [], real = journal;
  const spied = { get view() { return real.view; }, append: (row: never) => { rows.push(row); return real.append(row); } } as unknown as typeof journal;
  const ran = await runToolTurn(base(spied, root, async turn => {
    // A stand-in for the hook's record of one admitted Write and its result.
    writeFileSync(join(turn.stateDirectory, 'admission.jsonl'), [
      JSON.stringify({ phase: 'pre', id: 't1', n: 1, tool: 'Write', input: '{"content":"SECRET"}', decision: 'allow', reason: 'ordinary' }),
      JSON.stringify({ phase: 'post', id: 't1', tool: 'Write', result: '"created"' })].join('\n'));
    writeFileSync(join(turn.workspace, 'note.txt'), 'hello reuse');
    return 'answer';
  }));
  expect(ran.result).toBe('answer');
  expect(journal.view.calls).toBe(extra);
  expect(journal.view.toolTurns).toMatchObject({ invocations: 1, toolCalls: 1, open: [] });
  expect(rows.map(row => row.phase)).toEqual(['reserved', 'trace']);
  expect(rows[1]).toMatchObject({ kind: 'tool-turn', phase: 'trace', consistent: true, workspaceBytes: 11,
    calls: [{ n: 1, tool: 'Write', decision: 'allow', input: '{"content":"[redacted]"}', result: '"created"' }] });
  // Prompt room: a packet the tool system prompt would overflow answers without tools.
  root = dir(); journal = journalAt(root, 50);
  const big = { ...base(journal, root, async () => 'x'), prepared: 'x'.repeat(32768 - Buffer.byteLength(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) + 1) };
  expect(await runToolTurn(big)).toEqual({ result: 'text-only' });
  expect(journal.view.toolTurns?.refusedPrompt).toBe(1);
  // A tool result with no admitted call before it: the trace is journaled, the answer refused.
  root = dir(); journal = journalAt(root, 50);
  await expect(runToolTurn(base(journal, root, async turn => {
    writeFileSync(join(turn.stateDirectory, 'admission.jsonl'), JSON.stringify({ phase: 'post', id: 'x', tool: 'Read', result: '"y"' }));
    return 'answer';
  }))).rejects.toThrow(/without its admission record/u);
  expect(journal.view.toolTurns).toMatchObject({ inconsistent: 1, open: [] });
  // A failed launch: the trace still closes the reservation, and the failure surfaces unchanged.
  root = dir(); journal = journalAt(root, 50);
  await expect(runToolTurn(base(journal, root, async () => { throw Error('launch failed'); }))).rejects.toThrow('launch failed');
  expect(journal.view.toolTurns).toMatchObject({ invocations: 1, open: [] });
  expect(journal.view.calls).toBe(extra);
});
