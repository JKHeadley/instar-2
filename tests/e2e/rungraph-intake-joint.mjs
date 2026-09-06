import assert from 'node:assert/strict';
import { canonical, consumeResult } from '@instar/constitutional-types';
import { authorAndAppend, createFactStore } from '@instar/constitutional-types/facts';
import { createRunGraph, resolveIntakeOwner, runFactSchemas, runIdFor, recordWire } from '@instar/constitutional-types/rungraph';
import { intake, fixtures, intakeCommit } from '../rungraph/intake-pin.mjs';
import { governanceFixture } from './rungraph-fixture-loader.mjs';
const { intakeFixture, message, route } = fixtures, f = intakeFixture();
const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw Error(r.detail); } });
const refuse = (r, pattern) => consumeResult(r, { Success: () => { throw Error('unexpected acceptance'); }, Refused: r => { assert.match(r.detail, pattern); return r.detail; } });
const json = v => JSON.parse(take(canonical(v)).bytes);
const ref = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
// Installation identity is its own existing constitutional record. It is NOT an
// alternate intake/stimulus; the Run will retain the original P4 opening cause.
f.context.schemas = [...f.context.schemas, { ...f.f.schema, kind: 'accountable-owner', fields: { principal: { kind: 'constitutional', type: 'VerifiedPrincipal' } } }];
f.context.decode = { ...f.context.decode, register: { ...f.context.decode.register, subjects: { ...f.context.decode.register.subjects, 'run-work': ['steps'] } } };
const ownership = take(authorAndAppend({ kind: 'accountable-owner', schemaVersion: 1, machine: 'machine-a', principal: json(f.f.bob),
  provenance: json(f.f.bob.provenance), at: json(f.f.now), body: { principal: json(f.f.bob) }, required: [] },
  f.context, createFactStore(f.context, f.storage), f.deps.author.privateKey)).fact;
const port = f.port(), admitted = take(port.receive(message('actual four to five handoff'), route));
assert.equal(admitted.kind, 'admitted');
assert.equal(admitted.owner, 'run-admission:owner');
const boundary = { site: f.context.site, preserved: f.context.preserved, register: f.context.decode.register };
const work = take(intake.intakeWorkRegistration(boundary, f.deps.author.principal.id));
const stop = take(intake.intakeStopRegistration(boundary, f.deps.author.principal.id));
let factContext = { ...f.context, ownedBodies: [work, stop], facts: f.facts() };
const opening = factContext.facts.find(fact => fact.id === admitted.fact.id);
assert.equal(opening.kind, 'intake-admitted'); assert.equal(opening.body.owner, undefined);
assert.equal(opening.body.work.owner, admitted.owner);
const owner = { type: 'VerifiedPrincipal', id: 'bob', fact: ref(ownership), field: 'principal' };
let c = { site: factContext.site, preserved: factContext.preserved, register: factContext.decode.register,
  types: factContext.decode, facts: factContext, stimulusKinds: ['intake-admitted'], evidenceSources: { settlement: 'probe', exit: 'probe' },
  intakeOwners: { [admitted.owner]: owner } };
const resolved = take(resolveIntakeOwner(opening, c));
assert.deepEqual(resolved.opening, admitted.fact); assert.deepEqual(resolved.intent.fact, admitted.fact);
assert.equal(resolved.intent.id, admitted.intent.id); assert.deepEqual(resolved.owner, owner);
refuse(resolveIntakeOwner(opening, { ...c, intakeOwners: {} }), /unresolved/);
refuse(resolveIntakeOwner({ ...opening, body: { ...opening.body, work: { ...opening.body.work, owner: 'different-owner' } } }, c), /actual admitted intake/);
refuse(resolveIntakeOwner(opening, { ...c, facts: { ...factContext, ownedBodies: [] } }), /owned body registration/);
const registrations = take(runFactSchemas(c));
factContext = { ...factContext, facts: [], schemas: [...factContext.schemas, ...registrations.schemas], ownedBodies: [...factContext.ownedBodies, ...registrations.registrations] };
c = { ...c, facts: factContext };
const store = createFactStore(factContext, f.storage), id = runIdFor(resolved.opening), admissions = new Set();
const append = (kind, body, required) => authorAndAppend({ kind, schemaVersion: 1, machine: 'machine-a', principal: json(f.f.bob),
  provenance: json(f.f.bob.provenance), at: json(f.f.now), body, required }, factContext, store, f.deps.author.privateKey);
const unavailable = () => { throw Error('unneeded sibling port'); };
const run = { type: 'Run', schemaVersion: 1, id, ...resolved, directives: [], scope: f.f.scope,
  authority: { resolution: admitted.fact, grants: [] }, exitTest: { check: 'probe', version: 'v1', subject: 'artifact',
    acceptance: take(canonical('complete')).hash, evidenceKinds: ['proof'], freshFor: 1000 },
  budget: { type: 'RunBudget', schemaVersion: 1, id: 'joint-budget', bounds: ['bound'], resources: [{ type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'run-work', instance: 'joint-budget' }, value: 3, unit: 'steps', at: f.f.now, by: 'probe' }],
    maxWorkers: 1, maxProcesses: 1, maxOutstanding: 3, maxChildren: 0, maxDepth: 1, maxAttempts: 3,
    repetitionPolicy: { owner: 'part-six', name: 'LoopPolicy', id: 'joint-loop' }, safetyCeiling: f.f.clock(10000), exhaustedOwner: owner },
  cadence: { bound: 'bound', milliseconds: 1000 }, nextWake: { owner, at: f.f.clock(1000), reason: 'continue' }, blockedOn: { kind: 'nothing' },
  resultDestination: { binding: { owner: 'part-four', name: 'ConversationBinding', id: opening.body.binding }, route: admitted.fact },
  generation: c.types.register.generation, createdAt: opening.at, depth: 1 };
const deps = { context: c, governance: governanceFixture(c), store, clock: () => f.f.now,
  generation: () => ({ reference: c.types.register.generation, kinds: factContext.schemas.map(s => s.kind),
    lineages: { 'machine-a': { head: take(store.read()).at(-1).segment, observedAt: f.f.now.value, closed: false } } }),
  groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50, briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] },
  writer: { owner: 'part-ten', append: (kind, run, record, required) => append(kind, json({ run, record: recordWire(record) }), required) },
  admission: { owner: 'part-six', execution: unavailable, reservation: unavailable, commit: unavailable,
    create: (_cause, _run, write) => { const receipt = take(write()); admissions.add(receipt.fact.id); return f.f.success(receipt); },
    verify: reference => { assert(admissions.has(reference.id)); return f.f.success(reference); } },
  grounding: { owner: 'part-ten', read: unavailable }, settlement: { owner: 'part-eight', read: unavailable },
  control: { owner: 'part-four', verify: unavailable }, exitCheck: { owner: 'part-nine', verify: unavailable } };
const graph = take(createRunGraph(deps));
refuse(graph.open({ ...run, owner: { ...owner, fact: admitted.fact, field: 'owner' } }), /resolved intake accountability/);
const ready = take(graph.open(run)), again = take(graph.open(run));
refuse(append('run-opening', json({ run: id, record: recordWire({ ...run, owner: { ...owner, fact: admitted.fact, field: 'owner' } }) }),
  [ownership.id, opening.id]), /resolved intake accountability/);
assert.equal(ready.head, again.head); assert.equal(ready.run.opening.id, admitted.fact.id); assert.equal(ready.run.owner.id, 'bob');
const rebuilt = take(take(createRunGraph(deps)).read(id)); assert.equal(rebuilt.head, ready.head);
assert.equal(take(store.read()).filter(f => f.kind === 'run-opening').length, 1);
assert.equal(take(store.read()).filter(f => f.kind === 'intake-admitted').length, 1);
assert(!take(store.read()).some(f => f.kind === 'stimulus'));
console.log(JSON.stringify({ intakeCommit, cause: admitted.fact.id, owner: ready.run.owner.id, root: id, state: ready.state, roots: 1, negativeControls: 5 }));
