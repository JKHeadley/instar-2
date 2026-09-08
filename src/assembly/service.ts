import { boundary, ensure, freeze, take } from './boundary.js';
import { assemblyIdentity, assemblyLogicalKey, assemblyRecordFrom, assemblyRows, compareAssemblyRecords, decodeAssemblyRecord } from './records.js';
import { currentAssemblyRows, resolveAssemblyHistory } from './history.js';
import type { AdapterConformance, AssemblyAdmission, AssemblyComposition, AssemblyManifest, AssemblyRecord, AssemblyRecordName, AssemblyRuntimePort } from './contracts.js';

function activeConformance(record: AdapterConformance, generation: string): boolean {
  return record.disposition === 'passed' && record.generation === generation && record.stageChecks.length > 0;
}

export function createAssemblyRuntime(composition: AssemblyComposition): AssemblyRuntimePort {
  const { host, spine } = composition;
  const inspect = () => boundary('AssemblyInspect', null, host.boundary, () => assemblyRows(take(spine.store.read()), host.boundary));
  const inspectCurrent = () => boundary('AssemblyCurrentInspect', null, host.boundary, () => currentAssemblyRows(take(spine.store.readForProjection()), host.boundary));
  return Object.freeze({ owner: 'part-ten' as const,
    record<N extends AssemblyRecordName>(name: N, input: unknown) {
      return boundary('AssemblyRecord', input, host.boundary, () => {
        ensure(!host.current().stopped || name === 'HarnessObservation' || name === 'StorageAccessObservation' || name === 'GrowthObservation' || name === 'AssemblyAdmission', 'stop inhibits new assembly work');
        const candidate = take(decodeAssemblyRecord(name, input, host.boundary));
        const existing = take(inspect()).find(row => row.record.type === name &&
          (row.record.id === candidate.id || assemblyLogicalKey(row.record) === assemblyLogicalKey(candidate)));
        if (existing) { const compared = take(compareAssemblyRecords(name, existing.record, candidate, host.boundary));
          ensure(compared.equal, compared.conflict?.detail ?? 'assembly identity conflict'); return existing.record as Extract<AssemblyRecord, { type: N }>; }
        take(spine.append(candidate)); return candidate;
      });
    },
    inspect, inspectCurrent,
    resolve(record: AssemblyRecord) { return resolveAssemblyHistory(record, spine, host.boundary); },
    admit(manifestId: string, scope: string) {
      return boundary('AssemblyAdmissionConsumption', { manifestId, scope }, host.boundary, () => {
        const current = host.current(); ensure(!current.stopped, 'stopped assembly cannot activate scope');
        const rows = take(inspectCurrent());
        const manifests = rows.filter((row): row is typeof row & { record: AssemblyManifest } => row.record.type === 'AssemblyManifest' && row.record.id === manifestId);
        ensure(manifests.length === 1, 'manifest missing or ambiguous in signed history'); const manifestRow = manifests[0]!;
        const manifestVerdict = take(resolveAssemblyHistory(manifestRow.record, spine, host.boundary));
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
          && row.record.manifest === manifestId && row.record.scope === scope && row.record.machine === host.machine && row.record.disposition === 'active');
        ensure(admissions.length === 1, 'active admission missing or ambiguous'); const admission = admissions[0]!.record;
        ensure(admission.manifestDigest === manifestRow.record.manifestDigest && admission.sourceGeneration === current.generation, 'admission self-report differs from actual manifest/generation');
        const verdict = take(resolveAssemblyHistory(admission, spine, host.boundary));
        ensure(verdict.admitted, verdict.conflicts[0]?.detail ?? `admission dependency missing: ${verdict.missing[0] ?? 'unknown'}`);
        const conformance = admission.conformance.map(id => rows.find(row => row.fact.id === id)?.record)
          .filter((record): record is AdapterConformance => record?.type === 'AdapterConformance');
        ensure(conformance.length === admission.conformance.length && conformance.every(record => activeConformance(record, current.generation)), 'conformance references are missing, stale, failed, or conflicted');
        return freeze(admission);
      });
    },
  });
}
