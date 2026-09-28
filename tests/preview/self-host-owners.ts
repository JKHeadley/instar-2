// @ts-nocheck -- preview composition over the owners' public constructors; the named stand-ins are listed below.
// Rules 2, 26, 55, 68, 115 (D14 §§3-4, 9; D17 §2): the self-hosting harness's admitted execution.
// Every process the harness runs is dispatched only after its durable cause exists in one signed
// store: Five's Run, Eight's approved native-launch definition and recorded request, Six's prepared
// reservation naming that request (with its charge), dispatch claim and consumed successor, and Ten's
// HarnessLaunchSpec naming that prepared fact and the recorded input digest. Launch and observation go
// through the existing S8 production launch boundary (`createProductionLaunchBoundary`), which
// resolves the exact specification, request, claim and consumed successor from the store and asks the
// existing M1 monitor service; the M1 service decides durably in its journal before any process starts
// and consults the existing fixed reader (`createProductionMonitorContext`) for Six's current
// admission, stop and placement. Every provider attempt goes through the existing Seven/Eight provider
// owners (`dispatchOwnedProvider` below), which record the exact submitted bytes and Eight's provider
// request before Six's charge and before any call.
//
// Stand-ins, named where the repository's own M1/S8 tests name them (fixed-installation-live.test.ts):
// - the owners' decode context, verified principal and signing key are the preview's shared test
//   context (tests/facts/fixtures.ts, as stage2-owners.ts uses), and the fixture operator approves each
//   store's native-launch definition (not the executing agent); no installed production decode
//   context or machine key exists on this preview host, and the Six loop clock is logical;
// - lane A's capacity reader is not landed: the capacity head names a real signed fact of this store;
// - the fixed monitor daemon and its operator-installed trust are held (deploy/macos/fixed-worker):
//   the M1 service runs in this process with a per-run key, and the release leaf is this preview's
//   confined spawn. None of these is presented as installed production evidence.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { canonical, decode, decodeMeasurement } from '../../src/index.js';
import { authorAndAppend, hashBytes, createFactStore, factId } from '../../src/facts/index.js';
import { createRunGraph, recordWire, runFactSchemas, runIdFor } from '../../src/rungraph/index.js';
import { createProductionRunAdmission, createTransportAuthority, createTransportSpine, decodeLoopPolicy,
  registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import { consumeEffectSettlement, createEffectSpine, effectSchemas, installNativeLaunchDefinition, nativeProcessMigrations, nativeProcessSchemas,
  recordNativeConfinedLaunchRequest, registerEffectBodies } from '../../src/effects/index.js';
import { assemblySchemas, createAssemblyRuntime, createAssemblySpine, registerAssemblyBodies } from '../../src/assembly/index.js';
import { openProductionStorage, openProductionStorageReader } from '../../src/assembly/production-storage.js';
import { createProductionMonitorContext } from '../../src/assembly/production-monitor-context.js';
import { createProductionLaunchBoundary } from '../../src/assembly/production-launch-boundary.js';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { createMonitorService, initializeJournal, OfflineJournal } from '../../scripts/fixed-native-worker-monitor.mjs';
import { factsFixture, privateKey, json } from '../facts/fixtures.js';
import { governanceFixture } from '../rungraph/governance-fixture.js';
import { assemblyInput } from '../assembly/fixture.js';
import { createProviderOwners } from './provider-owners.js';
import { OWNER_WINDOW_MS } from './stage2-provider.js';

const take = result => { if (result.kind !== 'Success') throw Error(`self-host: refused ${result.detail ?? ''}`); return result.value; };
const canonicalHash = value => take(canonical(value)).hash;
/** Eight's native launch operation and the executor it names (both in this composition's register). */
const NATIVE = 'native-confined-launch', EXECUTOR = 'native-self-host-executor';
const ENVIRONMENT = '[]', ENVIRONMENT_CAPTURE = 'capture:self-host-empty-environment';
const MACHINE = 'machine-a', STORE = 'store:self-host', WORKER_INSTANCE = 'worker-control-allocation:self-host-stand-in';
const writeOnce = (path, bytes) => { const fd = openSync(path, 'wx', 0o600); try { writeSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); } };

/** The per-root storage key: machine-local custody, created once, never logged. */
function storageKey(root) {
  const directory = join(root, 'owners'); mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, '.storage-key');
  if (!existsSync(path)) writeOnce(path, randomBytes(32).toString('hex'));
  return Buffer.from(readFileSync(path, 'utf8'), 'hex');
}

/**
 * Five, Six and Ten over one signed store (the constructors the live-input owner fixture composes,
 * without its test-evidence instrumentation): the Run, its opening, the lease, the transport
 * authority and the assembly runtime that records HarnessLaunchSpec facts.
 */
function composeOwnerRun(storageFactory, harness) {
  const f = factsFixture(); f.grant({ id: 'self-host-agent-grant', grantee: f.bob });
  let stopped = false, now = f.now;
  const types = { ...f.ctx.decode, provenance: f.bob.provenance,
    register: { ...f.ctx.decode.register, generation: { ...f.ctx.decode.register.generation, id: 'generation:self-host' },
      entries: [...f.ctx.decode.register.entries, 'self-host', NATIVE, EXECUTOR], subjects: { ...f.ctx.decode.register.subjects, 'elapsed-time': ['ms'], 'run-work': ['steps'] } } };
  const schemas = [{ ...f.schema, kind: 'stimulus', fields: { intent: { kind: 'constitutional', type: 'Intent' },
    owner: { kind: 'constitutional', type: 'VerifiedPrincipal' }, capture: { kind: 'capture' } } }, f.schema];
  const request = 'self-host operation', hash = f.capture(request, 'message:1');
  let ctx = { ...f.ctx, decode: types, schemas, captures: { 'message:1': { bytes: request, hash, status: 'available', byteLength: Buffer.byteLength(request) },
    [ENVIRONMENT_CAPTURE]: { bytes: ENVIRONMENT, hash: hashBytes(ENVIRONMENT), status: 'available', byteLength: Buffer.byteLength(ENVIRONMENT) } } };
  let c = { site: ctx.site, preserved: ctx.preserved, register: types.register, types, facts: ctx, stimulusKinds: ['stimulus'], evidenceSources: { exit: 'probe' } };
  const boundary = { ...f.c, register: types.register };
  const host = { machine: MACHINE, incarnation: 'incarnation:self-host', principal: f.bob, scope: f.scope, boundary,
    current: () => ({ facts: ctx, decode: types, generation: types.register.generation.id, stopped, clock: now }) };
  const transportHost = { domain: 'self-host', machine: MACHINE, incarnation: host.incarnation, authorityIncarnation: 'authority:self-host',
    principal: f.bob, scope: f.scope, maxLeaseTerm: 1000, budget: 1000, monotonic: () => now.value,
    current: () => ({ decode: types, clock: now, generation: types.register.generation, stopped }) };
  // Eight's host: the executing agent (not the definition's approver), live stop, the current approved versions.
  let versions = [], authority = [];
  const effectHost = { machine: MACHINE, incarnation: host.incarnation, principal: f.bob, scope: f.scope, boundary,
    current: () => ({ decode: types, clock: now, stopped, versions, authority }),
    capture: bytes => f.success({ reference: `capture:${hashBytes(bytes)}`, hash: f.capture(bytes, `capture:${hashBytes(bytes)}`) }) };
  const registration = take(runFactSchemas(c));
  ctx = { ...ctx, schemas: [...schemas, ...registration.schemas, ...assemblySchemas(host), ...transportSchemas(transportHost),
    ...effectSchemas(effectHost), ...nativeProcessSchemas(effectHost)], migrations: [...(ctx.migrations ?? []), ...nativeProcessMigrations],
    ownedBodies: [...registration.registrations, ...take(registerAssemblyBodies(host)), ...take(registerTransportBodies(transportHost, boundary, consumeEffectSettlement)),
      ...take(registerEffectBodies(effectHost))] };
  c = { ...c, facts: ctx };
  const store = createFactStore(ctx, storageFactory(c));
  const append = (kind, body) => take(authorAndAppend({ kind, body, required: [], schemaVersion: 1, machine: MACHINE, principal: json(f.bob),
    provenance: json(f.bob.provenance), at: json(now) }, ctx, store, privateKey));
  const transport = createTransportAuthority(transportHost, createTransportSpine(transportHost, { context: ctx, privateKey }, store), boundary, consumeEffectSettlement);
  const intent = take(decode('Intent', f.intentInput({ principal: f.bob }), types));
  const position = (take(store.read()).at(-1)?.segment.position ?? -1) + 1;
  const planned = runIdFor({ owner: 'part-two', name: 'FactEnvelope', id: factId({ machine: MACHINE, epoch: 0, position }) });
  const opening = append('stimulus', json({ intent, owner: f.bob, capture: { reference: 'message:1', hash } })).fact;
  const reference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
  const owner = { type: 'VerifiedPrincipal', id: f.bob.id, fact: reference(opening), field: 'owner' };
  const id = runIdFor(reference(opening));
  if (id !== planned) throw Error('self-host: run identity moved');
  authority = [opening.id];
  const fence = take(transport.acquire('self-host-acquire', '', 500));
  const binding = { owner: 'part-four', name: 'ConversationBinding', id: 'binding:self-host' };
  const run = { type: 'Run', schemaVersion: 1, id, opening: reference(opening), intent: { type: 'Intent', id: intent.id, fact: reference(opening), field: 'intent' },
    directives: [], owner, scope: f.scope, authority: { resolution: reference(opening), grants: [] },
    exitTest: { check: 'probe', version: 'v1', subject: 'artifact', acceptance: hashBytes('exit observed'), evidenceKinds: ['proof'], freshFor: 1000 },
    budget: { type: 'RunBudget', schemaVersion: 1, id: 'budget:self-host', bounds: ['bound'], resources: [{ type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'run-work', instance: 'budget:self-host' }, value: 1, unit: 'steps', at: now, by: 'probe' }],
      maxWorkers: 1, maxProcesses: 1, maxOutstanding: 1, maxChildren: 0, maxDepth: 1, maxAttempts: 1,
      repetitionPolicy: { owner: 'part-six', name: 'LoopPolicy', id: 'self-host-policy' }, safetyCeiling: f.clock(10000), exhaustedOwner: owner },
    cadence: { bound: 'bound', milliseconds: 3600000 }, nextWake: { owner, at: f.clock(1000), reason: 'continue' }, blockedOn: { kind: 'nothing' },
    resultDestination: { binding, route: reference(opening) }, generation: types.register.generation, createdAt: now, depth: 1 };
  const generation = () => ({ reference: types.register.generation, kinds: [...new Set(ctx.schemas.map(schema => schema.kind))],
    lineages: { [MACHINE]: { head: { epoch: 0, position: take(store.read()).at(-1).segment.position }, observedAt: now.value, closed: false } } });
  const unused = name => ({ read: () => { throw Error(`self-host: ${name} is not part of a launch composition`); } });
  const deps = { governance: governanceFixture(c), context: c, store, generation, clock: () => now,
    groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50, briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] },
    writer: { owner: 'part-ten', append: (kind, runId, record, required) => f.success(take(authorAndAppend({ kind, body: json({ run: runId, record: recordWire(record) }),
      required, schemaVersion: 1, machine: MACHINE, principal: json(f.bob), provenance: json(f.bob.provenance), at: json(now) }, ctx, store, privateKey))) },
    grounding: { owner: 'part-ten', ...unused('grounding') }, settlement: { owner: 'part-eight', ...unused('settlement') },
    control: { owner: 'part-four', verify: () => { throw Error('self-host: no operator control in a launch composition'); } },
    exitCheck: { owner: 'part-nine', verify: exit => f.success(exit.check) } };
  const runtime = createAssemblyRuntime({ host, spine: createAssemblySpine(host, { context: ctx, privateKey }, store), harnesses: [],
    model: null, persistence: null, independentProtection: { owner: 'part-nine', posture: () => f.success('protected') } });
  const effectSpine = createEffectSpine(effectHost, { context: ctx, privateKey }, store);
  /**
   * Eight's native-launch definition for this store's one launch, as approved content: the approver
   * is the fixture operator (not the executing agent), bound to the exact definition bytes.
   */
  const installDefinition = definition => {
    const approvedIn = f.authorize({ id: `approval:${definition.id}`, artifact: f.capture(take(canonical(definition)).bytes), base: `base:${definition.id}` });
    versions = [{ id: definition.version, subject: definition.feature, content: json(definition), contentHash: canonicalHash(definition),
      since: opening.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }];
    return take(installNativeLaunchDefinition(definition, effectHost, effectSpine));
  };
  return { c, ctx, store, deps, run, opening, success: f.success, host, runtime, harness,
    transport, fence, incarnation: host.incarnation, principal: f.bob.id, scopeHash: canonicalHash(f.scope),
    effectHost, effectSpine, installDefinition, generationId: types.register.generation.id,
    stop: value => { stopped = value; },
    time: value => { now = take(decodeMeasurement('clock', f.clockRaw(value), types)); } };
}

/**
 * One harness run's owner composition, in its own signed store under `root/owners/<invocation>`.
 * `leaf` is the physical release leaf ({ start(closure, identity), observe(identity) }).
 */
export function createSelfHostOwners({ root, invocation, harness, digests, bootId, stopped, leaf, now = () => Date.now() }) {
  const key = storageKey(root), directory = join(root, 'owners', invocation);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const dir = realpathSync(directory);
  let writer;
  const f = composeOwnerRun(c => { writer = take(openProductionStorage({ root: dir, machine: MACHINE, key,
    policy: 'policy:self-host', store: STORE, context: c, io: productionStorageIO })); return writer.segment; }, harness);
  const sync = () => { f.stop(stopped()); if (stopped()) throw Error('self-host: stop latched'); };
  const admission = createProductionRunAdmission({ authority: f.transport, store: f.store, context: f.c });
  const graph = take(createRunGraph({ ...f.deps, admission }));
  const opened = take(graph.open(f.run)), run = opened.run.id;
  const transport = () => f.transport, fence = () => f.fence;
  take(transport().schedule(`self-host-schedule:${invocation}`, fence(), { owner: 'part-five', name: 'Run', id: run },
    take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'self-host-policy', maxAttempts: 64, minDelay: 1, maxDuration: 100,
      timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, f.c))));
  const installation = `installation:self-host:${invocation}`, clockReference = 'clock:self-host-wall';
  const genesis = { installation, machine: MACHINE, journal: `journal:${invocation}` };
  const journalPath = join(dir, 'monitor.journal');
  if (!existsSync(journalPath)) initializeJournal(journalPath, genesis);
  const keys = generateKeyPairSync('ed25519'), keyId = `key:${invocation}`;
  const view = take(openProductionStorageReader({ root: dir, machine: MACHINE, key, store: STORE, context: f.c, io: productionStorageIO }));
  key.fill(0);
  const standInA = f.opening.id;
  const capacity = { inspectCapacity: () => f.success({ sourceFrontier: take(transport().inspect()).at(-1).fact.id,
    heads: [{ capacity: 'capacity:self-host-stand-in', fact: standInA, usable: true, blocker: null,
      record: { type: 'CapacityReservation', instance: WORKER_INSTANCE, installation, machine: MACHINE, state: 'held' } }] }) };
  const watermark = () => { const all = take(f.store.read()); return { records: all.length, head: all.at(-1).id }; };
  const reader = take(createProductionMonitorContext({ installation, machine: MACHINE, facts: f.ctx, storage: view,
    authority: f.transport, current: () => f.host.current(), capacity, workerCapacityInstance: WORKER_INSTANCE, watermark, context: f.c }));
  const service = createMonitorService({ installation, machine: MACHINE, bootId, digests, clockReference, now, keyId,
    privateKey: keys.privateKey, journal: new OfflineJournal(journalPath, undefined, { established: true }), journalGenesis: genesis,
    context: reader, release: leaf });
  const trust = () => ({ keyId, publicKey: keys.publicKey, ...digests, currentBootId: bootId, clockReference, now: now(),
    authorityValidUntil: now() + 3_600_000, millisecondsPerUnit: 1 });
  const s8 = createProductionLaunchBoundary(f.c, { installation, machine: MACHINE, store: createFactStore(f.ctx, view.segment),
    client: { roundTrip: bytes => service.handle(bytes) }, trust, generation: () => f.host.current().generation });
  const fresh = () => { take(view.refresh()); };
  const specs = new Map(), plans = new Map();
  let ordinal = 0;

  /** Six prepared → claimed → consumed for one operation, with its charge; returns the tuple. */
  const reserve = (kind, payloadDigest, semanticMessage, request, attempt) => {
    sync();
    const n = ++ordinal;
    const prepared = take(transport().reserve({ command: `self-host-${kind}-reserve:${n}`, fence: fence(),
      request: { owner: 'part-eight', name: 'EffectRequest', id: request }, attempt,
      payloadDigest, charge: 1, run: { owner: 'part-five', name: 'Run', id: run }, semanticMessage, durability: 'local-durable', replicas: 0 }));
    const row = take(transport().inspect()).find(entry => entry.record.type === 'AdmissionReservation'
      && entry.record.operation === prepared.operation && entry.record.state === 'prepared');
    return { n, prepared, row };
  };
  const claimAndConsume = prepared => {
    sync();
    const claim = take(transport().claim(`self-host-claim:${prepared.operation}`, fence(), prepared.operation));
    take(transport().consume(claim, fence()));
    const rows = take(transport().inspect()).filter(entry => entry.record.type === 'AdmissionReservation' && entry.record.operation === prepared.operation);
    return { claim, claimFact: rows.at(-2).fact.id, consumedFact: rows.at(-1).fact.id };
  };

  return Object.freeze({
    run, dir, installation, context: { c: f.c, ctx: f.ctx },
    /**
     * Admits this store's one process (D14 §3, the purpose's durable-cause rule): the plan's exact
     * bytes are recorded first; Eight's approved native-launch definition is installed; Six reserves
     * the charge naming Eight's request; Ten's HarnessLaunchSpec names that prepared fact and the plan
     * digest; Eight records the request itself (its parameters are the reservation's digest and its
     * closure names the Run opening, the reservation, the specification and the Six obligation); only
     * then is the claim taken and consumed. Nothing is launched here.
     */
    admitLaunch({ plan, target, workingScope, portHandles, wallMs, artifact }) {
      if (specs.size) throw Error('self-host: one launch per owner store');
      const bytes = JSON.stringify(plan), digest = hashBytes(bytes);
      const planPath = join(dir, `plan-${digest.slice(7)}.json`);
      if (!existsSync(planPath)) writeOnce(planPath, bytes);
      sync();
      const handles = [...new Set(portHandles)].sort();
      const facts = take(f.store.read());
      const pending = facts.find(fact => fact.kind === 'run-opening' && fact.body?.record?.id === run);
      const obligation = facts.find(fact => fact.kind === 'transport-LoopRecord');
      if (!pending || !obligation) throw Error('self-host: Run opening or Six obligation absent');
      const limits = { wallMilliseconds: wallMs, cpuMilliseconds: wallMs, memoryBytes: 256 * 1024 * 1024, processCount: 1, handleCount: handles.length,
        inputBytes: Buffer.byteLength(bytes), outputBytes: 1024 * 1024, scratchBytes: 1024 * 1024, queueCount: 1, outstandingDispatchCount: 1,
        observationCount: 64, observationMilliseconds: 3_600_000, observationBytes: 1024 * 1024, maximumExposure: 1, allocation: WORKER_INSTANCE };
      const environmentDigest = canonicalHash([]);
      const definition = f.installDefinition({ type: 'OperationDefinition', schemaVersion: 2, id: `native-definition:${invocation}`, operation: NATIVE, feature: NATIVE,
        version: `native-version:${invocation}`, generation: f.generationId, adapter: EXECUTOR, mode: 'context-loading', profile: target.profile,
        target: { installation, machine: MACHINE, principal: f.principal, harness, artifactDigest: artifact, executable: target.executable,
          executableDigest: target.executableDigest, boundaryDigest: target.boundaryDigest, restrictedIdentity: target.restrictedIdentity,
          workingScope, environmentDigest, handlePolicyDigest: canonicalHash(handles) },
        limits, authority: { scope: f.scopeHash, grants: [f.opening.id], authorization: [], policy: [] },
        durability: 'local-durable', replicas: 0, lossModel: 'machine-local preview store: permanent loss of this disk loses the launch record',
        verificationBar: 'self-host-launch-bar', observationPolicy: 'self-host-policy', expiryEvidence: 'runner-wall-bound' });
      const k = canonicalHash([NATIVE, pending.id]), step = `initial-step:${k}`;
      const parameters = { mode: 'context-loading', installation, machine: MACHINE, principal: f.principal, incarnation: f.incarnation, harness,
        artifactDigest: artifact, executable: target.executable, executableDigest: target.executableDigest, boundaryDigest: target.boundaryDigest,
        restrictedIdentity: target.restrictedIdentity, workingScope, environment: [], environmentCapture: { reference: ENVIRONMENT_CAPTURE, hash: hashBytes(ENVIRONMENT) },
        portHandles: handles, resourceReferences: [standInA], input: `plan:${digest}`, inputDigest: digest,
        contextManifest: [{ class: 'plan', reference: `plan:${digest}`, digest }], consumptionMode: 'advisory', limits };
      const request = `request:${canonicalHash([NATIVE, installation, MACHINE, run, step, f.incarnation])}`;
      const { prepared, row } = reserve('launch', canonicalHash(parameters), `initial-launch:${k}`, request, `initial-launch-attempt:${k}`);
      const spec = take(f.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'), id: `launch:${invocation}`,
        run, step, machine: f.host.machine, incarnation: f.incarnation, principal: f.principal, harness,
        artifactDigest: artifact, workingScope, processOperation: row.fact.id, resourceReferences: [standInA, row.fact.id].sort(),
        portHandles: handles, environment: [], contextManifest: parameters.contextManifest,
        input: parameters.input, inputDigest: digest, consumptionMode: 'advisory' }));
      const specFact = take(f.store.read()).find(fact => fact.kind === 'assembly-HarnessLaunchSpec' && fact.body?.record?.id === spec.id);
      take(recordNativeConfinedLaunchRequest({ type: 'EffectRequest', schemaVersion: 2, id: request, operation: NATIVE, definition: definition.id,
        generation: f.generationId, run, step, pending: pending.id, expectedPredecessor: run, attempt: `initial-launch-attempt:${k}`,
        semanticMessage: `initial-launch:${k}`, parameters, digest: canonicalHash(parameters), launchSpec: specFact.id,
        launchSpecDigest: canonicalHash(specFact.body.record), reservation: row.fact.id, verificationOwner: 'part-nine',
        verificationBar: definition.verificationBar, obligation: obligation.id, closure: [pending.id, row.fact.id, specFact.id, obligation.id] },
      f.effectHost, f.effectSpine));
      const { claimFact } = claimAndConsume(prepared);
      specs.set(prepared.operation, { spec, digest: prepared.digest }); plans.set(digest, planPath);
      return { spec, operation: prepared.operation, claim: claimFact, digest: prepared.digest, request };
    },
    /** The recorded plan an admitted operation launches, re-read and re-verified from disk. */
    planOf(operation) {
      const entry = specs.get(operation); if (!entry) throw Error('self-host: operation was not admitted here');
      const bytes = readFileSync(plans.get(entry.spec.inputDigest), 'utf8');
      if (hashBytes(bytes) !== entry.spec.inputDigest) throw Error('self-host: recorded plan changed');
      return { spec: entry.spec, bytes, plan: JSON.parse(bytes) };
    },
    specOf: operation => specs.get(operation)?.spec ?? null,
    /**
     * S8 launch: exact specification + consumed claim from the store, one M1 decision, one release —
     * and only for an operation whose Six reservation names Eight's recorded request for this exact
     * specification (the request the S8 locator reads resolves to a real Eight record).
     */
    launch(spec, operation, claim) {
      sync(); fresh();
      const facts = take(f.store.read());
      const prepared = facts.find(fact => fact.id === spec.processOperation && fact.kind === 'transport-AdmissionReservation');
      const request = prepared && facts.find(fact => fact.kind === 'effect-EffectRequest' && fact.schemaVersion === 2
        && fact.body.record.id === prepared.body.record.request && fact.body.record.reservation === prepared.id
        && fact.body.record.digest === prepared.body.record.digest && fact.body.record.parameters.inputDigest === spec.inputDigest);
      if (!request || prepared.body.record.operation !== operation) throw Error('self-host: no recorded Eight request for this launch');
      return take(s8.launch(spec, operation, claim));
    },
    /** S8 observation under Six's current wake for the original operation (never a new operation). */
    observe(operation) {
      const entry = specs.get(operation); if (!entry) throw Error('self-host: operation was not admitted here');
      // Six's loop clock here is the owner fixture's logical clock: each observation is one step later.
      f.time(f.host.current().clock.value + 2);
      take(transport().recover(`self-host-observe:${operation}:${++ordinal}`, fence(), operation,
        { owner: 'part-eight', observe: () => f.success({ owner: 'part-eight', name: 'OperationObservation', id: `observation:${operation}:${ordinal}` }) }));
      fresh(); return take(s8.observe(operation, entry.digest));
    },
    /** This store's view of reservations (for accounting across runs). */
    reservations: () => take(transport().inspect()).filter(entry => entry.record.type === 'AdmissionReservation'),
    close() { view.close(); writer.close(); },
  });
}

/** Every run's signed store under this root, read-only (restart-safe accounting and audit). */
export function ownerStoreFacts(root, context = decodeContext()) {
  const owners = join(root, 'owners');
  if (!existsSync(owners)) return [];
  const key = storageKey(root), out = [];
  try {
    for (const name of readdirSync(owners).sort()) {
      if (name.startsWith('.')) continue;
      const dir = realpathSync(join(owners, name));
      if (!existsSync(join(dir, 'facts.encrypted'))) continue;
      const view = take(openProductionStorageReader({ root: dir, machine: MACHINE, key, store: STORE, context: context.c, io: productionStorageIO }));
      try { out.push({ store: name, facts: take(createFactStore(context.ctx, view.segment).read()) }); } finally { view.close(); }
    }
  } finally { key.fill(0); }
  return out;
}
/** The owners' decoders alone (an in-memory composition that writes nothing to disk). */
export const decodeContext = () => { const wire = [];
  const f = composeOwnerRun(() => ({ owner: 'part-ten', read: () => wire, append: bytes => { wire.push(JSON.parse(bytes)); return { kind: 'Success', value: { kind: 'local-durable' } }; } }), 'decode-only');
  return { c: f.c, ctx: f.ctx }; };

const PROVIDER_STORE = 'provider-';
const taskKey = task => hashBytes(task).slice(7, 23);
/**
 * Provider attempts for a task, across restarts: one owner store per attempt, created (and its parent
 * fsynced) before Seven prepares anything, so an answered, failed or interrupted attempt — and one cut
 * before its reservation — is counted and never re-granted.
 */
export function providerAttemptsOf(root, task) {
  const owners = join(root, 'owners');
  return existsSync(owners) ? readdirSync(owners).filter(name => name.startsWith(`${PROVIDER_STORE}${taskKey(task)}-`)).length : 0;
}
/** Every provider attempt's owner store under this root: its directory and its signed facts (read-only audit). */
export function providerStores(root) {
  const owners = join(root, 'owners');
  if (!existsSync(owners)) return [];
  return readdirSync(owners).filter(name => name.startsWith(PROVIDER_STORE)).sort().map(name => {
    const file = join(owners, name, 'facts.json');
    return { store: name, directory: join(owners, name), facts: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [] };
  });
}

/**
 * Rules 26, 55, 115 and the purpose's durable-cause rule (D14 §3): one provider attempt through the
 * existing Seven/Eight/Six provider-owner path (`createProviderOwners`, the composition the stage-two
 * runner proved, over `createProductionProviderOwners`). Before any call, Seven records the
 * judgment request with the exact submitted bytes captured, Eight records its provider effect request
 * naming them, and Six reserves the charge naming that request; the doorway is then invoked only by
 * Eight's dispatch, which claims and consumes in Six first. The answer is read from Seven's recorded
 * response. No acceptance chain is composed: the plan is working data the loop parses.
 */
export async function dispatchOwnedProvider({ root, task, question, conversation, allowance, provider, stopped, now = () => Date.now() }) {
  const used = providerAttemptsOf(root, task);
  if (used >= allowance) throw Error(`self-host: provider attempt allowance exhausted (${used} of ${allowance} recorded)`);
  if (stopped()) throw Error('self-host: stop latched before the provider attempt');
  const owners = join(root, 'owners');
  mkdirSync(owners, { recursive: true, mode: 0o700 });
  const directory = join(owners, `${PROVIDER_STORE}${taskKey(task)}-${randomBytes(8).toString('hex')}`);
  mkdirSync(directory, { mode: 0o700 });
  const fd = openSync(owners, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  const start = now();
  const owner = createProviderOwners({ directory, invocationBinding: provider.invocationBinding, ownerNow: now, active: () => !stopped(),
    start, deadline: start + OWNER_WINDOW_MS, model: provider.model, framing: provider.framing, question, conversation,
    replyCharge: 1, registerEntries: ['preview'], routeFactory: provider.routeFactory });
  const operation = () => owner.all().find(fact => fact.kind === 'transport-AdmissionReservation')?.body.record.operation ?? null;
  let request;
  try { ({ request } = owner.prepare()); } catch (error) { throw Error(`self-host: model call refused before dispatch: ${error?.message ?? error}`); }
  if (stopped()) throw Object.assign(Error('self-host: stop latched before the provider attempt'), { operation: operation() });
  const dispatched = await owner.api.dispatch(request, owner.fence);
  const response = owner.all().find(fact => fact.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && fact.body.record.phase === 'response-observed');
  if (dispatched.kind !== 'Success' || !response)
    throw Object.assign(Error(`self-host: model outcome unknown${dispatched.kind === 'Success' ? '' : `: ${dispatched.detail ?? ''}`}`), { operation: operation() });
  const observed = JSON.parse(take(owner.captures.read(response.body.record.receipt)));
  if (observed.state !== 'complete' || !observed.bytes) throw Object.assign(Error(`self-host: model ${observed.state}`), { operation: operation() });
  let answer; try { answer = JSON.parse(observed.bytes)?.conclusion?.value; } catch { answer = undefined; }
  if (typeof answer !== 'string') throw Object.assign(Error('self-host: model returned no plan'), { operation: operation() });
  return { answer, operation: response.body.record.operation, request: request.id, store: directory };
}
