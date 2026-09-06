import { consumeResult, decode, decodeMeasurement } from '../../src/index.js';
import type { Clock, FactEnvelopeReference, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, SegmentStoragePort } from '../../src/facts/index.js';
import { createRunGraph, recordWire, runFactSchemas, runIdFor } from '../../src/rungraph/index.js';
import type { RunDecodeContext, RunGraphDependencies, RunTransition, RunView } from '../../src/rungraph/index.js';
import { factsFixture, privateKey, json, refused } from '../facts/fixtures.js';
import { digest, value } from '../fixtures.js';
export { value, refused, json, digest };
export const ref = (f: FactEnvelope): FactEnvelopeReference => ({ owner: 'part-two', name: 'FactEnvelope', id: f.id });
export function setup(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = factsFixture(); let now = f.now, liveLease = 'lease:1'; const wire: unknown[] = [];
  const types = { ...f.ctx.decode, provenance: f.bob.provenance,
    register: { ...f.ctx.decode.register, subjects: { ...f.ctx.decode.register.subjects, 'elapsed-time': ['ms'], 'run-work': ['steps'] } } };
  const schemas: FactSchema[] = [
    { ...f.schema, kind: 'stimulus', fields: { intent: { kind: 'constitutional', type: 'Intent' }, owner: { kind: 'constitutional', type: 'VerifiedPrincipal' }, capture: { kind: 'capture' } } },
    { ...f.schema, kind: 'consumption', fields: { worker: { kind: 'text', maxLength: 80 }, harness: { kind: 'text', maxLength: 80 }, hashes: { kind: 'text', maxLength: 65536 }, classes: { kind: 'text', maxLength: 65536 } } },
    { ...f.schema, kind: 'outcome-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' }, outcome: { kind: 'constitutional', type: 'Outcome' } } },
    { ...f.schema, kind: 'evidence-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...f.schema, kind: 'result-record', fields: { result: { kind: 'constitutional', type: 'Result' } } },
    f.schema,
  ];
  const hash = f.capture('request bytes', 'message:1');
  const captures: FactContext['captures'] = { 'message:1': { bytes: 'request bytes', hash, status: 'available', byteLength: 13 } };
  let ctx: FactContext = { ...f.ctx, decode: types, schemas, captures };
  let c: RunDecodeContext = { site: ctx.site, preserved: ctx.preserved, register: types.register, types, facts: ctx,
    stimulusKinds: ['stimulus'], evidenceSources: { settlement: 'probe', exit: 'probe' } };
  const registration = value(runFactSchemas(c));
  ctx = { ...ctx, schemas: [...schemas, ...registration.schemas], ownedBodies: registration.registrations }; c = { ...c, facts: ctx };
  const storage = storageFactory?.({ owner: 'part-ten', read: () => wire, append: (bytes, expected) => {
    if ((wire.at(-1) as { contentHash?: string } | undefined)?.contentHash !== (expected ?? undefined)) throw new Error('storage CAS');
    wire.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' });
  } }) ?? { owner: 'part-ten' as const, read: () => wire, append: (bytes: string) => { wire.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const }); } };
  const store = createFactStore(ctx, storage);
  const append = (kind: string, body: Json, required: readonly string[] = []) => value(authorAndAppend({ kind, body, required, schemaVersion: 1,
    machine: 'machine-a', principal: json(f.bob), provenance: json(f.bob.provenance), at: json(now) }, ctx, store, privateKey));
  const intent = value(decode('Intent', f.intentInput({ principal: f.bob }), types));
  const opening = append('stimulus', json({ intent, owner: f.bob, capture: { reference: 'message:1', hash } })).fact;
  const owner = { type: 'VerifiedPrincipal' as const, id: 'bob', fact: ref(opening), field: 'owner' };
  const id = runIdFor(ref(opening)), binding = { owner: 'part-four', name: 'ConversationBinding', id: 'binding:1' } as const;
  const lease = { owner: 'part-six', name: 'Lease', id: 'lease:1' } as const;
  const run = { type: 'Run', schemaVersion: 1, id, opening: ref(opening), intent: { type: 'Intent', id: intent.id, fact: ref(opening), field: 'intent' },
    directives: [], owner, scope: f.scope, authority: { resolution: ref(opening), grants: [] },
    exitTest: { check: 'probe', version: 'v1', subject: 'artifact', acceptance: digest('complete artifact'), evidenceKinds: ['proof'], freshFor: 1000 },
    budget: { type: 'RunBudget', schemaVersion: 1, id: 'budget:1', bounds: ['bound'], resources: [{ type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'run-work', instance: 'budget:1' }, value: 3, unit: 'steps', at: now, by: 'probe' }],
      maxWorkers: 1, maxProcesses: 1, maxOutstanding: 3, maxChildren: 0, maxDepth: 1, maxAttempts: 3,
      repetitionPolicy: { owner: 'part-six', name: 'LoopPolicy', id: 'loop:1' }, safetyCeiling: f.clock(10000), exhaustedOwner: owner },
    cadence: { bound: 'bound', milliseconds: 3600000 }, nextWake: { owner, at: f.clock(1000), reason: 'continue' }, blockedOn: { kind: 'nothing' },
    resultDestination: { binding, route: ref(opening) }, generation: types.register.generation, createdAt: now, depth: 1 };
  const context = () => ({ ...c, facts: { ...ctx, facts: value(store.read()) } });
  const generation = () => ({ reference: types.register.generation, kinds: ctx.schemas.map(s => s.kind), lineages: {
    'machine-a': { head: { epoch: 0, position: value(store.read()).at(-1)!.segment.position }, observedAt: now.value, closed: false },
  } });
  let groundCounter = 0;
  const admissions = new Set<string>();
  const commit = (write: () => import('../../src/index.js').Result<import('../../src/facts/index.js').AppendReceipt>) => {
    const receipt = value(write()); admissions.add(receipt.fact.id); return f.success(receipt);
  };
  const deps: RunGraphDependencies = { context: c, store, generation, clock: () => now, groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50, briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] },
    writer: { owner: 'part-ten', append: (kind, run, record, required) => f.success(append(kind, json({ run, record: recordWire(record) }), required)) },
    admission: { owner: 'part-six', verify: reference => { if (!admissions.has(reference.id)) throw new Error('not admitted by six'); return f.success(reference); },
      create: (_opening, _run, write) => commit(write), commit: (request, write) => {
      if (request.ownership.id !== liveLease) return consumeResult(value(decode('Result', f.refusedInput({ detail: 'stale fence' }), types)), { Refused: r => r, Success: () => { throw new Error('expected refusal'); } }); return commit(write);
    } },
    grounding: { owner: 'part-ten', read: ({ run: view, worker, harness, reason }) => {
      const messages = [{ fact: ref(opening), sequence: opening.segment.position, capture: 'message:1', hash }];
      const consumption = append('consumption', json({ worker, harness, hashes: JSON.stringify(messages.map(m => m.hash)), classes: JSON.stringify(deps.groundingPolicy.briefingClasses) }));
      return f.success({ type: 'SessionGrounding', schemaVersion: 1, id: `ground:${++groundCounter}`, run: id, expected: view.head, worker, harness, reason,
        at: now, previousActivity: f.now, elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: worker }, value: now.value - f.now.value, unit: 'ms', at: now, by: 'probe' },
        principal: owner, intake: ref(opening), binding, directives: [], generation: types.register.generation,
        frontier: { 'machine-a': { epoch: 0, position: consumption.fact.segment.position } }, knownLineages: ['machine-a'], threshold: 20, messages,
        lastInbound: ref(opening), pendingOperations: view.pending.map(s => s.operation.key), children: [], receipts: [],
        briefingClasses: deps.groundingPolicy.briefingClasses, consumption: ref(consumption.fact) });
    } },
    settlement: { owner: 'part-eight', read: () => { throw new Error('test must supply settlement evidence'); } },
    control: { owner: 'part-four', verify: () => { throw new Error('test must supply verified control'); } },
    exitCheck: { owner: 'part-nine', verify: exit => f.success(exit.check) },
  };
  const graph = value(createRunGraph(deps));
  function start(view: RunView, ground: FactEnvelope, key = 'operation:1') {
    return { type: 'RunTransition', schemaVersion: 1, id: `start:${key}`, run: id, expected: view.head, trigger: ref(opening), kind: 'start', from: view.state, to: 'running',
      responsible: owner, standing: ref(opening), ownership: lease, generation: types.register.generation, at: now,
      blockedOn: { kind: 'step', reference: `step:${key}`, owner, nextObservation: f.clock(1000) }, nextWake: run.nextWake,
      grounding: ref(ground), step: { type: 'RunStep', schemaVersion: 1, id: `step:${key}`, run: id, expected: view.head, kind: 'effect',
        operation: { key, digest: digest({ key, effect: 'test' }), classification: ref(opening) }, evidence: [], directives: [], authorizations: [],
        allocation: { budget: 'budget:1', reservation: { owner: 'part-six', name: 'ResourceReservation', id: `reservation:${key}` } }, ownership: lease,
        resultDestination: run.resultDestination, generation: types.register.generation } };
  }
  const observe = (view: RunView, kind: 'happened' | 'did-not-happen' | 'uncertain' = 'uncertain') => {
    const evidence = value(decode('Evidence', f.evidenceInput({ id: `observation:${view.head}`, observedAt: now, freshFor: 10000 }), types));
    f.evidence.push(evidence);
    const outcome = value(decode('Outcome', f.raw('Outcome', { kind, evidence: [evidence.id] }), { ...types, evidence: [evidence] }));
    const fact = append('outcome-record', json({ evidence, outcome })).fact;
    return { type: 'RunTransition', schemaVersion: 1, id: `observe:${view.head}`, run: id, expected: view.head, trigger: ref(fact), kind: 'observe', from: view.state, to: 'waiting',
      responsible: owner, standing: ref(opening), ownership: lease, generation: types.register.generation, at: now, blockedOn: view.blockedOn, nextWake: run.nextWake,
      affectedStep: view.pending[0]!.id, outcome: { type: 'Outcome', id: `outcome:${fact.id}`, fact: ref(fact), field: 'outcome' } };
  };
  return { ...f, ctx, c, context, wire, store, append, deps, graph, run, id, owner, opening, lease, start, observe, generation, admissions,
    setClock: (n: number) => { now = value(decodeMeasurement('clock', f.clockRaw(n), types)); }, fence: () => { liveLease = 'lease:2'; } };
}
