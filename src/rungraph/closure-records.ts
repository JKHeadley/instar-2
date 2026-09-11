import {
  compareMeasurements, consumeOutcome, decode, decodeMeasurement, readHistoricalEvidence, scopeIncludes,
} from '../index.js';
import type {
  Clock, Evidence, FactEnvelopeReference, HistoricalRead, Inventory, Json, Outcome, Result, Scope,
} from '../index.js';
import {
  causalCone, causalStanding, decodeHistoricalBody, registerOwnedBody,
} from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import {
  constitutional, factReference, recordFromWire, recordWire, runKinds,
} from './records.js';
import type {
  ConstitutionalReference, RunDecodeContext, RunStep, UnreachableRunExit,
} from './types.js';
import type { ExhaustionRecord, RunClosureRecord } from './closure-types.js';

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
const unreachableShape = shape({ ...base, run: text, expected: text, proposer: constitutionalRef, standing: ref, kind: text,
  frontier: { kind: 'text', maxLength: 65536 }, at: clock, phase: text, proposal: ownedRef,
  exhaustion: ownedRef, unsatisfiedClauses: list(text), externalDependency: outsideAction, recheck,
  settledOperations: list(text) }, ['proposal']);

export const runClosureShapes: Readonly<Record<string, OwnedShape>> = freeze({
  ExhaustionRecord: exhaustionShape,
  UnreachableRunExit: unreachableShape,
});

export const runClosureKinds = freeze({
  ExhaustionRecord: 'run-exhaustion',
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
  need(rows.length > 0, 'owner run is missing or conflicted');
  const fact = rows[0]!;
  const record = object(recordFromWire(object(fact.body).record!));
  need(rows.every(row => same(recordFromWire(object(row.body).record!), record)),
    'owner run is missing or conflicted');
  need(record.type === 'Run' && record.id === run, 'owner run identity differs');
  return { fact, record };
}

function ownedRecord(value: Json, name: 'RunStep' | 'ExhaustionRecord' | 'UnreachableRunExit',
  context: RunDecodeContext): { fact: FactEnvelope; record: Record<string, Json> } {
  const candidate = object(value);
  need(candidate.owner === 'part-five' && candidate.name === name && typeof candidate.id === 'string',
    `${name} reference owner/name/id required`);
  const kind = name === 'RunStep' ? runKinds.RunTransition : runClosureKinds[name];
  const fact = factReference(candidate.fact!, context);
  need(fact.kind === kind, `${name} reference fact kind differs`);
  const decoded = object(recordFromWire(object(fact.body).record!));
  const record = name === 'RunStep' ? object(decoded.step!) : decoded;
  need(record.id === candidate.id, `${name} reference identity differs from fact`);
  need(decoded.run === object(fact.body).run && record.run === decoded.run,
    `${name} reference envelope and record run differ`);
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
  const conclusion = constitutional(value.conclusion as unknown as ConstitutionalReference<'Decision'>, 'Decision', context);
  const reason = constitutional(value.reason as unknown as ConstitutionalReference<'Decision'>, 'Decision', context);
  const exhaustive = conclusion.view.conclusion.value;
  need(conclusion.view.id !== reason.view.id && conclusion.view.conclusion.subject === value.run
    && conclusion.view.conclusion.predicate === 'exhaustion-conclusion' && typeof exhaustive === 'boolean'
    && reason.view.conclusion.subject === value.run && reason.view.conclusion.predicate === 'exhaustion-reason'
    && reason.view.conclusion.value === true,
  'exhaustion conclusion and reason must be separate run-bound decisions');
  const submittedDependencies = value.dependencies as Json[];
  for (const referenceValue of submittedDependencies) {
    const dependency = currentSemanticFact(referenceValue, 'run-dependency-observation', ['run', 'blocker'], context);
    need(dependency.body.run === value.run && dependency.body.blocker === blocker.fact.id
      && (dependency.body.status === 'blocked' || exhaustive === false && dependency.body.status === 'unknown'),
    'dependency observation has the wrong run or blocker subject');
    boundedCurrentFact(dependency.fact, at, freshFor, context);
  }
  need(same(submittedDependencies.map(referenceValue => object(referenceValue).id).sort(),
    currentDependencies.map(fact => fact.id).sort()),
  'exhaustion dependencies differ from the complete current dependency inventory');
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
  const recordedResources = (runBudget.resources as Json[]).map(raw => {
    const kind = String(object(object(raw).subject).kind);
    return json(take(decodeMeasurement(kind, raw, context.types)));
  });
  need(same(value.resources, recordedResources),
    'exhaustion resource charge lacks matching signed run-budget evidence');
  principal(object(value.recheck).owner!, context);
  value.at = json(at);
  validateRecheck(value.recheck!, at, context, String(value.run), blocker.fact.id);
  return freeze(value) as unknown as ExhaustionRecord;
}

function validateUnreachable(input: Json, context: RunDecodeContext): UnreachableRunExit {
  const value = object(input);
  need(value.type === 'UnreachableRunExit' && value.schemaVersion === 1, 'type or schema version unknown');
  need(value.kind === 'unreachable', 'unreachable exit kind required');
  need(value.phase === 'proposal' || value.phase === 'close', 'unknown unreachable exit phase');
  exactFields(value, ['type', 'schemaVersion', 'id', 'run', 'expected', 'proposer', 'standing', 'frontier', 'at', 'kind', 'phase',
    ...(value.phase === 'close' ? ['proposal'] : []), 'exhaustion', 'unsatisfiedClauses', 'externalDependency', 'recheck',
    'settledOperations'], 'unreachable exit mixed or omitted fields');
  principal(value.proposer!, context);
  const run = runOpening(String(value.run), context);
  need(same(value.proposer, run.record.owner), 'unreachable exit proposer differs from accountable run owner');
  const standing = factReference(value.standing!, context);
  const opening = factReference(run.record.opening!, context);
  const authority = object(run.record.authority);
  need(standing.id === opening.id && standing.kind === opening.kind
    && standing.id === object(authority.resolution).id,
  'unreachable exit standing is not the run current standing resolution');
  const proposer = constitutional(value.proposer as unknown as ConstitutionalReference<'VerifiedPrincipal'>,
    'VerifiedPrincipal', context).view;
  need(standing.principal.id === proposer.id && same(standing.principal.provenance, proposer.provenance),
    'unreachable exit standing lacks the exact proposer witness');
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
        phase: value.phase, proposal: value.proposal, frontier: value.frontier, at: value.at }, value),
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

const unsupportedSliceKeys = new Set([
  'grounding', 'prePauseInbound', 'prePauseCapture', 'firstReply', 'continuitySend',
]);

function carriesUnsupportedSliceAPrime(input: Json): boolean {
  if (Array.isArray(input)) return input.some(carriesUnsupportedSliceAPrime);
  if (input === null || typeof input !== 'object') return false;
  const value = input as Record<string, Json>;
  if (value.type === 'ContinuityAccounting' || value.type === 'SessionGrounding'
    || value.name === 'ContinuityAccounting' || value.name === 'SessionGrounding'
    || typeof value.kind === 'string' && value.kind.startsWith('continuity-')
    || Object.keys(value).some(key => unsupportedSliceKeys.has(key))) return true;
  const disposition = value.disposition;
  if (disposition && typeof disposition === 'object' && !Array.isArray(disposition)
    && ['addressed', 'superseded', 'pending'].includes(String((disposition as Record<string, Json>).kind))) return true;
  return Object.values(value).some(carriesUnsupportedSliceAPrime);
}

function decodeClosure<T>(name: keyof typeof runClosureKinds, input: unknown,
  context: RunDecodeContext): Result<T> {
  return boundary(`Decode${name}`, input, context, safe => {
    const safeJson = json(safe);
    need(!carriesUnsupportedSliceAPrime(safeJson), 'unsupported-in-slice-a-prime');
    const alreadyWire = name === 'UnreachableRunExit'
      && typeof object(safeJson).frontier === 'string';
    const wire = alreadyWire ? safeJson : closureRecordWire(safe as unknown as RunClosureRecord);
    checkShape(wire, runClosureShapes[name]!);
    const restored = recordFromWire(wire);
    const validated = name === 'ExhaustionRecord' ? validateExhaustion(restored, context)
      : validateUnreachable(restored, context);
    return hydrate(json(validated), context) as T;
  });
}

export const decodeExhaustionRecord = (input: unknown, context: RunDecodeContext): Result<ExhaustionRecord> =>
  decodeClosure('ExhaustionRecord', input, context);
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
