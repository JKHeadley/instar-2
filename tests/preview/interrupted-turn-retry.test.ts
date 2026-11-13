import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createConversationSessionPort, type ConversationSessionConfig, type ConversationState } from '../../src/assembly/production-conversation-session.js';
import type { HarnessAdapterPort } from '../../src/assembly/contracts.js';
import type { SessionWorkEdge, SessionWorkEffect } from '../../src/assembly/production-session-work.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createJournalWorker, openPreviewJournal, ModelPending, type PreviewPorts } from './journal-test-worker.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
// @ts-expect-error Physical checkpoint is JavaScript.
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error Shared tool classification is JavaScript.
import { admitToolCallEffect } from './tool-admission.mjs';

// Operator-supplied incident, update 969390730 / message 800, 2026-11-12 15:07–15:09 PST.
// No raw interruption event was supplied. A correlated uncertain end and thrown observation below
// are injected interruption mechanisms, NOT claims about what interrupted the live attempt.
const question = 'which pull request on EchoOfDawn/instar was opened most recently, who opened it, and is it merged yet?';
const lost = "I can't answer this one from what was saved. The previous attempt was interrupted before any lookup was recorded: no check of EchoOfDawn/instar's pull requests finished. So I have no verified answer about which pull request was opened most recently, who opened it, or whether it is merged. Nothing was completed, and I won't guess.";
const answered = 'I checked just now, and EchoOfDawn/instar has no pull requests at all.'; // supplied message 802 excerpt
const lookup = 'mcp__github__list_pull_requests';
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
type Mode = 'none' | 'read' | 'effect' | 'write' | 'twice' | 'throw' | 'stop' | 'cap' | 'send' | 'cleanup' | 'boot-read' | 'boot-effect';
async function fixture(mode: Mode = 'none', interruptedOutput?: string | null) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'interrupted-turn-')));
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(52);
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8820318295', chat: '7654321', operator: '7654321',
    grant: 'grant:operator', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 50, maxReplies: 20, maxTurns: 20, maxBytes: 262144, cursor: 0 });
  let now = 1794524872000, stopped = false, state: ConversationState | null = null, launches = 0, attempts = 0;
  let interruptedState: ConversationState | null = null;
  const sent: string[] = [], modelIds: string[] = [], toolCalls: string[] = [], waits: number[] = [], deliveries: string[] = [];
  const append = (record: SessionWorkEffect | SessionWorkEdge) => journal.append({ kind: 'session-work', record, at: now });
  const effects = createToolEffectOwner({ append, prepared: (id: string) => journal.view.toolEffects?.includes(id) === true,
    stopped: () => stopped, now: () => now, decide: (tool: string, input: unknown) => tool === lookup
      ? admitToolCallEffect(tool, input, { mcpReads: [lookup], operations: [] }, now)
      : { admitted: true, consequential: true, effect: 'tool:mcp', disposition: 'granted', grant: 'grant:operator',
        tests: { irreversible: true, resources: false, scope: false, policySensitive: false }, reason: 'test standing send grant' } });
  const gate = await createAdmissionGate({ append, effects, stopped: () => stopped, now: () => now, held: () => 'clear' });
  const tool = async (claim: string, name: string, kind: string, phase = 'pre') => {
    const reply = await fetch(`${gate.base(claim)}/admit`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool_name: name, tool_use_id: `call-${attempts}-${name}`, tool_input: { repo: 'EchoOfDawn/instar' }, kind, phase, result_bytes: 2 }) });
    const result = await reply.json() as { decision: string };
    expect(result.decision).toBe('allow'); if (phase === 'pre') toolCalls.push(name);
  };
  const adapter: HarnessAdapterPort<2> = {
    describe: () => ({ version: 2, subsequentInput: true, output: 'reply-and-turn-end', resume: false }),
    launch: async input => { launches++; return { launch: `worker-${launches}`, claim: input.claim, incarnation: input.incarnation }; },
    deliver: async input => {
      attempts++; deliveries.push(input.text);
      expect(state!.inputs[0]?.state).toBe('dispatching');
      if (attempts === 1 && (mode === 'read' || mode === 'boot-read') || attempts > 1) await tool(input.claim, lookup, 'effect');
      if (attempts === 1 && (mode === 'effect' || mode === 'boot-effect')) await tool(input.claim, 'mcp__mail__send', 'effect');
      if (attempts === 1 && mode === 'write') await tool(input.claim, 'Write', 'tool');
      return { state: 'accepted', evidence: 'injected harness delivery' };
    },
    observe: async input => {
      if (!input.delivery) return { observations: [], cursor: input.cursor, complete: true };
      if (attempts === 1 || mode === 'twice') {
        if (interruptedState === null && (mode === 'boot-read' || mode === 'boot-effect')) { interruptedState = structuredClone(state); stopped = true; }
        if (mode === 'stop') stopped = true;
        if (mode === 'throw') throw Error('injected observer interruption');
        return { observations: [ ...(interruptedOutput ? [{ kind: 'reply' as const, delivery: input.delivery.operation,
          text: interruptedOutput, digest: hash(interruptedOutput) }] : []),
        { kind: 'turn-end', delivery: input.delivery.operation, state: 'uncertain' }], cursor: 2, complete: true };
      }
      const text = JSON.stringify({ reply: answered, memory: [] });
      return { observations: [{ kind: 'reply', delivery: input.delivery.operation, text, digest: hash(text) },
        { kind: 'turn-end', delivery: input.delivery.operation, state: 'completed' }], cursor: 2, complete: true };
    },
    control: async input => {
      return { state: mode === 'cleanup' ? 'uncertain' : 'closed', evidence: 'injected process closure' };
    },
  };
  const runtime = assemblyRuntimeFixture();
  const config: ConversationSessionConfig = { conversation: 'operator', allowanceDeadline: now + 60000, authorized: () => true,
    currentAuthority: () => 'grant:operator', contextRecoveryAllowed: () => mode !== 'send',
    store: { load: () => structuredClone(state), save: next => { state = structuredClone(next); } }, createAdapter: () => adapter,
    io: { clearResult: () => {}, readResult: () => null, modelCalls: () => attempts, wait: async ms => { waits.push(ms); now += ms; },
      prepareAdmission: (claim, edge) => gate.open(claim, { framework: 'claude-code', allowance: edge.budget.calls, edge,
        noteTool: (ordinal: number, retrySafe: boolean) => port.noteToolPreparation!(claim, ordinal, retrySafe) }),
      closeAdmission: claim => gate.close(claim), admissionState: claim => gate.state(claim) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: runtime.c, now: () => now, stopped: () => stopped,
    append: record => journal.append({ kind: 'session-work', record, at: now }), parent: 'runner', owner: 'machine',
    placement: 'local', transport: 'injected harness', workingScope: '/scope', resultDirectory: '/scope', artifact: 'harness',
    incarnation: 'one', deadlineMs: 10000, pollMs: 25, maxResultBytes: 65536, maxSteps: 8, maxCalls: mode === 'cap' ? 1 : 6 };
  let port = value(createConversationSessionPort(config));
  const ports: PreviewPorts = { now: () => now, stopped: () => stopped, toolRoute: () => true,
    prepareModel: input => JSON.stringify(input),
    collectModel: async id => { const saved = await port.collect(id); return saved && { context: saved.request.context,
      prepared: saved.request.question, answer: conversationSessionAnswer(saved.outcome, id, () => {}) }; },
    model: async input => { modelIds.push(input.id);
      if (input.id.startsWith('summary:')) return { state: 'uncertain' };
      if (input.id.startsWith('recovery:')) return JSON.stringify({ reply: mode === 'none' ? lost : 'I could not finish. The earlier effect may have happened; I have not repeated it.' });
      const outcome = await port.run({ operation: input.id, question: input.prepared!, context: input.context, authority: 'grant:operator' });
      // A killed host never returns its outcome to the journal consumer; retain that reservation.
      if (stopped && (mode === 'boot-read' || mode === 'boot-effect')) throw new ModelPending();
      return conversationSessionAnswer(outcome, input.id, () => {}); },
    send: async input => { sent.push(input.expectedText); return 802; }, checkOutbound: () => {} };
  const worker = createJournalWorker(journal, ports);
  worker.intake([{ update_id: 969390730, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: question } }]);
  return { journal, worker, ports, sent, modelIds, toolCalls, waits, deliveries, state: () => state!, launches: () => launches,
    restartInterrupted: async () => { expect(interruptedState).not.toBeNull(); state = structuredClone(interruptedState);
      stopped = false; port = value(createConversationSessionPort(config)); await port.maintain(); },
    replay: async () => {
      journal.compact(); journal.close(); const restored = openPreviewJournal(path, key);
      try { await createJournalWorker(restored, { ...ports, model: async () => { throw Error('historical replay must not run'); } }).drain();
        expect(restored.view.order[0]?.sent).toBe(802); } finally { restored.close(); }
    }, close: async () => { await gate.stop(); journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it.each(['none', 'read', 'throw'] as const)('retries the 15:07 unanswered shape with normal tools (%s), then sends once', async mode => {
  const f = await fixture(mode);
  try { await f.worker.drain();
    expect(f.deliveries).toHaveLength(2); expect(f.launches()).toBe(2); expect(f.toolCalls).toContain(lookup);
    expect(f.deliveries[1]).toContain(question); expect(f.deliveries[1]).toContain('Use available account connectors');
    expect(f.sent).toEqual([answered]); expect(f.journal.view.order[0]?.answerAccount).toBeUndefined();
    expect(f.modelIds.some(id => id.startsWith('recovery:'))).toBe(false);
    expect(f.state().inputs[0]).toMatchObject({ attempts: 2, workerRecovery: 'continued', state: 'settled' });
    expect(f.waits).toEqual([50]); expect(f.journal.view.calls).toBe(7); // one journal base plus retained six-call parent
    await f.worker.drain(); await f.replay(); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});
it.each(['effect', 'write', 'send', 'cleanup', 'cap', 'stop'] as const)('preserves the %s fence and never repeats an unknown effect', async mode => {
  const f = await fixture(mode);
  try { await f.worker.drain().catch(() => {}); await f.worker.drain().catch(() => {});
    expect(f.deliveries).toHaveLength(1); expect(f.launches()).toBe(1);
    if (mode === 'effect') { expect(f.toolCalls).toEqual(['mcp__mail__send']); expect(f.journal.view.actionEffects).toMatchObject([{ state: 'prepared' }]); }
    if (mode !== 'stop') { expect(f.sent).toHaveLength(1); expect(f.sent[0]).not.toBe(answered); await f.replay(); }
    else expect(f.sent).toEqual([]);
  } finally { await f.close(); }
});
it('bounds a second interruption at two dispatches, across journal replay', async () => {
  const f = await fixture('twice');
  try { await f.worker.drain(); await f.worker.drain();
    expect(f.deliveries).toHaveLength(2); expect(f.sent).toHaveLength(1);
    expect(f.modelIds.filter(id => id.startsWith('recovery:'))).toHaveLength(1);
    await f.replay(); expect(f.deliveries).toHaveLength(2); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});
it.each(['boot-read', 'boot-effect'] as const)('retains the %s dispatch classification across a host restart', async mode => {
  const f = await fixture(mode);
  try { await f.worker.drain().catch(() => {}); expect(f.sent).toEqual([]);
    await f.restartInterrupted(); await f.worker.drain();
    expect(f.deliveries).toHaveLength(mode === 'boot-read' ? 2 : 1);
    expect(f.sent).toHaveLength(1);
    if (mode === 'boot-read') expect(f.sent).toEqual([answered]);
    else expect(f.toolCalls).toEqual(['mcp__mail__send']);
    await f.replay(); expect(f.sent).toHaveLength(1);
  } finally { await f.close(); }
});
const shapes = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8')) as {
  negativeOutputs: { id: string; source: string; shape: string; output: string | null }[] };
it.each(shapes.negativeOutputs)('replays recorded $shape ($id) as incomplete output and still retries the owned request', async sample => {
  const f = await fixture('none', sample.output);
  try { await f.worker.drain(); expect(f.deliveries, sample.source).toHaveLength(2);
    expect(f.sent).toEqual([answered]); expect(f.toolCalls).toContain(lookup); await f.replay();
  } finally { await f.close(); }
});
