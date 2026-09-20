import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { loadProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import type { VerifiedProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import { decodeHistoricalProductionSignerReference, recordProductionSignerReference, productionSignerReferenceSchemas, registerProductionSignerReferenceBody } from '../../src/assembly/production-signer-reference.js';
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
