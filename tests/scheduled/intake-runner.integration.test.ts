import { describe, expect, it } from 'vitest';
import { consumeResult, decode } from '../../src/index.js';
import type { Authorization, ProvenanceInput } from '../../src/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import type { IntakeDisposition, IntakePort, InboundRoute } from '../../src/intake/index.js';
import { createScheduledIntakeAdapter, createScheduledRunner, createScheduledWorkPackagePort,
  decodeScheduledWorkManifest } from '../../src/scheduled/index.js';
import { boundary } from '../../src/scheduled/boundary.js';
import { clone, scheduledFixture, value } from './fixture.js';

const refused = <T>(result: import('../../src/index.js').Result<T>) => consumeResult(result, {
  Success: () => '', Refused: row => row.detail });

describe('scheduled adapter and durable runner', () => {
  function sourceFixture() {
    const f = scheduledFixture();
    const manifest = value(decodeScheduledWorkManifest({ ...clone(f.manifest),
      admission: { ...clone(f.manifest.admission), priority: 'medium' },
      authority: { ...clone(f.manifest.authority), standingGrant: f.core.g.id },
      activation: { ...clone(f.manifest.activation), rollout: 'active' } }, f.context));
    const source = { manifest, namespaceVersion: 'scheduled:v1', installationId: 'install:a', identityEpoch: 'key:1',
      manifestFact: 'fact:manifest', approvedActFact: 'fact:approved-act' };
    const at = f.core.clock(Date.UTC(2027, 0, 1));
    const plan = value(createScheduledWorkPackagePort().planOccurrence({ manifest: f.manifest,
      namespaceVersion: source.namespaceVersion, installationId: source.installationId,
      scheduledInstant: f.manifest.schedule.kind === 'one-shot' ? f.manifest.schedule.at : '', asOf: at }, f.context));
    const route: InboundRoute = { channel: `scheduled:${plan.jobInstanceId}`,
      sender: f.manifest.authority.systemPrincipal, identityEpoch: source.identityEpoch, eventId: plan.eventId };
    const ok = <T>(item: T) => boundary('ScheduledTestResult', null, f.context, () => item);
    const fail = <T>(detail: string) => boundary<T>('ScheduledTestRefusal', null, f.context, () => { throw Error(detail); });
    const act = { ...f.core.authorization, action: { kind: manifest.identity.jobId, scope: f.core.scope },
      artifact: manifest.identity.contentDigest } as Authorization;
    const approval = { act, grant: f.core.g, revocations: [], actFact: source.approvedActFact,
      manifestFact: source.manifestFact, scopeReference: manifest.authority.scope, currentBase: act.base };
    return { f, source, at, plan, route, ok, fail, approval };
  }

  it('rejects forged route and bytes, missing act, and revoked authority', () => {
    const s = sourceFixture(); let active = true, verifyCalls = 0;
    const adapter = createScheduledIntakeAdapter({ context: s.f.context, sources: () => [s.source],
      authorize: () => active ? s.ok(s.approval) : s.fail('authority revoked'),
      verifySource: () => { verifyCalls++; return s.ok(s.f.core.proof({ id: s.route.sender, kind: 'system' },
        { id: s.route.sender, kind: 'system' }, 'identity').input as ProvenanceInput); } });
    expect(refused(adapter.authenticate(s.plan.tickBytes, { ...s.route, sender: 'forged' }, s.at))).toContain('route differs');
    expect(refused(adapter.authenticate(s.plan.tickBytes + ' ', s.route, s.at))).toContain('differs');
    expect(verifyCalls).toBe(0);
    active = false;
    expect(refused(adapter.authenticate(s.plan.tickBytes, s.route, s.at))).toContain('authority revoked');
    const revokedPayload = { id: 'revocation:scheduler', grantId: s.approval.grant.id,
      by: s.f.core.alice, at: s.f.core.clock(101), reason: 'withdrawn' };
    const signedRevocation = s.f.core.proof(revokedPayload);
    const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1,
      ...revokedPayload, source: signedRevocation.p }, { ...s.f.core.ctx, provenance: signedRevocation.p }));
    const withRevocation = createScheduledIntakeAdapter({ context: s.f.context, sources: () => [s.source],
      authorize: () => s.ok({ ...s.approval, revocations: [revocation] }),
      verifySource: () => s.fail('should not verify') });
    expect(refused(withRevocation.authenticate(s.plan.tickBytes, s.route, s.at))).toContain('no longer applicable');
    const missing = createScheduledIntakeAdapter({ context: s.f.context,
      sources: () => [{ ...s.source, approvedActFact: '' }],
      authorize: () => s.ok(s.approval), verifySource: () => s.fail('missing credential') });
    expect(refused(missing.authenticate(s.plan.tickBytes, s.route, s.at))).toContain('approved act');
    const wrongJob = createScheduledIntakeAdapter({ context: s.f.context, sources: () => [s.source],
      authorize: () => s.ok({ ...s.approval, act: { ...s.approval.act, action: {
        ...s.approval.act.action, kind: 'job:other' } } as Authorization }),
      verifySource: () => s.fail('should not verify') });
    expect(refused(wrongJob.authenticate(s.plan.tickBytes, s.route, s.at))).toContain('does not authorize this job');
    active = true;
    expect(value(adapter.authenticate(s.plan.tickBytes, s.route, s.at)).principalKind).toBe('system');
    expect(adapter.parse(s.plan.tickBytes)).toEqual({ schemaVersion: 1, kind: 'message', text: 'inspect' });
  });

  it('restarts after capture and admission with one durable start; stop, unknown usage and budget hold', () => {
    const s = sourceFixture();
    const rows: FactEnvelope[] = []; const starts = new Set<string>();
    let crashAfterCapture = true, crashAfterAdmission = false, stopped = false;
    let usage: 'normal' | 'unknown' = 'normal';
    let budget = true, receipts = 0, admissions = 0;
    const admission = (route: InboundRoute, receipt: string): Extract<IntakeDisposition, { kind: 'admitted' }> => {
      const id = `admission:${route.eventId}`;
      if (!rows.some(row => row.id === id)) {
        admissions++;
        rows.push({ id, kind: 'intake-admitted', body: { adapter: 'scheduled-intake-v1', channel: route.channel,
          sender: route.sender, identityEpoch: route.identityEpoch, eventId: route.eventId,
          logicalId: route.eventId, receipt, intent: {}, work: { owner: 'run-admission' } } } as unknown as FactEnvelope);
      }
      return { kind: 'admitted', logicalId: String(route.eventId), lastInboundId: String(route.eventId),
        intent: {} as Extract<IntakeDisposition, { kind: 'admitted' }>['intent'],
        fact: { owner: 'part-two', name: 'FactEnvelope', id }, owner: 'run-admission',
        blockedOn: 'run-admission', standing: 'requester', boundOperator: false, flags: [] };
    };
    const intake: IntakePort = {
      receive(_raw, route) {
        const id = `receipt:${++receipts}`;
        rows.push({ id, kind: 'intake-receipt', body: { adapter: 'scheduled-intake-v1', ingress: JSON.stringify(route) } } as unknown as FactEnvelope);
        if (crashAfterCapture) return s.fail('crash after capture');
        return s.ok(admission(route, id));
      },
      recover(receiptId) {
        const receipt = rows.find(row => row.id === receiptId)!;
        return s.ok(admission(JSON.parse(String((receipt.body as Record<string, unknown>).ingress)), receiptId));
      }, expireHolds: () => s.ok(0), admitVerifiedAct: () => s.fail('unused'),
    };
    const make = () => createScheduledRunner({ intake, sources: () => [s.source], facts: () => s.ok([...rows]),
      clock: ms => s.f.core.clock(ms), usage: () => usage, stopped: () => stopped, capacity: () => budget,
      startOnce: item => {
        if (crashAfterAdmission) return s.fail('crash after admission');
        if (!budget || starts.has(item.fact.id)) return s.ok(false);
        starts.add(item.fact.id); return s.ok(true);
      }, context: s.f.context });
    const due = Date.UTC(2027, 0, 1), future = due - 1;
    expect(value(make().tick(future))).toBe(0); expect(receipts).toBe(0);
    stopped = true; expect(value(make().tick(due))).toBe(0); expect(receipts).toBe(0);
    stopped = false; usage = 'unknown'; expect(value(make().tick(due))).toBe(0); expect(receipts).toBe(0);
    usage = 'normal'; budget = false; expect(value(make().tick(due))).toBe(0); expect(receipts).toBe(0);
    budget = true; expect(refused(make().tick(due))).toContain('crash after capture'); expect(receipts).toBe(1);
    stopped = true; expect(value(make().tick(due))).toBe(0); expect(admissions).toBe(0);
    stopped = false; usage = 'unknown'; expect(value(make().tick(due))).toBe(0); expect(admissions).toBe(0);
    usage = 'normal'; budget = false; expect(value(make().tick(due))).toBe(0); expect(admissions).toBe(0);
    budget = true;
    crashAfterCapture = false; crashAfterAdmission = true;
    expect(refused(make().tick(due))).toContain('crash after admission'); expect(admissions).toBe(1);
    crashAfterAdmission = false; budget = false;
    expect(value(make().tick(due))).toBe(0); expect(starts.size).toBe(0);
    budget = true;
    expect(value(make().tick(due))).toBe(1);
    expect(value(make().tick(due))).toBe(0);
    expect(admissions).toBe(1); expect(starts.size).toBe(1); expect(receipts).toBe(1);
  });
});
