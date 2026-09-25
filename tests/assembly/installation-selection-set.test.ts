// @ts-nocheck -- restored historical inspection callbacks retain their landed compatibility fixtures.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authorizationRequestDigest, canonical } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { installationRoleOwners, installationSelectionSlots, recordInstallationSelectionSet,
  inspectOpenedProductionInstallation, bootProductionAssembly, assemblySchemas, createAssemblySpine,
  decodeAssemblyManifest, recordInstallationSelection, registerAssemblyBodies,
  inspectProductionAssemblyBindings } from '../../src/assembly/index.js';
import { reportInstallationHolds } from '../../src/assembly/production-installation-report.js';
import { createFactStore, factId, hashBytes, prepareSnapshot, registerOwnedBody, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { loadProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import { planInstallationImport } from '../../src/assembly/production-installation-import.js';
import { capacityPolicyArtifact, createTransportAuthority, createTransportSpine, registerTransportBodies,
  transportSchemas } from '../../src/transport/index.js';
import type { CapacityVector, TransportHost } from '../../src/transport/index.js';
import { decodeMeasurement } from '../../src/index.js';
import { json, privateKey } from '../facts/fixtures.js';
import { fixedRecordFixture } from './fixed-installation-contract.test.js';
import { assemblyRuntimeFixture } from './round8-extended-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from './production-fixture.js';
import { intakeFixture } from '../intake/fixtures.js';
import { value, refused } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { decodeHistoricalProductionSignerReference, decodeProductionSignerReferenceAtOrigin,
  productionSignerReferenceSchemas, recordProductionSignerReference,
  registerProductionSignerReferenceBody } from '../../src/assembly/production-signer-reference.js';
import { installedRunGovernanceSchemas, recordInstalledRunGovernanceReference,
  registerInstalledRunGovernanceBody } from '../../src/rungraph/installed-governance.js';
import { installedFixtureHost } from './production-boot-installed-fixture.js';
import { recordedCheckpoint } from './production-boot-checkpoint.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
// @ts-expect-error Existing runtime IO module has no TypeScript declaration.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
  automaticRetries: 0, environment: 'local-test', invoke: async () => { throw new Error('no provider during inspection'); } };
function openedFixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'opened-installation-inspection-'))); roots.push(root);
  const built = installedFixtureHost(root, route).boot();
  built.f.appendReference('transport-FenceToken', { id: 'binding:dependency:fence' });
  const manifest = value(built.f.runtime.record('AssemblyManifest', { ...assemblyInput('AssemblyManifest'),
    id: 'manifest:inspection-held', generation: built.owners.assembly.host.current().generation,
    productionBindings: [productionBindingSet()] }));
  return { built, composition: built.owners.assembly, manifest: manifest.id, scope: 'scope:minimal' };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('P10-SI-16/35 independently landable opened-root inspection', () => {
  it('reports every held binding from the actual root without writes or invented set readiness', () => {
    const f = openedFixture();
    try {
      const before = value(canonical(value(f.composition.spine.store.read()))).bytes;
      const inspected = value(inspectOpenedProductionInstallation(f.composition, f.manifest, f.scope));
      const after = value(canonical(value(f.composition.spine.store.read()))).bytes;
      expect(after).toBe(before);
      expect(inspected).toMatchObject({ type: 'OpenedProductionInstallationInspection', schemaVersion: 1,
        owner: 'part-ten', installation: 'host', scope: f.scope,
        generation: f.composition.host.current().generation, live: false });
      expect(Object.keys(inspected.sourceVector).length).toBeGreaterThan(0);
      expect(inspected.sourceDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(inspected.bindings).toHaveLength(25);
      expect(inspected.unresolved.length).toBeGreaterThan(0);
      expect(inspected.unresolved.map(row => row.name)).toContain('scope-protection');
      expect(inspected.bindings.filter(row => row.reason?.includes('required installation selection set is unavailable')).length)
        .toBeGreaterThan(0);
      expect(inspected.bindings.every(row => row.source.actualReference === null
        || row.source.actualReference.name === 'FactEnvelope')).toBe(true);
      expect(inspected.ownerInputs.scopeProtection).toBeNull();
      expect(inspected.ownerInputs.dependencies).toHaveLength(10);
      expect(inspected.ownerInputs.dependencies.every(row => row.input === null
        || row.input.kind === 'direct-owner')).toBe(true);
      expect(inspected.bindings.find(row => row.name === 'dependency:fence')).toMatchObject({
        owner: 'part-six', state: 'unresolved', input: null,
        reason: 'Six current assignment-derived fence cannot be established from a standalone stored token',
      });
      expect(inspected.unresolved).toEqual([...inspected.bindings, ...inspected.history]
        .filter(row => row.state === 'unresolved'));
    } finally { f.built.application.close(); }
  }, 180000);

  it('refuses a root that changes before the coherent vector is proven', () => {
    const f = openedFixture();
    try {
      const actual = f.composition.spine.store, opened = value(actual.read()); let reads = 0;
      const composition = { ...f.composition, spine: { ...f.composition.spine, store: { ...actual,
        read: () => f.built.f.success(++reads === 1 ? opened : opened.slice(0, -1)) } } };
      refused(inspectOpenedProductionInstallation(composition, f.manifest, f.scope),
        'opened root changed before coherent inspection completed');
    } finally { f.built.application.close(); }
  }, 180000);

  it('refuses an unreadable opened root instead of returning an empty missing list', () => {
    const f = openedFixture();
    try {
      const actual = f.composition.spine.store;
      const composition = { ...f.composition, spine: { ...f.composition.spine, store: { ...actual,
        read: () => { throw new Error('opened root unavailable'); } } } };
      refused(inspectOpenedProductionInstallation(composition, f.manifest, f.scope), 'opened root unavailable');
    } finally { f.built.application.close(); }
  }, 180000);

  it('returns a genuinely owner-decoded singleton scope input while keeping the missing set unresolved', () => {
    const scope = 'scope:minimal';
    const fixed = fixedRecordFixture(({ generation, scopeId }) => {
      const fields = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a',
        scope: scopeId, role: 'scope-protection', instance: 'unprotected-permitted', implementation: 'installation-replay',
        owner: 'part-ten', generation, references: ['installation-artifacts', 'installation-replay'], validUntil: 'not-time-bound' };
      return [{ ...fields, id: value(canonical(fields)).hash }];
    }, { scopeId: scope });
    const selectionFact = value(recordInstallationSelection(fixed.records[0], fixed.writer));
    let context = fixed.writer.context, store, spine;
    const boundary = { ...fixed.admission.boundary, validateReferences: false };
    const host = { machine: 'machine-a', principal: fixed.f.f.alice, scope: fixed.f.f.scope, boundary,
      current: () => ({ facts: context, generation: fixed.record.generation, stopped: false, clock: fixed.f.f.now }) };
    const registrations = value(registerAssemblyBodies(host));
    context = { ...context, schemas: [...context.schemas, ...assemblySchemas(host)],
      ownedBodies: [...context.ownedBodies ?? [], ...registrations] };
    store = createFactStore(context, fixed.f.storage);
    spine = createAssemblySpine(host, { context, privateKey }, store);
    const manifest = value(decodeAssemblyManifest({ ...assemblyInput('AssemblyManifest'), id: 'manifest:inspection-singleton',
      generation: fixed.record.generation, predecessors: [], dependencyFacts: [], productionBindings: [productionBindingSet(scope)] }, boundary));
    value(spine.append(manifest));
    const composition = { host, spine };
    const inspected = value(inspectOpenedProductionInstallation(composition, manifest.id, scope, [{ kind: 'singleton-history',
      fact: { owner: 'part-two', name: 'FactEnvelope', id: selectionFact.id }, admission: fixed.admission }]));
    expect(inspected.ownerInputs.scopeProtection).toMatchObject({ kind: 'singleton-history',
      fact: { id: selectionFact.id }, selection: { role: 'scope-protection', instance: 'unprotected-permitted' } });
    const verdict = inspected.bindings.find(row => row.name === 'scope-protection');
    expect(verdict).toMatchObject({ state: 'unresolved', owner: 'part-ten',
      source: { actualReference: { id: selectionFact.id } } });
    expect(verdict.reason).toContain('diagnostic only');
  }, 180000);
});

function historyInspectionFixture(fixed: ReturnType<typeof fixedRecordFixture>, scope: string,
  additions: Readonly<{ schemas?: readonly unknown[]; bodies?: readonly unknown[] }> = {}) {
  let context = { ...fixed.writer.context,
    schemas: [...fixed.writer.context.schemas, ...additions.schemas ?? []] as typeof fixed.writer.context.schemas,
    ownedBodies: [...fixed.writer.context.ownedBodies ?? [], ...additions.bodies ?? []] as typeof fixed.writer.context.ownedBodies };
  const boundary = { ...fixed.admission.boundary, validateReferences: false };
  const host = { machine: 'machine-a', principal: fixed.f.f.alice, scope: fixed.f.f.scope, boundary,
    current: () => ({ facts: context, generation: fixed.record.generation, stopped: false, clock: fixed.f.f.now }) };
  const registrations = value(registerAssemblyBodies(host));
  context = { ...context, schemas: [...context.schemas, ...assemblySchemas(host)],
    ownedBodies: [...context.ownedBodies ?? [], ...registrations] };
  const store = createFactStore(context, fixed.f.storage);
  const spine = createAssemblySpine(host, { context, privateKey }, store);
  const manifest = (input = productionBindingSet(scope)) => {
    const binding = { ...input, dependencies: input.dependencies.map(row => row.name === 'identity-keys'
      && row.fact.reference !== 'binding:dependency:identity-keys'
      ? { ...row, fact: { ...row.fact, expectedKind: 'assembly-ProductionSignerReference' } } : row) };
    const decoded = value(decodeAssemblyManifest({ ...assemblyInput('AssemblyManifest'), id: `manifest:history:${scope}`,
      generation: fixed.record.generation, predecessors: [], dependencyFacts: [], productionBindings: [binding] }, boundary));
    value(spine.append(decoded)); return decoded;
  };
  return { context, host, store, spine, manifest };
}

function replicatedEnvelope(store: ReturnType<typeof createFactStore>, first: ReturnType<typeof signEnvelope>, record: unknown) {
  const prior = value(store.read()).at(-1)!;
  const segment = { ...prior.segment, position: prior.segment.position + 1 };
  const second = signEnvelope({ ...first, id: factId(segment), segment, prevInSegment: prior.contentHash,
    predecessors: { ...first.predecessors, inSegment: prior.id }, body: { record: json(record) } }, privateKey);
  value(store.append(second, { peer: 'machine-a' })); return second;
}

function inspectWithoutWrites(setup: ReturnType<typeof historyInspectionFixture>, manifest: { id: string }, scope: string,
  historicalInputs: readonly unknown[]) {
  const before = value(canonical(value(setup.store.read()))).bytes;
  const report = value(inspectOpenedProductionInstallation({ host: setup.host, spine: setup.spine }, manifest.id, scope,
    historicalInputs));
  expect(value(canonical(value(setup.store.read()))).bytes).toBe(before);
  expect(report.unresolved).toEqual([...report.bindings, ...report.history].filter(row => row.state === 'unresolved'));
  return report;
}

const historicalReference = (fact: { id: string }) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id: fact.id });

describe('P10-SI-16/35 historical immutable conflict inspection', () => {
  it('reports unequal same-key singleton history and withholds the conflicted scope-protection input', () => {
    const scope = 'scope:minimal';
    const fixed = fixedRecordFixture(({ generation, scopeId, fixture }) => {
      const base = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a',
        scope: scopeId, role: 'scope-protection', instance: 'protected', implementation: 'installation-replay',
        owner: 'part-ten', generation, references: ['installation-artifacts', 'installation-replay'] };
      return ['not-time-bound', value(canonical(fixture.f.now)).bytes].map(validUntil => {
        const fields = { ...base, validUntil }; return json({ ...fields, id: value(canonical(fields)).hash });
      });
    }, { scopeId: scope });
    const setup = historyInspectionFixture(fixed, scope);
    const first = value(recordInstallationSelection(fixed.records[0], { ...fixed.writer, context: setup.context, store: setup.store }));
    const second = replicatedEnvelope(setup.store, first, fixed.records[1]);
    const manifest = setup.manifest();
    const report = inspectWithoutWrites(setup, manifest, scope, [first, second].map(fact => ({ kind: 'singleton-history',
      fact: historicalReference(fact), admission: fixed.admission })));
    const history = report.history.filter(row => row.source.expectedKind === 'assembly-InstallationSelection');
    expect(history).toHaveLength(2);
    expect(history.every(row => row.state === 'unresolved' && row.reason?.includes('historical immutable conflict'))).toBe(true);
    expect(history.map(row => row.source.actualReference?.id).sort()).toEqual([first.id, second.id].sort());
    expect(report.unresolved).toEqual(expect.arrayContaining(history));
    expect(report.ownerInputs.scopeProtection).toBeNull();
    expect(report.ownerInputs.historical.every(input => ![first.id, second.id].includes(input.fact.id))).toBe(true);
    expect(report.bindings.find(row => row.name === 'scope-protection')).toMatchObject({ state: 'unresolved', input: null,
      reason: expect.stringContaining('historical immutable conflict'), source: { actualReference: expect.objectContaining({ id: first.id }) } });
  }, 180000);

  it('reports unequal same-key signer history and withholds the conflicted identity dependency input', () => {
    const scope = 'scope:minimal'; let bootstraps: readonly ReturnType<typeof value>[] = [];
    const fixed = fixedRecordFixture(({ generation, boundary, fixture }) => {
      const make = (name: string) => {
        const signer = { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name };
        const bytes = JSON.stringify({ installation: 'host', machine: 'machine-a', genesisHash: fixture.context.genesis.hash,
          generation, trustRoots: [fixture.context.keys[0]!.publicKey], key: fixture.context.keys[0], signer });
        const bootstrap = value(loadProductionBootstrap({ root: '/tmp/installed-root',
          bootstrapLocator: `/tmp/operator/${name}.json`, expectedBootstrapDigest: hashBytes(bytes) },
        { read: locator => fixture.f.success({ realPath: locator, bytes }) }, boundary));
        const fields = { type: 'ProductionSignerReference', schemaVersion: 1, installation: 'host', machine: 'machine-a',
          signer, keySet: fixture.context.keys[0]!.id, generation, bootstrapDigest: bootstrap.digest };
        return { bootstrap, record: json({ ...fields, id: value(canonical(fields)).hash }) };
      };
      const made = [make('machine-signer-a'), make('machine-signer-b')]; bootstraps = made.map(row => row.bootstrap);
      return made.map(row => row.record);
    }, { scopeId: scope });
    const firstAdmission = { ...fixed.admission, bootstrap: bootstraps[0] };
    const secondAdmission = { ...fixed.admission, bootstrap: bootstraps[1] };
    const firstSetup = historyInspectionFixture(fixed, scope, {
      schemas: productionSignerReferenceSchemas(fixed.f.f.scope),
      bodies: [value(registerProductionSignerReferenceBody(firstAdmission))],
    });
    const first = value(recordProductionSignerReference(fixed.records[0],
      { ...fixed.writer, admission: firstAdmission, context: firstSetup.context, store: firstSetup.store }));
    const text = { kind: 'text', maxLength: 4096 } as const;
    const signerRegistration = value(registerOwnedBody({ name: 'ProductionSignerReference', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {}, decodeCurrent: (input, context) => {
        let detail = 'signer reference refused';
        for (const admission of [firstAdmission, secondAdmission]) {
          const decoded = (context.mode === 'origin' ? decodeProductionSignerReferenceAtOrigin
            : decodeHistoricalProductionSignerReference)(input, context, admission);
          if (decoded.kind === 'Success') return { ok: true, value: decoded.value };
          detail = decoded.detail;
        }
        return { ok: false, detail };
      } }, { kind: 'object', fields: { type: text, schemaVersion: { kind: 'integer' }, id: text, installation: text,
        machine: text, signer: { kind: 'object', fields: { type: text, schemaVersion: { kind: 'integer' }, vault: text, name: text } },
        keySet: text, generation: text, bootstrapDigest: text } }, fixed.admission.boundary));
    const setup = historyInspectionFixture(fixed, scope, {
      schemas: productionSignerReferenceSchemas(fixed.f.f.scope),
      bodies: [signerRegistration],
    });
    const second = replicatedEnvelope(setup.store, first, fixed.records[1]);
    const base = productionBindingSet(scope);
    const binding = { ...base, dependencies: base.dependencies.map(row => row.name === 'identity-keys'
      ? { ...row, fact: { ...row.fact, reference: first.id } } : row) };
    const manifest = setup.manifest(binding);
    const report = inspectWithoutWrites(setup, manifest, scope, [
      { kind: 'signer-history', fact: historicalReference(first), admission: firstAdmission },
      { kind: 'signer-history', fact: historicalReference(second), admission: secondAdmission },
    ]);
    const history = report.history.filter(row => row.source.expectedKind === 'assembly-ProductionSignerReference');
    expect(history).toHaveLength(2);
    expect(history.every(row => row.state === 'unresolved' && row.reason?.includes('historical immutable conflict'))).toBe(true);
    expect(history.map(row => row.source.actualReference?.id).sort()).toEqual([first.id, second.id].sort());
    expect(report.unresolved).toEqual(expect.arrayContaining(history));
    expect(report.ownerInputs.dependencies.find(row => row.name === 'identity-keys')?.input).toBeNull();
    expect(report.ownerInputs.historical.every(input => ![first.id, second.id].includes(input.fact.id))).toBe(true);
    expect(report.bindings.find(row => row.name === 'dependency:identity-keys')).toMatchObject({ state: 'unresolved', input: null,
      reason: expect.stringContaining('historical immutable conflict'), source: { actualReference: { id: first.id } } });
  }, 180000);

  it('reports unequal same-key governance history and withholds both owner inputs', () => {
    const scope = 'scope:minimal';
    const fixed = fixedRecordFixture(({ generation, scopeId }) => [10, 11].map(threshold => {
      const fields = { type: 'InstalledRunGovernanceReference', schemaVersion: 1, installation: 'host', scope: scopeId, generation,
        contract: 'rungraph.contract', feature: 'rungraph-core', bound: 'rungraph.bound', capture: 'part-two:run-input',
        gates: [['rungraph.admit', 'decodeRun'], ['rungraph.exit', 'decodeRunExit'], ['rungraph.grounding', 'decodeSessionGrounding'],
          ['rungraph.step', 'decodeRunStep'], ['rungraph.stop', 'decodeRunTransition'], ['rungraph.transition', 'decodeRunTransition']]
          .map(([id, decoder]) => ({ id, decoder })),
        groundingPolicy: { entry: 'rungraph.bound', threshold, maxAge: 50, briefingClasses: ['message'] } };
      return json({ ...fields, id: value(canonical(fields)).hash });
    }), { scopeId: scope });
    const setup = historyInspectionFixture(fixed, scope, {
      schemas: installedRunGovernanceSchemas(fixed.f.f.scope),
      bodies: [value(registerInstalledRunGovernanceBody(fixed.admission))],
    });
    const first = value(recordInstalledRunGovernanceReference(fixed.records[0],
      { ...fixed.writer, context: setup.context, store: setup.store }));
    const second = replicatedEnvelope(setup.store, first, fixed.records[1]);
    const manifest = setup.manifest();
    const report = inspectWithoutWrites(setup, manifest, scope, [first, second].map(fact => ({ kind: 'governance-history',
      fact: historicalReference(fact), admission: fixed.admission })));
    const history = report.history.filter(row => row.source.expectedKind === 'rungraph-installed-governance-reference');
    expect(history).toHaveLength(2);
    expect(history.every(row => row.state === 'unresolved' && row.reason?.includes('historical immutable conflict'))).toBe(true);
    expect(history.map(row => row.source.actualReference?.id).sort()).toEqual([first.id, second.id].sort());
    expect(report.unresolved).toEqual(expect.arrayContaining(history));
    expect(report.ownerInputs.historical.every(input => ![first.id, second.id].includes(input.fact.id))).toBe(true);
  }, 180000);

  it('keeps equal-canonical same-key history available across distinct envelopes', () => {
    const scope = 'scope:minimal';
    const fixed = fixedRecordFixture(({ generation, scopeId }) => {
      const fields = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a',
        scope: scopeId, role: 'scope-protection', instance: 'protected', implementation: 'installation-replay',
        owner: 'part-ten', generation, references: ['installation-artifacts', 'installation-replay'], validUntil: 'not-time-bound' };
      return [json({ ...fields, id: value(canonical(fields)).hash })];
    }, { scopeId: scope });
    const setup = historyInspectionFixture(fixed, scope);
    const first = value(recordInstallationSelection(fixed.records[0], { ...fixed.writer, context: setup.context, store: setup.store }));
    const second = replicatedEnvelope(setup.store, first, fixed.records[0]);
    const manifest = setup.manifest();
    const report = inspectWithoutWrites(setup, manifest, scope, [first, second].map(fact => ({ kind: 'singleton-history',
      fact: historicalReference(fact), admission: fixed.admission })));
    const history = report.history.filter(row => row.source.expectedKind === 'assembly-InstallationSelection');
    expect(history).toHaveLength(2);
    expect(history.every(row => row.state === 'resolved' && row.reason === null)).toBe(true);
    expect(history.some(row => row.reason?.includes('historical immutable conflict'))).toBe(false);
    expect(report.ownerInputs.historical.filter(input => [first.id, second.id].includes(input.fact.id))).toHaveLength(2);
    expect(report.ownerInputs.scopeProtection).toMatchObject({ kind: 'singleton-history', selection: { instance: 'protected' } });
  }, 180000);

  it('withholds competing protected and unprotected-permitted scope history in both input orders', () => {
    const scope = 'scope:minimal';
    const fixed = fixedRecordFixture(({ generation, scopeId }) => ['protected', 'unprotected-permitted'].map(instance => {
      const fields = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a',
        scope: scopeId, role: 'scope-protection', instance, implementation: 'installation-replay',
        owner: 'part-ten', generation, references: ['installation-artifacts', 'installation-replay'], validUntil: 'not-time-bound' };
      return json({ ...fields, id: value(canonical(fields)).hash });
    }), { scopeId: scope });
    const setup = historyInspectionFixture(fixed, scope);
    const protectedFact = value(recordInstallationSelection(fixed.records[0],
      { ...fixed.writer, context: setup.context, store: setup.store }));
    const permittedFact = value(recordInstallationSelection(fixed.records[1],
      { ...fixed.writer, context: setup.context, store: setup.store }));
    const manifest = setup.manifest();
    for (const facts of [[protectedFact, permittedFact], [permittedFact, protectedFact]]) {
      const report = inspectWithoutWrites(setup, manifest, scope, facts.map(fact => ({ kind: 'singleton-history',
        fact: historicalReference(fact), admission: fixed.admission })));
      const history = report.history.filter(row => row.source.expectedKind === 'assembly-InstallationSelection');
      expect(history).toHaveLength(2);
      expect(history.every(row => row.state === 'resolved' && row.reason === null)).toBe(true);
      expect(history.map(row => row.source.actualReference?.id).sort()).toEqual([protectedFact.id, permittedFact.id].sort());
      expect(report.ownerInputs.historical.filter(input => [protectedFact.id, permittedFact.id].includes(input.fact.id))).toHaveLength(2);
      expect(report.ownerInputs.scopeProtection).toBeNull();
      const verdict = report.bindings.find(row => row.name === 'scope-protection');
      expect(verdict).toMatchObject({ state: 'unresolved', input: null,
        reason: expect.stringContaining('scope-protection ambiguity'), source: { actualReference: null } });
      expect(verdict?.reason).toContain(protectedFact.id);
      expect(verdict?.reason).toContain(permittedFact.id);
      expect(report.unresolved).toContain(verdict);
    }
  }, 180000);

  it('keeps a missing original admission context as an explicit unavailable historical hold', () => {
    const scope = 'scope:minimal';
    const fixed = fixedRecordFixture(({ generation, scopeId }) => {
      const fields = { type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a',
        scope: scopeId, role: 'scope-protection', instance: 'protected', implementation: 'installation-replay',
        owner: 'part-ten', generation, references: ['installation-artifacts', 'installation-replay'], validUntil: 'not-time-bound' };
      return [json({ ...fields, id: value(canonical(fields)).hash })];
    }, { scopeId: scope });
    const setup = historyInspectionFixture(fixed, scope);
    const fact = value(recordInstallationSelection(fixed.records[0], { ...fixed.writer, context: setup.context, store: setup.store }));
    const manifest = setup.manifest();
    const report = inspectWithoutWrites(setup, manifest, scope, []);
    const history = report.history.find(row => row.source.actualReference?.id === fact.id);
    expect(history).toMatchObject({ state: 'unresolved', reason: 'historical-installation-admission-context', input: null,
      source: { actualReference: { id: fact.id } } });
    expect(report.unresolved).toContain(history);
    expect(report.ownerInputs.scopeProtection).toBeNull();
    expect(report.bindings.find(row => row.name === 'scope-protection')).toMatchObject({ state: 'unresolved', input: null,
      reason: expect.stringContaining('historical-installation-admission-context'), source: { actualReference: { id: fact.id } } });
  }, 180000);
});

const digest = (input: unknown) => value(canonical(input)).hash;
function setFixture(change?: (rows: Record<string, unknown>[]) => Record<string, unknown>[]) {
  const fixture = fixedRecordFixture(({ generation, scopeId }) => {
    const fields = installationSelectionSlots
      .filter(([role, instance]) => role !== 'fact-segment' || instance !== 'fact-replication-receipt')
      .map(([role, instance]) => ({ type: 'InstallationSelection' as const, schemaVersion: 1 as const,
        installation: 'host', machine: 'machine-a', scope: scopeId, role,
        instance, implementation: 'installation-replay', owner: installationRoleOwners[role as keyof typeof installationRoleOwners],
        generation, references: ['installation-replay', 'installation-replay-matrix'],
        validUntil: 'not-time-bound' }));
    fields.push({ ...fields[0]!, role: 'scope-protection', instance: 'protected', owner: 'part-ten' });
    const rows = (change?.(fields.map(field => ({ ...field, id: digest(field) })))
      ?? fields.map(field => ({ ...field, id: digest(field) })))
      .sort((a, b) => String(a.role) < String(b.role) ? -1 : String(a.role) > String(b.role) ? 1
        : String(a.instance) < String(b.instance) ? -1 : String(a.instance) > String(b.instance) ? 1 : 0);
    const setFields = { type: 'InstallationSelectionSet' as const, schemaVersion: 1 as const,
      installation: 'host', machine: 'machine-a', scope: scopeId, generation, rows };
    return [JSON.parse(JSON.stringify({ ...setFields, id: digest(setFields) })) as Json];
  });
  return { ...fixture, set: fixture.records[0]! };
}

function genuineSetFixture(ownerFixture?: ReturnType<typeof intakeFixture>, includePeer = false,
  finiteHorizon?: number) {
  let capacityFact = '';
  let conversationFact = '';
  let capacityAuthority: ReturnType<typeof createTransportAuthority> | undefined;
  let capacityFence: ReturnType<ReturnType<typeof createTransportAuthority>['acquire']> | undefined;
  const owners: Record<string, string> = { 'part-two': 'facts', 'part-four': 'intake', 'part-five': 'rungraph',
    'part-six': 'transport', 'part-nine': 'verification', 'part-ten': 'assembly',
    'part-eleven': 'operator', 'part-twelve': 'conversation' };
  const sourceIds = new Map<string, string>();
  const production = finiteHorizon === undefined ? null : productionBindingSet('project-a');
  const strictImplementation = (role: string, instance: string): string | null => {
    if (!production) return null;
    switch (role) {
      case 'operator-surface': return production.surface.adapter.implementation;
      case 'challenge-verifier': return production.surface.challengeVerifier.implementation;
      case 'verified-act-intake': return production.verifiedActIntake.implementation;
      case 'minimal-plane-fold': return production.minimalPlane.folds.find(row => row.projection === instance)!.implementation;
      case 'minimal-plane-replay': return production.minimalPlane.sourceOnlyReplay.implementation;
      case 'minimal-responder': return production.minimalResponder.implementation;
      case 'prerequisite-cut': return production.lifecycle.cut.implementation;
      case 'prerequisite-recovery': return production.lifecycle.recovery.implementation;
      case 'delivery-witness': return production.deliveryWitness.implementation;
      case 'fact-segment': return instance === 'fact-local-durable-segment' ? 'local-facts' : 'replication-peer';
      case 'verification-clock': return 'clock';
      case 'conversation-route': return 'route';
      case 'delivery-evidence-service': return 'delivery-evidence';
      default: return null;
    }
  };
  const name = (owner: string, purpose: string) => {
    const id = `fixture:${owner}:${purpose}`;
    sourceIds.set(id, owner);
    return id;
  };
  const references = (role: string, instance: string): string[] => {
    const owner = installationRoleOwners[role as keyof typeof installationRoleOwners];
    const first = strictImplementation(role, instance) ?? name(owner, `${role}:${instance}`);
    sourceIds.set(first, owner);
    switch (role) {
      case 'challenge-verifier': return [first, name('part-nine', 'trust'), name('part-nine', 'administration')];
      case 'minimal-plane-fold': return [first, name('part-two', `fold:${instance}`)];
      case 'minimal-plane-replay': return [first, name('part-ten', 'replay-matrix')];
      case 'minimal-responder': return [first, name('part-five', 'minimal-run-policy'), capacityFact];
      case 'conversation-route': return [first, name('part-twelve', 'route-identity'), conversationFact];
      case 'delivery-witness': case 'delivery-evidence-service': return [first, name('part-twelve', 'delivery-stage')];
      case 'scope-protection': return [first, 'installation-artifacts'];
      case 'operator-surface': case 'verified-act-intake': return [first];
      default: return [first, name(owner, `${role}:${instance}:support`)];
    }
  };
  // Prepare the closed declaration roster before Three generates the fixture register.
  for (const [role, instance] of installationSelectionSlots)
    if (includePeer || role !== 'fact-segment' || instance !== 'fact-replication-receipt') references(role, instance);
  references('scope-protection', 'protected');
  const x = fixedRecordFixture(({ generation, scopeId, fixture }) => {
    const validUntil = finiteHorizon === undefined ? 'not-time-bound'
      : value(canonical(value(decodeMeasurement('clock',
        { ...fixture.f.now, value: finiteHorizon, at: finiteHorizon }, fixture.context.decode)))).bytes;
    const fields = installationSelectionSlots
      .filter(([role, instance]) => includePeer || role !== 'fact-segment' || instance !== 'fact-replication-receipt')
      .map(([role, instance]) => {
        const refs = references(role, instance).sort();
        return { type: 'InstallationSelection' as const, schemaVersion: 1 as const,
          installation: 'host', machine: 'machine-a', scope: scopeId, role, instance,
          implementation: strictImplementation(role, instance)
            ?? `fixture:${installationRoleOwners[role as keyof typeof installationRoleOwners]}:${role}:${instance}`,
          owner: installationRoleOwners[role as keyof typeof installationRoleOwners], generation, references: refs,
          validUntil };
      });
    const protectionRefs = references('scope-protection', 'protected').sort();
    fields.push({ type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a',
      scope: scopeId, role: 'scope-protection', instance: 'protected',
      implementation: 'fixture:part-ten:scope-protection:protected', owner: 'part-ten',
      generation, references: protectionRefs, validUntil });
    const rows = fields.map(field => ({ ...field, id: digest(field) })).sort((a, b) =>
      a.role < b.role ? -1 : a.role > b.role ? 1 : a.instance < b.instance ? -1 : a.instance > b.instance ? 1 : 0);
    const setFields = { type: 'InstallationSelectionSet', schemaVersion: 1, installation: 'host',
      machine: 'machine-a', scope: scopeId, generation, rows };
    return [{ ...setFields, id: digest(setFields) } as Json];
  }, {
    ...(ownerFixture ? { fixture: ownerFixture } : {}),
    extraSources: f => [...sourceIds.entries()].map(([id, owner]) => ({
      declaration: f.r.declaration(id), path: `src/${owners[owner]}/fixture.ts`, symbol: id })),
    beforePackage: ({ fixture: f, store, boundary, generation }) => {
      conversationFact = f.facts().find(fact => fact.kind === 'conversation-binding')!.id;
      const grant = f.facts().find(fact => fact.kind === 'genesis-grant')!.id;
      const amount = (quantity: number) => ({ quantity, unit: 'charge', window: 'installation' });
      const vector = (quantity: number): CapacityVector => ({ worker: amount(quantity), memory: amount(quantity),
        storage: amount(quantity), queue: amount(quantity), transport: amount(quantity), effect: amount(quantity) });
      const clock = (instant: number) => value(decodeMeasurement('clock',
        { ...f.f.now, value: instant, at: instant }, f.context.decode));
      const fields = { owner: 'part-ten' as const, installation: 'host', machine: 'machine-a',
        scope: 'project-a', generation, ordinaryDomain: 'conversation:fixture',
        responderDomain: 'responder:fixture', grant, parent: vector(100), required: vector(20),
        validUntil: clock(450) };
      const artifact = capacityPolicyArtifact(fields);
      f.f.capture(value(canonical(fields)).bytes, artifact); f.syncCaptures();
      const requestDigest = authorizationRequestDigest({ approver: f.f.alice,
        action: { kind: 'work', scope: f.f.scope }, artifact, base: 'host' });
      Object.assign(f.context, { decode: { ...f.context.decode, currentBase: 'host', artifact } });
      const earlierGrants = [...f.context.grants];
      const act = f.verifiedAct({ request: { requestId: 'request:capacity-policy', artifact, base: 'host', requestDigest },
        generation: { owner: 'part-three', name: 'RegisterGeneration', id: generation } });
      const approval = value(f.port().admitVerifiedAct(act.input)).fact.id;
      Object.assign(f.context, { grants: [...earlierGrants, ...f.context.grants] });
      const policy = { ...fields, reference: artifact, approval };
      const host: TransportHost = { domain: policy.ordinaryDomain, machine: 'machine-a',
        incarnation: 'worker:fixture', authorityIncarnation: 'authority:fixture', principal: f.f.alice,
        scope: f.f.scope, maxLeaseTerm: 500, budget: 100, capacityPolicy: policy,
        monotonic: () => f.f.now.value, current: () => ({ decode: f.context.decode, clock: f.f.now,
          generation: { owner: 'part-three', name: 'RegisterGeneration', id: generation }, stopped: false }) };
      Object.assign(f.context, { schemas: [...f.context.schemas, ...transportSchemas(host)],
        ownedBodies: [...f.context.ownedBodies!, ...value(registerTransportBodies(host, boundary))] });
      const spine = createTransportSpine(host, { context: f.context, privateKey }, store);
      const authority = createTransportAuthority(host, spine, boundary);
      const fence = value(authority.acquire('capacity:lease', '', 450));
      capacityAuthority = authority;
      capacityFence = fence;
      const expected = value(authority.inspect()).at(-1)!.fact.id;
      value(authority.reserveCapacity({ command: 'capacity:reserve', expected, fence,
        installation: 'host', scope: 'project-a', instance: 'minimal-responder-binding',
        approval, grant, allocation: policy.required, validUntil: clock(400) }));
      capacityFact = value(authority.inspectCapacity()).heads[0]!.fact;
    },
  });
  return { ...x, set: x.records[0]!, capacityAuthority: capacityAuthority!, capacityFence: capacityFence! };
}

function finiteStrictFixture() {
  const runtime = assemblyRuntimeFixture();
  const x = genuineSetFixture(runtime.ownerFixture!, false, 105);
  const set = value(recordInstallationSelectionSet(x.set, x.writer));
  runtime.setGeneration(x.f.context.decode.register.generation.id);
  Object.assign(runtime.c, { ...x.f.context, history: runtime.c.history, validateReferences: true });
  const selected = (row: { fact: object }) => ({ ...row,
    fact: { reference: set.id, expectedKind: 'assembly-InstallationSelectionSet', required: true } });
  const base = productionBindingSet('project-a');
  const binding = { ...base,
    surface: { adapter: selected(base.surface.adapter), challengeVerifier: selected(base.surface.challengeVerifier) },
    verifiedActIntake: selected(base.verifiedActIntake),
    minimalPlane: { folds: base.minimalPlane.folds.map(selected), sourceOnlyReplay: selected(base.minimalPlane.sourceOnlyReplay) },
    minimalResponder: selected(base.minimalResponder),
    dependencies: base.dependencies.map(row => ['local-facts', 'clock', 'route', 'delivery-evidence'].includes(row.name)
      ? { ...row, fact: { reference: set.id, expectedKind: 'assembly-InstallationSelectionSet', required: true } } : row),
    lifecycle: { cut: selected(base.lifecycle.cut), recovery: selected(base.lifecycle.recovery) },
    deliveryWitness: selected(base.deliveryWitness) };
  const manifest = value(decodeAssemblyManifest({ ...assemblyInput('AssemblyManifest'),
    id: 'manifest:finite-set', generation: runtime.host.current().generation,
    productionBindings: [binding] }, { ...runtime.c, validateReferences: false }));
  value(runtime.spine.append(manifest));
  const inspect = () => inspectProductionAssemblyBindings(runtime.composition, manifest.id, binding.scope);
  return { x, runtime, set, inspect, manifest, binding };
}

describe('P10-SI-32/33 atomic selection set closed wire', () => {
  it('admits the signed finite set before expiry, then refuses its row at current use', () => {
    const f = finiteStrictFixture();
    f.runtime.time(104);
    refused(f.inspect(), 'dependency:register');
    f.runtime.time(105);
    refused(f.inspect(), 'required production set row expired: surface-adapter');
    f.runtime.time(106);
    refused(f.inspect(), 'required production set row expired: surface-adapter');
    expect(value(f.x.writer.store.read()).some(row => row.id === f.set.id)).toBe(true);
  });
  it('refuses an incomparable current owner clock for a signed finite row', () => {
    const f = finiteStrictFixture();
    const composition = { ...f.runtime.composition, host: { ...f.runtime.host,
      current: () => ({ ...f.runtime.host.current(), clock: { ...f.runtime.host.current().clock,
        subject: { kind: 'clock', instance: 'other-clock' } } }) } };
    refused(inspectProductionAssemblyBindings(composition, f.manifest.id, f.binding.scope),
      'required production set row clock is incomparable: surface-adapter');
  });
  it('does not let a genuine Six capacity rebind renew an expired selection row', () => {
    const f = finiteStrictFixture();
    const prior = value(f.x.capacityAuthority.inspectCapacity()).heads[0]!;
    // Move both the assembly clock and Six's fixture clock past the row horizon (105)
    // BEFORE the rebind, so the rebind genuinely happens after expiry.
    f.runtime.time(106);
    f.x.f.f.now = value(decodeMeasurement('clock', { ...f.x.f.f.now, value: 106, at: 106 }, f.x.f.context.decode));
    refused(f.inspect(), 'required production set row expired: surface-adapter');
    value(f.x.capacityAuthority.rebindCapacity({ command: 'capacity:finite-row-successor',
      previousCapacity: prior.fact, fence: f.x.capacityFence,
      validUntil: value(decodeMeasurement('clock', { ...f.x.f.f.now, value: 400, at: 400 },
        f.x.f.context.decode)) }));
    const current = value(f.x.capacityAuthority.inspectCapacity());
    expect(current.heads[0]).toMatchObject({ capacity: prior.capacity, usable: true, blocker: null });
    expect(current.parentRemainder.effect.quantity).toBe(80);
    refused(f.inspect(), 'required production set row expired: surface-adapter');
  });
  it('appends and reuses one genuine 19-row local set with a Four-approved Six allocation', () => {
    const x = genuineSetFixture();
    const fact = value(recordInstallationSelectionSet(x.set, x.writer));
    expect(fact.kind).toBe('assembly-InstallationSelectionSet');
    expect(value(recordInstallationSelectionSet(x.set, x.writer))).toEqual(fact);
  });
  it('prepares the same genuine set on an existing assembly consumer store', () => {
    const runtime = assemblyRuntimeFixture();
    const x = genuineSetFixture(runtime.ownerFixture!);
    const fact = value(recordInstallationSelectionSet(x.set, x.writer));
    expect(value(runtime.store.read()).some(row => row.id === fact.id)).toBe(true);
  });
  it('reports a set row as prepared while retaining the owner evidence hold', () => {
    const x = genuineSetFixture();
    const fact = value(recordInstallationSelectionSet(x.set, x.writer));
    const history = { ...x.f.context, facts: x.f.facts() };
    const snapshot = value(prepareSnapshot(history.facts, history));
    const vector: Record<string, { epoch: number; position: number }> = {};
    for (const entry of snapshot.entries) {
      const prior = vector[entry.fact.machine], point = entry.fact.segment;
      if (!prior || point.epoch > prior.epoch || point.epoch === prior.epoch && point.position > prior.position)
        vector[entry.fact.machine] = { epoch: point.epoch, position: point.position };
    }
    const report = value(reportInstallationHolds({ installation: 'host', scope: 'project-a',
      generation: x.f.context.decode.register.generation.id,
      vector: digest(vector), verdicts: [{ hold: 'operator-surface-registration', owner: 'part-eleven',
        subject: 'operator-surface-registration', prepared: fact.id }],
      facts: { owner: 'part-ten', lookup: () => null, history, admission: x.admission } }, x.admission.boundary));
    expect(report.rows.find(row => row.hold === 'operator-surface-registration')).toMatchObject({
      state: 'prepared', prepared: fact.id, evidence: null });
    expect(report.live).toBe(false);
  });
  it('plans full-set append then exact owner-validated reuse without writing', () => {
    const x = genuineSetFixture();
    const generation = x.f.context.decode.register.generation.id;
    const bootstrapBytes = JSON.stringify({ installation: 'host', machine: 'machine-a',
      genesisHash: x.f.context.genesis.hash, generation,
      trustRoots: [x.f.context.keys[0]!.publicKey], key: x.f.context.keys[0],
      signer: { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'machine-signer' } });
    const bootstrap = value(loadProductionBootstrap({ root: '/tmp/set-root',
      bootstrapLocator: '/tmp/set-operator/bootstrap.json', expectedBootstrapDigest: hashBytes(bootstrapBytes) },
    { read: locator => x.f.f.success({ realPath: locator, bytes: bootstrapBytes }) }, x.admission.boundary));
    const packageBytes = JSON.stringify({ installation: 'host', scope: x.admission.scopeId,
      generation, records: x.records });
    const plan = () => planInstallationImport({ bootstrap, root: '/tmp/set-root',
      packageLocator: '/tmp/set-operator/package.json', expectedPackageDigest: hashBytes(packageBytes),
      facts: { ...x.f.context, facts: x.f.facts() }, admission: x.admission,
      limits: { maxSteps: 4, maxBytes: 100000 }, recoveryOwner: 'operator' },
    { read: locator => x.f.f.success({ realPath: locator, bytes: packageBytes }) }, x.admission.boundary);
    const count = x.f.frames.length;
    expect(value(plan()).steps[0]).toMatchObject({ type: 'InstallationSelectionSet', action: 'append',
      validation: 'held-owner-origin-validation' });
    expect(x.f.frames).toHaveLength(count);
    const fact = value(recordInstallationSelectionSet(x.set, x.writer));
    const after = x.f.frames.length;
    expect(value(plan()).steps[0]).toMatchObject({ type: 'InstallationSelectionSet', action: 'reuse',
      existing: fact.id, validation: 'owner-history-validated' });
    expect(x.f.frames).toHaveLength(after);
  });
  it('inspects exact set rows and protection from one opened root without writing', () => {
    const runtime = assemblyRuntimeFixture();
    const installed = installProduction(runtime);
    const before = value(runtime.store.read()).length;
    const report = value(inspectOpenedProductionInstallation(runtime.composition,
      installed.manifest.id, installed.binding.scope));
    const surface = report.bindings.find(row => row.name === 'surface-adapter');
    expect(surface?.state).toBe('resolved');
    expect(surface?.input?.kind).toBe('set-row');
    expect(surface?.input?.kind === 'set-row' && surface.input.address.role).toBe('operator-surface');
    expect(report.bindings.find(row => row.name === 'scope-protection')?.state).toBe('resolved');
    expect(value(runtime.store.read())).toHaveLength(before);
  });
  it('commits the exact 20-row peer-backed roster without contacting a peer machine', () => {
    const x = genuineSetFixture(undefined, true);
    const set = x.set as { rows: readonly unknown[] };
    expect(set.rows).toHaveLength(20);
    expect(value(recordInstallationSelectionSet(x.set, x.writer)).kind).toBe('assembly-InstallationSelectionSet');
  });
  it('does not turn a 19-row roster and absent peer into a peer-backed boot handle', () => {
    const runtime = assemblyRuntimeFixture();
    const binding = productionBindingSet();
    const installed = installProduction(runtime, binding);
    const production = productionComposition(runtime, binding, { peerReceipt: () => false });
    refused(bootProductionAssembly({ ...runtime.composition, production },
      installed.manifest.id, installed.binding.scope));
  }, 60000);
  it('admits the installed 20-row set with the receiver-backed exact peer source', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'installed-peer-set-')));
    const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not execute during boot'); } });
    let built: ReturnType<typeof fixture.boot> | undefined;
    try {
      built = fixture.boot();
      const source = value(built.f.store.read()) as FactEnvelope[];
      const set = source.find(row => row.kind === 'assembly-InstallationSelectionSet')!;
      expect((set.body as { record: { rows: readonly unknown[] } }).record.rows).toHaveLength(20);
      expect(built.application.boot.posture.serve).toBe(true);
      expect((built.application.boot.coordinator.references as readonly { name: string; fact: { id: string } }[])
        .some(row => row.name === 'dependency:replication-peer'
        && row.fact.id === set.id)).toBe(true);
      const receiver = value(openProductionStorage({ root: join(root, 'fixture-peer'), machine: 'm_cc2ec651a91f',
        key: Buffer.alloc(32, 23), policy: 'offline-fixture-receiver', store: 'store:fixture-laptop',
        context: built.f.c, io: productionStorageIO }));
      try {
        expect((receiver.segment.read() as readonly FactEnvelope[])
          .some(row => row.id === set.id && row.contentHash === set.contentHash)).toBe(true);
      } finally { receiver.close(); }
    } finally { built?.application.close(); rmSync(root, { recursive: true, force: true }); }
  }, 180000);
  it('refuses wrong peer, absent source, missing capture and disconnected current peer evidence', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'installed-peer-refusal-')));
    try {
      const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route' });
      const peer = fixture.peer;
      expect(peer.current(peer.setFactId)).toBe(true);
      expect(peer.current('wrong-source')).toBe(false);
      peer.channelPeer('wrong-peer');
      expect(() => peer.current(peer.setFactId)).toThrow();
      peer.channelPeer('m_cc2ec651a91f');
      const captures = peer.captures as Record<string, (typeof peer.captures)[string]>;
      const saved = Object.entries(captures);
      for (const [reference, capture] of saved) captures[reference] = { ...capture, bytes: null, status: 'missing' };
      try { expect(() => peer.current(peer.setFactId)).toThrow(); }
      finally { for (const [reference, capture] of saved) captures[reference] = capture; }
      peer.disconnect();
      expect(() => peer.current(peer.setFactId)).toThrow();
      peer.reconnect();
      expect(peer.current(peer.setFactId)).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 180000);
  it('refuses stale or incomplete receiver receipts after a later local source append', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'installed-peer-stale-')));
    const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not execute'); } });
    let built: ReturnType<typeof fixture.boot> | undefined;
    try {
      built = fixture.boot();
      await new Promise<void>(resolve => setImmediate(resolve));
      const peer = fixture.peer;
      expect(peer.current(peer.setFactId)).toBe(true);
      await new Promise<void>(resolve => setImmediate(resolve));
      built.f.appendReference('check-run-record', { id: 'later-peer-prefix' });
      peer.replayLastResponse(true);
      expect(() => peer.current(peer.setFactId)).toThrow();
      peer.replayLastResponse(false);
      await new Promise<void>(resolve => setImmediate(resolve));
      peer.incompleteResponse(true);
      expect(() => peer.current(peer.setFactId)).toThrow();
      peer.incompleteResponse(false);
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(peer.current(peer.setFactId)).toBe(true);
    } finally { built?.application.close(); rmSync(root, { recursive: true, force: true }); }
  }, 180000);
  it('holds the next effect durability use after peer loss while retaining admitted input', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'installed-peer-loss-')));
    const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not execute'); } });
    let built: ReturnType<typeof fixture.boot> | undefined;
    try {
      built = fixture.boot();
      built.receive(built.application);
      const source = value(built.f.store.read()) as FactEnvelope[];
      const input = source.find(row => row.kind === 'intake-admitted')!;
      const effects = source.filter(row => row.kind === 'effect-OperationObservation' || row.kind === 'effect-EffectSettlement');
      fixture.peer.disconnect();
      refused(built.f.effects.composition.durability.ensure(source));
      const after = value(built.f.store.read()) as FactEnvelope[];
      expect(after.find(row => row.id === input.id)).toEqual(input);
      expect(after.filter(row => row.kind === 'effect-OperationObservation' || row.kind === 'effect-EffectSettlement'))
        .toEqual(effects);
    } finally { built?.application.close(); rmSync(root, { recursive: true, force: true }); }
  }, 180000);
  it('restarts from the original signed set, Run and Six capacity debit after reconciliation', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'installed-peer-restart-')));
    const route = { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not execute'); } };
    let first: ReturnType<ReturnType<typeof installedFixtureHost>['boot']> | undefined;
    let second: typeof first;
    try {
      const installed = installedFixtureHost(root, route);
      first = installed.boot();
      await new Promise<void>(resolve => setImmediate(resolve));
      first.receive(first.application);
      await new Promise<void>(resolve => setImmediate(resolve));
      value(first.application.owners.run.open(first.f.run));
      await new Promise<void>(resolve => setImmediate(resolve));
      const original = value(first.f.store.read()) as FactEnvelope[];
      const set = original.find(row => row.kind === 'assembly-InstallationSelectionSet')!;
      const opening = original.find(row => row.kind === 'run-opening')!;
      const before = value(first.f.effects.transport.inspectCapacity()) as { history: { fact: { id: string }; record: unknown }[];
        parentRemainder: unknown };
      const checkpoint = recordedCheckpoint(first, 'peer-reconciliation');
      first.application.close(); first = undefined;
      const restarted = installedFixtureHost(root, route, { recovery: checkpoint });
      second = restarted.boot();
      await new Promise<void>(resolve => setImmediate(resolve));
      const restored = value(second.f.store.read()) as FactEnvelope[];
      const after = value(second.f.effects.transport.inspectCapacity()) as typeof before;
      expect(restored.find(row => row.kind === 'assembly-InstallationSelectionSet')).toEqual(set);
      expect(restored.find(row => row.kind === 'run-opening')).toEqual(opening);
      expect(restored.filter(row => row.kind === 'transport-CapacityReservation').map(row => row.id))
        .toEqual(original.filter(row => row.kind === 'transport-CapacityReservation').map(row => row.id));
      expect(after.history.map(row => [row.fact.id, row.record])).toEqual(before.history.map(row => [row.fact.id, row.record]));
      expect(after.parentRemainder).toEqual(before.parentRemainder);
      expect((value(second.application.owners.run.read(second.f.id)) as { state: string }).state).toBe('ready');
      expect(restarted.peer.current(set.id)).toBe(true);
    } finally { first?.application.close(); second?.application.close(); rmSync(root, { recursive: true, force: true }); }
  }, 180000);
  it('reuses the exact signed set after an append with a lost acknowledgment', () => {
    const x = genuineSetFixture();
    const initial = x.f.frames.length;
    const lost = { ...x.writer, store: { ...x.writer.store, append: (...args: Parameters<typeof x.writer.store.append>) => {
      value(x.writer.store.append(...args));
      return x.f.f.success(undefined as never);
    } } };
    refused(recordInstallationSelectionSet(x.set, lost));
    expect(x.f.frames.length).toBe(initial + 1);
    const recovered = value(recordInstallationSelectionSet(x.set, x.writer));
    expect(recovered.kind).toBe('assembly-InstallationSelectionSet');
    expect(x.f.frames.length).toBe(initial + 1);
  });
  it('retains two distinct Four-approved fixture acts in one target history for policy then package', () => {
    const x = fixedRecordFixture();
    const artifact = digest({ policy: 'capacity:fixture', limit: 100 });
    x.f.f.capture(value(canonical({ policy: 'capacity:fixture', limit: 100 })).bytes, artifact);
    x.f.syncCaptures();
    const requestDigest = authorizationRequestDigest({ approver: x.f.f.alice,
      action: { kind: 'work', scope: x.f.f.scope }, artifact, base: 'host' });
    Object.assign(x.f.context, { decode: { ...x.f.context.decode, currentBase: 'host', artifact } });
    const act = x.f.verifiedAct({ request: { requestId: 'request:capacity-policy', artifact, base: 'host', requestDigest },
      generation: { owner: 'part-three', name: 'RegisterGeneration', id: x.f.context.decode.register.generation.id } });
    const second = value(x.f.port().admitVerifiedAct(act.input));
    expect(x.f.facts().find(fact => fact.id === second.fact.id)?.kind).toBe('intake-verified-act');
    expect(second.fact.id).not.toBe(x.admission.approvalFact);
  });
  it('refuses a missing applicable slot before any append', () => {
    const x = setFixture(rows => rows.filter(row => row.instance !== 'minimal.guard-repair'));
    const count = x.f.frames.length;
    refused(recordInstallationSelectionSet(x.set, x.writer), 'exact applicable roster');
    expect(x.f.frames).toHaveLength(count);
  });
  it('refuses duplicate slot, wrong owner and changed row digest as one set', () => {
    for (const change of [
      (rows: Record<string, unknown>[]) => [...rows.slice(0, -1), rows[0]!],
      (rows: Record<string, unknown>[]) => rows.map((row, i) => i === 0 ? { ...row, owner: 'part-ten' } : row),
      (rows: Record<string, unknown>[]) => rows.map((row, i) => i === 0 ? { ...row, instance: 'altered' } : row),
    ]) {
      const x = setFixture(change), count = x.f.frames.length;
      refused(recordInstallationSelectionSet(x.set, x.writer));
      expect(x.f.frames).toHaveLength(count);
    }
  });
});
