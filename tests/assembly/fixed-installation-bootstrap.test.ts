import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { loadProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import type { VerifiedProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import { decodeHistoricalProductionSignerReference, recordProductionSignerReference, productionSignerReferenceSchemas, registerProductionSignerReferenceBody } from '../../src/assembly/production-signer-reference.js';
import { planInstallationImport, importPreparedInstallationPackage } from '../../src/assembly/production-installation-import.js';
import type { InstallationImportPlan } from '../../src/assembly/production-installation-import.js';
import { recordInstallationSelection } from '../../src/assembly/installation-selection.js';
import { fixedRecordFixture } from './fixed-installation-contract.test.js';
import { factsFixture, json, refused, value } from '../facts/fixtures.js';

function signerFixture() {
  let bootstrap!: VerifiedProductionBootstrap;
  const fixture = fixedRecordFixture(({ generation, boundary, fixture: f }) => {
    const signer = { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'machine-signer' };
    const bytes = JSON.stringify({ installation: 'host', machine: 'machine-a', genesisHash: f.context.genesis.hash,
      generation, trustRoots: [f.context.keys[0]!.publicKey], key: f.context.keys[0], signer });
    bootstrap = value(loadProductionBootstrap({ root: '/tmp/installed-root', bootstrapLocator: '/tmp/operator/bootstrap.json',
      expectedBootstrapDigest: hashBytes(bytes) }, { read: locator => f.f.success({ realPath: locator, bytes }) }, boundary));
    const fields = { type: 'ProductionSignerReference', schemaVersion: 1, installation: 'host', machine: 'machine-a',
      signer, keySet: f.context.keys[0]!.id, generation, bootstrapDigest: bootstrap.digest };
    return [json({ ...fields, id: value(canonical(fields)).hash })];
  });
  const admission = { ...fixture.admission, bootstrap };
  Object.assign(fixture.f.context, { schemas: [...fixture.f.context.schemas, ...productionSignerReferenceSchemas(fixture.f.f.scope)],
    ownedBodies: [...fixture.f.context.ownedBodies!, value(registerProductionSignerReferenceBody(admission))] });
  return { ...fixture, bootstrap, writer: { ...fixture.writer, admission } };
}

describe('P10-SI-09 external bootstrap and real signer references', () => {
  it('checks the external digest then appends the exact pre-provisioned signer reference once', () => {
    const f = signerFixture();
    const first = value(recordProductionSignerReference(f.records[0], f.writer));
    const count = f.f.frames.length;
    expect(value(recordProductionSignerReference(f.records[0], f.writer))).toEqual(first);
    expect(f.f.frames.length).toBe(count);
  });
  it('refuses private bytes and changed immutable bootstrap pins before append', () => {
    const f = signerFixture(), count = f.f.frames.length;
    const source = f.records[0] as Record<string, unknown>;
    for (const fields of ([{ ...source, signer: 'private-signing-bytes' }, { ...source, bootstrapDigest: hashBytes('changed') }] as Record<string, unknown>[])) {
      const { id: _id, ...body } = fields;
      refused(recordProductionSignerReference({ ...body, id: value(canonical(body)).hash }, f.writer));
    }
    expect(f.f.frames.length).toBe(count);
  });
  it('refuses caller-created bootstrap identity and root-derived locator', () => {
    const f = signerFixture();
    refused(recordProductionSignerReference(f.records[0], { ...f.writer,
      admission: { ...f.writer.admission, bootstrap: { ...f.bootstrap } as VerifiedProductionBootstrap } }), 'independently verified');
    let reads = 0;
    refused(loadProductionBootstrap({ root: '/tmp/root', bootstrapLocator: '/tmp/root/bootstrap', expectedBootstrapDigest: hashBytes('x') },
      { read: () => { reads++; return f.f.f.success({ realPath: '/tmp/root/bootstrap', bytes: 'x' }); } }, f.admission.boundary), 'outside');
    expect(reads).toBe(0);
  });
  it('checks digest before parsing untrusted bytes and rejects a symlink into the root', () => {
    const f = factsFixture(), context = { ...f.ctx.decode, ...f.c };
    const input = { root: '/tmp/root', bootstrapLocator: '/tmp/operator/bootstrap', expectedBootstrapDigest: hashBytes('approved') };
    refused(loadProductionBootstrap(input, { read: locator => f.success({ realPath: locator, bytes: 'not JSON' }) }, context), 'digest differs');
    refused(loadProductionBootstrap(input, { read: () => f.success({ realPath: '/tmp/root/bootstrap', bytes: 'approved' }) }, context), 'inside');
  });
});

// GRANT M3-E: the signer's historical reuse key covers the selected key entry, its range and genesis.
describe('P10-SI-09 M3-E signer historical reuse is invalidated by key, range and genesis changes', () => {
  it('re-validates when the selected key entry, its range or genesis change at unchanged sizes', () => {
    const f = signerFixture(), origin = value(recordProductionSignerReference(f.records[0], f.writer));
    const facts = { ...f.f.context, facts: f.f.facts() };
    const context = { ...f.admission.boundary, origin, mode: 'historical' as const, facts };
    const admission = f.writer.admission;
    expect(value(decodeHistoricalProductionSignerReference(f.records[0], context, admission))).toMatchObject({ type: 'ProductionSignerReference' });
    const selected = facts.keys[0]!;
    const withKey = (key: typeof selected) => ({ ...context, facts: { ...facts, keys: facts.keys.map((row, i) => i === 0 ? key : row) } });
    // A replaced public key at the same position: Two's key-set history no longer matches the external bootstrap.
    refused(decodeHistoricalProductionSignerReference(f.records[0], withKey({ ...selected, publicKey: facts.keys[1]?.publicKey ?? selected.publicKey }), admission));
    // A moved permitted range: the origin's segment position is no longer covered by the selected key.
    refused(decodeHistoricalProductionSignerReference(f.records[0], withKey({ ...selected, from: { ...selected.from, position: selected.from.position + 1000 } }), admission));
    // A different genesis under the same admission object and sizes: the bootstrap genesis differs.
    refused(decodeHistoricalProductionSignerReference(f.records[0], { ...context, facts: { ...facts, genesis: { ...facts.genesis, hash: hashBytes('other genesis') } } }, admission));
    // Unchanged inputs still reuse the verified record.
    expect(value(decodeHistoricalProductionSignerReference(f.records[0], context, admission))).toMatchObject({ keySet: selected.id });
  });
});

it('REVIEW T1: equal-content unissued bootstrap cannot reuse a warm signer', () => {
  const f = signerFixture(), origin = value(recordProductionSignerReference(f.records[0], f.writer));
  const context = { ...f.admission.boundary, origin, mode: 'historical' as const, facts: { ...f.f.context, facts: f.f.facts() } };
  const admission = f.writer.admission;
  value(decodeHistoricalProductionSignerReference(f.records[0], context, admission));
  Object.assign(admission, { bootstrap: { ...admission.bootstrap } });
  const warm = decodeHistoricalProductionSignerReference(f.records[0], context, admission);
  const cold = decodeHistoricalProductionSignerReference(f.records[0], context, { ...admission });
  refused(cold, 'independently verified');
  expect(warm.kind).toBe(cold.kind);
});

// M3 item 3: both import consumers, using the actual owner-approved package and history.
describe('P10-SI-11/12 read-only import preflight and supervisor hold', () => {
  const rehash = (record: Record<string, unknown>) => {
    const { id: _id, ...fields } = record; return json({ ...fields, id: value(canonical(fields)).hash });
  };
  const setup = () => {
    const f = fixedRecordFixture(({ generation, scopeId }) => ['source-only', 'second-profile'].map(instance => rehash({
      type: 'InstallationSelection', schemaVersion: 1, installation: 'host', machine: 'machine-a', scope: scopeId,
      role: 'minimal-plane-replay', instance, implementation: 'installation-replay', owner: 'part-ten', generation,
      references: ['installation-replay', 'installation-replay-matrix'], validUntil: 'not-time-bound' })));
    const bytes = JSON.stringify({ installation: 'host', machine: 'machine-a', genesisHash: f.f.context.genesis.hash,
      generation: f.record.generation, trustRoots: [f.f.context.keys[0]!.publicKey], key: f.f.context.keys[0],
      signer: { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'machine-signer' } });
    const bootstrap = value(loadProductionBootstrap({ root: '/tmp/root', bootstrapLocator: '/tmp/operator/bootstrap',
      expectedBootstrapDigest: hashBytes(bytes) }, { read: locator => f.f.f.success({ realPath: locator, bytes }) }, f.admission.boundary));
    return { ...f, bootstrap };
  };
  const plan = (f: ReturnType<typeof setup> | ReturnType<typeof signerFixture>, records = f.records,
    overrides: Record<string, unknown> = {}, suppliedBytes?: string) => {
    const bytes = suppliedBytes ?? JSON.stringify({ installation: 'host', scope: f.admission.scopeId, generation: f.record.generation, records });
    return planInstallationImport({ bootstrap: f.bootstrap, root: '/tmp/root', packageLocator: '/tmp/operator/package',
      expectedPackageDigest: hashBytes(bytes), admission: f.admission, facts: { ...f.f.context, facts: f.f.facts() },
      limits: { maxSteps: 8, maxBytes: 100000 }, recoveryOwner: 'operator', ...overrides },
    { read: locator => f.f.f.success({ realPath: locator, bytes }) }, f.admission.boundary);
  };
  it('preflights append, mixed append/reuse and an equal rerun without changing history', () => {
    const f = setup(); let before = value(canonical(f.f.frames)).bytes;
    const first = value(plan(f));
    expect(first.steps.map(step => step.action)).toEqual(['append', 'append']); expect(first.expectedWrites).toBe(2);
    expect(first.steps.every(step => step.validation === 'held-owner-origin-validation')).toBe(true); expect(first.claim).toBe('held');
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
    value(recordInstallationSelection(f.records[0], f.writer)); before = value(canonical(f.f.frames)).bytes;
    const mixed = value(plan(f)); expect(mixed.steps.map(step => step.action)).toEqual(['reuse', 'append']);
    expect(mixed.steps.map(step => step.validation)).toEqual(['owner-history-validated', 'held-owner-origin-validation']);
    expect(mixed.expectedWrites).toBe(1); expect(value(canonical(f.f.frames)).bytes).toBe(before);
    value(recordInstallationSelection(f.records[1], f.writer)); before = value(canonical(f.f.frames)).bytes;
    expect(value(plan(f)).expectedWrites).toBe(0); expect(value(plan(f)).steps.every(step => step.action === 'reuse')).toBe(true);
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
  it('refuses unequal records under one immutable package key before any plan or write', () => {
    const f = setup(), before = value(canonical(f.f.frames)).bytes;
    const changed = rehash({ ...(f.records[0] as Record<string, unknown>), validUntil: value(canonical(f.f.f.now)).bytes });
    refused(plan(f, [f.records[0]!, changed]), 'intra-package immutable key conflict');
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
  it('refuses an immutable conflict against genuine owner history without writing', () => {
    const f = setup(); value(recordInstallationSelection(f.records[0], f.writer));
    const before = value(canonical(f.f.frames)).bytes;
    const changed = rehash({ ...(f.records[0] as Record<string, unknown>), validUntil: value(canonical(f.f.f.now)).bytes });
    refused(plan(f, [changed, f.records[1]!]), 'changed immutable input conflicts');
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
  it.each(['missing-fields', 'wrong-owner', 'missing-implementation', 'missing-references', 'extra-field'])('refuses digest-valid malformed owner body: %s', cut => {
    const f = setup(), before = value(canonical(f.f.frames)).bytes;
    const record = { ...(f.records[0] as Record<string, unknown>) };
    if (cut === 'missing-fields') for (const field of ['role', 'owner', 'instance', 'machine', 'implementation', 'references']) delete record[field];
    if (cut === 'wrong-owner') record.owner = 'part-nine';
    if (cut === 'missing-implementation') record.implementation = '';
    if (cut === 'missing-references') record.references = [];
    if (cut === 'extra-field') record.extra = true;
    refused(plan(f, [rehash(record)])); expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
  it('verifies reuse through the owner history boundary, rejecting a changed signature', () => {
    const f = setup(), origin = value(recordInstallationSelection(f.records[0], f.writer)), before = value(canonical(f.f.frames)).bytes;
    refused(plan(f, f.records, { facts: { ...f.f.context,
      facts: f.f.facts().map(fact => fact.id === origin.id ? { ...fact, signature: '00' } : fact) } }));
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
  it('checks digest before parse and rejects changed external pins and copied bootstrap identity', () => {
    const f = setup(), before = value(canonical(f.f.frames)).bytes;
    refused(plan(f, f.records, { expectedPackageDigest: hashBytes('approved') }, 'not JSON'), 'digest differs');
    refused(plan(f, f.records, { bootstrap: { ...f.bootstrap } }), 'independently verified');
    refused(plan(f, f.records, { facts: { ...f.f.context, facts: f.f.facts(), genesis: { ...f.f.context.genesis, hash: hashBytes('other') } } }));
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
  it('reuses a genuine signer and refuses a changed bootstrap digest before plan issuance', () => {
    const f = signerFixture(); value(recordProductionSignerReference(f.records[0], f.writer));
    const before = value(canonical(f.f.frames)).bytes;
    expect(value(plan(f)).steps[0]).toMatchObject({ action: 'reuse', validation: 'owner-history-validated' });
    refused(plan(f, [rehash({ ...(f.records[0] as Record<string, unknown>), bootstrapDigest: hashBytes('changed pin') })]), 'bootstrap binding differs');
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
  it('refuses issued plans by the named supervisor hold and copied plans by issuance, writing nothing', () => {
    const f = setup(), issued = value(plan(f)), before = value(canonical(f.f.frames)).bytes;
    refused(importPreparedInstallationPackage(issued, { owner: 'part-seven', current: true }, f.admission.boundary),
      'NON-EXECUTABLE-UNTIL-seven-bounded-install-supervisor');
    refused(importPreparedInstallationPackage({ ...issued } as InstallationImportPlan, null, f.admission.boundary), 'not issued');
    expect(value(canonical(f.f.frames)).bytes).toBe(before);
  });
});
