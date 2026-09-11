import { expect, it } from 'vitest';
import { closureRecordWire, createRunClosureGraph } from '../../src/rungraph/index.js';
import { exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, refused, value } from '../rungraph/fixtures.js';

function appendWitnessed(
  f: ReturnType<typeof exhaustionFixture>,
  record: Readonly<Record<string, unknown>>,
) {
  const fact = f.append('run-unreachable-exit', json({
    run: f.id,
    record: closureRecordWire(record as never),
  })).fact;
  f.admissions.add(fact.id);
  return fact;
}

it.each(['expected', 'frontier', 'future-clock', 'stale-clock'] as const)(
  'P5-SEAM-RC-A-PRIME-F1-INTEGRATION P5-NF-17 P5-NF-23 reconstructed Part Five refuses signed proposal history with inconsistent %s admission data',
  mode => {
    const f = exhaustionFixture();
    const bad = {
      ...f.exit,
      id: `review22:integration-proposal:${mode}`,
      ...(mode === 'expected' ? { expected: 'missing-head' } : {}),
      ...(mode === 'frontier' ? { frontier: {} } : {}),
      ...(mode === 'future-clock' ? { at: f.clock(200) } : {}),
      ...(mode === 'stale-clock' ? { at: f.clock(0) } : {}),
    };
    appendWitnessed(f, bad);

    const rebuilt = value(createRunClosureGraph(f.deps));
    expect(value(rebuilt.read(f.id)).state).toBe('ready');
    expect(rebuilt.recordUnreachableExit(bad, f.lease)).toMatchObject({ kind: 'Refused' });
  },
);

it.each(['frontier', 'future-clock', 'stale-clock'] as const)(
  'P5-SEAM-RC-A-PRIME-F1-INTEGRATION P5-NF-17 P5-NF-23 reconstructed Part Five refuses signed close history with inconsistent %s admission data',
  mode => {
    const f = exhaustionFixture();
    const proposal = value(f.graph.recordUnreachableExit(f.exit, f.lease));
    const closing = value(f.graph.read(f.id));
    const bad = {
      ...f.exit,
      id: `review22:integration-close:${mode}`,
      expected: f.exit.id,
      phase: 'close' as const,
      frontier: mode === 'frontier' ? {} : closing.source.foldedThrough,
      at: mode === 'future-clock' ? f.clock(200) : mode === 'stale-clock' ? f.clock(0) : f.exit.at,
      proposal: {
        owner: 'part-five' as const,
        name: 'UnreachableRunExit' as const,
        id: f.exit.id,
        fact: ref(proposal),
      },
    };
    appendWitnessed(f, bad);

    const rebuilt = value(createRunClosureGraph(f.deps));
    expect(value(rebuilt.read(f.id)).state).toBe('closing');
    expect(rebuilt.recordUnreachableExit(bad, f.lease)).toMatchObject({ kind: 'Refused' });
  },
);

it('P5-SEAM-RC-A-PRIME-F2-INTEGRATION P5-NF-23 Part Two refuses signed excluded A2 records and Part Five returns the typed slice refusal', () => {
  const f = exhaustionFixture();
  const before = value(f.store.read()).length;
  const unsupported = {
    ...f.exhaustion,
    id: 'review22:integration-grounding',
    grounding: ref(f.opening),
  };

  expect(() => f.append('run-exhaustion', json({
    run: f.id,
    record: closureRecordWire(unsupported as never),
  }))).toThrow('unknown field');
  expect(value(f.store.read())).toHaveLength(before);

  const rebuilt = value(createRunClosureGraph(f.deps));
  expect(refused(rebuilt.recordExhaustion(unsupported, f.lease))).toBe('unsupported-in-slice-a-prime');
  expect(value(f.store.read())).toHaveLength(before);
});
