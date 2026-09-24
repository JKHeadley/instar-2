// @ts-nocheck -- U4-F lifecycle adaptation; Six run admission remains the exact landed fixture binding.
// This NEW fixture leaves the landed source byte-identical and accepts an actual Four prefix.
import { createProductionNativeContextAdapter } from '../../src/assembly/production-native-context.js';
// Standalone bin workers cannot load Vitest's unit-2 assertion instrument.
const groundingCheckpoint = (..._event: unknown[]) => {};
import { canonical, consumeResult, decode, decodeMeasurement } from '../../src/index.js';
import type { Clock, FactEnvelopeReference, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, factId, hashBytes } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, SegmentStoragePort } from '../../src/facts/index.js';
import { createRunGraph, recordWire, runFactSchemas, runIdFor } from '../../src/rungraph/index.js';
import type { RunDecodeContext, RunGraphDependencies, RunTransition, RunView } from '../../src/rungraph/index.js';
import { factsFixture, privateKey, json, refused } from '../facts/fixtures.js';
import { digest, value } from '../fixtures.js';
import { governanceFixture } from '../rungraph/governance-fixture.js';
export { value, refused, json, digest };
export const ref = (f: FactEnvelope): FactEnvelopeReference => ({ owner: 'part-two', name: 'FactEnvelope', id: f.id });
export function createProductionBootOwnerFixture(storageFactory?: (f: ReturnType<typeof factsFixture>) => SegmentStoragePort, options: any = {}) {
  const recovery: any = undefined, stimulus: any = undefined; const seed = options.intake;
/* recovery?: {
  admissions: Set<string>; witness: (id: string) => void; worker: string; harness: string; lease: string;
  message: string;
  afterIntake?: () => void;
}, stimulus?: {
  fields: FactSchema['fields'];
  extra?: Readonly<Record<string, FactSchema['fields']>>;
  body: (tools: { append: (kind: string, body: Json, required?: readonly string[]) => { fact: FactEnvelope };
    intent: unknown; owner: unknown; hash: string }) => Json;
} */
  const f = factsFixture(); const harnessId = options.harness ?? 'native'; f.grant({ id: 'live-input-agent-grant', grantee: f.bob }); let stopped = false; let now = f.now, liveLease = 'lease:1'; const wire: unknown[] = [];
  const types = { ...f.ctx.decode, provenance: f.bob.provenance,
    register: { ...f.ctx.decode.register, generation: seed?.decode.register.generation
      ?? { ...f.ctx.decode.register.generation, id: 'generation:fixture' },
      entries: [...f.ctx.decode.register.entries, 'harness-live-input', 'native-context'], subjects: { ...f.ctx.decode.register.subjects, 'elapsed-time': ['ms'], 'run-work': ['steps'] } } };
  const schemas: FactSchema[] = [
    { ...f.schema, kind: 'stimulus', fields: stimulus?.fields
      ?? { intent: { kind: 'constitutional', type: 'Intent' }, owner: { kind: 'constitutional', type: 'VerifiedPrincipal' }, capture: { kind: 'capture' } } },
    ...Object.entries(stimulus?.extra ?? {}).map(([kind, fields]): FactSchema => ({ ...f.schema, kind, fields })),
    { ...f.schema, kind: 'consumption', fields: { worker: { kind: 'text', maxLength: 80 }, harness: { kind: 'text', maxLength: 80 }, hashes: { kind: 'text', maxLength: 65536 }, classes: { kind: 'text', maxLength: 65536 } } },
    { ...f.schema, kind: 'outcome-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' }, outcome: { kind: 'constitutional', type: 'Outcome' } } },
    { ...f.schema, kind: 'evidence-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...f.schema, kind: 'result-record', fields: { result: { kind: 'constitutional', type: 'Result' } } },
    { ...f.schema, kind: 'next-inbound', fields: { capture: { kind: 'capture' } } },
    { ...f.schema, kind: 'rungraph-briefing-material', fields: { class: { kind: 'text', maxLength: 2048 } } },
    f.schema,
  ];
  const message = recovery?.message ?? 'request bytes', hash = f.capture(message, 'message:1');
  const captures: FactContext['captures'] = { 'message:1': { bytes: message, hash, status: 'available', byteLength: Buffer.byteLength(message) } };
  if (seed) {
    Object.assign(types.captures, seed.decode.captures);
    Object.assign(captures, seed.captures);
    types.register = { ...seed.decode.register, sites: { ...types.register.sites, ...seed.decode.register.sites }, entries: [...new Set([...types.register.entries, ...seed.decode.register.entries])],
      methods: [...new Set([...types.register.methods, ...seed.decode.register.methods])] };
    types.principals = [...types.principals ?? [], ...seed.decode.principals ?? []];
    types.grants = [...types.grants ?? [], ...seed.decode.grants ?? []];
  }
  let ctx: FactContext = { ...f.ctx, decode: types,
    schemas: [...schemas.filter(s => !seed?.schemas.some(t => t.kind === s.kind)), ...seed?.schemas ?? []], captures,
    grants: [...f.ctx.grants, ...seed?.grants ?? []] };
  let c: RunDecodeContext = { intakeOwners: {}, site: ctx.site, preserved: ctx.preserved, register: types.register, types, facts: ctx,
    stimulusKinds: seed ? ['intake-admitted'] : ['stimulus', 'next-inbound'], evidenceSources: { settlement: 'probe', exit: 'probe' } };
  const assemblyHost: any = { machine: 'machine-a', principal: f.bob, scope: f.scope, boundary: { ...f.c, register: types.register },
    current: () => ({ facts: ctx, generation: types.register.generation.id, stopped, clock: now }) };
  const owners = prepareLiveInputOwners(f, types, () => now, () => stopped, () => ctx, harnessId, options.native,
    options.capacityPolicy);
  const registration = value(runFactSchemas(c));
  ctx = { ...ctx, schemas: [...ctx.schemas, ...registration.schemas.filter(s => !ctx.schemas.some(t => t.kind === s.kind)),
    ...assemblySchemas(assemblyHost).filter(s => !ctx.schemas.some(t => t.kind === s.kind)),
    ...owners.schemas.filter(s => !ctx.schemas.some(t => t.kind === s.kind)),
    ...productionSchemas(f).filter(s => !ctx.schemas.some(t => t.kind === s.kind))], ownedBodies: [...(seed?.ownedBodies ?? []).filter((row: any) => !owners.registrations.some((own: any) => own.owner === row.owner && own.name === row.name)), ...registration.registrations, ...value(registerAssemblyBodies(assemblyHost)), ...owners.registrations] }; c = { ...c, facts: ctx };
  if (options.recovery) {
    const saved = options.recovery;
    types.register = saved.register;
    Object.assign(types.captures, saved.captureBytes);
    Object.assign(ctx.captures, Object.fromEntries(Object.entries(saved.captureBytes).map(([reference, bytes]) =>
      [reference, { bytes, hash: hashBytes(bytes), status: 'available', byteLength: Buffer.byteLength(bytes) }])));
    ctx.schemas = [...ctx.schemas.filter(schema => !saved.schemas.some(row => row.kind === schema.kind)), ...saved.schemas];
    c.register = types.register; Object.assign(c.intakeOwners, saved.intakeOwners ?? {});
  }
  options.prepareContext?.(ctx, assemblyHost, f);
  let appendCut: ((record: any) => boolean) | undefined;
  const underlyingStorage = storageFactory?.(f) ?? { owner: 'part-ten' as const, read: () => wire,
    append: (bytes: string, expected: string | null) => {
      if (((wire.at(-1) as any)?.contentHash ?? null) !== expected) throw Error('storage CAS');
      wire.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const }); } };
  const storage = { ...underlyingStorage, append: (bytes: string, expected: string | null) => {
    const envelope = JSON.parse(bytes);
    if (appendCut?.(envelope)) {
      appendCut = undefined;
      groundingCheckpoint('acceptance-append-cut-after-invoke', { calls: owners.events.filter(x => x === 'deliver').length });
      throw Error('injected durable acceptance append cut');
    }
    return underlyingStorage.append(bytes, expected);
  } };
  if (seed && underlyingStorage.read().length === 0) for (const fact of seed.facts)
    value(underlyingStorage.append(value(canonical(fact)).bytes,
      underlyingStorage.read().at(-1)?.contentHash ?? null));
  const store = createFactStore(ctx, storage);
  const append = (kind: string, body: Json, required: readonly string[] = [], schemaVersion = 1) => {
    if (options.recovery) {
      const existing = value(store.read()).find(row => row.kind === kind && value(canonical(row.body)).bytes === value(canonical(body)).bytes);
      if (existing) return { fact: existing, durability: { kind: 'local-durable' } };
    }
    return value(authorAndAppend({ kind, body, required, schemaVersion,
    machine: 'machine-a', principal: json(f.bob), provenance: json(f.bob.provenance), at: json(now) }, ctx, store, privateKey));
  };
  let intent = seed?.opening ? seed.opening.body.intent : value(decode('Intent', f.intentInput({ principal: f.bob }), types));
  if (options.recovery) {
    const rows = value(store.read()), intakeFact = rows.find(row => row.kind === 'intake-admitted'),
      ownerFact = rows.find(row => row.kind === 'stimulus');
    if (intakeFact && ownerFact) c.intakeOwners[intakeFact.body.work.owner] = {
      type: 'VerifiedPrincipal', id: 'bob', fact: ref(ownerFact), field: 'owner' };
  }
  const effects = owners.attach(store);
  const nextPosition = (value(store.read()).at(-1)?.segment.position ?? -1) + 1;
  const predicted = value(store.read()).find(row => row.kind === 'stimulus')?.id ?? factId({ machine: 'machine-a', epoch: 0, position: nextPosition });
  const plannedRun = runIdFor({ owner: 'part-two', name: 'FactEnvelope', id: predicted });
  const initialMessage = effects.message(plannedRun, 'initial');
  const initialCapture = value(owners.host.capture(value(canonical(initialMessage)).bytes));

  // Restart harness reconstructs from the durable cause plus installation policy,
  // never from a Run supplied by its dead caller. Existing input is not reauthored.
  let opening = seed?.opening ?? value(store.read()).find(f => f.kind === 'stimulus')
    ?? (stimulus ? append('stimulus', stimulus.body({ append, intent, owner: f.bob, hash })).fact
      : append('stimulus', json({ intent, owner: f.bob, capture: initialCapture })).fact);
  recovery?.afterIntake?.();
  const ownerFact = seed?.opening ? append('stimulus', json({ intent: value(decode('Intent', f.intentInput({ principal: f.bob }), types)), owner: f.bob, capture: initialCapture })).fact : opening;
  const owner = { type: 'VerifiedPrincipal' as const, id: 'bob', fact: ref(ownerFact), field: 'owner' };
  if (seed?.opening) c.intakeOwners[seed.opening.body.work.owner] = owner;
  let id = runIdFor(ref(opening)); const binding = { owner: 'part-four', name: 'ConversationBinding', id: 'binding:1' } as const;
  const lease = { owner: 'part-six', name: 'Lease', id: effects.leaseFact.id } as const; liveLease = lease.id;
  if (recovery) liveLease = recovery.lease;
  let execution = { worker: recovery?.worker ?? 'w', harness: recovery?.harness ?? harnessId, ownership: { ...lease, id: liveLease }, context: ref(effects.leaseFact) };
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
  let groundCounter = value(store.read()).filter(f => f.kind === 'session-grounding').length;
  const admissions = recovery?.admissions ?? new Set<string>(options.recovery?.admissions ?? []);
  const commit = (write: () => import('../../src/index.js').Result<import('../../src/facts/index.js').AppendReceipt>) => {
    const receipt = value(write()); admissions.add(receipt.fact.id); recovery?.witness(receipt.fact.id); return f.success(receipt);
  };
  const deps: RunGraphDependencies = { governance: governanceFixture(c), context: c, store, generation, clock: () => now, groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50, briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] },
    writer: { owner: 'part-ten', append: (kind, run, record, required) => f.success(append(kind, json({ run, record: recordWire(record) }), required)) },
    admission: { owner: 'part-six', verify: reference => { if (!admissions.has(reference.id)) throw new Error('not admitted by six'); return f.success(reference); },
      execution: (run, ownership) => { if (run !== id || ownership.id !== liveLease) throw new Error('stale execution fence'); return f.success(execution); },
      reservation: (reference, step) => { if (reference.name !== 'AdmissionReservation' || reference.id !== `reservation:${step.operation.key}`) throw new Error('reservation identity mismatch'); return f.success(ref(opening)); },
      create: (_opening, _run, write) => commit(write), commit: (request, write) => {
      if (request.ownership.id !== liveLease) return consumeResult(value(decode('Result', f.refusedInput({ detail: 'stale fence' }), types)), { Refused: r => r, Success: () => { throw new Error('expected refusal'); } }); return commit(write);
    } },
    grounding: { owner: 'part-ten', read: ({ run: view, worker, harness, reason, execution }) => {
      const messages = [{ fact: ref(opening), sequence: opening.segment.position, capture: 'message:1', hash }];
      const consumption = append('consumption', json({ worker, harness, hashes: JSON.stringify(messages.map(m => m.hash)), classes: JSON.stringify(deps.groundingPolicy.briefingClasses) }));
      return f.success({ type: 'SessionGrounding', schemaVersion: 2, id: `ground:${++groundCounter}`, run: id, expected: view.head, worker, harness, reason,
        ownership: execution.ownership, executionContext: execution.context,
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
        allocation: { budget: 'budget:1', reservation: { owner: 'part-six', name: 'AdmissionReservation', id: `reservation:${key}` } }, ownership: lease,
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
  const base = { ...f, ctx, runContext: c, context: ctx, wire, raw: wire, storage, store, append, deps, graph, run, id, owner, opening,
    lease, start, observe, generation, admissions, effects, owners, initialMessage, initialCapture, assemblyHost, host: assemblyHost, harnessId,
    cutAcceptanceOnce: () => { appendCut = row => row.kind === 'assembly-HarnessObservation' && row.body.record.phase === 'input-accepted'; },
    place: (worker: string, harness: string) => {
      effects.renew();
      execution = { worker, harness, ownership: lease, context: ref(effects.leaseFact) };
      groundingCheckpoint('changed-current-six-execution', { old: lease.id, current: effects.leaseFact.id });
    },
    setClock: (n: number) => { now = value(decodeMeasurement('clock', f.clockRaw(n), types)); },
    time: (n: number) => { now = value(decodeMeasurement('clock', f.clockRaw(n), types)); }, stop: (v = true) => { stopped = v; },
  };
  const installed = installAssemblySupport(base, options);
  installed.bindIntake = (fact: any) => {
    if (!options.deferred || (!options.recovery && value(store.read()).some(row => row.kind === 'run-opening'))) throw Error('intake binding already in use');
    if (fact.kind !== 'intake-admitted' || !value(store.read()).some(row => row.id === fact.id)) throw Error('durable Four input required');
    opening = fact; intent = fact.body.intent; id = runIdFor(ref(fact));
    c.intakeOwners[fact.body.work.owner] = owner;
    Object.assign(run, { id, opening: ref(fact), intent: { type: 'Intent', id: intent.id, fact: ref(fact), field: 'intent' },
      authority: { resolution: ref(fact), grants: [] }, resultDestination: { binding, route: ref(fact) } });
    Object.assign(base, { opening, id }); Object.assign(installed, { opening, id });
  };
  return installed;
}

import { assemblySchemas, registerAssemblyBodies, createAssemblySpine, createAssemblyRuntime,
  createNativeHarnessAdapter, createConfinedContextDeliveryDriver, contextDeliveryIdFor } from '../../src/assembly/index.js';
import { createEffectSpine, createEffectDoorway, createHarnessLiveInputExecution, consumeEffectSettlement, decodeOutboundMessage,
  installOperationDefinition, effectSchemas, registerEffectBodies } from '../../src/effects/index.js';
import { createTransportAuthority, createTransportSpine, transportSchemas, registerTransportBodies, decodeLoopPolicy, fenceFor } from '../../src/transport/index.js';
import { assemblyInput } from './fixture.js';
import { productionReferenceKinds } from './round8-extended-fixture.js';

function productionSchemas(f: any) {
  const identity = { id: { kind: 'text', maxLength: 2048 } };
  return [
    ...productionReferenceKinds.filter(kind => kind !== 'transport-Lease').map(kind => ({ ...f.schema, kind, fields: identity })),
    ...['check-run-record', 'verification-ProbeRecord', 'assembly-reference-evidence'].map(kind => ({ ...f.schema, kind, fields: identity })),
    { ...f.schema, kind: 'astra-source-evidence', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...f.schema, kind: 'assembly-measurement-reference', fields: { ...identity, measurement: { kind: 'constitutional', type: 'Measurement' } } },
  ];
}
function prepareLiveInputOwners(f: any, types: any, clock: any, stopped: any, context: any, harnessId: string, native: any,
  capacityPolicy: any) {
  let authority: string[] = [], versions: any[] = [], ordinal = 0;
  const events: string[] = [];
  const host: any = { machine: 'machine-a', incarnation: 'incarnation:one', principal: f.bob, scope: f.scope,
    boundary: { ...f.c, register: types.register }, current: () => ({ decode: types, clock: clock(), stopped: stopped(), authority, versions }),
    capture: (bytes: string) => {
      const hash = hashBytes(bytes), reference = `live-input-capture:${hash}`;
      context().captures[reference] = { hash, bytes, byteLength: Buffer.byteLength(bytes), status: 'available' };
      return f.success({ reference, hash });
    } };
  const transportHost: any = { domain: 'conversation:1', machine: host.machine, incarnation: host.incarnation,
    authorityIncarnation: 'authority:1', principal: host.principal, scope: host.scope, maxLeaseTerm: 1000, budget: 1000,
    ...(capacityPolicy ? { capacityPolicy } : {}),
    monotonic: () => clock().value, current: () => ({ decode: types, clock: clock(), generation: types.register.generation, stopped: stopped() }) };
  return { host, events, schemas: [...effectSchemas(host), ...transportSchemas(transportHost)],
    registrations: [...value(registerEffectBodies(host)), ...value(registerTransportBodies(transportHost, host.boundary, consumeEffectSettlement))],
    attach(store: any) {
      const author = { context: context(), privateKey }; let spine = createEffectSpine(host, author, store);
      let transport = createTransportAuthority(transportHost, createTransportSpine(transportHost, author, store), host.boundary, consumeEffectSettlement);
      const note = value(store.read()).find(row => row.kind === 'note' && row.body.identity === 'live-input-owner-source') ?? value(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: host.machine, principal: json(f.bob),
        provenance: json(f.bob.provenance), at: json(clock()), body: { identity: 'live-input-owner-source', amount: '0' }, required: [] }, context(), store, privateKey)).fact;
      authority = [note.id];
      const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'live-input-definition:1', feature: 'harness-live-input', version: 'live-input-version:1',
        generation: types.register.generation.id, adapter: 'native-context', account: harnessId, conversation: host.incarnation,
        speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash, durability: 'local-durable', replicas: 0,
        lossModel: 'Bounded in-memory or file-backed test custody; no remote durability claim.', maxBytes: 4096, maxCharge: 20, timeout: 100, verificationBar: 'live-input-bar' };
      const approvedIn = f.authorize({ id: 'live-input-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'live-input-base' });
      versions = [{ id: definition.version, subject: definition.feature, content: json(definition), contentHash: value(canonical(definition)).hash,
        since: note.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }];
      const d = value(store.read()).find(row => row.kind === 'effect-OperationDefinition' && row.body.record.id === definition.id)?.body.record
        ?? value(installOperationDefinition(definition, host, spine));
      const existingLease = value(transport.inspect()).filter((row: any) => row.record.type === 'Lease'
        && row.record.state === 'held').at(-1);
      let fence = existingLease ? fenceFor(value(transport.inspect()), existingLease.record)
        : value(transport.acquire('live-input-acquire', '', 500));
      let leaseFact = value(transport.inspect()).filter((row: any) => row.record.type === 'Lease').at(-1)!.fact;
      const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'live-input-policy', maxAttempts: 3,
        minDelay: 10, maxDuration: 1000, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, host.boundary));
      const adapter = native ? createProductionNativeContextAdapter({ id: definition.adapter, harness: harnessId, incarnation: host.incarnation,
        artifact: native.io.current().artifact, maxCharge: definition.maxCharge, timeout: definition.timeout,
        host, authority: transport, store, captures: native.captures, io: native.io }) : { owner: 'part-ten', id: definition.adapter,
        describe: () => ({ contract: 'native-live-input-v1', account: definition.account, conversation: definition.conversation,
          maxCharge: 20, timeout: 100, hiddenRetries: 0 }),
        invoke: (input: any) => {
          const current = value(transport.inspect()).filter((row: any) => row.record.type === 'AdmissionReservation' && row.record.operation === input.operation).at(-1);
          if (current?.record.state !== 'consumed') throw Error('physical invocation preceded durable Six consumption');
          groundingCheckpoint('six-consumed-before-physical-invoke', { operation: input.operation, fact: current.fact.id, digest: input.digest });
          events.push('deliver');
          if (input.message.purpose !== 'context-delivery' || input.message.account !== harnessId
            || input.message.conversation !== host.incarnation) throw Error('wrong physical harness destination');
          return f.success(JSON.stringify({ type: 'harness-context-consumed', operation: input.operation,
            digest: input.digest, processIdentity: 'pid:42:start:1' }));
        }, observe: () => { throw Error('this instrument has no external query operation'); } };
      const assessments = new Map<string, any>();
      // Explicit bounded Nine assessment instrument. Eight still validates its
      // exact operation/digest evidence and issues the settlement Six consumes.
      const assess = (input: any) => {
        const key = input.reservation.operation;
        if (!assessments.has(key)) {
          const evidence = value(decode('Evidence', f.evidenceInput({ id: `live-input-result:${key}`,
            claim: { subject: key, predicate: input.request.digest, value: 'happened' }, strength: 'observation',
            observedAt: clock(), freshFor: 1000 }), types));
          f.evidence.push(evidence);
          const fact = value(authorAndAppend({ kind: 'evidence-record', schemaVersion: 1, machine: host.machine,
            principal: json(f.bob), provenance: json(f.bob.provenance), at: json(clock()), body: json({ evidence }), required: [] }, context(), store, privateKey)).fact;
          assessments.set(key, { ref: { owner: 'part-nine', name: 'VerificationAssessment', id: fact.id },
            view: { outcome: value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: 'happened', evidence: [evidence.id] }, types)),
              finalCharge: 0, delayedExecutionExcluded: true, required: [fact.id] } });
        }
        return assessments.get(key);
      };
      const readAssessment = (reference: any, input: any) => {
        const current = assessments.get(input.reservation.operation);
        if (!current || current.ref.id !== reference.id) throw Error('assessment binding');
        return current.view;
      };
      const composition: any = { host, spine, transport, adapter,
        // Bounded custody/durability instruments validate the exact local bytes.
        durability: { owner: 'part-ten', ensure: (facts: any[]) => f.success(facts.map(fact => {
          const row = value(store.read()).find((r: any) => r.id === fact.id);
          if (!row || value(canonical(row)).bytes !== value(canonical(fact)).bytes) throw Error('durability identity');
          return { fact, taint: [], durability: { kind: 'local-durable' } };
        })) }, custody: { owner: 'part-ten', verify: (captures: any[]) => {
          for (const capture of captures) { const stored = context().captures[capture.reference];
            if (stored?.status !== 'available' || hashBytes(stored.bytes) !== capture.hash) throw Error('capture unavailable'); }
          return f.success(undefined);
        } },
        assessment: { owner: 'part-nine', assess: (input: any) => f.success(assess(input).ref),
          read: (reference: any, input: any) => f.success(readAssessment(reference, input)),
          consumeCurrent: (reference: any, input: any, consume: any) => f.success(consume(readAssessment(reference, input))) } };
      Object.assign(transportHost, { accountingDurability: composition.durability });
      let api = createEffectDoorway(composition), executor = createHarnessLiveInputExecution(api, transportHost);
      const message = (run: string, text: string) => value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1,
        id: `live-input:${++ordinal}`, semanticMessage: `live-input:${ordinal}`, run, speaker: host.principal.id,
        account: definition.account, conversation: definition.conversation, text, purpose: 'context-delivery', sourceResult: note.id }, host));
      const connected = { api, executor, composition, transport, fence, leaseFact, message,
        renew() {
          fence = value(transport.renew('live-input-renew', fence, 500));
          leaseFact = value(transport.inspect()).filter((row: any) => row.record.type === 'Lease').at(-1)!.fact;
          Object.assign(connected, { fence, leaseFact });
        },
        recreate(nextStore: any) {
          store = nextStore;
          spine = createEffectSpine(host, author, store);
          transport = createTransportAuthority(transportHost, createTransportSpine(transportHost, author, store), host.boundary, consumeEffectSettlement);
          Object.assign(composition, { spine, transport });
          api = createEffectDoorway(composition); executor = createHarnessLiveInputExecution(api, transportHost);
          Object.assign(connected, { api, executor, transport });
          return connected;
        },
        prepare(message: any) {
          const previous = value(transport.inspect()).filter((r: any) => r.record.type === 'AdmissionReservation' && r.record.state === 'consumed');
          for (const row of previous) {
            const settled = value(transport.inspect()).some((r: any) => r.record.type === 'SettlementApplication' && r.record.operation === row.record.operation);
            if (!settled) value(transport.settle(fence, value(api.settle(row.record.operation))));
          }
          const run = { owner: 'part-five' as const, name: 'Run' as const, id: message.run };
          if (!value(transport.inspect()).some((r: any) => r.record.type === 'LoopRecord' && r.record.run === run.id))
            value(transport.schedule(`live-input-schedule:${message.id}`, fence, run, policy));
          const obligation = value(transport.inspect()).filter((r: any) => r.record.type === 'LoopRecord').at(-1)!.fact.id;
          const request = value(api.prepare({ definition: d.id, message, run, pending: note.id, attempt: `attempt:${message.id}`,
            verificationOwner: 'live-input-boundary', obligation, closure: [], fence }));
          return { request, ...value(executor.admit(request, fence)) };
        } };
      return connected;
    } };
}
function installAssemblySupport(f: any, options: any) {
  const spine = createAssemblySpine(f.host, { context: f.ctx, privateKey }, f.store);
  // These unrelated platform/model ports retain the existing fixture contract.
  const model: any = { owner: 'part-ten', describe: () => ({ owner: 'part-ten', provider: 'provider', model: 'model', route: 'route',
    automaticRetries: 0, maxInputBytes: 1024, maxOutputBytes: 1024, maxCharge: 1, measured: false, basis: 'fixture' }),
    prepare: () => f.success('{}'), exchange: async () => f.success({ state: 'complete', bytes: '{}', providerOperation: 'provider:1',
      usage: { inputTokens: 1, outputTokens: 1, charge: 1, source: 'fixture' }, retryBlocked: false }) };
  const persistence: any = { owner: 'part-ten', id: 'encrypted-store', describe: () => ({ backend: 'fixture', policy: 'StoreCustodyPolicy',
    encrypted: true, appendAtomic: true }), appendExact: () => { throw Error('not used'); }, readExact: () => { throw Error('not used'); }, flushEvidence: () => { throw Error('not used'); } };
  let posture = 'protected';
  const composition: any = { host: f.host, spine, harnesses: [], model, persistence,
    independentProtection: { owner: 'part-nine', posture: () => f.success(posture) } };
  const runtime = createAssemblyRuntime(composition), c: any = { ...f.host.boundary, history: runtime.history };
  const appendReference = (kind: string, body: any) => f.append(kind, json(body));
  if (!options.minimal) {
  for (const id of ['check-run:context', 'check:unit', 'check:integration', 'check:lifecycle']) appendReference('check-run-record', { id });
  for (const id of ['probe:native', 'probe:1', 'probe:word-count']) appendReference('verification-ProbeRecord', { id });
  appendReference('assembly-reference-evidence', { id: 'bar:isolation' });
  appendReference('assembly-measurement-reference', { id: 'measurement:replay', measurement: f.now });
  value(runtime.record('AdapterEvidenceContract', assemblyInput('AdapterEvidenceContract')));
  value(runtime.record('GrowthPolicy', assemblyInput('GrowthPolicy')));
  }
  const material = f.deps.groundingPolicy.briefingClasses.map((className: string) => f.append('rungraph-briefing-material', { class: className }).fact);
  let launch: any, launchFact: any;
  const ensureLaunch = () => {
  if (launch) return;
  const existing = value(runtime.inspect()).find((row: any) => row.record.type === 'HarnessLaunchSpec'
    && row.record.run === f.id && row.record.incarnation === 'incarnation:one');
  if (existing) { launch = existing.record; launchFact = existing.fact; return; }
  launch = value(runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'), id: 'production-live-input-launch',
    ...(options.native ? { artifactDigest: options.native.io.current().artifact } : {}),
    run: f.id, input: f.opening.id, inputDigest: options.intake ? f.opening.body.rawHash : f.initialCapture.hash, incarnation: 'incarnation:one', harness: f.harnessId }));
  launchFact = value(runtime.inspect()).find((r: any) => r.record.id === launch.id)!.fact;
  };
  if (!options.deferred) ensureLaunch();
  let last: any, mutation = (_s: any, _o: any, _g: any) => {}, serial = 0;
  const groundingFor = ({ spine: selected = spine, scope }: any) => {
    const selectedComposition = selected === spine ? composition : { ...composition, spine: selected };
    const currentRuntime = selected === spine ? runtime : createAssemblyRuntime(selectedComposition);
    const history = currentRuntime.history!;
    if (selected.store !== f.effects.composition.spine.store) f.effects.recreate(selected.store);
    const context = { ...f.host.boundary, history };
    let observationClock: number | undefined;
    const driver = createConfinedContextDeliveryDriver({ runtime: currentRuntime, history, context, clock: () => observationClock ?? f.deps.clock().value,
      liveProcess: { owner: 'part-ten', resolve: l => { f.owners.events.push('live-process'); return f.success({ launch: l.id, run: l.run,
        incarnation: l.incarnation, harness: l.harness, artifactDigest: l.artifactDigest, machine: l.machine, processIdentity: options.native ? options.native.io.current().identity : 'pid:42:start:1' }); } },
      execution: f.effects.executor });
    const harness = createNativeHarnessAdapter({ id: f.harnessId, artifact: options.native ? options.native.io.current().artifact : launch.artifactDigest, platform: 'darwin-arm64', conformance: 'conformance:1',
      context, clock: () => f.deps.clock().value, generation: () => f.run.generation.id, contextDeliveryDriver: driver,
      driver: { owner: 'part-eight', launch: () => { throw Error('launch held; existing process instrument only'); },
        deliver: () => { throw Error('legacy delivery forbidden'); }, observe: () => { throw Error('legacy observation forbidden'); } } });
    composition.harnesses.splice(0, composition.harnesses.length, harness);
    const sample = (request: any, at: any) => {
      ensureLaunch();
      groundingCheckpoint('current-read-sample', { store: selected.store === f.store, generation: f.run.generation.id });
      f.owners.events.push('sample');
      const snapshot = value(selected.store.read()), inputs = snapshot.filter((row: any) => options.intake ? row.kind === 'intake-admitted' : ['stimulus', 'next-inbound'].includes(row.kind));
      const intake = inputs.at(-1)!;
      const captureFor = row => options.intake ? { reference: row.body.rawHash, hash: row.body.rawHash } : row.body.capture;
      const capture = captureFor(intake);
      const manifest = [...inputs.map(row => ({ class: 'message', ...{ reference: captureFor(row).reference, digest: captureFor(row).hash } })),
        ...material.map(row => ({ class: row.body.class, reference: row.id, digest: row.contentHash }))];
      const wireMessage = options.intake ? value(decodeOutboundMessage({ ...f.effects.message(f.id, 'actual delivered Telegram input'),
        sourceResult: intake.id, context: { input: { fact: intake.id, reference: capture.reference, hash: capture.hash }, manifest } }, f.owners.host))
        : JSON.parse(f.ctx.captures[capture.reference].bytes);
      const admitted = f.effects.prepare(wireMessage);
      const previous = value(currentRuntime.inspectCurrent()).filter((r: any) => r.record.type === 'ContextDeliverySpecification').at(-1);
      const spec: any = { type: 'ContextDeliverySpecification', schemaVersion: 1, id: contextDeliveryIdFor(launchFact.id, admitted.operation),
        predecessors: [], dependencyFacts: [], launch: launchFact.id, run: f.id, step: `step:operation:${++serial}`, input: intake.id, inputDigest: capture.hash,
        incarnation: launch.incarnation, harness: launch.harness, artifactDigest: launch.artifactDigest, machine: launch.machine, generation: f.run.generation.id,
        executionContext: f.effects.leaseFact.id, contextManifest: [...inputs.slice(0, 1).map((row: any) => ({ class: 'message', reference: captureFor(row).reference, digest: captureFor(row).hash })),
          ...material.map((row: any) => ({ class: row.body.class, reference: row.id, digest: row.contentHash }))],
        reason: previous ? 'live-input' : 'initial', operation: admitted.operation, claim: admitted.claim,
        previousDelivery: previous?.fact.id ?? '', controlObservation: '' };
      const g: any = { type: 'SessionGrounding', schemaVersion: 2, id: `ground-native:${serial}`, run: f.id, expected: request.run.head,
        worker: request.worker, harness: request.harness, reason: request.reason, step: spec.step, incarnation: spec.incarnation, contextDeliveryReason: spec.reason,
        ownership: request.execution.ownership, executionContext: request.execution.context, at, previousActivity: at,
        elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: request.worker }, value: 0, unit: 'ms', at, by: 'probe' },
        principal: f.owner, intake: ref(intake), binding: f.run.resultDestination.binding, directives: [], generation: f.run.generation,
        frontier: {}, knownLineages: ['machine-a'], threshold: 20,
        messages: inputs.slice(0, 1).map((row: any) => ({ fact: ref(row), sequence: row.segment.position, capture: captureFor(row).reference, hash: captureFor(row).hash })),
        lastInbound: ref(intake), pendingOperations: request.run.pending.map((s: any) => s.operation.key), children: [], receipts: [],
        briefingClasses: f.deps.groundingPolicy.briefingClasses, consumption: ref(intake) };
      // Mutations receive the same opening-only base as the adjudicated review
      // fixture. If a callback leaves a collection alone, sample current inputs.
      // Explicit removals/duplicates remain untouched for the refusal probes.
      const manifestBefore = JSON.stringify(spec.contextManifest), messagesBefore = JSON.stringify(g.messages);
      const observationPatch: any = {}; mutation(spec, observationPatch, g);
      if (JSON.stringify(spec.contextManifest) === manifestBefore) spec.contextManifest = [
        ...inputs.map((row: any) => ({ class: 'message', reference: captureFor(row).reference, digest: captureFor(row).hash })),
        ...material.map((row: any) => ({ class: row.body.class, reference: row.id, digest: row.contentHash }))];
      if (JSON.stringify(g.messages) === messagesBefore) g.messages = inputs.map((row: any) => ({ fact: ref(row), sequence: row.segment.position, capture: captureFor(row).reference, hash: captureFor(row).hash }));
      observationClock = observationPatch.observedAt; delete observationPatch.observedAt;
      last = { spec, grounding: g };
      return f.success({ specification: spec, grounding: (consumption: any) => { groundingCheckpoint('signed-ten-consumption', { fact: consumption.id }); f.owners.events.push('consume');
        const observed = value(history.lookup(consumption.id)).record;
        if (Object.entries(observationPatch).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(observed[key]))) {
          const prior = observed;
          const changed = value(currentRuntime.record('HarnessObservation', { ...prior, ...observationPatch, id: `review-mutation:${prior.id}` }));
          consumption = ref(value(currentRuntime.inspect()).find((row: any) => row.record.id === changed.id)!.fact);
        }
        return ({ ...g, consumption,
        frontier: { 'machine-a': { epoch: 0, position: value(selected.store.read()).find((row: any) => row.id === consumption.id)!.segment.position } } }); } });
    };
    return { spine: selected, runtime: currentRuntime, history, context, harness, driver,
      clock: () => { f.owners.events.push('clock'); return f.deps.clock(); }, sample,
      graphDependencies: { ...f.deps, store: selected.store } };
  };
  return { ...f, spine, composition, runtime, c, appendReference, groundingFor, launch, launchFact,
    protection: (p: string) => { posture = p; }, setMutation: (m: any) => { mutation = m; }, last: () => last };
}
