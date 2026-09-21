// Inspection-only portion of M3-S-N1. Atomic set admission and strict migration remain held.
// @ts-nocheck -- the installed fixture's intentionally admitted compatibility holds are enumerated by its owner.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { assemblySchemas, createAssemblySpine, decodeAssemblyManifest, inspectOpenedProductionInstallation,
  recordInstallationSelection, registerAssemblyBodies } from '../../src/assembly/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { privateKey, refused, value } from '../facts/fixtures.js';
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
