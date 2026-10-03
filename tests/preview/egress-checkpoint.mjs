#!/usr/bin/env node
// The tool turn's shell egress checkpoint (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule). argv:
// <stateDirectory>. One process per tool turn, started by the runner before the harness and stopped with the turn.
// The harness sandbox lets a sandboxed command reach no network address except this process's loopback port (its
// `sandbox.network.httpProxyPort`), and points the command's proxy variables at it. The checkpoint terminates each HTTPS
// tunnel under an authority it mints for this turn alone (its key stays in the admission state, which no tool can read),
// so it sees every request's method and full URL. Each request is decided by `admitEgress` (tool-admission.mjs): reads
// of public hosts on the web's ports are ordinary work; every other request is a network write for the effect doorway,
// refused unless the installed profile registers it. The checkpoint resolves each name itself and connects only to an
// address it checked, so a name cannot point a command at this machine or its network. Every decision is appended to the
// turn's admission record, flushed to disk, before the request goes anywhere; a record that cannot be written refuses the
// request. Bounds: one request budget for tunnels and requests alike (each HTTPS tunnel takes its slot before any name is
// resolved, certificate minted or socket kept, so certificates and OpenSSL runs are bounded by it too), open tunnels and
// open requests, bytes each way, an idle timeout per request and tunnel, and the process's own lifetime; past the budget a
// refusal is answered without a row of its own (one row says the budget ran out). Nothing outlives the turn.
// It adds nothing: no credential, cookie or header of its own goes upstream; a command's request is forwarded as it came,
// minus hop-by-hop and proxy headers.
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { closeSync, constants, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { createSecureContext, TLSSocket } from 'node:tls';
import { promisify } from 'node:util';
import { admitEgress, EGRESS_PORTS, GIT_UPLOAD_PACK_TYPES, gitUploadPackBase, RECORD_EXCERPT_CHARS, webReadHost } from './tool-admission.mjs';

const run = promisify(execFile);
const OPENSSL = '/usr/bin/openssl';
/** The checkpoint's bounds for one turn. Downstream bytes cover what the scratch volume could hold twice over (a command
 * may read and discard); upstream bytes are what a read needs to say what it asks for (git's fetch negotiation). */
export const EGRESS_LIMITS = Object.freeze({ maxConcurrent: 16, maxRequests: 512, maxDownBytes: 256 * 1024 * 1024,
  maxUpBytes: 8 * 1024 * 1024, idleMs: 30000, lifetimeMs: 330000 });
const HOP = new Set(['connection', 'keep-alive', 'proxy-authorization', 'proxy-authenticate', 'proxy-connection', 'te', 'trailer',
  'transfer-encoding', 'upgrade']);

const [stateDirectory] = process.argv.slice(2);
const fail = error => { process.stderr.write(`egress checkpoint: ${error?.message ?? error}\n`); process.exit(1); };
process.on('uncaughtException', fail); process.on('unhandledRejection', fail);
const config = JSON.parse(readFileSync(join(stateDirectory, 'config.json'), 'utf8'));
if (!config.egress || typeof config.egress.ca !== 'string') throw Error('no egress configuration');
const operations = Array.isArray(config.operations) ? config.operations : [];
// The admission record: one append-only descriptor for the turn, each row flushed to disk before the act it records (and the
// directory entry flushed once, when the record is new). A failed write throws, and the request it was for is not sent.
const admissionPath = join(stateDirectory, 'admission.jsonl');
const admission = openSync(admissionPath, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
{ const dir = openSync(stateDirectory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } }
const record = row => {
  const line = Buffer.from(`${JSON.stringify(row)}\n`);
  let written = 0; while (written < line.length) written += writeSync(admission, line, written);
  fsyncSync(admission);
};
const clip = text => (text.length > RECORD_EXCERPT_CHARS ? `${text.slice(0, RECORD_EXCERPT_CHARS)}…` : text);

// The turn's authority: an EC key and a self-signed certificate valid for one day, minted here. The key and the leaf key
// stay in the admission state; only the certificate goes where a command can read it.
const keys = join(stateDirectory, 'egress');
mkdirSync(keys, { recursive: true, mode: 0o700 });
const caKey = join(keys, 'ca.key'), caCert = join(keys, 'ca.pem'), leafKey = join(keys, 'leaf.key');
await run(OPENSSL, ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', caKey], { timeout: 10000 });
writeFileSync(join(keys, 'ca.cnf'), '[req]\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\n[ext]\n'
  + 'basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n', { mode: 0o600 });
await run(OPENSSL, ['req', '-x509', '-new', '-key', caKey, '-sha256', '-days', '1', '-subj', '/CN=Instar tool turn egress checkpoint',
  '-config', join(keys, 'ca.cnf'), '-out', caCert], { timeout: 10000 });
await run(OPENSSL, ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', leafKey], { timeout: 10000 });
const leafKeyPem = readFileSync(leafKey);
writeFileSync(config.egress.ca, readFileSync(caCert));
let serial = 1;
const contexts = new Map();
/** A leaf certificate for exactly one host, signed by the turn's authority (cached for the turn). */
async function contextFor(host) {
  if (!contexts.has(host)) contexts.set(host, (async () => {
    const id = serial++, csr = join(keys, `${id}.csr`), cert = join(keys, `${id}.pem`), ext = join(keys, `${id}.ext`);
    writeFileSync(ext, `subjectAltName=${isIP(host) ? 'IP' : 'DNS'}:${host}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`
      + 'keyUsage=critical,digitalSignature\n', { mode: 0o600 });
    await run(OPENSSL, ['req', '-new', '-key', leafKey, '-subj', `/CN=${host}`, '-out', csr], { timeout: 10000 });
    await run(OPENSSL, ['x509', '-req', '-in', csr, '-CA', caCert, '-CAkey', caKey, '-set_serial', String(1000 + id), '-days', '1',
      '-sha256', '-extfile', ext, '-out', cert], { timeout: 10000 });
    return createSecureContext({ key: leafKeyPem, cert: readFileSync(cert) });
  })());
  return contexts.get(host);
}

/** The host's addresses as this checkpoint resolves them; null when it does not resolve. */
async function resolve(host) {
  if (isIP(host)) return [host];
  try { return (await lookup(host, { all: true, verbatim: true })).map(entry => entry.address); } catch { return null; }
}

let active = 0, tunnels = 0, requests = 0, down = 0, up = 0;
/** The next request id, or null past the turn's request budget (the first refusal past it is recorded, later ones are not). */
const budget = reason => {
  const rid = ++requests;
  if (rid <= EGRESS_LIMITS.maxRequests) return rid;
  if (rid === EGRESS_LIMITS.maxRequests + 1) try { record({ phase: 'egress-budget', rid, reason }); } catch { /* refused either way */ }
  return null;
};
const OVER_BUDGET = `shell network refused: per-turn request bound ${EGRESS_LIMITS.maxRequests}`;
/** Repositories whose discovery this turn answered as a git server: a POST negotiating a fetch from one is a read. */
const gitRepositories = new Set();
const mediaType = value => String(value ?? '').split(';')[0].trim().toLowerCase();
const refuse = (res, rid, status, reason) => {
  const body = `Instar egress checkpoint refused this request: ${reason}\n`;
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(body),
    'x-instar-refusal': reason.replace(/[^\x20-\x7e]/gu, '?').slice(0, 512), connection: 'close' });
  res.end(body);
  if (rid !== null) record({ phase: 'egress-done', rid, status, down: 0, up: 0 });
};

/** One request: decided and recorded, then forwarded to the checked address or refused with its reason. */
async function handle(req, res, tunnel) {
  const rid = budget(OVER_BUDGET);
  if (rid === null) { refuse(res, null, 403, OVER_BUDGET); return; }
  const url = tunnel ? `https://${isIP(tunnel.host) === 6 ? `[${tunnel.host}]` : tunnel.host}${tunnel.port === 443 ? '' : `:${tunnel.port}`}${req.url}` : String(req.url);
  const target = webReadHost(url);
  const addresses = tunnel ? tunnel.addresses : target.host === null ? null : await resolve(target.host);
  const repository = gitUploadPackBase(req.method, url);
  const gitFetch = String(req.method).toUpperCase() === 'POST' && repository !== null && gitRepositories.has(repository)
    && mediaType(req.headers['content-type']) === GIT_UPLOAD_PACK_TYPES.request;
  let decision = admitEgress({ method: req.method, url, gitFetch }, addresses, operations);
  if (decision.decision === 'allow' && req.headers.upgrade) decision = { decision: 'deny', reason: 'shell network refused: protocol upgrade', kind: 'scope' };
  if (decision.decision === 'allow' && active >= EGRESS_LIMITS.maxConcurrent)
    decision = { decision: 'deny', reason: `shell network refused: ${EGRESS_LIMITS.maxConcurrent} requests already open`, kind: 'budget' };
  // The record is on disk before anything leaves this machine (an act follows its recorded cause); if it cannot be written
  // this throws and the request is closed unsent.
  record({ phase: 'egress', rid, method: String(req.method), url: clip(url), addresses: (addresses ?? []).slice(0, 8),
    decision: decision.decision, reason: decision.reason, ...(decision.kind ? { kind: decision.kind } : {}) });
  if (decision.decision !== 'allow') { refuse(res, rid, 403, decision.reason); return; }
  const parsed = new URL(url), https = parsed.protocol === 'https:';
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) if (!HOP.has(name) && !name.startsWith('proxy-')) headers[name] = value;
  active++;
  let settled = false, sent = 0, received = 0;
  // The outcome row follows the act; if it cannot be written the next request's own record refuses that request.
  const finish = status => { if (settled) return; settled = true; active--; try { record({ phase: 'egress-done', rid, status, down: received, up: sent }); } catch { /* recorded loss */ } };
  const upstream = (https ? httpsRequest : httpRequest)({ host: addresses[0], port: Number(parsed.port || EGRESS_PORTS[parsed.protocol]),
    method: req.method, path: `${parsed.pathname}${parsed.search}`, headers, ...(https ? { servername: isIP(target.host) ? undefined : target.host } : {}),
    timeout: EGRESS_LIMITS.idleMs, agent: false });
  upstream.on('timeout', () => upstream.destroy(Error('idle timeout')));
  upstream.on('error', error => {
    if (!res.headersSent) { const body = `Instar egress checkpoint: upstream failed: ${error.message}\n`;
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(body), connection: 'close' }); res.end(body); }
    else res.destroy();
    finish(502);
  });
  upstream.on('response', response => {
    // git's discovery answered as a git server establishes this repository for the fetch that follows.
    if (repository !== null && String(req.method).toUpperCase() === 'GET' && response.statusCode === 200
      && mediaType(response.headers['content-type']) === GIT_UPLOAD_PACK_TYPES.advertisement) gitRepositories.add(repository);
    const out = {};
    for (const [name, value] of Object.entries(response.headers)) if (!HOP.has(name)) out[name] = value;
    res.writeHead(response.statusCode ?? 502, out);
    response.on('data', chunk => {
      received += chunk.length; down += chunk.length;
      if (down > EGRESS_LIMITS.maxDownBytes) { response.destroy(); res.destroy(); finish(response.statusCode ?? 502); return; }
      if (!res.write(chunk)) { response.pause(); res.once('drain', () => response.resume()); }
    });
    response.on('end', () => { res.end(); finish(response.statusCode ?? 502); });
    response.on('error', () => { res.destroy(); finish(response.statusCode ?? 502); });
  });
  req.on('data', chunk => {
    sent += chunk.length; up += chunk.length;
    if (up > EGRESS_LIMITS.maxUpBytes) { upstream.destroy(Error('upstream byte bound')); return; }
    upstream.write(chunk);
  });
  req.on('end', () => upstream.end());
  res.on('close', () => { if (!settled) { upstream.destroy(); finish(499); } });
}

// An unexpected error fails that one request (closed, recorded), never the checkpoint: the turn keeps its network.
const failRequest = (res, error) => {
  res.destroy();
  try { record({ phase: 'egress-error', error: clip(String(error?.message ?? error)) }); } catch { /* the record itself failed: nothing was sent */ }
};
const plain = createServer((req, res) => { handle(req, res, null).catch(error => failRequest(res, error)); });
const inner = createServer((req, res) => { handle(req, res, req.socket.tunnel).catch(error => failRequest(res, error)); });
for (const server of [plain, inner]) { server.keepAliveTimeout = EGRESS_LIMITS.idleMs; server.headersTimeout = EGRESS_LIMITS.idleMs; }
// HTTPS: the tunnel's host is checked and pinned before the tunnel opens; each request inside it is then decided on its own.
plain.on('connect', (req, socket) => {
  // The tunnel takes its slots first: one from the turn's request budget and one open-tunnel slot, released when it closes.
  const rid = budget(OVER_BUDGET);
  const deny = (reason, row) => {
    if (row) try { record(row); } catch { socket.destroy(); return; }
    socket.end(`HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\nx-instar-refusal: ${reason.replace(/[^\x20-\x7e]/gu, '?').slice(0, 512)}\r\n`
      + `connection: close\r\n\r\nInstar egress checkpoint refused this connection: ${reason}\n`);
  };
  socket.on('error', () => socket.destroy());
  if (rid === null) { deny(OVER_BUDGET, null); return; }
  if (tunnels >= EGRESS_LIMITS.maxConcurrent) {
    const reason = `shell network refused: ${EGRESS_LIMITS.maxConcurrent} tunnels already open`;
    deny(reason, { phase: 'egress', rid, method: 'CONNECT', url: clip(`https://${String(req.url)}/`), addresses: [], decision: 'deny', reason, kind: 'budget' });
    return;
  }
  tunnels++;
  let released = false;
  socket.once('close', () => { if (!released) { released = true; tunnels--; } });
  socket.setTimeout(EGRESS_LIMITS.idleMs, () => socket.destroy());
  (async () => {
    const [host, portText] = String(req.url).split(/:(?=\d+$)/u);
    const port = Number(portText);
    const name = String(host).replace(/^\[|\]$/gu, '').toLowerCase();
    const literal = isIP(name) === 6 ? `[${name}]` : name;
    const target = webReadHost(`https://${literal}/`), addresses = target.host === null ? null : await resolve(target.host);
    // The tunnel itself carries no method yet: only its host and address are checked here (any method passes this step).
    const check = admitEgress({ method: 'CONNECT', url: `https://${literal}:${port}/` }, addresses, ['tool:network-write']);
    if (port !== 443 || check.decision !== 'allow') {
      const reason = port !== 443 ? `shell network refused: port ${String(port)} is not the web's https: port` : check.reason;
      deny(reason, { phase: 'egress', rid, method: 'CONNECT', url: clip(`https://${literal}:${String(port)}/`), addresses: (addresses ?? []).slice(0, 8),
        decision: 'deny', reason, kind: 'scope' });
      return;
    }
    if (socket.destroyed) return;
    const secureContext = await contextFor(name);
    if (socket.destroyed) return;
    socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
    const tls = new TLSSocket(socket, { isServer: true, secureContext, ALPNProtocols: ['http/1.1'] });
    tls.tunnel = { host: name, port, addresses };
    tls.on('error', () => tls.destroy());
    inner.emit('connection', tls);
  })().catch(() => socket.destroy());
});

const listen = (server, host, port) => new Promise((done, failed) => { server.once('error', failed); server.listen(port, host, () => done(server.address().port)); });
const port = await listen(plain, '127.0.0.1', 0);
// `localhost` may resolve to ::1 first; the same port there, when the host offers it.
const plain6 = createServer(plain.listeners('request')[0]);
plain6.on('connect', (...args) => plain.emit('connect', ...args));
await listen(plain6, '::1', port).catch(() => null);
const stop = () => { for (const server of [plain, plain6, inner]) { server.closeAllConnections?.(); server.close(); } process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
setTimeout(stop, EGRESS_LIMITS.lifetimeMs).unref();
process.stdout.write(`${JSON.stringify({ port, ca: config.egress.ca })}\n`);
