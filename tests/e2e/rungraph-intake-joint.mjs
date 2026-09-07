import assert from 'node:assert/strict';
import { canonical, consumeResult } from '@instar/constitutional-types';
import { authorAndAppend, createFactStore, hashBytes } from '@instar/constitutional-types/facts';
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
f.context.schemas = [...f.context.schemas, { ...f.f.schema, kind: 'accountable-owner', fields: { principal: { kind: 'constitutional', type: 'VerifiedPrincipal' } } },
  { ...f.f.schema, kind: 'consumption', fields: { worker: { kind: 'text', maxLength: 80 }, harness: { kind: 'text', maxLength: 80 },
    hashes: { kind: 'text', maxLength: 65536 }, classes: { kind: 'text', maxLength: 65536 } } }];
f.context.decode = { ...f.context.decode, register: { ...f.context.decode.register, subjects: { ...f.context.decode.register.subjects, 'run-work': ['steps'], 'elapsed-time': ['ms'] } } };
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
// ---- actual-start grounding through the capture-bearing ancestor (owner decision,
// slice-five-gap option 1): intake-admitted declares NO capture field; the binding
// is carried by its receipt reference, whose intake-receipt schema declares capture.
const lease = { owner: 'part-six', name: 'Lease', id: 'joint-lease:1' };
const execution = { worker: 'joint-worker', harness: 'joint-harness', ownership: lease, context: admitted.fact };
let reservationConsumed = 0, groundCounter = 0;
const receiptFact = () => take(store.read()).find(x => x.id === opening.body.receipt) ?? factContext.facts.find(x => x.id === opening.body.receipt);
const jointMessages = () => { const r = receiptFact();
  return [{ fact: admitted.fact, sequence: opening.segment.position, capture: r.body.capture.reference, hash: r.body.capture.hash }]; };
const briefingClasses = ['identity', 'rules', 'directives', 'pending-work'];
const makeGrounding = (request, messages = jointMessages()) => {
  const consumption = take(append('consumption', { worker: request.worker, harness: request.harness,
    hashes: JSON.stringify(messages.map(m => m.hash)), classes: JSON.stringify(briefingClasses) }, [])).fact;
  return f.f.success({ type: 'SessionGrounding', schemaVersion: 2, id: `joint-ground:${++groundCounter}`, run: id, expected: request.run.head,
    worker: request.worker, harness: request.harness, reason: request.reason, ownership: request.execution.ownership,
    executionContext: request.execution.context, at: f.f.now, previousActivity: f.f.now,
    elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: request.worker }, value: 0, unit: 'ms', at: f.f.now, by: 'probe' },
    principal: owner, intake: admitted.fact, binding: run.resultDestination.binding, directives: [], generation: c.types.register.generation,
    frontier: { 'machine-a': { epoch: consumption.segment.epoch, position: consumption.segment.position } },
    knownLineages: ['machine-a'], threshold: 20, messages, lastInbound: admitted.fact,
    pendingOperations: request.run.pending.map(s => s.operation.key), children: [], receipts: [], briefingClasses, consumption: ref(consumption) });
};
const deps = { context: c, governance: governanceFixture(c), store, clock: () => f.f.now,
  generation: () => ({ reference: c.types.register.generation, kinds: factContext.schemas.map(s => s.kind),
    lineages: { 'machine-a': { head: take(store.read()).at(-1).segment, observedAt: f.f.now.value, closed: false } } }),
  groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50, briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] },
  writer: { owner: 'part-ten', append: (kind, run, record, required) => append(kind, json({ run, record: recordWire(record) }), required) },
  admission: { owner: 'part-six', execution: (run, ownership) => { assert.equal(run, id); assert.equal(ownership.id, lease.id); return f.f.success(execution); },
    reservation: (reference, step) => { assert.equal(reference.name, 'AdmissionReservation'); assert.equal(reference.id, `joint-reservation:${step.operation.key}`);
      reservationConsumed += 1; return f.f.success(ref(ownership)); },
    commit: (_request, write) => { const receipt = take(write()); admissions.add(receipt.fact.id); return f.f.success(receipt); },
    create: (_cause, _run, write) => { const receipt = take(write()); admissions.add(receipt.fact.id); return f.f.success(receipt); },
    verify: reference => { assert(admissions.has(reference.id)); return f.f.success(reference); } },
  grounding: { owner: 'part-ten', read: request => makeGrounding(request) }, settlement: { owner: 'part-eight', read: unavailable },
  control: { owner: 'part-four', verify: unavailable }, exitCheck: { owner: 'part-nine', verify: unavailable } };
const graph = take(createRunGraph(deps));
refuse(graph.open({ ...run, owner: { ...owner, fact: admitted.fact, field: 'owner' } }), /resolved intake accountability/);
const ready = take(graph.open(run)), again = take(graph.open(run));
refuse(append('run-opening', json({ run: id, record: recordWire({ ...run, owner: { ...owner, fact: admitted.fact, field: 'owner' } }) }),
  [ownership.id, opening.id]), /resolved intake accountability/);
assert.equal(ready.head, again.head); assert.equal(ready.run.opening.id, admitted.fact.id); assert.equal(ready.run.owner.id, 'bob');
// ---- the seam under test: the intake-opened run GROUNDS through its receipt ancestor
const groundFact = take(graph.ground(id, 'joint-worker', 'joint-harness', 'start', lease));
assert.equal(groundFact.kind, 'session-grounding');
// Negative control 6: a genuinely-preserved capture the receipt never bound refuses by name.
const otherBytes = 'bytes the receipt never preserved', otherHash = hashBytes(otherBytes);
Object.assign(factContext.captures, { [otherHash]: { bytes: otherBytes, hash: otherHash, status: 'available', byteLength: Buffer.byteLength(otherBytes) } });
const wrongHash = take(createRunGraph({ ...deps, grounding: { owner: 'part-ten',
  read: request => makeGrounding(request, jointMessages().map(m => ({ ...m, capture: otherHash, hash: otherHash }))) } }));
refuse(wrongHash.ground(id, 'joint-worker', 'joint-harness', 'start', lease), /not bound by the capture-bearing stimulus ancestor/);
// The admitted start consumes six's reservation and leaves one pending RunStep.
const step = { type: 'RunStep', schemaVersion: 1, id: 'joint-step:1', run: id, expected: ready.head, kind: 'effect',
  operation: { key: 'joint-operation:1', digest: take(canonical({ key: 'joint-operation:1' })).hash, classification: admitted.fact },
  evidence: [], directives: [], authorizations: [],
  allocation: { budget: 'joint-budget', reservation: { owner: 'part-six', name: 'AdmissionReservation', id: 'joint-reservation:joint-operation:1' } },
  ownership: lease, resultDestination: run.resultDestination, generation: c.types.register.generation };
const running = take(graph.transition({ type: 'RunTransition', schemaVersion: 1, id: 'joint-start:1', run: id, expected: ready.head,
  trigger: admitted.fact, kind: 'start', from: 'ready', to: 'running', responsible: owner, standing: admitted.fact, ownership: lease,
  generation: c.types.register.generation, at: f.f.now, blockedOn: { kind: 'step', reference: 'joint-step:1', owner, nextObservation: f.f.clock(1000) },
  nextWake: run.nextWake, grounding: ref(groundFact), step }));
assert.equal(running.state, 'running'); assert.equal(running.pending.length, 1);
assert.equal(running.pending[0].operation.key, 'joint-operation:1');
assert(reservationConsumed >= 1, 'six reservation consumer was never consulted');
const startFact = take(store.read()).find(x => x.kind === 'run-transition');
assert(startFact.predecessors.required.includes(ownership.id), 'reservation witness missing from admitted causal references');
const rebuilt = take(take(createRunGraph(deps)).read(id)); assert.equal(rebuilt.head, running.head); assert.equal(rebuilt.state, 'running');
assert.equal(take(store.read()).filter(f => f.kind === 'run-opening').length, 1);
assert.equal(take(store.read()).filter(f => f.kind === 'intake-admitted').length, 1);
assert(!take(store.read()).some(f => f.kind === 'stimulus'));
console.log(JSON.stringify({ intakeCommit, cause: admitted.fact.id, owner: ready.run.owner.id, root: id, state: ready.state,
  grounded: groundFact.kind === 'session-grounding', started: running.state, pendingSteps: running.pending.length,
  reservationConsumed: reservationConsumed >= 1, roots: 1, negativeControls: 6 }));
