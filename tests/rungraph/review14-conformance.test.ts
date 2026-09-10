import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import {
  createRunClosureGraph, decodeContinuityAccounting, decodeRun, decodeRunBudget, decodeRunExit,
  decodeRunStep, decodeRunTransition, decodeSessionGrounding, recordFromWire,
} from '../../src/rungraph/index.js';
import {
  closeUnreachable, continuityFixture, exhaustionFixture, pressureFixture,
} from './closure-fixtures.js';
import { closingRun, completedRun, digest, json, ref, setup, value } from './fixtures.js';

it('P5-SEAM-RC-R14-V01 accepts the original witnessed unreachable exit on rebuild', () => {
  const f = closeUnreachable();
  const run = { owner: 'part-five', name: 'Run', id: f.id } as const;
  expect(value(value(createRunClosureGraph(f.deps)).readExit(run))).toEqual({ fact: ref(f.closeFact), exit: f.terminalExit });
});

for (const mode of ['missing', 'wrong-kind', 'wrong-id', 'unwitnessed', 'clauses', 'dependency',
  'recheck', 'manifest', 'signature', 'incomplete'] as const) {
  it(`P5-SEAM-RC-R14-V02-${mode.toUpperCase()} refuses an unsupported unreachable proposal`, () => {
    const f = exhaustionFixture();
    let exit: any = { ...f.exit };
    if (mode === 'missing') exit.exhaustion = { ...exit.exhaustion, fact: { ...exit.exhaustion.fact, id: 'absent' } };
    if (mode === 'wrong-kind') exit.exhaustion = { ...exit.exhaustion, fact: ref(f.opening) };
    if (mode === 'wrong-id') exit.exhaustion = { ...exit.exhaustion, id: 'other' };
    if (mode === 'unwitnessed') f.admissions.delete(f.exhaustionFact.id);
    if (mode === 'clauses') exit.unsatisfiedClauses = ['other'];
    if (mode === 'dependency') exit.externalDependency = { ...exit.externalDependency, action: 'other' };
    if (mode === 'recheck') exit.recheck = { ...exit.recheck, owner: { ...exit.recheck.owner, id: 'other' } };
    if (mode === 'manifest') exit.settledOperations = ['unrecorded'];
    if (mode === 'signature') (f.wire[0] as any).body.owner.id = 'forged';
    if (mode === 'incomplete') f.wire.splice(0, 1);
    expect(f.graph.recordUnreachableExit(exit, f.lease).kind).toBe('Refused');
  });
}

for (const status of ['unknown', 'resolved', 'conflicted', 'unrelated'] as const) {
  it(`P5-SEAM-RC-R14-V03-${status.toUpperCase()} re-resolves current dependency status`, () => {
    const f = exhaustionFixture();
    f.append('run-dependency-observation', json({ ...f.dependency.body as object, status,
      ...(status === 'unrelated' ? { run: 'other' } : {}) }), [f.dependency.id]);
    const result = f.graph.recordUnreachableExit({ ...f.exit,
      frontier: value(f.graph.read(f.id)).source.foldedThrough }, f.lease);
    expect(result.kind).toBe(status === 'unrelated' ? 'Success' : 'Refused');
  });
}

it('P5-SEAM-RC-R14-V04 accepts honest partial exhaustion but refuses its promotion', () => {
  const f = exhaustionFixture();
  const decision = value(decode('Decision', f.decisionInput({ id: 'review14:partial',
    conclusion: { subject: f.id, predicate: 'exhaustion-conclusion', value: false, evidence: ['e1'] },
    reason: { subject: f.id, predicate: 'partial', value: true, evidence: ['e1', 'e2'] } }), f.ctx.decode));
  const witness = f.append('decision-record', json({ decision }), f.evidenceFacts.map(fact => fact.id)).fact;
  const record = { ...f.exhaustion, id: 'review14:partial-record',
    conclusion: { type: 'Decision' as const, id: decision.id, fact: ref(witness), field: 'decision' as const } };
  const fact = value(f.graph.recordExhaustion(record, f.lease));
  expect(f.graph.recordUnreachableExit({ ...f.exit,
    exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(fact) },
    frontier: value(f.graph.read(f.id)).source.foldedThrough }, f.lease).kind).toBe('Refused');
});

for (const pressure of ['queue-full', 'quota-wall', 'safety-ceiling', 'open-breaker'] as const) {
  it(`P5-SEAM-RC-R14-V05-${pressure.toUpperCase()} retains an inhibited run without an exit`, () => {
    const f = pressureFixture(pressure);
    value(f.graph.transition(f.transition));
    expect(value(f.graph.read(f.id)).state).toBe(pressure === 'safety-ceiling' ? 'halted' : 'waiting');
    expect(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }).kind).toBe('Refused');
  });
}

function sendFixture(pending = false) {
  const f = continuityFixture();
  const work = pending
    ? f.append('continuity-pending-work', json({ run: f.id, inbound: f.opening.id, status: 'open' })).fact
    : f.addressedWork;
  const record = pending
    ? { ...f.accounting, disposition: { kind: 'pending' as const, work: ref(work), reason: 'answer remains open' } }
    : f.accounting;
  const accounting = value(f.graph.recordContinuity(record, f.lease));
  const reference = { owner: 'part-five', name: 'ContinuityAccounting', id: record.id, fact: ref(accounting) } as const;
  const send = () => {
    const fact = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accounting.id,
      ...record.firstReply, disclosure: f.disclosure.id, dispositionKind: record.disposition.kind,
      disposition: work.id, status: 'admitted' }), [accounting.id, f.disclosure.id, work.id]).fact;
    f.sendWitnesses.add(fact.id);
    return f.graph.verifyContinuitySend(reference, ref(fact));
  };
  return { ...f, work, record, accounting, reference, send };
}

it('P5-SEAM-RC-R14-V06 accepts a witnessed current continuity send', () => {
  expect(sendFixture().send().kind).toBe('Success');
});

it('P5-SEAM-RC-R14-V07 accepts pending continuity with open owned work', () => {
  expect(sendFixture(true).send().kind).toBe('Success');
});

it('P5-SEAM-RC-R14-V08 refuses first send after addressed work becomes invalid', () => {
  const f = sendFixture();
  f.append('continuity-addressed-work', json({ ...f.work.body as object, status: 'invalid' }), [f.work.id]);
  expect(decodeContinuityAccounting(f.record, f.context()).kind).toBe('Refused');
  expect(f.send().kind).toBe('Refused');
});

it('P5-SEAM-RC-R14-V09 refuses first send after pending work closes', () => {
  const f = sendFixture(true);
  f.append('continuity-pending-work', json({ ...f.work.body as object, status: 'closed' }), [f.work.id]);
  expect(decodeContinuityAccounting(f.record, f.context()).kind).toBe('Refused');
  expect(f.send().kind).toBe('Refused');
});

it('P5-SEAM-RC-R14-V10 accepts first send after unrelated work status changes', () => {
  const f = sendFixture();
  f.append('continuity-addressed-work', json({ ...f.work.body as object, run: 'other', status: 'invalid' }), [f.work.id]);
  expect(f.send().kind).toBe('Success');
});

it('P5-SEAM-RC-R14-V11 refuses a proposal when its investigation evidence has expired', () => {
  const f = exhaustionFixture();
  const at = f.clock(10_000);
  const obligation = f.append('run-observation-obligation',
    json({ ...f.obligation.body as object, due: digest(at) }), [f.obligation.id]).fact;
  const recheck = { ...f.exhaustion.recheck, at, obligation: ref(obligation) };
  const record = { ...f.exhaustion, id: 'review14:long-recheck', recheck };
  const fact = value(f.graph.recordExhaustion(record, f.lease));
  f.setClock(f.now.value + f.run.exitTest.freshFor + 1);
  expect(f.graph.recordExhaustion({ ...record, id: 'review14:expired-read' }, f.lease).kind).toBe('Refused');
  const exit = { ...f.exit, at: f.deps.clock(), recheck,
    exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(fact) },
    frontier: value(f.graph.read(f.id)).source.foldedThrough };
  expect(f.graph.recordUnreachableExit(exit, f.lease).kind).toBe('Refused');
});

it('P5-SEAM-RC-R14-V12 accepts closure while investigation evidence remains fresh', () => {
  const f = exhaustionFixture();
  f.setClock(f.now.value + 1);
  expect(f.graph.recordUnreachableExit({ ...f.exit, at: f.deps.clock(),
    frontier: value(f.graph.read(f.id)).source.foldedThrough }, f.lease).kind).toBe('Success');
});

it('P5-SEAM-RC-R14-V13 exact proposal retry returns the original fact after acknowledgment loss', () => {
  const f = exhaustionFixture();
  const first = value(f.graph.recordUnreachableExit(f.exit, f.lease));
  const retry = f.graph.recordUnreachableExit(f.exit, f.lease);
  expect(retry.kind).toBe('Success');
  if (retry.kind === 'Success') expect(retry.value).toEqual(first);
});

it('P5-SEAM-RC-R14-V14 exact close retry returns the original fact after restart', () => {
  const f = closeUnreachable();
  const graph = value(createRunClosureGraph(f.deps));
  const retry = graph.recordUnreachableExit(f.terminalExit, f.lease);
  expect(retry.kind).toBe('Success');
  if (retry.kind === 'Success') expect(retry.value).toEqual(f.closeFact);
});

for (const offset of [1000, 1001]) {
  it(`P5-SEAM-RC-R14-V20-AGE-${offset} enforces the evidence freshness boundary`, () => {
    const f = exhaustionFixture();
    const at = f.clock(10_000);
    const obligation = f.append('run-observation-obligation',
      json({ ...f.obligation.body as object, due: digest(at) }), [f.obligation.id]).fact;
    const recheck = { ...f.exhaustion.recheck, at, obligation: ref(obligation) };
    const record = { ...f.exhaustion, id: 'review14:boundary-recheck', recheck };
    const fact = value(f.graph.recordExhaustion(record, f.lease));
    f.setClock(f.now.value + offset);
    const proposal = { ...f.exit, at: f.deps.clock(), recheck,
      exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(fact) },
      frontier: value(f.graph.read(f.id)).source.foldedThrough };
    const admitted = f.graph.recordUnreachableExit(proposal, f.lease);
    if (admitted.kind === 'Success') {
      const close = { ...proposal, id: 'review14:boundary-close', expected: proposal.id, phase: 'close' as const,
        frontier: value(f.graph.read(f.id)).source.foldedThrough,
        proposal: { owner: 'part-five' as const, name: 'UnreachableRunExit' as const,
          id: proposal.id, fact: ref(admitted.value) } };
      value(f.graph.recordUnreachableExit(close, f.lease));
    }
    expect(value(f.graph.read(f.id)).state).toBe(offset === 1000 ? 'unreachable' : 'ready');
  });
}

it('P5-SEAM-RC-R14-V15 retains the permanent 771-case legacy decoder oracle', () => {
  const golden = JSON.parse(readFileSync(new URL('./legacy-decoder-main-golden.json', import.meta.url), 'utf8')) as {
    caseCount: number;
    values: Readonly<Record<string, string>>;
    cases: Readonly<Record<string, Readonly<Record<string, string>>>>;
  };
  const f = setup();
  const ready = value(f.graph.open(f.run));
  const groundingFact = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const grounding = recordFromWire((groundingFact.body as Readonly<Record<string, any>>).record!);
  const start = f.start(ready, groundingFact);
  value(f.graph.transition(start));
  const close = closingRun();
  const records: readonly [string, Readonly<Record<string, unknown>>, any, any][] = [
    ['Run', f.run, decodeRun, f], ['RunBudget', f.run.budget, decodeRunBudget, f],
    ['RunStep', start.step, decodeRunStep, f], ['RunTransition', start, decodeRunTransition, f],
    ['SessionGrounding', grounding as Readonly<Record<string, unknown>>, decodeSessionGrounding, f],
    ['RunExit', close.terminalExit, decodeRunExit, close],
    ['CloseTransition', close.close, decodeRunTransition, close],
  ];
  let cases = 0;
  for (const [group, record, decoder, fixture] of records) {
    const mutations: [string, unknown][] = [['valid', record]];
    for (const key of Object.keys(record)) {
      const missing = structuredClone(record) as Record<string, unknown>;
      delete missing[key];
      mutations.push([`omit:${key}`, missing]);
      for (const replacement of [null, 'bad', 0, [], {}])
        mutations.push([`replace:${key}:${JSON.stringify(replacement)}`, { ...record, [key]: replacement }]);
    }
    if ('exit' in record && record.exit && typeof record.exit === 'object' && !Array.isArray(record.exit)) {
      for (const key of Object.keys(record.exit)) {
        const missing = structuredClone(record) as Record<string, Record<string, unknown>>;
        delete missing.exit![key];
        mutations.push([`nested-exit-omit:${key}`, missing]);
      }
    }
    if (group === 'RunExit') for (const key of ['exitTest', 'check', 'evidence', 'result', 'settledOperations']) {
      const input = structuredClone(record) as Record<string, unknown>;
      input.kind = 'unsupported';
      delete input[key];
      mutations.push([`unsupported-kind-omit:${key}`, input]);
    }
    for (const [name, input] of mutations) {
      const id = golden.cases[group]?.[name];
      expect(id, `${group}:${name} missing from main golden`).toBeDefined();
      expect(value(canonical(decoder(input, fixture.context()))).bytes, `${group}:${name}`).toBe(golden.values[id!]);
      cases++;
    }
  }
  expect(cases).toBe(771);
  expect(cases).toBe(golden.caseCount);
});

it('P5-SEAM-RC-R14-V19 preserves deterministic legacy operation identities and signed history', () => {
  const trace = () => {
    const f = setup();
    const results: unknown[] = [];
    const opening = f.graph.open(f.run);
    results.push(opening, f.graph.open(f.run));
    const ready = value(opening);
    const ground = f.graph.ground(f.id, 'w', 'h', 'start', f.lease);
    results.push(ground);
    const start = f.start(ready, value(ground));
    const running = f.graph.transition(start);
    results.push(running, f.graph.transition(start));
    const observation = f.observe(value(running), 'uncertain');
    results.push(f.graph.transition(observation), f.graph.read(f.id));
    const completed = completedRun();
    const exit = completed.graph.readExit({ owner: 'part-five', name: 'Run', id: completed.id });
    return { results: results.map(result => value(canonical(result)).bytes),
      wire: value(canonical(json(value(f.store.read())))).bytes,
      stepKey: start.step.operation.key, stepDigest: start.step.operation.digest, run: f.id,
      terminal: value(canonical(exit)).bytes,
      completedWire: value(canonical(json(value(completed.store.read())))).bytes };
  };
  const first = trace();
  expect(first).toEqual(trace());
  expect(createHash('sha256').update(JSON.stringify(first)).digest('hex'))
    .toBe('2bcd3efd2b8aa873af04e1801e9f6b496af49ad99bc3e60c15516e04ba7d5edd');
});
