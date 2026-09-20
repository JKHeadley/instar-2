import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { loadProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import type { VerifiedProductionBootstrap } from '../../src/assembly/production-installation-loader.js';
import { recordProductionSignerReference, productionSignerReferenceSchemas, registerProductionSignerReferenceBody } from '../../src/assembly/production-signer-reference.js';
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
