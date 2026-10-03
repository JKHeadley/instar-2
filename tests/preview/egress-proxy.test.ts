// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule: the sandboxed shell's network checkpoint
// (egress-proxy.mjs). A real client (/usr/bin/curl, the one the sandboxed shell runs) goes through the real proxy to a
// local HTTPS server standing in for a public host: `resolve` names a public address and `dial` reaches the local server,
// so the address rule decides exactly as it does for the real internet. Both sides of each decision: reads are forwarded
// and writes refused at the effect doorway (and admitted when the profile registers them); public hosts are reached and
// loopback, private, link-local, CGNAT and local names are refused before any connection; bytes, requests and
// connections are bounded; close() ends every connection. The live proof through the real harness sandbox is
// tests/integration/tool-turn-full-live.test.ts (cases shellnet-reads and shellnet-writes).
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
async function checkpoint(up: { ca: string; port: number }, options: { admission?: object; limits?: object; addresses?: Record<string, string[]>;
  plainPort?: number } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'egress-turn-')));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const state = join(dir, 'state'); mkdirSync(state, { mode: 0o700 });
  const resolved: Record<string, string[]> = { 'example.test': [PUBLIC], ...options.addresses };
  const proxy = await startEgressProxy({ stateDirectory: state, caPath: join(dir, 'ca.pem'),
    admission: options.admission ?? { operations: [...SINGLE_MACHINE_PROFILE.operations] },
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

it('a write is refused at the effect doorway and never reaches the host; an operator policy registering and granting it admits it', async () => {
  const up = await upstream(['example.test']);
  const closed = await checkpoint(up);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const got = await closed.curl('-X', method, '-d', 'note=hi', 'https://example.test/api');
    expect(got.out).toMatch(/^HTTP\/1\.1 403/mu);
    expect(got.out).toContain(`${method} is a network write: effect doorway refused tool:network-write (example.test)`);
  }
  expect(up.seen).toEqual([]);
  expect(closed.record().requests.filter((row: { kind: string }) => row.kind === 'network-write').map((row: { decision: string }) => row.decision))
    .toEqual(['deny', 'deny', 'deny', 'deny']);
  // The other side of the doorway's decision: the operator's effect policy registers the write on this host and grants it
  // into scope, and the same request is admitted.
  const open = await checkpoint(up, { admission: { operations: [...SINGLE_MACHINE_PROFILE.operations], effectPolicy: { type: 'PreviewEffectPolicy',
    resourceLevelUsd: 0, policySensitive: [], registered: [{ effect: 'tool:network-write', target: 'example.test', consequence: 'data',
      reversibility: 'reversible', reach: 'world', costUsd: 0, source: 'telegram:102965:121996' }],
    grants: [{ id: 'g-api', effect: 'tool:network-write', target: 'example.test', approves: ['scope'], source: 'telegram:102965:121996',
      custodian: 'desk', recovery: 'remove the grant' }] } } });
  const got = await open.curl('-X', 'POST', '-d', 'note=hi', 'https://example.test/api');
  expect(got.out).toContain('hello from example.test');
  expect(up.seen).toEqual([{ method: 'POST', url: '/api', host: 'example.test', body: 'note=hi' }]);
  expect(open.record().requests.at(-1)).toMatchObject({ method: 'POST', decision: 'allow', kind: 'network-write',
    reason: expect.stringContaining('tool:network-write is ordinary (none of the four consequential-effect tests holds); admitted') });
});

/** A local HTTPS git server (git's own http-backend, the smart-HTTP server) standing in for a public git host, holding one
 * repository `r.git` with one commit; every request it receives is recorded. */
async function gitUpstream() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'egress-git-')));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const env = { PATH: '/usr/bin:/bin', HOME: dir, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  mkdirSync(join(dir, 'work'));
  writeFileSync(join(dir, 'work', 'hello.txt'), 'hello from a git fetch\n');
  for (const args of [['init', '-q', '-b', 'main'], ['add', '.'], ['commit', '-q', '-m', 'one']]) await run('/usr/bin/git', ['-C', join(dir, 'work'), ...args], { env });
  await run('/usr/bin/git', ['clone', '-q', '--bare', join(dir, 'work'), join(dir, 'r.git')], { env });
  const backend = join((await run('/usr/bin/git', ['--exec-path'], { encoding: 'utf8' })).stdout.trim(), 'git-http-backend');
  const root = await createTrustRoot(join(dir, 'root'), join(dir, 'root.pem'));
  const seen: Seen[] = [];
  const server = https.createServer({ key: root.leafKey, cert: await leafPem(root, 'example.test') }, (req, res) => {
    const chunks: Buffer[] = []; req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const url = new URL(String(req.url), 'https://x'), body = Buffer.concat(chunks);
      seen.push({ method: String(req.method), url: String(req.url), host: String(req.headers.host), body: body.toString('latin1') });
      const cgi = spawn(backend, [], { env: { ...env, GIT_PROJECT_ROOT: dir, GIT_HTTP_EXPORT_ALL: '1', PATH_INFO: url.pathname, QUERY_STRING: url.search.slice(1),
        REQUEST_METHOD: String(req.method), CONTENT_TYPE: String(req.headers['content-type'] ?? ''), CONTENT_LENGTH: String(body.length),
        HTTP_CONTENT_ENCODING: String(req.headers['content-encoding'] ?? ''), GIT_PROTOCOL: String(req.headers['git-protocol'] ?? ''), REMOTE_ADDR: '127.0.0.1' } });
      const out: Buffer[] = []; cgi.stdout.on('data', chunk => out.push(chunk));
      cgi.on('close', () => {
        const all = Buffer.concat(out), split = all.indexOf('\r\n\r\n');
        const head = all.subarray(0, split).toString('latin1').split('\r\n'), headers: Record<string, string> = {};
        let status = 200;
        for (const line of head) { const [name = '', ...rest] = line.split(':'); if (/^status$/iu.test(name)) status = Number(rest.join(':').trim().split(' ')[0]); else headers[name] = rest.join(':').trim(); }
        res.writeHead(status, headers); res.end(all.subarray(split + 4));
      });
      cgi.stdin.end(body);
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  cleanup.push(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()); }));
  return { seen, ca: root.cert, port: (server.address() as { port: number }).port, dir };
}

it('a genuine git fetch is a read; a git push is refused from its discovery request on', async () => {
  const up = await gitUpstream();
  const { proxy, curl, record, state } = await checkpoint(up);
  // The real git client clones through the checkpoint, exactly as the shell prefix points it.
  const into = join(up.dir, 'clone');
  await run('/usr/bin/git', ['clone', '-q', 'https://example.test/r.git', into], { env: { PATH: '/usr/bin:/bin', HOME: up.dir, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
    https_proxy: `http://127.0.0.1:${String(proxy.port)}`, GIT_SSL_CAINFO: join(state, '..', 'ca.pem') } });
  expect(readFileSync(join(into, 'hello.txt'), 'utf8')).toBe('hello from a git fetch\n');
  const fetched = record().requests.filter((row: { kind: string }) => row.kind !== 'tunnel');
  expect(fetched.length).toBeGreaterThanOrEqual(2);
  expect(fetched.every((row: { decision: string; kind: string }) => row.decision === 'allow' && row.kind === 'network-read')).toBe(true);
  expect(fetched.filter((row: { reason: string }) => row.reason === 'git fetch').length).toBeGreaterThanOrEqual(1);
  const before = up.seen.length;
  const push = await curl('https://example.test/r.git/info/refs?service=git-receive-pack');
  expect(push.out).toMatch(/^HTTP\/1\.1 403/mu); expect(push.out).toContain('a git push: effect doorway');
  expect((await curl('-X', 'POST', '-d', '0000', 'https://example.test/r.git/git-receive-pack')).out).toMatch(/^HTTP\/1\.1 403/mu);
  expect(up.seen.length).toBe(before);
});

it('an upload-pack path name, content type or method override (naming a write or a read) does not make a write a read', async () => {
  const up = await upstream(['example.test']);
  const { curl, record } = await checkpoint(up, { admission: { operations: [] } });
  const fetchType = ['-H', 'content-type: application/x-git-upload-pack-request'];
  const wants = '0032want 0123456789abcdef0123456789abcdef01234567\n00000009done\n';
  const refused = [
    ['-X', 'POST', '-d', 'send=hello', 'https://example.test/messages'],
    ['-X', 'POST', '-d', 'send=hello', 'https://example.test/messages/git-upload-pack'],
    // Typed as a fetch and shaped as one, but the repository never answered a git discovery in this turn.
    ['-X', 'POST', ...fetchType, '--data-binary', wants, 'https://example.test/messages/git-upload-pack'],
    ['-H', 'X-HTTP-Method-Override: DELETE', 'https://example.test/messages/1'],
    ['-H', 'X-HTTP-Method: POST', 'https://example.test/messages/1'],
    ['-I', '-H', 'X-Method-Override: PUT', 'https://example.test/messages/1'],
    // An override naming a read never downgrades a write, and one override cannot hide another's write.
    ['-X', 'POST', '-H', 'X-HTTP-Method-Override: GET', '-d', 'send=hello', 'https://example.test/messages'],
    ['-X', 'DELETE', '-H', 'X-HTTP-Method-Override: HEAD', 'https://example.test/messages/1'],
    ['-H', 'X-HTTP-Method-Override: GET', '-H', 'X-Method-Override: DELETE', 'https://example.test/messages/1'],
  ];
  for (const args of refused) expect((await curl(...args)).out).toMatch(/^HTTP\/1\.1 403/mu);
  expect(up.seen).toEqual([]);
  const writes = record().requests.filter((row: { kind: string }) => row.kind === 'network-write');
  expect(writes.map((row: { decision: string }) => row.decision)).toEqual(refused.map(() => 'deny'));
  expect(writes[2].reason).toContain('the repository did not advertise git upload-pack in this turn');
  // A plain GET still reads.
  expect((await curl('https://example.test/messages/1')).out).toContain('hello from example.test');
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
  const proxy = await startEgressProxy({ stateDirectory: state, caPath: join(dir, 'ca.pem'), admission: { operations: [] }, resolve: async () => [PUBLIC],
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

it('reaching the byte bound is terminal for the turn: a later request or connection is refused and nothing more is forwarded', async () => {
  const up = await upstream(['example.test']);
  // The other side: below the bound, reads pass.
  const roomy = await checkpoint(up, { limits: { maxBytes: 100000 } });
  expect((await roomy.curl('https://example.test/a?bytes=1000')).code).toBe(0);
  expect((await roomy.curl('https://example.test/b?bytes=1000')).code).toBe(0);
  const small = await checkpoint(up, { limits: { maxBytes: 100 } });
  const first = await small.curl('https://example.test/big?bytes=1000');
  expect(first.code).not.toBe(0); expect(first.out).not.toContain('xxxxxxxxxx');
  expect(small.record().limited).toBe('byte bound 100 reached');
  const seen = up.seen.length, bytes = small.proxy.stats().bytes;
  const again = await small.curl('https://example.test/again?bytes=1000');
  expect(again.code).not.toBe(0); expect(again.out).not.toContain('xxxxxxxxxx');
  expect(up.seen.length).toBe(seen);
  expect(small.proxy.stats().bytes).toBe(bytes);
  expect(bytes).toBeLessThanOrEqual(100 + 1000);
});

it('a request waiting on name resolution when the turn stops never connects or records an admission', async () => {
  let connections = 0;
  const plain = createServer((req, res) => { res.end('late'); });
  plain.on('connection', () => { connections++; });
  await new Promise<void>(done => plain.listen(0, '127.0.0.1', done));
  cleanup.push(() => new Promise<void>(done => { plain.closeAllConnections(); plain.close(() => done()); }));
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'egress-stop-'))); cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const state = join(dir, 'state'); mkdirSync(state);
  let release: (addresses: string[]) => void = () => undefined, asked: () => void = () => undefined;
  const pending = new Promise<void>(done => { asked = done; });
  const proxy = await startEgressProxy({ stateDirectory: state, caPath: join(dir, 'ca.pem'), admission: { operations: [] },
    resolve: () => { asked(); return new Promise<string[]>(done => { release = done; }); },
    dial: () => ({ host: '127.0.0.1', port: (plain.address() as { port: number }).port }) });
  cleanup.push(() => proxy.close());
  const client = run('/usr/bin/curl', ['-sS', '-m', '15', '--proxy', `http://127.0.0.1:${String(proxy.port)}`, 'http://example.test/x'], { encoding: 'utf8' })
    .then(() => 'answered', () => 'disconnected');
  await pending;
  await proxy.close();
  expect(await client).toBe('disconnected');
  release([PUBLIC]);
  await new Promise(done => setTimeout(done, 300));
  expect(connections).toBe(0);
  expect(readEgressRecord(state).requests.filter((row: { decision: string }) => row.decision === 'allow')).toEqual([]);
  // The other side: the same delayed resolution, answered while the turn runs, is forwarded.
  const dir2 = realpathSync(mkdtempSync(join(tmpdir(), 'egress-stop-'))); cleanup.push(() => rmSync(dir2, { recursive: true, force: true }));
  const state2 = join(dir2, 'state'); mkdirSync(state2);
  const live = await startEgressProxy({ stateDirectory: state2, caPath: join(dir2, 'ca.pem'), admission: { operations: [] },
    resolve: () => new Promise<string[]>(done => setTimeout(() => done([PUBLIC]), 50)),
    dial: () => ({ host: '127.0.0.1', port: (plain.address() as { port: number }).port }) });
  cleanup.push(() => live.close());
  const { stdout } = await run('/usr/bin/curl', ['-sS', '-m', '15', '--proxy', `http://127.0.0.1:${String(live.port)}`, 'http://example.test/x'], { encoding: 'utf8' });
  expect(stdout).toBe('late'); expect(connections).toBe(1);
});
