import { chmodSync, chownSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { CustodyConformanceFixture } from './conformance.js';
import { signedMaterial } from './material.js';
// @ts-expect-error Physical host adapter stays outside the pure core.
import { linuxCustodyPlatform } from '../../../scripts/custody-platform/linux.mjs';

export async function linuxFixture(): Promise<CustodyConformanceFixture> {
  if (process.platform !== 'linux' || process.getuid?.() !== 0) throw Error('real Linux root fixture required');
  const root = mkdtempSync('/tmp/instar-custody-conformance-'); chmodSync(root, 0o755);
  const suffix = randomBytes(5).toString('hex');
  const names = { broker: `icb${suffix}`, agent: `ica${suffix}`, harness: `ich${suffix}` };
  const created: string[] = [];
  const run = (exe: string, args: string[]) => {
    const result = spawnSync(exe, args, { encoding: 'utf8', timeout: 5000 });
    if (result.error || result.status !== 0) throw Error(`fixture setup failed: ${exe}`);
    return result.stdout.trim();
  };
  const ids = new Map<string, { uid: number; gid: number }>();
  const base = join(root, 'installation');
  const signed = signedMaterial();
  const trustAnchorPath = join(root, 'release-anchor.pem');
  writeFileSync(trustAnchorPath, signed.anchor, { mode: 0o444, flag: 'wx' });
  const platform = linuxCustodyPlatform({ base, ...names, trustAnchorPath, node: '/usr/bin/node' });
  const cleanup = async () => {
    await platform.stop();
    const failed = [];
    for (const name of created.reverse()) {
      const result = spawnSync('/usr/sbin/userdel', [name], { encoding: 'utf8', timeout: 5000 });
      if (result.status !== 0) failed.push(name);
    }
    rmSync(root, { recursive: true, force: true });
    if (failed.length) throw Error(`test-user cleanup failed: ${failed.join(', ')}`);
  };
  try {
    for (const name of Object.values(names)) {
      run('/usr/sbin/useradd', ['--system', '--user-group', '--no-create-home', '--home-dir', '/nonexistent', '--shell', '/usr/sbin/nologin', name]);
      created.push(name);
      const uid = Number(run('/usr/bin/id', ['-u', name])), gid = Number(run('/usr/bin/id', ['-g', name]));
      ids.set(name, { uid, gid });
      const scratch = join(root, name); mkdirSync(scratch, { mode: 0o700 }); chownSync(scratch, uid, gid);
    }
    return {
      install(variant = 'valid') {
        const material = variant === 'signature' ? { ...signed.material, signature: Buffer.alloc(64) }
          : variant === 'content' ? { ...signed.material, files: { ...signed.material.files, 'entry.mjs': Buffer.from('tampered') } }
          : variant === 'untrusted' ? signedMaterial().material : signed.material;
        const result = platform.install(material);
        const canary = join(base, 'private/key-canary');
        writeFileSync(canary, 'PUBLIC_TEST_CANARY', { mode: 0o600, flag: 'wx' });
        const broker = ids.get(names.broker)!; chownSync(canary, broker.uid, broker.gid);
        return result;
      },
      verify: platform.verify, start: () => platform.start(), request: request => platform.request(request),
      status: platform.status, stop: platform.stop,
      probe(identity, operation) {
        const { uid, gid } = ids.get(names[identity])!;
        const source = operation === 'read-key' ? `fs.readFileSync(${JSON.stringify(join(base, 'private/key-canary'))})`
          : operation === 'write-entry' ? `fs.openSync(${JSON.stringify(join(base, 'release/entry.mjs'))}, 'w')`
          : operation === 'replace-entry' ? `const source=${JSON.stringify(join(root, names[identity], 'replacement'))}; fs.writeFileSync(source,'replacement'); fs.renameSync(source,${JSON.stringify(join(base, 'release/entry.mjs'))})`
          : operation === 'elevate' ? `process.setuid(${ids.get(names.broker)!.uid})`
          : `fs.openSync(${JSON.stringify(join(base, 'broker.service'))}, 'w')`;
        const result = spawnSync('/usr/bin/setpriv', ['--reuid', String(uid), '--regid', String(gid), '--clear-groups',
          '/usr/bin/node', '-e', `const fs=require('node:fs');try{${source};console.log('opened')}catch(e){console.log(e.code==='EACCES'||e.code==='EPERM'?'kernel-denied':'unexpected:'+e.code)}`],
        { encoding: 'utf8', timeout: 5000, env: { PATH: '/usr/bin:/bin' } });
        if (result.error || result.status !== 0) throw Error('identity probe did not execute');
        const reason = result.stdout.trim();
        return { allowed: reason === 'opened', reason };
      },
      tamper() { const path = join(base, 'release/entry.mjs'); chmodSync(path, 0o644); writeFileSync(path, '// tampered'); },
      cleanup,
    };
  } catch (error) { await cleanup(); throw error; }
}
