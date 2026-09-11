import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { verifyAndAdmit } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { scheduledIntakeWorkRegistration } from '../../src/intake/scheduled-a/index.js';
import { json, refused, value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
type Variant = 'changed-job' | 'changed-calendar' | 'package' | 'timezone' | 'instant' | 'empty-job'
  | 'extra-field' | 'missing-field' | 'wrong-version' | 'non-tick'
  | 'missing-resolution' | 'missing-discovery' | 'missing-principal' | 'missing-grant';
const variants: readonly Variant[] = ['changed-job', 'changed-calendar', 'package', 'timezone', 'instant', 'empty-job',
  'extra-field', 'missing-field', 'wrong-version', 'non-tick', 'missing-resolution', 'missing-discovery',
  'missing-principal', 'missing-grant'];
function setup(variant: Variant) {
  const f = scheduledFixture(); const grant = f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const admitted = value(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  const original = f.frames.pop() as FactEnvelope, previous = f.frames.at(-1) as FactEnvelope;
  const body = structuredClone(original.body) as Record<string, any>;
  if (variant === 'changed-job') body.intent.ask.jobInstance = 'job:other';
  if (variant === 'changed-calendar') body.intent.ask.calendarPolicyVersion = 'cron:different';
  if (variant === 'package') body.intent.ask.packageDigest = value(canonical('package:v2')).hash;
  if (variant === 'timezone') body.intent.ask.timeZoneDataVersion = 'tzdb:different';
  if (variant === 'instant') body.intent.ask.scheduledInstant = json(f.clock(2000));
  if (variant === 'empty-job') body.intent.ask.jobInstance = '';
  if (variant === 'extra-field') body.intent.ask.sourceMachine = 'machine-b';
  if (variant === 'missing-field') delete body.intent.ask.calendarPolicyVersion;
  if (variant === 'wrong-version') body.intent.ask.schemaVersion = 2;
  if (variant === 'non-tick') body.intent.ask = 'ordinary text';
  const omitted = variant === 'missing-resolution'
    ? (f.frames as FactEnvelope[]).find(fact => fact.kind === 'intake-resolved')?.id
    : variant === 'missing-discovery' ? discovery.fact.id
      : variant === 'missing-principal' ? admitted.principal.fact.id
        : variant === 'missing-grant' ? grant.fact.id : undefined;
  const required = original.predecessors.required.filter(id => id !== omitted);
  const signed = f.f.next(previous, { kind: original.kind, principal: original.principal,
    provenance: original.provenance, at: original.at, body,
    predecessors: { ...original.predecessors, required } }, f.context);
  const registration = value(scheduledIntakeWorkRegistration({ site: f.context.site, preserved: f.context.preserved,
    register: f.context.decode.register }, f.principal.id,f.deps.governance.register));
  const context = { ...f.context, facts: f.frames as FactEnvelope[],
    ownedBodies: [...f.context.ownedBodies ?? [], registration] };
  return { f, admitted, signed, context };
}

it.each(variants)
('P4-ST-30 V71 signed replication refuses %s scheduled evidence', variant => {
  const x = setup(variant);
  refused(verifyAndAdmit(json(x.signed), 'machine-a', x.context));
});

it.each(variants)
('P4-ST-31 V71 the Part Five consumer re-runs owner validation for %s evidence', variant => {
  const x = setup(variant);
  x.f.frames.push(x.signed);
  expect(() => scheduledRunHarness(x.f, { ...x.admitted, fact: ref(x.signed.id) })).toThrow();
  expect(x.f.facts().filter(fact => fact.kind === 'run-opening')).toEqual([]);
});

it('P4-ST-30/P4-ST-31 V71 unchanged signed replication remains admissible', () => {
  const f = scheduledFixture(); f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  value(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }));
  const original = f.frames.pop() as FactEnvelope, previous = f.frames.at(-1) as FactEnvelope;
  const signed = f.f.next(previous, { kind: original.kind, principal: original.principal,
    provenance: original.provenance, at: original.at, body: original.body,
    predecessors: original.predecessors }, f.context);
  const registration = value(scheduledIntakeWorkRegistration({ site: f.context.site, preserved: f.context.preserved,
    register: f.context.decode.register }, f.principal.id,f.deps.governance.register));
  const context = { ...f.context, facts: f.frames as FactEnvelope[],
    ownedBodies: [...f.context.ownedBodies ?? [], registration] };
  expect(value(verifyAndAdmit(json(signed), 'machine-a', context)).id).toBe(signed.id);
});
