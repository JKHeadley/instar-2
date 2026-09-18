import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { decodeProductionInstallation, isProductionInstallation } from '../../src/assembly/production-installation.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function directory() { const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-boot-'))); roots.push(root); return root; }
function storageInput(root = directory()) {
  const f = factsFixture();
  return { root, machine: 'machine-a', key: new Uint8Array(32).fill(17), policy: 'policy:installation',
    store: 'facts:installation', context: f.c };
}
function installation() {
  const f = factsFixture(), context = { ...f.ctx.decode, site: f.c.site, preserved: f.c.preserved };
  const secret = { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'test-only' };
  const record = { type: 'ProductionInstallation', schemaVersion: 1, id: 'host',
    generation: context.register.generation.id, botDeclaration: 'phone-surface', providerRoute: 'route',
    machineIdentity: 'machine-a', storageRoot: directory(), botCredential: secret,
    providerCredential: secret, storageCredential: secret };
  return { context, record };
}

it('production boot installation: owner decodes registered bindings into a deeply immutable record', () => {
  const { context, record } = installation(), decoded = value(decodeProductionInstallation(record, context));
  expect(isProductionInstallation(decoded)).toBe(true);
  expect(isProductionInstallation({ ...decoded })).toBe(false);
  expect(Object.isFrozen(decoded)).toBe(true); expect(Object.isFrozen(decoded.botCredential)).toBe(true);
  record.botDeclaration = 'changed'; expect(decoded.botDeclaration).toBe('phone-surface');
});
it.each(['generation', 'providerRoute', 'botDeclaration', 'machineIdentity', 'storageRoot'] as const)(
  'production boot installation: refuses invalid %s', field => {
    const { context, record } = installation();
    refused(decodeProductionInstallation({ ...record, [field]: 'invalid' }, context));
  });
it('production boot installation: extra settings and raw or missing credentials never become configuration', () => {
  const { context, record } = installation();
  refused(decodeProductionInstallation({ ...record, override: true }, context), 'closed immutable record');
  refused(decodeProductionInstallation({ ...record, providerCredential: 'raw-secret' }, context));
  const { botCredential: _omitted, ...missing } = record;
  refused(decodeProductionInstallation(missing, context), 'closed immutable record');
});

it('production boot storage: fsynced encrypted segment and exact receipts recover after a fresh custodian', () => {
  const input = storageInput(), first = value(openProductionStorage(input));
  const wire = value(canonical({ contentHash: 'first-head', privatePayload: 'private message' })).bytes;
  expect(value(first.segment.append(wire, null))).toEqual({ kind: 'local-durable' });
  const request = { bytes: wire, bytesDigest: hashBytes(wire), segment: input.store,
    position: 'position:0', expectedPhysicalHead: null, policy: input.policy };
  const receipt = value(first.persistence.appendExact(request));
  first.close();
  expect(readFileSync(join(input.root, 'facts.encrypted'), 'utf8')).not.toContain('private message');
  const restarted = value(openProductionStorage(input));
  expect(restarted.segment.read()).toEqual([JSON.parse(wire)]);
  expect(value(restarted.persistence.appendExact(request))).toEqual(receipt);
  expect(value(restarted.persistence.flushEvidence(JSON.parse(value(canonical(receipt)).bytes)))).toEqual(receipt);
  expect(value(restarted.persistence.readExact({ store: input.store, positions: [request.position],
    access: 'registered:read', maxBytes: 4096 }))).toEqual([wire]);
  refused(restarted.segment.append(wire, null), 'compare-head');
  refused(restarted.persistence.appendExact({ ...request, bytes: 'different', bytesDigest: hashBytes('different') }), 'immutable position');
  restarted.close();
});
it('production boot storage: a second concurrent boot refuses the exact root lease', () => {
  const input = storageInput(), first = value(openProductionStorage(input));
  refused(openProductionStorage(input), 'second concurrent boot'); first.close();
  value(openProductionStorage(input)).close();
});
it('production boot storage: an unwritable root refuses before admission', () => {
  const input = storageInput(); chmodSync(input.root, 0o500);
  refused(openProductionStorage(input), 'not writable'); chmodSync(input.root, 0o700);
});
it('production boot storage: tampered encrypted source refuses on recovery without returning a store', () => {
  const input = storageInput(), store = value(openProductionStorage(input));
  value(store.segment.append('{"contentHash":"one"}', null)); store.close();
  const path = join(input.root, 'facts.encrypted'), corrupt = JSON.parse(readFileSync(path, 'utf8'));
  corrupt.tag = '00'.repeat(16); writeFileSync(path, JSON.stringify(corrupt));
  refused(openProductionStorage(input));
});
