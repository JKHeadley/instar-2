import { consumeResult, defineDecoder } from '../index.js';
import type { DecodeContext } from '../index.js';
import type { CausalFrontier, FactEnvelope, FactSnapshot, FactStorePort } from '../facts/index.js';
import { decodeCheckRun } from '../register/index.js';
import type { RegisterContext } from '../register/index.js';
import { decodeProbeRecord } from '../verification/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { assemblyIdentity, assemblyReferences, referenceHasExpectedKind } from './records.js';
import type { AssemblyDecodeContext, AssemblyRecord, CurrentAssemblyFact, PackageActivityOutcome,
  PackageActivityResult, PackageActivityUnresolvedReason, LocalCapabilityPackage, PackageTransition } from './contracts.js';

type JsonObject = Readonly<Record<string, unknown>>;

const unresolvedReasons: readonly PackageActivityUnresolvedReason[] = [
  'absent', 'conflicted', 'tainted', 'incomplete', 'multi-head', 'nonterminal-head', 'package-mismatch', 'frontier-moved',
];

function object(value: unknown, detail: string): JsonObject {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), detail);
  return value as JsonObject;
}

function exact(value: JsonObject, fields: readonly string[], detail: string): void {
  ensure(Object.keys(value).sort().join(',') === [...fields].sort().join(','), detail);
}

function substantive(value: unknown, detail: string): asserts value is string {
  ensure(typeof value === 'string' && value.length > 0 && value.length <= 65_536 && value.trim().length > 0, detail);
}

function nonnegativeInteger(value: unknown, detail: string): asserts value is number {
  ensure(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, detail);
}

function decodeFrontier(value: unknown): CausalFrontier {
  const raw = object(value, 'package activity frontier must be an object');
  const frontier: Record<string, { epoch: number; position: number }> = {};
  for (const [machine, input] of Object.entries(raw)) {
    substantive(machine, 'package activity frontier machine must be substantive');
    const position = object(input, 'package activity frontier position must be an object');
    exact(position, ['epoch', 'position'], 'package activity frontier position has unknown fields');
    nonnegativeInteger(position.epoch, 'package activity frontier epoch must be a nonnegative integer');
    nonnegativeInteger(position.position, 'package activity frontier offset must be a nonnegative integer');
    frontier[machine] = { epoch: position.epoch, position: position.position };
  }
  return freeze(frontier);
}

function decodeStrings(value: unknown, detail: string): readonly string[] {
  ensure(Array.isArray(value) && value.length <= 16_384, detail);
  const out = value.map(item => { substantive(item, detail); return item; });
  ensure(new Set(out).size === out.length, `${detail}; duplicates are forbidden`);
  return freeze(out);
}

function decodeOutcome(value: unknown): PackageActivityOutcome {
  const raw = object(value, 'package activity outcome must be an object');
  substantive(raw.status, 'package activity outcome status is required');
  if (raw.status === 'active') {
    exact(raw, ['status', 'package', 'transition'], 'active package activity outcome has unknown fields');
    substantive(raw.package, 'active package activity package reference is required');
    substantive(raw.transition, 'active package activity transition reference is required');
    return freeze({ status: 'active', package: raw.package, transition: raw.transition });
  }
  if (raw.status === 'inactive') {
    exact(raw, ['status', 'transition', 'disposition'], 'inactive package activity outcome has unknown fields');
    substantive(raw.transition, 'inactive package activity transition reference is required');
    ensure(raw.disposition === 'inhibited' || raw.disposition === 'retired', 'inactive package activity disposition is unknown');
    return freeze({ status: 'inactive', transition: raw.transition, disposition: raw.disposition });
  }
  ensure(raw.status === 'unresolved', 'package activity outcome status is unknown');
  exact(raw, ['status', 'reason'], 'unresolved package activity outcome has unknown fields');
  ensure(typeof raw.reason === 'string' && unresolvedReasons.includes(raw.reason as PackageActivityUnresolvedReason),
    'unresolved package activity reason is unknown');
  return freeze({ status: 'unresolved', reason: raw.reason as PackageActivityUnresolvedReason });
}

function identityContent(value: Omit<PackageActivityResult, 'id' | 'identity'>): JsonObject {
  return {
    type: value.type, schemaVersion: value.schemaVersion, owner: value.owner, namespace: value.namespace,
    frontier: value.frontier, confirmedFrontier: value.confirmedFrontier, startedAt: value.startedAt,
    completedAt: value.completedAt, outcome: value.outcome, evidence: value.evidence,
  };
}

function decodePackageActivityResultInternal(input: unknown, context: AssemblyDecodeContext, validateSemantics: boolean) {
  const definition = defineDecoder<PackageActivityResult, AssemblyDecodeContext>({
    name: 'PackageActivityResult', owner: 'part-ten', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: value => {
      try {
        const raw = object(value, 'package activity result must be an object');
        exact(raw, ['type', 'schemaVersion', 'owner', 'id', 'namespace', 'frontier', 'confirmedFrontier', 'startedAt',
          'completedAt', 'outcome', 'evidence', 'identity'], 'package activity result has unknown or missing fields');
        ensure(raw.type === 'PackageActivityResult' && raw.schemaVersion === 1 && raw.owner === 'part-ten',
          'package activity result owner/type/version mismatch');
        substantive(raw.id, 'package activity result id is required');
        substantive(raw.namespace, 'package activity namespace is required');
        nonnegativeInteger(raw.startedAt, 'package activity start clock must be a nonnegative integer');
        nonnegativeInteger(raw.completedAt, 'package activity completion clock must be a nonnegative integer');
        ensure(raw.completedAt >= raw.startedAt, 'package activity clock interval is inverted');
        const frontier = decodeFrontier(raw.frontier), confirmedFrontier = decodeFrontier(raw.confirmedFrontier);
        const outcome = decodeOutcome(raw.outcome);
        const evidenceRaw = object(raw.evidence, 'package activity evidence must be an object');
        exact(evidenceRaw, ['packages', 'transitions', 'heads'], 'package activity evidence has unknown fields');
        const evidence = freeze({ packages: decodeStrings(evidenceRaw.packages, 'package activity package evidence must be a bounded string list'),
          transitions: decodeStrings(evidenceRaw.transitions, 'package activity transition evidence must be a bounded string list'),
          heads: decodeStrings(evidenceRaw.heads, 'package activity head evidence must be a bounded string list') });
        const identity = object(raw.identity, 'package activity identity must be an object');
        exact(identity, ['bytes', 'hash'], 'package activity identity has unknown fields');
        substantive(identity.bytes, 'package activity canonical bytes are required');
        substantive(identity.hash, 'package activity canonical hash is required');
        ensure(/^sha256:[a-f0-9]{64}$/.test(identity.hash), 'package activity canonical hash is malformed');
        const content = identityContent({ type: 'PackageActivityResult', schemaVersion: 1, owner: 'part-ten',
          namespace: raw.namespace, frontier, confirmedFrontier, startedAt: raw.startedAt, completedAt: raw.completedAt,
          outcome, evidence } as Omit<PackageActivityResult, 'id' | 'identity'>);
        const canonical = encoded(content);
        ensure(identity.bytes === canonical.bytes && identity.hash === canonical.hash,
          'package activity identity differs from canonical bytes');
        ensure(raw.id === `package-activity:${canonical.hash}`, 'package activity id differs from canonical identity');
        if (validateSemantics) validateResultSemantics(content as Omit<PackageActivityResult, 'id' | 'identity'>, context);
        return { ok: true, value: freeze({ ...content, id: raw.id, identity: freeze({ bytes: identity.bytes, hash: identity.hash }) }) as unknown as PackageActivityResult };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : 'package activity result decode failed' };
      }
    },
  }, context.preserved);
  return consumeResult(definition, { Success: decoder => decoder.decode(input, context), Refused: refusal => refusal });
}

export function decodePackageActivityResult(input: unknown, context: AssemblyDecodeContext) {
  return decodePackageActivityResultInternal(input, context, true);
}

function frontierOf(snapshot: FactSnapshot): CausalFrontier {
  return frontierOfFacts(snapshot.entries.map(entry => entry.fact));
}

function frontierOfFacts(facts: readonly FactEnvelope[]): CausalFrontier {
  const frontier: Record<string, { epoch: number; position: number }> = {};
  const include = (machine: string, position: { readonly epoch: number; readonly position: number }) => {
    const prior = frontier[machine];
    if (!prior || position.epoch > prior.epoch || position.epoch === prior.epoch && position.position > prior.position)
      frontier[machine] = { epoch: position.epoch, position: position.position };
  };
  for (const fact of facts) {
    include(fact.machine, fact.segment);
    for (const [machine, position] of Object.entries(fact.predecessors.frontier)) include(machine, position);
  }
  return freeze(frontier);
}

function factFingerprint(facts: readonly FactEnvelope[]): string {
  return encoded(facts.map(fact => ({ id: fact.id, hash: fact.contentHash }))).hash;
}

function rowFingerprint(rows: readonly CurrentAssemblyFact[]): string {
  return encoded(rows.map(row => ({ id: row.fact.id, hash: row.fact.contentHash, taint: row.taint, conflicts: row.conflicts }))).hash;
}

function snapshotFactFingerprint(snapshot: FactSnapshot): string {
  return factFingerprint(snapshot.entries.map(entry => entry.fact));
}

function referenceOwnerMismatch(record: AssemblyRecord, reference: ReturnType<typeof assemblyReferences>[number],
  fact: FactEnvelope, resolved?: AssemblyRecord): boolean {
  if (record.type === 'PackageTransition' && reference.field === 'testEvidence' && fact.kind !== 'check-run-record') return true;
  if (record.type === 'PackageTransition' && reference.field === 'probeEvidence' && fact.kind !== 'verification-ProbeRecord') return true;
  return !reference.expected && !!resolved && reference.field !== 'predecessors' && reference.field !== 'dependencyFacts';
}

function registerContext(context: AssemblyDecodeContext): RegisterContext {
  const register = context.register as DecodeContext['register'];
  return {
    ...context,
    register,
    types: { register, preserved: context.preserved, captures: {} },
    shape: { factSchemas: [] } as unknown as RegisterContext['shape'],
    provenance: {} as RegisterContext['provenance'],
    source: { path: 'owner-history://check-run-record', symbol: 'decodeCheckRun' },
  };
}

function evidenceBody(fact: FactEnvelope): unknown {
  const body = fact.body as Readonly<Record<string, unknown>>;
  return body.record ?? body;
}

function ownerEvidenceIssue(record: AssemblyRecord, context: AssemblyDecodeContext): 'conflicted' | 'tainted' | 'incomplete' | undefined {
  ensure(context.history?.owner === 'part-ten', 'signed history resolver required');
  for (const reference of assemblyReferences(record)) {
    const status = take(context.history.lookup(reference.id));
    if (!status) {
      if (reference.requiredWhenSigned || /^[^:]+:\d+:\d+$/.test(reference.id)) return 'incomplete';
      continue;
    }
    if (status.completeness !== 'complete') return 'incomplete';
    if (status.conflicts.length > 0) return 'conflicted';
    if (status.taint.length > 0) return 'tainted';
    if (!referenceHasExpectedKind(reference, status.fact, status.record)
      || referenceOwnerMismatch(record, reference, status.fact, status.record)) return 'conflicted';
    try {
      if (record.type === 'PackageTransition' && reference.field === 'testEvidence')
        take(decodeCheckRun(evidenceBody(status.fact), registerContext(context)));
      if (record.type === 'PackageTransition' && reference.field === 'probeEvidence')
        take(decodeProbeRecord(evidenceBody(status.fact), context));
    } catch {
      return 'conflicted';
    }
  }
  return undefined;
}

function portHistoryIssues(context: AssemblyDecodeContext) {
  ensure(context.history, 'signed history resolver required');
  const cache = new Map<string, 'conflicted' | 'tainted' | 'incomplete' | null>();
  return (seed: CurrentAssemblyFact): 'conflicted' | 'tainted' | 'incomplete' | undefined => {
    const key = `${seed.record.type}:${assemblyIdentity(seed.record).canonicalHash}`;
    if (cache.has(key)) return cache.get(key) ?? undefined;
    const evidenceIssue = ownerEvidenceIssue(seed.record, context);
    if (evidenceIssue) { cache.set(key, evidenceIssue); return evidenceIssue; }
    const verdict = take(context.history!.resolve(seed.record));
    const issue = verdict.conflicts.length > 0 ? 'conflicted' as const
      : verdict.completeness !== 'complete' || verdict.missing.length > 0 || !verdict.admitted ? 'incomplete' as const : undefined;
    cache.set(key, issue ?? null);
    return issue;
  };
}

function lifecycleIssue(transitions: readonly (CurrentAssemblyFact & { record: PackageTransition })[]): 'conflicted' | 'incomplete' | undefined {
  for (const row of transitions) {
    const parents = transitions.filter(candidate => row.record.predecessors.includes(candidate.fact.id));
    if (row.record.from === 'none') {
      if (parents.length > 0) return 'conflicted';
      continue;
    }
    const matching = parents.filter(candidate => candidate.record.to === row.record.from
      && candidate.record.package === row.record.package && candidate.record.machine === row.record.machine
      && candidate.record.scope === row.record.scope);
    if (matching.length !== 1 || parents.length !== 1) return matching.length > 1 || parents.length > 1 ? 'conflicted' : 'incomplete';
  }
  return undefined;
}

function deriveFromRows(namespace: string, rows: readonly CurrentAssemblyFact[],
  issueFor: (row: CurrentAssemblyFact) => 'conflicted' | 'tainted' | 'incomplete' | undefined): Readonly<{
  outcome: PackageActivityOutcome; evidence: PackageActivityResult['evidence'];
}> {
  const byContent = new Map<string, CurrentAssemblyFact>();
  for (const row of [...rows].sort((left, right) => left.fact.segment.epoch - right.fact.segment.epoch
    || left.fact.segment.position - right.fact.segment.position || left.fact.machine.localeCompare(right.fact.machine))) {
    const key = `${row.record.type}:${assemblyIdentity(row.record).canonicalHash}`;
    if (!byContent.has(key)) byContent.set(key, row);
  }
  const uniqueRows = [...byContent.values()];
  const packages = uniqueRows.filter((row): row is CurrentAssemblyFact & { record: LocalCapabilityPackage } =>
    row.record.type === 'LocalCapabilityPackage' && row.record.namespace === namespace);
  const transitions = uniqueRows.filter((row): row is CurrentAssemblyFact & { record: PackageTransition } =>
    row.record.type === 'PackageTransition' && row.record.package === namespace);
  const packageFacts = packages.map(row => row.fact.id).sort();
  const transitionFacts = transitions.map(row => row.fact.id).sort();
  const superseded = new Set(transitions.flatMap(row => row.record.predecessors));
  const heads = transitions.filter(row => !superseded.has(row.fact.id));
  const evidence = freeze({ packages: packageFacts, transitions: transitionFacts, heads: heads.map(row => row.fact.id).sort() });
  const unresolved = (reason: PackageActivityUnresolvedReason): Readonly<{ outcome: PackageActivityOutcome; evidence: PackageActivityResult['evidence'] }> =>
    freeze({ outcome: freeze({ status: 'unresolved' as const, reason }), evidence });
  if (packages.length === 0) return unresolved('absent');
  if ([...packages, ...transitions].some(row => row.conflicts.length > 0)) return unresolved('conflicted');
  if ([...packages, ...transitions].some(row => row.taint.length > 0)) return unresolved('tainted');
  if (transitions.length === 0) return unresolved('incomplete');
  if (heads.length !== 1) return unresolved('multi-head');
  const lifecycle = lifecycleIssue(transitions);
  if (lifecycle) return unresolved(lifecycle);
  for (const row of [...packages, ...transitions]) {
    const issue = issueFor(row);
    if (issue) return unresolved(issue);
  }
  const head = heads[0]!;
  const matching = packages.filter(row => row.record.contentDigest === head.record.manifestDigest);
  const identities = new Map(matching.map(row => [assemblyIdentity(row.record).canonicalHash, row]));
  if (identities.size !== 1) return unresolved('package-mismatch');
  const packageRow = [...matching].sort((left, right) => left.fact.id < right.fact.id ? -1 : left.fact.id > right.fact.id ? 1 : 0)[0]!;
  if (head.record.to === 'active') {
    if (head.record.observedArtifactDigest !== head.record.manifestDigest) return unresolved('package-mismatch');
    return freeze({ outcome: freeze({ status: 'active', package: packageRow.fact.id, transition: head.fact.id }), evidence });
  }
  if (head.record.to === 'inhibited' || head.record.to === 'retired')
    return freeze({ outcome: freeze({ status: 'inactive', transition: head.fact.id, disposition: head.record.to }), evidence });
  return unresolved('nonterminal-head');
}

function deriveOwnerOutcome(namespace: string, context: AssemblyDecodeContext): Readonly<{
  outcome: PackageActivityOutcome; evidence: PackageActivityResult['evidence'];
}> {
  ensure(context.history?.owner === 'part-ten', 'package activity requires Part Ten signed history');
  return deriveFromRows(namespace, take(context.history.current()), portHistoryIssues(context));
}

function withinFrontier(reference: string, frontier: CausalFrontier): boolean {
  const match = /^(.*):(\d+):(\d+)$/.exec(reference);
  if (!match) return false;
  const position = frontier[match[1]!];
  const epoch = Number(match[2]), offset = Number(match[3]);
  return !!position && Number.isSafeInteger(epoch) && Number.isSafeInteger(offset)
    && (epoch < position.epoch || epoch === position.epoch && offset <= position.position);
}

function validateResultSemantics(value: Omit<PackageActivityResult, 'id' | 'identity'>, context: AssemblyDecodeContext): void {
  ensure(context.history?.owner === 'part-ten', 'package activity result requires Part Ten signed history');
  const sameFrontier = encoded(value.frontier).bytes === encoded(value.confirmedFrontier).bytes;
  const moved = value.outcome.status === 'unresolved' && value.outcome.reason === 'frontier-moved';
  ensure(moved ? !sameFrontier : sameFrontier,
    moved ? 'frontier-moved result requires distinct witnessed frontiers' : 'settled package activity result has mismatched frontiers');
  const allEvidence = [...value.evidence.packages, ...value.evidence.transitions, ...value.evidence.heads];
  ensure(allEvidence.every(reference => withinFrontier(reference, value.frontier)),
    'package activity evidence lies outside the pinned frontier');
  ensure(value.evidence.heads.every(reference => value.evidence.transitions.includes(reference)),
    'package activity head is not transition evidence');
  const firstRows = take(context.history.current());
  const currentFrontier = frontierOfFacts(firstRows.map(row => row.fact));
  const expected = deriveFromRows(value.namespace, firstRows, portHistoryIssues(context));
  const secondRows = take(context.history.current());
  ensure(factFingerprint(firstRows.map(row => row.fact)) === factFingerprint(secondRows.map(row => row.fact)),
    'package activity owner history moved during result admission');
  ensure(encoded(currentFrontier).bytes === encoded(frontierOfFacts(secondRows.map(row => row.fact))).bytes,
    'package activity owner frontier moved during result admission');
  ensure(encoded(moved ? value.confirmedFrontier : value.frontier).bytes === encoded(currentFrontier).bytes,
    'package activity frontier differs from current owner history');
  if (moved) ensure(firstRows.some(row => row.record.type === 'LocalCapabilityPackage' && row.record.namespace === value.namespace),
    'frontier movement has no witnessed package namespace owner');
  ensure(encoded(expected.evidence).bytes === encoded(value.evidence).bytes,
    'package activity evidence differs from current owner history');
  if (!moved) ensure(encoded(expected.outcome).bytes === encoded(value.outcome).bytes,
    'package activity outcome differs from current owner evidence');
}

function issue(namespace: string, frontier: CausalFrontier, confirmedFrontier: CausalFrontier, startedAt: number,
  completedAt: number, outcome: PackageActivityOutcome, evidence: PackageActivityResult['evidence'], context: AssemblyDecodeContext) {
  const content = { type: 'PackageActivityResult' as const, schemaVersion: 1 as const, owner: 'part-ten' as const,
    namespace, frontier, confirmedFrontier, startedAt, completedAt, outcome, evidence };
  const identity = encoded(content);
  return take(decodePackageActivityResultInternal({ ...content, id: `package-activity:${identity.hash}`, identity }, context, false));
}

/**
 * Part Ten's read-only package-activity operation. It accepts the Part Two store,
 * never caller-cached rows or an activity label, and confirms the complete signed
 * frontier again immediately before issuing the result.
 */
export function resolvePackageActivity(namespace: string, store: FactStorePort, clock: () => number, context: AssemblyDecodeContext) {
  return boundary('PackageActivityResolution', namespace, context, () => {
    substantive(namespace, 'package activity namespace is required');
    ensure(store && typeof store.readForProjection === 'function', 'Part Two fact store is required');
    ensure(typeof clock === 'function', 'package activity clock is required');
    const startedAt = clock(); nonnegativeInteger(startedAt, 'package activity start clock must be a nonnegative integer');
    ensure(context.history?.owner === 'part-ten', 'package activity requires Part Ten signed history');
    const first = take(store.readForProjection()); const frontier = frontierOf(first);
    const rawFirst = take(store.read()); const prefixFirst = take(store.verifiedPrefix());
    const ownerRowsFirst = take(context.history.current());
    const second = take(store.readForProjection());
    const completedAt = clock(); nonnegativeInteger(completedAt, 'package activity completion clock must be a nonnegative integer');
    ensure(completedAt >= startedAt, 'package activity clock interval is inverted');
    const raw = take(store.read()); const prefix = take(store.verifiedPrefix());
    const confirmedFrontier = frontierOfFacts(prefix.facts);
    const confirmed = deriveOwnerOutcome(namespace, context);
    const ownerRowsFinal = take(context.history.current());
    const stable = snapshotFactFingerprint(first) === snapshotFactFingerprint(second)
      && encoded(frontier).bytes === encoded(frontierOf(second)).bytes
      && factFingerprint(rawFirst) === factFingerprint(prefixFirst.facts)
      && factFingerprint(rawFirst) === factFingerprint(raw)
      && snapshotFactFingerprint(second) === factFingerprint(raw)
      && factFingerprint(raw) === factFingerprint(prefix.facts)
      && rowFingerprint(ownerRowsFirst) === rowFingerprint(ownerRowsFinal);
    if (!stable) {
      const frontierMoved = encoded(frontier).bytes !== encoded(confirmedFrontier).bytes;
      const outcome = frontierMoved ? freeze({ status: 'unresolved' as const, reason: 'frontier-moved' as const })
        : confirmed.outcome.status === 'unresolved' ? confirmed.outcome
          : freeze({ status: 'unresolved' as const, reason: 'incomplete' as const });
      return issue(namespace, frontier, confirmedFrontier, startedAt, completedAt, outcome, confirmed.evidence, context);
    }
    return issue(namespace, frontier, confirmedFrontier, startedAt, completedAt, confirmed.outcome, confirmed.evidence, context);
  });
}
