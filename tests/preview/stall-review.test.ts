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
  expect(JSON.parse(preparedContext)).toEqual({ originalPrompt: 'Full admitted prompt', evidence, terminal: 'Current pane bytes' });
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
