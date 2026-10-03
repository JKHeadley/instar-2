// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule: the sandboxed shell's network checkpoint
// (egress-proxy.mjs). A real client (/usr/bin/curl, the one the sandboxed shell runs) goes through the real proxy to a
// local HTTPS server standing in for a public host: `resolve` names a public address and `dial` reaches the local server,
// so the address rule decides exactly as it does for the real internet. Both sides of each decision: reads are forwarded
// and writes refused at the effect doorway (and admitted when the profile registers them); public hosts are reached and
// loopback, private, link-local, CGNAT and local names are refused before any connection; bytes, requests and
// connections are bounded; close() ends every connection. The live proof through the real harness sandbox is
// tests/integration/tool-turn-full-live.test.ts (cases shellnet-reads and shellnet-writes).
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import https from 'node:https';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The checkpoint stays plain JavaScript beside the hook it serves.
import { createTrustRoot, EGRESS_LIMITS, leafPem, readEgressRecord, startEgressProxy } from './egress-proxy.mjs';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';

const run = promisify(execFile);
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const step of cleanup.splice(0).reverse()) await step(); });
const PUBLIC = '93.184.215.14';
type Seen = { method: string; url: string; host: string; body: string };

/** A local HTTPS server with its own root, standing in for a public host; it records every request it receives. */
async function upstream(names: string[]) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'egress-up-')));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const root = await createTrustRoot(join(dir, 'root'), join(dir, 'root.pem'));
  const seen: Seen[] = [];
  const server = https.createServer({ key: root.leafKey, cert: await leafPem(root, names[0]) }, (req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; });
    req.on('end', () => { seen.push({ method: String(req.method), url: String(req.url), host: String(req.headers.host), body });
      const size = Number(new URL(String(req.url), 'https://x').searchParams.get('bytes') ?? 0);
      res.writeHead(200, { 'content-type': 'text/plain' }); res.end(size ? 'x'.repeat(size) : `hello from ${String(req.headers.host)}`); });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  cleanup.push(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()); }));
  return { seen, ca: root.cert, port: (server.address() as { port: number }).port };
}

/** A checkpoint as a turn runs it, its upstream reached through `dial`. `addresses` is what each name resolves to. */
async function checkpoint(up: { ca: string; port: number }, options: { operations?: string[]; limits?: object; addresses?: Record<string, string[]>;
  plainPort?: number } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'egress-turn-')));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const state = join(dir, 'state'); mkdirSync(state, { mode: 0o700 });
  const resolved: Record<string, string[]> = { 'example.test': [PUBLIC], ...options.addresses };
  const proxy = await startEgressProxy({ stateDirectory: state, caPath: join(dir, 'ca.pem'), operations: options.operations ?? [...SINGLE_MACHINE_PROFILE.operations],
    limits: { ...EGRESS_LIMITS, ...options.limits }, resolve: async (host: string) => resolved[host] ?? [],
    upstream: { ca: up.ca }, dial: (_address: string, port: number) => ({ host: '127.0.0.1', port: port === 443 ? up.port : options.plainPort ?? port }) });
  cleanup.push(() => proxy.close());
  /** The sandboxed shell's own client, pointed at the checkpoint exactly as the shell prefix points it. */
  const curl = async (...args: string[]) => {
    try { const { stdout, stderr } = await run('/usr/bin/curl', ['-sS', '-m', '15', '--proxy', `http://127.0.0.1:${String(proxy.port)}`, '--cacert', join(dir, 'ca.pem'),
      '-D', '-', ...args], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', NO_PROXY: '' } }); return { code: 0, out: stdout + stderr }; }
    catch (error) { const e = error as { code: number; stdout: string; stderr: string }; return { code: e.code, out: e.stdout + e.stderr }; }
  };
  return { proxy, curl, state, record: () => readEgressRecord(state) };
}

it('a GET or HEAD of a public host is forwarded through the intercepted tunnel, with the method and path recorded', async () => {
  const up = await upstream(['example.test']);
  const { curl, record } = await checkpoint(up);
  const got = await curl('https://example.test/page?q=1');
  expect(got.code).toBe(0); expect(got.out).toContain('hello from example.test');
  expect((await curl('-I', 'https://example.test/head')).out).toMatch(/^HTTP\/1\.1 200/mu);
  expect(up.seen.map(row => [row.method, row.url, row.host])).toEqual([['GET', '/page?q=1', 'example.test'], ['HEAD', '/head', 'example.test']]);
  const rows = record().requests;
  expect(rows.filter((row: { kind: string }) => row.kind !== 'tunnel')).toEqual([
    expect.objectContaining({ method: 'GET', scheme: 'https', host: 'example.test', path: '/page?q=1', decision: 'allow', kind: 'network-read', address: PUBLIC, status: 200 }),
    expect.objectContaining({ method: 'HEAD', path: '/head', decision: 'allow', kind: 'network-read', status: 200 })]);
  expect(rows.filter((row: { kind: string }) => row.kind === 'tunnel')).toHaveLength(2);
});

it('a write is refused at the effect doorway and never reaches the host; a profile registering network writes admits it', async () => {
  const up = await upstream(['example.test']);
  const closed = await checkpoint(up);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const got = await closed.curl('-X', method, '-d', 'note=hi', 'https://example.test/api');
    expect(got.out).toMatch(/^HTTP\/1\.1 403/mu);
    expect(got.out).toContain(`${method} is a network write: effect doorway: the installed profile registers no tool:network-write operation`);
  }
  expect(up.seen).toEqual([]);
  expect(closed.record().requests.filter((row: { kind: string }) => row.kind === 'network-write').map((row: { decision: string }) => row.decision))
    .toEqual(['deny', 'deny', 'deny', 'deny']);
  // The other side of the doorway's decision: an installed profile that registers the effect admits the same request.
  const open = await checkpoint(up, { operations: [...SINGLE_MACHINE_PROFILE.operations, 'tool:network-write'] });
  const got = await open.curl('-X', 'POST', '-d', 'note=hi', 'https://example.test/api');
  expect(got.out).toContain('hello from example.test');
  expect(up.seen).toEqual([{ method: 'POST', url: '/api', host: 'example.test', body: 'note=hi' }]);
  expect(open.record().requests.at(-1)).toMatchObject({ method: 'POST', decision: 'allow', kind: 'network-write', reason: 'registered operation tool:network-write' });
});

it('a git fetch is a read and a git push is refused from its discovery request on', async () => {
  const up = await upstream(['example.test']);
  const { curl, record } = await checkpoint(up);
  expect((await curl('https://example.test/r.git/info/refs?service=git-upload-pack')).out).toContain('hello');
  expect((await curl('-X', 'POST', '-H', 'content-type: application/x-git-upload-pack-request', '-d', '0000', 'https://example.test/r.git/git-upload-pack')).out).toContain('hello');
  const push = await curl('https://example.test/r.git/info/refs?service=git-receive-pack');
  expect(push.out).toMatch(/^HTTP\/1\.1 403/mu); expect(push.out).toContain('a git push: effect doorway');
  expect((await curl('-X', 'POST', '-d', '0000', 'https://example.test/r.git/git-receive-pack')).out).toMatch(/^HTTP\/1\.1 403/mu);
  expect(up.seen.map(row => [row.method, row.url])).toEqual([['GET', '/r.git/info/refs?service=git-upload-pack'], ['POST', '/r.git/git-upload-pack']]);
  expect(record().requests.filter((row: { kind: string }) => row.kind !== 'tunnel').map((row: { decision: string; reason: string }) => [row.decision, row.reason.split(':')[0]]))
    .toEqual([['allow', 'GET read'], ['allow', 'git fetch'], ['deny', 'a git push'], ['deny', 'a git push']]);
});

it('this machine and its network are refused before any connection: loopback, private, link-local, CGNAT, local names, private resolutions', async () => {
  const up = await upstream(['example.test']);
  const { curl, record } = await checkpoint(up, { addresses: { 'inside.test': ['10.1.2.3'], 'mixed.test': [PUBLIC, '192.168.1.5'], 'mapped.test': ['::ffff:127.0.0.1'] } });
  const targets = ['https://127.0.0.1/', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://10.0.0.1/', 'https://172.16.5.4/', 'https://192.168.1.1/',
    'https://169.254.169.254/latest/meta-data/', 'https://100.64.0.1/', 'https://100.100.100.100/', 'https://localhost/', 'https://printer.local/',
    'https://inside.test/', 'https://mixed.test/', 'https://mapped.test/', 'https://nowhere.test/', 'http://127.0.0.1:4042/health', 'http://10.0.0.1/',
    'http://100.100.100.100/', 'http://inside.test/'];
  for (const url of targets) {
    const got = await curl(url);
    expect(got.code === 0 ? got.out : `${got.out} exit ${String(got.code)}`).toMatch(/403|CONNECT tunnel failed/u);
  }
  expect(up.seen).toEqual([]);
  const rows = record().requests;
  expect(rows).toHaveLength(targets.length);
  expect(rows.every((row: { decision: string; kind: string }) => row.decision === 'deny' && row.kind === 'scope')).toBe(true);
  expect(rows.map((row: { reason: string }) => row.reason)).toEqual(expect.arrayContaining(['host refused: address 127.0.0.1 is not public',
    'host refused: address 100.64.0.1 is not public', 'host refused: inside.test resolves to a non-public address',
    'host refused: mixed.test resolves to a non-public address', 'host refused: nowhere.test did not resolve', 'host refused: host localhost is a local name']));
  // The other side: a plain-HTTP read of a public host goes through.
  const plain = createServer((req, res) => { res.end(`plain ${String(req.method)} ${String(req.url)}`); });
  await new Promise<void>(done => plain.listen(0, '127.0.0.1', done));
  cleanup.push(() => new Promise<void>(done => { plain.closeAllConnections(); plain.close(() => done()); }));
  const http = await checkpoint(up, { plainPort: (plain.address() as { port: number }).port });
  expect((await http.curl('http://example.test/x')).out).toContain('plain GET /x');
  expect(http.record().requests[0]).toMatchObject({ method: 'GET', scheme: 'http', host: 'example.test', port: 80, decision: 'allow', status: 200 });
});

it('an upstream certificate the system does not trust is refused (the checkpoint verifies the real host)', async () => {
  const up = await upstream(['example.test']);
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'egress-untrusted-'))); cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const state = join(dir, 'state'); mkdirSync(state);
  const proxy = await startEgressProxy({ stateDirectory: state, caPath: join(dir, 'ca.pem'), operations: [], resolve: async () => [PUBLIC],
    dial: () => ({ host: '127.0.0.1', port: up.port }) });
  cleanup.push(() => proxy.close());
  const { stdout } = await run('/usr/bin/curl', ['-sS', '-m', '15', '-D', '-', '--proxy', `http://127.0.0.1:${String(proxy.port)}`, '--cacert', join(dir, 'ca.pem'),
    'https://example.test/'], { encoding: 'utf8' });
  expect(stdout).toMatch(/^HTTP\/1\.1 502/mu); expect(stdout).toMatch(/upstream failed: .*certificate/iu);
  expect(up.seen).toEqual([]);
});

it('bounds: bytes, requests and concurrent connections are capped; close() ends every connection and the port', async () => {
  const up = await upstream(['example.test']);
  const small = await checkpoint(up, { limits: { maxBytes: 100000 } });
  expect((await small.curl('https://example.test/ok?bytes=1000')).code).toBe(0);
  const big = await small.curl('https://example.test/big?bytes=400000');
  expect(big.code).not.toBe(0);
  expect(small.record().limited).toBe('byte bound 100000 reached');
  const counted = await checkpoint(up, { limits: { maxRequests: 3 } });
  expect((await counted.curl('https://example.test/1')).code).toBe(0); // CONNECT + GET: requests 1 and 2
  const third = await counted.curl('https://example.test/2'); // CONNECT is request 3, its GET is 4
  expect(third.out).toMatch(/429/u);
  expect(counted.record().requests.at(-1)).toMatchObject({ decision: 'deny', kind: 'budget', reason: 'request bound 3 reached' });
  // One connection at a time: a second is closed at once while the first is held open.
  const single = await checkpoint(up, { limits: { maxConnections: 1 } });
  const held = connect(single.proxy.port, '127.0.0.1'); held.on('error', () => undefined);
  await new Promise(done => held.once('connect', done));
  const refused = await single.curl('https://example.test/3');
  expect(refused.code).not.toBe(0);
  held.destroy();
  // close(): an open connection is ended and the port takes no new one.
  const closing = await checkpoint(up);
  const open = connect(closing.proxy.port, '127.0.0.1'); open.on('error', () => undefined);
  await new Promise(done => open.once('connect', done));
  const ended = new Promise(done => open.once('close', done));
  await closing.proxy.close();
  await ended;
  const after = await closing.curl('https://example.test/4');
  expect(after.code).toBe(7);
});

it('the trust root key stays in the admission state; only the public certificate is placed for the shell', async () => {
  const up = await upstream(['example.test']);
  const { state } = await checkpoint(up);
  const files = readFileSync(join(state, 'egress-trust', 'ca.pem'), 'utf8');
  expect(files).toMatch(/BEGIN CERTIFICATE/u);
  const placed = readFileSync(join(state, '..', 'ca.pem'), 'utf8');
  expect(placed).toBe(files); expect(placed).not.toMatch(/PRIVATE KEY/u);
  const { stdout } = await run('/usr/bin/openssl', ['x509', '-in', join(state, '..', 'ca.pem'), '-noout', '-text'], { encoding: 'utf8' });
  expect(stdout).toMatch(/CA:TRUE, pathlen:0/u);
});
