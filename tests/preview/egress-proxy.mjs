// The sandboxed shell's network checkpoint (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule). The
// harness sandbox lets a shell command reach exactly one place on the network: this proxy, on a loopback port, run by the
// runner for one tool turn and stopped with it. Every request is decided here, by method and URL, with the decision
// appended to the turn's admission state before anything is forwarded:
// - HTTPS is intercepted with the turn's own trust root (a key that stays in the admission state, no tool can read it; its
//   public certificate is trusted only by the turn's shell, through the variables the shell prefix sets), so the method
//   and path of an HTTPS request are seen, not guessed.
// - A read (GET or HEAD, or a git fetch) of a public host is forwarded. A git fetch is proven, not named: its repository
//   answered its upload-pack discovery as a git server in this turn, and its body (held and checked before anything is
//   forwarded) is nothing but upload-pack requests. A method-override header is decided by the method it names. A write
//   (any other method, an unproven POST, a git push, a package publish) is a network write for the effect doorway, which
//   refuses it unless the installed profile registers it (admitEgress in tool-admission.mjs).
// - The host is resolved here and every address must be public (not loopback, private, link-local, shared/CGNAT,
//   multicast or reserved); the connection then goes to the address checked, so a name cannot be re-pointed in between.
// - The proxy adds no credential and strips proxy headers; upstream certificates are verified against the system's roots.
// - Bounded: bytes through it, concurrent connections, requests, an idle timeout per connection, and the turn's lifetime.
//   Reaching the byte bound or close() is terminal for the turn: nothing more is admitted or forwarded, and a decision
//   that waited on name resolution or a request body is re-checked against both before it is recorded or sent on.
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { chmodSync, closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Duplex } from 'node:stream';
import tls from 'node:tls';
import { promisify } from 'node:util';
import { admitEgress, egressTarget, gitAdvertisement, gitFetchRequest, gitRepository, GIT_FETCH_MAX_BODY, publicAddress } from './tool-admission.mjs';

const run = promisify(execFile);
/** One turn's checkpoint bounds: bytes in both directions together, open client connections at once, requests in the
 * whole turn, the idle time a connection may sit, and the time an upstream connection may take to answer. */
export const EGRESS_LIMITS = Object.freeze({ maxBytes: 256 * 1024 * 1024, maxConnections: 16, maxRequests: 512, idleMs: 30000, upstreamMs: 20000 });
/** The decision record, one JSON row per request and per finished response, in the turn's admission state. */
export const EGRESS_RECORD = 'egress.jsonl';
/** The system's own TLS toolkit, used only to mint the turn's trust root and one certificate per host it reaches. */
export const EGRESS_OPENSSL = '/usr/bin/openssl';
const EXCERPT = 512;
const clip = text => (text.length > EXCERPT ? `${text.slice(0, EXCERPT)}…` : text);

const CONFIG = name => `[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=${name}\n`
  + '[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n'
  + '[leaf]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=@alt\n';

/** Mints the turn's trust root and leaf key into `directory` (0700, inside the admission state) and copies the public
 * certificate to `caPath` (on the scratch volume, readable by the shell). Valid two days; a fresh one every turn. */
export async function createTrustRoot(directory, caPath, openssl = EGRESS_OPENSSL) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = name => join(directory, name);
  writeFileSync(file('ca.cnf'), `${CONFIG('Instar tool-turn egress checkpoint')}[alt]\nDNS.1=invalid\n`, { mode: 0o600 });
  await run(openssl, ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('ca.key')]);
  await run(openssl, ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('leaf.key')]);
  chmodSync(file('ca.key'), 0o600); chmodSync(file('leaf.key'), 0o600);
  await run(openssl, ['req', '-x509', '-new', '-key', file('ca.key'), '-config', file('ca.cnf'), '-extensions', 'ca', '-days', '2',
    '-sha256', '-out', file('ca.pem')]);
  const cert = readFileSync(file('ca.pem'), 'utf8');
  writeFileSync(caPath, cert, { mode: 0o444 });
  return { directory, cert, key: readFileSync(file('ca.key'), 'utf8'), leafKey: readFileSync(file('leaf.key'), 'utf8') };
}

/** A certificate (PEM) for one host, signed by `root` (from createTrustRoot) with its leaf key. The host is a checked
 * public name or address. */
export async function leafPem(root, host, openssl = EGRESS_OPENSSL) {
  if (!(isIP(host) || /^[a-z0-9.-]{1,253}$/u.test(host))) throw Error('egress: host not certifiable');
  const id = randomBytes(8).toString('hex'), file = name => join(root.directory, `${id}.${name}`);
  writeFileSync(file('cnf'), `${CONFIG(isIP(host) ? 'egress' : host)}[alt]\n${isIP(host) ? 'IP' : 'DNS'}.1=${host}\n`, { mode: 0o600 });
  await run(openssl, ['req', '-new', '-key', join(root.directory, 'leaf.key'), '-config', file('cnf'), '-out', file('csr')]);
  await run(openssl, ['x509', '-req', '-in', file('csr'), '-CA', join(root.directory, 'ca.pem'), '-CAkey', join(root.directory, 'ca.key'),
    '-set_serial', `0x${randomBytes(12).toString('hex')}`, '-days', '2', '-sha256', '-extfile', file('cnf'), '-extensions', 'leaf',
    '-out', file('pem')]);
  return readFileSync(file('pem'), 'utf8');
}
const leafCertificate = async (root, host, openssl) => tls.createSecureContext({ key: root.leafKey, cert: await leafPem(root, host, openssl) });

/** Every address a host resolves to; the checkpoint admits a name only when all of them are public. */
const resolveAll = async host => (await lookup(host, { all: true, verbatim: true })).map(entry => entry.address);

/**
 * Starts one turn's checkpoint on a loopback port. `stateDirectory` is the turn's admission state (the record and the
 * trust root's key go there); `caPath` is where the shell finds the public certificate; `operations` is the installed
 * profile's registered operations (the effect doorway's input). `resolve(host)` returns addresses; `upstream` adds TLS
 * options for the upstream connection and `dial(address, port)` names where the checked address is reached (tests pass their
 * own root and a local server). Returns {port, close(), stats()}.
 */
export async function startEgressProxy({ stateDirectory, caPath, operations, limits = EGRESS_LIMITS, resolve = resolveAll,
  openssl = EGRESS_OPENSSL, upstream = {}, dial = (address, port) => ({ host: address, port }) }) {
  const root = await createTrustRoot(join(stateDirectory, 'egress-trust'), caPath, openssl);
  const contexts = new Map(), targets = new WeakMap(), open = new Set(), advertised = new Set();
  const stats = { requests: 0, admitted: 0, refused: 0, bytes: 0, limited: null };
  let closed = false;
  // A row is appended before the request it decides goes anywhere; an admitted write (a profile that registers one) is
  // synced to disk first, so its authorization outlives a crash (the Purpose: an irreversible act follows its durable cause).
  const record = row => { const fd = openSync(join(stateDirectory, EGRESS_RECORD), 'a', 0o600);
    try { writeSync(fd, `${JSON.stringify(row)}\n`); if (row.decision === 'allow' && row.kind === 'network-write') fsyncSync(fd); } finally { closeSync(fd); } };
  const track = socket => { open.add(socket); socket.once('close', () => open.delete(socket)); };
  const stop = reason => { if (stats.limited === null) { stats.limited = reason; record({ phase: 'limit', reason }); }
    for (const socket of open) socket.destroy(); };
  /** Counts bytes about to pass; false (and the turn's checkpoint stopped) once they would exceed the bound, so the chunk
   * that crosses it is not forwarded. */
  const spend = size => { if (stats.limited !== null) return false; stats.bytes += size;
    if (stats.bytes > limits.maxBytes) { stop(`byte bound ${String(limits.maxBytes)} reached`); return false; } return true; };
  /** Why nothing more may pass for this turn (closed, or the byte bound reached), or null. */
  const ended = () => (closed ? 'the checkpoint is closed' : stats.limited);
  const context = host => { if (!contexts.has(host)) contexts.set(host, leafCertificate(root, host, openssl)); return contexts.get(host); };
  /** The host's checked addresses: an IP literal must itself be public; a name must resolve, every address public. */
  const addressesOf = async host => {
    if (isIP(host)) return [host];
    let addresses; try { addresses = await resolve(host); } catch { addresses = null; }
    if (!Array.isArray(addresses) || addresses.length === 0) throw Error(`${host} did not resolve`);
    if (!addresses.every(publicAddress)) throw Error(`${host} resolves to a non-public address`);
    return addresses;
  };
  const refuse = (res, status, reason) => {
    const body = `Refused by the tool turn's network checkpoint: ${reason}\n`;
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(body),
      'x-instar-refused': reason.replace(/[^\x20-\x7e]/gu, '?').slice(0, 512), connection: 'close' });
    res.end(body);
  };
  const handle = async (req, res) => {
    const n = ++stats.requests, method = String(req.method ?? '');
    let target = targets.get(req.socket) ?? null, path = String(req.url ?? '');
    if (target === null) {
      // A plain-HTTP request through the proxy names its whole URL.
      let url; try { url = new URL(path); } catch { url = null; }
      const checked = url && url.protocol === 'http:' ? egressTarget(url.host, 'http:') : { host: null, reason: 'not an http URL' };
      target = checked.host === null ? { refused: checked.reason, attempted: url?.hostname ?? null } : { host: checked.host, port: checked.port, tls: false };
      if (url) path = `${url.pathname}${url.search}`;
    }
    const row = { phase: 'request', n, method, scheme: target.tls ? 'https' : 'http', host: target.host ?? target.attempted ?? null, port: target.port ?? null,
      path: clip(path) };
    const over = ended();
    if (over !== null) { stats.refused++; record({ ...row, decision: 'deny', reason: over, kind: 'budget' }); refuse(res, 429, over); return; }
    if (target.refused) { stats.refused++; record({ ...row, decision: 'deny', reason: `host refused: ${target.refused}`, kind: 'scope' });
      refuse(res, 403, `host refused: ${target.refused}`); return; }
    if (n > limits.maxRequests) { stats.refused++; record({ ...row, decision: 'deny', reason: `request bound ${String(limits.maxRequests)} reached`, kind: 'budget' });
      refuse(res, 429, `request bound ${String(limits.maxRequests)} reached`); return; }
    const origin = `${target.host}:${String(target.port)}`;
    // A POST to an upload-pack route is held whole (bounded) so its body can prove it is a git fetch before any of it moves.
    let body = null, gitFetch = null;
    if (method.toUpperCase() === 'POST' && gitRepository(path, 'git-upload-pack') !== null) {
      body = await held(req);
      if (body === null) { stats.refused++; const why = ended() ?? `request body over ${String(GIT_FETCH_MAX_BODY)} bytes`;
        record({ ...row, decision: 'deny', reason: why, kind: 'budget' }); if (!res.destroyed) refuse(res, 429, why); return; }
      let plain = body;
      if (/gzip/iu.test(String(req.headers['content-encoding'] ?? ''))) {
        try { plain = gunzipSync(body, { maxOutputLength: GIT_FETCH_MAX_BODY }); } catch { plain = null; } }
      gitFetch = gitFetchRequest({ origin, path, headers: req.headers, body: plain, advertised });
    }
    const decision = admitEgress({ method, path, headers: req.headers, gitFetch }, operations);
    let addresses = target.addresses ?? null;
    if (decision.decision === 'allow' && addresses === null) {
      try { addresses = await addressesOf(target.host); } catch (error) {
        stats.refused++; record({ ...row, decision: 'deny', reason: `host refused: ${error.message}`, kind: 'scope' });
        refuse(res, 403, `host refused: ${error.message}`); return;
      }
    }
    // Resolution and the held body were waits: a close, the byte bound or the client leaving in between ends the request
    // here, before any decision is recorded or connection made.
    if (ended() !== null || req.socket.destroyed || res.destroyed) { req.socket.destroy(); return; }
    record({ ...row, decision: decision.decision, reason: decision.reason, kind: decision.kind, ...(addresses ? { address: addresses[0] } : {}) });
    if (decision.decision !== 'allow') { stats.refused++; refuse(res, 403, decision.reason); return; }
    stats.admitted++;
    const headers = { ...req.headers };
    for (const name of ['proxy-connection', 'proxy-authorization', 'connection', 'keep-alive']) delete headers[name];
    const options = { ...dial(addresses[0], target.port), method, path, headers, agent: false, timeout: limits.upstreamMs };
    const out = (target.tls ? https : http).request(target.tls ? { ...options, ...upstream, servername: isIP(target.host) ? undefined : target.host,
      checkServerIdentity: (_, cert) => tls.checkServerIdentity(target.host, cert) } : options);
    out.on('socket', socket => { if (ended() !== null) { socket.destroy(); return; } track(socket); socket.on('error', () => socket.destroy()); });
    req.on('error', () => out.destroy()); res.on('error', () => out.destroy());
    out.on('timeout', () => out.destroy(Error('upstream timed out')));
    out.on('error', error => { record({ phase: 'response', n, status: null, error: clip(String(error?.message ?? error)) });
      if (!res.headersSent) refuse(res, 502, `upstream failed: ${String(error?.message ?? error)}`); else res.destroy(); });
    out.on('response', answer => {
      let size = 0;
      const repo = gitAdvertisement({ method, path, status: answer.statusCode, headers: answer.headers });
      if (repo !== null) advertised.add(`${origin}${repo}`);
      res.writeHead(answer.statusCode ?? 502, answer.statusMessage, answer.rawHeaders);
      answer.on('data', chunk => { size += chunk.length; if (spend(chunk.length)) res.write(chunk); });
      answer.on('end', () => { record({ phase: 'response', n, status: answer.statusCode ?? null, bytes: size }); res.end(); });
      answer.on('error', () => res.destroy());
    });
    if (body !== null) out.end(body);
    else { req.on('data', chunk => { if (spend(chunk.length)) out.write(chunk); }); req.on('end', () => out.end()); }
  };
  /** A request body read whole, counted against the byte bound; null when it exceeds GIT_FETCH_MAX_BODY, the bound is
   * reached or the request fails. */
  const held = req => new Promise(done => {
    const chunks = []; let size = 0;
    req.on('data', chunk => { size += chunk.length;
      if (size > GIT_FETCH_MAX_BODY || !spend(chunk.length)) { req.removeAllListeners('data'); req.resume(); done(null); return; }
      chunks.push(chunk); });
    req.on('end', () => done(size > GIT_FETCH_MAX_BODY ? null : Buffer.concat(chunks)));
    req.on('error', () => done(null)); req.on('close', () => done(null));
  });
  // Neither handler may throw into the runner: any failure (a record that cannot be written included) ends that connection.
  const guarded = (req, res) => handle(req, res).catch(() => { res.destroy(); req.socket?.destroy(); });
  const inner = http.createServer(guarded);
  const outer = http.createServer(guarded);
  for (const server of [inner, outer]) { server.headersTimeout = limits.idleMs; server.requestTimeout = limits.upstreamMs * 3; }
  outer.on('connection', socket => {
    if (ended() !== null || open.size >= limits.maxConnections) { socket.destroy(); return; }
    track(socket); socket.setTimeout(limits.idleMs, () => socket.destroy());
    socket.on('error', () => socket.destroy());
  });
  outer.on('connect', (req, socket, head) => { tunnelOf(req, socket, head).catch(() => socket.destroy()); });
  const tunnelOf = async (req, socket, head) => {
    const n = ++stats.requests, authority = String(req.url ?? '');
    const target = egressTarget(authority, 'https:');
    const row = { phase: 'request', n, method: 'CONNECT', scheme: 'https', host: target.host ?? clip(authority.replace(/:\d+$/u, '')),
      port: target.port ?? null, path: clip(authority) };
    const deny = (reason, kind) => { stats.refused++; record({ ...row, decision: 'deny', reason, kind });
      socket.end(`HTTP/1.1 403 Forbidden\r\nx-instar-refused: ${reason.replace(/[^\x20-\x7e]/gu, '?').slice(0, 512)}\r\ncontent-length: 0\r\n\r\n`); };
    if (ended() !== null) { deny(ended(), 'budget'); return; }
    if (target.host === null) { deny(`host refused: ${target.reason}`, 'scope'); return; }
    if (n > limits.maxRequests) { deny(`request bound ${String(limits.maxRequests)} reached`, 'budget'); return; }
    let addresses, secure;
    try { addresses = await addressesOf(target.host); } catch (error) { deny(`host refused: ${error.message}`, 'scope'); return; }
    if (ended() !== null || socket.destroyed) { socket.destroy(); return; }
    // The tunnel itself carries nothing yet: each request inside it is decided on its own.
    record({ ...row, decision: 'allow', reason: 'tunnel opened; each request inside it is decided', kind: 'tunnel', address: addresses[0] });
    try { secure = await context(target.host); } catch (error) { deny(`no certificate for ${target.host}: ${error.message}`, 'scope'); return; }
    if (ended() !== null || socket.destroyed) { socket.destroy(); return; }
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    // A plain JavaScript stream between the client's socket and the TLS layer, so bytes the client sent with its CONNECT
    // are not lost when the TLS layer takes over the connection.
    const pipe = new Duplex({ read() { socket.resume(); }, write(chunk, _encoding, done) { socket.write(chunk, done); },
      final(done) { socket.end(); done(); } });
    socket.on('data', chunk => { if (!pipe.push(chunk)) socket.pause(); });
    socket.on('end', () => pipe.push(null));
    socket.on('close', () => pipe.destroy());
    if (head?.length) pipe.push(head);
    const tunnel = new tls.TLSSocket(pipe, { isServer: true, secureContext: secure, ALPNProtocols: ['http/1.1'] });
    tunnel.on('error', () => socket.destroy());
    pipe.on('error', () => socket.destroy());
    targets.set(tunnel, { host: target.host, port: target.port, tls: true, addresses });
    inner.emit('connection', tunnel);
  };
  await new Promise((done, fail) => { outer.once('error', fail); outer.listen(0, '127.0.0.1', done); });
  const port = outer.address().port;
  return {
    port,
    stats: () => ({ ...stats }),
    /** Stops the checkpoint with its turn: no new connection, and every open one (client or upstream) is ended now. */
    close: () => new Promise(done => { closed = true; for (const socket of open) socket.destroy(); outer.close(() => done()); inner.close(); }),
  };
}

/** The record of a turn's checkpoint, read back after the turn: one entry per request, its decision and its outcome. */
export function readEgressRecord(stateDirectory) {
  let text = '';
  try { text = readFileSync(join(stateDirectory, EGRESS_RECORD), 'utf8'); } catch { return { requests: [], limited: null, malformed: 0 }; }
  const requests = [], byN = new Map();
  let limited = null, malformed = 0;
  for (const line of text.split('\n').filter(Boolean)) {
    let row; try { row = JSON.parse(line); } catch { malformed++; continue; }
    if (row?.phase === 'request' && Number.isSafeInteger(row.n)) {
      const entry = { n: row.n, method: String(row.method), scheme: String(row.scheme), host: row.host, port: row.port, path: String(row.path),
        decision: String(row.decision), reason: String(row.reason), kind: String(row.kind), ...(row.address ? { address: String(row.address) } : {}),
        status: null, bytes: null };
      requests.push(entry); byN.set(row.n, entry);
    } else if (row?.phase === 'response' && byN.has(row.n)) {
      const entry = byN.get(row.n); entry.status = row.status ?? null; entry.bytes = Number.isSafeInteger(row.bytes) ? row.bytes : null;
      if (row.error) entry.error = String(row.error);
    } else if (row?.phase === 'limit') limited = String(row.reason);
    else malformed++;
  }
  return { requests, limited, malformed };
}
