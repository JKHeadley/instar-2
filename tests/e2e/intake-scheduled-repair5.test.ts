import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { scheduledIntakeWorkRegistration } from '../../src/intake/scheduled-a/index.js';
import { json, refused, value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { recoverScheduledDisposition, scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
function durable<T>(run: (directory: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), 'instar-p4-repair5-'));
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
type Variant = 'package' | 'timezone' | 'instant' | 'empty-job' | 'extra-field' | 'missing-field'
  | 'wrong-version' | 'non-tick' | 'missing-resolution' | 'missing-discovery' | 'missing-principal' | 'missing-grant';
const variants: readonly Variant[] = ['package', 'timezone', 'instant', 'empty-job', 'extra-field', 'missing-field',
  'wrong-version', 'non-tick', 'missing-resolution', 'missing-discovery', 'missing-principal', 'missing-grant'];

it.each(variants)('P4-ST-30/P4-ST-31 durable append refuses V64/V65/V66/V70 %s evidence before fsync', variant => durable(directory => {
  const before = scheduledFixture({ directory }); const grant = before.grant();
  const tick = before.tick(), discovery = before.discovery(tick.eventId);
  const admitted = value(before.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  const original = before.frames.pop() as FactEnvelope, body = structuredClone(original.body) as Record<string, any>;
  if (variant === 'package') body.intent.ask.packageDigest = value(canonical('package:v2')).hash;
  if (variant === 'timezone') body.intent.ask.timeZoneDataVersion = 'tzdb:different';
  if (variant === 'instant') body.intent.ask.scheduledInstant = json(before.clock(2000));
  if (variant === 'empty-job') body.intent.ask.jobInstance = '';
  if (variant === 'extra-field') body.intent.ask.sourceMachine = 'machine-b';
  if (variant === 'missing-field') delete body.intent.ask.calendarPolicyVersion;
  if (variant === 'wrong-version') body.intent.ask.schemaVersion = 2;
  if (variant === 'non-tick') body.intent.ask = 'ordinary text';
  const omitted = variant === 'missing-resolution'
    ? (before.frames as FactEnvelope[]).find(fact => fact.kind === 'intake-resolved')?.id
    : variant === 'missing-discovery' ? discovery.fact.id
      : variant === 'missing-principal' ? admitted.principal.fact.id
        : variant === 'missing-grant' ? grant.fact.id : undefined;
  const required = original.predecessors.required.filter(id => id !== omitted);
  const registration = value(scheduledIntakeWorkRegistration({ site: before.context.site, preserved: before.context.preserved,
    register: before.context.decode.register }, before.principal.id,before.deps.governance.register));
  const context = { ...before.context, ownedBodies: [...before.context.ownedBodies ?? [], registration],
    decode: { ...before.context.decode, provenance: before.provenance } };
  refused(authorAndAppend({ kind: original.kind, schemaVersion: original.schemaVersion, machine: original.machine,
    principal: json(original.principal), provenance: json(original.provenance), at: json(original.at), body: json(body), required },
  context, createFactStore(context, before.storage), before.deps.author.privateKey));

  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  const admissions = restarted.facts().filter(fact => fact.kind === 'intake-admitted');
  expect(admissions).toHaveLength(1);
  expect((admissions[0]!.body as Record<string, any>).intent.ask).toEqual(tick.body);
  expect(restarted.facts().filter(fact => fact.kind === 'run-opening')).toEqual([]);
}));

it('P4-ST-30/P4-ST-31 durable V67 control reopens the unchanged admission as one Run', () => durable(directory => {
  const before = scheduledFixture({ directory }); before.grant(); const tick = before.tick(), discovery = before.discovery(tick.eventId);
  const admitted = value(before.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  const recovered = recoverScheduledDisposition(restarted, admitted.fact.id), harness = scheduledRunHarness(restarted, recovered);
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(admitted.fact);
  expect(restarted.facts().filter(fact => fact.kind === 'run-opening')).toHaveLength(1);
}));
