import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { signedMaterial } from './custody/material.js';
import { custodyConformance } from './custody/conformance.js';
import { linuxFixture } from './custody/linux-fixture.js';
// @ts-expect-error Host distribution verifier is outside the pure core.
import { verifyDistribution } from '../../scripts/custody-platform/distribution.mjs';
// @ts-expect-error Host lifecycle adapter is outside the pure core.
import { linuxCustodyPlatform, requestSocket, systemdUnit, brokerProcessObservation } from '../../scripts/custody-platform/linux.mjs';
// @ts-expect-error OS-neutral lifecycle adapter is outside the pure core.
import { custodyPlatform } from '../../scripts/custody-platform/interface.mjs';
// @ts-expect-error macOS host adapter stays outside the pure core.
import { macosCustodyPlatform } from '../../scripts/custody-platform/macos.mjs';

const rootProbe = process.platform === 'linux' && process.getuid?.() === 0;
const requested = process.env.INSTAR_CUSTODY_ROOT_TEST === '1';
const noRoot = !rootProbe ? 'requires root with useradd, chown, setgroups and setuid; this process has no such authority'
  : !requested ? 'set INSTAR_CUSTODY_ROOT_TEST=1 to create temporary system identities' : undefined;
custodyConformance('Linux real identity conformance', linuxFixture, noRoot);
// Laptop sibling supplies its existing custody lifecycle, wrapped in macosCustodyPlatform.
// The exact same behavioral assertions run; neither a harness probe nor a mock certifies it.
const macFixture = process.env.INSTAR_CUSTODY_MACOS_FIXTURE;
custodyConformance('macOS real identity conformance', async () => {
  const module = await import(pathToFileURL(macFixture!).href) as { createFixture: typeof linuxFixture };
  return module.createFixture();
}, process.platform !== 'darwin' ? 'to run on macOS' : !macFixture ? 'Laptop must supply INSTAR_CUSTODY_MACOS_FIXTURE' : undefined);

const signed = signedMaterial();
describe('OS-neutral distribution verification', () => {
  it('accepts independently signed bytes and snapshots the verified material', () => {
    const checked = verifyDistribution(signed.material, signed.anchor, 'linux');
    expect(checked.files.get('entry.mjs')).toEqual(signed.material.files['entry.mjs']);
    const bytes = Buffer.from(signed.material.files['entry.mjs']!);
    const source = { ...signed.material, files: { ...signed.material.files, 'entry.mjs': bytes } };
    const snapshot = verifyDistribution(source, signed.anchor, 'linux'); bytes.fill(0);
    expect(snapshot.files.get('entry.mjs')).toEqual(signed.material.files['entry.mjs']);
  });
  it('refuses a key supplied by the material, changed signature, changed bytes and wrong platform', () => {
    const impostor = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(() => verifyDistribution(signed.material, impostor, 'linux')).toThrow('signature');
    expect(() => verifyDistribution({ ...signed.material, signature: Buffer.alloc(64) }, signed.anchor, 'linux')).toThrow('signature');
    expect(() => verifyDistribution({ ...signed.material, files: { ...signed.material.files, 'entry.mjs': Buffer.from('changed') } }, signed.anchor, 'linux')).toThrow('digest');
    expect(() => verifyDistribution(signed.material, signed.anchor, 'darwin')).toThrow('manifest');
  });
  it('refuses signed traversal, duplicate files, missing entry, missing files and unsigned extras', () => {
    const original = JSON.parse(signed.material.manifest.toString());
    for (const manifest of [{ ...original, entry: '../entry.mjs' }, { ...original, entry: 'missing.mjs' },
      { ...original, files: [...original.files, original.files[0]] },
      { ...original, files: [{ ...original.files[0], path: '../outside' }] }]) {
      const bytes = Buffer.from(JSON.stringify(manifest));
      expect(() => verifyDistribution({ ...signed.material, manifest: bytes, signature: signed.resign(bytes) }, signed.anchor, 'linux')).toThrow();
    }
    expect(() => verifyDistribution({ ...signed.material, files: {} }, signed.anchor, 'linux')).toThrow('missing');
    expect(() => verifyDistribution({ ...signed.material, files: { ...signed.material.files, extra: Buffer.from('x') } }, signed.anchor, 'linux')).toThrow('file set');
  });
  it('refuses incomplete interfaces and aliased identities before doing OS work', () => {
    expect(() => custodyPlatform({})).toThrow('missing install');
    expect(() => linuxCustodyPlatform({ base: '/tmp/test', broker: 'same', agent: 'same', harness: 'different', trustAnchorPath: '/root/release-anchor.pem' })).toThrow('separate identities');
  });
  it('does not mistake an unprivileged installation attempt for success', async () => {
    if (rootProbe) return; // Positive install runs in the real root conformance cases.
    const platform = linuxCustodyPlatform({ base: '/tmp/not-created-custody', broker: 'broker', agent: 'agent', harness: 'harness', trustAnchorPath: '/root/release-anchor.pem' });
    expect(() => platform.install(signed.material)).toThrow('root installation');
    expect(() => platform.verify()).toThrow('root installation');
    expect(await platform.status()).toEqual({ state: 'refused' });
    await expect(platform.request({ operation: 'read', scope: 'probe', maxBytes: 128 })).rejects.toThrow('verified running');
  });
  it('preserves the existing macOS lifecycle responses behind the neutral interface', async () => {
    const calls: string[] = [];
    const legacy = { install: () => { calls.push('install'); return 'installed'; },
      verify: () => { calls.push('verify'); return 'verified'; }, start: async () => ({ pid: 1, uid: 2 }),
      request: async () => ({ state: 'refused' }), status: async () => ({ state: 'stopped' }), stop: async () => { calls.push('stop'); } };
    const platform = macosCustodyPlatform({ implementation: legacy, harnessConfiguration: {} });
    expect(platform.install(signed.material)).toBe('installed'); expect(platform.verify()).toBe('verified');
    expect(await platform.request({ operation: 'export-key' })).toEqual({ state: 'refused' });
    expect(await platform.status()).toEqual({ state: 'stopped' }); await platform.stop();
    expect(calls).toEqual(['install', 'verify', 'stop']);
    if (process.platform !== 'darwin') await expect(platform.start()).rejects.toThrow('must run on macOS');
  });
  it('checks UID and capability posture against a real captured Linux kernel record', () => {
    // Captured verbatim from /proc/self/status in a Node process on this WSL host,
    // 2026-10-13; no reconstructed sample and no credential or environment bytes.
    const captured = JSON.parse(readFileSync('tests/platform/custody/linux-process-status.json', 'utf8')) as { bytesBase64: string };
    const status = Buffer.from(captured.bytesBase64, 'base64').toString('utf8');
    expect(brokerProcessObservation(status, 1000)).toBe(true);
    expect(brokerProcessObservation(status, 0)).toBe(false);
    expect(brokerProcessObservation(status.replace(/^Uid:.*$/m, ''), 1000)).toBe(false);
    expect(brokerProcessObservation(status.replace(/NoNewPrivs:\s+1/, 'NoNewPrivs: 0'), 1000)).toBe(false);
    for (const kind of ['Inh', 'Prm', 'Eff', 'Bnd', 'Amb'])
      expect(brokerProcessObservation(status.replace(new RegExp(`^Cap${kind}:.*$`, 'm'), `Cap${kind}: 0000000000000001`), 1000)).toBe(false);
  });
  it('renders a systemd service with a separate user, no capabilities and bounded resources', () => {
    const unit = systemdUnit({ base: '/opt/instar-custody', broker: 'custodian', node: '/usr/bin/node' });
    for (const line of ['User=custodian', 'NoNewPrivileges=yes', 'CapabilityBoundingSet=', 'ProtectSystem=strict',
      'ReadWritePaths=/opt/instar-custody/run', 'Restart=no', 'TasksMax=16', 'MemoryMax=256M']) expect(unit).toContain(line);
    expect(() => systemdUnit({ base: '/opt/x\nUser=root', broker: 'custodian', node: '/usr/bin/node' })).toThrow();
  });
});

it('runs the existing custody reader through the real Linux socket (same-user proof only)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'custody-socket-'));
  let child: ReturnType<typeof spawn> | undefined;
  let exited: Promise<unknown> | undefined;
  try {
    const checked = verifyDistribution(signed.material, signed.anchor, 'linux');
    for (const [name, bytes] of checked.files as Map<string, Buffer>) {
      const target = join(root, name); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
    }
    const socket = join(root, 'probe.sock');
    child = spawn(process.execPath, [join(root, 'entry.mjs'), socket], { stdio: ['ignore', 'ignore', 'pipe'], env: { PATH: '/usr/bin:/bin' } });
    exited = once(child, 'exit');
    let errors = ''; child.stderr!.on('data', bytes => { errors += bytes; });
    let status;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { status = await requestSocket(socket, { operation: 'status' }); break; } catch {}
      if (child.exitCode !== null) throw Error(`probe exited: ${errors}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    expect(status).toEqual({ state: 'running', pid: child.pid, uid: process.getuid!() });
    expect(await requestSocket(socket, { operation: 'read', scope: 'probe', maxBytes: 128 }))
      .toEqual({ state: 'allowed', bytes: ['Instar custody isolation challenge'], observations: 1 });
    for (const request of [{ operation: 'read', scope: 'keys', maxBytes: 128 },
      { operation: 'read', scope: 'probe', maxBytes: 1 }, { operation: 'read', scope: 'probe', maxBytes: 129 },
      { operation: 'export-key' }, { operation: 'read', scope: 'probe', maxBytes: 128, requester: 'root' }])
      expect(await requestSocket(socket, request)).toEqual({ state: 'refused' });
    await expect(requestSocket(socket, { payload: 'x'.repeat(3000) })).rejects.toThrow('bound');
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exited; }
    rmSync(root, { recursive: true, force: true });
  }
});

it('records the real host privilege limitation without claiming cross-user denials', () => {
  if (process.platform !== 'linux' || rootProbe) return;
  const status = readFileSync('/proc/self/status', 'utf8');
  const drop = spawnSync(process.execPath, ['-e', 'try { process.setuid(65534); process.exit(0); } catch { process.exit(7); }'], { timeout: 3000 });
  expect(drop.status).toBe(7);
  expect(status).toMatch(/Uid:\s+\d+/);
  console.info(`Real identity cases NOT RUN: uid=${process.getuid!()}; ${status.match(/NoNewPrivs:\s*\d+/)?.[0]}; ${status.match(/CapEff:\s*[0-9a-f]+/)?.[0]}; setuid denied`);
});
