import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { closureRecordWire } from '../../src/rungraph/index.js';
import { closeUnreachable, exhaustionFixture } from './closure-fixtures.js';
import { json, ref, refused, value } from './fixtures.js';

function appendWitnessed(
  f: ReturnType<typeof exhaustionFixture>,
  record: Readonly<Record<string, unknown>>,
  envelopeRun = f.id,
) {
  const fact = f.append('run-unreachable-exit', json({
    run: envelopeRun,
    record: closureRecordWire(record as never),
  })).fact;
  f.admissions.add(fact.id);
  return fact;
}

it.each(['expected', 'frontier', 'run', 'future-clock', 'stale-clock'] as const)(
  'P5-SEAM-RC-A-PRIME-F1-UNIT P5-NF-17 P5-NF-23 refuses a witnessed unreachable proposal with inconsistent %s admission history',
  mode => {
    const f = exhaustionFixture();
    const bad = {
      ...f.exit,
      id: `review22:bad-proposal:${mode}`,
      ...(mode === 'expected' ? { expected: 'missing-head' } : {}),
      ...(mode === 'frontier' ? { frontier: {} } : {}),
      ...(mode === 'run' ? { run: 'another-run' } : {}),
      ...(mode === 'future-clock' ? { at: f.clock(200) } : {}),
      ...(mode === 'stale-clock' ? { at: f.clock(0) } : {}),
    };

    expect(f.graph.recordUnreachableExit(bad, f.lease)).toMatchObject({ kind: 'Refused' });
    if (mode === 'run') {
      expect(() => appendWitnessed(f, bad, 'another-run')).toThrow();
      expect(value(f.graph.read(f.id)).state).toBe('ready');
      return;
    }
    appendWitnessed(f, bad);
    expect(f.graph.recordUnreachableExit(bad, f.lease)).toMatchObject({ kind: 'Refused' });
    expect(value(f.graph.read(f.id)).state).toBe('ready');
  },
);

it.each(['frontier', 'future-clock', 'stale-clock'] as const)(
  'P5-SEAM-RC-A-PRIME-F1-UNIT P5-NF-17 P5-NF-23 refuses a witnessed unreachable close with inconsistent %s admission history',
  mode => {
    const f = exhaustionFixture();
    const proposal = value(f.graph.recordUnreachableExit(f.exit, f.lease));
    const closing = value(f.graph.read(f.id));
    const base = {
      ...f.exit,
      id: `review22:bad-close:${mode}`,
      expected: f.exit.id,
      phase: 'close' as const,
      frontier: closing.source.foldedThrough,
      proposal: {
        owner: 'part-five' as const,
        name: 'UnreachableRunExit' as const,
        id: f.exit.id,
        fact: ref(proposal),
      },
    };
    const bad = {
      ...base,
      ...(mode === 'frontier' ? { frontier: {} } : {}),
      ...(mode === 'future-clock' ? { at: f.clock(200) } : {}),
      ...(mode === 'stale-clock' ? { at: f.clock(0) } : {}),
    };

    expect(f.graph.recordUnreachableExit(bad, f.lease)).toMatchObject({ kind: 'Refused' });
    appendWitnessed(f, bad);
    expect(f.graph.recordUnreachableExit(bad, f.lease)).toMatchObject({ kind: 'Refused' });
    expect(value(f.graph.read(f.id)).state).toBe('closing');
  },
);

it('P5-SEAM-RC-A-PRIME-F1-UNIT P5-NF-17 preserves valid historical proposal and close retries', () => {
  const f = closeUnreachable();
  const proposal = value(f.store.read()).find(fact =>
    fact.kind === 'run-unreachable-exit' && fact.id !== f.closeFact.id)!;

  expect(value(f.graph.recordUnreachableExit(f.exit, f.lease))).toEqual(proposal);
  expect(value(f.graph.recordUnreachableExit(f.terminalExit, f.lease))).toEqual(f.closeFact);
});

it('P5-SEAM-RC-A-PRIME-F2-UNIT P5-NF-23 refuses every excluded A2 shape without storing it', () => {
  const f = exhaustionFixture();
  const before = value(f.store.read()).length;
  const unsupported = [
    { ...f.exhaustion, id: 'review22:grounding', grounding: ref(f.opening) },
    { ...f.exhaustion, id: 'review22:continuity', type: 'ContinuityAccounting' },
    { ...f.exhaustion, id: 'review22:send', continuitySend: ref(f.opening) },
  ];
  for (const input of unsupported) {
    expect(refused(f.graph.recordExhaustion(input, f.lease))).toBe('unsupported-in-slice-a-prime');
  }
  expect(refused(f.graph.recordUnreachableExit({
    ...f.exit,
    id: 'review22:pending',
    disposition: { kind: 'pending', work: ref(f.opening) },
  }, f.lease))).toBe('unsupported-in-slice-a-prime');
  expect(value(f.store.read())).toHaveLength(before);
});

it('P5-SEAM-RC-A-PRIME-F2-UNIT exposes no A2 owner record, decoder, operation, or declaration', () => {
  const publicSurface = [
    readFileSync('src/rungraph/index.ts', 'utf8'),
    readFileSync('src/rungraph/closure-types.ts', 'utf8'),
    readFileSync('src/rungraph/closure.ts', 'utf8'),
    readFileSync('src/rungraph/closure.declarations.json', 'utf8'),
  ].join('\n');
  for (const forbidden of [
    'ContinuityAccounting', 'recordContinuity', 'verifyContinuitySend',
    'decodeContinuityAccounting', 'continuityAdmission',
  ]) expect(publicSurface).not.toContain(forbidden);
});

it.skip('P5-NF-46 SKIPPED: out of slice scope — continuity accounting belongs to slice A2', () => {});
