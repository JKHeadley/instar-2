import { consumeResult, defineDecoder } from '../index.js';
import type { CausalFrontier, FactSnapshot, FactStorePort } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { currentAssemblyRows } from './history.js';
import { assemblyIdentity, assemblyReferences, assemblyRowForReference,
  factReferenceAliases, referenceHasExpectedKind } from './records.js';
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

export function decodePackageActivityResult(input: unknown, context: AssemblyDecodeContext) {
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
        return { ok: true, value: freeze({ ...content, id: raw.id, identity: freeze({ bytes: identity.bytes, hash: identity.hash }) }) as unknown as PackageActivityResult };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : 'package activity result decode failed' };
      }
    },
  }, context.preserved);
  return consumeResult(definition, { Success: decoder => decoder.decode(input, context), Refused: refusal => refusal });
}

function frontierOf(snapshot: FactSnapshot): CausalFrontier {
  const frontier: Record<string, { epoch: number; position: number }> = {};
  const include = (machine: string, position: { readonly epoch: number; readonly position: number }) => {
    const prior = frontier[machine];
    if (!prior || position.epoch > prior.epoch || position.epoch === prior.epoch && position.position > prior.position)
      frontier[machine] = { epoch: position.epoch, position: position.position };
  };
  for (const entry of snapshot.entries) {
    include(entry.fact.machine, entry.fact.segment);
    for (const [machine, position] of Object.entries(entry.fact.predecessors.frontier)) include(machine, position);
  }
  return freeze(frontier);
}

function snapshotFingerprint(snapshot: FactSnapshot): string {
  return encoded(snapshot.entries.map(entry => ({ id: entry.fact.id, hash: entry.fact.contentHash,
    taint: entry.taint, conflicts: entry.conflicts }))).hash;
}

function historyIssue(record: AssemblyRecord, rows: readonly CurrentAssemblyFact[], snapshot: FactSnapshot): 'conflicted' | 'tainted' | 'incomplete' | undefined {
  const seed = rows.find(row => row.record.type === record.type && assemblyIdentity(row.record).canonicalHash === assemblyIdentity(record).canonicalHash);
  if (!seed) return 'incomplete';
  const byId = new Map(snapshot.entries.map(entry => [entry.fact.id, entry]));
  const queue = [seed.fact.id]; const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!; if (visited.has(id)) continue; visited.add(id);
    const status = byId.get(id); if (!status) return 'incomplete';
    if (status.conflicts.length) return 'conflicted';
    if (status.taint.length) return 'tainted';
    const owned = rows.find(row => row.fact.id === id);
    if (owned) {
      if (owned.conflicts.length) return 'conflicted';
      if (owned.taint.length) return 'tainted';
      for (const reference of assemblyReferences(owned.record)) {
        const resolved = assemblyRowForReference(reference.id, rows);
        const referenced = resolved ? byId.get(resolved.fact.id) : byId.get(reference.id)
          ?? snapshot.entries.find(entry => factReferenceAliases(entry.fact).includes(reference.id));
        if (referenced) {
          if (!referenceHasExpectedKind(reference, referenced.fact, resolved?.record)) return 'conflicted';
          queue.push(referenced.fact.id);
        } else if (reference.requiredWhenSigned || /^[^:]+:\d+:\d+$/.test(reference.id)) return 'incomplete';
      }
    }
    for (const dependency of status.fact.predecessors.required) queue.push(dependency);
  }
  return undefined;
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

function deriveOutcome(namespace: string, snapshot: FactSnapshot, context: AssemblyDecodeContext): Readonly<{
  outcome: PackageActivityOutcome; evidence: PackageActivityResult['evidence'];
}> {
  const rows = currentAssemblyRows(snapshot, { ...context, validateReferences: false });
  const packages = rows.filter((row): row is CurrentAssemblyFact & { record: LocalCapabilityPackage } =>
    row.record.type === 'LocalCapabilityPackage' && row.record.namespace === namespace);
  const transitions = rows.filter((row): row is CurrentAssemblyFact & { record: PackageTransition } =>
    row.record.type === 'PackageTransition' && row.record.package === namespace);
  const packageFacts = packages.map(row => row.fact.id).sort();
  const transitionFacts = transitions.map(row => row.fact.id).sort();
  const superseded = new Set(transitions.flatMap(row => [...row.record.predecessors, ...row.record.dependencyFacts]));
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
    const issue = historyIssue(row.record, rows, snapshot);
    if (issue) return unresolved(issue);
  }
  const head = heads[0]!;
  if (head.record.to === 'active') {
    const matching = packages.filter(row => row.record.contentDigest === head.record.observedArtifactDigest);
    if (matching.length !== 1) return unresolved('package-mismatch');
    return freeze({ outcome: freeze({ status: 'active', package: matching[0]!.fact.id, transition: head.fact.id }), evidence });
  }
  if (head.record.to === 'inhibited' || head.record.to === 'retired')
    return freeze({ outcome: freeze({ status: 'inactive', transition: head.fact.id, disposition: head.record.to }), evidence });
  return unresolved('nonterminal-head');
}

function issue(namespace: string, frontier: CausalFrontier, confirmedFrontier: CausalFrontier, startedAt: number,
  completedAt: number, outcome: PackageActivityOutcome, evidence: PackageActivityResult['evidence'], context: AssemblyDecodeContext) {
  const content = { type: 'PackageActivityResult' as const, schemaVersion: 1 as const, owner: 'part-ten' as const,
    namespace, frontier, confirmedFrontier, startedAt, completedAt, outcome, evidence };
  const identity = encoded(content);
  return take(decodePackageActivityResult({ ...content, id: `package-activity:${identity.hash}`, identity }, context));
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
    const first = take(store.readForProjection()); const frontier = frontierOf(first); const fingerprint = snapshotFingerprint(first);
    const derived = deriveOutcome(namespace, first, context);
    const second = take(store.readForProjection()); const confirmedFrontier = frontierOf(second);
    const completedAt = clock(); nonnegativeInteger(completedAt, 'package activity completion clock must be a nonnegative integer');
    ensure(completedAt >= startedAt, 'package activity clock interval is inverted');
    if (fingerprint !== snapshotFingerprint(second) || encoded(frontier).bytes !== encoded(confirmedFrontier).bytes)
      return issue(namespace, frontier, confirmedFrontier, startedAt, completedAt,
        freeze({ status: 'unresolved', reason: 'frontier-moved' }), derived.evidence, context);
    return issue(namespace, frontier, confirmedFrontier, startedAt, completedAt, derived.outcome, derived.evidence, context);
  });
}
