// Rules 28/29/60/100: authenticated transport into the existing closed receiver.
// Certificates identify installed services, NOT an operator act, grant or waiver.
import { createServer, connect } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setupOwnerReceiver } from '../setup-owner-receiver.mjs';

const LIMIT = 16384, LIFETIME = 2000, CONNECTIONS = 4;
const fail = () => Error('custody: authenticated setup connection unavailable; resume after the installer repairs its broker connection');
const canonical = path => typeof path === 'string' && path.startsWith('/') && resolve(path) === path;
const uid = value => Number.isSafeInteger(value) && value >= 0;

// No symlinks, hard-linked secrets, writable ancestor or worker-owned component.
// Sticky root-owned /private/tmp is allowed for isolated platform proofs only as
// an ancestor; its child must still be independently owned and non-writable.
export function protectedSetupPath(path, owner, kind, privateFile = false) {
  if (!canonical(path) || !uid(owner)) throw fail();
  let leafStat;
  for (let at = path; ; at = dirname(at)) {
    const stat = lstatSync(at), leaf = at === path;
    if (leaf) leafStat = stat;
    // Darwin allow ACLs can grant access despite mode 0600. Existing deny-only
    // confinement ACLs are harmless; unsupported grants require installer repair.
    if (process.platform === 'darwin') {
      const acl = spawnSync('/bin/ls', ['-lde', at], { encoding: 'utf8', timeout: 1000, maxBuffer: 65536,
        env: { PATH: '/usr/bin:/bin', LANG: 'C' } });
      if (acl.error || acl.status !== 0 || /^\s*\d+: .* allow /m.test(acl.stdout)) throw fail();
    }
    const sticky = !leaf && stat.uid === 0 && stat.isDirectory() && (stat.mode & 0o1000);
    if (stat.isSymbolicLink() || ![0, owner].includes(stat.uid)
      || ((stat.mode & 0o022) && !sticky)
      || (leaf && (stat.uid !== owner || (kind === 'directory' ? !stat.isDirectory() : !stat.isFile())))
      || (!leaf && !stat.isDirectory())
      || (leaf && kind === 'file' && (stat.nlink !== 1 || stat.size > 65536))
      || (leaf && privateFile && (stat.mode & 0o077))) throw fail();
    if (at === '/') return leafStat;
  }
}
function identity(configuration) {
  const ids = ['brokerUid', 'installerUid', 'agentUid', 'harnessUid'].map(key => configuration[key]);
  if (!ids.every(uid) || configuration.brokerUid === 0 || new Set(ids).size !== 4) throw fail();
}
function material(paths, owner) {
  if (!paths || Object.keys(paths).sort().join(',') !== 'ca,cert,key') throw fail();
  const result = {};
  for (const key of ['ca', 'cert', 'key']) {
    protectedSetupPath(paths[key], owner, 'file', true);
    result[key] = readFileSync(paths[key]);
  }
  return result;
}
function fingerprint(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw fail();
  return value;
}
export const setupCertificatePin = bytes => new X509Certificate(bytes).fingerprint256.replaceAll(':', '').toLowerCase();
const peerMatches = (peer, pin) => peer.authorized && peer.getPeerCertificate().raw
  && setupCertificatePin(peer.getPeerCertificate().raw) === pin;

/** Called only from the independently signed broker entrypoint. Installation and
 * grant/supervision/stop checks remain the implementation's owner responsibilities.
 * No request selects a backend, path, UID, certificate, command or authority.
 */
export async function mountSetupOwner({ socket, credentials, clientPin, identities, implementation }) {
  identity(identities);
  if (process.getuid() !== identities.brokerUid || !canonical(socket)
    || Buffer.byteLength(socket) > 100) throw fail();
  const directory = dirname(socket);
  protectedSetupPath(directory, identities.brokerUid, 'directory');
  // An existing socket is uncertain ownership. Never unlink it on startup.
  try { lstatSync(socket); throw fail(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const tls = material(credentials, identities.brokerUid), pin = fingerprint(clientPin);
  const receiver = setupOwnerReceiver({ owner: 'custodian', implementation });
  const peers = new Set(), authenticated = new Set();
  const server = createServer({ ...tls, minVersion: 'TLSv1.3', requestCert: true, rejectUnauthorized: true,
    handshakeTimeout: LIFETIME, allowHalfOpen: true }, peer => {
    if (!peerMatches(peer, pin)) { peer.destroy(); return; }
    authenticated.add(peer);
    const deadline = setTimeout(() => peer.destroy(), LIFETIME);
    peer.on('close', () => { clearTimeout(deadline); authenticated.delete(peer); });
    const chunks = []; let size = 0;
    peer.on('data', chunk => {
      size += chunk.length;
      if (size > LIMIT) peer.destroy(); else chunks.push(chunk);
    });
    peer.on('end', async () => {
      if (peer.destroyed || size === 0 || size > LIMIT) return;
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const result = Buffer.from(JSON.stringify(await receiver.request(value)));
        if (result.length > LIMIT || peer.destroyed) { peer.destroy(); return; }
        peer.end(result);
      } catch { peer.destroy(); }
    });
    peer.on('error', () => peer.destroy());
  });
  // Count raw sockets, including unauthenticated handshakes. Absolute lifetime
  // cannot be extended by a slow sender or a sequence of partial TLS records.
  server.maxConnections = CONNECTIONS;
  server.on('connection', peer => {
    if (peers.size >= CONNECTIONS) { peer.destroy(); return; }
    peers.add(peer);
    const timer = setTimeout(() => peer.destroy(), LIFETIME);
    peer.on('error', () => peer.destroy());
    peer.on('close', () => { clearTimeout(timer); peers.delete(peer); });
  });
  server.on('tlsClientError', (_error, peer) => peer.destroy());
  try {
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(socket, accept); });
    chmodSync(socket, 0o666); // Traversal is public; TLS, not a claimed UID, authenticates the peer.
  } catch {
    for (const peer of peers) peer.destroy();
    for (const peer of authenticated) peer.destroy();
    server.close(); throw fail();
  }
  const installed = lstatSync(socket);
  let closing;
  return Object.freeze({
    async close() {
      if (closing) return closing;
      closing = new Promise((accept, reject) => {
        for (const peer of peers) peer.destroy();
        for (const peer of authenticated) peer.destroy();
        server.close(error => {
          if (error) { reject(fail()); return; }
          // Node normally unlinks its listening path. Never remove a replacement.
          try {
            const now = lstatSync(socket);
            if (now.dev === installed.dev && now.ino === installed.ino && now.isSocket()) unlinkSync(socket);
          } catch (error) { if (error.code !== 'ENOENT') { reject(fail()); return; } }
          accept();
        });
      });
      return closing;
    },
  });
}

/** Existing custodyPlatform.request implementation for the authenticated installer.
 * Caller pins arrive through protected distribution/session configuration, never
 * from the endpoint. A valid certificate from the same CA is insufficient.
 */
export function setupOwnerSocketClient({ socket, credentials, serverPin, identities }) {
  identity(identities);
  if (process.getuid() !== identities.installerUid || !canonical(socket)
    || Buffer.byteLength(socket) > 100) throw fail();
  const pin = fingerprint(serverPin);
  const installer = identities.installerUid, paths = Object.freeze({ ...credentials });
  return Object.freeze({
    request(value) {
      let bytes, tls;
      try {
        bytes = Buffer.from(JSON.stringify(value));
        if (bytes.length > LIMIT) throw fail();
        tls = material(paths, installer);
      } catch { return Promise.reject(fail()); }
      return new Promise((accept, reject) => {
        // Exact certificate pin replaces DNS identity for local Unix IPC. Normal
        // chain, expiry and certificate-purpose verification still run in TLS.
        const peer = connect({ ...tls, path: socket, minVersion: 'TLSv1.3', rejectUnauthorized: true,
          checkServerIdentity: (_host, cert) => setupCertificatePin(cert.raw) === pin ? undefined : fail() });
        const chunks = []; let size = 0, settled = false;
        const finish = (error, result) => {
          if (settled) return;
          settled = true; clearTimeout(timer); peer.destroy();
          if (error) reject(fail()); else accept(result);
        };
        const timer = setTimeout(() => finish(true), LIFETIME);
        peer.on('error', () => finish(true));
        peer.on('close', () => { if (!settled) finish(true); });
        peer.on('secureConnect', () => {
          if (!peerMatches(peer, pin)) { finish(true); return; }
          peer.end(bytes);
        });
        peer.on('data', chunk => {
          size += chunk.length;
          if (size > LIMIT) finish(true); else chunks.push(chunk);
        });
        peer.on('end', () => {
          try { finish(false, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
          catch { finish(true); }
        });
      });
    },
  });
}
