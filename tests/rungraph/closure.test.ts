import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonical, decode } from '../../src/index.js';
import { closureRecordWire, decodeExhaustionRecord, decodeRun, decodeRunBudget,
  decodeRunExit, decodeRunStep, decodeRunTransition, decodeSessionGrounding, decodeUnreachableRunExit,
  recordFromWire, recordWire, runClosureFactSchemas } from '../../src/rungraph/index.js';
import { attemptedAvenue, avenueSetDecision, exhaustionFixture } from './closure-fixtures.js';
import { closingRun, json, ref, refused, setup, value } from './fixtures.js';

it('P5-SEAM-RC-A-F1-DECODERS P5-SEAM-RC-A-F7-CANCELLED-REFUSAL P5-NF-02 P5-NF-17 P5-NF-23 all new owner decoders are closed, versioned, and arm-exact', () => {
  const unreachable = exhaustionFixture();
  expect(value(decodeExhaustionRecord(unreachable.exhaustion, unreachable.context())).id).toBe('exhaustion:1');
  expect(value(decodeUnreachableRunExit(unreachable.exit, unreachable.context())).phase).toBe('proposal');
  const ground = value(unreachable.graph.ground(unreachable.id, 'w', 'h', 'start', unreachable.lease));
  const running = value(unreachable.graph.transition(unreachable.start(unreachable.ready, ground)));
  const stepFact = value(unreachable.store.read()).at(-1)!, didNotHappen = attemptedAvenue(unreachable, running);
  const tried = { ...unreachable.exhaustion, id: 'exhaustion:tried', expected: running.head,
    avenueSetDecisions: [avenueSetDecision(unreachable, ['avenue:tried'], 'decision:set:tried')],
    avenues: [{ id: 'avenue:tried', disposition: 'tried', evidence: [didNotHappen.trigger],
      step: { owner: 'part-five', name: 'RunStep', id: running.pending[0]!.id, fact: ref(stepFact) }, outcome: didNotHappen.outcome }] } as const;
  expect(value(decodeExhaustionRecord(tried, unreachable.context())).avenues[0]!.disposition).toBe('tried');
  const inapplicableDecision = value(decode('Decision', unreachable.decisionInput({ id: 'decision:inapplicable',
    conclusion: { subject: 'avenue:inapplicable', predicate: 'avenue-inapplicable', value: true, evidence: ['e1'] },
    reason: { subject: 'avenue:inapplicable', predicate: 'not-applicable', value: true, evidence: ['e1', 'e2'] },
  }), unreachable.ctx.decode));
  const inapplicableFact = unreachable.append('decision-record', json({ decision: inapplicableDecision }), unreachable.evidenceFacts.map(fact => fact.id)).fact;
  const inapplicableReference = { type: 'Decision' as const, id: inapplicableDecision.id, fact: ref(inapplicableFact), field: 'decision' as const };
  const inapplicable = { ...unreachable.exhaustion, id: 'exhaustion:inapplicable',
    avenueSetDecisions: [avenueSetDecision(unreachable, ['avenue:inapplicable'], 'decision:set:inapplicable')],
    avenues: [{ id: 'avenue:inapplicable', disposition: 'inapplicable', evidence: [ref(inapplicableFact)],
      decision: inapplicableReference }] } as const;
  expect(value(decodeExhaustionRecord(inapplicable, unreachable.context())).avenues[0]!.disposition).toBe('inapplicable');
  refused(decodeUnreachableRunExit({ ...unreachable.exit, result: unreachable.exit.standing }, unreachable.context()), 'unknown closure field');
  const completed = closingRun();
  const cancelledClaim = { ...completed.terminalExit, kind: 'cancelled' } as const;
  refused(decodeRunExit(cancelledClaim, completed.context()), 'unreachable/cancelled exit');
  refused(decodeExhaustionRecord({ ...unreachable.exhaustion, schemaVersion: 2 }, unreachable.context()), 'version');
});

it('P5-SEAM-RC-A-F2-OWNER-BOUNDARIES P5-NF-23 the A-prime records are admitted only through registered public Part Five owner boundaries', () => {
  const e = exhaustionFixture();
  const registration = value(runClosureFactSchemas(e.context()));
  expect(registration.registrations.map(row => row.name)).toEqual(expect.arrayContaining(['ExhaustionRecord', 'UnreachableRunExit']));
  expect(registration.schemas.map(row => row.kind)).toEqual(expect.arrayContaining(['run-exhaustion', 'run-unreachable-exit']));
  expect(e.admissions.has(e.exhaustionFact.id)).toBe(true);

  const bypass = { ...e.exhaustion, id: 'exhaustion:bypass' };
  const bypassFact = e.append('run-exhaustion', json({ run: e.id, record: closureRecordWire(bypass as never) })).fact;
  expect(e.admissions.has(bypassFact.id)).toBe(false);
  const exit = { ...e.exit, id: 'exit:bypass', exhaustion: { ...e.exit.exhaustion, id: bypass.id, fact: ref(bypassFact) } };
  refused(e.graph.recordUnreachableExit({ ...exit, id: 'propose:bypass' }, e.lease), 'not admitted by six');
});

it.each(['queue-full', 'quota-wall', 'safety-ceiling', 'open-breaker', 'elapsed-clock', 'capacity-applied-result'])
('P5-SEAM-RC-A-F3-INHIBITIONS-UNIT P5-SEAM-RC-R12-V04 P5-NF-16 P5-NF-17 P5-NF-24 %s is inhibition or capacity evidence, never a RunExit', basis => {
  const f = exhaustionFixture(), before = value(f.store.read()).length;
  if (basis === 'elapsed-clock') f.setClock(20_000);
  if (basis === 'capacity-applied-result') {
    const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value: 'deferred',
      capacity: { kind: 'applied', bound: 'bound', action: 'work' } }, f.ctx.decode));
    f.append('result-record', json({ result }));
  }
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: `exhaustion:${basis}`, basis }, f.lease), 'cannot construct exhaustion');
  expect(value(f.graph.read(f.id)).state).toBe('ready');
  refused(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }), 'terminal run exit absent');
  expect(value(f.store.read()).filter(fact => fact.kind === 'run-transition')).toHaveLength(0);
  expect(value(f.store.read()).length).toBeGreaterThanOrEqual(before);
});

it('P5-NF-17 optional no-execution closes only under the immutable exact test and current named evidence', () => {
  const f = closingRun();
  expect(f.ready.pending).toEqual([]);
  refused(f.graph.transition({ ...f.close, id: 'close:lowered', exit: { ...f.terminalExit,
    exitTest: { ...f.terminalExit.exitTest, acceptance: f.artifact } } }), 'exit test changed');
  const wrong = value(decode('Evidence', f.evidenceInput({ id: 'wrong-no-execution', claim: { subject: f.run.exitTest.subject,
    predicate: 'exit:another-check:v1', value: f.run.exitTest.acceptance }, freshFor: 1000 }), f.ctx.decode));
  const wrongFact = f.append('evidence-record', json({ evidence: wrong })).fact;
  refused(f.graph.transition({ ...f.close, id: 'close:wrong-evidence', exit: { ...f.terminalExit,
    check: ref(wrongFact), evidence: [{ type: 'Evidence', id: wrong.id, fact: ref(wrongFact), field: 'evidence' }] } }), 'exact exit check');
  expect(value(f.graph.transition(f.close)).state).toBe('completed');
});

it('P5-NF-02 every pre-existing Part Five value preserves its canonical bytes and legacy wire form', () => {
  const f = setup(), ready = value(f.graph.open(f.run));
  const groundingFact = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const groundingEnvelope = value(f.store.read()).find(fact => fact.id === groundingFact.id)!;
  const grounding = recordFromWire((groundingEnvelope.body as { record: never }).record);
  const start = f.start(ready, groundingFact), running = value(f.graph.transition(start));
  const completed = closingRun();
  const pairs = [
    [f.run, value(decodeRun(f.run, f.context()))],
    [f.run.budget, value(decodeRunBudget(f.run.budget, f.context()))],
    [start.step!, value(decodeRunStep(start.step!, f.context()))],
    [start, value(decodeRunTransition(start, f.context()))],
    [grounding, value(decodeSessionGrounding(grounding, f.context()))],
    [completed.terminalExit, value(decodeRunExit(completed.terminalExit, completed.context()))],
  ] as const;
  for (const [before, after] of pairs) expect(value(canonical(after)).bytes).toBe(value(canonical(before)).bytes);
  expect((value(f.store.read()).find(fact => fact.kind === 'run-opening')!.body as { record: unknown }).record).toEqual(recordWire(f.run as never));
  expect((value(f.store.read()).find(fact => fact.kind === 'run-transition')!.body as { record: unknown }).record).toEqual(recordWire(start as never));
  expect(running.state).toBe('running');
});

it('P5-NF-02 P5-NF-17 P5-NF-23 compile contract is part of the executable Part Five map', () => {
  const source = readFileSync('tests/rungraph/contracts.compile.ts', 'utf8');
  for (const name of ['CompletedRunExit', 'UnreachableRunExit', 'ExhaustionRecord'])
    expect(source).toContain(name);
  expect(source.match(/@ts-expect-error/g)).toHaveLength(4);
});
