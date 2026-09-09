import { describe, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import type { VerifiedActAdmission } from '../../src/intake/index.js';
import { intakeFixture, refused, value } from './fixtures.js';

describe('separate independently-verified operator-act admission', () => {
  it('P4-VA-01 accepts the well-formed verified act and returns only the owner disposition/reference', () => {
    const f = intakeFixture(), v = f.verifiedAct();
    const result = value(f.port().admitVerifiedAct(v.input));
    expect(result).toEqual({ kind: 'approved', fact: { owner: 'part-two', name: 'FactEnvelope', id: expect.any(String) } });
    expect(f.facts().at(-1)).toMatchObject({ kind: 'intake-verified-act', predecessors: { required: [v.request.id] },
      body: { request: v.request.id, requestDigest: v.requestBody.requestDigest, disposition: 'approved' } });
  });

  it.each([
    ['P4-VA-02 missing reference', 'missing:request'],
    ['P4-VA-03 wrong-kind reference', 'machine-a:0:0'],
  ])('%s is refused after signed-history resolution', (_name, referenceId) => {
    const f = intakeFixture(), v = f.verifiedAct({ referenceId });
    refused(f.port().admitVerifiedAct(v.input), referenceId.startsWith('missing') ? 'missing durable' : 'wrong kind');
    expect(f.facts().some(row => row.kind === 'intake-verified-act')).toBe(false);
  });

  it('P4-VA-04 tainted request is refused', () => {
    const f = intakeFixture(), v = f.verifiedAct();
    f.dropCapture(v.requestEvidence.reference);
    refused(f.port().admitVerifiedAct(v.input), 'tainted');
  });

  it('P4-VA-05 a causally concurrent conflicting request is refused', () => {
    const f = intakeFixture(), v = f.verifiedAct(); f.conflictRequest(v);
    refused(f.port().admitVerifiedAct(v.input), 'conflicted');
  });

  it('a later request with the same durable request id explicitly supersedes the old request', () => {
    const f = intakeFixture(), v = f.verifiedAct();
    f.verifiedAct({ request: { requestId: v.requestBody.requestId! }, decision: 'decline' });
    refused(f.port().admitVerifiedAct(v.input), 'superseded');
  });

  it('P4-VA-06 stale exact digest is refused', () => {
    const f = intakeFixture(), stale = hashBytes('stale-digest');
    const v = f.verifiedAct({ submittedDigest: stale });
    refused(f.port().admitVerifiedAct(v.input), 'digest');
  });

  it('P4-VA-07 wrong scope is refused even when the Part One act is otherwise valid', () => {
    const f = intakeFixture();
    const wrong = value(decode('Scope', { type: 'Scope', schemaVersion: 1, kind: 'project', members: ['project-b'] }, f.context.decode));
    const v = f.verifiedAct({ challengeScope: wrong });
    refused(f.port().admitVerifiedAct(v.input), 'moved');
  });

  it('P4-VA-08 channel-attested evidence never completes authority', () => {
    const f = intakeFixture(), v = f.verifiedAct({ attested: true });
    refused(f.port().admitVerifiedAct(v.input), 'channel-attested');
  });

  it('P4-VA-09 replay is refused, including after an explicit decline', () => {
    const f = intakeFixture(), v = f.verifiedAct({ decision: 'decline' });
    expect(value(f.port().admitVerifiedAct(v.input)).kind).toBe('declined');
    refused(f.port().admitVerifiedAct(v.input), 'replayed');
  });

  it('expiry is explicit and authority is fail-closed', () => {
    const f = intakeFixture(), v = f.verifiedAct(); f.setTime(501);
    refused(f.port().admitVerifiedAct(v.input), 'expired');
  });

  it('P11-V15 refuses a correctly signed challenge whose rendering digest does not bind the durable request rendering', () => {
    const f = intakeFixture(), v = f.verifiedAct({ renderingDigest: hashBytes('different rendering') });
    refused(f.port().admitVerifiedAct(v.input), 'rendering digest');
  });

  it('P11-V16 keys single-use consumption by challenge identity across distinct durable requests', () => {
    const f = intakeFixture(), challengeId = 'challenge:single-use';
    const first = f.verifiedAct({ challengeId, request: { requestId: 'request:first' } });
    const second = f.verifiedAct({ challengeId, request: { requestId: 'request:second' } });
    expect(value(f.port().admitVerifiedAct(first.input)).kind).toBe('approved');
    refused(f.port().admitVerifiedAct(second.input), 'reused');
  });

  it('P11-V17 refuses an independently signed challenge with an unbounded lifetime', () => {
    const f = intakeFixture();
    const v = f.verifiedAct({ request: { expiresAt: 1_000_000 }, challengeExpiresAt: 300_101 });
    refused(f.port().admitVerifiedAct(v.input), 'lifetime');
  });

  it.each([
    ['P11-V48 current base', { currentBase: 'base:2' }],
    ['P11-V49 current artifact', { artifact: hashBytes('artifact:other') }],
  ])('%s must match the signed durable request rather than being replaced by request values', (_name, changed) => {
    const f = intakeFixture(), v = f.verifiedAct();
    Object.assign(f.context, { decode: { ...f.context.decode, ...changed } });
    refused(f.port().admitVerifiedAct(v.input), 'current');
  });

  it('P11-V50 accepts when the signed durable request matches the actual current base and artifact', () => {
    const f = intakeFixture(), v = f.verifiedAct();
    expect(value(f.port().admitVerifiedAct(v.input)).kind).toBe('approved');
  });

  it.each([
    ['caller valid', { valid: true }],
    ['pre-resolved principal', { principal: { id: 'alice' } }],
    ['free-form grant', { grant: { actions: ['work'] } }],
  ])('refuses %s fields as authority', (_name, extra) => {
    const f = intakeFixture(), v = f.verifiedAct({ extra });
    refused(f.port().admitVerifiedAct(v.input), 'forbidden');
  });

  it('independently verified emergency stop remains safety-open across the authority gate', () => {
    const f = intakeFixture();
    Object.assign(f.context, { decode: { ...f.context.decode, register: { ...f.context.decode.register,
      actions: { ...f.context.decode.register.actions, 'emergency-stop': { protected: true, repository: false } } } } });
    const v = f.verifiedAct({ action: 'emergency-stop' });
    f.dropCapture(v.requestEvidence.reference);
    const declared = f.registerInput.sources.map(source => source.declaration)
      .filter(declaration => (declaration as { id: string }).id !== 'intake.verified-act');
    const port = value(createIntakePort({ ...f.deps, governance: f.govern(declared).governance }));
    expect(value(port.admitVerifiedAct(v.input)).kind).toBe('emergency-stopped');
  });

  it('the operation requires a Part Two reference and durable capture at compile/runtime shape', () => {
    const f = intakeFixture(), v = f.verifiedAct();
    for (const input of [
      { ...v.input, request: v.request.id },
      { ...v.input, proof: v.challengeProof },
    ] as unknown as VerifiedActAdmission[]) refused(f.port().admitVerifiedAct(input));
  });
});
