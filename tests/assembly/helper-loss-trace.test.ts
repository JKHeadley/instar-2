// Carryover row 16 (1.x HelperWatchdog / SubagentTracker; legacy-1x/): one lost helper traced end to end through the real
// pieces of the 2.0 path: the executable admission hook (the harness's SubagentStart/SubagentStop rows and its failure
// completion), the real host checkpoint (admission-gate.mjs), the Eight-owned session-work port, the encrypted journal as the
// durable store the live runner hands the port (journal.sessionWorkRecords is what journal-agent.mjs wires as recoveryEdges),
// and the presence sentinel's work observation. Physical stop → parent observation → durable parent result → the same
// result read back by a fresh port and a reopened journal after a restart. The child harness itself is substituted (no live
// Claude Code here); the hook inputs are the documented envelopes the pinned harness sends (tests/preview/working-activity-
// failure.test.ts replays the recorded 2026-10-16 failure completions through the same hook).
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createSessionWorkPort, nestedSessionWorkEdge, SESSION_WORK_EXIT_TEST } from '../../src/assembly/production-session-work.js';
import type { SessionWorkEdge, SessionWorkEdgeClose, SessionWorkIO } from '../../src/assembly/production-session-work.js';
import type { NativeHarnessDriverPort } from '../../src/assembly/harness.js';
import { openPreviewJournal } from '../preview/journal.js';
import { createLiveSentinels, WORK_SILENCE_MS, WORK_STALE_GRACE_MS } from '../preview/live-sentinels.js';
// @ts-expect-error The hook, its state and the checkpoint stay plain JavaScript: the harness runs them without a loader.
import { prepareSessionAdmission } from '../preview/session-admission.mjs';
// @ts-expect-error see above
import { createAdmissionGate, createToolEffectOwner } from '../preview/admission-gate.mjs';
// @ts-expect-error see above
import { admitToolCallEffect } from '../preview/tool-admission.mjs';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { value } from '../facts/fixtures.js';

const HOOK = join(__dirname, '../preview/tool-admission-hook.mjs');
const KEY = new Uint8Array(32).fill(16);
const START = Date.UTC(2026, 10, 4, 12);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:row16',
  configurationDigest: 'sha256:row16', expires: START + 30 * 86_400_000, maxCalls: 400, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const roots: string[] = [], gates: { stop(): Promise<void> }[] = [], journals: { close(): void }[] = [];
afterEach(async () => {
  for (const journal of journals.splice(0)) try { journal.close(); } catch { /* already closed */ }
  for (const gate of gates.splice(0)) await gate.stop();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const slugOf = (operation: string) => createHash('sha256').update(operation).digest('hex').slice(0, 32);
const digestOf = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
/** The real hook as the harness runs it: its own process, asking the checkpoint over loopback. */
const hook = (state: string, input: object, mode: 'pre' | 'post' | 'child-start' | 'child-stop') => new Promise<number | null>(resolve => {
  const child = spawn(process.execPath, [HOOK, mode, state], { stdio: ['pipe', 'ignore', 'ignore'] });
  child.on('exit', resolve); child.stdin.end(JSON.stringify(input));
});
const recordedWork = JSON.parse(readFileSync(new URL('../preview/fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8')) as { workOutput: string };

type Phase = 'launched' | 'output-observed';
/** One host: a journal (fresh or reopened), the real checkpoint, the port over a substituted child harness, and the sentinel. */
async function host(root: string, options: { fresh: boolean; script?: () => Phase; actions?: (() => Promise<void>)[]; answer?: string | null }) {
  const f = assemblyRuntimeFixture();
  const scope = join(root, 'scope'), base = join(root, 'admission'), path = join(root, 'journal.encrypted');
  mkdirSync(scope, { recursive: true, mode: 0o700 });
  const clock = { now: START };
  const journal = options.fresh ? openPreviewJournal(path, KEY, genesis) : openPreviewJournal(path, KEY); journals.push(journal);
  const append = (record: SessionWorkEdge | SessionWorkEdgeClose) => journal.append({ kind: 'session-work', record, at: clock.now });
  const gate = await createAdmissionGate({ append, stopped: () => false, now: () => clock.now,
    effects: createToolEffectOwner({ decide: (tool: string, input: unknown) => admitToolCallEffect(tool, input, { operations: [] }, clock.now),
      append, stopped: () => false, now: () => clock.now, prepared: () => false }) });
  gates.push(gate);
  const states = new Map<string, string>();
  const actions = [...(options.actions ?? [])];
  const io: SessionWorkIO = {
    readResult: (file, maxBytes) => { try { return readFileSync(file, 'utf8').slice(0, maxBytes + 1); } catch { return null; } },
    clearResult: file => rmSync(file, { force: true }),
    modelCalls: () => 0,
    // The substituted child acts between the parent's polls: each wait runs the next recorded hook action.
    wait: async ms => { clock.now += ms; const act = actions.shift(); if (act) await act(); },
    prepareAdmission: (claim, edge) => {
      gate.open(claim, { framework: 'claude-code', allowance: edge.budget.calls, edge });
      states.set(claim, prepareSessionAdmission({ base, claim, workspace: scope, mcpReads: [], maxCalls: edge.budget.calls, gate: gate.base(claim) }));
    },
    admissionState: claim => { const state = gate.state(claim);
      return state ? { refused: state.refused, refusalReason: state.refusalReason, uncertainEffects: state.uncertainEffects,
        toolPreparations: state.toolPreparations, openDelegations: state.openDelegations } : null; },
    closeAdmission: claim => { gate.close(claim); },
  };
  let launched = '';
  const driver: NativeHarnessDriverPort & { stop(): ReturnType<typeof f.success<readonly string[]>> } = {
    owner: 'part-eight',
    launch: input => { launched = `instar20-${slugOf(input.operation).slice(0, 24)}:7:8`; return f.success(launched); },
    deliver: input => f.success(`tmux-input:${input.operation}`),
    observe: input => {
      const phase = options.script?.() ?? 'launched';
      if (phase === 'output-observed' && options.answer) writeFileSync(join(scope, `work-${slugOf(input.operation)}.json`), options.answer);
      return f.success({ phase, evidence: `evidence:${phase}`, detail: phase === 'output-observed' ? 'idle prompt fallback; turn close not independently verified' : phase });
    },
    stop: () => f.success(['instar20-stopped']),
  };
  const config = { createDriver: () => driver, io, context: f.c, now: () => clock.now, stopped: () => false,
    resources: { admit: async () => ({ attach: async () => undefined, release: async () => true }) },
    append, recoveryEdges: () => journal.sessionWorkRecords(),
    parent: 'launch:conversation-16', owner: 'machine-a', placement: 'machine:machine-a', transport: 'tmux session on this machine',
    workingScope: scope, resultDirectory: scope, artifact: 'doorway:synthetic', incarnation: 'incarnation-1',
    deadlineMs: 60_000, pollMs: 500, maxResultBytes: 65_536, maxSteps: 2, maxCalls: 24 };
  const port = value(createSessionWorkPort(config));
  let activity: { subject: string; at: number; activity: 'indeterminate'; progress: string; wait: null }[] = [];
  const sentinels = createLiveSentinels(journal, { now: () => clock.now, stopped: () => false, startedAt: START, families: new Set(['presence']),
    workActivity: () => activity, reground: () => undefined, recoverContext: () => undefined, selfHeal: () => undefined, actOnPromise: () => undefined });
  const request = (operation: string) => ({ operation, question: 'Do the one due step.', context: '{"obligation":{"kind":"request"}}', authority: 'a test-only grant naming one bounded step' });
  return { journal, gate, port, sentinels, clock, scope, request, config, launched: () => launched,
    state: (claim: string) => states.get(claim)!, work: () => journal.view.sentinels?.work ?? {},
    seen: (subject: string) => { activity = [{ subject, at: clock.now, activity: 'indeterminate', progress: 'frame', wait: null }]; },
    rows: () => journal.sessionWorkRecords() };
}
const OPERATION = 'obligation-commitment-16-1';
const CLAIM = `session-work-${slugOf(OPERATION)}`;
const PARENT_EDGE = `session-work-edge:${OPERATION}:1`;
const closesOf = (rows: readonly (SessionWorkEdge | SessionWorkEdgeClose)[]) => rows.filter((row): row is SessionWorkEdgeClose => row.type === 'SessionWorkEdgeClose');

it('a lost helper: physical stop, the parent observed waiting then uncertain, a durable parent result that a restart reads back; a second result is refused', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'helper-trace-'))); roots.push(root);
  let h: Awaited<ReturnType<typeof host>>;
  const observed: Record<string, string>[] = [];
  h = await host(root, { fresh: true, actions: [
    // Poll 1: the parent delegates. The hook asks the checkpoint, which records the helper's edge in the journal before the
    // subagent starts; the harness's SubagentStart row follows in the hook's own record.
    async () => { expect(await hook(h.state(CLAIM), { tool_name: 'Agent', tool_input: { prompt: 'look into it' }, tool_use_id: 'toolu_h1' }, 'pre')).toBe(0);
      expect(await hook(h.state(CLAIM), { agent_id: 'agent-h1', agent_type: 'worker' }, 'child-start')).toBe(0);
      expect(Object.keys(h.journal.view.activeSessionWork ?? {}).sort()).toEqual([PARENT_EDGE, `${PARENT_EDGE}:delegated:toolu_h1`]); },
    // Poll 2: the parent is observed. It is waiting on a registered helper, so its silence is not a stall (1.x A2c).
    async () => { h.seen(CLAIM); h.sentinels.observeWork();
      expect(h.work()).toMatchObject({ [PARENT_EDGE]: { state: 'waiting' }, [`${PARENT_EDGE}:delegated:toolu_h1`]: { state: 'unknown' } }); },
    // Poll 3: the helper physically stops (SubagentStop) and its harness never posts a result: the edge stays open.
    async () => { expect(await hook(h.state(CLAIM), { agent_id: 'agent-h1', agent_type: 'worker' }, 'child-stop')).toBe(0);
      expect(h.gate.state(CLAIM).openDelegations).toHaveLength(1);
      expect(readFileSync(join(h.state(CLAIM), 'admission.jsonl'), 'utf8')).toContain('{"phase":"child-stop","agent":"agent-h1"'); },
  ] });
  // The parent waits for its helper until the step's deadline: the only ceiling, and the exact cause of the close.
  const outcome = await h.port.run(h.request(OPERATION));
  expect(outcome).toMatchObject({ state: 'uncertain', child: h.launched() });
  expect(outcome.detail).toBe('session work deadline exceeded; delegated agent delegated:toolu_h1 did not return before the step closed');
  // Durable order: parent edge, helper edge, the helper's uncertain close, then the parent's close naming the helper.
  const rows = h.rows();
  expect(rows.map(row => row.type)).toEqual(['SessionWorkEdge', 'SessionWorkEdge', 'SessionWorkEdgeClose', 'SessionWorkEdgeClose']);
  expect(closesOf(rows)[0]).toMatchObject({ edge: `${PARENT_EDGE}:delegated:toolu_h1`, state: 'uncertain', child: 'delegated:toolu_h1',
    detail: 'the parent step closed before the delegated agent returned', evidence: PARENT_EDGE });
  expect(closesOf(rows)[1]).toMatchObject({ edge: PARENT_EDGE, state: 'uncertain', child: h.launched(), calls: 0, reserved: 24 });
  // Cleanup is not confirmed over an open helper, so the close carries no cleanupConfirmed and collection never replays.
  expect('cleanupConfirmed' in closesOf(rows)[1]!).toBe(false);
  expect(closesOf(rows)[1]!.detail).toContain('delegated:toolu_h1 did not return');
  // Nothing is left registered; the sentinel's next observation retains no stale wait.
  h.sentinels.observeWork();
  expect(h.journal.view.activeSessionWork ?? {}).toEqual({});
  expect(h.work()).toEqual({});
  // Duplicate-result refusal at the journal: a second helper close (uncertain again, or a late completion) and a second
  // parent close are refused; the recorded result stands.
  const helperClose = closesOf(rows)[0]!, parentClose = closesOf(rows)[1]!;
  for (const duplicate of [helperClose, { ...helperClose, state: 'complete' as const, resultBytes: 4, detail: 'late', evidence: 'tool-result:late' },
    { ...parentClose, id: `${PARENT_EDGE}:close:2` }])
    expect(() => h.journal.append({ kind: 'session-work', record: duplicate, at: h.clock.now })).toThrow(/unknown or already closed edge/u);
  expect(h.rows()).toHaveLength(4);
  observed.push({ detail: outcome.detail });
  // Restart: the journal is reopened from disk and a fresh port, with nothing in memory, collects the same durable result
  // for the parent: uncertain, naming the lost helper, no automatic replay.
  h.journal.close();
  const again = await host(root, { fresh: false });
  expect(again.rows()).toHaveLength(4);
  const collected = again.port.collect(OPERATION);
  expect(collected).toMatchObject({ state: 'uncertain', edge: PARENT_EDGE, child: h.launched() });
  expect(collected!.detail).toBe(`${observed[0]!.detail}; no automatic replay`);
  expect(again.port.collect(OPERATION)).toEqual(collected);
  expect(again.journal.view.activeSessionWork ?? {}).toEqual({});
  again.sentinels.observeWork();
  expect(again.work()).toEqual({});
});

it('a failed helper: the harness reports the failure, its edge closes failed, the parent keeps its own completed result, and a restart collects it', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'helper-trace-'))); roots.push(root);
  let h: Awaited<ReturnType<typeof host>>;
  let polls = 0;
  const text = recordedWork.workOutput;
  h = await host(root, { fresh: true, answer: text, script: () => ++polls >= 4 ? 'output-observed' : 'launched', actions: [
    async () => { expect(await hook(h.state(CLAIM), { tool_name: 'Agent', tool_input: { prompt: 'look into it' }, tool_use_id: 'toolu_h1' }, 'pre')).toBe(0);
      expect(await hook(h.state(CLAIM), { agent_id: 'agent-h1', agent_type: 'worker' }, 'child-start')).toBe(0); },
    // The helper stops and the harness reports the exact call failed (1.x helper-failed, a rate limit): the checkpoint
    // closes its edge failed with the classified signal only; the error text returned to the parent, not to the journal.
    async () => { expect(await hook(h.state(CLAIM), { agent_id: 'agent-h1', agent_type: 'worker' }, 'child-stop')).toBe(0);
      expect(await hook(h.state(CLAIM), { hook_event_name: 'PostToolUseFailure', tool_use_id: 'toolu_h1', tool_name: 'Agent',
        tool_input: { prompt: 'look into it' }, error: 'Error: 429 Too Many Requests (api key sk-DUMMY-SECRET-0002)' }, 'post')).toBe(0);
      expect(h.gate.state(CLAIM).openDelegations).toEqual([]);
      // A late success for the same call is not a second result.
      expect(await hook(h.state(CLAIM), { tool_name: 'Agent', tool_use_id: 'toolu_h1', tool_input: { prompt: 'look into it' }, tool_response: { content: 'late' } }, 'post')).toBe(0);
      expect(closesOf(h.rows())).toHaveLength(1); },
  ] });
  // The parent, told of the failure, finishes its own work: its result is complete, not held uncertain over the helper.
  const outcome = await h.port.run(h.request(OPERATION));
  expect(outcome).toMatchObject({ state: 'complete', text, child: h.launched() });
  const rows = h.rows();
  expect(closesOf(rows).map(close => [close.edge, close.state])).toEqual([[`${PARENT_EDGE}:delegated:toolu_h1`, 'failed'], [PARENT_EDGE, 'complete']]);
  expect(closesOf(rows)[0]).toMatchObject({ evidence: 'tool-failure:toolu_h1', resultBytes: null,
    detail: "the harness reported this delegated agent's invocation failed before a result returned (signal: rate-limit)" });
  expect(closesOf(rows)[1]).toMatchObject({ cleanupConfirmed: true, resultDigest: digestOf(text), resultBytes: Buffer.byteLength(text) });
  expect(JSON.stringify(rows)).not.toContain('DUMMY-SECRET');
  h.journal.close();
  const again = await host(root, { fresh: false });
  expect(again.port.collect(OPERATION)).toMatchObject({ state: 'complete', text, child: h.launched() });
});

it('a stale helper after host loss: within its recorded deadline the parent waits; past it the helper needs action and collection stays uncertain', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'helper-trace-'))); roots.push(root);
  const first = await host(root, { fresh: true });
  // The host died after the launch: the port's own edge and the checkpoint's helper edge are durable, no close follows.
  const operation = 'obligation-commitment-16-2', claim = `session-work-${slugOf(operation)}`;
  const parent: SessionWorkEdge = { type: 'SessionWorkEdge', schemaVersion: 1, id: `session-work-edge:${operation}:1`, parent: first.config.parent,
    child: claim, scope: first.scope, owner: first.config.owner, authority: 'a test-only grant naming one bounded step',
    budget: { steps: 1, deadline: START + 60_000, maxResultBytes: 65_536, calls: 24, tokens: null }, exitTest: SESSION_WORK_EXIT_TEST,
    placement: first.config.placement, transport: first.config.transport, resultDestination: join(first.scope, `work-${slugOf(operation)}.json`), openedAt: START };
  first.journal.append({ kind: 'session-work', record: parent, at: START });
  first.journal.append({ kind: 'session-work', record: nestedSessionWorkEdge(parent, { id: 'toolu_h2', tool: 'Agent' }, START + 1000), at: START + 1000 });
  first.journal.close();
  const h = await host(root, { fresh: false });
  expect(Object.keys(h.journal.view.activeSessionWork ?? {}).sort()).toEqual([parent.id, `${parent.id}:delegated:toolu_h2`]);
  // Within the recorded deadline: the parent waits on its registered helper; nothing is collected or replayed.
  h.clock.now = START + 30_000; h.seen(claim); h.sentinels.observeWork();
  expect(h.work()).toMatchObject({ [parent.id]: { state: 'waiting' }, [`${parent.id}:delegated:toolu_h2`]: { state: 'unknown' } });
  expect(h.port.collect(operation)).toMatchObject({ state: 'uncertain', detail: 'child closure is not established; no automatic replay', edge: parent.id, child: null });
  // Past the deadline and its grace: the helper (and the parent sharing the deadline) is stale and needs reconciliation;
  // no death is inferred, nothing is killed, nothing is replayed, and collection is still uncertain.
  h.clock.now = START + 60_000 + WORK_STALE_GRACE_MS; h.seen(claim); h.sentinels.observeWork();
  expect(h.work()).toMatchObject({ [parent.id]: { state: 'action-needed' }, [`${parent.id}:delegated:toolu_h2`]: { state: 'action-needed' } });
  expect(h.port.collect(operation)).toMatchObject({ state: 'uncertain', detail: 'child closure is not established; no automatic replay' });
  expect(h.port.available()).toBe(true);
  h.clock.now += WORK_SILENCE_MS;
  expect(h.rows()).toHaveLength(2);
});
