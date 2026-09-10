import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { canonical } from '../../src/index.js';
import { closureRecordWire, createRunClosureGraph, decodeRunExit } from '../../src/rungraph/index.js';
import { closeUnreachable, continuityFixture, exhaustionFixture, pressureFixture } from './closure-fixtures.js';
import { completedRun, closingRun, json, ref, refused, value } from './fixtures.js';

const runReference = (id: string) => ({ owner: 'part-five', name: 'Run', id } as const);

it('P5-SEAM-RC-R13-V01 preserves completed exit reading through the required public port', () => {
  const f = completedRun();
  expect(value(f.graph.readExit(runReference(f.id)))).toEqual({ fact: ref(f.closeFact), exit: f.terminalExit });
});

it('P5-SEAM-RC-R13-V02 reads the original unreachable close through required readExit', () => {
  const f = closeUnreachable();
  expect(value(f.graph.readExit(runReference(f.id)))).toEqual({ fact: ref(f.closeFact), exit: f.terminalExit });
});

it('P5-SEAM-RC-R13-V03 folds a witnessed unreachable close to terminal unreachable', () => {
  const f = closeUnreachable();
  expect(value(f.graph.read(f.id)).state).toBe('unreachable');
});

it('P5-SEAM-RC-R13-V04 refuses new grounding and execution after unreachable closure', () => {
  const f = closeUnreachable();
  refused(f.graph.ground(f.id, 'w', 'h', 'start', f.lease), 'terminal/conflicted run');
  refused(f.graph.transition(f.start(value(f.graph.read(f.id)), f.closeFact)), 'terminal run');
});

it('P5-SEAM-RC-R13-V05 keeps the recorded exit readable when only the reader clock advances', () => {
  const f = closeUnreachable();
  const frontier = value(f.graph.read(f.id)).source.foldedThrough;
  const before = value(f.graph.readExit(runReference(f.id)));
  f.setClock(151);
  expect(value(f.graph.read(f.id)).source.foldedThrough).toEqual(frontier);
  expect(value(f.graph.readExit(runReference(f.id)))).toEqual(before);
});

for (const mode of ['missing', 'wrong-kind', 'wrong-id', 'unwitnessed', 'clauses', 'external-action',
  'recheck', 'pending-effect', 'bad-signature', 'incomplete-history'] as const) {
  it(`P5-SEAM-RC-R13-V06-${mode.toUpperCase()} refuses unsupported unreachable ${mode}`, () => {
    const f = exhaustionFixture();
    let exit: any = { ...f.exit };
    if (mode === 'missing') exit.exhaustion = { ...exit.exhaustion, fact: { ...exit.exhaustion.fact, id: 'missing' } };
    if (mode === 'wrong-kind') exit.exhaustion = { ...exit.exhaustion, fact: ref(f.opening) };
    if (mode === 'wrong-id') exit.exhaustion = { ...exit.exhaustion, id: 'wrong' };
    if (mode === 'unwitnessed') f.admissions.delete(f.exhaustionFact.id);
    if (mode === 'clauses') exit.unsatisfiedClauses = ['other'];
    if (mode === 'external-action') exit.externalDependency = { ...exit.externalDependency, action: 'other' };
    if (mode === 'recheck') exit.recheck = { ...exit.recheck, at: f.clock(2000) };
    if (mode === 'pending-effect') {
      const ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
      const running = value(f.graph.transition(f.start(f.ready, ground)));
      const record = { ...f.exhaustion, id: 'with-pending', expected: running.head };
      const fact = value(f.graph.recordExhaustion(record, f.lease));
      exit = { ...exit, expected: running.head, frontier: value(f.graph.read(f.id)).source.foldedThrough,
        exhaustion: { ...exit.exhaustion, id: record.id, fact: ref(fact) } };
    }
    if (mode === 'bad-signature') (f.wire[0] as any).body.owner.id = 'forged';
    if (mode === 'incomplete-history') f.wire.splice(0, 1);
    refused(f.graph.recordUnreachableExit(exit, f.lease));
  });
}

for (const mode of ['unknown', 'resolved', 'conflicted', 'unrelated'] as const) {
  it(`P5-SEAM-RC-R13-V07-${mode.toUpperCase()} re-resolves dependency status ${mode}`, () => {
    const f = exhaustionFixture();
    f.append('run-dependency-observation', json({ ...f.dependency.body as object,
      status: mode === 'unrelated' ? 'resolved' : mode, ...(mode === 'unrelated' ? { run: 'other-run' } : {}) }),
    [f.dependency.id]);
    const result = f.graph.recordUnreachableExit({ ...f.exit,
      frontier: value(f.graph.read(f.id)).source.foldedThrough }, f.lease);
    if (mode === 'unrelated') value(result); else refused(result);
  });
}

it('P5-SEAM-RC-R13-V08 retains honest partial exhaustion without terminal promotion', () => {
  const f = exhaustionFixture();
  const decision = value(decode('Decision', f.decisionInput({ id: 'partial',
    conclusion: { subject: f.id, predicate: 'exhaustion-conclusion', value: false, evidence: ['e1'] },
    reason: { subject: f.id, predicate: 'bounded-partial', value: true, evidence: ['e1', 'e2'] } }), f.ctx.decode));
  const decisionFact = f.append('decision-record', json({ decision }), f.evidenceFacts.map(fact => fact.id)).fact;
  const record = { ...f.exhaustion, id: 'partial-record',
    conclusion: { type: 'Decision' as const, id: decision.id, fact: ref(decisionFact), field: 'decision' as const } };
  const fact = value(f.graph.recordExhaustion(record, f.lease));
  refused(f.graph.recordUnreachableExit({ ...f.exit,
    exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(fact) } }, f.lease));
});

for (const mode of ['queue-full', 'quota-wall', 'safety-ceiling', 'open-breaker'] as const) {
  it(`P5-SEAM-RC-R13-V09-${mode.toUpperCase()} keeps ${mode} nonterminal`, () => {
    const f = pressureFixture(mode);
    value(f.graph.transition(f.transition));
    expect(value(f.graph.read(f.id)).state).toBe(mode === 'safety-ceiling' ? 'halted' : 'waiting');
    refused(f.graph.readExit(runReference(f.id)), 'terminal run exit absent');
  });
}

for (const mode of ['available-addressed', 'available-pending', 'unavailable-pending', 'unavailable-addressed',
  'wrong-grounding', 'wrong-digest', 'missing-result'] as const) {
  it(`P5-SEAM-RC-R13-V10-${mode.toUpperCase()} enforces continuity ${mode}`, () => {
    const f = continuityFixture();
    let record: any = { ...f.accounting };
    if (mode.includes('pending')) record.disposition = { kind: 'pending', work: ref(f.opening), reason: 'work remains open' };
    if (mode.startsWith('unavailable')) {
      Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
      record.prePauseCapture = { ...record.prePauseCapture, status: 'unavailable' };
    }
    if (mode === 'wrong-grounding') record.grounding = { ...record.grounding, fact: ref(f.opening) };
    if (mode === 'wrong-digest') record.firstReply = { ...record.firstReply, digest: `sha256:${'0'.repeat(64)}` };
    if (mode === 'missing-result') delete (record.disposition = { ...record.disposition }).result;
    const result = f.graph.recordContinuity(record, f.lease);
    if (['available-addressed', 'available-pending', 'unavailable-pending'].includes(mode)) value(result);
    else refused(result);
  });
}

it('P5-SEAM-RC-R13-V11 requires the effect-owner witness for continuity send', () => {
  const f = continuityFixture();
  const accounting = value(f.graph.recordContinuity(f.accounting, f.lease));
  const send = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accounting.id,
    ...f.accounting.firstReply, disclosure: f.disclosure.id, dispositionKind: 'addressed',
    disposition: f.addressedWork.id, status: 'admitted' }), [accounting.id, f.disclosure.id, f.addressedWork.id]).fact;
  const reference = { owner: 'part-five', name: 'ContinuityAccounting', id: f.accounting.id, fact: ref(accounting) } as const;
  refused(f.graph.verifyContinuitySend(reference, ref(send)));
  f.sendWitnesses.add(send.id);
  expect(value(f.graph.verifyContinuitySend(reference, ref(send)))).toEqual(ref(send));
});

it('P5-SEAM-RC-R13-V12 refuses a resource amount without matching signed budget evidence', () => {
  const f = exhaustionFixture();
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: 'fabricated-charge',
    resources: f.exhaustion.resources.map(resource => ({ ...resource, value: 999999 })) }, f.lease),
  'matching signed run-budget evidence');
});

it('P5-SEAM-RC-R13-V13 refuses an unrelated signed fact as the run standing reference', () => {
  const f = exhaustionFixture();
  refused(f.graph.recordUnreachableExit({ ...f.exit, standing: ref(f.constraint) }, f.lease),
    'current standing resolution');
});

it('P5-SEAM-RC-R13-V14 ignores an unrelated unwitnessed record when reading a witnessed exit', () => {
  const f = closeUnreachable();
  const original = value(f.graph.readExit(runReference(f.id)));
  const forged = { ...f.exhaustion, id: 'unwitnessed-side-record' };
  f.append('run-exhaustion', json({ run: f.id, record: closureRecordWire(forged as never) }));
  expect(value(f.graph.readExit(runReference(f.id)))).toEqual(original);
});

it('P5-SEAM-RC-R13-V17 accepts refreshed blocked evidence without reauthorizing the old investigation', () => {
  const f = exhaustionFixture();
  const latest = f.append('run-dependency-observation', json({ ...f.dependency.body as object }), [f.dependency.id]).fact;
  value(f.graph.recordExhaustion({ ...f.exhaustion, id: 'refreshed', dependencies: [ref(latest)] }, f.lease));
});

it('P5-SEAM-RC-R13-V15 preserves cancelled legacy required-field refusal bytes', () => {
  const f = closingRun();
  const record: any = { ...f.terminalExit, kind: 'cancelled' };
  delete record.exitTest;
  const result = decodeRunExit(record, f.context());
  expect(result.kind).toBe('Refused');
  if (result.kind === 'Refused') expect(result.detail).toBe('missing required field exitTest');
});

it('P5-SEAM-RC-R13-V16 rebuilds identical exit bytes from equal signed history', () => {
  const f = closeUnreachable();
  const first = value(f.graph.readExit(runReference(f.id)));
  const second = value(value(createRunClosureGraph(f.deps)).readExit(runReference(f.id)));
  expect(value(canonical(first)).bytes).toBe(value(canonical(second)).bytes);
});
