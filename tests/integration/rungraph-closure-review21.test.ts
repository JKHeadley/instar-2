import { expect, it } from 'vitest';
import { closureRecordWire, createRunClosureGraph } from '../../src/rungraph/index.js';
import { exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

function appendRawExhaustion(
  f: ReturnType<typeof exhaustionFixture>,
  record: Readonly<Record<string, unknown>>,
) {
  const fact = f.append('run-exhaustion', json({
    run: f.id,
    record: closureRecordWire(record as never),
  })).fact;
  f.admissions.add(fact.id);
  return fact;
}

it('P5-SEAM-RC-R21-V44-INTEGRATION P5-SEAM-RC-R21-V50-INTEGRATION P5-SEAM-RC-R21-V51-INTEGRATION P5-NF-17 P5-NF-23 refuses signed exhaustion histories that could not have passed their original admission', () => {
  for (const mode of ['missing-predecessor', 'future-clock', 'stale-after-stop'] as const) {
    const f = exhaustionFixture();
    let head = f.ready.head;
    if (mode === 'stale-after-stop') {
      head = value(f.graph.transition({
        type: 'RunTransition', schemaVersion: 1, id: `review21:integration-stop:${mode}`,
        run: f.id, expected: f.ready.head, trigger: ref(f.opening), kind: 'stop', from: 'ready', to: 'halted',
        responsible: f.owner, standing: ref(f.opening), ownership: f.lease, generation: f.run.generation, at: f.now,
        blockedOn: { kind: 'stop', reference: 'operator-stop', owner: f.owner,
          nextObservation: f.clock(1000) }, nextWake: f.run.nextWake,
      })).head;
    }
    const record = {
      ...f.exhaustion,
      id: `review21:integration:${mode}`,
      ...(mode === 'missing-predecessor' ? { expected: 'missing-head' } : {}),
      ...(mode === 'future-clock' ? { at: f.clock(200) } : {}),
    };
    const fact = appendRawExhaustion(f, record);
    const rebuilt = value(createRunClosureGraph(f.deps));
    const proposal = {
      ...f.exit,
      expected: head,
      exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(fact) },
      frontier: value(rebuilt.read(f.id)).source.foldedThrough,
    };

    expect(rebuilt.recordUnreachableExit(proposal, f.lease)).toMatchObject({ kind: 'Refused' });
    expect(value(rebuilt.read(f.id)).state).toBe(mode === 'stale-after-stop' ? 'halted' : 'ready');
  }
});

it('P5-SEAM-RC-R21-V73-INTEGRATION P5-NF-17 P5-NF-23 collapses an equal causal copy to its supported original admission during rebuild', () => {
  const f = exhaustionFixture();
  const halted = value(f.graph.transition({
    type: 'RunTransition', schemaVersion: 1, id: 'review21:integration-equal-stop',
    run: f.id, expected: f.ready.head, trigger: ref(f.opening), kind: 'stop', from: 'ready', to: 'halted',
    responsible: f.owner, standing: ref(f.opening), ownership: f.lease, generation: f.run.generation, at: f.now,
    blockedOn: { kind: 'stop', reference: 'operator-stop', owner: f.owner,
      nextObservation: f.clock(1000) }, nextWake: f.run.nextWake,
  }));
  const copy = appendRawExhaustion(f, f.exhaustion);
  const rebuilt = value(createRunClosureGraph(f.deps));

  expect(rebuilt.recordUnreachableExit({
    ...f.exit,
    expected: halted.head,
    exhaustion: { ...f.exit.exhaustion, fact: ref(copy) },
    frontier: value(rebuilt.read(f.id)).source.foldedThrough,
  }, f.lease)).toMatchObject({ kind: 'Success' });
});
