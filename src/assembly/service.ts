import { boundary, ensure, freeze, take } from './boundary.js';
import { assemblyLogicalKey, assemblyRows, compareAssemblyRecords, decodeAssemblyRecord, factReferenceAliases,
  validateAssemblyRecordReferences } from './records.js';
import { currentAssemblyRows, resolveAssemblyHistory } from './history.js';
import type { AdapterConformance, AssemblyAdmission, AssemblyComposition, AssemblyManifest, AssemblyStoredRecord, AssemblyStoredRecordName, AssemblyRuntimePort } from './contracts.js';

function activeConformance(record: AdapterConformance, generation: string, now: number, bindings: readonly AssemblyManifest['publicPorts'][number][]): boolean {
  return record.disposition === 'passed' && record.generation === generation && record.validUntil >= now && record.stageChecks.length > 0
    && record.stageChecks.every(row => row.checkRun.trim().length > 0 && row.positive.length > 0 && row.negative.length > 0
      && row.positive.every(value => value.trim().length > 0) && row.negative.every(value => value.trim().length > 0))
    && bindings.some(binding => binding.implementation === record.adapter && binding.artifact === record.artifact);
}

function causalHeads<T extends { fact: { id: string }; record: { predecessors: readonly string[]; dependencyFacts: readonly string[] } }>(rows: readonly T[]): readonly T[] {
  const superseded = new Set(rows.flatMap(row => [...row.record.predecessors, ...row.record.dependencyFacts]));
  return rows.filter(row => !superseded.has(row.fact.id));
}

export function createAssemblyRuntime(composition: AssemblyComposition): AssemblyRuntimePort {
  const { host, spine } = composition;
  let runtimeContext: typeof host.boundary;
  const history = Object.freeze({ owner: 'part-ten' as const,
    current: () => boundary('AssemblyCurrentHistoryRead', null, host.boundary, () => currentAssemblyRows(take(spine.store.readForProjection()), runtimeContext)),
    lookup: (reference: string) => boundary('AssemblyHistoryLookup', reference, host.boundary, () => {
      const snapshot = take(spine.store.readForProjection()); const rows = currentAssemblyRows(snapshot, runtimeContext);
      const assembly = rows.find(row => row.fact.id === reference || row.record.id === reference);
      const status = snapshot.entries.find(row => row.fact.id === (assembly?.fact.id ?? reference))
        ?? snapshot.entries.find(row => factReferenceAliases(row.fact).includes(reference));
      if (!status) return null;
      return freeze({ fact: status.fact, ...(assembly ? { record: assembly.record } : {}), taint: status.taint,
        conflicts: assembly ? [...status.conflicts, ...assembly.conflicts] : status.conflicts,
        completeness: assembly?.record.type === 'GrowthObservation' && assembly.record.completion === 'incomplete' ? 'partial' as const : 'complete' as const });
    }),
    resolve: (record: import('./contracts.js').AssemblyRecord) => resolveAssemblyHistory(record, spine, runtimeContext),
    resolveContextDelivery: (record: import('./contracts.js').ContextDeliverySpecification) => resolveAssemblyHistory(record, spine, runtimeContext),
  });
  runtimeContext = Object.freeze({ ...host.boundary, history, validateReferences: false });
  const inspect = () => boundary('AssemblyInspect', null, runtimeContext, () => assemblyRows(take(spine.store.read()), runtimeContext));
  const inspectCurrent = () => history.current();
  const record = <N extends AssemblyStoredRecordName>(name: N, input: unknown) =>
    boundary<Extract<AssemblyStoredRecord, { type: N }>>('AssemblyRecord', input, host.boundary, () => {
      ensure(!host.current().stopped || name === 'HarnessObservation' || name === 'StorageAccessObservation' || name === 'GrowthObservation' || name === 'AssemblyAdmission', 'stop inhibits new assembly work');
      const candidate = take(decodeAssemblyRecord(name, input, runtimeContext));
      validateAssemblyRecordReferences(candidate, runtimeContext);
      const existing = take(inspect()).find(row => row.record.type === name &&
        (row.record.id === candidate.id || assemblyLogicalKey(row.record) === assemblyLogicalKey(candidate)));
      if (existing) { const compared = take(compareAssemblyRecords(name, existing.record, candidate, runtimeContext));
        ensure(compared.equal, compared.conflict?.detail ?? 'assembly identity conflict'); return existing.record as Extract<AssemblyStoredRecord, { type: N }>; }
      take(spine.append(candidate)); return candidate;
    });
  return Object.freeze({ owner: 'part-ten' as const,
    record: <N extends import('./contracts.js').AssemblyRecordName>(name: N, input: unknown) => record(name, input),
    recordContextDelivery: (input: unknown) => record('ContextDeliverySpecification', input),
    inspect, inspectCurrent,
    resolve(record: AssemblyStoredRecord) { return record.type === 'ContextDeliverySpecification'
      ? history.resolveContextDelivery(record) : history.resolve(record); },
    admit(manifestId: string, scope: string) {
      return boundary('AssemblyAdmissionConsumption', { manifestId, scope }, host.boundary, () => {
        const current = host.current(); ensure(!current.stopped, 'stopped assembly cannot activate scope');
        const rows = take(inspectCurrent());
        const manifests = rows.filter((row): row is typeof row & { record: AssemblyManifest } => row.record.type === 'AssemblyManifest' && row.record.id === manifestId);
        ensure(manifests.length === 1, 'manifest missing or ambiguous in signed history'); const manifestRow = manifests[0]!;
        const manifestVerdict = take(history.resolve(manifestRow.record));
        ensure(manifestVerdict.admitted, manifestVerdict.conflicts[0]?.detail ?? `manifest dependency missing: ${manifestVerdict.missing[0] ?? 'unknown'}`);
        ensure(manifestRow.record.generation === current.generation, 'manifest generation is not current signed generation');
        const bindings = manifestRow.record.publicPorts.filter(row => row.scope === scope);
        ensure(bindings.length > 0, 'manifest has no bindings for scope');
        const harnessBindings = bindings.filter(row => row.port === 'HarnessAdapterPort');
        for (const binding of harnessBindings) { const matches = composition.harnesses.filter(adapter => adapter.id === binding.implementation && adapter.describe().artifact === binding.artifact); ensure(matches.length === 1, 'harness binding is missing, hidden, or ambiguous'); }
        const modelBinding = bindings.find(row => row.port === 'ModelAdapterPort');
        if (modelBinding) { const description = composition.model.describe(); const id = `${description.provider}:${description.model}:${description.route}`; ensure(modelBinding.implementation === id && description.owner === 'part-ten', 'model binding differs from actual adapter'); }
        const persistenceBinding = bindings.find(row => row.port === 'PersistenceAdapterPort');
        if (persistenceBinding) ensure(composition.persistence.id === persistenceBinding.implementation && composition.persistence.describe().encrypted, 'persistence binding differs or is unencrypted');
        ensure(take(composition.independentProtection.posture(scope)) === 'protected', 'independent protection is not admitted');
        const admissions = rows.filter((row): row is typeof row & { record: AssemblyAdmission } => row.record.type === 'AssemblyAdmission'
          && row.record.manifest === manifestId && row.record.scope === scope && row.record.machine === host.machine);
        const admissionHeads = causalHeads(admissions); ensure(admissionHeads.length === 1 && admissionHeads[0]!.record.disposition === 'active', 'active admission missing or ambiguous');
        const admission = admissionHeads[0]!.record;
        ensure(admission.manifestDigest === manifestRow.record.manifestDigest && admission.sourceGeneration === current.generation, 'admission self-report differs from actual manifest/generation');
        ensure(admission.validUntil >= current.clock.value, 'admission expired');
        const verdict = take(history.resolve(admission));
        ensure(verdict.admitted, verdict.conflicts[0]?.detail ?? `admission dependency missing: ${verdict.missing[0] ?? 'unknown'}`);
        const conformance = admission.conformance.map(id => rows.find(row => row.fact.id === id)?.record)
          .filter((record): record is AdapterConformance => record?.type === 'AdapterConformance');
        ensure(conformance.length === admission.conformance.length && conformance.every(record => activeConformance(record, current.generation, current.clock.value, bindings)), 'conformance references are missing, stale, failed, or conflicted');
        const conformanceRows = admission.conformance.map(id => rows.find(row => row.fact.id === id));
        ensure(conformanceRows.every(row => row && row.conflicts.length === 0 && row.taint.length === 0), 'conformance references are missing, stale, failed, or conflicted');
        const isolation = admission.isolationEvidence.map(id => rows.find(row => row.fact.id === id));
        ensure(isolation.length > 0 && isolation.every(row => row?.record.type === 'HarnessObservation' && row.conflicts.length === 0 && row.taint.length === 0
          && row.record.phase !== 'uncertain' && row.record.observedAt + row.record.freshFor >= current.clock.value), 'isolation evidence is missing, stale, uncertain, or conflicted');
        const custody = admission.custodyEvidence.map(id => rows.find(row => row.fact.id === id));
        ensure(custody.length > 0 && custody.every(row => row?.record.type === 'StorageAccessObservation' && row.conflicts.length === 0 && row.taint.length === 0
          && row.record.result === 'allowed'), 'custody evidence is missing, refused, uncertain, or conflicted');
        const probes = admission.probeEvidence.map(id => take(history.lookup(id)));
        ensure(probes.every(row => row?.fact.kind === 'verification-ProbeRecord' && row.conflicts.length === 0
          && row.taint.length === 0 && row.completeness === 'complete'), 'probe evidence is missing, unavailable, or conflicted');
        return freeze(admission);
      });
    },
  });
}
