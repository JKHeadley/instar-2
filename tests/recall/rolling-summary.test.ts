import { expect, it } from 'vitest';
import { produceRollingSummary, type RollingSummaryPorts, type SummaryAuditEvent,
  type SummarySource } from '../../src/recall/rolling-summary.js';

function fixture() {
  const log: string[] = [], events: SummaryAuditEvent[] = [], failures: unknown[] = [];
  let source: SummarySource = { revision: 'r1', target: 'm1', covers: ['m1', 'm1:reply'] };
  let stopped = false, calls = 0, budget = 4;
  const ports: RollingSummaryPorts<string, string> = {
    source: () => source,
    guard: () => { if (stopped) throw Error('stopped'); },
    reserve: () => { if (calls >= budget) throw Error('spend cap'); calls++; log.push('reserve'); },
    write: async () => { log.push('write'); return 'The date remains uncertain.'; },
    prepare: output => ({ kind: 'candidate', candidate: { value: output,
      packet: JSON.stringify({ history: [{ user: 'The date remains uncertain.', answer: '' }] }),
      textWithItems: output, memory: [], evidence: 'whole source', supervisedState: 'whole candidate' } }),
    record: event => { events.push(event); if (event.kind.endsWith('-reserve')) {
      if (calls >= budget) throw Error('spend cap'); calls++;
    } },
    reject: failure => { failures.push(failure); },
    commit: (text, faithfulness, covers) => {
      log.push('commit'); expect(text).toBe('The date remains uncertain.');
      expect(faithfulness.verdict).toBe('pass'); expect(covers).toEqual(['m1', 'm1:reply']);
    },
    evidenceFits: () => true, canReview: () => calls < budget
  };
  return { ports, log, events, failures, mutate: () => { source = { ...source, revision: 'r2' }; },
    stop: () => { stopped = true; }, cap: (value: number) => { budget = value; },
    source: (value: SummarySource) => { source = value; } };
}
const faithful = (score: number) => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: score } } });
const integrity = (score: number) => ({ value: { model: 'jev-1.13.0', answers: { summary_integrity: { type: 'noul', noul: score } } }, latencyMs: 1 });
function ambiguous(f: ReturnType<typeof fixture>) {
  const prepare = f.ports.prepare;
  f.ports.prepare = output => {
    const result = prepare(output);
    if (result.kind === 'candidate') result.candidate.packet = JSON.stringify({ history: [{ user: 'The day is not yet known.' }] });
    return result;
  };
}

it('accepts faithful uncertainty and exact coverage in one bounded invocation', async () => {
  const f = fixture();
  expect(await produceRollingSummary(1, f.ports)).toBe('accepted');
  expect(f.log).toEqual(['reserve', 'write', 'commit']);
});
it.each([{ covers: [] }, { covers: ['m1', 'm1'] }, { covers: ['different'] }])('refuses malformed coverage $covers before paying the writer', async ({ covers }) => {
  const f = fixture(); f.source({ revision: 'r1', target: 'm1', covers });
  expect(await produceRollingSummary(1, f.ports)).toBe('refused');
  expect(f.log).toEqual(['reserve']); expect(f.failures).toMatchObject([{ structural: true }]);
});
it.each(['writer', 'faithfulness', 'integrity', 'review'] as const)('refuses stale source after %s', async stage => {
  const f = fixture();
  if (stage === 'writer') f.ports.write = async () => { f.mutate(); return 'The date remains uncertain.'; };
  if (stage === 'faithfulness' || stage === 'review') {
    ambiguous(f); f.ports.faithfulness = async () => { if (stage === 'faithfulness') f.mutate(); return faithful(0.5); };
  }
  f.ports.supervisor = { elapsedMs: () => 0,
    jev: async () => { if (stage === 'integrity') f.mutate(); return integrity(0.01); },
    review: async () => { if (stage === 'review') f.mutate(); return { verdict: 'pass', path: 'subscription', latencyMs: 1 }; } };
  expect(await produceRollingSummary(1, f.ports)).toBe('refused');
  expect(f.log).not.toContain('commit'); expect(f.failures).toMatchObject([{ stale: true }]);
});
it.each(['writer', 'faithfulness', 'integrity', 'review'] as const)('honors stop after %s without another call or commit', async stage => {
  const f = fixture();
  if (stage === 'writer') f.ports.write = async () => { f.stop(); return 'The date remains uncertain.'; };
  if (stage === 'faithfulness' || stage === 'review') {
    ambiguous(f); f.ports.faithfulness = async () => { if (stage === 'faithfulness') f.stop(); return faithful(0.5); };
  }
  f.ports.supervisor = { elapsedMs: () => 0,
    jev: async () => { if (stage === 'integrity') f.stop(); return integrity(0.01); },
    review: async () => { if (stage === 'review') f.stop(); return { verdict: 'pass', path: 'subscription', latencyMs: 1 }; } };
  if (stage === 'faithfulness') expect(await produceRollingSummary(1, f.ports)).toBe('refused');
  else await expect(produceRollingSummary(1, f.ports)).rejects.toThrow('stopped');
  expect(f.log).not.toContain('commit');
  expect(f.failures).toHaveLength(stage === 'faithfulness' ? 1 : 0);
});
it('preserves UNKNOWN writer and review reservations, without a retry or acceptance', async () => {
  const f = fixture(); f.ports.write = async () => { throw Error('connection lost'); };
  expect(await produceRollingSummary(1, f.ports)).toBe('unknown'); expect(f.failures).toEqual([]);
  const g = fixture(); ambiguous(g); g.ports.faithfulness = async () => faithful(0.5);
  g.ports.supervisor = { elapsedMs: () => 0, jev: async () => integrity(0.5), review: async () => { throw Error('unknown'); } };
  expect(await produceRollingSummary(1, g.ports)).toBe('unknown'); expect(g.failures).toEqual([]);
  expect(g.events.filter(e => e.kind === 'summary-review-reserve')).toHaveLength(1);
});
it('refuses stop and spend exhaustion before writer dispatch', async () => {
  const f = fixture(); f.stop(); await expect(produceRollingSummary(1, f.ports)).rejects.toThrow('stopped'); expect(f.log).toEqual([]);
  const g = fixture(); g.cap(0); await expect(produceRollingSummary(1, g.ports)).rejects.toThrow('spend cap'); expect(g.log).toEqual([]);
});
it.each([0.01, 0.5, 0.99])('keeps pass, undecided escalation and confident loss distinct (%s)', async score => {
  const f = fixture(); ambiguous(f); f.ports.faithfulness = async () => faithful(score);
  f.ports.supervisor = { elapsedMs: () => 0, jev: async () => integrity(0.01),
    review: async () => ({ verdict: 'pass', path: 'subscription', latencyMs: 1 }) };
  expect(await produceRollingSummary(1, f.ports)).toBe(score === 0.99 ? 'refused' : 'accepted');
  expect(f.events.filter(e => e.kind === 'summary-review-reserve')).toHaveLength(score === 0.5 ? 1 : 0);
});
it('does not escalate beyond the paid-call cap', async () => {
  const f = fixture(); ambiguous(f); f.cap(2); f.ports.faithfulness = async () => faithful(0.5);
  f.ports.supervisor = { elapsedMs: () => 0, jev: async () => integrity(0.01), review: async () => { throw Error('must not dispatch'); } };
  expect(await produceRollingSummary(1, f.ports)).toBe('refused');
  expect(f.events.some(e => e.kind === 'summary-review-reserve')).toBe(false);
});
it('escalates unavailable faithfulness, but preserves unavailable integrity as a refusal', async () => {
  const f = fixture(); ambiguous(f); f.ports.faithfulness = async () => { throw Error('offline'); };
  f.ports.supervisor = { elapsedMs: () => 0, jev: async () => integrity(0.01),
    review: async () => ({ verdict: 'pass', path: 'subscription', latencyMs: 1 }) };
  expect(await produceRollingSummary(1, f.ports)).toBe('accepted');
  const g = fixture(); g.ports.supervisor = { elapsedMs: () => 0, jev: async () => { throw Error('offline'); } };
  expect(await produceRollingSummary(1, g.ports)).toBe('refused');
});

it.each(['faithfulness', 'review'] as const)('keeps UNKNOWN %s charged even when its source changed', async stage => {
  const f = fixture(); ambiguous(f);
  f.ports.faithfulness = async () => {
    if (stage === 'faithfulness') { f.mutate(); throw Error('unknown'); }
    return faithful(0.5);
  };
  f.ports.supervisor = { elapsedMs: () => 0, jev: async () => integrity(0.5),
    review: async () => { f.mutate(); throw Error('unknown'); } };
  expect(await produceRollingSummary(1, f.ports)).toBe('unknown');
  expect(f.failures).toEqual([]); expect(f.log).not.toContain('commit');
});
it.each(['history', 'supervision'])('refuses missing candidate %s coverage without committing', async missing => {
  const f = fixture(), prepare = f.ports.prepare;
  f.ports.prepare = output => {
    const result = prepare(output);
    if (result.kind === 'candidate') {
      if (missing === 'history') result.candidate.packet = '{}';
      else delete result.candidate.supervisedState;
    }
    return result;
  };
  f.ports.supervisor = { elapsedMs: () => 0, jev: async () => { throw Error('must not dispatch'); } };
  expect(await produceRollingSummary(1, f.ports)).toBe('refused');
  expect(f.failures).toMatchObject([{ structural: true }]); expect(f.log).not.toContain('commit');
});
