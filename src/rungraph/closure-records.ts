import {
  compareMeasurements, consumeOutcome, decode, decodeMeasurement, readHistoricalEvidence, scopeIncludes,
} from '../index.js';
import type {
  Clock, Evidence, FactEnvelopeReference, HistoricalRead, Inventory, Json, Outcome, Result, Scope,
} from '../index.js';
import {
  causalCone, causalStanding, decodeHistoricalBody, hashBytes, registerOwnedBody,
} from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import {
  constitutional, decodeSessionGrounding, factReference, recordFromWire, recordWire, runKinds,
} from './records.js';
import type { ConstitutionalReference, RunDecodeContext, RunStep, SessionGrounding } from './types.js';
import type {
  ContinuityAccounting, ExhaustionRecord, RunClosureRecord, RunOwnedRecordReference, UnreachableRunExit,
} from './closure-types.js';

const text: OwnedShape = { kind: 'text', maxLength: 1024 };
const integer: OwnedShape = { kind: 'integer' };
const list = (items: OwnedShape, maxLength = 1024): OwnedShape => ({ kind: 'array', items, maxLength });
const shape = (fields: Readonly<Record<string, OwnedShape>>, optional: readonly string[] = []): OwnedShape => ({ kind: 'object', fields, optional });
const ref = shape({ owner: text, name: text, id: text });
const constitutionalRef = shape({ type: text, id: text, fact: ref, field: text });
const clock = shape({ type: text, schemaVersion: integer, subject: shape({ kind: text, instance: text }), value: integer, unit: text, at: integer, by: text });
const measurement = shape({ type: text, schemaVersion: integer, subject: shape({ kind: text, instance: text }), value: integer, unit: text, at: clock, by: text });
const scope = shape({ type: text, schemaVersion: integer, kind: text, members: list(text) }, ['members']);
const base = { type: text, schemaVersion: integer, id: text };
const ownedRef = shape({ owner: text, name: text, id: text, fact: ref });
const recheck = shape({ at: clock, owner: constitutionalRef, obligation: ref });
const outsideAction = shape({ owner: constitutionalRef, action: text, scope });
const avenue = shape({ id: text, disposition: text, evidence: list(ref), step: ownedRef, outcome: constitutionalRef,
  constraint: ref, decision: constitutionalRef }, ['step', 'outcome', 'constraint', 'decision']);
const exhaustionShape = shape({ ...base, run: text, expected: text, blocker: ref, at: clock, basis: text, scope,
  grants: list(constitutionalRef), capabilityReads: list(ref), identityReads: list(ref), goal: text,
  avenues: list(avenue), avenueSetDecisions: list(constitutionalRef), resources: list(measurement),
  dependencies: list(ref), outsideAction, conclusion: constitutionalRef, reason: constitutionalRef, recheck });
const continuityShape = shape({ ...base, run: text, expected: text, grounding: ownedRef, prePauseInbound: ref,
  prePauseCapture: shape({ reference: text, hash: text, status: text }),
  firstReply: shape({ operation: text, digest: text }), disclosure: ref,
  disposition: shape({ kind: text, work: ref, result: constitutionalRef, input: ref, directive: constitutionalRef,
    reason: text }, ['work', 'result', 'input', 'directive', 'reason']) });
const unreachableShape = shape({ ...base, run: text, expected: text, proposer: constitutionalRef, standing: ref,
  frontier: { kind: 'text', maxLength: 65536 }, at: clock, phase: text, proposal: ownedRef,
  exhaustion: ownedRef, unsatisfiedClauses: list(text), externalDependency: outsideAction, recheck,
  settledOperations: list(text) }, ['proposal']);

export const runClosureShapes: Readonly<Record<string, OwnedShape>> = freeze({
  ExhaustionRecord: exhaustionShape,
  ContinuityAccounting: continuityShape,
  UnreachableRunExit: unreachableShape,
});

export const runClosureKinds = freeze({
  ExhaustionRecord: 'run-exhaustion',
  ContinuityAccounting: 'continuity-accounting',
  UnreachableRunExit: 'run-unreachable-exit',
} as const);

function checkShape(input: Json, policy: OwnedShape): void {
  if (policy.kind === 'text') {
    need(typeof input === 'string' && input.length > 0 && input.length <= policy.maxLength, 'bounded nonempty text required');
    return;
  }
  if (policy.kind === 'integer') {
    need(typeof input === 'number' && Number.isSafeInteger(input) && input >= 0, 'nonnegative safe integer required');
    return;
  }
  if (policy.kind === 'array') {
    need(Array.isArray(input) && input.length <= policy.maxLength, 'bounded list required');
    input.forEach(item => checkShape(item, policy.items));
    return;
  }
  need(policy.kind === 'object', 'unimplemented closure field policy');
  const value = object(input);
  need(Object.keys(value).every(key => Object.hasOwn(policy.fields, key)), 'unknown closure field');
  for (const [key, field] of Object.entries(policy.fields)) {
    if (value[key] === undefined && policy.optional?.includes(key)) continue;
    need(value[key] !== undefined, `missing required field ${key}`);
    checkShape(value[key]!, field);
  }
}

function exactFields(value: Record<string, Json>, fields: readonly string[], detail: string): void {
  need(Object.keys(value).sort().join(',') === [...fields].sort().join(','), detail);
}

function reference(value: Json, owner: string, name: string): void {
  const candidate = object(value);
  need(candidate.owner === owner && candidate.name === name, `${name}: wrong reference owner`);
}

function principal(value: Json, context: RunDecodeContext): void {
  const read = constitutional(value as unknown as ConstitutionalReference<'VerifiedPrincipal'>, 'VerifiedPrincipal', context);
  need(read.view.kind === 'agent' || read.view.kind === 'system', 'accountable owner must be verified agent or system');
  need(read.view.provenance.class === 'verified', 'accountable owner requires verified origin');
}

function verifiedPrincipal(value: Json, context: RunDecodeContext): void {
  const read = constitutional(value as unknown as ConstitutionalReference<'VerifiedPrincipal'>, 'VerifiedPrincipal', context);
  need(read.view.provenance.class === 'verified', 'principal requires verified origin');
}

function semanticFact(input: Json, kind: string, context: RunDecodeContext): { fact: FactEnvelope; body: Record<string, Json> } {
  const fact = factReference(input, context);
  need(fact.kind === kind, `${kind} evidence kind required`);
  return { fact, body: object(fact.body) };
}

function currentSemanticFact(input: Json, kind: string, subject: readonly string[], context: RunDecodeContext): {
  fact: FactEnvelope; body: Record<string, Json>;
} {
  const selected = semanticFact(input, kind, context);
  const related = context.facts.facts.filter(candidate => candidate.kind === kind).filter(candidate => {
    const body = object(candidate.body);
    return subject.every(field => same(body[field], selected.body[field]));
  });
  const current = related.filter(candidate => !related.some(other => other.id !== candidate.id
    && causalCone(other, context.facts.facts).some(ancestor => ancestor.id === candidate.id)));
  need(current.length === 1 && current[0]!.id === selected.fact.id,
    `${kind} evidence is stale, superseded, or conflicted for its exact subject`);
  return selected;
}

function factAge(referenceClock: Clock, fact: FactEnvelope, context: RunDecodeContext): number {
  return take(compareMeasurements<'clock'>(referenceClock, fact.at, context.preserved));
}

function boundedCurrentFact(fact: FactEnvelope, at: Clock, freshFor: number, context: RunDecodeContext): void {
  const age = factAge(at, fact, context);
  need(Number.isSafeInteger(freshFor) && freshFor > 0 && age >= 0 && age <= freshFor,
    'referenced observation is stale or from the future');
}

function runOpening(run: string, context: RunDecodeContext): { fact: FactEnvelope; record: Record<string, Json> } {
  const rows = context.facts.facts.filter(fact => fact.kind === runKinds.Run && object(fact.body).run === run);
  need(rows.length === 1, 'owner run is missing or conflicted');
  const fact = rows[0]!;
  const record = object(recordFromWire(object(fact.body).record!));
  need(record.type === 'Run' && record.id === run, 'owner run identity differs');
  return { fact, record };
}

function ownedRecord(value: Json, name: 'RunStep' | 'SessionGrounding' | 'ExhaustionRecord'
  | 'ContinuityAccounting' | 'UnreachableRunExit',
  context: RunDecodeContext): { fact: FactEnvelope; record: Record<string, Json> } {
  const candidate = object(value);
  need(candidate.owner === 'part-five' && candidate.name === name && typeof candidate.id === 'string',
    `${name} reference owner/name/id required`);
  const kind = name === 'RunStep' ? runKinds.RunTransition
    : name === 'SessionGrounding' ? runKinds.SessionGrounding
      : runClosureKinds[name as keyof typeof runClosureKinds];
  const fact = factReference(candidate.fact!, context);
  need(fact.kind === kind, `${name} reference fact kind differs`);
  const decoded = object(recordFromWire(object(fact.body).record!));
  const record = name === 'RunStep' ? object(decoded.step!) : decoded;
  need(record.id === candidate.id, `${name} reference identity differs from fact`);
  return { fact, record };
}

function validateOutsideAction(value: Json, context: RunDecodeContext): void {
  const action = object(value);
  verifiedPrincipal(action.owner!, context);
  action.scope = json(take(decode('Scope', action.scope, context.types)));
}

function validateRecheck(value: Json, from: Clock, context: RunDecodeContext, run: string, blocker: string): void {
  const candidate = object(value);
  candidate.at = json(take(decodeMeasurement('clock', candidate.at, context.types)));
  principal(candidate.owner!, context);
  need(take(compareMeasurements<'clock'>(candidate.at as unknown as Clock, from, context.preserved)) > 0,
    'recheck must be a future clock obligation');
  const obligation = currentSemanticFact(candidate.obligation!, 'run-observation-obligation', ['run', 'blocker'], context);
  need(obligation.body.run === run && obligation.body.blocker === blocker
    && obligation.body.due === encoded(candidate.at).hash && obligation.body.owner === object(candidate.owner).id,
  'recheck obligation does not bind this run, blocker, owner, and due clock');
}

function captureBindingFact(fact: FactEnvelope, context: RunDecodeContext): FactEnvelope {
  const schema = context.facts.schemas.find(candidate => candidate.kind === fact.kind && candidate.version === fact.schemaVersion);
  need(schema, 'continuity capture not bound to the signed message capture field');
  if (Object.values(schema.fields).some(policy => policy.kind === 'capture')) return fact;
  const bearers = Object.entries(schema.fields).filter(([, policy]) => policy.kind === 'reference').map(([field]) => {
    const id = object(fact.body)[field];
    const ancestor = typeof id === 'string' ? context.facts.facts.find(candidate => candidate.id === id) : undefined;
    const ancestorSchema = ancestor && context.facts.schemas.find(candidate => candidate.kind === ancestor.kind
      && candidate.version === ancestor.schemaVersion);
    need(ancestor && ancestorSchema, 'continuity capture ancestor missing or unverified');
    return { ancestor, captureBearing: Object.values(ancestorSchema.fields).some(policy => policy.kind === 'capture') };
  }).filter(candidate => candidate.captureBearing);
  need(bearers.length === 1, 'continuity capture ancestor missing, ambiguous, or unverified');
  const selected = bearers[0]!;
  need(causalCone(fact, context.facts.facts).some(ancestor => ancestor.id === selected.ancestor.id),
    'continuity capture ancestor missing or unverified');
  return selected.ancestor;
}

function historicalEvidence(id: string, context: RunDecodeContext): HistoricalRead<Evidence> {
  const matches: HistoricalRead<Evidence>[] = [];
  for (const fact of context.facts.facts) {
    const schema = context.facts.schemas.find(candidate => candidate.kind === fact.kind && candidate.version === fact.schemaVersion);
    if (!schema || !Object.values(schema.fields).some(field => field.kind === 'constitutional' && field.type === 'Evidence')) continue;
    const body = take(decodeHistoricalBody(fact, context.facts, causalStanding(fact, context.facts, false).decode));
    for (const record of body.records) if (record.view.type === 'Evidence' && record.view.id === id)
      matches.push(record as HistoricalRead<Evidence>);
  }
  need(matches.length > 0, 'outcome evidence identity is missing or conflicted');
  need(matches.every(match => match.captureStatus === 'available' && match.unavailableCaptures.length === 0),
    'evidence-unavailable: repeated outcome evidence dependency cannot be reinspected');
  const values = new Map(matches.map(match => [encoded(match.view).bytes, match]));
  need(values.size === 1, 'outcome evidence identity is missing or conflicted');
  return [...matches].sort((left, right) => left.origin.id.localeCompare(right.origin.id))[0]!;
}

function validateExhaustion(input: Json, context: RunDecodeContext): ExhaustionRecord {
  const value = object(input);
  need(value.type === 'ExhaustionRecord' && value.schemaVersion === 1, 'type or schema version unknown');
  need(value.basis === 'bounded-investigation', 'capacity, queue, quota, breaker or clock cannot construct exhaustion');
  const run = runOpening(String(value.run), context);
  const runExitTest = object(run.record.exitTest);
  const runBudget = object(run.record.budget);
  const blocker = currentSemanticFact(value.blocker!, 'run-exit-evaluation',
    ['run', 'check', 'version', 'subject', 'acceptance'], context);
  need(blocker.body.run === value.run && blocker.body.check === runExitTest.check
    && blocker.body.version === runExitTest.version && blocker.body.subject === runExitTest.subject
    && blocker.body.acceptance === runExitTest.acceptance && blocker.body.status === 'unsatisfied',
  'blocker is not the immutable exit-test evaluation for this run');
  value.scope = json(take(decode('Scope', value.scope, context.types)));
  validateOutsideAction(value.outsideAction!, context);
  const exhaustionScope = take(decode('Scope', value.scope, context.types));
  need(scopeIncludes(take(decode('Scope', run.record.scope, context.types)), exhaustionScope),
    'exhaustion scope exceeds the run');
  const accountableOwner = constitutional(run.record.owner as unknown as ConstitutionalReference<'VerifiedPrincipal'>,
    'VerifiedPrincipal', context).view;
  (value.grants as unknown as ConstitutionalReference<'StandingGrant'>[]).forEach(referenceValue => {
    const grant = constitutional(referenceValue, 'StandingGrant', context).view;
    need(scopeIncludes(take(decode('Scope', json(grant.scope), context.types)), exhaustionScope)
      && grant.grantee.id === accountableOwner.id && same(grant.grantee.provenance, accountableOwner.provenance),
    'exhaustion grant does not cover its scope and owner');
  });
  const capabilities = value.capabilityReads as Json[];
  const identities = value.identityReads as Json[];
  need(capabilities.length > 0 && identities.length > 0,
    'exhaustion requires current capability and owned-identity reads');
  const at = take(decodeMeasurement('clock', value.at, context.types));
  const freshFor = Number(runExitTest.freshFor);
  boundedCurrentFact(blocker.fact, at, freshFor, context);
  for (const referenceValue of capabilities) {
    const read = currentSemanticFact(referenceValue, 'run-capability-read', ['run', 'subject', 'capability'], context);
    need(read.body.run === value.run && read.body.subject === value.run && read.body.status === 'current',
      'capability read has the wrong run subject or status');
    boundedCurrentFact(read.fact, at, freshFor, context);
  }
  for (const referenceValue of identities) {
    const read = currentSemanticFact(referenceValue, 'run-owned-identity-read', ['run', 'principal'], context);
    need(read.body.run === value.run && read.body.principal === object(object(value.outsideAction).owner).id
      && read.body.status === 'current', 'owned-identity read has the wrong run subject, principal, or status');
    boundedCurrentFact(read.fact, at, freshFor, context);
  }
  const relatedDependencies = context.facts.facts.filter(fact => fact.kind === 'run-dependency-observation'
    && object(fact.body).run === value.run && object(fact.body).blocker === blocker.fact.id);
  const currentDependencies = relatedDependencies.filter(candidate => !relatedDependencies.some(other => other.id !== candidate.id
    && causalCone(other, context.facts.facts).some(ancestor => ancestor.id === candidate.id)));
  const submittedDependencies = value.dependencies as Json[];
  for (const referenceValue of submittedDependencies) {
    const dependency = currentSemanticFact(referenceValue, 'run-dependency-observation', ['run', 'blocker'], context);
    need(dependency.body.run === value.run && dependency.body.blocker === blocker.fact.id
      && dependency.body.status === 'blocked', 'dependency observation has the wrong run or blocker subject');
    boundedCurrentFact(dependency.fact, at, freshFor, context);
  }
  need(same(submittedDependencies.map(referenceValue => object(referenceValue).id).sort(),
    currentDependencies.map(fact => fact.id).sort()),
  'exhaustion dependencies differ from the complete current dependency inventory');
  const conclusion = constitutional(value.conclusion as unknown as ConstitutionalReference<'Decision'>, 'Decision', context);
  const reason = constitutional(value.reason as unknown as ConstitutionalReference<'Decision'>, 'Decision', context);
  const exhaustive = conclusion.view.conclusion.value;
  need(conclusion.view.id !== reason.view.id && conclusion.view.conclusion.subject === value.run
    && conclusion.view.conclusion.predicate === 'exhaustion-conclusion' && typeof exhaustive === 'boolean'
    && reason.view.conclusion.subject === value.run && reason.view.conclusion.predicate === 'exhaustion-reason'
    && reason.view.conclusion.value === true,
  'exhaustion conclusion and reason must be separate run-bound decisions');
  const avenues = value.avenues as Json[];
  const ids = new Set<string>();
  need(avenues.length > 0, 'finite avenue set required');
  for (const raw of avenues) {
    const id = String(object(raw).id);
    need(!ids.has(id), 'duplicate exhaustion avenue');
    ids.add(id);
  }
  const avenueSetDigest = encoded({ run: value.run, exitTest: runExitTest, goal: value.goal, avenues: [...ids].sort() }).hash;
  const decisions = value.avenueSetDecisions as unknown as ConstitutionalReference<'Decision'>[];
  need(decisions.length > 0, 'avenue set requires a recorded decision');
  decisions.forEach(referenceValue => {
    const decision = constitutional(referenceValue, 'Decision', context).view;
    need(decision.conclusion.subject === value.run && decision.conclusion.predicate === 'exhaustion-avenue-set'
      && decision.conclusion.value === avenueSetDigest,
    'avenue-set decision does not bind this run, goal, and complete avenue identity set');
  });
  for (const raw of avenues) {
    const avenueValue = object(raw);
    need((avenueValue.evidence as Json[]).length > 0, 'avenue evidence required');
    (avenueValue.evidence as Json[]).forEach(referenceValue => factReference(referenceValue, context));
    if (avenueValue.disposition === 'tried') {
      exactFields(avenueValue, ['id', 'disposition', 'evidence', 'step', 'outcome'], 'tried avenue fields differ');
      const step = ownedRecord(avenueValue.step!, 'RunStep', context).record;
      need(step.run === value.run, 'exhaustion avenue step belongs to another run');
      const outcome = constitutional(avenueValue.outcome as unknown as ConstitutionalReference<'Outcome'>, 'Outcome', context);
      const occurrence = consumeOutcome(outcome.view as unknown as Outcome, {
        happened: () => 'happened' as const,
        'did-not-happen': () => 'did-not-happen' as const,
        uncertain: () => 'uncertain' as const,
      });
      if (exhaustive === true) need(occurrence !== 'uncertain', 'unknown or successful avenue cannot prove exhaustion');
      for (const evidenceId of outcome.view.evidence) {
        const evidence = historicalEvidence(evidenceId, context);
        const claim = take(readHistoricalEvidence(evidence, at, context.preserved));
        const claimValue = object(claim.value);
        need(claim.subject === object(step.operation).key && claim.predicate === 'operation-outcome'
          && claimValue.digest === object(step.operation).digest && claimValue.kind === occurrence,
        'attempt outcome evidence does not bind the exact step operation and digest');
      }
    } else if (avenueValue.disposition === 'outside-standing') {
      exactFields(avenueValue, ['id', 'disposition', 'evidence', 'constraint'], 'outside-standing avenue fields differ');
      const constraint = currentSemanticFact(avenueValue.constraint!, 'run-standing-constraint', ['run', 'avenue'], context);
      need(constraint.body.run === value.run && constraint.body.avenue === avenueValue.id
        && constraint.body.status === 'outside-standing', 'standing constraint does not bind this run and avenue');
      boundedCurrentFact(constraint.fact, at, freshFor, context);
    } else if (avenueValue.disposition === 'inapplicable') {
      exactFields(avenueValue, ['id', 'disposition', 'evidence', 'decision'], 'inapplicable avenue fields differ');
      const decision = constitutional(avenueValue.decision as unknown as ConstitutionalReference<'Decision'>,
        'Decision', context).view;
      need(decision.conclusion.subject === String(avenueValue.id)
        && decision.conclusion.predicate === 'avenue-inapplicable' && decision.conclusion.value === true,
      'inapplicable decision does not positively bind this avenue');
    } else need(false, 'unknown exhaustion avenue disposition');
  }
  const resources = value.resources as Json[];
  need(resources.length > 0, 'exhaustion resource charges required');
  value.resources = resources.map(raw => {
    const subject = object(object(raw).subject);
    const kind = String(subject.kind);
    need(kind !== 'clock', 'clock is not an exhaustion resource');
    const decoded = take(decodeMeasurement(kind, raw, context.types));
    need(decoded.subject.instance === runBudget.id && decoded.value >= 0,
      'exhaustion resource charge names another run budget or is negative');
    return json(decoded);
  });
  principal(object(value.recheck).owner!, context);
  value.at = json(at);
  validateRecheck(value.recheck!, at, context, String(value.run), blocker.fact.id);
  return freeze(value) as unknown as ExhaustionRecord;
}

function validatePendingContinuityWork(referenceValue: Json, run: string, inbound: FactEnvelope,
  context: RunDecodeContext): void {
  const submitted = factReference(referenceValue, context);
  const matching = context.facts.facts.filter(fact => fact.kind === 'continuity-pending-work').filter(fact => {
    const body = object(fact.body);
    return body.run === run && body.inbound === inbound.id;
  });
  const current = matching.filter(candidate => !matching.some(other => other.id !== candidate.id
    && causalCone(other, context.facts.facts).some(ancestor => ancestor.id === candidate.id)));
  need(current.length <= 1, 'pending continuity work is conflicted for this run and inbound');
  if (!current.length) {
    need(submitted.id === inbound.id, 'pending continuity work does not retain the pre-pause inbound obligation');
    return;
  }
  const observed = current[0]!;
  const body = object(observed.body);
  const ownerReference = runOpening(run, context).record.owner as unknown as ConstitutionalReference<'VerifiedPrincipal'>;
  const owner = constitutional(ownerReference, 'VerifiedPrincipal', context).view;
  need(body.status === 'open' && observed.principal.id === owner.id
    && same(observed.principal.provenance, owner.provenance),
  'pending continuity work is closed or has no accountable owner');
  need(submitted.kind === 'continuity-pending-work' && submitted.id === observed.id,
    'pending continuity work reference is stale or differs from the current inventory');
}

function validateContinuity(input: Json, context: RunDecodeContext): ContinuityAccounting {
  const value = object(input);
  need(value.type === 'ContinuityAccounting' && value.schemaVersion === 1, 'type or schema version unknown');
  const groundingReference = ownedRecord(value.grounding!, 'SessionGrounding', context);
  const grounding = take(decodeSessionGrounding(recordFromWire(object(groundingReference.fact.body).record!), context));
  need(grounding.reason === 'resume', 'continuity requires post-compaction resume grounding');
  need(grounding.run === value.run && grounding.expected === value.expected,
    'continuity grounding belongs to another run or head');
  const inbound = factReference(value.prePauseInbound!, context);
  need(context.stimulusKinds.includes(inbound.kind), 'continuity pre-pause inbound is not an admitted stimulus');
  if (grounding.lastInbound.id !== inbound.id) {
    const witnesses = context.facts.facts.filter(fact => fact.kind === runKinds.SessionGrounding
      && fact.id !== groundingReference.fact.id
      && causalCone(groundingReference.fact, context.facts.facts).some(ancestor => ancestor.id === fact.id))
      .map(fact => ({ fact, record: take(decodeSessionGrounding(recordFromWire(object(fact.body).record!), context)) }))
      .filter(row => row.record.run === value.run && row.record.expected === value.expected
        && row.record.reason === 'resume' && row.record.lastInbound.id === inbound.id);
    const distinct = new Map(witnesses.map(row => [encoded(row.record).bytes, row]));
    need(distinct.size === 1, 'continuity pre-pause inbound lacks a unique signed resume grounding witness');
  }
  const capture = object(value.prePauseCapture);
  const stored = context.facts.captures[String(capture.reference)];
  need(/^sha256:[a-f0-9]{64}$/.test(String(capture.hash))
    && ['available', 'unavailable'].includes(String(capture.status)), 'continuity capture status or hash invalid');
  const carrier = captureBindingFact(inbound, context);
  const schema = context.facts.schemas.find(candidate => candidate.kind === carrier.kind
    && candidate.version === carrier.schemaVersion);
  need(schema && Object.entries(schema.fields).some(([field, policy]) => policy.kind === 'capture'
    && same(object(carrier.body)[field], { reference: capture.reference, hash: capture.hash })),
  'continuity capture is not bound to the pre-pause inbound');
  if (capture.status === 'available')
    need(stored?.status === 'available' && stored.bytes !== null && stored.hash === capture.hash
      && hashBytes(stored.bytes) === capture.hash, 'continuity capture is not available');
  else need(!stored || stored.status !== 'available', 'available pre-pause capture cannot be called unavailable');
  const reply = object(value.firstReply);
  need(/^sha256:[a-f0-9]{64}$/.test(String(reply.digest)), 'first reply requires exact operation digest');
  const proposals = context.facts.facts.filter(fact => fact.kind === 'continuity-reply-proposal').filter(fact => {
    const body = object(fact.body);
    return body.run === value.run && body.expected === value.expected
      && body.grounding === groundingReference.fact.id && body.inbound === inbound.id;
  });
  need(proposals.length > 0, 'first reply operation was not durably and uniquely proposed');
  const identities = new Set(proposals.map(fact => {
    const body = object(fact.body);
    return encoded({ operation: body.operation, digest: body.digest, status: body.status, permission: body.permission }).bytes;
  }));
  need(identities.size === 1, 'first reply operation identity is conflicted for this grounding and inbound');
  const proposal = proposals[0]!;
  const proposalBody = object(proposal.body);
  need(proposalBody.operation === reply.operation && proposalBody.digest === reply.digest
    && proposalBody.status === 'proposed' && proposalBody.permission === 'none',
  'first reply operation proposal does not bind the exact digest, grounding, inbound, and non-authorizing state');
  const disclosure = semanticFact(value.disclosure!, 'continuity-disclosure', context);
  need(disclosure.body.run === value.run && disclosure.body.operation === reply.operation
    && disclosure.body.digest === reply.digest && disclosure.body.grounding === groundingReference.fact.id
    && disclosure.body.inbound === inbound.id,
  'compaction disclosure does not bind the actual first reply and inbound');
  need(causalCone(disclosure.fact, context.facts.facts).some(fact => fact.id === proposal.id),
    'compaction disclosure is not causally linked to the reply proposal');
  const disposition = object(value.disposition);
  if (disposition.kind === 'addressed') {
    exactFields(disposition, ['kind', 'work', 'result'], 'addressed continuity fields differ');
    const work = currentSemanticFact(disposition.work!, 'continuity-addressed-work',
      ['run', 'inbound', 'operation', 'digest'], context);
    need(work.body.run === value.run && work.body.inbound === inbound.id
      && work.body.operation === reply.operation && work.body.digest === reply.digest
      && work.body.status === 'durable', 'addressed work does not bind the actual inbound and first reply');
    need(causalCone(work.fact, context.facts.facts).some(fact => fact.id === disclosure.fact.id),
      'addressed work is not causally linked to the disclosure');
    const resultReference = disposition.result as unknown as ConstitutionalReference<'Result'>;
    const result = constitutional(resultReference, 'Result', context);
    const resultFact = factReference(json(resultReference.fact), context);
    const owner = constitutional(runOpening(String(value.run), context).record.owner as unknown as ConstitutionalReference<'VerifiedPrincipal'>,
      'VerifiedPrincipal', context).view;
    need(object(json(result.view)).kind === 'Success', 'addressed continuity result is not a usable durable answer or work result');
    need(resultFact.principal.id === owner.id && same(resultFact.principal.provenance, owner.provenance),
      'addressed continuity result lacks its accountable run owner witness');
    need(causalCone(work.fact, context.facts.facts).some(fact => fact.id === resultFact.id),
      'addressed work is not causally linked to its durable answer or work result');
  } else if (disposition.kind === 'superseded') {
    exactFields(disposition, ['kind', 'input', 'directive'], 'superseded continuity fields differ');
    const later = factReference(disposition.input!, context);
    need(context.stimulusKinds.includes(later.kind) && later.id !== inbound.id
      && causalCone(later, context.facts.facts).some(fact => fact.id === inbound.id),
    'superseding input is not a later admitted inbound');
    const directive = constitutional(disposition.directive as unknown as ConstitutionalReference<'Directive'>,
      'Directive', context).view;
    const runRecord = runOpening(String(value.run), context).record;
    const priorReference = (runRecord.directives as unknown as ConstitutionalReference<'Directive'>[])
      .find(referenceValue => referenceValue.id === directive.supersedes);
    need(directive.supersedes !== undefined && priorReference,
      'superseding directive is outside the run directive lineage');
    const prior = constitutional(priorReference, 'Directive', context).view;
    const directiveFact = factReference(object(disposition.directive).fact!, context);
    need(object(later.body).prior === inbound.id && directive.supersedes === prior.id
      && later.principal.id === directive.principal.id
      && scopeIncludes(directive.scope as Scope, take(decode('Scope', runRecord.scope, context.types)) as Scope)
      && causalCone(later, context.facts.facts).some(fact => fact.id === directiveFact.id),
    'superseding input does not bind this run, inbound, directive lineage, signer, and scope');
  } else if (disposition.kind === 'pending') {
    exactFields(disposition, ['kind', 'work', 'reason'], 'pending continuity fields differ');
    validatePendingContinuityWork(disposition.work!, String(value.run), inbound, context);
  } else need(false, 'unknown continuity disposition');
  if (capture.status === 'unavailable') need(disposition.kind === 'pending',
    'unavailable pre-pause capture must remain pending');
  return freeze(value) as unknown as ContinuityAccounting;
}

function validateUnreachable(input: Json, context: RunDecodeContext): UnreachableRunExit {
  const value = object(input);
  need(value.type === 'UnreachableRunExit' && value.schemaVersion === 1, 'type or schema version unknown');
  need(value.phase === 'proposal' || value.phase === 'close', 'unknown unreachable exit phase');
  exactFields(value, ['type', 'schemaVersion', 'id', 'run', 'expected', 'proposer', 'standing', 'frontier', 'at', 'phase',
    ...(value.phase === 'close' ? ['proposal'] : []), 'exhaustion', 'unsatisfiedClauses', 'externalDependency', 'recheck',
    'settledOperations'], 'unreachable exit mixed or omitted fields');
  principal(value.proposer!, context);
  factReference(value.standing!, context);
  const run = runOpening(String(value.run), context);
  need(same(value.proposer, run.record.owner), 'unreachable exit proposer differs from accountable run owner');
  const exhaustionReference = ownedRecord(value.exhaustion!, 'ExhaustionRecord', context);
  const exhaustion = take(decodeExhaustionRecord(recordFromWire(object(exhaustionReference.fact.body).record!), context));
  need(exhaustion.run === value.run && exhaustion.id === object(value.exhaustion).id,
    'ExhaustionRecord belongs to another run');
  const conclusion = constitutional(exhaustion.conclusion, 'Decision', context).view;
  need(conclusion.conclusion.subject === value.run && conclusion.conclusion.predicate === 'exhaustion-conclusion'
    && conclusion.conclusion.value === true, 'partial exhaustion cannot authorize unreachable closure');
  const clauses = value.unsatisfiedClauses as string[];
  need(clauses.length > 0 && new Set(clauses).size === clauses.length,
    'unreachable exit requires unique unsatisfied clauses');
  const evaluation = currentSemanticFact(json(exhaustion.blocker), 'run-exit-evaluation',
    ['run', 'check', 'version', 'subject', 'acceptance'], context);
  need(evaluation.body.run === value.run && evaluation.body.clauses === encoded(clauses).bytes,
    'unsatisfied clauses do not match the immutable exit-test evaluation');
  validateOutsideAction(value.externalDependency!, context);
  need(same(value.externalDependency, json(exhaustion.outsideAction)),
    'unreachable dependency differs from ExhaustionRecord');
  const at = take(decodeMeasurement('clock', value.at, context.types));
  value.at = json(at);
  validateRecheck(value.recheck!, at, context, String(value.run), evaluation.fact.id);
  need(same(value.recheck, json(exhaustion.recheck)), 'unreachable recheck differs from ExhaustionRecord');
  need(new Set(value.settledOperations as string[]).size === (value.settledOperations as string[]).length,
    'duplicate operation in settlement manifest');
  if (value.phase === 'proposal') need(value.proposal === undefined, 'proposal cannot reference another proposal');
  else {
    const proposal = ownedRecord(value.proposal!, 'UnreachableRunExit', context);
    need(proposal.record.phase === 'proposal' && proposal.record.run === value.run
      && proposal.record.id === value.expected && same({ ...proposal.record, id: value.id, expected: value.expected,
        phase: value.phase, proposal: value.proposal, frontier: value.frontier }, value),
    'unreachable close does not exactly continue its witnessed proposal');
  }
  return freeze(value) as unknown as UnreachableRunExit;
}

function hydrate(value: Json, context: RunDecodeContext): unknown {
  if (Array.isArray(value)) return value.map(item => hydrate(item, context));
  if (value && typeof value === 'object') {
    const candidate = object(value);
    if (candidate.type === 'Scope' && candidate.schemaVersion !== undefined)
      return take(decode('Scope', candidate, context.types));
    if (candidate.type === 'Measurement' && candidate.schemaVersion !== undefined)
      return take(decodeMeasurement(String(object(candidate.subject).kind), candidate, context.types));
    return Object.fromEntries(Object.entries(candidate).map(([key, item]) => [key, hydrate(item, context)]));
  }
  return value;
}

function decodeClosure<T>(name: keyof typeof runClosureKinds, input: unknown,
  context: RunDecodeContext): Result<T> {
  return boundary(`Decode${name}`, input, context, safe => {
    const safeJson = json(safe);
    const alreadyWire = name === 'UnreachableRunExit'
      && typeof object(safeJson).frontier === 'string';
    const wire = alreadyWire ? safeJson : closureRecordWire(safe as unknown as RunClosureRecord);
    checkShape(wire, runClosureShapes[name]!);
    const restored = recordFromWire(wire);
    const validated = name === 'ExhaustionRecord' ? validateExhaustion(restored, context)
      : name === 'ContinuityAccounting' ? validateContinuity(restored, context)
        : validateUnreachable(restored, context);
    return hydrate(json(validated), context) as T;
  });
}

export const decodeExhaustionRecord = (input: unknown, context: RunDecodeContext): Result<ExhaustionRecord> =>
  decodeClosure('ExhaustionRecord', input, context);
export const decodeContinuityAccounting = (input: unknown, context: RunDecodeContext): Result<ContinuityAccounting> =>
  decodeClosure('ContinuityAccounting', input, context);
export const decodeUnreachableRunExit = (input: unknown, context: RunDecodeContext): Result<UnreachableRunExit> =>
  decodeClosure('UnreachableRunExit', input, context);

export const closureRecordWire = (record: RunClosureRecord): Json => recordWire(record as never);

export function closureRecordReferences(record: Json): readonly string[] {
  const ids = new Set<string>();
  const walk = (value: Json): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      const candidate = object(value);
      if (candidate.owner === 'part-two' && candidate.name === 'FactEnvelope' && typeof candidate.id === 'string')
        ids.add(candidate.id);
      Object.values(candidate).forEach(walk);
    }
  };
  walk(record);
  return [...ids].sort();
}

export function runClosureFactSchemas(context: RunDecodeContext): Result<{
  schemas: readonly FactSchema[];
  registrations: readonly OwnedBodyRegistration[];
}> {
  return boundary('RunClosureFactSchemas', null, context, () => {
    const registrations = Object.keys(runClosureKinds).map(name => take(registerOwnedBody({
      owner: 'part-five',
      name,
      currentVersion: 1,
      versions: { 1: { validate: (value: Json) => ({ ok: true as const, value }) } },
      migrations: {},
      decodeCurrent: (value, current) => {
        const coneFacts = causalCone(current.origin, current.facts.facts);
        const local = { ...context, types: current.facts.decode, facts: { ...current.facts, facts: coneFacts } };
        const decoded = name === 'ExhaustionRecord' ? take(decodeExhaustionRecord(value, local))
          : name === 'ContinuityAccounting' ? take(decodeContinuityAccounting(value, local))
            : take(decodeUnreachableRunExit(value, local));
        const cone = new Set(coneFacts.map(fact => fact.id));
        need(closureRecordReferences(json(decoded)).every(id => cone.has(id)),
          'closure record reference is outside signed causal cone');
        return { ok: true, value: closureRecordWire(decoded as RunClosureRecord) };
      },
    }, runClosureShapes[name]!, context)));
    const first = context.facts.schemas.find(schema => context.stimulusKinds.includes(schema.kind));
    need(first, 'stimulus schema required for closure installation');
    const schemas = Object.entries(runClosureKinds).map(([name, kind]): FactSchema => ({
      kind,
      version: 1,
      fields: {
        run: { kind: 'text', maxLength: 1024 },
        record: { kind: 'owned', owner: 'part-five', name },
      },
      machineScope: 'shared',
      standing: 'requester',
      action: first.action,
      scope: first.scope,
      causallyBound: true,
      requiredReferences: [],
      authority: 'none',
    }));
    return { schemas, registrations };
  });
}

export function validateContinuitySendWitness(accountingFact: FactEnvelope, accounting: ContinuityAccounting,
  input: FactEnvelopeReference, now: Clock, freshFor: number, context: RunDecodeContext): FactEnvelope {
  const send = currentSemanticFact(json(input), 'continuity-first-reply-send', ['run', 'accounting', 'operation'], context);
  const body = send.body;
  exactFields(body, ['run', 'accounting', 'operation', 'digest', 'disclosure', 'dispositionKind', 'disposition', 'status'],
    'first-reply send record fields differ');
  const disposition = accounting.disposition.kind === 'superseded'
    ? accounting.disposition.input : accounting.disposition.work;
  need(body.run === accounting.run && body.accounting === accountingFact.id
    && body.operation === accounting.firstReply.operation && body.digest === accounting.firstReply.digest
    && body.disclosure === accounting.disclosure.id && body.dispositionKind === accounting.disposition.kind
    && body.disposition === disposition.id && body.status === 'admitted',
  'first-reply send does not bind the exact accounting, payload, disclosure, and disposition');
  const cone = causalCone(send.fact, context.facts.facts);
  need([accountingFact.id, accounting.disclosure.id, disposition.id].every(id => cone.some(fact => fact.id === id)),
    'first-reply send is missing its accounting, disclosure, or disposition causal link');
  boundedCurrentFact(send.fact, now, freshFor, context);
  return send.fact;
}
