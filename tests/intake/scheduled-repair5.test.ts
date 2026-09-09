import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { intakeWorkRegistration } from '../../src/intake/index.js';
import { json, refused, value } from './fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';
import { scheduledRunHarness } from './scheduled-run-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
function setup() {
  const f = scheduledFixture(), grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  const input = { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) };
  const admitted = value(f.port().receiveScheduledTick(input));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  const original = f.frames.pop() as FactEnvelope;
  return { f, grant, tick, discovery, input, admitted, original };
}
function registration(f: ReturnType<typeof scheduledFixture>) {
  return value(intakeWorkRegistration({ site: f.context.site, preserved: f.context.preserved,
    register: f.context.decode.register }, f.principal.id));
}
function appendMutation(x: ReturnType<typeof setup>, mutate: (body: Record<string, any>) => void,
  omit: (fact: FactEnvelope) => boolean = () => false) {
  const body = structuredClone(x.original.body) as Record<string, any>;
  mutate(body);
  const required = x.original.predecessors.required.filter(id => {
    const fact = (x.f.frames as FactEnvelope[]).find(candidate => candidate.id === id);
    return !fact || !omit(fact);
  });
  const context = { ...x.f.context, ownedBodies: [...x.f.context.ownedBodies ?? [], registration(x.f)],
    decode: { ...x.f.context.decode, provenance: x.f.provenance } };
  return authorAndAppend({ kind: x.original.kind, schemaVersion: x.original.schemaVersion,
    machine: x.original.machine, principal: json(x.original.principal), provenance: json(x.original.provenance),
    at: json(x.original.at), body: json(body), required }, context, createFactStore(context, x.f.storage),
  x.f.deps.author.privateKey);
}

const tickMutations = [
  ['V64-package', (body: Record<string, any>, x: ReturnType<typeof setup>) => {
    body.intent.ask.packageDigest = value(canonical('package:v2')).hash;
  }],
  ['V64-timezone', (body: Record<string, any>) => { body.intent.ask.timeZoneDataVersion = 'tzdb:different'; }],
  ['V64-instant', (body: Record<string, any>, x: ReturnType<typeof setup>) => {
    body.intent.ask.scheduledInstant = json(x.f.clock(2000));
  }],
  ['V64-empty-job', (body: Record<string, any>) => { body.intent.ask.jobInstance = ''; }],
] as const;

it.each(tickMutations)('P4-ST-30 %s refuses a changed canonical tick at owner append', (_label, mutate) => {
  const x = setup();
  refused(appendMutation(x, body => mutate(body, x)));
  expect(x.f.facts().filter(fact => fact.kind === 'intake-admitted')).toEqual([]);
});

const malformedMutations = [
  ['V65-extra-field', (body: Record<string, any>) => { body.intent.ask.sourceMachine = 'machine-b'; }],
  ['V65-missing-field', (body: Record<string, any>) => { delete body.intent.ask.calendarPolicyVersion; }],
  ['V65-wrong-version', (body: Record<string, any>) => { body.intent.ask.schemaVersion = 2; }],
  ['V65-non-tick', (body: Record<string, any>) => { body.intent.ask = 'ordinary text'; }],
] as const;

it.each(malformedMutations)('P4-ST-31 %s cannot escape through the ordinary-intake arm', (_label, mutate) => {
  const x = setup();
  refused(appendMutation(x, mutate));
  expect(x.f.facts().filter(fact => fact.kind === 'intake-admitted')).toEqual([]);
});

it('P4-ST-30 V66 requires exactly one signed intake-resolved dependency', () => {
  const x = setup();
  refused(appendMutation(x, () => {}, fact => fact.kind === 'intake-resolved'), 'resolved-principal witness');
  expect(x.f.facts().filter(fact => fact.kind === 'intake-admitted')).toEqual([]);
});

it.each(['discovery', 'principal', 'grant'] as const)
('P4-ST-31 V70 scheduled claims cannot omit the signed %s authority witness', witness => {
  const x = setup();
  const omitted = witness === 'discovery' ? x.discovery.fact.id
    : witness === 'principal' ? x.admitted.principal.fact.id : x.grant.fact.id;
  refused(appendMutation(x, () => {}, fact => fact.id === omitted));
  expect(x.f.facts().filter(fact => fact.kind === 'intake-admitted')).toEqual([]);
});

it('P4-ST-30/P4-ST-31 V67 unchanged scheduled evidence still opens exactly one Run', () => {
  const f = scheduledFixture(); f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const admitted = value(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  const harness = scheduledRunHarness(f, admitted);
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(admitted.fact);
  expect(f.facts().filter(fact => fact.kind === 'run-opening')).toHaveLength(1);
});
