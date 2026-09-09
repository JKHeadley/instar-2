import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, consumeResult, decode, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Clock, Json, Result, RunReference } from '../../src/index.js';
import { authorAndAppend, createFactStore, factId, signEnvelope, verifyAndAdmit } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, SegmentStoragePort } from '../../src/facts/index.js';
import { runIdFor } from '../../src/rungraph/index.js';
import { recordReferences, recordWire } from '../../src/rungraph/records.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies,
  registerTransportSeamBodies, transportSchemas, transportSeamSchemas } from '../../src/transport/index.js';
import type { FenceToken, ReserveInput, SharedBreakerLoopPolicy, TransportHost } from '../../src/transport/index.js';
import { registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import { verificationInput } from '../verification/fixture.js';
import { setup as rungraphFixture, ref as factRef, value, refused, json } from '../rungraph/fixtures.js';
import { privateKey } from '../facts/fixtures.js';
// @ts-expect-error Reference host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
export { value, refused };

const encoded = (input: unknown) => value(canonical(input));
const scheduleBinding = (parent: RunReference, job: string, at: Clock) =>
  encoded([parent.id, job, at]).hash;

export function transportLoopFixture(directory = mkdtempSync(join(tmpdir(), 'p6-loop-')),
  incarnation = 'worker:1', authority = 'authority:1') {
  let baseBinding = '';
  const rg = rungraphFixture(undefined, undefined, {
    fields: {
      intent: { kind: 'constitutional', type: 'Intent' }, owner: { kind: 'constitutional', type: 'VerifiedPrincipal' },
      capture: { kind: 'capture' }, transportScheduleBinding: { kind: 'text', maxLength: 256 },
    },
    extra: { 'scheduled-stimulus': { intent: { kind: 'constitutional', type: 'Intent' },
      owner: { kind: 'constitutional', type: 'VerifiedPrincipal' },
      transportScheduleBinding: { kind: 'text', maxLength: 256 } } },
    body: ({ intent, owner, hash }) => json({ intent, owner, capture: { reference: 'message:1', hash },
      transportScheduleBinding: baseBinding || 'parent-duty' }),
  });
  rg.grant({ id: 'g-loop-bob', grantee: rg.bob });
  (rg.c.stimulusKinds as string[]).push('scheduled-stimulus');
  const parentDuty = { owner: 'part-five' as const, name: 'Run' as const, id: rg.id };
  const runFacts: FactEnvelope[] = [];
  const runHistory = (): FactContext => ({ ...rg.ctx, facts: [...value(rg.store.read()), ...runFacts] });
  const admitHistorical = (kind: string, body: Json, required: readonly string[]) => {
    const context = runHistory(), head = context.facts.filter(fact => fact.machine === 'machine-a').at(-1)!;
    const segment = { machine: 'machine-a', epoch: head.segment.epoch, position: head.segment.position + 1 };
    const wire = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind, schemaVersion: 1,
      at: rg.now, machine: 'machine-a', principal: rg.bob, provenance: rg.bob.provenance, segment,
      prevInSegment: head.contentHash, predecessors: { inSegment: head.id, frontier: {}, required }, body }, privateKey);
    const fact = value(verifyAndAdmit(wire, 'machine-a', context)); runFacts.push(fact); return fact;
  };
  admitHistorical('run-opening', json({ run: rg.id,
    record: recordWire(rg.run as unknown as Parameters<typeof recordWire>[0]) }), recordReferences(json(rg.run)));
  const admittedRuns = new Map<number, RunReference>();
  for (const instant of [110, 120, 130]) {
    const at = rg.clock(instant);
    const ownerValue = rg.principal(`scheduled-owner:${instant}`, 'agent');
    const intent = value(decode('Intent', rg.intentInput({ id: `scheduled-intent:${instant}`, principal: ownerValue,
      raw: rg.capture(`scheduled:${instant}`) }), rg.ctx.decode));
    const opening = admitHistorical('scheduled-stimulus', json({ intent, owner: ownerValue,
      transportScheduleBinding: scheduleBinding(parentDuty, 'job:one', at) }), []);
    const owner = { type: 'VerifiedPrincipal' as const, id: ownerValue.id, fact: factRef(opening), field: 'owner' };
    const id = runIdFor(factRef(opening));
    const budgetId = `scheduled-budget:${instant}`;
    const run = { ...rg.run, id, opening: factRef(opening),
      intent: { type: 'Intent' as const, id: intent.id, fact: factRef(opening), field: 'intent' }, owner,
      authority: { ...rg.run.authority, resolution: factRef(opening) },
      budget: { ...rg.run.budget, id: budgetId, resources: rg.run.budget.resources.map(resource => ({ ...resource,
        subject: { ...resource.subject, instance: budgetId } })), exhaustedOwner: owner },
      nextWake: { ...rg.run.nextWake, owner } };
    admitHistorical('run-opening', json({ run: id,
      record: recordWire(run as unknown as Parameters<typeof recordWire>[0]) }), recordReferences(json(run)));
    admittedRuns.set(instant, { owner: 'part-five', name: 'Run', id });
  }

  let now = 100, stopped = false, generation = 'generation:1';
  const verificationHost = { machine: 'machine-a', principal: rg.alice, scope: rg.scope, boundary: rg.c,
    current: () => ({ stopped: false, clock: rg.clock(now), generation, facts: rg.ctx,
      decode: rg.ctx.decode, evidence: [] }) };
  const verificationRegistrations = value(registerVerificationBodies(verificationHost));
  const proofSchemas: FactSchema[] = [
    { ...rg.schema, kind: 'calendar-roster-proof', fields: { scan: { kind: 'text', maxLength: 256 },
      generation: { kind: 'text', maxLength: 256 }, orderedKeysBytes: { kind: 'text', maxLength: 4096 } } },
    { ...rg.schema, kind: 'calendar-range-proof', fields: { binding: { kind: 'text', maxLength: 256 } } },
    { ...rg.schema, kind: 'loop-outcome-proof', fields: { evidence: { kind: 'constitutional', type: 'Evidence' },
      outcome: { kind: 'constitutional', type: 'Outcome' } } },
    { ...rg.schema, kind: 'loop-result-proof', fields: { result: { kind: 'constitutional', type: 'Result' } } },
  ];
  let witnessContext: FactContext = { ...rg.ctx, facts: [...value(rg.store.read()), ...runFacts],
    schemas: [...rg.ctx.schemas, ...verificationSchemas(verificationHost), ...proofSchemas],
    ownedBodies: [...rg.ctx.ownedBodies ?? [], ...verificationRegistrations] };
  const machineBFacts: FactEnvelope[] = [];
  const appendMachineB = (kind: string, body: Json) => {
    const context = { ...witnessContext, facts: [...witnessContext.facts, ...machineBFacts] };
    const previous = machineBFacts.at(-1) ?? context.facts.filter(fact => fact.machine === 'machine-a').at(-1)!;
    const segment = { machine: 'machine-a', epoch: previous.segment.epoch, position: previous.segment.position + 1 };
    const wire = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind, schemaVersion: 1,
      at: rg.now, machine: 'machine-a', principal: rg.alice, provenance: rg.alice.provenance, segment,
      prevInSegment: previous.contentHash, predecessors: { inSegment: previous.id, frontier: {}, required: [] }, body }, privateKey);
    const fact = value(verifyAndAdmit(wire, 'machine-a', context));
    machineBFacts.push(fact); return fact;
  };
  const assessmentFacts = new Map<string, FactEnvelope>();
  for (const id of ['assessment:fixture', 'assessment:one', 'assessment:expires']) {
    const record = { ...verificationInput('VerificationAssessment'), id, validFrom: 0, validUntil: 10_000 };
    assessmentFacts.set(id, appendMachineB('verification-VerificationAssessment', json({ record })));
  }
  const orderedKeys = ['job:one'];
  const rosterFact = appendMachineB('calendar-roster-proof', json({ scan: 'scan', generation: 'g1',
    orderedKeysBytes: encoded(orderedKeys).bytes }));
  const members = [110, 120, 130].map(value => rg.clock(value));
  const rangeAfter = rg.clock(100), rangeThrough = rg.clock(130);
  const rangeFact = appendMachineB('calendar-range-proof', json({ binding: encoded([
    parentDuty.id, 'job:one', 'every-10', rangeAfter, rangeThrough, members,
  ]).hash }));
  witnessContext = { ...witnessContext, facts: [...witnessContext.facts, ...machineBFacts] };

  const host: TransportHost = { domain: 'conversation:1', machine: 'machine-a', incarnation,
    authorityIncarnation: authority, principal: rg.bob, scope: rg.scope, maxLeaseTerm: 1000, budget: 100,
    loopClock: { owner: 'part-ten', now: () => rg.clock(now) },
    calendarExpansion: {
      owner: 'part-fifteen',
      expand: input => rg.success(Array.from({ length: Math.floor((input.through.value - input.after.value) / 10) },
        (_, index) => rg.clock(input.after.value + (index + 1) * 10))),
      roster: input => rg.success((input.scan === 'scan' && input.generation === 'g1'
        && input.orderedKeysDigest === encoded(orderedKeys).hash)
        ? { orderedKeys, witness: factRef(rosterFact) } : (() => { throw new Error('owner roster unavailable'); })()),
      range: input => rg.success((input.parentDuty.id === parentDuty.id && input.jobInstance === 'job:one'
        && input.calendarPolicy === 'every-10' && input.memberCount === members.length
        && input.orderedMembersDigest === encoded(members).hash)
        ? { after: rangeAfter, through: rangeThrough, members, witness: factRef(rangeFact) }
        : (() => { throw new Error('owner range unavailable'); })()),
    },
    restorationEvidence: { owner: 'part-nine', verify: input => rg.success((assessmentFacts.has(input.reference.id))
      ? input.reference : (() => { throw new Error('assessment unavailable'); })()) },
    monotonic: () => now,
    current: () => {
      const gen = { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: generation };
      return { decode: { ...rg.ctx.decode, register: { ...rg.ctx.decode.register, generation: gen,
        subjects: { ...rg.ctx.decode.register.subjects, duration: ['ms'] } } }, clock: rg.clock(now), generation: gen, stopped };
    },
  };
  const result = <T>(run: () => T): Result<T> => {
    const decoder = value(defineDecoder<T, typeof rg.c>({ name: 'FileReceipt', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (error) { return { ok: false, detail: String(error) }; } },
    }, rg.c.preserved));
    return deriveThrough(decoder, { type: 'FileReceipt', schemaVersion: 1 }, rg.c);
  };
  const storage: SegmentStoragePort = createTransportFileStorage(directory, result);
  const provisional = { ...witnessContext, schemas: [...witnessContext.schemas, ...transportSchemas(host), ...transportSeamSchemas(host)] };
  const ctx: FactContext = { ...provisional, ownedBodies: [...provisional.ownedBodies ?? [],
    ...value(registerTransportBodies(host, rg.c)), ...value(registerTransportSeamBodies(host, rg.c))] };
  const store = createFactStore(ctx, storage);
  const spine = createTransportSpine(host, { context: ctx, privateKey }, store);
  const api = createTransportAuthority(host, spine, rg.c);
  const sharedPolicy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'shared-loop-policy:1',
    maxAttempts: 12, minDelay: 1, maxDuration: 1000, timeout: 10, concurrency: 2,
    failDirection: 'closed', breaker: 'shared-circuit-v1', initialDelay: 1, maxDelay: 40,
    backoffMultiplier: 2, jitterMinPermille: 500, jitterMaxPermille: 1000,
    failureThreshold: 2, countedFailureClasses: ['transport', 'timeout'], acceptedOutcomeWindow: 500,
    breakerCooldown: 20, maxOpenDuration: 200, halfOpenTrials: 2, halfOpenConcurrency: 1,
    closeEvidence: 'part-nine-restoration', reopenEvidence: 'counted-failure', parentDuty,
    budgetWindow: 500, parentAttemptBudget: 20, parentResourceBudget: 100 } as const, rg.c)) as SharedBreakerLoopPolicy;
  const append = (kind: string, body: Json, required: readonly string[] = []) => value(authorAndAppend({ kind, body, required,
    schemaVersion: 1, machine: host.machine, principal: json(host.principal), provenance: json(host.principal.provenance),
    at: json(rg.clock(now)) }, ctx, store, privateKey));
  const registerPolicy = (policy: SharedBreakerLoopPolicy = sharedPolicy) => {
    const existing = value(store.read()).find(fact => fact.kind === 'transport-LoopPolicy'
      && (fact.body as { policy?: { id?: unknown }; generation?: unknown }).policy?.id === policy.id
      && (fact.body as { generation?: unknown }).generation === generation);
    return existing ?? append('transport-LoopPolicy', json({ policy, generation }), [value(rg.store.read()).at(-1)!.id]).fact;
  };
  registerPolicy();
  const vector = () => [...new Map(ctx.facts.map(fact => [fact.machine, fact])).values()]
    .map(fact => ({ machine: fact.machine, epoch: fact.segment.epoch, position: fact.segment.position }))
    .sort((a, b) => a.machine.localeCompare(b.machine));
  let outcomeCounter = 0;
  const appendOutcome = (kind: 'accepted' | 'failed', attempt: string) => {
    const evidence = value(decode('Evidence', rg.evidenceInput({ id: `loop-evidence:${++outcomeCounter}` }), rg.ctx.decode));
    rg.evidence.push(evidence);
    const outcome = value(decode('Outcome', rg.raw('Outcome', { kind: kind === 'accepted' ? 'happened' : 'uncertain',
      evidence: [evidence.id] }), { ...rg.ctx.decode, evidence: [evidence] }));
    const receipt = append('loop-outcome-proof', json({ evidence, outcome }));
    return { type: 'Outcome' as const, id: `outcome:${attempt}:${outcomeCounter}`,
      fact: factRef(receipt.fact), field: 'outcome' };
  };
  const appendResult = (id = 'result:missed') => {
    const recorded = value(decode('Result', rg.refusedInput(), rg.ctx.decode));
    const receipt = append('loop-result-proof', json({ result: recorded }));
    return { type: 'Result' as const, id, fact: factRef(receipt.fact), field: 'result' };
  };
  const input = (fence: FenceToken, overrides: Partial<ReserveInput> = {}): ReserveInput => ({ command: 'reserve', fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'request:1' }, attempt: 'attempt:1',
    payloadDigest: `sha256:${'a'.repeat(64)}`, charge: 20, run: parentDuty,
    semanticMessage: 'message:five-owned', durability: 'local-durable', replicas: 0, ...overrides });
  const head = () => value(api.inspect()).at(-1)?.fact.id ?? '';
  const detail = <T>(r: Result<T>) => consumeResult(r, { Success: () => '', Refused: refusal => refusal.detail });
  return { ...rg, host, ctx, storage, store, spine, api, directory, result, sharedPolicy, parentDuty, run: parentDuty,
    admittedRun: (instant: number) => admittedRuns.get(instant)!, appendOutcome, appendResult, input, head, detail,
    get vector() { return vector(); }, advance: (n: number) => { now += n; }, time: (n: number) => { now = n; },
    stop: () => { stopped = true; }, generation: (value: string) => { generation = value; },
    revalidatePolicy: () => registerPolicy(), registerPolicy, assessmentFact: (id: string) => assessmentFacts.get(id),
  };
}
