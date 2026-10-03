// Part Thirteen §9 (docs/17-harness-adapters), the shell's network through the turn's egress checkpoint. Both sides of every
// decision the checkpoint adds: a read of a public host on the web's ports is ordinary work; a write (any other method, git's
// push discovery and upload) goes to the effect doorway, refused unless the installed profile registers it; a target that is
// this machine or its network (loopback, private, link-local, shared, mapped IPv6, or a name resolving to one), another port,
// or a credentialed URL is refused. The real checkpoint process is run offline here (every request below is decided before any
// connection, so nothing leaves the machine) and stopped by its exact process id. Rule 36: the egress rows the real pinned
// harness recorded (fixtures/tool-turn/shellnet-2026-10-03, tests/integration/tool-turn-shellnet-harness.test.ts) replay
// through admitEgress with their recorded addresses to their recorded decisions.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error The admission decision stays plain JavaScript: the harness runs the hook without a loader.
import { admitEgress, egressRequestKind, EGRESS_CA_VARIABLES, gitUploadPackBase, EGRESS_PROXY_VARIABLES, toolShellPrefix, toolTrace } from './tool-admission.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { recordEgressPort, startEgressCheckpoint, toolchainReads } from './tool-turn.mjs';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';

const RECORDED = join(__dirname, 'fixtures/tool-turn/shellnet-2026-10-03');
const PUBLIC = ['93.184.215.14'];
const ops = [...SINGLE_MACHINE_PROFILE.operations];
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

it('admits a read of a public host and sends every write to the effect doorway, which refuses unless the profile registers it', () => {
  expect(admitEgress({ method: 'GET', url: 'https://example.com/' }, PUBLIC, ops)).toMatchObject({ decision: 'allow', kind: 'network-read' });
  expect(admitEgress({ method: 'HEAD', url: 'http://example.com/x' }, PUBLIC, ops)).toMatchObject({ decision: 'allow', kind: 'network-read' });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
    expect(admitEgress({ method, url: 'https://example.com/' }, PUBLIC, ops)).toMatchObject({ decision: 'deny', kind: 'network-write',
      reason: expect.stringMatching(/effect doorway: the installed profile registers no tool:network-write operation/u) });
  // The neighbouring case: a profile that registers network writes admits the same POST.
  expect(admitEgress({ method: 'POST', url: 'https://example.com/' }, PUBLIC, [...ops, 'tool:network-write']))
    .toMatchObject({ decision: 'allow', kind: 'network-write' });
  // git: fetch negotiation is a read only once the checkpoint established it (that repository answered discovery as a git
  // server, and the POST carries git's request type); the path alone is a write. Push discovery and upload are writes.
  expect(egressRequestKind('POST', 'https://github.com/o/r.git/git-upload-pack', true)).toBe('read');
  expect(egressRequestKind('POST', 'https://github.com/o/r.git/git-upload-pack')).toBe('write');
  expect(egressRequestKind('POST', 'https://example.com/publish', true)).toBe('write');
  expect(admitEgress({ method: 'POST', url: 'https://example.com/publish/git-upload-pack' }, PUBLIC, ops)).toMatchObject({ decision: 'deny', kind: 'network-write' });
  expect(admitEgress({ method: 'POST', url: 'https://example.com/r.git/git-upload-pack', gitFetch: true }, PUBLIC, ops)).toMatchObject({ decision: 'allow', kind: 'network-read' });
  expect(gitUploadPackBase('GET', 'https://github.com/o/r.git/info/refs?service=git-upload-pack')).toBe('https://github.com/o/r.git');
  expect(gitUploadPackBase('POST', 'https://github.com/o/r.git/git-upload-pack')).toBe('https://github.com/o/r.git');
  expect(gitUploadPackBase('POST', 'https://github.com/o/r.git/git-upload-pack?x=1')).toBe(null);
  expect(gitUploadPackBase('GET', 'https://github.com/o/r.git/info/refs?service=git-receive-pack')).toBe(null);
  expect(egressRequestKind('GET', 'https://github.com/o/r.git/info/refs?service=git-upload-pack')).toBe('read');
  expect(egressRequestKind('GET', 'https://github.com/o/r.git/info/refs?service=git-receive-pack')).toBe('write');
  expect(egressRequestKind('POST', 'https://github.com/o/r.git/git-receive-pack')).toBe('write');
  expect(egressRequestKind('PUT', 'https://registry.npmjs.org/some-package')).toBe('write');
  expect(egressRequestKind('POST', 'https://example.com/upload-pack')).toBe('write');
  expect(egressRequestKind('GET', 'not a url')).toBe('write');
});

it('refuses this machine and its network, another port, a credentialed URL and a name that does not resolve or resolves privately', () => {
  const refused = (url: string, addresses: string[] | null) => admitEgress({ method: 'GET', url }, addresses, ops);
  for (const [url, addresses] of [['http://127.0.0.1/', ['127.0.0.1']], ['http://10.0.0.1/', ['10.0.0.1']], ['http://100.64.1.1/', ['100.64.1.1']],
    ['http://169.254.169.254/latest', ['169.254.169.254']], ['http://192.168.1.1/', ['192.168.1.1']], ['http://[::1]/', ['::1']],
    ['http://[::ffff:127.0.0.1]/', ['::ffff:127.0.0.1']], ['http://[fd00::1]/', ['fd00::1']]] as const)
    expect(refused(url, [...addresses])).toMatchObject({ decision: 'deny', kind: 'scope' });
  expect(refused('http://localhost/', ['127.0.0.1'])).toMatchObject({ decision: 'deny', reason: expect.stringMatching(/local name/u) });
  expect(refused('https://rebind.example/', ['93.184.215.14', '10.0.0.5'])).toMatchObject({ decision: 'deny', reason: expect.stringMatching(/non-public/u) });
  expect(refused('https://nowhere.example/', null)).toMatchObject({ decision: 'deny', reason: expect.stringMatching(/did not resolve/u) });
  expect(refused('https://example.com:8443/', PUBLIC)).toMatchObject({ decision: 'deny', reason: expect.stringMatching(/port 8443/u) });
  expect(refused('https://user:pw@example.com/', PUBLIC)).toMatchObject({ decision: 'deny', reason: expect.stringMatching(/credentials/u) });
  expect(refused('ftp://example.com/', PUBLIC)).toMatchObject({ decision: 'deny', reason: expect.stringMatching(/not a web read/u) });
  // A write to this machine is refused for scope before the doorway is asked.
  expect(admitEgress({ method: 'POST', url: 'http://127.0.0.1/' }, ['127.0.0.1'], [...ops, 'tool:network-write'])).toMatchObject({ decision: 'deny', kind: 'scope' });
});

it('points every client at the checkpoint and its authority, keeps git off the protected .git files, and stays the old prefix without one', () => {
  const tmp = '/private/tmp/itt-0123456789ab/tmp', ca = '/private/tmp/itt-0123456789ab/egress-ca.pem';
  expect(toolShellPrefix(tmp)).toBe(`unset CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_MESSAGING_SOCKET; export TMPDIR=${tmp}; ulimit -f 65536; `);
  const prefix = toolShellPrefix(tmp, { ca, bin: ['/opt/node/bin', '/Library/Developer/CommandLineTools/usr/bin'],
    developer: '/Library/Developer/CommandLineTools', port: 50785 });
  for (const name of EGRESS_CA_VARIABLES) expect(prefix).toContain(`${name}=${ca}`);
  for (const name of EGRESS_PROXY_VARIABLES) expect(prefix).toContain(`${name}=http://127.0.0.1:50785`);
  expect(prefix).toContain('PATH=/opt/node/bin:/Library/Developer/CommandLineTools/usr/bin:$PATH');
  expect(prefix).toContain('DEVELOPER_DIR=/Library/Developer/CommandLineTools');
  expect(prefix).toContain(`--separate-git-dir="${tmp}/git-dirs/`);
  // Before the checkpoint's port is known the trust root is set and the proxy variables are left to the harness.
  expect(toolShellPrefix(tmp, { ca, bin: [] })).not.toContain('http_proxy=');
  for (const bad of [{ ca: 'relative.pem', bin: [] }, { ca, bin: ['/a b'] }, { ca, bin: [], port: 70000 }, { ca, bin: [], developer: '/x;y' }])
    expect(() => toolShellPrefix(tmp, bad)).toThrow(/egress paths/u);
  // The prefix runs in a real shell: git clone and init are given a separate git directory, other git commands pass through.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'egress-prefix-'))); roots.push(root);
  mkdirSync(join(root, 'tmp'));
  const fake = join(root, 'bin'); mkdirSync(fake);
  writeFileSync(join(fake, 'git'), '#!/bin/sh\necho "git $*"\n', { mode: 0o755 });
  const shell = spawnSync('/bin/sh', ['-c', `${toolShellPrefix(join(root, 'tmp'), { ca: join(root, 'ca.pem'), bin: [fake], port: 4000 })}`
    + 'git clone https://example.com/r.git r; git status; echo "$https_proxy $GIT_CONFIG_NOSYSTEM"'], { encoding: 'utf8' });
  const lines = shell.stdout.trim().split('\n');
  expect(lines[0]).toMatch(new RegExp(`^git clone --separate-git-dir=${join(root, 'tmp')}/git-dirs/\\d+-\\d+ https://example.com/r.git r$`, 'u'));
  expect(lines[1]).toBe('git status');
  expect(lines[2]).toBe('http://127.0.0.1:4000 1');
  // The executable hook prefixes an admitted command from the turn's own config (the runner writes egress and its port there).
  const st = join(root, 'state'), ws = join(root, 'ws'); mkdirSync(st); mkdirSync(ws);
  const egress = { ca: join(root, 'egress-ca.pem'), bin: [fake], port: 4000 };
  writeFileSync(join(st, 'config.json'), JSON.stringify({ workspace: realpathSync(ws), tmp: join(root, 'tmp'), maxCalls: 4, maxWriteBytes: 1024, operations: ops, egress }));
  const hooked = spawnSync(process.execPath, [join(__dirname, 'tool-admission-hook.mjs'), 'pre', st], { encoding: 'utf8',
    input: JSON.stringify({ tool_name: 'Bash', tool_use_id: 't1', tool_input: { command: 'curl -sS https://example.com' } }) });
  expect(JSON.parse(hooked.stdout).hookSpecificOutput.updatedInput.command).toBe(`${toolShellPrefix(join(root, 'tmp'), egress)}curl -sS https://example.com`);
});

it('reads the checkpoint\'s rows into the trace with their outcome, and replays the real harness runs\' rows to their recorded decisions (Rule 36)', () => {
  const trace = toolTrace([
    JSON.stringify({ phase: 'egress', rid: 1, method: 'GET', url: 'https://example.com/', addresses: PUBLIC, decision: 'allow', reason: 'r', kind: 'network-read' }),
    JSON.stringify({ phase: 'egress-done', rid: 1, status: 200, down: 577, up: 0 }),
    JSON.stringify({ phase: 'egress', rid: 2, method: 'POST', url: 'https://example.com/', addresses: PUBLIC, decision: 'deny', reason: 'doorway', kind: 'network-write' }),
    JSON.stringify({ phase: 'egress-error', error: 'socket hang up' })]);
  expect(trace.consistent).toBe(true);
  expect(trace.egressErrors).toBe(1);
  expect(trace.egress).toEqual([{ rid: 1, method: 'GET', url: 'https://example.com/', addresses: PUBLIC, decision: 'allow', reason: 'r', kind: 'network-read',
    status: 200, down: 577, up: 0 }, { rid: 2, method: 'POST', url: 'https://example.com/', addresses: PUBLIC, decision: 'deny', reason: 'doorway',
    kind: 'network-write', status: null, down: 0, up: 0 }]);
  let replayed = 0;
  for (const name of ['reads', 'writes']) {
    const record = JSON.parse(readFileSync(join(RECORDED, `${name}.json`), 'utf8')) as { admission: string; journalRows: Array<Record<string, unknown>> };
    const rows = record.admission.trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>).filter(row => row.phase === 'egress');
    // A recorded git negotiation follows its repository's discovery answered 200 in the same run (the checkpoint's own
    // establishment; the recorded harness sent git's request type).
    const status = new Map(record.admission.trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
      .filter(row => row.phase === 'egress-done').map(row => [row.rid, row.status]));
    const established = new Set<string>();
    for (const row of rows) {
      const base = gitUploadPackBase(row.method, row.url) as string | null;
      const gitFetch = row.method === 'POST' && base !== null && established.has(base);
      const decision = admitEgress({ method: row.method, url: row.url, gitFetch }, row.addresses, ops);
      if (row.method === 'GET' && base !== null && status.get(row.rid) === 200) established.add(base);
      expect([decision.decision, decision.kind ?? null, decision.reason]).toEqual([row.decision, row.kind ?? null, row.reason]);
      replayed++;
    }
    // The journaled trace carries the same requests.
    const trace = record.journalRows.find(row => row.phase === 'trace') as { network: string; egress: unknown[] };
    expect(trace.network).toBe('checkpoint');
    expect(trace.egress).toHaveLength(rows.length);
  }
  expect(replayed).toBe(10);
});

/** One turn's state directory as the runner writes it, for the real checkpoint process. */
function state() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'egress-state-'))); roots.push(root);
  const dir = join(root, 'state'); mkdirSync(dir, { mode: 0o700 });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ operations: ops, egress: { ca: join(root, 'egress-ca.pem'), bin: [] } }), { mode: 0o600 });
  return { root, dir };
}
const send = (port: number, method: string, url: string) => new Promise<{ status: number; body: string }>((done, fail) => {
  const req = request({ host: '127.0.0.1', port, method, path: url, headers: { host: new URL(url).host } }, res => {
    let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => done({ status: res.statusCode ?? 0, body }));
  });
  req.on('error', fail); req.end(method === 'POST' ? 'note=hi' : undefined);
});
const tunnel = (port: number, target: string) => new Promise<string>((done, fail) => {
  const socket = connect(port, '127.0.0.1', () => socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
  let text = ''; socket.on('data', chunk => { text += chunk; }); socket.on('end', () => done(text)); socket.on('error', fail);
});

it('runs as one process per turn: refuses before connecting, records each decision first, and is gone once stopped', { timeout: 60000 }, async () => {
  const { root, dir } = state();
  const checkpoint = await startEgressCheckpoint(dir);
  try {
    expect(Number.isSafeInteger(checkpoint.port)).toBe(true);
    // Its own authority, minted for this turn: the certificate is where a command can read it; the key stays in the state.
    expect(readFileSync(join(root, 'egress-ca.pem'), 'utf8')).toMatch(/BEGIN CERTIFICATE/u);
    expect(readFileSync(join(dir, 'egress', 'ca.key'), 'utf8')).toMatch(/PRIVATE KEY/u);
    const post = await send(checkpoint.port, 'POST', 'http://93.184.215.14/post');
    expect(post.status).toBe(403); expect(post.body).toMatch(/effect doorway/u);
    const loop = await send(checkpoint.port, 'GET', 'http://127.0.0.1:4042/health');
    expect(loop.status).toBe(403); expect(loop.body).toMatch(/not public/u);
    expect(await tunnel(checkpoint.port, '10.0.0.1:443')).toMatch(/^HTTP\/1\.1 403[\s\S]*not public/u);
    expect(await tunnel(checkpoint.port, '93.184.215.14:22')).toMatch(/^HTTP\/1\.1 403[\s\S]*port 22/u);
    const rows = readFileSync(join(dir, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
    expect(rows.filter(row => row.phase === 'egress').map(row => [row.method, row.decision, row.kind]))
      .toEqual([['POST', 'deny', 'network-write'], ['GET', 'deny', 'scope'], ['CONNECT', 'deny', 'scope'], ['CONNECT', 'deny', 'scope']]);
  } finally { await checkpoint.stop(); }
  expect(() => process.kill(checkpoint.pid, 0)).toThrow();
  // A checkpoint that cannot start (no egress configuration) is reported, never left running.
  const bare = state(); writeFileSync(join(bare.dir, 'config.json'), JSON.stringify({ operations: ops }));
  await expect(startEgressCheckpoint(bare.dir)).rejects.toThrow(/egress checkpoint exited/u);
});

it('records the running checkpoint\'s port in the admission config, and offers only plain installed toolchain directories', () => {
  const { dir } = state();
  recordEgressPort(dir, 50123);
  expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).egress).toMatchObject({ port: 50123 });
  const bare = state(); writeFileSync(join(bare.dir, 'config.json'), '{}');
  expect(() => recordEgressPort(bare.dir, 1)).toThrow(/no egress configuration/u);
  const files = new Set(['/opt/node/bin', '/Library/Developer/CommandLineTools/usr/bin/git']);
  const real = (path: string) => { if (path === '/opt/node/bin/node') return path; if (path.startsWith('/private/var')) throw Error('absent'); return path; };
  expect(toolchainReads({ execPath: '/opt/node/bin/node', real, exists: (path: string) => files.has(path) }))
    .toEqual({ reads: ['/opt/node', '/Library/Developer/CommandLineTools'], bin: ['/opt/node/bin', '/Library/Developer/CommandLineTools/usr/bin'],
      developer: '/Library/Developer/CommandLineTools' });
  // A path that is not plain (a space) is left out rather than quoted around; no developer tools, no git directory.
  expect(toolchainReads({ execPath: '/opt/my node/bin/node', real, exists: () => false })).toEqual({ reads: [], bin: [], developer: null });
});

/** The real checkpoint process with one substitution at its transport: a connection to the public test address goes to a
 * local sink instead (nothing leaves the machine). The preload also observes, at each dispatch, whether the admission
 * record's last write was flushed, and makes every flush fail once `fail-flush` exists in the state's root. */
async function controlled(answer: (req: { method: string; url: string; type: string; body: string }) => { status: number; type: string; body: string }) {
  const { root, dir } = state();
  const received: Array<{ method: string; url: string; body: string }> = [];
  const sink = createServer((req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received.push({ method: String(req.method), url: String(req.url), body });
      const out = answer({ method: String(req.method), url: String(req.url), type: String(req.headers['content-type'] ?? ''), body });
      res.writeHead(out.status, { 'content-type': out.type }); res.end(out.body);
    });
  });
  await new Promise<void>(done => sink.listen(0, '127.0.0.1', done));
  const preload = join(root, 'controlled-upstream.mjs');
  writeFileSync(preload, `import fs from 'node:fs'; import http from 'node:http'; import { syncBuiltinESMExports } from 'node:module';
const { writeSync, fsyncSync, existsSync, appendFileSync } = fs; let flushed = true;
fs.writeSync = function (...args) { flushed = false; return writeSync.apply(this, args); };
fs.fsyncSync = function (...args) { if (existsSync(${JSON.stringify(join(root, 'fail-flush'))})) throw Error('flush failed'); fsyncSync.apply(this, args); flushed = true; };
const request = http.request;
http.request = function (options, ...rest) {
  if (options.host === '93.184.215.14') { appendFileSync(${JSON.stringify(join(root, 'dispatches.jsonl'))}, JSON.stringify({ path: options.path, flushed }) + '\\n');
    options = { ...options, host: '127.0.0.1', port: ${String((sink.address() as AddressInfo).port)} }; }
  return request.call(this, options, ...rest);
};
syncBuiltinESMExports();\n`);
  const child = spawn(process.execPath, ['--import', preload, join(__dirname, 'egress-checkpoint.mjs'), dir], { stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin' } });
  const exited = new Promise(done => child.once('exit', done));
  const port = await new Promise<number>((done, fail) => {
    let out = '', err = '';
    child.stderr.on('data', chunk => { err += chunk; });
    child.stdout.on('data', chunk => { out += chunk; if (out.includes('\n')) done(JSON.parse(out.slice(0, out.indexOf('\n'))).port); });
    child.once('exit', () => fail(Error(err)));
  });
  const stop = async () => { try { process.kill(child.pid as number, 'SIGTERM'); } catch { /* gone */ } await exited; await new Promise(done => sink.close(done)); };
  const dispatches = () => { try { return readFileSync(join(root, 'dispatches.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { path: string; flushed: boolean }); } catch { return []; } };
  const rows = () => readFileSync(join(dir, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
  return { root, port, received, stop, dispatches, rows };
}
const call = (port: number, method: string, url: string, type = '', body = '') => new Promise<{ status: number; body: string }>((done, fail) => {
  const req = request({ host: '127.0.0.1', port, method, path: url, headers: { host: new URL(url).host, ...(type ? { 'content-type': type } : {}) } }, res => {
    let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => done({ status: res.statusCode ?? 0, body: text }));
  });
  req.on('error', fail); req.end(body || undefined);
});
const GIT = 'http://93.184.215.14';
const ADVERT = 'application/x-git-upload-pack-advertisement', GIT_REQUEST = 'application/x-git-upload-pack-request';

it('admits git\'s fetch negotiation only for a repository that answered discovery as a git server; the same path alone is a write', { timeout: 60000 }, async () => {
  const net = await controlled(({ url }) => url.startsWith('/o/r.git/info/refs') ? { status: 200, type: ADVERT, body: '001e# service=git-upload-pack\n' }
    : url.startsWith('/page/info/refs') ? { status: 200, type: 'text/html', body: '<html></html>' } : { status: 200, type: 'application/x-git-upload-pack-result', body: 'NAK' });
  try {
    // The demonstrated bypass: an ordinary POST whose path merely ends in git's suffix reaches the doorway and is refused.
    const publish = await call(net.port, 'POST', `${GIT}/publish/git-upload-pack`, GIT_REQUEST, 'effect=publish&value=marker');
    expect(publish.status).toBe(403); expect(publish.body).toMatch(/effect doorway/u);
    // Before discovery, the real negotiation path is a write too.
    expect((await call(net.port, 'POST', `${GIT}/o/r.git/git-upload-pack`, GIT_REQUEST, '0032want x\n')).status).toBe(403);
    // A discovery the server does not answer as git establishes nothing.
    expect((await call(net.port, 'GET', `${GIT}/page/info/refs?service=git-upload-pack`)).status).toBe(200);
    expect((await call(net.port, 'POST', `${GIT}/page/git-upload-pack`, GIT_REQUEST, '0032want x\n')).status).toBe(403);
    // The clone/fetch case: discovery answered as git, then the negotiation with git's request type is a read.
    expect((await call(net.port, 'GET', `${GIT}/o/r.git/info/refs?service=git-upload-pack`)).status).toBe(200);
    const fetch = await call(net.port, 'POST', `${GIT}/o/r.git/git-upload-pack`, GIT_REQUEST, '0032want x\n');
    expect(fetch).toEqual({ status: 200, body: 'NAK' });
    // Its neighbours on the same established repository: another content type, or another repository's path, is a write.
    expect((await call(net.port, 'POST', `${GIT}/o/r.git/git-upload-pack`, 'application/x-www-form-urlencoded', 'effect=publish')).status).toBe(403);
    expect((await call(net.port, 'POST', `${GIT}/o/other.git/git-upload-pack`, GIT_REQUEST, '0032want x\n')).status).toBe(403);
    expect(net.received.filter(item => item.method === 'POST').map(item => item.url)).toEqual(['/o/r.git/git-upload-pack']);
    expect(net.rows().filter(row => row.phase === 'egress' && row.method === 'POST').map(row => [row.url, row.decision, row.kind])).toEqual([
      [`${GIT}/publish/git-upload-pack`, 'deny', 'network-write'], [`${GIT}/o/r.git/git-upload-pack`, 'deny', 'network-write'],
      [`${GIT}/page/git-upload-pack`, 'deny', 'network-write'], [`${GIT}/o/r.git/git-upload-pack`, 'allow', 'network-read'],
      [`${GIT}/o/r.git/git-upload-pack`, 'deny', 'network-write'], [`${GIT}/o/other.git/git-upload-pack`, 'deny', 'network-write']]);
  } finally { await net.stop(); }
});

it('flushes each request\'s record to disk before dispatching it, and sends nothing when the record cannot be flushed', { timeout: 60000 }, async () => {
  const net = await controlled(() => ({ status: 200, type: 'text/plain', body: 'ok' }));
  try {
    expect(await call(net.port, 'GET', `${GIT}/a`)).toEqual({ status: 200, body: 'ok' });
    expect(net.dispatches()).toEqual([{ path: '/a', flushed: true }]);
    expect(net.rows().find(row => row.phase === 'egress')).toMatchObject({ url: `${GIT}/a`, decision: 'allow' });
    // The flush fails: the request is closed unsent, and the checkpoint keeps serving.
    writeFileSync(join(net.root, 'fail-flush'), '');
    await expect(call(net.port, 'GET', `${GIT}/b`)).rejects.toThrow();
    expect(net.dispatches().map(item => item.path)).toEqual(['/a']);
    rmSync(join(net.root, 'fail-flush'));
    expect(await call(net.port, 'GET', `${GIT}/c`)).toEqual({ status: 200, body: 'ok' });
    expect(net.dispatches()).toEqual([{ path: '/a', flushed: true }, { path: '/c', flushed: true }]);
    expect(net.received.map(item => item.url)).toEqual(['/a', '/c']);
  } finally { await net.stop(); }
});

it('counts each HTTPS tunnel against the open-tunnel and request bounds before any setup, frees its slot when it closes, and stops recording past the budget', { timeout: 120000 }, async () => {
  const net = await controlled(() => ({ status: 200, type: 'text/plain', body: 'ok' }));
  const sockets: Socket[] = [];
  const open = () => new Promise<string>((done, fail) => {
    const socket = connect(net.port, '127.0.0.1', () => socket.write('CONNECT 93.184.215.14:443 HTTP/1.1\r\nHost: 93.184.215.14:443\r\n\r\n'));
    sockets.push(socket); socket.once('error', fail); socket.once('data', chunk => done(String(chunk)));
  });
  try {
    const answers = await Promise.all(Array.from({ length: 20 }, open));
    expect(answers.filter(text => text.startsWith('HTTP/1.1 200'))).toHaveLength(16);
    expect(answers.filter(text => /^HTTP\/1\.1 403[\s\S]*16 tunnels already open/u.test(text))).toHaveLength(4);
    // Closed tunnels give their slots back.
    sockets.splice(0).forEach(socket => socket.destroy());
    await vi.waitFor(async () => { const text = await open(); sockets.splice(0).forEach(socket => socket.destroy()); expect(text).toMatch(/^HTTP\/1\.1 200/u); }, { timeout: 10000, interval: 100 });
    // Every tunnel took a request slot: the budget runs out at the bound, one row says so, and later refusals add none.
    for (let i = 0; i < 520; i++) await call(net.port, 'GET', 'http://127.0.0.1/');
    const rows = net.rows();
    expect(rows.filter(row => row.phase === 'egress-budget')).toEqual([{ phase: 'egress-budget', rid: 513, reason: 'shell network refused: per-turn request bound 512' }]);
    expect(Math.max(...rows.filter(row => row.phase === 'egress').map(row => Number(row.rid)))).toBe(512);
    const late = await call(net.port, 'GET', `${GIT}/late`);
    expect(late.status).toBe(403); expect(late.body).toMatch(/per-turn request bound 512/u);
    const tunnel = await open();
    expect(tunnel).toMatch(/^HTTP\/1\.1 403[\s\S]*per-turn request bound 512/u);
    expect(net.rows()).toHaveLength(rows.length);
    expect(net.received).toEqual([]);
  } finally { sockets.forEach(socket => socket.destroy()); await net.stop(); }
});
