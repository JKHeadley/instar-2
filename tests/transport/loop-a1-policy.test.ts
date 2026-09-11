import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import * as transport from '../../src/transport/index.js';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture } from './loop-fixture.js';

type Verdict = { kind: 'accepted'; value: unknown } | { kind: 'refused'; detail: string };
const verdict = (result: unknown): Verdict => consumeResult(result as never, {
  Success: value => ({ kind: 'accepted', value }) as Verdict,
  Refused: refusal => ({ kind: 'refused', detail: refusal.detail }) as Verdict,
});

it('SLB-A1-POLICY-84 accepts the closed breaker policy and typed-refuses every excluded A2 field', () => {
  const fixture = transportLoopFixture();
  expect(verdict(decodeLoopPolicy(fixture.sharedPolicy, fixture.c)).kind).toBe('accepted');
  for (const field of ['budgetWindow', 'parentAttemptBudget', 'parentResourceBudget', 'parentDuty', 'cursorKind']) {
    const result = verdict(decodeLoopPolicy({ ...fixture.sharedPolicy, [field]: field === 'parentDuty'
      ? fixture.run : 1 }, fixture.c));
    expect(result).toEqual({ kind: 'refused', detail: 'unsupported-in-slice-a1' });
  }

  const policyFact = consumeResult(fixture.store.read(), {
    Success: facts => facts.find(fact => fact.kind === 'transport-SharedBreakerLoopPolicy')!,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
  const altered = signEnvelope({ type: policyFact.type, envelopeVersion: policyFact.envelopeVersion,
    id: policyFact.id, kind: policyFact.kind, schemaVersion: policyFact.schemaVersion, at: policyFact.at,
    machine: policyFact.machine, principal: policyFact.principal, provenance: policyFact.provenance,
    segment: policyFact.segment, prevInSegment: policyFact.prevInSegment, predecessors: policyFact.predecessors,
    body: { ...(policyFact.body as object), policy: {
      ...((policyFact.body as { policy: object }).policy), parentAttemptBudget: 1 } } }, privateKey);
  const context = { ...fixture.ctx, facts: [...fixture.ctx.facts,
    ...consumeResult(fixture.store.read(), { Success: facts => facts.filter(fact => fact.id !== policyFact.id),
      Refused: refusal => { throw new Error(refusal.detail); } })] };
  const envelope = consumeResult(decodeEnvelope(altered, context, 'replication'), {
    Success: accepted => accepted,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
  expect(verdict(decodeHistoricalBody(envelope, context, context.decode))).toEqual({
    kind: 'refused', detail: 'unsupported-in-slice-a1',
  });
});

it('SLB-A1-CURSOR-85 adds no LoopRecord or ScanCursor public decoder', () => {
  expect('decodeLoopRecord' in transport).toBe(false);
  expect('decodeScanCursor' in transport).toBe(false);
});
