import { consumeResult, decode, decodeMeasurement } from '../../src/index.js';
import type { FactEnvelopeReference, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, factId, signEnvelope } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, SegmentStoragePort } from '../../src/facts/index.js';
import { createRunClosureGraph, recordWire, runClosureFactSchemas, runFactSchemas, runIdFor } from '../../src/rungraph/index.js';
import type { RunDecodeContext, RunGraphDependencies, RunView } from '../../src/rungraph/index.js';
import { factsFixture, privateKey } from '../facts/fixtures.js';
import { digest, json, ref, value } from './fixtures.js';
import { closureGovernanceFixture } from './closure-governance-fixture.js';

export function setupClosure(extra: Readonly<Record<string, FactSchema['fields']>>,
  storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort,
  withDirective = false) {
  const f = factsFixture();
  let now = f.now;
  let liveLease = 'lease:1';
  const wire: unknown[] = [];
  const types = { ...f.ctx.decode, provenance: f.bob.provenance,
    register: { ...f.ctx.decode.register, subjects: { ...f.ctx.decode.register.subjects,
      'elapsed-time': ['ms'], 'run-work': ['steps'] } } };
  const schemas: FactSchema[] = [
    { ...f.schema, kind: 'stimulus', fields: { intent: { kind: 'constitutional', type: 'Intent' },
      owner: { kind: 'constitutional', type: 'VerifiedPrincipal' }, capture: { kind: 'capture' } } },
    ...Object.entries(extra).map(([kind, fields]): FactSchema => ({ ...f.schema, kind, fields })),
    { ...f.schema, kind: 'consumption', fields: { worker: { kind: 'text', maxLength: 80 },
      harness: { kind: 'text', maxLength: 80 }, hashes: { kind: 'text', maxLength: 65536 },
      classes: { kind: 'text', maxLength: 65536 } } },
    { ...f.schema, kind: 'outcome-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' },
      outcome: { kind: 'constitutional', type: 'Outcome' } } },
    { ...f.schema, kind: 'evidence-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...f.schema, kind: 'result-record', fields: { result: { kind: 'constitutional', type: 'Result' } } },
    f.schema,
  ];
  const message = 'request bytes';
  const hash = f.capture(message, 'message:1');
  const captures: FactContext['captures'] = {
    'message:1': { bytes: message, hash, status: 'available', byteLength: Buffer.byteLength(message) },
  };
  let ctx: FactContext = { ...f.ctx, decode: types, schemas, captures };
  let c: RunDecodeContext = { site: ctx.site, preserved: ctx.preserved, register: types.register,
    types, facts: ctx, stimulusKinds: ['stimulus'], evidenceSources: { settlement: 'probe', exit: 'probe' } };
  const legacy = value(runFactSchemas(c));
  const provisional: FactContext = { ...ctx, schemas: [...schemas, ...legacy.schemas], ownedBodies: legacy.registrations };
  c = { ...c, facts: provisional };
  const closure = value(runClosureFactSchemas(c));
  ctx = { ...provisional, schemas: [...provisional.schemas, ...closure.schemas],
    ownedBodies: [...legacy.registrations, ...closure.registrations] };
  c = { ...c, facts: ctx };
  const fallback: SegmentStoragePort = { owner: 'part-ten', read: () => wire, append: bytes => {
    wire.push(JSON.parse(bytes));
    return f.success({ kind: 'local-durable' as const });
  } };
  const storage = storageFactory?.(fallback) ?? fallback;
  const store = createFactStore(ctx, storage);
  const appendAs = (kind: string, body: Json, required: readonly string[] = [], schemaVersion = 1,
    author: Readonly<{ principal: unknown; provenance: unknown }> = { principal: f.bob, provenance: f.bob.provenance }) =>
    value(authorAndAppend({ kind, body, required, schemaVersion, machine: 'machine-a', principal: json(author.principal),
      provenance: json(author.provenance), at: json(now) }, ctx, store, privateKey));
  const append = (kind: string, body: Json, required: readonly string[] = [], schemaVersion = 1) =>
    appendAs(kind, body, required, schemaVersion);
  const replicateAs = (kind: string, body: Json, required: readonly string[],
    author: Readonly<{ principal: unknown; provenance: unknown }>) => {
    const previous = value(store.read()).filter(fact => fact.machine === 'machine-a').at(-1);
    const segment = { machine: 'machine-a', epoch: 0, position: previous ? previous.segment.position + 1 : 0 };
    const input = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind,
      schemaVersion: 1, at: now, machine: 'machine-a', principal: author.principal, provenance: author.provenance,
      segment, prevInSegment: previous?.contentHash ?? ctx.genesis.hash,
      predecessors: { inSegment: previous?.id ?? null, frontier: {}, required }, body }, privateKey);
    return value(store.append(input, { peer: 'machine-a' }));
  };
  const directive = withDirective
    ? value(decode('Directive', f.directiveInput({ id: 'directive:initial', principal: f.alice }), types))
    : undefined;
  if (directive) f.directives.push(directive);
  const grantFact = directive ? replicateAs('grant-record', json({ grant: f.grants[0]! }), [],
    { principal: f.alice, provenance: f.grants[0]!.source }).fact : undefined;
  const directiveFact = directive && grantFact ? replicateAs('directive-record', json({ directive }), [grantFact.id],
    { principal: f.alice, provenance: f.alice.provenance }).fact : undefined;
  const directives = directive && directiveFact
    ? [{ type: 'Directive' as const, id: directive.id, fact: ref(directiveFact), field: 'directive' as const }]
    : [];
  const intent = value(decode('Intent', f.intentInput({ principal: f.bob,
    ...(directive ? { under: [directive.id] } : {}) }), types));
  const opening = append('stimulus', json({ intent, owner: f.bob,
    capture: { reference: 'message:1', hash } })).fact;
  const owner = { type: 'VerifiedPrincipal' as const, id: 'bob', fact: ref(opening), field: 'owner' };
  const id = runIdFor(ref(opening));
  const binding = { owner: 'part-four', name: 'ConversationBinding', id: 'binding:1' } as const;
  const lease = { owner: 'part-six', name: 'Lease', id: 'lease:1' } as const;
  let execution = { worker: 'w', harness: 'h', ownership: { ...lease, id: liveLease }, context: ref(opening) };
  const run = { type: 'Run', schemaVersion: 1, id, opening: ref(opening),
    intent: { type: 'Intent', id: intent.id, fact: ref(opening), field: 'intent' }, directives, owner,
    scope: f.scope, authority: { resolution: ref(opening), grants: [] },
    exitTest: { check: 'probe', version: 'v1', subject: 'artifact', acceptance: digest('complete artifact'),
      evidenceKinds: ['proof'], freshFor: 1000 },
    budget: { type: 'RunBudget', schemaVersion: 1, id: 'budget:1', bounds: ['bound'],
      resources: [{ type: 'Measurement', schemaVersion: 1, subject: { kind: 'run-work', instance: 'budget:1' },
        value: 3, unit: 'steps', at: now, by: 'probe' }], maxWorkers: 1, maxProcesses: 1,
      maxOutstanding: 3, maxChildren: 0, maxDepth: 1, maxAttempts: 3,
      repetitionPolicy: { owner: 'part-six', name: 'LoopPolicy', id: 'loop:1' },
      safetyCeiling: f.clock(10000), exhaustedOwner: owner }, cadence: { bound: 'bound', milliseconds: 3600000 },
    nextWake: { owner, at: f.clock(1000), reason: 'continue' }, blockedOn: { kind: 'nothing' },
    resultDestination: { binding, route: ref(opening) }, generation: types.register.generation,
    createdAt: now, depth: 1 } as const;
  const context = (): RunDecodeContext => ({ ...c, facts: { ...ctx, facts: value(store.read()) } });
  const generation = () => ({ reference: types.register.generation, kinds: ctx.schemas.map(schema => schema.kind),
    lineages: { 'machine-a': { head: { epoch: 0, position: value(store.read()).at(-1)!.segment.position },
      observedAt: now.value, closed: false } } });
  let groundCounter = 0;
  const admissions = new Set<string>();
  const commit = (write: () => import('../../src/index.js').Result<import('../../src/facts/index.js').AppendReceipt>) => {
    const receipt = value(write());
    admissions.add(receipt.fact.id);
    return f.success(receipt);
  };
  const deps: RunGraphDependencies = { governance: closureGovernanceFixture(c), context: c, store, generation,
    clock: () => now, groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50,
      briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] },
    writer: { owner: 'part-ten', append: (kind, runId, record, required) =>
      f.success(append(kind, json({ run: runId, record: recordWire(record) }), required)) },
    admission: { owner: 'part-six', verify: reference => {
      if (!admissions.has(reference.id)) throw new Error('not admitted by six');
      return f.success(reference);
    }, execution: (runId, ownership) => {
      if (runId !== id || ownership.id !== liveLease) throw new Error('stale execution fence');
      return f.success(execution);
    }, reservation: (reference, step) => {
      if (reference.name !== 'AdmissionReservation' || reference.id !== `reservation:${step.operation.key}`)
        throw new Error('reservation identity mismatch');
      return f.success(ref(opening));
    }, create: (_opening, _run, write) => commit(write), commit: (request, write) => {
      if (request.ownership.id !== liveLease) return consumeResult(value(decode('Result',
        f.refusedInput({ detail: 'stale fence' }), types)), { Refused: refusal => refusal,
        Success: () => { throw new Error('expected refusal'); } });
      return commit(write);
    } },
    grounding: { owner: 'part-ten', read: ({ run: view, worker, harness, reason, execution: observed }) => {
      const messages = [{ fact: ref(opening), sequence: opening.segment.position, capture: 'message:1', hash }];
      const consumption = append('consumption', json({ worker, harness,
        hashes: JSON.stringify(messages.map(item => item.hash)),
        classes: JSON.stringify(deps.groundingPolicy.briefingClasses) }));
      return f.success({ type: 'SessionGrounding', schemaVersion: 2, id: `ground:${++groundCounter}`, run: id,
        expected: view.head, worker, harness, reason, ownership: observed.ownership,
        executionContext: observed.context, at: now, previousActivity: f.now,
        elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: worker },
          value: now.value - f.now.value, unit: 'ms', at: now, by: 'probe' }, principal: owner,
        intake: ref(opening), binding, directives, generation: types.register.generation,
        frontier: { 'machine-a': { epoch: 0, position: consumption.fact.segment.position } },
        knownLineages: ['machine-a'], threshold: 20, messages, lastInbound: ref(opening),
        pendingOperations: view.pending.map(step => step.operation.key), children: [], receipts: [],
        briefingClasses: deps.groundingPolicy.briefingClasses, consumption: ref(consumption.fact) });
    } }, settlement: { owner: 'part-eight', read: () => { throw new Error('test must supply settlement evidence'); } },
    control: { owner: 'part-four', verify: () => f.success(ref(opening)) },
    exitCheck: { owner: 'part-nine', verify: exit => f.success(exit.check) } };
  const sendWitnesses = new Set<string>();
  const closureDeps = { ...deps, continuitySend: { owner: 'part-eight' as const,
    verify: (send: FactEnvelopeReference) => {
      if (!sendWitnesses.has(send.id)) throw new Error('send lacks effect-owner witness');
      return f.success(send);
    } } };
  const graph = value(createRunClosureGraph(closureDeps));
  function start(view: RunView, ground: FactEnvelope, key = 'operation:1') {
    return { type: 'RunTransition', schemaVersion: 1, id: `start:${key}`, run: id, expected: view.head,
      trigger: ref(opening), kind: 'start', from: view.state, to: 'running', responsible: owner,
      standing: ref(opening), ownership: lease, generation: types.register.generation, at: now,
      blockedOn: { kind: 'step', reference: `step:${key}`, owner, nextObservation: f.clock(1000) },
      nextWake: run.nextWake, grounding: ref(ground), step: { type: 'RunStep', schemaVersion: 1,
        id: `step:${key}`, run: id, expected: view.head, kind: 'effect', operation: { key,
          digest: digest({ key, effect: 'test' }), classification: ref(opening) }, evidence: [], directives: [],
        authorizations: [], allocation: { budget: 'budget:1', reservation: { owner: 'part-six',
          name: 'AdmissionReservation', id: `reservation:${key}` } }, ownership: lease,
        resultDestination: run.resultDestination, generation: types.register.generation } } as const;
  }
  const observe = (view: RunView, kind: 'happened' | 'did-not-happen' | 'uncertain' = 'uncertain') => {
    const evidence = value(decode('Evidence', f.evidenceInput({ id: `observation:${view.head}`,
      observedAt: now, freshFor: 10000 }), types));
    f.evidence.push(evidence);
    const outcome = value(decode('Outcome', f.raw('Outcome', { kind, evidence: [evidence.id] }),
      { ...types, evidence: [evidence] }));
    const fact = append('outcome-record', json({ evidence, outcome })).fact;
    return { type: 'RunTransition', schemaVersion: 1, id: `observe:${view.head}`, run: id,
      expected: view.head, trigger: ref(fact), kind: 'observe', from: view.state, to: 'waiting',
      responsible: owner, standing: ref(opening), ownership: lease, generation: types.register.generation,
      at: now, blockedOn: view.blockedOn, nextWake: run.nextWake, affectedStep: view.pending[0]!.id,
      outcome: { type: 'Outcome', id: `outcome:${fact.id}`, fact: ref(fact), field: 'outcome' } } as const;
  };
  return { ...f, ctx, c, context, wire, store, append, deps: closureDeps, graph, run, id, owner, opening,
    directive, directiveFact, grantFact,
    lease, start, observe, generation, admissions, sendWitnesses,
    setClock: (next: number) => { now = value(decodeMeasurement('clock', f.clockRaw(next), types)); },
    fence: () => { liveLease = 'lease:2'; execution = { ...execution, worker: 'replacement', harness: 'h2',
      ownership: { ...lease, id: liveLease } }; },
    place: (worker: string, harness: string) => { execution = { worker, harness,
      ownership: { ...lease, id: liveLease }, context: ref(append('note',
        json({ identity: `${worker}:${harness}`, amount: '0' })).fact) }; } };
}
