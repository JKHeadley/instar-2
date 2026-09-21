// Inspection-only portion of M3-S-N1. Atomic set admission and strict migration remain held.
// @ts-nocheck -- the installed fixture's intentionally admitted compatibility holds are enumerated by its owner.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { assemblySchemas, createAssemblySpine, decodeAssemblyManifest, inspectOpenedProductionInstallation,
  recordInstallationSelection, registerAssemblyBodies } from '../../src/assembly/index.js';
import { loadProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import { decodeHistoricalProductionSignerReference, decodeProductionSignerReferenceAtOrigin,
  productionSignerReferenceSchemas, recordProductionSignerReference,
  registerProductionSignerReferenceBody } from '../../src/assembly/production-signer-reference.js';
import { createFactStore, factId, hashBytes, registerOwnedBody, signEnvelope } from '../../src/facts/index.js';
import { installedRunGovernanceSchemas, recordInstalledRunGovernanceReference,
  registerInstalledRunGovernanceBody } from '../../src/rungraph/installed-governance.js';
import { json, privateKey, refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { fixedRecordFixture } from './fixed-installation-contract.test.js';
import { productionBindingSet } from './production-fixture.js';
import { installedFixtureHost } from './production-boot-installed-fixture.js';

const roots: string[] = [];
const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
  automaticRetries: 0, environment: 'local-test', invoke: async () => { throw new Error('no provider during inspection'); } };
function openedFixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'opened-installation-inspection-'))); roots.push(root);
  const built = installedFixtureHost(root, route).boot();
  return { built, composition: built.owners.assembly, manifest: 'manifest:production', scope: 'scope:minimal' };
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
  const manifest = (binding = productionBindingSet(scope)) => {
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
