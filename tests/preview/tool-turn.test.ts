// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule, runner side: the call cap reserves a tool turn's whole liability
// before dispatch (MF4) and retains it; a short allowance answers without tools; the trace closes exactly one
// reserved turn; the workspace is private, on a fixed-size volume that refuses writes past its size and keeps its files between turns;
// status names exactly the tools; and a stop ends a live turn, descendants included, by the launch's own process
// group within the declared bound.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
import { SUBSCRIPTION_SUBAGENT_TYPE, SUBSCRIPTION_TOOL_LIMITS, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { capabilityBriefing, TOOLS_BRIEFING } from './briefing.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { attachScratch, detachScratch, unmountScratch, prepareToolTurn, pruneToolTurns, readRootMcp, readToolTrace, runToolTurn, scratchMounted, toolChildrenFit, toolStatusLines, toolTurnEligible, toolTurnFits, workspaceBytes, TOOL_HOOK_SCRIPT, TOOL_NOTICE_MAX_BYTES } from './tool-turn.mjs';
// @ts-expect-error The physical host remains JavaScript.
import { createResourceOwner } from '../../scripts/resource-owner.mjs';

const key = new Uint8Array(32).fill(7);
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const dir = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-turn-'))); roots.push(root); return root; };
/** A stand-in for the scratch volume where the test root sits on the RAM disk (a disk image cannot be mounted from it):
 * a plain directory. The real volume is exercised by the boundary test below, on ordinary storage. */
const plainScratch = (turn: string) => { mkdirSync(join(turn, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(turn, 'vol')); };
const keepDetached = () => true;
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
  const turn = prepareToolTurn({ root, operation: 'telegram:1:update:2', attempt: 0, operations: SINGLE_MACHINE_PROFILE.operations, scratch: plainScratch });
  expect(readdirSync(turn.workspace)).toEqual([]);
  for (const path of [turn.workspace, turn.stateDirectory, join(turn.scratch, 'tmp')]) expect(lstatSync(path).mode & 0o777).toBe(0o700);
  expect(turn.workspace).toBe(join(turn.scratch, 'ws'));
  expect(turn.scratch.startsWith(join(root, 'tool-turns'))).toBe(true);
  expect(turn.stateDirectory.startsWith(turn.scratch)).toBe(false);
  expect(JSON.parse(readFileSync(join(turn.stateDirectory, 'config.json'), 'utf8'))).toEqual({ workspace: turn.workspace,
    tmp: join(turn.scratch, 'tmp'), maxCalls: SUBSCRIPTION_TOOL_LIMITS.maxToolCalls, maxWriteBytes: SUBSCRIPTION_TOOL_LIMITS.maxWriteBytes,
    operations: [...SINGLE_MACHINE_PROFILE.operations], children: { max: 0, type: SUBSCRIPTION_SUBAGENT_TYPE }, mcpReads: [] });
  expect(turn.mcp).toBeUndefined();
  expect(turn.hook).toEqual({ node: process.execPath, script: TOOL_HOOK_SCRIPT });
  // The same attempt is never reused: a repeat allocation refuses rather than sharing a workspace.
  expect(() => prepareToolTurn({ root, operation: 'telegram:1:update:2', attempt: 0, operations: [], scratch: plainScratch })).toThrow();
  writeFileSync(join(turn.workspace, 'note.txt'), 'hello reuse');
  expect(workspaceBytes(turn.workspace)).toBe(11);
  expect(readToolTrace(turn.stateDirectory)).toMatchObject({ calls: [], consistent: true });
  for (let i = 1; i <= 4; i++) {
    const t = prepareToolTurn({ root, operation: `telegram:1:update:${String(i + 2)}`, attempt: i, operations: [], scratch: plainScratch });
    utimesSync(t.directory, i * 1000, i * 1000);
  }
  utimesSync(turn.directory, 0, 0);
  // A turn whose volume will not unmount is kept (and counted failed), never removed from under the mount.
  expect(pruneToolTurns(root, 3, (dir: string) => dir !== turn.directory)).toEqual({ removed: 1, failed: 1 });
  expect(existsSync(turn.workspace)).toBe(true);
  expect(pruneToolTurns(root, 2, keepDetached)).toEqual({ removed: 2, failed: 0 });
  expect(existsSync(turn.workspace)).toBe(false);
  expect(readdirSync(join(root, 'tool-turns'))).toHaveLength(2);
});

const hdiutil = existsSync('/usr/bin/hdiutil');
it.runIf(hdiutil)('bounds a workspace\'s whole storage: its volume refuses writes past its size, keeps its files across mounts, and goes when detached', { timeout: 120000 }, () => {
  // Ordinary storage, not the RAM disk: the sparse image is the turn's real allocation, as under a live root.
  const root = realpathSync(mkdtempSync('/private/tmp/tool-scratch-')); roots.push(root);
  const turn = join(root, 'turn'); mkdirSync(turn, { mode: 0o700 });
  const volume = attachScratch(turn, 'itw-0123456789ab', 8 * 1048576);
  try {
    expect(scratchMounted(turn)).toBe(true);
    expect(volume).toBe(realpathSync(join(turn, 'vol')));
    // Many files, each far under the per-file limit, as a shell loop would write them: past the volume's size every
    // further write fails, and the disk the root sits on gains nothing beyond the image.
    const written = spawnSync('/bin/sh', ['-c', 'ulimit -f 65536; i=0; while [ $i -lt 12 ]; do /bin/dd if=/dev/zero of=f$i bs=1048576 count=1 2>/dev/null '
      + '&& echo ok || echo full; i=$((i+1)); done'], { cwd: volume, encoding: 'utf8' }).stdout.trim().split('\n');
    expect(written.slice(0, 4)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(written).toContain('full');
    expect(written.slice(written.indexOf('full'))).toEqual(written.slice(written.indexOf('full')).map(() => 'full'));
    expect(lstatSync(join(turn, 'scratch.sparseimage')).size).toBeLessThanOrEqual(9 * 1048576);
    // The positive neighbour: a write inside the allowance succeeded and is readable.
    expect(readFileSync(join(volume, 'f0')).byteLength).toBe(1048576);
    // Persistence: unmounted between turns, the image keeps the files; the next mount at the same fixed name finds them.
    expect(unmountScratch(turn)).toBe(true);
    expect(scratchMounted(turn)).toBe(false);
    expect(existsSync(join(turn, 'scratch.sparseimage'))).toBe(true);
    expect(attachScratch(turn, 'itw-0123456789ab', 8 * 1048576)).toBe(volume);
    expect(readFileSync(join(volume, 'f0')).byteLength).toBe(1048576);
    // A volume a crash left mounted is unmounted and mounted again by the next attach, files intact.
    expect(attachScratch(turn, 'itw-0123456789ab', 8 * 1048576)).toBe(volume);
    expect(readFileSync(join(volume, 'f0')).byteLength).toBe(1048576);
    expect(() => attachScratch(turn, '../escape')).toThrow(/mount name/u);
  } finally { expect(detachScratch(turn)).toBe(true); }
  expect(scratchMounted(turn)).toBe(false);
  expect(existsSync(join(turn, 'scratch.sparseimage'))).toBe(false);
  // A volume left mounted by an interrupted turn is unmounted by prune before its directory is removed.
  const base = join(root, 'tool-turns'), stale = join(base, 'stale-0'); mkdirSync(stale, { recursive: true });
  attachScratch(stale, undefined, 8 * 1048576);
  expect(scratchMounted(stale)).toBe(true);
  expect(pruneToolTurns(root, 0)).toEqual({ removed: 1, failed: 0 });
  expect(existsSync(stale)).toBe(false);
});

it('runs tools only for answer turns and scheduled work, never for reviews, summaries or benchmark reruns', () => {
  for (const id of ['telegram:8820318295:update:120', 'obligation:commitment:3:1790000000000']) expect(toolTurnEligible(id)).toBe(true);
  for (const id of ['telegram:1:update:2:reply-review', 'telegram:1:update:2:revision-review', 'summary:12', 'summary:12:review',
    'retrospective:3', 'retrospective:3:rerun:0', 'index:1']) expect(toolTurnEligible(id)).toBe(false);
});

it('tells the agent and the operator exactly which tools exist and where outward effects go, and says why tools are off', () => {
  const read = () => JSON.stringify({ generation: 'g', commit: 'c', launchers: { 'tests/preview/journal-agent.mjs': [] } });
  const withTools = capabilityBriefing(read, { providerAttempts: 50, expiresAt: 1, tools: true }).text;
  expect(withTools).toContain(TOOLS_BRIEFING);
  for (const name of SUBSCRIPTION_TOOL_NAMES) expect(TOOLS_BRIEFING).toContain(name);
  expect(TOOLS_BRIEFING).toMatch(/root MCP; outward effects via the doorway/u);
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
    'Tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Agent and the root\'s MCP servers, in this conversation\'s private '
      + 'workspace (kept between turns, 128 MB); shell sandboxed without network; web reads only; consequential effects go through the effect doorway.',
    'Tool turns: 2 run (14 model attempts reserved for them), 5 tool calls admitted, 2 refused, 1 turns answered without tools because the call allowance was short.']);
  expect(toolStatusLines({ toolTurns: { ...view.toolTurns, open: ['x#3'] } }, true)[1]).toContain('1 without a recorded trace yet');
  expect(toolStatusLines({ toolTurns: { ...view.toolTurns, children: { started: 3, returned: 1, cancelled: 1, unknown: 1 } } }, true)[1])
    .toContain('3 subagents started (1 returned, 1 cancelled, 1 unknown)');
  // The kept session's line appears once a turn kept one, and names why each new session started.
  expect(toolStatusLines({ toolTurns: { ...view.toolTurns, sessions: { resumed: 4, fresh: 3, changed: 1, lost: 1, bounded: 0, ended: 1 } } }, true)[2])
    .toBe('Kept session: 4 turns resumed it, 3 started a new one (1 after the journal changed a fact or the authority changed, 1 after a loss or '
      + 'an interrupted turn, 0 at its size or turn bound); 1 ended at a stop, withdrawal or failed turn.');
  expect(toolStatusLines({ toolTurns: { ...view.toolTurns, overflow: 2 } }, true)[2])
    .toBe('Workspaces: this root keeps 4; 2 turns of further conversations ran in a fresh one-turn workspace without a kept session.');
  expect(toolStatusLines(view, true)).toHaveLength(2);
  expect(toolStatusLines(view, false)).toEqual([]);
  // Default on: when no grant resolves, status says tools are off and why, instead of saying nothing.
  expect(toolStatusLines(view, false, 'refused at launch with --tools off')).toEqual(['Tools: off (refused at launch with --tools off); answers are text only.']);
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
    now: () => 10, redactText: (text: string) => text.replace('SECRET', '[redacted]'), fallback: async () => ({ result: 'text-only' }), invoke,
    scratch: plainScratch, detach: keepDetached });
  // Short allowance: refused, recorded, answered without tools, nothing reserved or launched.
  let root = dir(), journal = journalAt(root, extra - 1), launched = 0;
  // The packet's route predicate agrees with the turn's own reservation on both sides of the cap.
  expect(toolTurnFits(journal.view)).toBe(false); expect(toolTurnFits(journalAt(dir(), extra).view)).toBe(true);
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
  // The room includes the bounded workspace notice the turn may carry (Rules 33, 84): one byte past it falls back, at it runs.
  const room = 32768 - Buffer.byteLength(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) - TOOL_NOTICE_MAX_BYTES;
  const big = { ...base(journal, root, async () => 'x'), prepared: 'x'.repeat(room + 1) };
  expect(await runToolTurn(big)).toEqual({ result: 'text-only' });
  expect(journal.view.toolTurns?.refusedPrompt).toBe(1);
  root = dir(); journal = journalAt(root, 50);
  expect((await runToolTurn({ ...base(journal, root, async () => 'fits'), prepared: 'x'.repeat(room) })).result).toBe('fits');
  expect(journal.view.toolTurns?.refusedPrompt ?? 0).toBe(0);
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
  // A 50-call allowance holds the turn and both subagents' whole budgets, so all of it is reserved.
  expect(journal.view.calls).toBe(extra + SUBSCRIPTION_TOOL_LIMITS.maxChildren * SUBSCRIPTION_TOOL_LIMITS.childMaxTurns);
});

it('reserves each subagent\'s whole budget with the turn, as far as the allowance holds it, and records every edge and how it ended', async () => {
  const extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1, each = SUBSCRIPTION_TOOL_LIMITS.childMaxTurns, id = 'telegram:12345678:update:11';
  // Both sides of each budget share: a child is reserved only beyond this turn and one further plain tool turn (2 * extra + 1).
  const kept = 2 * extra + 1;
  expect([toolChildrenFit(journalAt(dir(), kept + each - 1).view), toolChildrenFit(journalAt(dir(), kept + each).view),
    toolChildrenFit(journalAt(dir(), kept + 2 * each - 1).view), toolChildrenFit(journalAt(dir(), kept + 2 * each).view),
    toolChildrenFit(journalAt(dir(), 1000).view)]).toEqual([0, 1, 1, 2, SUBSCRIPTION_TOOL_LIMITS.maxChildren]);
  const turnWith = async (maxCalls: number, rows: string[], stopped: boolean) => {
    const root = dir(), journal = journalAt(root, maxCalls), appended: Record<string, unknown>[] = [];
    const spied = { get view() { return journal.view; }, append: (row: never) => { appended.push(row); return journal.append(row); } } as unknown as typeof journal;
    let config: Record<string, unknown> = {};
    await runToolTurn({ journal: spied, root, id, prepared: '{}', promptLimit: 32768, deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations,
      now: () => 10, redactText: (text: string) => text, fallback: async () => ({ result: 'text-only' }), scratch: plainScratch, detach: keepDetached,
      authority: 'activation-ref sha256:tools', stopped: () => stopped,
      invoke: async (turn: { stateDirectory: string }) => {
        config = JSON.parse(readFileSync(join(turn.stateDirectory, 'config.json'), 'utf8'));
        writeFileSync(join(turn.stateDirectory, 'admission.jsonl'), rows.join('\n')); return 'answer'; } }).catch(() => null);
    return { journal, appended, config };
  };
  const agent = (tid: string, child: number) => JSON.stringify({ phase: 'pre', id: tid, n: child, tool: 'Agent', input: '{}', decision: 'allow', reason: 'r', kind: 'subagent', child });
  const start = (agentId: string) => JSON.stringify({ phase: 'child-start', agent: agentId, type: 'worker' });
  // One child returned, one cut off by the operator's stop.
  const stoppedTurn = await turnWith(1000, [agent('t1', 1), start('a1'), JSON.stringify({ phase: 'post', id: 't1', tool: 'Agent', result: '"42"', agent: 'a1' }),
    agent('t2', 2), start('a2')], true);
  expect(stoppedTurn.config.children).toEqual({ max: 2, type: SUBSCRIPTION_SUBAGENT_TYPE });
  expect(stoppedTurn.appended[0]).toMatchObject({ phase: 'reserved', calls: extra + 2 * each,
    delegation: { children: 2, turnsEach: each, type: SUBSCRIPTION_SUBAGENT_TYPE, authority: 'activation-ref sha256:tools' } });
  const edges = (stoppedTurn.appended[1] as { edges: Record<string, unknown>[] }).edges;
  expect(edges.map(edge => [edge.child, edge.agent, edge.state])).toEqual([['t1', 'a1', 'returned'], ['t2', 'a2', 'cancelled']]);
  expect(edges[0]).toMatchObject({ parent: `${id}#0`, authority: 'activation-ref sha256:tools', budget: { modelTurns: each },
    exitTest: expect.any(String), placement: expect.any(String), transport: 'claude-code Agent tool', resultDestination: expect.any(String),
    cancellation: expect.any(String), result: '"42"' });
  expect(stoppedTurn.journal.view.toolTurns?.children).toEqual({ started: 2, returned: 1, cancelled: 1, unknown: 0 });
  // Without a stop, a child with no result is unknown, never cancelled or returned.
  const crashed = await turnWith(1000, [agent('t1', 1), start('a1')], false);
  expect((crashed.appended[1] as { edges: { state: string }[] }).edges.map(edge => edge.state)).toEqual(['unknown']);
  // A short allowance reserves no child: the hook is told zero, so Agent refuses for budget.
  const short = await turnWith(extra, [], false);
  expect(short.config.children).toEqual({ max: 0, type: SUBSCRIPTION_SUBAGENT_TYPE });
  expect(short.appended[0]).toMatchObject({ calls: extra, delegation: { children: 0 } });
  // The journal refuses an edge for another turn and a delegation the reservation does not cover.
  const j = journalAt(dir(), 1000);
  expect(() => j.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: 7, at: 1,
    delegation: { children: 2, turnsEach: 4, type: 'worker', authority: 'a' } } as never)).toThrow(/delegation/u);
  j.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: 15, at: 1, delegation: { children: 2, turnsEach: 4, type: 'worker', authority: 'a' } } as never);
  expect(() => j.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, consistent: true, workspaceBytes: 0, calls: [], at: 2,
    edges: [{ child: 't', agent: null, parent: 'other#0', state: 'returned' }] } as never)).toThrow(/edges/u);
});

it('reads the root\'s MCP configuration: absent is none, malformed refuses, and its servers and credentials stay in the admission state', () => {
  const root = dir();
  expect(readRootMcp(root)).toBeNull();
  for (const bad of ['{', '{"mcpServers":[]}', '{"mcpServers":{"a b":{"command":"/x"}}}', '{"mcpServers":{"a":{}}}',
    '{"mcpServers":{"a":{"command":"/x"}},"reads":["mcp__b__t"]}']) {
    writeFileSync(join(root, 'mcp.json'), bad);
    expect(() => readRootMcp(root)).toThrow();
  }
  writeFileSync(join(root, 'mcp.json'), '{"mcpServers":{}}');
  expect(readRootMcp(root)).toBeNull();
  const config = { mcpServers: { dummy: { command: '/usr/bin/true', env: { TOKEN: 'DUMMY-NOT-A-SECRET' } } }, reads: ['mcp__dummy__lookup'] };
  writeFileSync(join(root, 'mcp.json'), JSON.stringify(config));
  const mcp = readRootMcp(root);
  expect(mcp).toMatchObject({ servers: config.mcpServers, reads: config.reads, digest: expect.stringMatching(/^sha256:/u) });
  const turn = prepareToolTurn({ root, operation: 'telegram:1:update:9', attempt: 0, operations: [], mcp, scratch: plainScratch });
  expect(turn.mcp).toEqual({ config: join(turn.stateDirectory, 'mcp.json'), servers: ['dummy'] });
  expect(lstatSync(turn.mcp.config).mode & 0o777).toBe(0o600);
  expect(JSON.parse(readFileSync(turn.mcp.config, 'utf8'))).toEqual({ mcpServers: config.mcpServers });
  expect(JSON.parse(readFileSync(join(turn.stateDirectory, 'config.json'), 'utf8')).mcpReads).toEqual(['mcp__dummy__lookup']);
  // The credential never lands where a tool can reach: not in the workspace or the scratch volume.
  expect(JSON.stringify(readdirSync(turn.scratch, { recursive: true }))).not.toContain('mcp');
});
