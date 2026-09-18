import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { bootProductionInstallation } from '../../src/assembly/production-boot.js';
import type { ProductionBootHost } from '../../src/assembly/production-boot.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { productionSwitchOnPosture, requiredMinimalDependencies } from '../../src/operator/index.js';
import type { MinimalDependency } from '../../src/operator/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
// @ts-expect-error Ten physical host is JavaScript outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-refusals-'))); roots.push(root);
  const context = { ...f.ctx.decode, site: f.c.site, preserved: f.c.preserved };
  const secret = (name: string) => ({ type: 'SecretRef', schemaVersion: 1, vault: 'vault', name });
  const record = { type: 'ProductionInstallation', schemaVersion: 1, id: 'host',
    generation: context.register.generation.id, botDeclaration: 'phone-surface', providerRoute: 'route',
    machineIdentity: 'machine-a', storageRoot: root, botCredential: secret('bot'),
    providerCredential: secret('provider'), storageCredential: secret('storage') };
  const admitted = Object.fromEntries(requiredMinimalDependencies.map(name => [name, name !== 'replication-peer'])) as Record<MinimalDependency, boolean>;
  let compositions = 0, resolutions = 0;
  const host: ProductionBootHost = { context, storageIO: productionStorageIO, storagePolicy: 'policy:installation',
    store: 'store:installation', repairOwner: 'operator', resolveSecret: reference => {
      resolutions++; return reference.name === 'storage' ? '11'.repeat(32) : 'synthetic-test-only';
    }, dependencies: () => admitted,
    compose: () => { compositions++; throw new Error('refusal must precede network-capable owner composition'); } };
  return { f, root, context, host, record, admitted, compositions: () => compositions, resolutions: () => resolutions };
}
it('U4-C production switch-on refuses to serve and names replication-peer without composing network adapters', () => {
  const f = fixture();
  refused(bootProductionInstallation(f.record, f.host), 'missing binding replication-peer');
  expect(f.compositions()).toBe(0); expect(f.resolutions()).toBe(3);
  // A refused boot relinquishes its root, so a later repair can retry admission.
  const disk = value(openProductionStorage({ root: f.root, machine: f.record.machineIdentity,
    key: Buffer.from('11'.repeat(32), 'hex'), policy: f.host.storagePolicy, store: f.host.store,
    context: f.context, io: productionStorageIO }));
  disk.close();
});
it('U4-F production switch-on names both missing real bindings without changing the pinned dependency roster', () => {
  const f = fixture();
  const detail = refused(bootProductionInstallation(f.record, f.host));
  expect(detail).toContain('replication-peer');
  expect(detail).toContain('run-admission');
  expect(f.compositions()).toBe(0);
  f.admitted['replication-peer'] = true;
  refused(bootProductionInstallation(f.record, f.host), 'missing binding run-admission');
  expect(f.compositions()).toBe(0);
});
it.each(['bot', 'provider', 'storage'])('production boot: unresolvable %s SecretRef refuses before composition', name => {
  const f = fixture();
  const detail = refused(bootProductionInstallation(f.record, { ...f.host, resolveSecret: reference => {
    if (reference.name === name) throw Error('synthetic credential-bearing diagnostic');
    return f.host.resolveSecret(reference);
  } }));
  expect(detail).toContain('SecretRef unresolvable'); expect(detail).not.toContain('credential-bearing');
  expect(f.compositions()).toBe(0);
});
it('production boot: stale register refuses before credential resolution', () => {
  const f = fixture();
  refused(bootProductionInstallation({ ...f.record, generation: 'obsolete' }, f.host), 'stale installation generation');
  expect(f.resolutions()).toBe(0); expect(f.compositions()).toBe(0);
});
it('production boot: failed fsync refuses before composition', () => {
  const f = fixture();
  refused(bootProductionInstallation(f.record, { ...f.host,
    storageIO: { ...productionStorageIO, fsyncSync: () => { throw Error('fsync unavailable'); } } }), 'fsync');
  expect(f.compositions()).toBe(0);
});
it('production switch-on lists every unavailable dependency and does not assert input preservation before poll', () => {
  const f = fixture();
  const posture = value(productionSwitchOnPosture({ admitted: { ...f.admitted, clock: false },
    unavailableAdapters: ['model', 'telegram'], repairOwner: 'operator' }, f.context));
  expect(posture).toEqual({ owner: 'part-eleven', serve: false,
    missing: ['clock', 'replication-peer', 'model', 'telegram'], repairOwner: 'operator' });
  expect(posture).not.toHaveProperty('preserved');
});
