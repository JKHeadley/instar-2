import { createHash, createPrivateKey } from 'node:crypto';
import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { authorAndAppend, factId, signEnvelope } from '../../src/facts/index.js';
import { createRunClosureGraph, decodeContinuityAccounting, recordWire, statePairs } from '../../src/rungraph/index.js';
import { privateKey } from '../facts/fixtures.js';
import {
  avenueSetDecision, continuityDirectiveFixture, continuityFixture, exhaustionFixture,
} from './closure-fixtures.js';
import { closingRun, digest, json, ref, refused, value } from './fixtures.js';

const missing = { owner: 'part-two', name: 'FactEnvelope', id: 'missing:fact' } as const;

it.each(['missing', 'wrong-kind', 'wrong-id', 'wrong-owner', 'clauses', 'external-action',
  'recheck-date', 'recheck-owner', 'unknown-arm', 'unwitnessed'] as const)
('P5-SEAM-RC-R12-V05 refuses unsupported or unwitnessed unreachable %s data', kind => {
  const f = exhaustionFixture();
  let exit: any = { ...f.exit };
  if (kind === 'missing') exit.exhaustion = { ...exit.exhaustion, fact: missing };
  if (kind === 'wrong-kind') exit.exhaustion = { ...exit.exhaustion, fact: ref(f.opening) };
  if (kind === 'wrong-id') exit.exhaustion = { ...exit.exhaustion, id: 'another-exhaustion' };
  if (kind === 'wrong-owner') exit.exhaustion = { ...exit.exhaustion, owner: 'part-six' };
  if (kind === 'clauses') exit.unsatisfiedClauses = ['invented clause'];
  if (kind === 'external-action') exit.externalDependency = { ...exit.externalDependency, action: 'unrelated action' };
  if (kind === 'recheck-date') exit.recheck = { ...exit.recheck, at: f.clock(2000) };
  if (kind === 'recheck-owner') exit.recheck = { ...exit.recheck, owner: { ...f.owner, id: 'alice' } };
  if (kind === 'unknown-arm') exit.kind = 'cancelled';
  if (kind === 'unwitnessed') f.admissions.delete(f.exhaustionFact.id);
  refused(f.graph.recordUnreachableExit(exit, f.lease));
  expect(value(f.store.read()).filter(fact => fact.kind === 'run-unreachable-exit')).toHaveLength(0);
});

it.each(['capabilityReads', 'identityReads', 'dependencies', 'avenueSetDecisions', 'resources', 'avenues'] as const)
('P5-SEAM-RC-R12-V06 refuses omitted required exhaustion %s inventory', field => {
  const f = exhaustionFixture();
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: `omitted:${field}`, [field]: [] }, f.lease));
});

it.each(['unknown', 'stale', 'resolved', 'unrelated'] as const)
('P5-SEAM-RC-R12-V07 re-resolves current dependency status %s', status => {
  const f = exhaustionFixture();
  f.append('run-dependency-observation', json({ ...f.dependency.body as object,
    status: status === 'unrelated' ? 'resolved' : status,
    ...(status === 'unrelated' ? { run: 'other-run' } : {}) }), [f.dependency.id]);
  const result = f.graph.recordExhaustion({ ...f.exhaustion, id: `changed:${status}` }, f.lease);
  if (status === 'unrelated') expect(value(result).kind).toBe('run-exhaustion');
  else refused(result);
});

it('P5-SEAM-RC-R12-V08 pending effects retain their operation key and inhibit unreachable closure', () => {
  const f = exhaustionFixture();
  const grounding = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const running = value(f.graph.transition(f.start(f.ready, grounding)));
  const record = { ...f.exhaustion, id: 'pending-exhaustion', expected: running.head };
  const exhaustion = value(f.graph.recordExhaustion(record, f.lease));
  const exit = { ...f.exit, id: 'pending-exit', expected: running.head, frontier: value(f.graph.read(f.id)).source.foldedThrough,
    exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(exhaustion) } };
  refused(f.graph.recordUnreachableExit(exit, f.lease), 'unsettled operations');
  expect(value(f.graph.read(f.id)).pending.map(step => step.operation.key))
    .toEqual(running.pending.map(step => step.operation.key));
});

it('P5-SEAM-RC-R12-V09 retains honestly partial exhaustion without terminal promotion', () => {
  const f = exhaustionFixture();
  const decision = value(decode('Decision', f.decisionInput({ id: 'partial-conclusion',
    conclusion: { subject: f.id, predicate: 'exhaustion-conclusion', value: false, evidence: ['e1'] },
    reason: { subject: f.id, predicate: 'partial-support', value: true, evidence: ['e1', 'e2'] },
  }), f.ctx.decode));
  const decisionFact = f.append('decision-record', json({ decision }), f.evidenceFacts.map(fact => fact.id)).fact;
  const record = { ...f.exhaustion, id: 'partial-record',
    conclusion: { type: 'Decision' as const, id: decision.id, fact: ref(decisionFact), field: 'decision' as const } };
  const exhaustion = value(f.graph.recordExhaustion(record, f.lease));
  refused(f.graph.recordUnreachableExit({ ...f.exit, id: 'partial-exit',
    exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(exhaustion) } }, f.lease), 'partial exhaustion');
  expect(value(f.graph.recordExhaustion(record, f.lease))).toEqual(exhaustion);
});

it.each(['addressed', 'pending'] as const)
('P5-SEAM-RC-R12-V10 accepts supported continuity %s', kind => {
  const f = continuityFixture();
  const record = kind === 'addressed' ? f.accounting : { ...f.accounting, id: 'continuity:pending',
    disposition: { kind: 'pending' as const, work: ref(f.opening), reason: 'answer remains open' } };
  expect(value(f.graph.recordContinuity(record, f.lease)).kind).toBe('continuity-accounting');
});

it.each(['capture-unavailable', 'hash-mismatch', 'wrong-grounding', 'unwitnessed-grounding',
  'wrong-digest', 'wrong-inbound', 'wrong-disclosure', 'missing-result'] as const)
('P5-SEAM-RC-R12-V11 refuses unsupported continuity %s', kind => {
  const f = continuityFixture();
  let accounting: any = { ...f.accounting };
  if (kind === 'capture-unavailable') Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
  if (kind === 'hash-mismatch') accounting.prePauseCapture = { ...accounting.prePauseCapture, hash: digest('wrong capture') };
  if (kind === 'wrong-grounding') accounting.grounding = { ...accounting.grounding, fact: ref(f.opening) };
  if (kind === 'unwitnessed-grounding') f.admissions.delete(f.groundingFact.id);
  if (kind === 'wrong-digest') accounting.firstReply = { ...accounting.firstReply, digest: digest('wrong reply') };
  if (kind === 'wrong-inbound') accounting.prePauseInbound = ref(f.disclosure);
  if (kind === 'wrong-disclosure') accounting.disclosure = ref(f.opening);
  if (kind === 'missing-result') accounting.disposition = { kind: 'addressed', work: ref(f.addressedWork) };
  refused(f.graph.recordContinuity(accounting, f.lease));
});

it('P5-SEAM-RC-R12-V12 retains a genuinely unavailable capture only as pending', () => {
  const f = continuityFixture();
  Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
  const accounting = { ...f.accounting, id: 'continuity:unavailable',
    prePauseCapture: { ...f.accounting.prePauseCapture, status: 'unavailable' as const },
    disposition: { kind: 'pending' as const, work: ref(f.opening), reason: 'capture recovery pending' } };
  expect(value(decodeContinuityAccounting(accounting, f.context())).disposition.kind).toBe('pending');
});

it.each(['missing-prefix', 'bad-signature'] as const)
('P5-SEAM-RC-R12-V13 refuses %s signed history', mode => {
  const f = exhaustionFixture();
  if (mode === 'missing-prefix') f.wire.splice(0, 1);
  else (f.wire[0] as any).body.owner.id = 'intruder';
  refused(f.graph.recordUnreachableExit(f.exit, f.lease));
});

it('P5-SEAM-RC-R12-V14 refuses stale observations and accepts the exact freshness boundary', () => {
  const f = exhaustionFixture();
  f.setClock(1100);
  expect(value(f.graph.recordExhaustion({ ...f.exhaustion, id: 'at-bound' }, f.lease)).kind).toBe('run-exhaustion');
  f.setClock(1101);
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: 'past-bound' }, f.lease));
});

it('P5-SEAM-RC-R12-V15 refuses negative exhaustion resource accounting', () => {
  const f = exhaustionFixture();
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: 'negative-charge',
    resources: f.exhaustion.resources.map(resource => ({ ...resource, value: -1 })) }, f.lease));
});

it('P5-SEAM-RC-R12-V16 refuses unavailable supporting capture evidence', () => {
  const f = exhaustionFixture();
  Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: 'unavailable-investigation' }, f.lease));
});

it('P5-SEAM-RC-R12-V17 requires the effect-owner witness for a first reply send', () => {
  const f = continuityFixture();
  const accounting = value(f.graph.recordContinuity(f.accounting, f.lease));
  const send = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accounting.id,
    operation: f.accounting.firstReply.operation, digest: f.accounting.firstReply.digest,
    disclosure: f.disclosure.id, dispositionKind: 'addressed', disposition: f.addressedWork.id, status: 'admitted' }),
  [accounting.id, f.disclosure.id, f.addressedWork.id]).fact;
  const reference = { owner: 'part-five' as const, name: 'ContinuityAccounting' as const,
    id: f.accounting.id, fact: ref(accounting) };
  refused(f.graph.verifyContinuitySend(reference, ref(send)));
  f.sendWitnesses.add(send.id);
  expect(value(f.graph.verifyContinuitySend(reference, ref(send)))).toEqual(ref(send));
});

it('P5-SEAM-RC-R12-V19 preserves the complete legacy public state table', () => {
  expect(statePairs).toEqual({
    ready: ['running', 'waiting', 'halted', 'closing'],
    running: ['ready', 'waiting', 'recovering', 'halted', 'closing'],
    waiting: ['ready', 'recovering', 'halted', 'closing'],
    recovering: ['ready', 'waiting', 'halted', 'closing'],
    halted: ['ready', 'waiting', 'recovering', 'closing'],
    closing: ['completed', 'unreachable', 'cancelled', 'waiting', 'halted'],
    completed: [], unreachable: [], cancelled: [],
  });
});

it.each([true, false])
('P5-SEAM-RC-R12-V20 refuses an uncertain avenue only when exhaustive=%s is promoted', exhaustive => {
  const f = exhaustionFixture();
  const grounding = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const running = value(f.graph.transition(f.start(f.ready, grounding)));
  const stepFact = value(f.store.read()).at(-1)!;
  const step = running.pending[0]!;
  const evidenceInput = f.evidenceInput({ id: `uncertain-bound:${exhaustive}`,
    claim: { subject: step.operation.key, predicate: 'operation-outcome',
      value: { digest: step.operation.digest, kind: 'uncertain' } }, freshFor: 1000 });
  const capture = (evidenceInput as { capture: { reference: string; hash: string } }).capture;
  const bytes = f.captures[capture.reference]!;
  Object.assign(f.ctx.captures, { [capture.reference]: { bytes, hash: capture.hash,
    status: 'available', byteLength: Buffer.byteLength(bytes) } });
  const evidence = value(decode('Evidence', evidenceInput, f.ctx.decode));
  f.evidence.push(evidence);
  const outcome = value(decode('Outcome', f.raw('Outcome', { kind: 'uncertain', evidence: [evidence.id] }),
    { ...f.ctx.decode, evidence: [evidence] }));
  const outcomeFact = f.append('outcome-record', json({ evidence, outcome })).fact;
  const decision = value(decode('Decision', f.decisionInput({ id: `truthful:${exhaustive}`,
    conclusion: { subject: f.id, predicate: 'exhaustion-conclusion', value: exhaustive, evidence: ['e1'] },
    reason: { subject: f.id, predicate: 'bounded', value: true, evidence: ['e1', 'e2'] },
  }), f.ctx.decode));
  const decisionFact = f.append('decision-record', json({ decision }), f.evidenceFacts.map(fact => fact.id)).fact;
  const record = { ...f.exhaustion, id: `uncertain:${exhaustive}`, expected: running.head,
    conclusion: { type: 'Decision' as const, id: decision.id, fact: ref(decisionFact), field: 'decision' as const },
    avenueSetDecisions: [avenueSetDecision(f, ['unknown'], `unknown-set:${exhaustive}`)],
    avenues: [{ id: 'unknown', disposition: 'tried' as const, evidence: [ref(outcomeFact)],
      step: { owner: 'part-five' as const, name: 'RunStep' as const, id: running.pending[0]!.id, fact: ref(stepFact) },
      outcome: { type: 'Outcome' as const, id: `outcome:${outcomeFact.id}`, fact: ref(outcomeFact), field: 'outcome' as const } }] };
  const result = f.graph.recordExhaustion(record, f.lease);
  if (exhaustive) refused(result, 'unknown or successful avenue');
  else expect(value(result).kind).toBe('run-exhaustion');
});

it.each([false, true])
('P5-SEAM-RC-R12-V21 refuses a concurrent dependency conflict only for matching subject; unrelated=%s', unrelated => {
  const f = exhaustionFixture();
  const segment = { machine: 'machine-b', epoch: 0, position: 0 };
  const secondKey = createPrivateKey({
    key: Buffer.from(`302e020100300506032b657004220420${'22'.repeat(32)}`, 'hex'), format: 'der', type: 'pkcs8',
  }).export({ format: 'pem', type: 'pkcs8' }).toString();
  const envelope = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment),
    kind: 'run-dependency-observation', schemaVersion: 1, at: f.now, machine: 'machine-b',
    principal: f.bob, provenance: f.bob.provenance, segment, prevInSegment: f.ctx.genesis.hash,
    predecessors: { inSegment: null, frontier: { 'machine-a': {
      epoch: f.blocker.segment.epoch, position: f.blocker.segment.position } }, required: [f.blocker.id] },
    body: { ...f.dependency.body as object, ...(unrelated ? { run: 'another-run' } : {}), status: 'unknown' },
  }, secondKey);
  value(f.store.append(envelope, { peer: 'machine-b' }));
  const graph = value(createRunClosureGraph({ ...f.deps, generation: () => ({ ...f.generation(),
    lineages: { ...f.generation().lineages,
      'machine-b': { head: { epoch: 0, position: 0 }, observedAt: f.now.value, closed: false } } }) }));
  const result = graph.recordExhaustion({ ...f.exhaustion, id: `concurrent:${unrelated}` }, f.lease);
  if (unrelated) expect(value(result).kind).toBe('run-exhaustion');
  else refused(result, 'conflicted');
});

it.each(['valid', 'wrong-prior', 'wrong-signer', 'not-superseding'] as const)
('P5-SEAM-RC-R12-V22 superseding input %s re-resolves the original inbound, signer, and directive lineage', mode => {
  const f = continuityDirectiveFixture();
  const directive = value(decode('Directive', f.directiveInput({ id: `directive:next:${mode}`,
    principal: f.alice, supersedes: f.directive!.id }), f.ctx.decode));
  const directiveFact = f.replicate('directive-record', json({ directive }), [],
    { principal: f.alice, provenance: f.alice.provenance }).fact;
  (f.c.stimulusKinds as string[]).push('continuity-superseding-input');
  const body = json({ prior: mode === 'wrong-prior' ? 'another-input' : f.opening.id });
  const input = mode === 'wrong-signer'
    ? f.replicate('continuity-superseding-input', body, [f.opening.id, directiveFact.id]).fact
    : f.replicate('continuity-superseding-input', body, [f.opening.id, directiveFact.id],
      { principal: f.alice, provenance: f.alice.provenance }).fact;
  const next = { type: 'Directive' as const, id: directive.id, fact: ref(directiveFact), field: 'directive' as const };
  const accounting = { ...f.accounting, id: `continuity:superseded:${mode}`,
    disposition: { kind: 'superseded' as const, input: ref(input),
      directive: mode === 'not-superseding' ? f.run.directives[0]! : next } };
  const result = f.graph.recordContinuity(accounting, f.lease);
  if (mode === 'valid') expect(value(result).kind).toBe('continuity-accounting');
  else refused(result);
});

function legacyPartTwoMutations() {
  const f = closingRun();
  const base = structuredClone(f.close) as any;
  const cases: [string, any][] = [['valid', base]];
  for (const key of Object.keys(base)) {
    const omitted = structuredClone(base); delete omitted[key]; cases.push([`omit:${key}`, omitted]);
    for (const replacement of [null, 'bad', 0, [], {}])
      cases.push([`replace:${key}:${JSON.stringify(replacement)}`, { ...base, [key]: replacement }]);
  }
  for (const key of Object.keys(base.exit)) {
    const omitted = structuredClone(base); delete omitted.exit[key]; cases.push([`nested-omit:${key}`, omitted]);
    for (const replacement of [null, 'bad', 0, [], {}])
      cases.push([`nested-replace:${key}:${JSON.stringify(replacement)}`,
        { ...base, exit: { ...base.exit, [key]: replacement } }]);
  }
  const outcomes = cases.map(([id, record]) => {
    const result = authorAndAppend({ kind: 'run-transition', body: json({ run: f.id, record: recordWire(record) }),
      required: [], schemaVersion: 1, machine: 'machine-a', principal: json(f.bob),
      provenance: json(f.bob.provenance), at: json(f.now) }, f.ctx, f.store, privateKey);
    return [id, value(canonical(json(result))).bytes] as const;
  });
  return { outcomes, digest: createHash('sha256').update(outcomes.map(([id, bytes]) => `${id}\0${bytes}\n`).join('')).digest('hex') };
}

it('P5-SEAM-RC-R12-V24 preserves all 193 registered Part Two legacy mutation Results byte-for-byte', () => {
  const observed = legacyPartTwoMutations();
  expect(observed.outcomes).toHaveLength(193);
  expect(observed.digest).toBe('5686d6fccd80c7ca9f3d206fb3d7e134c3fd39e18ca746a1ac2032598ceab86f');
  for (const field of ['exitTest', 'check', 'evidence', 'result', 'settledOperations']) {
    const encoded = observed.outcomes.find(([id]) => id === `nested-omit:${field}`)![1];
    expect(JSON.parse(encoded)).toMatchObject({ type: 'Result', kind: 'Refused', detail: 'missing required field' });
  }
});

it('P5-SEAM-RC-R12-V25 preserves the legacy outside-causal-cone refusal Result', () => {
  const f = closingRun();
  const prior = value(f.store.read()).at(-1)!;
  const segment = { machine: 'machine-b', epoch: 0, position: 0 };
  const secondKey = createPrivateKey({
    key: Buffer.from(`302e020100300506032b657004220420${'22'.repeat(32)}`, 'hex'), format: 'der', type: 'pkcs8',
  }).export({ format: 'pem', type: 'pkcs8' }).toString();
  const remote = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind: 'note',
    schemaVersion: 1, at: f.now, machine: 'machine-b', principal: f.bob, provenance: f.bob.provenance,
    segment, prevInSegment: f.ctx.genesis.hash, predecessors: { inSegment: null, frontier: {}, required: [] },
    body: { identity: 'remote observation', amount: '0' },
  }, secondKey);
  const remoteFact = value(f.store.append(remote, { peer: 'machine-b' })).fact;
  const next = { machine: 'machine-a', epoch: 0, position: prior.segment.position + 1 };
  const record = { ...f.close, trigger: ref(remoteFact) };
  const input = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(next), kind: 'run-transition',
    schemaVersion: 1, at: f.now, machine: 'machine-a', principal: f.bob, provenance: f.bob.provenance,
    segment: next, prevInSegment: prior.contentHash,
    predecessors: { inSegment: prior.id, frontier: {}, required: [] },
    body: { run: f.id, record: recordWire(record as never) },
  }, privateKey);
  expect(refused(f.store.append(input, { peer: 'machine-a' })))
    .toBe('run record reference is outside signed causal cone');
});
