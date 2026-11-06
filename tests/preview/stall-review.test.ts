import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { interpretStallReview, stallSample, stallReviewQuestion, prepareStallReview } from './stall-review.js';
import { readAnswer } from './answer-reading.js';
import { answerCall } from './journal-envelope.js';
import { assertLiveJudgment } from './model-call-boundary.js';

const worker = { claim: 'claim', incarnation: 'incarnation', launch: 'exact:123:456' };
const sample = { subject: worker.claim, incarnation: worker.incarnation, launch: worker.launch,
  at: 100, progress: 'pane-hash', wait: null, activity: 'idle' as const };
const judge = (decision: string, confidence = 0.8) => interpretStallReview({ state: 'complete',
  value: JSON.stringify({ decision, confidence, reason: 'Observed unchanged terminal with no live helper.' }) });

describe('registered stalled-work supervisor', () => {
  it('binds observation to exact worker and refuses missing/indeterminate evidence', () => {
    expect(stallSample(sample, worker)).toEqual({ ...worker, at: 100, progress: 'pane-hash', waiting: false, activity: 'idle' });
    for (const change of [{ subject: 'other' }, { incarnation: 'other' }, { launch: 'other' }, { progress: null }])
      expect(stallSample({ ...sample, ...change }, worker)).toBeNull();
    expect(stallSample({ ...sample, activity: 'indeterminate' }, worker)?.activity).toBe('indeterminate');
    expect(stallSample({ ...sample, wait: 'helper' }, worker)?.waiting).toBe(true);
  });
  it('keeps the legacy confidence floor and a conservative narrow action space', () => {
    expect(judge('recover')).toBe('recover');
    expect(judge('recover', 0.799)).toBe('unknown');
    expect(judge('recover', 1.01)).toBe('unknown');
    expect(judge('wait')).toBe('wait');
    expect(judge('auto_restart')).toBe('unknown');
    expect(interpretStallReview({ state: 'uncertain', value: '{"decision":"recover"}' })).toBe('unknown');
    expect(interpretStallReview({ state: 'complete', value: '' })).toBe('unknown');
  });
  it('uses the registered model boundary and quoted maintenance envelope', () => {
    expect(() => assertLiveJudgment('stall-triage', 'preview-subscription')).not.toThrow();
    expect(answerCall('stall-triage:operation:100')).toBe(false);
    expect(stallReviewQuestion).toContain('quoted context');
    const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
    expect(source).toContain('reserve: claim => sessionWork.port.reserveReview(claim)');
    expect(source).toContain("journal.systemWriter('stall-triage'");
    expect(source).toContain('prepareStallReview(evidence,');
    expect(source).toContain("operation.startsWith('stall-triage:') && (journal.view.stop !== null || !ownerHeld())");
    expect(source).toContain("operation.startsWith('stall-triage:') || operation.endsWith(':reply-review')");
  });
  it('replays real recorded summary, Jev, review and reply shapes without granting recovery', () => {
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8'));
    for (const recorded of fixture.negativeOutputs) {
      const parsed = recorded.output ? readAnswer(recorded.output, { wrapped: 'refuse', evidence: [recorded.id], object: true }) : null;
      expect(interpretStallReview({ state: recorded.output === null ? 'uncertain' : 'complete',
        value: parsed?.ok ? parsed.value : recorded.output ?? undefined }), `${recorded.shape}: ${recorded.id}`).toBe('unknown');
    }
  });
});

it('runs the actual host consumer on recorded shapes with full quoted evidence and no provider', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8'));
  const evidence = { worker, operation: 'original-input', progress: sample.progress, silentSince: 1,
    observedAt: 100, deadline: 1000000, request: { operation: 'original-input', question: 'Original question', context: '{"history":"prior turns"}', authority: 'existing' },
    delivery: { ...worker, operation: 'original-input', text: 'Original delivery', digest: 'sha256:original', resultPath: '/bounded-result', maxBytes: 4096 },
    observation: { ...worker, at: 100, progress: sample.progress, waiting: false, activity: 'idle' as const } };
  let calls = 0, preparedContext = '';
  const ports = {
    turn: () => ({ accepted: true, prompt: 'Full admitted prompt' }), observation: () => ({ ...sample, terminal: 'Current pane bytes' }), now: () => 100,
    protect: (text: string) => text, writer: () => ({ id: 'verified-runner', kind: 'system', adapter: 'preview-runner' }),
    prepare: (input: { context: string }) => { preparedContext = input.context; return input.context; },
    invoke: async (_prepared: string, _id: string, deadline: number) => {
      calls++; expect(deadline).toBe(600100);
      return { state: 'complete', value: JSON.stringify({ decision: 'recover', confidence: 0.8, reason: 'Bounded offline positive case' }) };
    }
  };
  const prepared = prepareStallReview(evidence, ports);
  expect(prepared).not.toBeNull();
  expect(prepared!.deadline).toBe(600100);
  expect(interpretStallReview(await ports.invoke(prepared!.prepared, prepared!.id, prepared!.deadline))).toBe('recover');
  expect(calls).toBe(1);
  expect(JSON.parse(preparedContext)).toEqual({ originalPrompt: 'Full admitted prompt', originalPrompts: ['Full admitted prompt'], evidence, terminal: 'Current pane bytes' });
  expect(prepareStallReview(evidence, { ...ports, writer: () => null })).toBeNull();
  expect(prepareStallReview(evidence, { ...ports, observation: () => undefined })).toBeNull();
  expect(calls).toBe(1);
  for (const recorded of fixture.negativeOutputs) {
    expect(prepareStallReview(evidence, ports)).not.toBeNull();
    const parsed = recorded.output ? readAnswer(recorded.output, { wrapped: 'refuse', evidence: [recorded.id], object: true }) : null;
    expect(interpretStallReview({ state: recorded.output === null ? 'uncertain' : 'complete',
      value: parsed?.ok ? parsed.value : recorded.output ?? undefined }), recorded.id).toBe('unknown');
  }
});

it('quotes every admitted batch member and refuses missing or substituted batch custody', () => {
  const request = { operation: 'first', question: 'First task', context: 'First context', authority: 'existing' };
  const second = { ...request, operation: 'second', question: 'Later correction' };
  const evidence = { worker, operation: 'first', progress: sample.progress, silentSince: 1,
    observedAt: 100, deadline: 1000000, request, requests: [request, second],
    delivery: { ...worker, operation: 'first', text: 'Combined delivery', digest: 'sha256:original', resultPath: '/bounded-result', maxBytes: 4096 },
    observation: { ...worker, at: 100, progress: sample.progress, waiting: false, activity: 'idle' as const } };
  const ports = { turn: (operation: string) => ({ accepted: true, prompt: `complete:${operation}` }),
    observation: () => ({ ...sample, terminal: 'Current pane bytes' }), now: () => 100,
    protect: (text: string) => text, writer: () => ({ id: 'writer', kind: 'system', adapter: 'preview-runner' }),
    prepare: (input: { context: string }) => input.context };
  const result = prepareStallReview(evidence, ports);
  expect(JSON.parse(result!.prepared).originalPrompts).toEqual(['complete:first', 'complete:second']);
  expect(prepareStallReview(evidence, { ...ports, turn: operation => operation === 'first' ? ports.turn(operation) : undefined })).toBeNull();
  expect(prepareStallReview({ ...evidence, requests: [second, request] }, ports)).toBeNull();
  expect(prepareStallReview({ ...evidence, requests: [request, request] }, ports)).toBeNull();
});

it('passes recorded stale progress and protected status into the same owner supervision input', () => {
  const stale = { state: 'stalled' as const, episode: 2, lastProgressAt: 10, indeterminateStreak: 4,
    longIndeterminate: true, windowMs: 1800000 };
  expect(stallSample({ ...sample, stale }, worker)).toMatchObject({ stale, progress: 'pane-hash:10' });
  expect(stallSample({ ...sample, stale: { ...stale, state: 'protected' } }, worker)?.stale?.state).toBe('protected');
});

// Carryover 02 r4: the typed 1.x TriageOrchestrator vocabulary, asked by meaning and parsed into the owner's
// closed decision; the legacy decision field keeps its meaning; every recorded real shape stays unknown.
import { interpretStallDecision } from './stall-review.js';
describe('typed stall triage decision', () => {
  const typed = (fields: Record<string, unknown>) => interpretStallDecision({ state: 'complete',
    value: JSON.stringify({ classification: 'stuck_on_tool', action: 'suggest_interrupt', confidence: 0.7, followUpMinutes: 5, reason: 'A build has produced no output.', ...fields }) });
  it('maps the six classifications and six actions into the owner vocabulary with a bounded follow-up', () => {
    expect(typed({})).toEqual({ kind: 'triage', classification: 'stuck-on-tool', action: 'suggest-interrupt', confidence: 0.7, followUpMs: 300_000, reason: 'A build has produced no output.' });
    expect(typed({ classification: 'message_lost', action: 'reinject_message', followUpMinutes: null })).toMatchObject({ classification: 'message-lost', action: 'reinject', followUpMs: null });
    expect(typed({ classification: 'actively_working', action: 'none', followUpMinutes: 2.5 })).toMatchObject({ classification: 'actively-working', action: 'none', followUpMs: 150_000 });
    expect(typed({ classification: 'crashed', action: 'auto_restart', confidence: 0.9 })).toMatchObject({ action: 'auto-restart', confidence: 0.9 });
    expect(typed({ reason: undefined, reasoning: 'from the reasoning field' })).toMatchObject({ reason: 'from the reasoning field' });
    expect(typed({ followUpMinutes: -3 })).toMatchObject({ followUpMs: null });
    expect(typed({ followUpMinutes: 'soon' })).toMatchObject({ followUpMs: null });
  });
  it('refuses anything outside the closed vocabularies, without confidence or reason, or not complete', () => {
    expect(typed({ classification: 'stuck_on_nothing' })).toBe('unknown');
    expect(typed({ action: 'kill' })).toBe('unknown');
    expect(typed({ action: 'auto-restart' })).toBe('unknown');
    expect(typed({ confidence: 1.5 })).toBe('unknown');
    expect(typed({ reason: '' })).toBe('unknown');
    expect(interpretStallDecision({ state: 'uncertain', value: JSON.stringify({ classification: 'crashed', action: 'auto_restart', confidence: 1, reason: 'x' }) })).toBe('unknown');
    expect(interpretStallDecision({ state: 'complete', value: '[1]' })).toBe('unknown');
  });
  it('keeps the legacy decision field and projects typed judgments back to the narrow legacy reading', () => {
    expect(interpretStallDecision({ state: 'complete', value: JSON.stringify({ decision: 'recover', confidence: 0.8, reason: 'frozen' }) })).toBe('recover');
    expect(interpretStallDecision({ state: 'complete', value: JSON.stringify({ decision: 'wait', confidence: 0.1, reason: 'busy' }) })).toBe('wait');
    expect(interpretStallDecision({ state: 'complete', value: JSON.stringify({ decision: 'recover', confidence: 0.79, reason: 'frozen' }) })).toBe('unknown');
    expect(interpretStallReview({ state: 'complete', value: JSON.stringify({ classification: 'crashed', action: 'auto_restart', confidence: 0.9, reason: 'dead' }) })).toBe('recover');
    expect(interpretStallReview({ state: 'complete', value: JSON.stringify({ classification: 'crashed', action: 'auto_restart', confidence: 0.5, reason: 'dead' }) })).toBe('unknown');
    expect(interpretStallReview({ state: 'complete', value: JSON.stringify({ classification: 'actively_working', action: 'none', confidence: 0.9, followUpMinutes: 5, reason: 'working' }) })).toBe('wait');
    expect(interpretStallReview({ state: 'complete', value: JSON.stringify({ classification: 'message_lost', action: 'reinject_message', confidence: 0.95, reason: 'lost' }) })).toBe('unknown');
  });
  it('replays every recorded real summary, Jev, review and reply shape through the typed parser as unknown', () => {
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8'));
    for (const recorded of fixture.negativeOutputs) {
      const parsed = recorded.output ? readAnswer(recorded.output, { wrapped: 'refuse', evidence: [recorded.id], object: true }) : null;
      expect(interpretStallDecision({ state: recorded.output === null ? 'uncertain' : 'complete',
        value: parsed?.ok ? parsed.value : recorded.output ?? undefined }), `${recorded.shape}: ${recorded.id}`).toBe('unknown');
    }
    expect(interpretStallDecision({ state: 'complete', value: fixture.workOutput })).toBe('unknown');
  });
  it('the question asks for the typed vocabulary and the runner consumes the typed parser on both owners', () => {
    for (const word of ['actively_working', 'message_lost', 'reinject_message', 'auto_interrupt', 'followUpMinutes', 'confidence at least 0.8']) expect(stallReviewQuestion).toContain(word);
    const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
    expect(source.match(/interpretStallDecision\(await invokeSubscription\(/gu)).toHaveLength(2);
    expect(source).not.toContain('interpretStallReview(');
    expect(stallSample({ subject: 'claim', incarnation: 'incarnation', launch: 'exact:123:456', at: 100, progress: 'pane-hash', wait: null, activity: 'idle', typedUnsubmitted: true },
      { claim: 'claim', incarnation: 'incarnation', launch: 'exact:123:456' })).toMatchObject({ typedUnsubmitted: true });
  });
});

// Carryover 02 r4: the existing registered-work watcher is the one-shot stale source; neither the 600 000 ms step
// lifetime nor the driver's 1 800 000 ms job window changes.
import { registeredWorkStale } from './stall-review.js';
import { workSilenceObservations, WORK_SILENCE_MS, WORK_FROZEN_INDICATOR_MS } from './live-sentinels.js';
import { openPreviewJournal } from './journal.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
describe('registered-work watcher as the one-shot stale signal', () => {
  const windows = { silenceMs: WORK_SILENCE_MS, frozenActiveMs: WORK_FROZEN_INDICATOR_MS };
  const base = { ...worker, at: 100_000, progress: 'pane-hash', waiting: false, activity: 'idle' as const };
  it('maps a genuine stalled watcher row onto the observation and holds protected, unknown, fresh and future rows', () => {
    const root = mkdtempSync(join(tmpdir(), 'stall-watch-'));
    try {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(3), { kind: 'genesis', bot: '12345678', chat: '7654321',
        operator: '7654321', grant: 'grant:watch', configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 });
      const edge = { type: 'SessionWorkEdge' as const, schemaVersion: 1 as const, id: 'session-work-edge:job:1', parent: 'launch:c', child: worker.claim,
        scope: '/scope', owner: 'machine', authority: 'grant', budget: { steps: 1 as const, deadline: 700_000, maxResultBytes: 65536, calls: 24, tokens: null },
        exitTest: 'result file', placement: 'local', transport: 'tmux', resultDestination: '/scope/work.json', openedAt: 100_000 };
      journal.append({ kind: 'session-work', record: edge, at: 100_000 });
      // The watcher keeps 1.x A2(b): an idle prompt is a wait, never a stall; only an unchanged
      // indeterminate frame (60 s) or an unchanged active frame (90 min) stalls.
      const activity = (at: number, kind: 'idle' | 'indeterminate') => [{ subject: worker.claim, incarnation: worker.incarnation, launch: worker.launch, at, progress: 'pane-hash', wait: null, activity: kind }];
      expect(workSilenceObservations(journal.view, 100_000, activity(100_000, 'idle'))[edge.id]).toMatchObject({ state: 'waiting' });
      const first = workSilenceObservations(journal.view, 100_000, activity(100_000, 'indeterminate'));
      expect(first[edge.id]).toMatchObject({ state: 'observing', lastProgressAt: 100_000 });
      const later = workSilenceObservations({ ...journal.view, sentinels: { ...(journal.view.sentinels ?? {}), work: first } } as never, 100_000 + WORK_SILENCE_MS, activity(100_000 + WORK_SILENCE_MS, 'indeterminate'));
      expect(later[edge.id]).toMatchObject({ state: 'stalled', lastProgressAt: 100_000, activity: 'indeterminate' });
      const sample = { ...base, activity: 'indeterminate' as const, at: 100_000 + WORK_SILENCE_MS };
      expect(registeredWorkStale(sample, later[edge.id], windows)).toMatchObject({ stale: { state: 'stalled', lastProgressAt: 100_000, windowMs: WORK_SILENCE_MS } });
      expect(registeredWorkStale(sample, { ...later[edge.id]!, activity: 'active' }, windows)!.stale!.windowMs).toBe(WORK_FROZEN_INDICATOR_MS);
      expect(registeredWorkStale(sample, first[edge.id], windows)).toEqual(sample);
      expect(registeredWorkStale(sample, undefined, windows)).toEqual(sample);
      expect(registeredWorkStale(null, later[edge.id], windows)).toBeNull();
      for (const state of ['protected', 'unknown'] as const) {
        const held = { ...sample, stale: { state, lastProgressAt: 1, windowMs: 1_800_000 } };
        expect(registeredWorkStale(held, later[edge.id], windows)).toEqual(held);
      }
      expect(registeredWorkStale(sample, { ...later[edge.id]!, lastProgressAt: sample.at + 1 }, windows)).toEqual(sample);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('the runner consumes the watcher only on the one-shot owner, with the watcher constants', () => {
    const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
    expect(source).toContain("observe: worker => registeredWorkStale(stallSample(workActivity.get(worker.claim), worker),");
    expect(source).toContain('{ silenceMs: WORK_SILENCE_MS, frozenActiveMs: WORK_FROZEN_INDICATOR_MS }');
    expect(source.match(/registeredWorkStale\(/gu)).toHaveLength(1);
  });
});
