import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chmodSync, lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { connect as tlsConnect } from 'node:tls';
import { connect } from 'node:net';
import { execFileSync, spawnSync } from 'node:child_process';
// @ts-expect-error Host platform boundary.
import { mountSetupOwner, protectedSetupPath, setupCertificatePin, setupOwnerSocketClient } from '../../scripts/custody-platform/setup-ipc.mjs';
// @ts-expect-error Public ephemeral certificate fixture.
import { ipcCertificates } from './custody/setup-ipc-material.mjs';

// Same-user TLS protocol tests. These do not claim independently owned custody;
// the separate root/launchd test below exercises the actual three OS identities.
const self = process.getuid!();
describe.skipIf(self === 0)('unprivileged TLS protocol', () => {
const roots: string[] = [], mounts: { close(): Promise<void> }[] = [];
const identities = { brokerUid: self, installerUid: 0, agentUid: 60001, harnessUid: 60002 };
let certificates: Record<string, Record<string, string>>;
let certificateRoot: string;
beforeAll(() => { certificateRoot = mkdtempSync(join(tmpdir(), 'ipc-cert-')); certificates = ipcCertificates(certificateRoot); });
afterEach(async () => {
  for (const mount of mounts.splice(0)) await mount.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
afterAll(() => rmSync(certificateRoot, { recursive: true, force: true }));
const checkpoint = { installation: 'test-installation', session: 'test-session', subject: 'a'.repeat(64),
  authority: 'test-preparation', step: 'key', phase: 'pre', operation: 'test-session:key', schema: 'setup-owner-results-v1' };
const request = { kind: 'setup-owner-request', operation: 'inspect', checkpoint };
async function fixture() {
  // The repository's RAM-disk TMPDIR can have administrator-owned intermediate
  // parents. Use a canonical real path; no /tmp symlink is admitted by the product.
  const root = mkdtempSync(process.platform === 'darwin' ? '/private/tmp/ipc-test-' : '/tmp/ipc-test-'); roots.push(root);
  const socket = join(root, 'owner.sock');
  let calls = 0;
  const implementation = { async read() { calls++; throw Error('PRIVATE OWNER DIAGNOSTIC'); },
    async reconcile() { return 'absent'; }, async execute() { throw Error('not installed'); } };
  // Certificates use the runtime test root; canonicalize because macOS tmpdir can
  // contain symlink ancestors. Copy them into the already protected leaf.
  const { copyFileSync } = await import('node:fs');
  const server = Object.fromEntries(Object.entries(certificates.server!).map(([key, path]) => {
    const target = join(root, key); copyFileSync(path, target); chmodSync(target, 0o600); return [key, target];
  }));
  const mount = await mountSetupOwner({ socket, credentials: server, clientPin: setupCertificatePin(readFileSync(certificates.client!.cert!)),
    identities, implementation });
  mounts.push(mount);
  return { socket, root, server, mount, implementation, calls: () => calls };
}
function exchange(socket: string, value: unknown, who: string | null = 'client', split = false): Promise<unknown> {
  return new Promise((accept, reject) => {
    const paths = who ? certificates[who]! : {};
    const peer = tlsConnect({ path: socket, ca: readFileSync(certificates.server!.ca!),
      ...(who ? { cert: readFileSync(paths.cert!), key: readFileSync(paths.key!) } : {}), servername: 'localhost', minVersion: 'TLSv1.3' });
    const timer = setTimeout(() => { peer.destroy(); reject(Error('test deadline')); }, 4000);
    const chunks: Buffer[] = []; let done = false;
    const fail = (error?: { code?: string; message?: string }) => { clearTimeout(timer); if (!done) { done = true; reject(Error(`connection refused: ${error?.message ?? error?.code ?? 'closed'}`)); } };
    peer.on('error', fail); peer.on('close', fail);
    peer.on('secureConnect', () => {
      const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
      if (split) { peer.write(bytes.subarray(0, 9)); peer.end(bytes.subarray(9)); } else peer.end(bytes);
    });
    peer.on('data', chunk => chunks.push(chunk));
    peer.on('end', () => {
      try { const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8')); done = true; clearTimeout(timer); accept(result); }
      catch { fail(); }
      peer.destroy();
    });
  });
}
it('mounts the closed receiver and authenticates the exact installed certificate before owner dispatch', async () => {
  const f = await fixture();
  expect(await exchange(f.socket, request, 'client', true)).toMatchObject({ state: 'refused', reason: 'owner-unavailable' });
  expect(f.calls()).toBe(1);
  await expect(exchange(f.socket, request, 'other')).rejects.toThrow(); // same CA, different identity
  await expect(exchange(f.socket, request, null)).rejects.toThrow();
  expect(f.calls()).toBe(1);
  expect(JSON.stringify(await exchange(f.socket, request))).not.toContain('PRIVATE OWNER DIAGNOSTIC');
});
it('refuses extra authority fields, raw plaintext, malformed and oversized messages without owner calls', async () => {
  const f = await fixture();
  expect(await exchange(f.socket, { ...request, uid: 0 })).toMatchObject({ reason: 'request-shape' });
  await expect(exchange(f.socket, '{')).rejects.toThrow();
  await expect(exchange(f.socket, 'x'.repeat(16385))).rejects.toThrow();
  await new Promise<void>(accept => {
    const peer = connect(f.socket); peer.on('error', () => {}); peer.on('close', () => accept()); peer.resume(); peer.end(JSON.stringify(request));
  });
  expect(f.calls()).toBe(0);
});
it('bounds unauthenticated connections by absolute lifetime and recovers without restart', async () => {
  const f = await fixture();
  const peers = Array.from({ length: 5 }, () => connect(f.socket));
  await Promise.all(peers.map(peer => new Promise<void>(accept => { peer.on('error', () => {}); peer.on('close', () => accept()); })));
  expect(f.calls()).toBe(0);
  expect(await exchange(f.socket, request)).toMatchObject({ reason: 'owner-unavailable' });
});
it('refuses shared identities, wrong process identity, writable and aliased credential paths, and occupied sockets', async () => {
  const f = await fixture();
  const base = { socket: f.socket, credentials: f.server, clientPin: setupCertificatePin(readFileSync(certificates.client!.cert!)), identities, implementation: f.implementation };
  await expect(mountSetupOwner(base)).rejects.toThrow();
  await expect(mountSetupOwner({ ...base, identities: { ...identities, agentUid: self } })).rejects.toThrow();
  await expect(mountSetupOwner({ ...base, identities: { ...identities, brokerUid: 60003 } })).rejects.toThrow();
  expect(() => setupOwnerSocketClient({ socket: f.socket, credentials: f.server, serverPin: 'a'.repeat(64), identities })).toThrow();
  const key = f.server.key!;
  chmodSync(key, 0o644); expect(() => protectedSetupPath(key, self, 'file', true)).toThrow(); chmodSync(key, 0o600);
  if (process.platform === 'darwin') {
    const acl = 'everyone allow read';
    execFileSync('/bin/chmod', ['+a', acl, key], { timeout: 1000 });
    expect(() => protectedSetupPath(key, self, 'file', true)).toThrow();
    execFileSync('/bin/chmod', ['-a', acl, key], { timeout: 1000 });
    expect(() => protectedSetupPath(key, self, 'file', true)).not.toThrow();
  }
  const alias = join(f.root, 'alias'); symlinkSync(key, alias);
  expect(() => protectedSetupPath(alias, self, 'file', true)).toThrow();
  const hard = join(f.root, 'hard'); linkSync(key, hard);
  expect(() => protectedSetupPath(key, self, 'file', true)).toThrow();
  expect(() => protectedSetupPath(`${f.root}/../escape`, self, 'file', true)).toThrow();
  chmodSync(f.root, 0o777); expect(() => protectedSetupPath(key, self, 'file', true)).toThrow(); chmodSync(f.root, 0o700);
});
it('closes its own socket and refuses replacing another listening path', async () => {
  const f = await fixture(); await f.mount.close(); await f.mount.close();
  expect(() => lstatSync(f.socket)).toThrow();
});
});
it.skipIf(process.platform !== 'darwin' || process.env.INSTAR_SETUP_IPC_PLATFORM !== '1')('proves launchd, mutually authenticated IPC and denials with the three existing disposable identities', () => {
  const result = spawnSync('/usr/bin/sudo', ['-n', process.execPath, resolve('tests/platform/custody/setup-ipc-studio.mjs'), process.cwd()],
    { encoding: 'utf8', timeout: 55000, env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' } });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const evidence = JSON.parse(result.stdout);
  expect(evidence.launchd).toBe('observed');
  expect(evidence.identities).toEqual([42000, 42001, 42002]);
  expect(evidence.ownerExecution).toBe('refused-missing-preparation');
  expect(evidence.denials).toBeGreaterThanOrEqual(12);
  expect(evidence.cleanup).toBe('complete-no-identity-changes');
}, 60000);
