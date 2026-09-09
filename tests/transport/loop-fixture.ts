import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, consumeResult, decode, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Clock, Evidence, Json, Result, RunReference } from '../../src/index.js';
import { authorAndAppend, createFactStore, factId, signEnvelope, verifyAndAdmit } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, SegmentStoragePort } from '../../src/facts/index.js';
import { runIdFor } from '../../src/rungraph/index.js';
import { recordReferences, recordWire } from '../../src/rungraph/records.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies,
  registerTransportSeamBodies, transportSchemas, transportSeamSchemas } from '../../src/transport/index.js';
import type { FenceToken, ReserveInput, SharedBreakerLoopPolicy, SharedLoopRecord, TransportFact, TransportHost } from '../../src/transport/index.js';
import { deriveVerificationAssessment, registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationAssessment, VerificationPlan, VerificationRequest } from '../../src/verification/index.js';
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
  incarnation = 'worker:1', authority = 'authority:1', options: Readonly<{
    existingInstants?: readonly number[]; catchUpInstants?: readonly number[];
  }> = {}) {
  let baseBinding = '';
  const rg = rungraphFixture(undefined, undefined, {
    fields: {
      intent: { kind: 'constitutional', type: 'Intent' }, owner: { kind: 'constitutional', type: 'VerifiedPrincipal' },
      capture: { kind: 'capture' }, transportScheduleBinding: { kind: 'text', maxLength: 256 },
      transportScheduleKind: { kind: 'text', maxLength: 256 },
    },
    extra: { 'scheduled-stimulus': { intent: { kind: 'constitutional', type: 'Intent' },
      owner: { kind: 'constitutional', type: 'VerifiedPrincipal' },
      transportScheduleBinding: { kind: 'text', maxLength: 256 },
      transportScheduleKind: { kind: 'text', maxLength: 256 } } },
    body: ({ intent, owner, hash }) => json({ intent, owner, capture: { reference: 'message:1', hash },
      transportScheduleBinding: baseBinding || 'parent-duty', transportScheduleKind: 'existing' }),
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
  const catchUpRuns = new Map<number, RunReference>();
  const admitScheduledRun = (instant: number, kind: 'existing' | 'catch-up' = 'existing') => {
    const at = rg.clock(instant);
    const ownerValue = rg.principal(`scheduled-owner:${instant}`, 'agent');
    const intent = value(decode('Intent', rg.intentInput({ id: `scheduled-intent:${instant}`, principal: ownerValue,
      raw: rg.capture(`scheduled:${instant}`) }), rg.ctx.decode));
    const opening = admitHistorical('scheduled-stimulus', json({ intent, owner: ownerValue,
      transportScheduleBinding: scheduleBinding(parentDuty, 'job:one', at), transportScheduleKind: kind }), []);
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
    const reference = { owner: 'part-five' as const, name: 'Run' as const, id };
    (kind === 'existing' ? admittedRuns : catchUpRuns).set(instant, reference); return reference;
  };
  const scheduled = [
    ...(options.existingInstants ?? [110, 120, 130]).map(instant => ({ instant, kind: 'existing' as const })),
    ...(options.catchUpInstants ?? []).map(instant => ({ instant, kind: 'catch-up' as const })),
  ];
  for (const { instant, kind } of scheduled) admitScheduledRun(instant, kind);

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
      outcome: { kind: 'constitutional', type: 'Outcome' }, loopAttemptBinding: { kind: 'text', maxLength: 256 },
      loopFailureClass: { kind: 'text', maxLength: 256 }, loopFailurePolicy: { kind: 'text', maxLength: 256 } } },
    { ...rg.schema, kind: 'loop-result-proof', fields: { result: { kind: 'constitutional', type: 'Result' } } },
    { ...rg.schema, kind: 'verification-evidence-proof', fields: {
      evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...rg.schema, kind: 'loop-pressure-binding', fields: { parentDuty: { kind: 'text', maxLength: 256 },
      operationFamily: { kind: 'text', maxLength: 256 }, pressureScopeBytes: { kind: 'text', maxLength: 4096 } } },
  ];
  const peerFrontier = rg.fact({ machine: 'machine-b',
    segment: { machine: 'machine-b', epoch: 0, position: 0 } });
  let witnessContext: FactContext = { ...rg.ctx, facts: [...value(rg.store.read()), ...runFacts, peerFrontier],
    schemas: [...rg.ctx.schemas, ...verificationSchemas(verificationHost), ...proofSchemas],
    ownedBodies: [...rg.ctx.ownedBodies ?? [], ...verificationRegistrations] };
  const machineBFacts: FactEnvelope[] = [];
  const appendMachineB = (kind: string, body: Json, required: readonly string[] = []) => {
    const context = { ...witnessContext, facts: [...witnessContext.facts, ...machineBFacts] };
    const previous = machineBFacts.at(-1) ?? context.facts.filter(fact => fact.machine === 'machine-a').at(-1)!;
    const segment = { machine: 'machine-a', epoch: previous.segment.epoch, position: previous.segment.position + 1 };
    const wire = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind, schemaVersion: 1,
      at: rg.now, machine: 'machine-a', principal: rg.alice, provenance: rg.alice.provenance, segment,
      prevInSegment: previous.contentHash, predecessors: { inSegment: previous.id, frontier: {}, required }, body }, privateKey);
    const fact = value(verifyAndAdmit(wire, 'machine-a', context));
    machineBFacts.push(fact); return fact;
  };
  const assessmentFacts = new Map<string, FactEnvelope>();
  const unsupportedAssessment = (id: string, operationFamily: string, pressureScope: object, complete: boolean) => {
    const pressureKey = `pressure:${encoded([operationFamily, pressureScope]).hash}`;
    const base = verificationInput('VerificationAssessment');
    const record = { ...base, id, operation: operationFamily,
      operationDigest: encoded([pressureKey, operationFamily]).hash, validFrom: 0, validUntil: 10_000,
      missingEvidence: complete ? [] : base.missingEvidence,
      predicates: complete ? base.predicates.map(value => ({ ...value,
        verdict: value.predicate === 'non-occurrence' ? 'contradicted' : 'satisfied',
        evidence: value.evidence.length > 0 ? value.evidence : [`evidence:${value.predicate}`] })) : base.predicates };
    assessmentFacts.set(id, appendMachineB('verification-VerificationAssessment', json({ record })));
  };
  unsupportedAssessment('assessment:one', 'operation:1', {}, false);
  unsupportedAssessment('assessment:expires', 'recovery',
    { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' }, true);
  const orderedKeys = ['job:one'];
  const rosterFact = appendMachineB('calendar-roster-proof', json({ scan: 'scan', generation: 'g1',
    orderedKeysBytes: encoded(orderedKeys).bytes }));
  const members = [110, 120, 130].map(value => rg.clock(value));
  const rangeAfter = rg.clock(100), rangeThrough = rg.clock(130);
  const rangeFact = appendMachineB('calendar-range-proof', json({ binding: encoded([
    parentDuty.id, 'job:one', 'every-10', rangeAfter, rangeThrough, members,
  ]).hash }));
  const pressureBindings = new Map<string, FactEnvelope>();
  for (const [operationFamily, pressureScope] of [
    ['recovery', { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' }],
    ['holder-recovery', { target: 'target:shared', conversation: 'conversation:1', machine: 'fleet', pool: 'recovery' }],
    ['budget-holder', { target: 'target:shared', conversation: 'conversation:1', machine: 'fleet', pool: 'recovery' }],
    ['scheduled-work', { target: 'scheduled-work', conversation: 'conversation:1', machine: 'fleet', pool: 'jobs' }],
    ['holder-recovery', { target: 'target:1', conversation: 'conversation:1', machine: 'fleet', pool: 'default' }],
    ['recovery', { target: 'target:e2e', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' }],
    ['recovery', { target: 'e2e', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' }],
    ['scheduled-work', { target: 'e2e', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' }],
    ['recovery', { target: 'target:review', conversation: 'conversation:1', machine: 'caller-machine-b', pool: 'holders' }],
    ['recovery', { target: 'other', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' }],
    ['caller-selected-alternate-family', { target: 'target:review', conversation: 'conversation:1', machine: 'machine-b', pool: 'holders' }],
  ] as const) {
    const key = encoded([parentDuty.id, operationFamily, pressureScope]).bytes;
    pressureBindings.set(key, appendMachineB('loop-pressure-binding', json({ parentDuty: parentDuty.id,
      operationFamily, pressureScopeBytes: encoded(pressureScope).bytes })));
  }
  const restorationSupport = new Map<string, Readonly<{
    plan: VerificationPlan; request: VerificationRequest; assessment: VerificationAssessment;
    evidence: readonly Evidence[];
  }>>();
  const witnessedAssessment = (alias: string, operationFamily: string, pressureScope: object) => {
    const pressureKey = `pressure:${encoded([operationFamily, pressureScope]).hash}`;
    const binding = pressureBindings.get(encoded([parentDuty.id, operationFamily, pressureScope]).bytes)!;
    const plan = { ...verificationInput('VerificationPlan'), id: `plan:${alias}`, predecessors: [binding.id],
      subject: { ...verificationInput('VerificationPlan').subject, governed: pressureKey,
        scope: operationFamily, generation },
      bar: { ...verificationInput('VerificationPlan').bar, version: `bar:${alias}`, sources: ['probe'],
        minimumStrength: 'proof' as const, freshness: 10_000 } } as unknown as VerificationPlan;
    const planFact = appendMachineB('verification-VerificationPlan', json({ record: plan }), plan.predecessors);
    const claims = [
      ['operation-occurred', 'occurrence'],
      ['old-executor-quiescent', 'quiescence'],
      ['charge-settled', 'charge'],
    ] as const;
    const evidence = claims.map(([predicate, suffix]) => value(decode('Evidence', rg.evidenceInput({
      id: `evidence:${alias}:${suffix}`, claim: { subject: operationFamily, predicate, value: {
        digest: encoded([pressureKey, operationFamily]).hash } }, source: 'probe', observedAt: rg.clock(now),
      freshFor: 10_000, strength: 'proof' }), rg.ctx.decode)));
    evidence.forEach(item => rg.evidence.push(item));
    const evidenceFacts = evidence.map(item => appendMachineB('verification-evidence-proof', json({ evidence: item })));
    const request = { ...verificationInput('VerificationRequest'), id: `request:${alias}`,
      predecessors: [planFact.id, binding.id, ...evidenceFacts.map(fact => fact.id)],
      logicalKey: `request:${alias}`, operation: operationFamily, attempt: `attempt:${alias}`,
      reservation: binding.id, operationDigest: encoded([pressureKey, operationFamily]).hash,
      scope: operationFamily, plan: plan.id, barVersion: plan.bar.version,
      initialEvidence: evidence.map(item => item.id), missingEvidence: [], sourceGeneration: generation,
      createdAt: now } as unknown as VerificationRequest;
    const requestFact = appendMachineB('verification-VerificationRequest', json({ record: request }), request.predecessors);
    const captureStatuses = evidence.map(item => ({ reference: item.capture.reference, status: 'available' as const }));
    const assessment = value(deriveVerificationAssessment({ request, plan, evidence, observer: rg.alice.id,
      vectorDigest: encoded(machineBFacts.map(fact => fact.id)).hash, knownLineages: ['machine-a'],
      captureStatuses, taints: [], now: rg.clock(now), predecessors: [requestFact.id, ...evidenceFacts.map(fact => fact.id)],
      decode: { ...rg.ctx.decode, evidence } }, rg.c));
    const fact = appendMachineB('verification-VerificationAssessment', json({ record: assessment }), assessment.predecessors);
    assessmentFacts.set(alias, fact); assessmentFacts.set(assessment.id, fact); assessmentFacts.set(fact.id, fact);
    const support = { plan, request, assessment, evidence };
    restorationSupport.set(alias, support); restorationSupport.set(assessment.id, support); restorationSupport.set(fact.id, support);
  };
  witnessedAssessment('assessment:witnessed-review', 'recovery',
    { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' });
  witnessedAssessment('assessment:restored-holder', 'holder-recovery',
    { target: 'target:shared', conversation: 'conversation:1', machine: 'fleet', pool: 'recovery' });
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
      ? (() => {
        const fact = assessmentFacts.get(input.reference.id)!;
        const record = (fact.body as { record: {
          operation: string; operationDigest: string; missingEvidence: readonly string[];
          captureStatuses: readonly { reference: string; status: string }[]; taints: readonly string[];
          predicates: readonly { predicate: string; verdict: string }[]; validFrom: number; validUntil: number;
        } }).record;
        const support = restorationSupport.get(input.reference.id);
        if (support) {
          const currentStatuses = support.evidence.map(item => ({ reference: item.capture.reference,
            status: (rg.ctx.captures[item.capture.reference]?.status
              ?? (rg.ctx.decode.captures[item.capture.reference] !== undefined ? 'available' : 'missing')) as 'available' | 'missing' }));
          const derived = value(deriveVerificationAssessment({ request: support.request, plan: support.plan,
            evidence: support.evidence, observer: support.assessment.observer,
            vectorDigest: support.assessment.vectorDigest, knownLineages: support.assessment.knownLineages,
            captureStatuses: currentStatuses, taints: [], now: rg.clock(support.assessment.validFrom),
            predecessors: support.assessment.predecessors, decode: { ...rg.ctx.decode, evidence: support.evidence } }, rg.c));
          const comparisons = {
            predicates: encoded(derived.predicates).bytes === encoded(support.assessment.predicates).bytes,
            evidence: encoded(derived.evidence).bytes === encoded(support.assessment.evidence).bytes,
            missing: encoded(derived.missingEvidence).bytes === encoded(support.assessment.missingEvidence).bytes,
            time: now >= support.assessment.validFrom && now < support.assessment.validUntil,
          };
          if (Object.values(comparisons).some(value => !value))
            throw new Error(`assessment unavailable or no longer current: ${JSON.stringify(comparisons)}`);
        }
        return { reference: input.reference, operation: record.operation, operationDigest: record.operationDigest,
          missingEvidence: record.missingEvidence, captureStatuses: record.captureStatuses, taints: record.taints,
          predicates: record.predicates.map(value => ({ predicate: value.predicate, verdict: value.verdict })),
          validFrom: record.validFrom, validUntil: record.validUntil };
      })() : (() => { throw new Error('assessment unavailable'); })()) },
    loopScopeBinding: { owner: 'part-three', resolve: input => rg.success((() => {
      const governedScope = input.operationFamily === 'recovery' && input.pressureScope.machine === 'caller-machine-b'
        ? { ...input.pressureScope, machine: 'fleet' } : input.pressureScope;
      const fact = pressureBindings.get(encoded([input.parentDuty.id, input.operationFamily, governedScope]).bytes);
      if (!fact) throw new Error('governed pressure scope unavailable');
      return { operationFamily: input.operationFamily, pressureScope: governedScope, witness: factRef(fact) };
    })()) },
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
  const admitLiveScheduledRun = (instant: number, kind: 'existing' | 'catch-up' = 'existing') => {
    const appendLive = (factKind: string, body: Json, required: readonly string[] = []) => {
      const facts = [...ctx.facts, ...value(store.read())], last = facts.at(-1)!;
      const segment = { machine: host.machine, epoch: last.segment.epoch, position: last.segment.position + 1 };
      const wire = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind: factKind,
        schemaVersion: 1, at: rg.clock(now), machine: host.machine, principal: host.principal,
        provenance: host.principal.provenance, segment, prevInSegment: last.contentHash,
        predecessors: { inSegment: last.id, frontier: {}, required }, body }, privateKey);
      const fact = value(verifyAndAdmit(wire, host.machine, { ...ctx, facts }));
      value(store.append(wire, { peer: host.machine })); return fact;
    };
    const at = rg.clock(instant), ownerValue = rg.bob;
    const intent = value(decode('Intent', rg.intentInput({ id: `live-scheduled-intent:${instant}`, principal: ownerValue,
      raw: rg.capture(`live-scheduled:${instant}`) }), rg.ctx.decode));
    const opening = appendLive('scheduled-stimulus', json({ intent, owner: ownerValue,
      transportScheduleBinding: scheduleBinding(parentDuty, 'job:one', at), transportScheduleKind: kind }));
    const owner = { type: 'VerifiedPrincipal' as const, id: ownerValue.id, fact: factRef(opening), field: 'owner' };
    const id = runIdFor(factRef(opening)), budgetId = `live-scheduled-budget:${instant}`;
    const run = { ...rg.run, id, opening: factRef(opening),
      intent: { type: 'Intent' as const, id: intent.id, fact: factRef(opening), field: 'intent' }, owner,
      authority: { ...rg.run.authority, resolution: factRef(opening) },
      budget: { ...rg.run.budget, id: budgetId, resources: rg.run.budget.resources.map(resource => ({ ...resource,
        subject: { ...resource.subject, instance: budgetId } })), exhaustedOwner: owner }, nextWake: { ...rg.run.nextWake, owner } };
    appendLive('run-opening', json({ run: id,
      record: recordWire(run as unknown as Parameters<typeof recordWire>[0]) }), recordReferences(json(run)));
    const reference = { owner: 'part-five' as const, name: 'Run' as const, id };
    (kind === 'existing' ? admittedRuns : catchUpRuns).set(instant, reference); return reference;
  };
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
  const appendOutcome = (kind: 'accepted' | 'failed', attempt: string,
    failureClass = kind === 'failed' ? 'transport' : '') => {
    const evidence = value(decode('Evidence', rg.evidenceInput({ id: `loop-evidence:${++outcomeCounter}` }), rg.ctx.decode));
    rg.evidence.push(evidence);
    const outcome = value(decode('Outcome', rg.raw('Outcome', { kind: kind === 'accepted' ? 'happened' : 'uncertain',
      evidence: [evidence.id] }), { ...rg.ctx.decode, evidence: [evidence] }));
    const inspected = value(api.inspect());
    const admitted = inspected.filter(row => {
      if (row.record.type !== 'LoopRecord' || row.record.policy.breaker !== 'shared-circuit-v1') return false;
      const record = row.record as SharedLoopRecord;
      return record.policy.breaker === 'shared-circuit-v1' && record.attemptLog.some(value => value.id === attempt);
    }).at(-1) as (TransportFact & { record: SharedLoopRecord }) | undefined;
    if (!admitted) throw new Error(`attempt admission unavailable: ${attempt}`);
    const loopAttemptBinding = encoded([admitted.record.pressureKey, admitted.record.operationFamily, attempt]).hash;
    const loopFailurePolicy = encoded([admitted.record.policy.id, admitted.record.policyGeneration.id,
      admitted.record.policy.countedFailureClasses]).hash;
    const receipt = append('loop-outcome-proof', json({ evidence, outcome, loopAttemptBinding,
      loopFailureClass: failureClass, loopFailurePolicy }), [admitted.fact.id]);
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
    admittedRun: (instant: number) => admittedRuns.get(instant)!, catchUpRun: (instant: number) => catchUpRuns.get(instant)!,
    admitScheduledRun: admitLiveScheduledRun,
    appendOutcome, appendResult, input, head, detail,
    get vector() { return vector(); }, advance: (n: number) => { now += n; }, time: (n: number) => { now = n; },
    stop: () => { stopped = true; }, generation: (value: string) => { generation = value; },
    revalidatePolicy: () => registerPolicy(), registerPolicy, assessmentFact: (id: string) => assessmentFacts.get(id),
    restorationReference: (id: string) => {
      const fact = assessmentFacts.get(id); if (!fact) throw new Error(`assessment unavailable: ${id}`);
      const record = (fact.body as { record: { id: string } }).record;
      return { owner: 'part-nine' as const, name: 'VerificationAssessment' as const, id: record.id };
    },
  };
}
