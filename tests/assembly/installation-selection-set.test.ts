import { describe, expect, it } from 'vitest';
import { authorizationRequestDigest, canonical } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { installationRoleOwners, installationSelectionSlots, recordInstallationSelectionSet,
  inspectOpenedProductionInstallation } from '../../src/assembly/index.js';
import { reportInstallationHolds } from '../../src/assembly/production-installation-report.js';
import { hashBytes, prepareSnapshot } from '../../src/facts/index.js';
import { loadProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import { planInstallationImport } from '../../src/assembly/production-installation-import.js';
import { capacityPolicyArtifact, createTransportAuthority, createTransportSpine, registerTransportBodies,
  transportSchemas } from '../../src/transport/index.js';
import type { CapacityVector, TransportHost } from '../../src/transport/index.js';
import { decodeMeasurement } from '../../src/index.js';
import { privateKey } from '../facts/fixtures.js';
import { fixedRecordFixture } from './fixed-installation-contract.test.js';
import { assemblyRuntimeFixture } from './round8-extended-fixture.js';
import { installProduction } from './production-fixture.js';
import { intakeFixture } from '../intake/fixtures.js';
import { value, refused } from '../facts/fixtures.js';

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

function genuineSetFixture(ownerFixture?: ReturnType<typeof intakeFixture>, includePeer = false) {
  let capacityFact = '';
  let conversationFact = '';
  const owners: Record<string, string> = { 'part-two': 'facts', 'part-four': 'intake', 'part-five': 'rungraph',
    'part-six': 'transport', 'part-nine': 'verification', 'part-ten': 'assembly',
    'part-eleven': 'operator', 'part-twelve': 'conversation' };
  const sourceIds = new Map<string, string>();
  const name = (owner: string, purpose: string) => {
    const id = `fixture:${owner}:${purpose}`;
    sourceIds.set(id, owner);
    return id;
  };
  const references = (role: string, instance: string): string[] => {
    const owner = installationRoleOwners[role as keyof typeof installationRoleOwners];
    const first = name(owner, `${role}:${instance}`);
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
  const x = fixedRecordFixture(({ generation, scopeId }) => {
    const fields = installationSelectionSlots
      .filter(([role, instance]) => includePeer || role !== 'fact-segment' || instance !== 'fact-replication-receipt')
      .map(([role, instance]) => {
        const refs = references(role, instance).sort();
        return { type: 'InstallationSelection' as const, schemaVersion: 1 as const,
          installation: 'host', machine: 'machine-a', scope: scopeId, role, instance,
          implementation: `fixture:${installationRoleOwners[role as keyof typeof installationRoleOwners]}:${role}:${instance}`,
          owner: installationRoleOwners[role as keyof typeof installationRoleOwners], generation, references: refs,
          validUntil: 'not-time-bound' };
      });
    const protectionRefs = references('scope-protection', 'protected').sort();
    fields.push({ type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a',
      scope: scopeId, role: 'scope-protection', instance: 'protected',
      implementation: 'fixture:part-ten:scope-protection:protected', owner: 'part-ten',
      generation, references: protectionRefs, validUntil: 'not-time-bound' });
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
      const expected = value(authority.inspect()).at(-1)!.fact.id;
      value(authority.reserveCapacity({ command: 'capacity:reserve', expected, fence,
        installation: 'host', scope: 'project-a', instance: 'minimal-responder-binding',
        approval, grant, allocation: policy.required, validUntil: clock(400) }));
      capacityFact = value(authority.inspectCapacity()).heads[0]!.fact;
    },
  });
  return { ...x, set: x.records[0]! };
}

describe('P10-SI-32/33 atomic selection set closed wire', () => {
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
