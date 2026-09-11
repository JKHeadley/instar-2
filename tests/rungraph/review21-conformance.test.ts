import { expect, it } from 'vitest';
import { closureRecordWire } from '../../src/rungraph/index.js';
import { exhaustionFixture } from './closure-fixtures.js';
import { json, ref, value } from './fixtures.js';

function appendExhaustion(
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

function stop(f: ReturnType<typeof exhaustionFixture>, id: string) {
  return value(f.graph.transition({
    type: 'RunTransition',
    schemaVersion: 1,
    id,
    run: f.id,
    expected: f.ready.head,
    trigger: ref(f.opening),
    kind: 'stop',
    from: 'ready',
    to: 'halted',
    responsible: f.owner,
    standing: ref(f.opening),
    ownership: f.lease,
    generation: f.run.generation,
    at: f.now,
    blockedOn: {
      kind: 'stop',
      reference: 'operator-stop',
      owner: f.owner,
      nextObservation: f.clock(1000),
    },
    nextWake: f.run.nextWake,
  }));
}

it('P5-SEAM-RC-R21-V44-UNIT P5-SEAM-RC-R21-V45-UNIT P5-NF-17 P5-NF-23 revalidates the exhaustion predecessor at its signed origin', () => {
  const unsupported = exhaustionFixture();
  const bad = { ...unsupported.exhaustion, id: 'review21:missing-predecessor', expected: 'missing-head' };
  expect(unsupported.graph.recordExhaustion(bad, unsupported.lease)).toMatchObject({ kind: 'Refused' });
  const badFact = appendExhaustion(unsupported, bad);
  expect(unsupported.graph.recordUnreachableExit({
    ...unsupported.exit,
    exhaustion: { ...unsupported.exit.exhaustion, id: bad.id, fact: ref(badFact) },
    frontier: value(unsupported.graph.read(unsupported.id)).source.foldedThrough,
  }, unsupported.lease)).toMatchObject({ kind: 'Refused' });

  const supported = exhaustionFixture();
  const good = { ...supported.exhaustion, id: 'review21:valid-predecessor' };
  const goodFact = value(supported.graph.recordExhaustion(good, supported.lease));
  expect(supported.graph.recordUnreachableExit({
    ...supported.exit,
    exhaustion: { ...supported.exit.exhaustion, id: good.id, fact: ref(goodFact) },
    frontier: value(supported.graph.read(supported.id)).source.foldedThrough,
  }, supported.lease)).toMatchObject({ kind: 'Success' });
});

it('P5-SEAM-RC-R21-V49-UNIT P5-SEAM-RC-R21-V50-UNIT P5-NF-17 P5-NF-23 revalidates the exhaustion clock against its signed origin', () => {
  const unsupported = exhaustionFixture();
  const future = { ...unsupported.exhaustion, id: 'review21:future-clock', at: unsupported.clock(200) };
  expect(unsupported.graph.recordExhaustion(future, unsupported.lease)).toMatchObject({ kind: 'Refused' });
  const futureFact = appendExhaustion(unsupported, future);
  expect(unsupported.graph.recordUnreachableExit({
    ...unsupported.exit,
    exhaustion: { ...unsupported.exit.exhaustion, id: future.id, fact: ref(futureFact) },
    frontier: value(unsupported.graph.read(unsupported.id)).source.foldedThrough,
  }, unsupported.lease)).toMatchObject({ kind: 'Refused' });

  const supported = exhaustionFixture();
  const current = { ...supported.exhaustion, id: 'review21:current-clock', at: supported.clock(100) };
  const currentFact = value(supported.graph.recordExhaustion(current, supported.lease));
  expect(supported.graph.recordUnreachableExit({
    ...supported.exit,
    exhaustion: { ...supported.exit.exhaustion, id: current.id, fact: ref(currentFact) },
    frontier: value(supported.graph.read(supported.id)).source.foldedThrough,
  }, supported.lease)).toMatchObject({ kind: 'Success' });
});

it('P5-SEAM-RC-R21-V51-UNIT P5-SEAM-RC-R21-V52-UNIT P5-NF-17 P5-NF-23 revalidates an exhaustion recorded after the run head changed', () => {
  const unsupported = exhaustionFixture();
  const unsupportedHalted = stop(unsupported, 'review21:unsupported-stop');
  const stale = { ...unsupported.exhaustion, id: 'review21:stale-after-stop' };
  expect(unsupported.graph.recordExhaustion(stale, unsupported.lease)).toMatchObject({ kind: 'Refused' });
  const staleFact = appendExhaustion(unsupported, stale);
  expect(unsupported.graph.recordUnreachableExit({
    ...unsupported.exit,
    expected: unsupportedHalted.head,
    exhaustion: { ...unsupported.exit.exhaustion, id: stale.id, fact: ref(staleFact) },
    frontier: value(unsupported.graph.read(unsupported.id)).source.foldedThrough,
  }, unsupported.lease)).toMatchObject({ kind: 'Refused' });

  const supported = exhaustionFixture();
  const supportedHalted = stop(supported, 'review21:supported-stop');
  const current = { ...supported.exhaustion, id: 'review21:current-after-stop', expected: supportedHalted.head };
  const currentFact = value(supported.graph.recordExhaustion(current, supported.lease));
  expect(supported.graph.recordUnreachableExit({
    ...supported.exit,
    expected: supportedHalted.head,
    exhaustion: { ...supported.exit.exhaustion, id: current.id, fact: ref(currentFact) },
    frontier: value(supported.graph.read(supported.id)).source.foldedThrough,
  }, supported.lease)).toMatchObject({ kind: 'Success' });
});

it('P5-SEAM-RC-R21-V73-UNIT P5-NF-17 P5-NF-23 accepts a causal equal copy after the head changes when its original admission remains valid', () => {
  const f = exhaustionFixture();
  const halted = stop(f, 'review21:equal-copy-stop');
  const copy = appendExhaustion(f, f.exhaustion);

  expect(f.graph.recordUnreachableExit({
    ...f.exit,
    expected: halted.head,
    exhaustion: { ...f.exit.exhaustion, fact: ref(copy) },
    frontier: value(f.graph.read(f.id)).source.foldedThrough,
  }, f.lease)).toMatchObject({ kind: 'Success' });
});
