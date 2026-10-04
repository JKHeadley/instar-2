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
import { nestedSessionWorkEdge, type SessionWorkEdge } from '../../src/assembly/production-session-work.js';
import { capabilityBriefing, TOOLS_BRIEFING, TOOLS_LIMITS, toolsBriefing } from './briefing.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { TOOL_HOOK_SCRIPT, TOOL_NOTICE_MAX_BYTES, attachEgress, attachScratch, detachScratch, networkToolReads, openToolTurnSlugs, prepareToolTurn, pruneToolTurns, readRootMcp, readToolTrace, reconcileToolTurns, runToolTurn, scratchMounted, toolChildrenFit, toolStatusLines, toolTurnEligible, toolTurnFits, unmountScratch, workspaceBytes } from './tool-turn.mjs';
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
    operations: [...SINGLE_MACHINE_PROFILE.operations], children: { max: 0, type: SUBSCRIPTION_SUBAGENT_TYPE }, mcpReads: [], authority: 'unrecorded' });
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
  // The tools item joins the can-do list and the real limits follow it (w4-selfdesc, live K11a 2026-10-04).
  expect(withTools).toContain(`What you can do for the operator here:\n- ${TOOLS_BRIEFING}`);
  expect(withTools).toContain(TOOLS_LIMITS);
  // It describes the capability, never a hand-picked list: the whole set is offered and each call is decided at the hook.
  expect(TOOLS_BRIEFING).toMatch(/^tools: full Claude Code set \(files, shell, web reads, nested subagents\); MCP servers: unknown;/u);
  for (const name of SUBSCRIPTION_TOOL_NAMES) expect(TOOLS_BRIEFING).not.toContain(name);
  // Outward writes and sends are an ability behind the doorway and the operator's grant, never a blanket denial.
  expect(TOOLS_BRIEFING).toContain('network writes and outside sends via the doorway\'s four tests on operator grant');
  expect(withTools).not.toMatch(/no account writes|standing block|no vault/u);
  expect(TOOLS_LIMITS).toMatch(/^Limits: a sent credential is vaulted on arrival \(you see its SecretRef\), not tool-readable\.$/u);
  // The MCP wording says what the root configures now: both sides of the count, and a configured server is never claimed
  // as logged-in account access (review round 1, finding 4; selfdesc-abilities covers the unknown count too).
  expect(toolsBriefing(0)).toContain('no MCP server, so no logged-in account access');
  expect(toolsBriefing(2)).toContain('2 MCP server(s) (accounts only via their tools)');
  expect(capabilityBriefing(read, { providerAttempts: 50, expiresAt: 1, tools: true, mcp: 0 }).text).toContain(`- ${toolsBriefing(0)}`);
  // The attempt cap and the expiry stay in the note: the note is what the self-description is held to.
  expect(withTools).toContain('at most 50 model attempts, ending at epoch ms 1.');
  expect(withTools).not.toContain('no tools, browsing, running code');
  const without = capabilityBriefing(read, { providerAttempts: 50, expiresAt: 1 }).text;
  expect(without).toContain('Nothing unlisted is available: no tools, browsing, running code');
  expect(without).not.toContain(TOOLS_BRIEFING); expect(without).not.toContain(TOOLS_LIMITS);
  const fallback = capabilityBriefing(() => { throw Error('absent'); }, { providerAttempts: 1, expiresAt: 1, tools: true }).text;
  expect(fallback).toContain(`You have ${TOOLS_BRIEFING} ${TOOLS_LIMITS}`); expect(fallback).not.toContain('You have no tools');
  const view = { toolTurns: { invocations: 2, reservedCalls: 14, refusedCap: 1, toolCalls: 5, toolRefusals: 2, inconsistent: 0, open: [] } };
  expect(toolStatusLines(view, true)).toEqual([
    `Tools: the harness's full built-in set (${SUBSCRIPTION_TOOL_NAMES.length} tools, each call decided at the admission hook) and the root's `
      + 'MCP servers, in this conversation\'s private workspace (kept between turns, 128 MB); shell sandboxed, its network through the '
      + 'turn\'s checkpoint (reads of public hosts admitted, writes sent to the effect doorway); web reads only; '
      + 'subagents may delegate within the turn\'s budget; consequential effects go through the effect doorway.',
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
  expect(toolStatusLines({ toolTurns: { ...view.toolTurns, network: { admitted: 4, refused: 2 } } }, true)[1])
    .toContain('4 shell network reads admitted and 2 refused at the checkpoint');
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
  const agent = (tid: string, child: number, by?: string) => JSON.stringify({ phase: 'pre', id: tid, n: child, tool: 'Agent', input: '{}',
    decision: 'allow', reason: 'r', kind: 'subagent', child, ...(by ? { agent: by } : {}) });
  const start = (agentId: string) => JSON.stringify({ phase: 'child-start', agent: agentId, type: 'worker' });
  // One child returned; the one it started in turn (Rule 114: a subagent delegates within the same reservation) was cut off
  // by the operator's stop.
  const stoppedTurn = await turnWith(1000, [agent('t1', 1), start('a1'), agent('t2', 2, 'a1'), start('a2'),
    JSON.stringify({ phase: 'post', id: 't1', tool: 'Agent', result: '"42"', agent: 'a1' })], true);
  expect(stoppedTurn.config.children).toEqual({ max: 2, type: SUBSCRIPTION_SUBAGENT_TYPE });
  expect(stoppedTurn.appended[0]).toMatchObject({ phase: 'reserved', calls: extra + 2 * each,
    delegation: { children: 2, turnsEach: each, type: SUBSCRIPTION_SUBAGENT_TYPE, authority: 'activation-ref sha256:tools' } });
  const edges = (stoppedTurn.appended[1] as { edges: Record<string, unknown>[] }).edges;
  expect(edges.map(edge => [edge.child, edge.agent, edge.state])).toEqual([['t1', 'a1', 'returned'], ['t2', 'a2', 'cancelled']]);
  expect(edges[0]).toMatchObject({ parent: `${id}#0`, authority: 'activation-ref sha256:tools', budget: { modelTurns: each },
    exitTest: expect.any(String), placement: expect.any(String), transport: 'claude-code Agent tool', resultDestination: expect.any(String),
    cancellation: expect.any(String), result: '"42"', parentAgent: null });
  expect(edges[1]).toMatchObject({ parent: `${id}#0`, parentAgent: 'a1', resultDestination: 'the tool result of subagent a1', state: 'cancelled' });
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
  expect(() => j.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, consistent: true, workspaceBytes: 0, calls: [], at: 2,
    edges: [{ child: 't', agent: null, parent: `${id}#0`, parentAgent: 7, state: 'returned' }] } as never)).toThrow(/edges/u);
  j.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, consistent: true, workspaceBytes: 0, calls: [], at: 2,
    edges: [{ child: 't', agent: 'a2', parent: `${id}#0`, parentAgent: 'a1', state: 'returned' }] } as never);
  expect(j.view.toolTurns?.children).toEqual({ started: 1, returned: 1, cancelled: 0, unknown: 0 });
});

it('keeps an interrupted turn\'s hook record past retention and journals its child edges as unknown at the next launch (Rule 114)', async () => {
  const root = dir(), id = 'telegram:12345678:update:21', authority = 'activation-ref sha256:tools';
  const journal = journalAt(root, 1000);
  // A crash after the hook synced an admitted Agent call and its child start, before the trace was journaled: the
  // reservation is durable and open, the turn directory holds the only record of the child.
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: 15, at: 1,
    delegation: { children: 2, turnsEach: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns, type: SUBSCRIPTION_SUBAGENT_TYPE, authority } } as never);
  const crashed = prepareToolTurn({ root, operation: id, attempt: 0, operations: SINGLE_MACHINE_PROFILE.operations, children: 2,
    scratch: plainScratch, authority });
  writeFileSync(join(crashed.stateDirectory, 'admission.jsonl'), [
    JSON.stringify({ phase: 'pre', id: 't1', n: 1, tool: 'Agent', input: '{}', decision: 'allow', reason: 'r', kind: 'subagent', child: 1 }),
    JSON.stringify({ phase: 'child-start', agent: 'a1', type: SUBSCRIPTION_SUBAGENT_TYPE })].join('\n') + '\n');
  utimesSync(crashed.directory, 1, 1);
  // Sixteen newer finished turns: retention would remove the oldest, but never the one the journal still holds open.
  const base = join(root, 'tool-turns');
  for (let n = 0; n < 16; n++) mkdirSync(join(base, `newer-${String(n)}`));
  const reopened = journalAt(root, 1000);
  expect(pruneToolTurns(root, 16, keepDetached, openToolTurnSlugs(reopened.view))).toEqual({ removed: 0, failed: 0 });
  expect(existsSync(join(crashed.stateDirectory, 'admission.jsonl'))).toBe(true);
  // The next launch journals it: the admitted call, the child edge under its recorded authority, outcome unknown (never re-run).
  expect(reconcileToolTurns({ journal: reopened, root, redactText: (text: string) => text, now: () => 50 })).toEqual([`${id}#0`]);
  expect(reopened.view.toolTurns).toMatchObject({ open: [], toolCalls: 1, children: { started: 1, returned: 0, cancelled: 0, unknown: 1 } });
  const replayed = journalAt(root, 1000);
  expect(replayed.view.toolTurns).toEqual(reopened.view.toolTurns);
  // Journaled, it is ordinary history again, and retention may remove it.
  expect(pruneToolTurns(root, 16, keepDetached, openToolTurnSlugs(replayed.view))).toEqual({ removed: 1, failed: 0 });
  expect(existsSync(crashed.directory)).toBe(false);
  // A reconcile is idempotent, and an open turn whose directory did not survive stays open (its outcome unknown).
  expect(reconcileToolTurns({ journal: replayed, root, redactText: (text: string) => text, now: () => 60 })).toEqual([]);
  replayed.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 1, calls: 7, at: 61 });
  expect(reconcileToolTurns({ journal: replayed, root, redactText: (text: string) => text, now: () => 62 })).toEqual([]);
  expect(replayed.view.toolTurns?.open).toEqual([`${id}#1`]);
  // The normal-completion neighbour: a finished turn journals its own trace and closes nothing else.
  const fresh = dir(), done = journalAt(fresh, 1000);
  await runToolTurn({ journal: done, root: fresh, id, prepared: '{}', promptLimit: 32768, deniedRoots: [fresh], operations: SINGLE_MACHINE_PROFILE.operations,
    now: () => 10, redactText: (text: string) => text, fallback: async () => ({ result: 'text-only' }), scratch: plainScratch, detach: keepDetached,
    authority, invoke: async () => 'answer' });
  expect(done.view.toolTurns?.open).toEqual([]);
  expect(reconcileToolTurns({ journal: done, root: fresh, redactText: (text: string) => text, now: () => 11 })).toEqual([]);
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

it('runs the shell\'s network checkpoint exactly as long as the turn: started before launch, named to the hook and the sandbox, recorded, stopped after', async () => {
  const root = dir(), id = 'telegram:12345678:update:21';
  const journal = journalAt(root, 60);
  const appended: Record<string, unknown>[] = [];
  const spied = { get view() { return journal.view; }, append: (row: never) => { appended.push(row); return journal.append(row); } };
  const events: string[] = [];
  let started: { stateDirectory: string; caPath: string; admission: { operations: string[] } } | null = null;
  const egress = async (input: { stateDirectory: string; caPath: string; admission: { operations: string[] } }) => {
    started = input; events.push('start'); writeFileSync(input.caPath, 'CERT');
    // What the real checkpoint appends for a refused write and an admitted read.
    writeFileSync(join(input.stateDirectory, 'egress.jsonl'), [
      { phase: 'request', n: 1, method: 'CONNECT', scheme: 'https', host: 'example.com', port: 443, path: 'example.com:443', decision: 'allow', reason: 'tunnel opened; each request inside it is decided', kind: 'tunnel', address: '93.184.215.14' },
      { phase: 'request', n: 2, method: 'GET', scheme: 'https', host: 'example.com', port: 443, path: '/?token=SECRETVALUE', decision: 'allow', reason: 'GET read', kind: 'network-read', address: '93.184.215.14' },
      { phase: 'response', n: 2, status: 200, bytes: 577 },
      { phase: 'request', n: 3, method: 'POST', scheme: 'https', host: 'httpbin.org', port: 443, path: '/post', decision: 'deny', reason: 'POST is a network write: effect doorway: refused by default', kind: 'network-write' },
    ].map(row => JSON.stringify(row)).join('\n') + '\n');
    return { port: 40001, close: async () => { events.push('close'); } };
  };
  const tools = () => ({ reads: ['/usr/local/bin'], path: '/usr/local/bin', developer: undefined });
  let seen: Record<string, unknown> | null = null;
  const base = { journal: spied, root, prepared: '{}', promptLimit: 32768, deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations,
    now: () => 10, redactText: (text: string) => text.replace('SECRETVALUE', '[redacted]'), fallback: async () => ({ result: 'text-only' }),
    scratch: plainScratch, detach: keepDetached, egress, networkTools: tools };
  await runToolTurn({ ...base, id, invoke: async (turn: Record<string, unknown>) => {
    seen = turn; events.push('invoke');
    const config = JSON.parse(readFileSync(join(turn.stateDirectory as string, 'config.json'), 'utf8'));
    expect(config.egress).toEqual({ port: 40001, ca: join(turn.scratch as string, 'egress-ca.pem'), home: join(turn.scratch as string, 'home'), path: '/usr/local/bin' });
    return { result: 'ok' };
  } });
  expect(events).toEqual(['start', 'invoke', 'close']);
  expect(started!.admission).toEqual({ operations: [...SINGLE_MACHINE_PROFILE.operations] });
  expect(started!.stateDirectory).toBe((seen as unknown as { stateDirectory: string }).stateDirectory);
  expect((seen as unknown as { egress: unknown }).egress).toEqual({ port: 40001, reads: ['/usr/local/bin'] });
  const trace = appended.find(row => row.phase === 'trace')!;
  expect(trace.egressRequests).toBe(3);
  expect(trace.egress).toEqual([expect.objectContaining({ kind: 'tunnel' }),
    expect.objectContaining({ method: 'GET', path: '/?token=[redacted]', decision: 'allow', status: 200, bytes: 577 }),
    expect.objectContaining({ method: 'POST', decision: 'deny', kind: 'network-write', status: null })]);
  expect(journal.view.toolTurns?.network).toEqual({ admitted: 1, refused: 1 });
  // A failed launch still stops the checkpoint and journals its trace.
  events.length = 0;
  await expect(runToolTurn({ ...base, id: 'telegram:12345678:update:22', invoke: async () => { events.push('invoke'); throw Error('launch failed'); } }))
    .rejects.toThrow('launch failed');
  expect(events).toEqual(['start', 'invoke', 'close']);
  expect(journal.view.toolTurns?.open).toEqual([]);
  expect(journal.view.toolTurns?.network).toEqual({ admitted: 2, refused: 2 });
  // A checkpoint that does not start fails the turn before launch (no shell without its checkpoint), still journaled.
  let launched = false;
  await expect(runToolTurn({ ...base, id: 'telegram:12345678:update:23', egress: async () => { throw Error('no loopback port'); },
    invoke: async () => { launched = true; return { result: 'ok' }; } })).rejects.toThrow('no loopback port');
  expect(launched).toBe(false);
  expect(journal.view.toolTurns?.open).toEqual([]);
  // The journal refuses a malformed checkpoint record.
  journal.append({ kind: 'tool-turn', phase: 'reserved', id: 'telegram:12345678:update:24', attempt: 9, calls: 1, at: 11 });
  expect(() => journal.append({ kind: 'tool-turn', phase: 'trace', id: 'telegram:12345678:update:24', attempt: 9, consistent: true, workspaceBytes: 0, calls: [],
    egress: [{ n: 1, method: 'GET', path: '/', decision: 'maybe', reason: 'r' }], at: 12 } as never)).toThrow(/tool turn egress/u);
  // Replay reaches the same projection.
  expect(journalAt(root, 60).view.toolTurns?.network).toEqual({ admitted: 2, refused: 2 });
});

it('names the shell\'s network tools read-only, never under a home or mounted volume, and closes the checkpoint if its config cannot be written', async () => {
  expect(networkToolReads('/usr/local/bin/node', () => true, (p: string) => p)).toEqual({ reads: ['/usr/local/bin', '/usr/local/lib/node_modules/npm',
    '/Library/Developer/CommandLineTools'], path: '/usr/local/bin', developer: '/Library/Developer/CommandLineTools' });
  expect(networkToolReads('/Users/me/.nvm/versions/node/v24/bin/node', (p: string) => !p.startsWith('/Library'), (p: string) => p))
    .toEqual({ reads: [], path: undefined, developer: undefined });
  let closed = false;
  let starts = 0;
  const start = async () => { starts++; return { port: 1, close: async () => { closed = true; } }; };
  // No admission config: nothing to decide with, so no checkpoint starts.
  await expect(attachEgress({ scratch: dir(), stateDirectory: join(dir(), 'missing'), home: '/h' }, start, { reads: [] })).rejects.toThrow();
  expect(starts).toBe(0);
  // The config is read (the checkpoint decides with it) but cannot be rewritten: the started checkpoint is closed again.
  const state = dir();
  writeFileSync(join(state, 'config.json'), JSON.stringify({ operations: [] }), { mode: 0o400 });
  await expect(attachEgress({ scratch: dir(), stateDirectory: state, home: '/h' }, start, { reads: [] })).rejects.toThrow();
  expect(starts).toBe(1);
  expect(closed).toBe(true);
});

it('a Codex tool turn runs only through the admission checkpoint: no checkpoint refuses, a lost subagent or a refused call refuses the answer', async () => {
  const id = 'telegram:12345678:update:11';
  const admission = { maxCalls: 8, harness: 'codex', confinedShell: true };
  const opened: { claim: string; framework: string; allowance: number; edge: { id: string } }[] = [];
  let state = { calls: 0, refused: false, closed: false, openDelegations: [] as SessionWorkEdge[] };
  const gate = { base: (claim: string) => `http://127.0.0.1:4100/${'a'.repeat(32)}/${claim}`,
    open: (claim: string, input: { framework: string; allowance: number; edge: { id: string } }) => { opened.push({ claim, ...input }); },
    close: () => ({ ...state, closed: true }), settle: () => undefined };
  // The shell's network checkpoint, as a stand-in: its start and close are observed.
  const egressEvents: string[] = [];
  const egress = async (input: { caPath: string }) => { egressEvents.push('start'); writeFileSync(input.caPath, 'CERT');
    return { port: 40002, close: async () => { egressEvents.push('close'); } }; };
  const base = (journal: ReturnType<typeof journalAt>, root: string, invoke: (turn: { gate?: string; stateDirectory?: string; scratch?: string;
    egress?: unknown }) => Promise<unknown>, withGate = true) => ({
    journal, root, id, prepared: '{"q":1}', promptLimit: 32768, deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations, now: () => 10,
    redactText: (text: string) => text,
    fallback: async () => ({ result: 'text-only' }), invoke, scratch: plainScratch, detach: keepDetached, admission, egress,
    networkTools: () => ({ reads: ['/usr/local/bin'], path: '/usr/local/bin', developer: undefined }),
    ...(withGate ? { gate, owner: 'machine-a' } : {}) });
  // No checkpoint: the turn is refused before anything launches.
  let launched = 0;
  await expect(runToolTurn(base(journalAt(dir(), 50), dir(), async () => { launched++; }, false))).rejects.toThrow(/admission checkpoint/u);
  expect(launched).toBe(0);
  // With it: the claim opens with the turn's whole allowance and its own edge, and the harness is given its address.
  let given: string | undefined;
  const root = dir(), journal = journalAt(root, 50);
  let profile = '', config: Record<string, unknown> = {}, invokeEgress: unknown = 'unset';
  expect((await runToolTurn(base(journal, root, async turn => { given = turn.gate; invokeEgress = turn.egress;
    config = JSON.parse(readFileSync(join(turn.stateDirectory!, 'config.json'), 'utf8'));
    profile = readFileSync(config.shellProfile as string, 'utf8'); return 'answer'; }))).result).toBe('answer');
  expect(opened[0]).toMatchObject({ framework: 'codex-cli', allowance: SUBSCRIPTION_TOOL_LIMITS.maxTurns, edge: { id: `tool-turn:${id}:0` } });
  expect(given).toBe(gate.base(opened[0]!.claim));
  // cint-L45: a checkpointed turn reserves no separate subagent budget (its subagents spend the turn's allowance at the
  // checkpoint). Its confined shell reaches the network through the turn's checkpoint, started before launch and stopped
  // after: the hook points every command at it, and the shell's own profile allows that one loopback port and nothing else.
  expect(journal.view.calls).toBe(SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1);
  expect(egressEvents).toEqual(['start', 'close']);
  expect(config.egress).toMatchObject({ port: 40002, path: '/usr/local/bin' });
  expect(profile).toContain('(deny network*)\n(allow network-outbound (remote ip "localhost:40002"))\n');
  expect(profile).toContain('(subpath "/usr/local/bin")');
  expect(profile).toContain(`(allow file-write* (subpath "${config.workspace as string}") (subpath "${config.tmp as string}") (subpath "${(config.egress as { home: string }).home}")`);
  // Codex's own sandbox is not used for the shell (the hook confines it), so the harness is not handed the port.
  expect(invokeEgress).toBeUndefined();
  // A subagent that never returned: its edge settles as uncertain in the journal and the answer is refused.
  const parent = { type: 'SessionWorkEdge', schemaVersion: 1, id: `tool-turn:${id}:0`, parent: id, child: `tool-turn:${id}`, scope: '/ws',
    owner: 'machine-a', authority: 'a', budget: { steps: 1, deadline: 5, maxResultBytes: 8, calls: 8, tokens: null }, exitTest: 'x',
    placement: 'p', transport: 't', resultDestination: 'r', openedAt: 1 } as SessionWorkEdge;
  state = { ...state, openDelegations: [nestedSessionWorkEdge(parent, { id: 'call_lost', tool: 'collaborationspawn_agent' }, 2)] };
  const lostRoot = dir(), lost = journalAt(lostRoot, 50), rows: { kind: string; record?: { type: string; state?: string } }[] = [];
  const spied = { get view() { return lost.view; }, append: (row: never) => { rows.push(row); return lost.append(row); } } as unknown as typeof lost;
  await expect(runToolTurn(base(spied, lostRoot, async () => 'answer'))).rejects.toThrow(/delegated agent did not return/u);
  expect(rows.find(row => row.kind === 'session-work')?.record).toMatchObject({ type: 'SessionWorkEdgeClose', state: 'uncertain' });
  // A model call refused at the allowance: the answer is refused.
  state = { calls: 8, refused: true, closed: false, openDelegations: [] };
  await expect(runToolTurn(base(journalAt(dir(), 50), dir(), async () => 'answer'))).rejects.toThrow(/reserved allowance was refused/u);
});
