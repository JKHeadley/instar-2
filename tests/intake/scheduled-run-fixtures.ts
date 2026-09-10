import { canonical } from '../../src/index.js';
import type { FactEnvelopeReference, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { bindIntakeOwnerRegister,scheduledIntakeWorkRegistration } from '../../src/intake/index.js';
import type { ScheduledIntakeDisposition } from '../../src/intake/index.js';
import { createRunGraph, recordWire, resolveIntakeOwner, runFactSchemas, runIdFor } from '../../src/rungraph/index.js';
import type { Run, RunDecodeContext, RunGraphPort } from '../../src/rungraph/index.js';
import { governanceFixture } from '../rungraph/governance-fixture.js';
import { json, value } from './fixtures.js';
import type { scheduledFixture } from './scheduled-fixtures.js';

type ScheduledFixture = ReturnType<typeof scheduledFixture>;

const reference = (fact: FactEnvelope): FactEnvelopeReference => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });

export function recoverScheduledDisposition(f: ScheduledFixture, admissionId: string): ScheduledIntakeDisposition {
  const facts = f.frames as FactEnvelope[];
  const admission = facts.find(row => row.id === admissionId && row.kind === 'intake-admitted');
  if (!admission) throw new Error('durable scheduled admission absent');
  const body = admission.body as Record<string, any>, intent = body.intent as Record<string, any>;
  const principal = facts.find(row => row.kind === 'intake-scheduled-principal'
    && admission.predecessors.required.includes(row.id));
  const grant = facts.find(row => row.kind === 'scheduled-system-grant'
    && admission.predecessors.required.includes(row.id));
  if (!principal || !grant) throw new Error('durable scheduled authority references absent');
  return {
    kind: 'scheduled-admitted', logicalId: body.logicalId, fact: reference(admission),
    owner: body.work.owner, blockedOn: 'run-admission',
    principal: { type: 'VerifiedPrincipal', id: (principal.body as Record<string, any>).principal.id,
      fact: reference(principal), field: 'principal' },
    standing: { type: 'StandingGrant', id: (grant.body as Record<string, any>).grant.id,
      fact: reference(grant), field: 'grant' },
    scheduledIdentity: { jobInstance: intent.ask.jobInstance, scheduledInstant: intent.ask.scheduledInstant },
  } as ScheduledIntakeDisposition;
}

export function scheduledRunHarness(f: ScheduledFixture, admitted: ScheduledIntakeDisposition): {
  readonly graph: RunGraphPort; readonly run: Run; readonly runId: string;
  readonly createCalls: () => number; readonly context: RunDecodeContext;
} {
  f.installSchemas();
  const ownerSchema = { ...f.f.schema, kind: 'scheduled-accountable-owner',
    fields: { principal: { kind: 'constitutional' as const, type: 'VerifiedPrincipal' as const } } };
  if (!f.context.schemas.some(row => row.kind === ownerSchema.kind))
    Object.assign(f.context, { schemas: [...f.context.schemas, ownerSchema] });
  let ownerFact = (f.frames as FactEnvelope[]).find(row => row.kind === ownerSchema.kind);
  if (!ownerFact) ownerFact = value(authorAndAppend({ kind: ownerSchema.kind, schemaVersion: 1,
    machine: f.deps.author.machine, principal: json(f.f.bob), provenance: json(f.f.bob.provenance), at: json(f.f.now),
    body: json({ principal: f.f.bob }), required: [] }, f.context, createFactStore(f.context, f.storage),
  f.deps.author.privateKey)).fact;
  const accountableOwner = { type: 'VerifiedPrincipal' as const, id: f.f.bob.id,
    fact: reference(ownerFact), field: 'principal' };
  const subjects = { ...f.context.decode.register.subjects, 'run-work': ['steps'], 'elapsed-time': ['ms'] };
  const register = { ...f.context.decode.register, subjects };
  Object.assign(f.context, { decode: { ...f.context.decode, register } });
  const boundary = { site: f.context.site, preserved: f.context.preserved, register };
  bindIntakeOwnerRegister(register,f.deps.governance.register,f.deps.governance.context);
  const work = value(scheduledIntakeWorkRegistration(boundary, f.principal.id, f.deps.governance.register));
  const factContext = { ...f.context, facts: [] as FactEnvelope[] };
  let context: RunDecodeContext = {
    site: f.context.site, preserved: f.context.preserved, register,
    types: f.context.decode, facts: factContext, stimulusKinds: ['intake-admitted'],
    evidenceSources: { settlement: 'probe', exit: 'probe' }, intakeOwners: { [admitted.owner]: accountableOwner },
  };
  const registrations = value(runFactSchemas(context));
  const owned = [...f.context.ownedBodies ?? [], work, ...registrations.registrations]
    .filter((row, index, all) => all.findIndex(candidate => candidate.owner === row.owner && candidate.name === row.name) === index);
  const schemas = [...f.context.schemas, ...registrations.schemas]
    .filter((row, index, all) => all.findIndex(candidate => candidate.kind === row.kind && candidate.version === row.version) === index);
  Object.assign(f.context, { schemas, ownedBodies: owned });
  Object.assign(factContext, { schemas, ownedBodies: owned, decode: f.context.decode });
  context = { ...context, types: f.context.decode, facts: factContext };
  const store = createFactStore(factContext, f.storage);
  const loaded = value(store.read()), opening = loaded.find(row => row.id === admitted.fact.id)!;
  const resolved = value(resolveIntakeOwner(opening, { ...context, facts: { ...factContext, facts: loaded } }));
  const runId = runIdFor(resolved.opening);
  const budgetId = `scheduled-budget:${runId}`;
  const run: Run = {
    type: 'Run', schemaVersion: 1, id: runId, ...resolved, directives: [], scope: f.f.scope,
    authority: { resolution: admitted.fact, grants: [admitted.standing] },
    exitTest: { check: 'probe', version: 'v1', subject: 'scheduled-result',
      acceptance: value(canonical('complete')).hash, evidenceKinds: ['proof'], freshFor: 1000 },
    budget: { type: 'RunBudget', schemaVersion: 1, id: budgetId, bounds: ['bound'],
      resources: [{ type: 'Measurement', schemaVersion: 1, subject: { kind: 'run-work', instance: budgetId },
        value: 3, unit: 'steps', at: f.f.now, by: 'probe' }],
      maxWorkers: 1, maxProcesses: 1, maxOutstanding: 3, maxChildren: 0, maxDepth: 1, maxAttempts: 3,
      repetitionPolicy: { owner: 'part-six', name: 'LoopPolicy', id: `scheduled-loop:${runId}` },
      safetyCeiling: f.clock(10000), exhaustedOwner: accountableOwner },
    cadence: { bound: 'bound', milliseconds: 1000 },
    nextWake: { owner: accountableOwner, at: f.clock(2000), reason: 'scheduled' }, blockedOn: { kind: 'nothing' },
    resultDestination: { binding: { owner: 'part-four', name: 'ConversationBinding', id: 'none' }, route: admitted.fact },
    generation: context.types.register.generation, createdAt: opening.at, depth: 1,
  } as unknown as Run;
  const append = (kind: string, record: Run, required: readonly string[]) => authorAndAppend({
    kind, schemaVersion: 1, machine: f.deps.author.machine, principal: json(f.principal), provenance: json(f.provenance),
    at: json(f.f.now), body: json({ run: record.id, record: recordWire(record) }), required,
  }, factContext, store, f.deps.author.privateKey);
  const unavailable = (): never => { throw new Error('unneeded sibling RunGraph port'); };
  let creates = 0;
  const graph = value(createRunGraph({
    context, governance: governanceFixture(context), store,
    writer: { owner: 'part-ten', append: (kind, _run, record, required) => append(kind, record as Run, required) },
    admission: {
      owner: 'part-six', execution: unavailable, reservation: unavailable, commit: unavailable,
      create: (_opening, suppliedRun, write) => {
        if (suppliedRun !== runId) throw new Error('conditional admission changed deterministic Run id');
        creates += 1; return write();
      },
      verify: supplied => {
        if (!value(store.read()).some(row => row.id === supplied.id && row.kind === 'run-opening'))
          throw new Error('durable run admission witness absent');
        return f.f.success(supplied);
      },
    },
    grounding: { owner: 'part-ten', read: unavailable }, settlement: { owner: 'part-eight', read: unavailable },
    control: { owner: 'part-four', verify: unavailable }, exitCheck: { owner: 'part-nine', verify: unavailable },
    groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50, briefingClasses: ['identity'] },
    generation: () => {
      const lineages: Record<string, { head: { epoch: number; position: number }; observedAt: number; closed: false }> = {};
      for (const fact of value(store.read())) lineages[fact.machine] = {
        head: fact.segment, observedAt: f.f.now.value, closed: false,
      };
      return { reference: context.types.register.generation, kinds: schemas.map(row => row.kind), lineages };
    },
    clock: () => f.f.now,
  }));
  return { graph, run, runId, createCalls: () => creates, context };
}
