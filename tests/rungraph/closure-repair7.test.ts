import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { createRunClosureGraph, createRunGraph, decodeRunExit, recordFromWire } from '../../src/rungraph/index.js';
import { continuityFixture, exhaustionFixture } from './closure-fixtures.js';
import { closingRun, completedRun, digest, json, ref, refused, value } from './fixtures.js';

it('P5-SEAM-RC-R7-HISTORY-V25 permanently combines the round-3 investigation grant with its human outside-action owner', () => {
  const f = exhaustionFixture(), grant = f.grant({ id: 'repair7:investigator-grant', grantee: f.bob });
  const grantFact = f.replicate('grant-record', json({ grant }), [],
    { principal: f.alice, provenance: grant.source }).fact;
  const grantReference = { type: 'StandingGrant' as const, id: grant.id, fact: ref(grantFact), field: 'grant' as const };
  const humanFact = f.replicate('stimulus', json({ ...f.opening.body as object, owner: f.alice }), [],
    { principal: f.alice, provenance: f.alice.provenance }).fact;
  const human = { type: 'VerifiedPrincipal' as const, id: f.alice.id, fact: ref(humanFact), field: 'owner' as const };
  const identity = f.append('run-owned-identity-read', json({ run: f.id, principal: f.alice.id, status: 'current' })).fact;

  expect(value(f.graph.recordExhaustion({ ...f.exhaustion, id: 'repair7:human-action-with-investigator-grant',
    grants: [grantReference], identityReads: [ref(identity)], outsideAction: { ...f.exhaustion.outsideAction, owner: human } },
  f.lease)).kind).toBe('run-exhaustion');
});

it('P5-SEAM-RC-R7-F1-V19 refuses addressed continuity without the typed durable result while accepting owner-witnessed support', () => {
  const unsupported = continuityFixture();
  const legacyDisposition = { kind: 'addressed' as const, work: ref(unsupported.addressedWork) };
  refused(unsupported.graph.recordContinuity({ ...unsupported.accounting, id: 'repair7:unwitnessed-addressed',
    disposition: legacyDisposition }, unsupported.lease), 'addressed continuity fields differ');

  const supported = continuityFixture();
  expect(value(supported.graph.recordContinuity(supported.accounting, supported.lease)).kind)
    .toBe('continuity-accounting');
});

it('P5-SEAM-RC-R7-F1-V21 refuses a durable result signed by a principal other than the accountable run owner', () => {
  const f = continuityFixture();
  const foreignResult = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
    value: 'foreign answer', capacity: { kind: 'none' } }, f.ctx.decode));
  const foreignFact = f.replicate('result-record', json({ result: foreignResult }), [f.disclosure.id],
    { principal: f.alice, provenance: f.alice.provenance }).fact;
  const work = f.append('continuity-addressed-work', json({ ...f.addressedWork.body as object }),
    [f.disclosure.id, foreignFact.id]).fact;
  const result = { type: 'Result' as const, id: 'repair7:foreign-result', fact: ref(foreignFact), field: 'result' as const };
  refused(f.graph.recordContinuity({ ...f.accounting, id: 'repair7:foreign-addressed-result',
    disposition: { kind: 'addressed', work: ref(work), result } }, f.lease), 'accountable run owner');
});

it('P5-SEAM-RC-R7-F2-V18 refuses omission of the causally latest resolved dependency and preserves another-run near miss', () => {
  const f = exhaustionFixture();
  f.append('run-dependency-observation', json({ ...f.dependency.body as object, status: 'resolved' }), [f.dependency.id]);
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: 'repair7:omitted-resolved-dependency', dependencies: [] }, f.lease),
    'complete current dependency inventory');

  const unrelated = exhaustionFixture();
  unrelated.append('run-dependency-observation', json({ ...unrelated.dependency.body as object,
    run: 'another-run', status: 'resolved' }));
  expect(value(unrelated.graph.recordExhaustion({ ...unrelated.exhaustion, id: 'repair7:unrelated-dependency' },
  unrelated.lease)).kind).toBe('run-exhaustion');
});

it.each([
  ['P5-SEAM-RC-R7-F4-V26-EXITTEST', 'exitTest'],
  ['P5-SEAM-RC-R7-F4-V26-CHECK', 'check'],
  ['P5-SEAM-RC-R7-F4-V26-EVIDENCE', 'evidence'],
  ['P5-SEAM-RC-R7-F4-V26-RESULT', 'result'],
  ['P5-SEAM-RC-R7-F4-V26-SETTLEDOPERATIONS', 'settledOperations'],
] as const)
('%s preserves the exact legacy unsupported-kind missing-field refusal', (_id, field) => {
  const f = closingRun();
  const malformed = structuredClone(json(f.terminalExit)) as Record<string, Json>;
  malformed.kind = 'unsupported';
  delete malformed[field];
  expect(refused(decodeRunExit(malformed, f.context()))).toBe(`missing required field ${field}`);
});

it('P5-SEAM-RC-R7-F4-TYPE-PRECEDENCE preserves type/schema refusal before the unsupported-kind legacy preflight', () => {
  const f = closingRun();
  expect(refused(decodeRunExit({}, f.context()))).toBe('type or schema version unknown');
});

it('P5-SEAM-RC-R7-HISTORY-V45 preserves the round-6 completed replay mismatch detail', () => {
  const f = completedRun();
  const graph = value(createRunGraph({ ...f.deps, exitCheck: { owner: 'part-nine', verify: () => f.success(ref(f.opening)) } }));
  expect(refused(graph.read(f.id))).toBe('exit replay witness mismatch');
});

it.each([false, true])
('P5-SEAM-RC-R7-HISTORY-V46-V47 coalesces %s duplicate byte-identical pause-grounding copy', duplicate => {
  const f = continuityFixture();
  const prior = recordFromWire((f.groundingFact.body as { record: Json }).record) as Readonly<Record<string, Json>>;
  if (duplicate) {
    const graph = value(createRunClosureGraph({ ...f.deps, grounding: { owner: 'part-ten', read: () => f.success(prior) } }));
    const copy = value(graph.ground(f.id, 'w', 'h', 'resume', f.lease));
    expect(copy.id).not.toBe(f.groundingFact.id);
    expect(value(canonical(copy.body)).bytes).toBe(value(canonical(f.groundingFact.body)).bytes);
  }
  (f.c.stimulusKinds as string[]).push('later-inbound');
  const later = f.append('later-inbound', json({ capture: (f.opening.body as Readonly<Record<string, Json>>).capture })).fact;
  const messages = [...prior.messages as Json[], { fact: ref(later), sequence: later.segment.position,
    capture: 'message:1', hash: f.accounting.prePauseCapture.hash }];
  const consumption = f.append('consumption', json({ worker: 'w', harness: 'h',
    hashes: JSON.stringify(messages.map(message => (message as { hash: string }).hash)),
    classes: JSON.stringify(prior.briefingClasses) })).fact;
  const current = { ...prior, id: `repair7:current-ground:${duplicate}`, lastInbound: ref(later), messages,
    frontier: { 'machine-a': { epoch: 0, position: consumption.segment.position } }, consumption: ref(consumption) };
  const graph = value(createRunClosureGraph({ ...f.deps, grounding: { owner: 'part-ten', read: () => f.success(current) } }));
  const ground = value(graph.ground(f.id, 'w', 'h', 'resume', f.lease));
  const firstReply = { operation: `repair7:reply:${duplicate}`, digest: digest(`repair7:reply:${duplicate}`) };
  const proposal = f.append('continuity-reply-proposal', json({ run: f.id, expected: f.ready.head,
    grounding: ground.id, inbound: f.opening.id, ...firstReply, status: 'proposed', permission: 'none' })).fact;
  const disclosure = f.append('continuity-disclosure', json({ run: f.id, grounding: ground.id,
    inbound: f.opening.id, ...firstReply }), [proposal.id]).fact;
  const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
    value: 'reply after pause', capacity: { kind: 'none' } }, f.ctx.decode));
  const resultFact = f.append('result-record', json({ result }), [disclosure.id]).fact;
  const resultReference = { type: 'Result' as const, id: `repair7:result:${duplicate}`,
    fact: ref(resultFact), field: 'result' as const };
  const work = f.append('continuity-addressed-work', json({ run: f.id, inbound: f.opening.id,
    ...firstReply, status: 'durable' }), [disclosure.id, resultFact.id]).fact;
  const accounting = { ...f.accounting, id: `repair7:accounting:${duplicate}`,
    grounding: { ...f.accounting.grounding, id: String(current.id), fact: ref(ground) }, firstReply,
    disclosure: ref(disclosure), disposition: { kind: 'addressed' as const, work: ref(work), result: resultReference } };
  expect(value(graph.recordContinuity(accounting, f.lease)).kind).toBe('continuity-accounting');
});
