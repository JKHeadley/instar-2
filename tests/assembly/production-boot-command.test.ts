import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { factsFixture } from '../facts/fixtures.js';
import { requiredMinimalDependencies } from '../../src/operator/index.js';

it('installed executable refuses both U4 activation holds even when a host advertises fixture bindings', () => {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'production-command-')));
  try {
    const context = { ...f.ctx.decode, site: f.c.site, preserved: f.c.preserved };
    const secret = (name: string) => ({ type: 'SecretRef', schemaVersion: 1, vault: 'vault', name });
    const record = { type: 'ProductionInstallation', schemaVersion: 1, id: 'host',
      generation: context.register.generation.id, botDeclaration: 'phone-surface', providerRoute: 'route',
      machineIdentity: 'machine-a', storageRoot: root, botCredential: secret('bot'),
      providerCredential: secret('provider'), storageCredential: secret('storage') };
    const source = pathToFileURL(join(process.cwd(), 'scripts/production-boot-io.mjs')).href;
    const host = `import { productionStorageIO } from ${JSON.stringify(source)};
export function createProductionHost() { return {
  context: ${JSON.stringify(context)}, storageIO: productionStorageIO,
  storagePolicy: 'policy', store: 'store', repairOwner: 'operator',
  resolveSecret: ref => ref.name === 'storage' ? '11'.repeat(32) : 'synthetic-test-credential',
  dependencies: () => (${JSON.stringify(Object.fromEntries(requiredMinimalDependencies.map(name => [name, true])))}),
  runAdmission: { owner: 'part-six', create(){}, commit(){}, verify(){}, execution(){}, reservation(){} },
  configure() { throw Error('NETWORK-CAPABLE-CONFIGURATION-MUST-NOT-RUN'); }
}; }
`;
    const configuration = join(root, 'installation.json'), module = join(root, 'host.mjs');
    writeFileSync(configuration, JSON.stringify(record)); writeFileSync(module, host);
    const child = spawnSync(process.execPath, ['bin/instar-production.mjs', configuration, module],
      { encoding: 'utf8', timeout: 30000 });
    expect(child.status).toBe(1);
    expect(child.stderr).toContain('missing binding replication-peer, run-admission');
    expect(child.stderr).not.toContain('synthetic-test-credential');
    expect(child.stderr).not.toContain('NETWORK-CAPABLE');
    expect(child.stdout).toBe('');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
