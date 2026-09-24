import { productionGraphMatches } from './grounding-capability.js';
import { consumeResult } from '../index.js';
import type { FactEnvelopeReference, Json, Result } from '../index.js';
import { requiredMinimalDependencies } from '../operator/index.js';
import { fenceFor } from '../transport/index.js';
import { decodeHistoricalInstalledRunGovernanceReference, isProductionGroundedRunGraph } from '../rungraph/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { factReferenceAliases } from './records.js';
import { currentAssemblyRows } from './history.js';
import { createAssemblyRuntime } from './service.js';
import { causalStanding, decodeHistoricalBody, prepareSnapshot } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSnapshot, FactStatus } from '../facts/index.js';
import { decodeHistoricalInstallationSelection, installationRoleOwners } from './installation-selection.js';
import type { InstallationRecordAdmission, InstallationRole, InstallationSelectionSet } from './installation-selection.js';
import { decodeHistoricalProductionSignerReference } from './production-signer-reference.js';
import type { ProductionSignerAdmission } from './production-signer-reference.js';
import { decodeProductionInstallation } from './production-installation.js';
import { openedProductionInstallationReport } from './production-installation-report.js';
import type { AssemblyComposition, AssemblyImplementationBinding, AssemblyManifest, AssemblyProductionBindingSet,
  AssemblyLiveDependencyHandle, AssemblyProductionCoordinator, AssemblyResolvedProductionBinding, AssemblyRuntimePort,
  OpenedProductionInstallationInspection } from './contracts.js';

interface NamedBinding {
  readonly name: string;
  readonly requiredKind: string;
  readonly row: AssemblyImplementationBinding | Readonly<{ implementation: string; fact: AssemblyImplementationBinding['fact'] }>;
}

function namedBindings(binding: AssemblyProductionBindingSet): readonly NamedBinding[] {
  const dependencyKinds: Readonly<Record<(typeof requiredMinimalDependencies)[number], string>> = {
    'local-facts': 'fact-local-durable-segment', register: 'generation-record',
    'identity-keys': 'assembly-ProductionSignerReference',
    clock: 'clock-source', lease: 'transport-Lease', fence: 'transport-Lease',
    'replication-peer': 'fact-replication-receipt', 'conversation-binding': 'conversation-binding',
    route: 'conversation-route', 'delivery-evidence': 'delivery-evidence-service',
  };
  return [
    { name: 'surface-adapter', requiredKind: 'operator-surface-registration', row: binding.surface.adapter },
    { name: 'challenge-verifier', requiredKind: 'operator-challenge-verifier-binding', row: binding.surface.challengeVerifier },
    { name: 'verified-act-intake', requiredKind: 'intake-verified-act-binding', row: binding.verifiedActIntake },
    ...binding.minimalPlane.folds.map(row => ({ name: `projection-fold:${row.projection}`, requiredKind: 'minimal-plane-projection-binding', row })),
    { name: 'source-only-replay', requiredKind: 'minimal-plane-replay-binding', row: binding.minimalPlane.sourceOnlyReplay },
    { name: 'minimal-responder', requiredKind: 'minimal-responder-binding', row: binding.minimalResponder },
    ...binding.dependencies.map(row => ({ name: `dependency:${row.name}`, requiredKind: dependencyKinds[row.name],
      row: { implementation: row.name, fact: row.fact } })),
    { name: 'prerequisite-cut', requiredKind: 'assembly-lifecycle-control-binding', row: binding.lifecycle.cut },
    { name: 'prerequisite-recovery', requiredKind: 'assembly-lifecycle-control-binding', row: binding.lifecycle.recovery },
    { name: 'platform-delivery-witness', requiredKind: 'platform-delivery-witness-binding', row: binding.deliveryWitness },
  ];
}

function statusFor(snapshot: FactSnapshot, reference: string): FactStatus | null {
  const exact = snapshot.entries.filter(row => row.fact.id === reference);
  if (exact.length) {
    ensure(exact.length === 1, `required binding reference is ambiguous in signed history: ${reference}`);
    return exact[0]!;
  }
  const aliases = snapshot.entries.filter(row => factReferenceAliases(row.fact).includes(reference));
  ensure(aliases.length <= 1, `required binding reference is ambiguous in signed history: ${reference}`);
  return aliases[0] ?? null;
}

function resolveOne(name: string, requiredKind: string, declaredKind: string, reference: string, snapshot: FactSnapshot,
    partialAssemblyFacts: ReadonlySet<string>, unavailableAssemblyFacts: ReadonlySet<string>,
    facts: FactContext, implementation: string, scope: string): AssemblyResolvedProductionBinding {
  const root = statusFor(snapshot, reference);
  ensure(root, `required production binding is missing from signed history: ${name}:${reference}`);
  const selection = inspectionSelection(name, requiredKind);
  if (selection && root.fact.kind === 'assembly-GrowthObservation' && partialAssemblyFacts.has(root.fact.id))
    return freeze({ name, reference, expectedKind: requiredKind, fact: root.fact,
      completeness: 'partial' as const, missing: [], address: null });
  if (selection) {
    ensure(root.fact.id === reference && declaredKind === 'assembly-InstallationSelectionSet'
      && root.fact.kind === 'assembly-InstallationSelectionSet',
    `required production binding has wrong signed kind: ${name}:${requiredKind}:${root.fact.kind}:expected:assembly-InstallationSelectionSet`);
    ensure(!root.taint.length && !root.conflicts.length,
      `required production binding is unavailable or conflicted: ${name}:${reference}`);
    const decoded = take(decodeHistoricalBody(root.fact, facts, causalStanding(root.fact, facts, false).decode));
    const set = decoded.fields.record as unknown as InstallationSelectionSet;
    const rows = set.rows.filter(row => row.role === selection.role && row.instance === selection.instance);
    ensure(rows.length === 1 && rows[0]!.owner === selection.owner
      && rows[0]!.implementation === implementation && rows[0]!.scope === scope
      && set.scope === scope,
    `required production set row differs: ${name}:${selection.role}:${selection.instance}`);
    const row = rows[0]!;
    ensure(row.generation === facts.decode.register.generation.id,
      `required production set row generation differs: ${name}`);
    return freeze({ name, reference, expectedKind: 'assembly-InstallationSelectionSet', fact: root.fact,
      completeness: 'complete' as const, missing: [], address: { type: 'InstallationSelectionRowReference' as const,
        schemaVersion: 1 as const, set: envelopeReference(root.fact), rowDigest: row.id,
        role: row.role, instance: row.instance } });
  }
  const honestPartialPlaceholder = root.fact.kind === 'assembly-GrowthObservation' && partialAssemblyFacts.has(root.fact.id);
  ensure(honestPartialPlaceholder || (declaredKind === requiredKind && root.fact.kind === requiredKind),
    `required production binding has wrong signed kind: ${name}:${root.fact.kind}:expected:${requiredKind}`);
  ensure(root.taint.length === 0 && root.conflicts.length === 0,
    `required production binding is unavailable or conflicted: ${name}:${reference}`);
  ensure(!unavailableAssemblyFacts.has(root.fact.id),
    `required production binding is unavailable or conflicted: ${name}:${reference}`);
  if (['generation-record', 'assembly-ProductionSignerReference', 'transport-Lease'].includes(requiredKind)) {
    const decoded = take(decodeHistoricalBody(root.fact, facts, causalStanding(root.fact, facts, false).decode));
    const ownerRecord = decoded.fields.record as Readonly<Record<string, unknown>> | undefined;
    ensure(ownerRecord && typeof ownerRecord === 'object',
      `required direct owner body is unavailable: ${name}:${reference}`);
    if (requiredKind === 'generation-record') ensure((ownerRecord.generation as { id?: string } | undefined)?.id
      === facts.decode.register.generation.id, `required register generation differs: ${name}`);
    if (requiredKind === 'assembly-ProductionSignerReference') ensure(ownerRecord.generation
      === facts.decode.register.generation.id && ownerRecord.machine === root.fact.machine,
    `required signer owner differs: ${name}`);
  }
  const missing = new Set<string>();
  let completeness: 'complete' | 'partial' = partialAssemblyFacts.has(root.fact.id) ? 'partial' : 'complete';
  const visited = new Set<string>();
  const queue = [...root.fact.predecessors.required];
  while (queue.length) {
    const dependency = queue.shift()!;
    if (visited.has(dependency)) continue;
    visited.add(dependency);
    const status = statusFor(snapshot, dependency);
    if (!status) { missing.add(dependency); completeness = 'partial'; continue; }
    ensure(status.taint.length === 0 && status.conflicts.length === 0,
      `required production binding is unavailable or conflicted: ${name}:${dependency}`);
    ensure(!unavailableAssemblyFacts.has(status.fact.id),
      `required production binding is unavailable or conflicted: ${name}:${dependency}`);
    if (partialAssemblyFacts.has(status.fact.id)) completeness = 'partial';
    queue.push(...status.fact.predecessors.required);
  }
  return freeze({ name, reference, expectedKind: requiredKind, fact: root.fact, completeness,
    missing: [...missing].sort(), address: null });
}

function selected(runtime: AssemblyRuntimePort, manifestId: string, scope: string): Readonly<{
  manifest: AssemblyManifest;
  binding: AssemblyProductionBindingSet;
}> {
  const manifests = take(runtime.inspectCurrent()).filter((row): row is typeof row & { record: AssemblyManifest } =>
    row.record.type === 'AssemblyManifest' && row.record.id === manifestId);
  ensure(manifests.length === 1, 'production manifest missing or ambiguous in signed history');
  const manifest = manifests[0]!.record;
  const bindings = (manifest.productionBindings ?? []).filter(row => row.scope === scope);
  ensure(bindings.length === 1, 'manifest has no exact production binding set for scope');
  return { manifest, binding: bindings[0]! };
}

function resolveReferences(composition: AssemblyComposition, runtime: AssemblyRuntimePort, manifestId: string, scope: string): Readonly<{
  manifest: AssemblyManifest;
  binding: AssemblyProductionBindingSet;
  references: readonly AssemblyResolvedProductionBinding[];
}> {
  const { manifest, binding } = selected(runtime, manifestId, scope);
  const snapshot = take(composition.spine.store.readForProjection());
  const facts: FactContext = { ...composition.host.current().facts,
    facts: snapshot.entries.map(entry => entry.fact) };
  const assembly = currentAssemblyRows(snapshot, composition.host.boundary);
  const partialAssemblyFacts = new Set(assembly.filter(row => row.record.type === 'GrowthObservation'
    && row.record.completion === 'incomplete').map(row => row.fact.id));
  const unavailableAssemblyFacts = new Set(assembly.filter(row => row.taint.length > 0 || row.conflicts.length > 0).map(row => row.fact.id));
  const peer = binding.dependencies.find(row => row.name === 'replication-peer');
  let localPeerMarker = false;
  if (peer && peer.fact.expectedKind === 'assembly-InstallationSelectionSet') {
    const status = statusFor(snapshot, peer.fact.reference);
    if (status?.fact.kind === 'assembly-InstallationSelectionSet' && !status.taint.length && !status.conflicts.length) {
      const decoded = take(decodeHistoricalBody(status.fact, facts, causalStanding(status.fact, facts, false).decode));
      const set = decoded.fields.record as unknown as InstallationSelectionSet;
      localPeerMarker = set.scope === binding.scope && set.rows.length === 19 && !set.rows.some(row =>
        row.role === 'fact-segment' && row.instance === 'fact-replication-receipt');
    }
  }
  const references = namedBindings(binding).filter(row => !localPeerMarker || row.name !== 'dependency:replication-peer')
    .map(({ name, requiredKind, row }) =>
    resolveOne(name, requiredKind, row.fact.expectedKind, row.fact.reference, snapshot,
      partialAssemblyFacts, unavailableAssemblyFacts, facts, row.implementation, scope));
  const selectedSetFacts = new Set(references.filter(row => row.address).map(row => row.fact.id));
  ensure(selectedSetFacts.size === 1, 'production bindings select multiple installation selection sets');
  return freeze({ manifest, binding, references });
}

/**
 * Re-resolve every production binding from the current verified Part Two view.
 * Partial causal references are returned as partial; this read never promotes
 * them into boot eligibility or turns a missing predecessor into availability.
 */
export function inspectProductionAssemblyBindings(composition: AssemblyComposition, manifestId: string,
  scope: string): Result<readonly AssemblyResolvedProductionBinding[]> {
  return boundary('AssemblyProductionBindingInspection', { manifestId, scope }, composition.host.boundary, () => {
    const runtime = createAssemblyRuntime(composition);
    return resolveReferences(composition, runtime, manifestId, scope).references;
  });
}

type SelectionExpectation = Readonly<{ role: InstallationRole; instance: string; owner: string }>;
type OpenedProductionInstallationBindingVerdict = OpenedProductionInstallationInspection['bindings'][number];
type OpenedProductionInstallationOwnerInput = NonNullable<OpenedProductionInstallationBindingVerdict['input']>;
type OpenedProductionInstallationHistoricalInput =
  | Readonly<{ kind: 'singleton-history'; fact: FactEnvelopeReference; admission: InstallationRecordAdmission }>
  | Readonly<{ kind: 'signer-history'; fact: FactEnvelopeReference; admission: ProductionSignerAdmission }>
  | Readonly<{ kind: 'governance-history'; fact: FactEnvelopeReference; admission: InstallationRecordAdmission }>;

/** Inspection-only map from the landed manifest slots to the future closed set rows.
 * It does not participate in strict resolution and cannot make a singleton executable. */
function inspectionSelection(name: string, requiredKind: string): SelectionExpectation | null {
  const fixed: Readonly<Record<string, Readonly<{ role: InstallationRole; instance: string }>>> = {
    'operator-surface-registration': { role: 'operator-surface', instance: 'operator-surface-registration' },
    'operator-challenge-verifier-binding': { role: 'challenge-verifier', instance: 'operator-challenge-verifier-binding' },
    'intake-verified-act-binding': { role: 'verified-act-intake', instance: 'intake-verified-act-binding' },
    'minimal-plane-replay-binding': { role: 'minimal-plane-replay', instance: 'minimal-plane-replay-binding' },
    'minimal-responder-binding': { role: 'minimal-responder', instance: 'minimal-responder-binding' },
    'platform-delivery-witness-binding': { role: 'delivery-witness', instance: 'platform-delivery-witness-binding' },
    'fact-local-durable-segment': { role: 'fact-segment', instance: 'fact-local-durable-segment' },
    'fact-replication-receipt': { role: 'fact-segment', instance: 'fact-replication-receipt' },
    'clock-source': { role: 'verification-clock', instance: 'clock-source' },
    'conversation-route': { role: 'conversation-route', instance: 'conversation-route' },
    'delivery-evidence-service': { role: 'delivery-evidence-service', instance: 'delivery-evidence-service' },
  };
  let expected = fixed[requiredKind];
  if (requiredKind === 'minimal-plane-projection-binding' && name.startsWith('projection-fold:'))
    expected = { role: 'minimal-plane-fold', instance: name.slice('projection-fold:'.length) };
  if (requiredKind === 'assembly-lifecycle-control-binding') expected = name === 'prerequisite-cut'
    ? { role: 'prerequisite-cut', instance: 'prerequisite-cut' }
    : name === 'prerequisite-recovery' ? { role: 'prerequisite-recovery', instance: 'prerequisite-recovery' } : undefined;
  return expected ? { ...expected, owner: installationRoleOwners[expected.role] } : null;
}

const directInspectionKinds: Readonly<Record<string, Readonly<{ kind: string; owner: string }>>> = Object.freeze({
  'register-generation-record': { kind: 'generation-record', owner: 'part-three' },
  'identity-key-set': { kind: 'assembly-ProductionSignerReference', owner: 'part-two' },
  'transport-Lease': { kind: 'transport-Lease', owner: 'part-six' },
  'transport-FenceToken': { kind: 'transport-FenceToken', owner: 'part-six' },
  'conversation-binding': { kind: 'conversation-binding', owner: 'part-four' },
});

function envelopeReference(fact: FactEnvelope): FactEnvelopeReference {
  return freeze({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id: fact.id });
}

function inspectionStatus(snapshot: FactSnapshot, reference: string): Readonly<{ status: FactStatus | null; reason: string | null }> {
  const exact = snapshot.entries.filter(row => row.fact.id === reference);
  if (exact.length > 1) return { status: null, reason: `ambiguous exact source reference: ${reference}` };
  if (exact.length === 1) return { status: exact[0]!, reason: null };
  const aliases = snapshot.entries.filter(row => factReferenceAliases(row.fact).includes(reference));
  if (aliases.length > 1) return { status: null, reason: `ambiguous source-reference alias: ${reference}` };
  return { status: aliases[0] ?? null, reason: null };
}

function causalInspection(snapshot: FactSnapshot, root: FactStatus): string | null {
  const missing = new Set<string>(), unavailable = new Set<string>(), seen = new Set<string>();
  const queue = [...root.fact.predecessors.required];
  while (queue.length) {
    const reference = queue.shift()!;
    if (seen.has(reference)) continue;
    seen.add(reference);
    const found = inspectionStatus(snapshot, reference);
    if (found.reason) { unavailable.add(`${reference} (${found.reason})`); continue; }
    if (!found.status) { missing.add(reference); continue; }
    if (found.status.taint.length || found.status.conflicts.length) unavailable.add(reference);
    queue.push(...found.status.fact.predecessors.required);
  }
  if (missing.size) return `missing causal references: ${[...missing].sort().join(',')}`;
  if (unavailable.size) return `unavailable causal references: ${[...unavailable].sort().join(',')}`;
  return null;
}

function historicalInputFor(fact: FactEnvelope, facts: FactContext,
  supplied: readonly OpenedProductionInstallationHistoricalInput[]): Result<OpenedProductionInstallationOwnerInput> {
  const boundaryContext = { site: facts.site, preserved: facts.preserved, register: facts.decode.register };
  return boundary('OpenedProductionHistoricalInput', { fact: fact.id, kind: fact.kind }, boundaryContext, () => {
    const matches = supplied.filter(row => row.fact.id === fact.id);
    ensure(matches.length === 1, 'historical-installation-admission-context');
    const selected = matches[0]!;
    ensure(selected.fact.owner === 'part-two' && selected.fact.name === 'FactEnvelope',
      'historical-installation-admission-context: exact fact reference required');
    const body = (fact.body as { record?: unknown }).record;
    if (fact.kind === 'assembly-InstallationSelection') {
      ensure(selected.kind === 'singleton-history', 'historical-installation-admission-context: selection context differs');
      const selection = take(decodeHistoricalInstallationSelection(body,
        { ...selected.admission.boundary, origin: fact, mode: 'historical', facts }, selected.admission));
      return freeze({ kind: 'singleton-history' as const, fact, selection });
    }
    if (fact.kind === 'assembly-ProductionSignerReference') {
      ensure(selected.kind === 'signer-history', 'historical-installation-admission-context: signer context differs');
      const record = take(decodeHistoricalProductionSignerReference(body,
        { ...selected.admission.boundary, origin: fact, mode: 'historical', facts }, selected.admission));
      return freeze({ kind: 'direct-owner' as const, fact, record: record as unknown as Json });
    }
    ensure(fact.kind === 'rungraph-installed-governance-reference' && selected.kind === 'governance-history',
      'historical-installation-admission-context: governance context differs');
    const record = take(decodeHistoricalInstalledRunGovernanceReference(body,
      { ...selected.admission.boundary, origin: fact, mode: 'historical', facts }, selected.admission));
    return freeze({ kind: 'direct-owner' as const, fact, record: record as unknown as Json });
  });
}

function historicalVerdicts(snapshot: FactSnapshot, facts: FactContext, installation: string,
  supplied: readonly OpenedProductionInstallationHistoricalInput[]): Readonly<{
    verdicts: readonly OpenedProductionInstallationBindingVerdict[];
    inputs: ReadonlyMap<string, OpenedProductionInstallationOwnerInput>;
    unavailable: ReadonlyMap<string, string>;
  }> {
  const kinds = new Set(['assembly-InstallationSelection', 'assembly-ProductionSignerReference',
    'rungraph-installed-governance-reference']);
  const inputs = new Map<string, OpenedProductionInstallationOwnerInput>();
  const unavailable = new Map<string, string>();
  const rows = snapshot.entries.filter(row => kinds.has(row.fact.kind)
    && (row.fact.body as { record?: { installation?: string } }).record?.installation === installation);
  type DecodedHistoryRow = Readonly<{ status: FactStatus; owner: string;
    source: OpenedProductionInstallationBindingVerdict['source']; name: string;
    input: OpenedProductionInstallationOwnerInput | null; refusal: string | null }>;
  const ownerRecord = (input: OpenedProductionInstallationOwnerInput): Json => input.kind === 'singleton-history'
    ? input.selection as unknown as Json : input.kind === 'direct-owner' ? input.record : input.row;
  const decoded = rows.map(status => {
    const owner = status.fact.kind === 'rungraph-installed-governance-reference' ? 'part-five'
      : status.fact.kind === 'assembly-ProductionSignerReference' ? 'part-two' : 'part-ten';
    const source = { location: `opened-root:${status.fact.kind}:${status.fact.id}`, expectedKind: status.fact.kind,
      expectedReference: status.fact.id, actualReference: envelopeReference(status.fact) };
    const name = `historical:${status.fact.kind}:${status.fact.id}`;
    return consumeResult<OpenedProductionInstallationOwnerInput, DecodedHistoryRow>(
      historicalInputFor(status.fact, facts, supplied), {
      Success: input => ({ status, owner, source, name, input, refusal: null }),
      Refused: refusal => ({ status, owner, source, name, input: null, refusal: refusal.detail }),
      });
  });
  const groups = new Map<string, typeof decoded>();
  for (const row of decoded) {
    if (!row.input) continue;
    const record = ownerRecord(row.input);
    const fields = record as Readonly<Record<string, Json>>;
    const key = row.status.fact.kind === 'assembly-InstallationSelection'
      ? encoded([fields.installation!, fields.scope!, fields.generation!, fields.role!, fields.instance!]).bytes
      : row.status.fact.kind === 'assembly-ProductionSignerReference'
        ? encoded([fields.installation!, fields.machine!, fields.generation!]).bytes
        : encoded([fields.installation!, fields.scope!, fields.generation!]).bytes;
    const grouped = groups.get(`${row.status.fact.kind}:${key}`) ?? [];
    grouped.push(row); groups.set(`${row.status.fact.kind}:${key}`, grouped);
  }
  const immutableConflicts = new Map<string, string>();
  for (const group of groups.values()) {
    const records = new Set(group.map(row => encoded(ownerRecord(row.input!)).bytes));
    if (records.size <= 1) continue;
    const references = group.map(row => row.status.fact.id).sort().join(',');
    const reason = `historical immutable conflict: unequal canonical records share owner key; sources=${references}`;
    for (const row of group) immutableConflicts.set(row.status.fact.id, reason);
  }
  const verdicts = decoded.map((row): OpenedProductionInstallationBindingVerdict => {
    const fact = row.status.fact, immutableConflict = immutableConflicts.get(fact.id);
    const statusUnavailable = row.status.taint.length || row.status.conflicts.length
      ? `historical owner source is unavailable or conflicted: ${encoded({ taint: row.status.taint, conflicts: row.status.conflicts }).bytes}`
      : null;
    const reason = [row.refusal, immutableConflict, statusUnavailable]
      .filter((value): value is string => typeof value === 'string').join('; ') || null;
    if (reason) {
      unavailable.set(fact.id, reason);
      return freeze({ name: row.name, owner: row.owner, state: 'unresolved' as const,
        reason, source: row.source, input: null });
    }
    inputs.set(fact.id, row.input!);
    return freeze({ name: row.name, owner: row.owner, state: 'resolved' as const,
      reason: null, source: row.source, input: row.input! });
  });
  return freeze({ verdicts, inputs, unavailable });
}

function directOwnerInput(status: FactStatus, facts: FactContext): Result<OpenedProductionInstallationOwnerInput> {
  const boundaryContext = { site: facts.site, preserved: facts.preserved, register: facts.decode.register };
  return boundary('OpenedProductionDirectOwnerInput', { fact: status.fact.id, kind: status.fact.kind }, boundaryContext, () => {
    const decoded = take(decodeHistoricalBody(status.fact, facts, causalStanding(status.fact, facts, false).decode));
    const fields = decoded.fields as unknown as Readonly<Record<string, Json>>;
    const record = Object.hasOwn(fields, 'record') ? fields.record! : fields as unknown as Json;
    return freeze({ kind: 'direct-owner' as const, fact: status.fact, record });
  });
}

/** P10-SI-16/P10-SI-35: inspect the actual opened root without using the strict
 * resolver. Every slot is reported from one coherent vector; singleton history
 * is diagnostic owner input only and never satisfies the required set. */
export function inspectOpenedProductionInstallation(composition: AssemblyComposition, manifestId: string, scope: string,
  historicalInputs: readonly OpenedProductionInstallationHistoricalInput[] = []): Result<OpenedProductionInstallationInspection> {
  return boundary('OpenedProductionInstallationInspection', { manifestId, scope }, composition.host.boundary, () => {
    const seenInputs = new Set<string>();
    for (const input of historicalInputs) {
      ensure(input.fact.owner === 'part-two' && input.fact.name === 'FactEnvelope' && input.fact.id.length > 0,
        'inspection: malformed historical input reference');
      ensure(!seenInputs.has(input.fact.id), `inspection: duplicate historical input context: ${input.fact.id}`);
      seenInputs.add(input.fact.id);
    }
    const current = composition.host.current();
    ensure(current.generation === current.facts.decode.register.generation.id,
      'inspection: host and register generation differ');
    const opened = take(composition.spine.store.read());
    const facts: FactContext = { ...current.facts, facts: opened };
    const snapshot = take(prepareSnapshot(opened, facts));
    const inspectionContext = { ...composition.host.boundary, validateReferences: false, ownerFacts: facts };
    const assembly = currentAssemblyRows(snapshot, inspectionContext);
    const manifests = assembly.filter((row): row is typeof row & { record: AssemblyManifest } =>
      row.record.type === 'AssemblyManifest' && row.record.id === manifestId && !row.taint.length && !row.conflicts.length);
    ensure(manifests.length === 1, 'inspection: current signed manifest missing or ambiguous');
    const manifest = manifests[0]!.record;
    ensure(manifest.generation === current.generation, 'inspection: manifest generation differs from opened root');
    const bindings = (manifest.productionBindings ?? []).filter(row => row.scope === scope);
    ensure(bindings.length === 1, 'inspection: exact scope binding set required');
    const binding = bindings[0]!;

    const installations = snapshot.entries.filter(status => status.fact.kind === 'assembly-ProductionInstallation'
      && (status.fact.body as { record?: { generation?: string; machineIdentity?: string } }).record?.generation === current.generation
      && (status.fact.body as { record?: { generation?: string; machineIdentity?: string } }).record?.machineIdentity === composition.host.machine);
    ensure(installations.length === 1 && !installations[0]!.taint.length && !installations[0]!.conflicts.length,
      'inspection: exact opened-root installation missing, unavailable or ambiguous');
    const installationStatus = installations[0]!;
    const installation = take(decodeProductionInstallation(
      (installationStatus.fact.body as { record?: unknown }).record,
      { ...current.facts.decode, site: current.facts.site, preserved: current.facts.preserved }));
    ensure(installation.generation === current.generation && installation.machineIdentity === composition.host.machine,
      'inspection: installation generation or machine differs');

    const history = historicalVerdicts(snapshot, facts, installation.id, historicalInputs);
    const decodedSets = new Map<string, Readonly<{ record: InstallationSelectionSet | null; refusal: string | null }>>();
    const inspectedSet = (status: FactStatus): Readonly<{ record: InstallationSelectionSet | null; refusal: string | null }> => {
      const cached = decodedSets.get(status.fact.id);
      if (cached) return { record: cached.record, refusal: cached.refusal };
      const decoded = boundary<InstallationSelectionSet>('OpenedInstallationSelectionSet', status.fact.id,
        composition.host.boundary, () => {
          ensure(!status.taint.length && !status.conflicts.length,
            'installation selection set source is unavailable or conflicted');
          const causal = causalInspection(snapshot, status);
          ensure(!causal, causal ?? 'installation selection set causal source unavailable');
          const body = take(decodeHistoricalBody(status.fact, facts,
            causalStanding(status.fact, facts, false).decode));
          const set = body.fields.record as unknown as InstallationSelectionSet;
          ensure(set.installation === installation.id && set.machine === composition.host.machine
            && set.scope === scope && set.generation === current.generation,
          'installation selection set differs from opened installation, scope or generation');
          return set;
        });
      return consumeResult<InstallationSelectionSet, Readonly<{ record: InstallationSelectionSet | null; refusal: string | null }>>(decoded, {
        Success: record => { decodedSets.set(status.fact.id, { record, refusal: null }); return { record, refusal: null }; },
        Refused: refusal => { const result = { record: null, refusal: refusal.detail };
          decodedSets.set(status.fact.id, result); return result; },
      });
    };
    const verdicts = namedBindings(binding).map(({ name, requiredKind, row }): OpenedProductionInstallationBindingVerdict => {
      const found = inspectionStatus(snapshot, row.fact.reference);
      const actual = found.status?.fact ?? null;
      const source = { location: `manifest:${manifest.id}:scope:${scope}:binding:${name}`, expectedKind: requiredKind,
        expectedReference: row.fact.reference, actualReference: actual ? envelopeReference(actual) : null };
      const selection = inspectionSelection(name, requiredKind);
      if (selection) {
        if (actual?.kind === 'assembly-InstallationSelectionSet') {
          const openedSet = inspectedSet(found.status!);
          const selected = openedSet.record?.rows.filter(candidate => candidate.role === selection.role
            && candidate.instance === selection.instance) ?? [];
          const matches = selected.length === 1 && selected[0]!.owner === selection.owner
            && selected[0]!.scope === scope
            && (name.startsWith('dependency:') || selected[0]!.implementation === row.implementation);
          const reason = found.reason ?? openedSet.refusal ?? (row.fact.expectedKind !== 'assembly-InstallationSelectionSet'
            ? 'manifest binding expects a different signed kind'
            : !matches ? `required installation selection set row differs: ${selection.role}:${selection.instance}` : null);
          if (reason) return freeze({ name, owner: selection.owner, state: 'unresolved' as const,
            reason, source, input: null });
          const selectedRow = selected[0]!;
          const address = freeze({ type: 'InstallationSelectionRowReference' as const, schemaVersion: 1 as const,
            set: envelopeReference(actual), rowDigest: selectedRow.id, role: selectedRow.role,
            instance: selectedRow.instance });
          const input = freeze({ kind: 'set-row' as const, fact: actual, address,
            row: selectedRow as unknown as Json });
          return freeze({ name, owner: selection.owner, state: 'resolved' as const,
            reason: null, source, input });
        }
        let input = actual ? history.inputs.get(actual.id) ?? null : null;
        const historyUnavailable = actual ? history.unavailable.get(actual.id) ?? null : null;
        let detail = found.reason ?? (actual ? '' : 'binding source bytes are absent');
        if (actual?.kind === 'assembly-InstallationSelection' && input?.kind === 'singleton-history') {
          const record = input.selection;
          const exact = record.installation === installation.id && record.machine === composition.host.machine
            && record.scope === scope && record.generation === current.generation && record.role === selection.role
            && record.instance === selection.instance && record.owner === selection.owner
            && (name.startsWith('dependency:') || record.implementation === row.implementation);
          if (!exact) detail = 'singleton history differs from the exact installation/role/instance binding';
          else detail = 'singleton history is diagnostic only; required installation selection set is unavailable';
        } else if (actual?.kind === 'assembly-InstallationSelection' && !input) {
          detail = `${historyUnavailable ?? 'historical-installation-admission-context'}; required installation selection set is unavailable`;
        } else if (actual) {
          input = null;
          detail = `required installation selection set is unavailable; actual kind is ${actual.kind}`;
        } else detail = `${detail}; required installation selection set is unavailable`;
        return freeze({ name, owner: selection.owner, state: 'unresolved' as const, reason: detail, source, input });
      }
      const expected = directInspectionKinds[requiredKind];
      if (!expected) return freeze({ name, owner: 'part-ten', state: 'unresolved' as const,
        reason: `inspection has no approved binding map for ${requiredKind}`, source, input: null });
      if (found.reason || !found.status) return freeze({ name, owner: expected.owner, state: 'unresolved' as const,
        reason: found.reason ?? 'binding source bytes are absent', source, input: null });
      const status = found.status;
      if (row.fact.expectedKind !== requiredKind || status.fact.kind !== expected.kind)
        return freeze({ name, owner: expected.owner, state: 'unresolved' as const,
          reason: `direct owner kind differs: ${status.fact.kind}:expected:${expected.kind}`, source, input: null });
      const historyUnavailable = history.unavailable.get(status.fact.id);
      if (historyUnavailable) return freeze({ name, owner: expected.owner,
        state: 'unresolved' as const, reason: historyUnavailable, source, input: null });
      if (status.taint.length || status.conflicts.length) return freeze({ name, owner: expected.owner,
        state: 'unresolved' as const, reason: 'direct owner source is unavailable or conflicted', source, input: null });
      const causal = causalInspection(snapshot, status);
      if (causal) return freeze({ name, owner: expected.owner, state: 'unresolved' as const, reason: causal, source, input: null });
      if (requiredKind === 'transport-FenceToken') return freeze({ name, owner: expected.owner,
        state: 'unresolved' as const,
        reason: 'Six current assignment-derived fence cannot be established from a standalone stored token', source, input: null });
      const decoded = status.fact.kind === 'assembly-ProductionSignerReference'
        ? boundary<OpenedProductionInstallationOwnerInput>('OpenedProductionSignerInput', status.fact.id, composition.host.boundary, () => {
          const input = history.inputs.get(status.fact.id);
          ensure(input?.kind === 'direct-owner', 'historical-installation-admission-context'); return input;
        }) : directOwnerInput(status, facts);
      return consumeResult<OpenedProductionInstallationOwnerInput, OpenedProductionInstallationBindingVerdict>(decoded, {
        Success: input => freeze({ name, owner: expected.owner, state: 'resolved' as const, reason: null, source, input }),
        Refused: refusal => freeze({ name, owner: expected.owner, state: 'unresolved' as const,
          reason: refusal.detail, source, input: null }),
      });
    });

    const selectedSets = [...new Set(verdicts.filter(row => row.input?.kind === 'set-row')
      .map(row => row.input!.fact.id))];
    const setProtection = selectedSets.length === 1 ? (() => {
      const selected = snapshot.entries.find(status => status.fact.id === selectedSets[0]);
      const rows = selected ? inspectedSet(selected).record?.rows.filter(row => row.role === 'scope-protection') ?? [] : [];
      if (!selected || rows.length !== 1) return null;
      const row = rows[0]!;
      return freeze({ kind: 'set-row' as const, fact: selected.fact,
        address: freeze({ type: 'InstallationSelectionRowReference' as const, schemaVersion: 1 as const,
          set: envelopeReference(selected.fact), rowDigest: row.id, role: row.role, instance: row.instance }),
        row: row as unknown as Json });
    })() : null;
    const protectionCandidates = [...history.inputs.values()].filter((input): input is Extract<OpenedProductionInstallationOwnerInput,
      { kind: 'singleton-history' }> => input.kind === 'singleton-history' && input.selection.installation === installation.id
        && input.selection.scope === scope && input.selection.generation === current.generation
        && input.selection.machine === composition.host.machine && input.selection.role === 'scope-protection');
    const rawProtection = snapshot.entries.filter(status => status.fact.kind === 'assembly-InstallationSelection'
      && (status.fact.body as { record?: { installation?: string; scope?: string; role?: string } }).record?.installation === installation.id
      && (status.fact.body as { record?: { installation?: string; scope?: string; role?: string } }).record?.scope === scope
      && (status.fact.body as { record?: { installation?: string; scope?: string; role?: string } }).record?.role === 'scope-protection');
    const protectionUnavailable = rawProtection.map(status => history.unavailable.get(status.fact.id)).find(Boolean);
    const protectionGroups = new Map<string, typeof protectionCandidates>();
    for (const candidate of protectionCandidates) {
      const key = encoded(candidate.selection).bytes;
      const group = protectionGroups.get(key) ?? [];
      group.push(candidate); protectionGroups.set(key, group);
    }
    const soleProtectionGroup = protectionGroups.size === 1 ? [...protectionGroups.values()][0]! : null;
    const protectionReferences = [...new Set(protectionCandidates.map(candidate => candidate.fact.id))].sort();
    const protectionAmbiguity = protectionGroups.size > 1
      ? `scope-protection ambiguity: distinct canonical decoded selections; sources=${protectionReferences.join(',')}` : null;
    const protectionInput = setProtection ?? (protectionUnavailable || protectionAmbiguity ? null : soleProtectionGroup?.[0] ?? null);
    const protectionActual = protectionAmbiguity ? null : protectionInput?.fact ?? rawProtection[0]?.fact ?? null;
    const protectionSource = { location: `installation:${installation.id}:scope:${scope}:role:scope-protection`,
      expectedKind: 'assembly-InstallationSelectionSet', expectedReference: setProtection?.fact.id ?? null,
      actualReference: protectionActual ? envelopeReference(protectionActual) : null };
    const protectionHold = [protectionUnavailable, protectionAmbiguity]
      .filter((reason): reason is string => typeof reason === 'string').join('; ');
    const protectionReason = selectedSets.length > 1
      ? `scope-protection ambiguity: multiple selected installation sets; sources=${selectedSets.sort().join(',')}`
      : protectionHold
      ? `${protectionHold}; required installation selection set is unavailable`
      : protectionInput ? 'singleton history is diagnostic only; required installation selection set is unavailable'
      : rawProtection.length ? 'historical-installation-admission-context; required installation selection set is unavailable'
      : 'scope-protection source bytes are absent; required installation selection set is unavailable';
    const protectionVerdict: OpenedProductionInstallationBindingVerdict = setProtection
      ? freeze({ name: 'scope-protection', owner: 'part-ten', state: 'resolved' as const,
        reason: null, source: protectionSource, input: setProtection })
      : freeze({ name: 'scope-protection', owner: 'part-ten', state: 'unresolved' as const,
        reason: protectionReason, source: protectionSource, input: protectionInput });
    const allBindings = freeze([...verdicts, protectionVerdict]);
    const dependencyInputs = binding.dependencies.map(row => {
      const verdict = allBindings.find(candidate => candidate.name === `dependency:${row.name}`);
      return freeze({ name: row.name, input: verdict?.input ?? null });
    });
    const sourceVector: Record<string, { epoch: number; position: number }> = {};
    for (const fact of opened) {
      const prior = sourceVector[fact.machine], point = fact.segment;
      if (!prior || point.epoch > prior.epoch || point.epoch === prior.epoch && point.position > prior.position)
        sourceVector[fact.machine] = { epoch: point.epoch, position: point.position };
    }
    const sourceDigest = encoded(opened.map(fact => ({ id: fact.id, hash: fact.contentHash }))).hash;
    const reread = take(composition.spine.store.read()), after = composition.host.current();
    ensure(encoded(reread).bytes === encoded(opened).bytes && after.generation === current.generation
      && after.facts.decode.register.generation.id === current.generation,
    'inspection: opened root changed before coherent inspection completed');
    return take(openedProductionInstallationReport({ type: 'OpenedProductionInstallationInspection', schemaVersion: 1,
      owner: 'part-ten', installation: installation.id, scope, generation: current.generation, sourceVector, sourceDigest,
      bindings: allBindings, history: history.verdicts,
      unresolved: [...allBindings, ...history.verdicts].filter(row => row.state === 'unresolved'),
      ownerInputs: { source: snapshot, manifest, binding, installation: { fact: installationStatus.fact, record: installation },
        scopeProtection: protectionInput, dependencies: dependencyInputs, historical: [...history.inputs.values()] }, live: false },
    composition.host.boundary));
  });
}

function requireMethod(value: unknown, name: string): void {
  ensure(typeof value === 'function', `production composition binding is unavailable: ${name}`);
}

function requirePublicPort(manifest: AssemblyManifest, scope: string, port: string, implementation: string): void {
  const rows = manifest.publicPorts.filter(row => row.scope === scope && row.port === port);
  ensure(rows.length === 1 && rows[0]!.implementation === implementation,
    `production public-port binding is missing or differs: ${port}:${implementation}`);
}

function equalBudgets(left: AssemblyProductionBindingSet['minimalResponder']['budgets'],
  right: AssemblyProductionBindingSet['minimalResponder']['budgets']): boolean {
  return left.worker === right.worker && left.storage === right.storage && left.queue === right.queue
    && left.transport === right.transport && left.effect === right.effect;
}

function validateDependencyHandle(name: AssemblyLiveDependencyHandle['name'], resolution: AssemblyResolvedProductionBinding,
  handle: AssemblyLiveDependencyHandle, currentGeneration: string | null): AssemblyLiveDependencyHandle {
  ensure(handle.name === name && handle.reference === resolution.fact.id && handle.current === true
    && handle.provider.trim().length > 0, `live dependency handle differs or is stale: ${name}`);
  switch (handle.name) {
    case 'local-facts': ensure(handle.durability === 'local-durable', 'minimal fact segment is not local-durable'); break;
    case 'register':
      ensure(handle.generation.trim().length > 0, 'current decoder/register generation is unavailable');
      ensure(currentGeneration !== null && handle.generation === currentGeneration,
        `live register dependency generation differs from current assembly generation: dependency=${handle.generation}; current=${currentGeneration ?? 'unavailable'}`);
      break;
    case 'identity-keys': ensure(handle.keys.trim().length > 0, 'current identity keys are unavailable'); break;
    case 'clock': ensure(handle.clock.trim().length > 0, 'current clock is unavailable'); break;
    case 'lease':
    case 'fence': ensure(handle.exclusive === true, `minimal ${handle.name} is not exclusive`); break;
    case 'replication-peer': ensure(handle.replicas === 1 && handle.distinctPeer === true,
      'replicated(1) requires one distinct authenticated peer acknowledgement'); break;
    case 'conversation-binding': ensure(handle.binding.trim().length > 0, 'current conversation binding is unavailable'); break;
    case 'route': ensure(handle.route.trim().length > 0, 'current conversation route is unavailable'); break;
    case 'delivery-evidence': ensure(handle.administration === 'independent',
      'delivery-evidence service must be independently administered'); break;
  }
  return handle;
}

/** Boot the additive Part Ten production composition and return its sole coordinator. */
export function bootProductionAssembly(composition: AssemblyComposition, manifestId: string,
  scope: string): Result<AssemblyProductionCoordinator> {
  return boundary('AssemblyProductionBoot', { manifestId, scope }, composition.host.boundary, () => {
    const production = composition.production;
    ensure(production, 'production composition bindings are unavailable');
    const runtime = createAssemblyRuntime(composition);
    const { manifest, binding, references } = resolveReferences(composition, runtime, manifestId, scope);
    const partial = references.filter(row => row.completeness === 'partial');
    ensure(partial.length === 0, `production binding remains honestly partial: ${partial.map(row => row.name).join(', ')}`);

    ensure(production.surface.owner === 'part-eleven' && production.surface.id === binding.surface.adapter.implementation,
      'registered operator surface binding differs from the manifest');
    for (const [name, operation] of Object.entries({
      render: production.surface.render,
      pending: production.surface.pending,
      challenge: production.surface.challenge,
      confirm: production.surface.confirm,
      binding: production.surface.binding,
      protection: production.surface.protection,
      stopChallenge: production.surface.stopChallenge,
      stop: production.surface.stop,
    })) requireMethod(operation, `OperatorSurfacePort.${name}`);
    ensure(production.challengeVerifier.id === binding.surface.challengeVerifier.implementation
      && production.challengeVerifier.port.owner === 'part-nine'
      && production.challengeVerifier.port.administration === 'independent',
    'independent challenge verifier binding differs from the manifest');
    requireMethod(production.challengeVerifier.port.issue, 'IndependentSurfaceVerifierPort.issue');
    requireMethod(production.challengeVerifier.port.verify, 'IndependentSurfaceVerifierPort.verify');
    ensure(production.verifiedActIntake.owner === 'part-four'
      && production.verifiedActIntake.id === binding.verifiedActIntake.implementation
      && production.verifiedActIntake.operation === 'admitVerifiedAct',
    'Part Four verified-act intake binding differs from the manifest');
    requireMethod(production.verifiedActIntake.port.admitVerifiedAct, 'IntakePort.admitVerifiedAct');

    requirePublicPort(manifest, scope, 'OperatorSurfacePort', production.surface.id);
    requirePublicPort(manifest, scope, 'IndependentSurfaceVerifierPort', production.challengeVerifier.id);
    requirePublicPort(manifest, scope, 'IntakePort.admitVerifiedAct', production.verifiedActIntake.id);
    for (const [port, handle] of [
      ['RunGraphPort', production.run], ['TransportAuthority', production.lease], ['JudgmentDoorway', production.judgment],
      ['EffectDoorway', production.effect], ['VerificationRuntimePort', production.verification],
    ] as const) requirePublicPort(manifest, scope, port, handle.id);
    requirePublicPort(manifest, scope, 'VerificationClockPort', production.verificationClock.id);
    for (const [name, operation] of Object.entries({
      'RunGraphPort.open': production.run.port.open,
      'RunGraphPort.ground': production.run.port.ground,
      'RunGraphPort.transition': production.run.port.transition,
      'RunGraphPort.readExit': production.run.port.readExit,
      'TransportAuthority.inspect': production.lease.port.inspect,
      'TransportAuthority.renew': production.lease.port.renew,
      'TransportAuthority.release': production.lease.port.release,
      'TransportAuthority.admitWrite': production.lease.port.admitWrite,
      'TransportAuthority.schedule': production.lease.port.schedule,
      'TransportAuthority.reserve': production.lease.port.reserve,
      'TransportAuthority.claim': production.lease.port.claim,
      'TransportAuthority.consume': production.lease.port.consume,
      'TransportAuthority.recover': production.lease.port.recover,
      'TransportAuthority.close': production.lease.port.close,
      'TransportAuthority.settle': production.lease.port.settle,
      'JudgmentDoorway.resumeRecording': production.judgment.port.resumeRecording,
      'JudgmentDoorway.readAnswer': production.judgment.port.readAnswer,
      'JudgmentDoorway.inspect': production.judgment.port.inspect,
      'EffectDoorway.prepare': production.effect.port.prepare,
      'EffectDoorway.handoff': production.effect.port.handoff,
      'EffectDoorway.observe': production.effect.port.observe,
      'EffectDoorway.settle': production.effect.port.settle,
      'EffectDoorway.inspect': production.effect.port.inspect,
      'VerificationRuntimePort.record': production.verification.port.record,
      'VerificationRuntimePort.inspect': production.verification.port.inspect,
      'VerificationRuntimePort.due': production.verification.port.due,
    })) requireMethod(operation, name);
    requireMethod(production.run.port.read, 'RunGraphPort.read');
    requireMethod(production.lease.port.acquire, 'TransportAuthority.acquire');
    requireMethod(production.judgment.port.judge, 'JudgmentDoorway.judge');
    ensure(production.effect.port.owner === 'part-eight', 'effect doorway must be issued by Part Eight');
    requireMethod(production.effect.port.dispatch, 'EffectDoorway.dispatch');
    ensure(production.verification.port.owner === 'part-nine', 'verification runtime must be issued by Part Nine');
    requireMethod(production.verification.port.inspectCurrent, 'VerificationRuntimePort.inspectCurrent');
    requireMethod(production.verification.port.posture, 'VerificationRuntimePort.posture');
    ensure(production.verificationClock.owner === 'part-nine'
      && production.verificationClock.administration === 'independent',
    'verification clock must belong to the independently administered Part Nine domain');
    requireMethod(production.verificationClock.current, 'AssemblyVerificationClockPort.current');

    ensure(production.folds.length === binding.minimalPlane.folds.length, 'minimal-plane fold binding count differs');
    for (const row of binding.minimalPlane.folds) {
      const matches = production.folds.filter(fold => fold.id === row.projection && fold.implementation === row.implementation
        && fold.definition.id === row.projection && fold.definition.class === 'informational');
      ensure(matches.length === 1, `minimal-plane projection fold is missing or ambiguous: ${row.projection}`);
    }
    ensure(production.replay.owner === 'part-ten' && production.replay.sourceOnly === true
      && production.replay.id === binding.minimalPlane.sourceOnlyReplay.implementation,
    'source-only replay provider differs from the manifest');
    requireMethod(production.replay.rebuild, 'AssemblySourceOnlyReplayPort.rebuild');
    ensure(production.minimalResponder.owner === 'part-eleven'
      && production.minimalResponder.id === binding.minimalResponder.implementation
      && equalBudgets(production.minimalResponder.budgets, binding.minimalResponder.budgets),
    'minimal responder identity or reserved budgets differ from the manifest');
    ensure(Object.values(production.minimalResponder.budgets).every(value => Number.isSafeInteger(value) && value > 0),
      'minimal responder production budgets must be finite positive reserves');
    requireMethod(production.minimalResponder.respond, 'AssemblyMinimalResponderPort.respond');

    const sixHistory = take(production.lease.port.inspect());
    const leaseHead = sixHistory.filter(row => row.record.type === 'Lease' && row.record.operation !== 'write').at(-1);
    const signedLease = references.find(row => row.name === 'dependency:lease');
    const signedFence = references.find(row => row.name === 'dependency:fence');
    const signedAssignment = sixHistory.find(row => row.fact.id === signedLease?.fact.id);
    ensure(leaseHead?.record.type === 'Lease' && leaseHead.record.state === 'held'
      && signedAssignment?.record.type === 'Lease' && signedAssignment.record.operation === 'acquire'
      && signedAssignment.record.state === 'held' && signedFence?.fact.id === signedAssignment.fact.id
      && sixHistory.indexOf(signedAssignment) <= sixHistory.indexOf(leaseHead)
      && signedAssignment.record.holder === leaseHead.record.holder
      && signedAssignment.record.machine === leaseHead.record.machine
      && signedAssignment.record.generation === leaseHead.record.generation,
    'current Six lease and assignment source differ');
    const currentFence = fenceFor(sixHistory, leaseHead.record);
    ensure(currentFence.generation === composition.host.current().generation
      && currentFence.machine === composition.host.machine
      && currentFence.holder === composition.host.principal.id,
    'current Six fence differs from installed owner');
    const capacity = take(production.lease.port.inspectCapacity());
    ensure(capacity.sourceFrontier === sixHistory.at(-1)?.fact.id,
      'Six capacity and lease views differ at source frontier');
    const responder = references.find(row => row.name === 'minimal-responder');
    ensure(responder?.address && responder.fact.kind === 'assembly-InstallationSelectionSet',
      'selected minimal responder has no set row address');
    const signedFacts = { ...composition.host.current().facts,
      facts: take(composition.spine.store.readForProjection()).entries.map(entry => entry.fact) };
    const setBody = take(decodeHistoricalBody(responder.fact, signedFacts,
      causalStanding(responder.fact, signedFacts, false).decode)).fields.record as unknown as InstallationSelectionSet;
    const selectedRow = setBody.rows.find(row => row.id === responder.address!.rowDigest);
    ensure(selectedRow?.role === 'minimal-responder' && selectedRow.instance === 'minimal-responder-binding',
      'selected minimal responder row differs');
    const selectedCapacity = capacity.heads.filter(head => selectedRow.references.some(reference =>
      capacity.history.some(history => history.fact.id === reference && history.record.type === 'CapacityReservation'
        && history.record.capacity === head.capacity)));
    ensure(selectedCapacity.length === 1 && selectedCapacity.at(0)!.usable
      && selectedCapacity.at(0)!.record.scope === scope
      && selectedCapacity.at(0)!.record.generation === currentFence.generation
      && selectedCapacity.at(0)!.record.fence.assignment === currentFence.assignment,
    'selected Six capacity is absent, ambiguous or not current');

    ensure(production.dependencyAdmission.owner === 'part-ten', 'live dependency admission is not Part Ten-owned');
    requireMethod(production.dependencyAdmission.admit, 'AssemblyDependencyAdmissionPort.admit');
    const dependencyHandles = Object.fromEntries(requiredMinimalDependencies.filter(name =>
      name !== 'replication-peer' || references.some(row => row.name === 'dependency:replication-peer')).map(name => {
      const resolution = references.find(row => row.name === `dependency:${name}`)!;
      const handle = take(production.dependencyAdmission.admit({ name, fact: resolution.fact,
        completeness: resolution.completeness, missing: resolution.missing }));
      const currentGeneration = name === 'register' ? composition.host.current().generation : null;
      return [name, validateDependencyHandle(name, resolution, handle, currentGeneration)];
    })) as AssemblyProductionCoordinator['handles']['dependencies'];

    ensure(production.lifecycle.owner === 'part-ten' && production.lifecycle.cutId === binding.lifecycle.cut.implementation
      && production.lifecycle.recoveryId === binding.lifecycle.recovery.implementation,
    'deterministic prerequisite cut/recovery controls differ from the manifest');
    requireMethod(production.lifecycle.cut, 'AssemblyPrerequisiteLifecyclePort.cut');
    requireMethod(production.lifecycle.recover, 'AssemblyPrerequisiteLifecyclePort.recover');

    const witness = production.deliveryWitness;
    ensure(typeof witness.platform === 'string' && witness.platform.trim().length > 0,
      'platform delivery witness must name a non-empty platform');
    ensure(witness.owner === 'part-nine' && witness.administration === 'independent'
      && witness.id === binding.deliveryWitness.implementation && witness.identity === binding.deliveryWitness.identity
      && witness.platform === binding.deliveryWitness.platform,
    'platform delivery witness binding differs from the manifest');
    const actualIdentities = [witness.identity, production.requesterIdentity, production.surface.id, production.effectAdapterIdentity];
    ensure(new Set(actualIdentities).size === actualIdentities.length
      && production.requesterIdentity === binding.deliveryWitness.requester
      && production.effectAdapterIdentity === binding.deliveryWitness.effectAdapter,
    'platform delivery witness must be distinct from requester, surface, and effect adapter');
    requireMethod(witness.observe, 'AssemblyPlatformDeliveryWitnessPort.observe');

    const admission = take(runtime.admit(manifestId, scope));
    ensure(productionGraphMatches(production.run.port, composition, scope),
      'production boot requires genuine graph/native harness/runtime/store/scope provenance');
    const handles = Object.freeze({ persistence: composition.persistence, harnesses: composition.harnesses, model: composition.model,
      intake: production.verifiedActIntake, run: production.run, lease: production.lease, judgment: production.judgment,
      effect: production.effect, verification: production.verification, verificationClock: production.verificationClock,
      surface: production.surface,
      challengeVerifier: production.challengeVerifier, folds: production.folds, replay: production.replay,
      minimalResponder: production.minimalResponder, dependencyAdmission: production.dependencyAdmission,
      dependencies: Object.freeze(dependencyHandles), lifecycle: production.lifecycle, deliveryWitness: witness });
    return Object.freeze({ owner: 'part-ten' as const, scope, admission, runtime, references, handles });
  });
}

// Keep Result consumption explicit at this boundary so no caller can accidentally
// treat a Refused boot as a coordinator through structural truthiness.
export function consumeProductionAssembly<T>(result: Result<T>,
  success: (value: T) => void, refused: (detail: string) => void): void {
  consumeResult(result, { Success: success, Refused: failure => refused(failure.detail) });
}
