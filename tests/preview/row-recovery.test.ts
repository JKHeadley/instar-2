/** Recorded failure shapes: rowproof-1109-PROGRESS.md, SHA256
 * 7e4fa298997895086534bb3a315b4746981f897e078ec635028ec3187085209c.
 * Update367056086: worker81127 killed, verified cleanup, no answer/modelState.
 * Update367056089: accepted before restart, later uncertain with eight returned checks.
 * Update367056088: promised commitment1 recoveryHeld; remains open (separate design).
 * Provider accounting prose below is a test control, not a captured model answer. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { createJournalWorker, openPreviewJournal, pendingUnknownCalls, ModelPending, ModelNotStarted,
  type PreviewPorts, type CallOutcome, type JournalRecord } from './journal-test-worker.js';
// @ts-expect-error Physical adapter is JavaScript.
import { toolTurnEligible } from './tool-turn.mjs';
const genesis = { kind: 'genesis' as const, bot: '8813073094', chat: '7654321', operator: '7654321',
  grant: 'grant:recovery', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 409600, cursor: 0 };
const key = new Uint8Array(32).fill(42);
const text = 'Please read the three most recently updated open issues on JKHeadley/instar, including their latest comments and linked evidence, and answer this question: which one should be investigated first, and why? Compare the strength of the evidence, cite each issue, and distinguish verified facts from hypotheses. I want the answer to this question, not a promise of a separate background report.';
const account = 'Finished: eight tool checks returned results. Not finished: their evidence was not verified into the requested issue comparison. I cannot confirm which issue should come first from the saved evidence.';
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const idOf = (n: number) => `telegram:${genesis.bot}:update:${n}`;
function setup(maxCalls = 20, forum = false) {
  const root = mkdtempSync(join(tmpdir(), 'row-recovery-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, { ...genesis, maxCalls, ...(forum ? { forum: true, chat: '-7654321' } : {}) });
  const sent: string[] = [], calls: Parameters<PreviewPorts['model']>[0][] = [];
  const ports: PreviewPorts = { now: () => 1794239921042, stopped: () => false, toolRoute: toolTurnEligible,
    model: async input => { calls.push(input); return JSON.stringify({ reply: account }); },
    checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return 6378; } };
  return { get journal() { return journal; }, sent, calls, ports,
    worker: () => createJournalWorker(journal, { ...ports, model: async input => input.id.startsWith('summary:')
      ? { state: 'uncertain' as const } : ports.model(input) }),
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); },
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}
it('row08 replays uncertain eight-check outcome into one tool-free account, once across restart', async () => {
  const f = setup(); let ordinary = 0;
  f.ports.model = async input => { f.calls.push(input); if (toolTurnEligible(input.id)) { ordinary++; return { state: 'uncertain', toolChecks: 8 }; }
    expect(JSON.parse(input.context)).toMatchObject({ request: text, returnedToolChecks: 8, capabilities: [] });
    return JSON.stringify({ reply: account, promises: [{ quote: 'invented promise' }] }); };
  try {
    f.worker().intake([update(367056089)]); await f.worker().drain();
    expect(ordinary).toBe(1); expect(f.calls.map(x => x.id)).toEqual([idOf(367056089), `recovery:${idOf(367056089)}`]);
    expect(f.sent).toEqual([account]); expect(f.journal.view.commitments).toHaveLength(0);
    expect(pendingUnknownCalls(f.journal.view)).toContain(`answer-replaced:${idOf(367056089)}`);
    f.journal.compact(); f.reopen(); await f.worker().drain(); await f.worker().drain();
    expect(f.sent).toEqual([account]); expect(f.calls).toHaveLength(2);
  } finally { f.close(); }
});
it.each(['verified', 'unresolved', 'absent'] as const)('row03 reserved restart with %s cleanup never repeats original tools', async cleanup => {
  const f = setup(), id = idOf(367056086);
  try {
    f.worker().intake([update(367056086)]); f.journal.append({ kind: 'reserve', id, at: 1794239285645 });
    if (cleanup !== 'absent') f.journal.append({ kind: 'call-outcome', id, role: 'model', at: 1794239377537,
      outcome: { exitCode: 1, localLimit: null, elapsedMs: 91892, type: null, subtype: null, isError: null, outputTokens: null, promptBytes: 1,
        resources: { cleanup, enforcement: { cpuPerProcess: 'hard', handlesPerProcess: 'hard', processGrowth: 'hard', treeHandles: 'sampled', memory: 'sampled', treeCpu: 'sampled' }, peakMemoryBytes: 0, peakProcesses: 1, treeCpuMilliseconds: 0, leakedDescendants: 0, census: 'complete', allocation: { state: 'returned', set: `allocation:sha256:${'a'.repeat(64)}` } } } as CallOutcome });
    f.reopen(); f.ports.collectModel = async () => null;
    await f.worker().drain(); await f.worker().drain();
    expect(f.calls.map(x => x.id)).toEqual(cleanup === 'verified' ? [`recovery:${id}`] : []);
    expect(f.sent).toEqual(cleanup === 'verified' ? [account] : []);
  } finally { f.close(); }
});
it.each(['throw', 'pending', 'not-started'] as const)('settled %s distinguishes ended invocation from retained custody', async mode => {
  const f = setup();
  f.ports.model = async input => { f.calls.push(input); if (input.id.startsWith('recovery:')) return JSON.stringify({ reply: account });
    if (mode === 'pending') throw new ModelPending(); if (mode === 'not-started') throw new ModelNotStarted(); throw Error('worker lost'); };
  try { f.worker().intake([update(367056086)]); await f.worker().drain();
    if (mode === 'throw') expect(f.sent).toEqual([account]);
    else if (mode === 'pending') expect(f.sent).toEqual([]);
    else expect(f.sent[0]).toContain("couldn't start my model");
    expect(f.calls.filter(x => x.id.startsWith('recovery:'))).toHaveLength(mode === 'throw' ? 1 : 0);
  } finally { f.close(); }
});
it.each(['cap', 'stop', 'failed-account'] as const)('%s bounds recovery without repeating tool work', async mode => {
  const f = setup(mode === 'cap' ? 2 : 20); let stopped = false;
  f.ports.stopped = () => stopped;
  f.ports.model = async input => { f.calls.push(input); if (mode === 'stop') stopped = true;
    return { state: 'uncertain', toolChecks: 8 }; };
  try { f.worker().intake([update(367056089)]); await f.worker().drain().catch(() => {});
    f.reopen(); await f.worker().drain().catch(() => {});
    expect(f.calls).toHaveLength(mode === 'failed-account' ? 2 : 1);
    expect(f.calls.filter(x => toolTurnEligible(x.id))).toHaveLength(1);
    if (mode === 'stop') expect(f.sent).toEqual([]);
    else { expect(f.sent).toHaveLength(1); expect(f.sent[0]).toContain('Finished and recorded:'); expect(f.sent[0]).toContain('Unfinished:'); }
  } finally { f.close(); }
});

it('replays captured summary, Jev, review and delivered/empty reply shapes as accounting outputs without inventing completion', async () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8'));
  for (const sample of recorded.negativeOutputs) {
    const f = setup();
    f.ports.model = async input => { f.calls.push(input);
      return input.id.startsWith('recovery:') && sample.output !== null ? sample.output : { state: 'uncertain', toolChecks: 8 }; };
    try { f.worker().intake([update(367056089)]); await f.worker().drain(); f.reopen(); await f.worker().drain();
      expect(f.calls, sample.id).toHaveLength(2); expect(f.sent, sample.id).toHaveLength(1);
      expect(f.journal.view.order[0]?.answer, sample.id).toBeUndefined();
      expect(f.journal.view.order[0]?.modelState, sample.id).toBe('uncertain');
    } finally { f.close(); }
  }
});
it('row01 retains the recorded uncertain promise shape without fabricating a fulfilled result', async () => {
  const f = setup(), id = idOf(367056088);
  const promise = "Got it, Justin. I'll compare the discussion and linked evidence for the three most recently updated open issues on JKHeadley/instar, give one plausible alternative explanation for each issue, and send you one combined report when it's done. This is a new comparison job, separate from the short summaries I sent at 07:53.";
  try {
    f.worker().intake([update(367056088)]);
    f.journal.append({ kind: 'reserve', id, at: 1794239745126 });
    f.journal.append({ kind: 'answer', id, text: promise, loops: [{ kind: 'deferral', quote: promise, waitsOn: 'nothing' }], at: 1794239759010 });
    f.journal.append({ kind: 'intent', id, text: promise, loops: [{ kind: 'deferral', quote: promise, waitsOn: 'nothing' }], chat: genesis.chat, update: 367056088, grant: genesis.grant, at: 1794239759010 });
    f.journal.append({ kind: 'sent', id, message: 6376, at: 1794239759010 });
    const slot = 1794239760000;
    f.journal.append({ kind: 'obligation-start', obligation: 'commitment:0', slot, session: true, at: slot });
    f.reopen(); await f.worker().workObligations(); await f.worker().workObligations();
    expect(f.journal.view.obligationWork['commitment:0']).toMatchObject({ outcome: 'uncertain', recoveryHeld: true, attempts: 1 });
    expect(f.journal.view.obligationWork['commitment:0']?.report).toBeUndefined();
    expect(f.calls).toEqual([]); expect(f.sent).toEqual([]);
  } finally { f.close(); }
});

it('uses the real prepared envelope and ordinary reply review for the recovery account', async () => {
  const f = setup(); let reviews = 0;
  f.ports.prepareModel = input => prepareJournalEnvelope(input, 'claude-sonnet-4-6', genesis.grant, f.ports.now(), genesis.maxBytes);
  f.ports.model = async input => { f.calls.push(input);
    if (!input.id.startsWith('recovery:')) return { state: 'uncertain', toolChecks: 8 };
    expect(JSON.parse(input.prepared!).tools).toEqual([]);
    const packet = JSON.parse(JSON.parse(input.prepared!).messages.find((m: { role: string }) => m.role === 'context').content).packet;
    expect(packet.request).toBe(text); expect(packet.capabilities).toEqual([]);
    return JSON.stringify({ reply: account }); };
  f.ports.replyCheck = { elapsedMs: () => 0,
    jev: async (candidate, questions) => { reviews++; expect(candidate).toBe(account);
      return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(questions ?? {}).map(rule => [rule, { type: 'noul', noul: 0.01 }])) }, latencyMs: 1 }; },
    escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 1, path: 'subscription' }) };
  try { f.worker().intake([update(367056089)]); await f.worker().drain();
    expect(f.sent).toEqual([account]); expect(reviews).toBeGreaterThan(0);
  } finally { f.close(); }
});
it('a stop during awaited recovery disclosure prevents the provider call', async () => {
  const f = setup(20, true); let recoveryPrepared = false, stopped = false;
  f.ports.stopped = () => stopped;
  f.ports.prepareModel = input => { if (input.id.startsWith('recovery:')) recoveryPrepared = true;
    return prepareJournalEnvelope(input, 'claude-sonnet-4-6', genesis.grant, f.ports.now(), genesis.maxBytes); };
  f.ports.groupDisclosure = async () => { if (recoveryPrepared) { await Promise.resolve(); stopped = true; } return true; };
  f.ports.model = async input => { f.calls.push(input); return { state: 'uncertain', toolChecks: 8 }; };
  try { const incoming = update(367056089); f.worker().intake([{ ...incoming, message: { ...incoming.message, chat: { id: -7654321, type: 'supergroup', is_forum: true } } }]);
    await expect(f.worker().drain()).rejects.toThrow('preview stopped');
    expect(f.calls.filter(x => x.id.startsWith('recovery:'))).toEqual([]); expect(f.sent).toEqual([]);
  } finally { f.close(); }
});
it('an interrupted accounting reservation survives compaction without repeating either model call', async () => {
  const f = setup(), id = idOf(367056086);
  try { f.worker().intake([update(367056086)]);
    f.journal.append({ kind: 'reserve', id, at: f.ports.now() });
    f.journal.append({ kind: 'model-uncertain', id, state: 'uncertain', accountNeeded: true, at: f.ports.now() });
    f.journal.append({ kind: 'answer-replace', id, state: 'uncertain', recovery: true, at: f.ports.now() });
    f.journal.compact(); f.reopen(); await f.worker().drain(); f.reopen(); await f.worker().drain();
    expect(f.calls).toEqual([]); expect(f.sent).toHaveLength(1); expect(f.sent[0]).toContain('Unfinished:');
    expect(pendingUnknownCalls(f.journal.view)).toContain(`answer-replaced:${id}`);
  } finally { f.close(); }
});

it('an earlier clean timeout does not release a later replacement reservation with unknown custody', async () => {
  const f = setup(), id = idOf(367056086);
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/lostanswer-live-2026-10-02.json', import.meta.url), 'utf8')).lostFirstCall.callOutcomes[0];
  const { id: _id, role: _role, at: _at, ...outcome } = recorded;
  try { f.worker().intake([update(367056086)]); f.journal.append({ kind: 'reserve', id, at: f.ports.now() });
    f.journal.append({ kind: 'call-outcome', id, role: 'model', outcome, at: f.ports.now() });
    f.journal.append({ kind: 'answer-replace', id, state: 'uncertain', at: f.ports.now() });
    f.reopen(); await f.worker().drain(); await f.worker().drain();
    expect(f.calls).toEqual([]); expect(f.sent).toEqual([]);
    expect(f.journal.view.turns.get(id)?.modelState).toBeUndefined();
  } finally { f.close(); }
});
it.each([3, 20])('retains the finished/unfinished path after tool eligibility disappears (cap %s)', async cap => {
  const f = setup(cap); let route = true;
  f.ports.toolRoute = id => route && toolTurnEligible(id);
  f.ports.model = async input => { f.calls.push(input);
    if (!input.id.startsWith('recovery:')) {
      f.journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 1, at: f.ports.now() });
      route = false;
    }
    throw Error('recorded invocation ended without a result'); };
  try { f.worker().intake([update(367056089)]); await f.worker().drain(); f.reopen(); await f.worker().drain();
    expect(f.calls).toHaveLength(cap === 3 ? 1 : 2); expect(f.sent).toHaveLength(1);
    expect(f.sent[0]).toContain('Finished and recorded:'); expect(f.sent[0]).toContain('Unfinished:');
  } finally { f.close(); }
});

// Same diagnostic wrapper used by journal-agent.mjs modelRoute().
// @ts-expect-error Physical adapter is JavaScript.
import { observedSubscriptionIO } from './call-diagnostics.mjs';
it('a completed recovery provider call retains its physical outcome and delivers its account', async () => {
  const f = setup();
  const errors: string[] = [];
  f.ports.model = async input => {
    f.calls.push(input);
    const io = observedSubscriptionIO({ execute: async () => ({ code: 0, limited: false,
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
        result: JSON.stringify({ reply: account }), usage: { output_tokens: 20 } }) }) },
      { maxTokens: 2048, maxOutputBytes: 65536 }, input.id,
      (row: never) => f.journal.append(row), { elapsed: () => 0, at: f.ports.now });
    try { await io.execute({ stdin: input.context }); }
    catch (error) { errors.push(String(error)); throw error; }
    if (!input.id.startsWith('recovery:')) return { state: 'uncertain', toolChecks: 8 };
    return JSON.stringify({ reply: account });
  };
  try {
    f.worker().intake([update(367056089)]); await f.worker().drain();
    expect(f.journal.view.callOutcomes.some(row => row.id === idOf(367056089))).toBe(true);
    expect({ errors, sent: f.sent }).toEqual({ errors: [], sent: [account] });
    const physical = f.journal.view.callOutcomes.find(row => row.id === `recovery:${idOf(367056089)}`);
    expect(physical?.outcome).toMatchObject({ exitCode: 0, type: 'result', subtype: 'success', outputTokens: 20 });
    expect(physical?.outcome.diagnostic?.rawOutputExcerpt).toContain(account);
    f.journal.compact(); f.reopen(); await f.worker().drain();
    expect(f.journal.view.callOutcomes.find(row => row.id === physical?.id)).toEqual(physical);
    expect(f.sent).toEqual([account]); expect(f.calls).toHaveLength(2);
  } finally { f.close(); }
});

it.each(['missing-parent', 'unreserved-parent', 'original-reservation', 'ordinary-replacement', 'wrong-parent', 'wrong-role'] as const)(
  'recovery physical outcome refuses %s without its exact replacement reservation', async mode => {
    const f = setup(), id = idOf(367056089);
    try {
      if (mode !== 'missing-parent') f.worker().intake([update(367056089)]);
      if (!['missing-parent', 'unreserved-parent'].includes(mode)) f.journal.append({ kind: 'reserve', id, at: f.ports.now() });
      if (mode === 'ordinary-replacement') {
        const recorded = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/lostanswer-live-2026-10-02.json'), 'utf8'));
        const { id: _id, role, at: _at, ...outcome } = recorded.lostFirstCall.callOutcomes[0];
        f.journal.append({ kind: 'call-outcome', id, role, outcome, at: f.ports.now() });
        f.journal.append({ kind: 'answer-replace', id, state: 'uncertain', at: f.ports.now() });
      }
      if (mode === 'wrong-parent' || mode === 'wrong-role') {
        f.journal.append({ kind: 'model-uncertain', id, state: 'uncertain', at: f.ports.now() });
        f.journal.append({ kind: 'answer-replace', id, state: 'uncertain', recovery: true, at: f.ports.now() });
      }
      const operation = `recovery:${mode === 'wrong-parent' ? idOf(367056086) : id}`;
      const io = observedSubscriptionIO({ execute: async () => ({ code: 0, limited: false,
        stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: JSON.stringify({ reply: account }) }) }) },
        { maxTokens: 2048, maxOutputBytes: 65536 }, operation,
        (row: Extract<JournalRecord, { kind: 'call-outcome' }>) => f.journal.append(mode === 'wrong-role' ? { ...row, role: 'reply-review' } : row),
        { elapsed: () => 0, at: f.ports.now });
      await expect(io.execute({ stdin: text })).rejects.toThrow('preview journal: call outcome malformed');
      expect(f.journal.view.callOutcomes.some(row => row.id === operation)).toBe(false);
    } finally { f.close(); }
  });
