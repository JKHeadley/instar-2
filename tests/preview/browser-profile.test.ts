import { afterEach, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
// @ts-expect-error host adapter
import { readBrowserProfile, profileRequest, createProfileBrowser } from './browser-profile.mjs';
// @ts-expect-error host connector
import { prepareSessionConnectors, admitSessionConnector } from './session-connectors.mjs';
// @ts-expect-error host configuration
import { readRootMcp, prepareMcpLaunch } from './tool-turn.mjs';
// @ts-expect-error host admission
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error hook consumer
import { admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error shipped default
import { DEFAULT_MCP } from '../../scripts/mcp-setup.mjs';
const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
const fresh = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), 'profile-proof-'))); cleanup.push(() => rmSync(root, { recursive: true, force: true })); return root; };
const enroll = (root: string, origin: string) => {
  const row = { id: 'agent-browser', identity: 'local-agent', service: 'fake-site', ownership: 'agent', purpose: 'browsing',
    userDataDir: join(root, 'browser-profiles', 'agent-browser'), origins: [origin] };
  mkdirSync(row.userDataDir, { recursive: true, mode: 0o700 });
  writeFileSync(join(root, 'browser-profiles.json'), JSON.stringify({ installation: root, profiles: [row] }));
  writeFileSync(join(root, 'mcp.json'), JSON.stringify({ ...DEFAULT_MCP, browserProfile: row.id }));
  return row;
};
function client(command: string, args: string[], env?: Record<string, string>, cwd?: string) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '', sequence = 0;
  const pending = new Map<number, (value: { result: { content?: { text: string }[]; tools?: unknown[]; isError?: boolean } }) => void>();
  child.stderr.on('data', chunk => { stderr += chunk; });
  createInterface({ input: child.stdout }).on('line', line => { const row = JSON.parse(line); pending.get(row.id)?.(row); pending.delete(row.id); });
  cleanup.push(async () => { if (child.exitCode === null && child.signalCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; } });
  const rpc = (method: string, params?: unknown) => new Promise<{ result: { content?: { text: string }[]; tools?: unknown[]; isError?: boolean } }>((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error('MCP response timeout')); }, 20000);
    pending.set(id, value => { clearTimeout(timer); resolve(value); });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  return { rpc, stderr: () => stderr, async call(name: string, input: unknown) {
    const answer = await rpc('tools/call', { name, arguments: input });
    return JSON.parse(answer.result.content![0]!.text) as { status: string; reason?: string; text?: string };
  } };
}

it('resolves only an existing agent-owned profile for this exact installation; never opens a profile to validate it', () => {
  const root = fresh(), row = enroll(root, 'http://127.0.0.1:9');
  expect(readBrowserProfile(root, row.id)).toMatchObject(row);
  expect(readBrowserProfile(root, undefined)).toBeNull();
  chmodSync(row.userDataDir, 0o755); expect(() => readBrowserProfile(root, row.id)).toThrow('profile refused'); chmodSync(row.userDataDir, 0o700);
  for (const name of ['wrong', '../agent-browser', '', null]) expect(() => readBrowserProfile(root, name)).toThrow('profile refused');
  for (const patch of [{ ownership: 'operator' }, { purpose: 'signin' }, { userDataDir: root }, { origins: ['https://a.test/path'] }, { cookie: 'never-a-value' }]) {
    writeFileSync(join(root, 'browser-profiles.json'), JSON.stringify({ installation: root, profiles: [{ ...row, ...patch }] }));
    expect(() => readBrowserProfile(root, row.id)).toThrow('profile refused');
  }
  writeFileSync(join(root, 'browser-profiles.json'), JSON.stringify({ installation: `${root}-other`, profiles: [row] }));
  expect(() => readBrowserProfile(root, row.id)).toThrow('profile refused');
  writeFileSync(join(root, 'browser-profiles.json'), JSON.stringify({ installation: root, profiles: [row] }));
  rmSync(row.userDataDir, { recursive: true }); symlinkSync(fresh(), row.userDataDir);
  expect(() => readBrowserProfile(root, row.id)).toThrow('profile refused');
  rmSync(row.userDataDir); expect(() => readBrowserProfile(root, row.id)).toThrow('profile refused');
});

it('real worker CLI reads the named signed-in page, refuses ungranted writes and site escape, and keeps cookies out of records and logs', async () => {
  const root = fresh(), secret = randomBytes(32).toString('hex'), indexedSecret = randomBytes(32).toString('hex'), displayedToken = `ghp_${randomBytes(20).toString('hex')}`;
  let escaped = 0;
  const outside = createServer((_req, res) => { escaped++; res.end('Outside scope'); });
  await new Promise<void>(resolve => outside.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => outside.close(() => resolve())));
  const escape = `http://127.0.0.1:${(outside.address() as { port: number }).port}`;
  let writes = 0, preparedAtWrite = false, observedBeforeWrite = false; const authenticatedRequests: boolean[] = [];
  const server = createServer((req, res) => {
    const authenticated = req.headers.cookie === `session=${secret}`; authenticatedRequests.push(authenticated);
    if (req.url === '/new-token') { res.setHeader('Content-Type', 'text/html'); res.end(`<body>${displayedToken}</body>`); return; }
    if (req.url === '/escape') { res.writeHead(302, { Location: escape }); res.end(); return; }
    if (req.url === '/same-site') { res.writeHead(302, { Location: '/' }); res.end(); return; }
    if (req.url === '/override') { res.setHeader('Content-Type', 'text/html'); res.end('<h1>Override attempt</h1><script>fetch("/", {headers:{"X-HTTP-Method-Override":"POST"}})</script>'); return; }
    if (req.url === '/idb-leak') { res.setHeader('Content-Type', 'text/html'); res.end('<body><script>const r=indexedDB.open("authdb");r.onsuccess=()=>{const q=r.result.transaction("auth").objectStore("auth").get("credential");q.onsuccess=()=>{document.body.innerHTML="<p>Leak ready</p><p></p>";document.body.lastChild.textContent=q.result;};};</script>'); return; }
    if (req.method === 'POST' || req.headers['x-http-method-override'] === 'POST') {
      const preparation = rows.find(row => row.state === 'prepared' && row.cause?.includes('bodyDigest'));
      preparedAtWrite = Boolean(preparation); observedBeforeWrite = rows.some(row => row.id === preparation?.id && row.state === 'observed');
      writes++; res.setHeader('Content-Type', 'text/html'); res.end('<h1>Write accepted</h1><form method="post"><button>Save</button></form>'); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(authenticated ? `<h1>Signed-in workspace</h1><select autofocus size="3"><option selected>First</option><option>Second</option><option>Third</option></select><form method="post"><button>Save</button></form>${req.url === '/leak' ? secret : ''}` : '<h1>LOGIN</h1>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => server.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`, row = enroll(root, origin);
  const seed = await chromium.launchPersistentContext(row.userDataDir, { headless: true });
  cleanup.push(() => seed.close());
  await seed.addCookies([{ name: 'session', value: secret, url: origin, httpOnly: true, expires: Math.floor(await seed.pages()[0]!.evaluate(() => Date.now()) / 1000) + 3600 }]);
  await seed.pages()[0]!.goto(origin);
  await seed.pages()[0]!.evaluate(value => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('authdb', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('auth');
    request.onsuccess = () => { const tx = request.result.transaction('auth', 'readwrite'); tx.objectStore('auth').put(value, 'credential');
      tx.oncomplete = () => { request.result.close(); resolve(); }; tx.onerror = () => reject(Error('seed failed')); };
  }), indexedSecret);
  expect((await seed.cookies()).some(cookie => cookie.value === secret)).toBe(true);
  await seed.close();
  const persisted = await chromium.launchPersistentContext(row.userDataDir, { headless: true });
  cleanup.push(() => persisted.close());
  expect((await persisted.cookies()).some(cookie => cookie.value === secret), 'throwaway seed persists').toBe(true);
  await persisted.close();
  let stopped = false, grant = false;
  const rows: { id: string; state?: string; cause?: string }[] = [], pids: number[] = [];
  const target = 'mcp__playwright__browser_click', keyTarget = 'mcp__playwright__browser_press_key';
  const expiresAt = Date.now() + 90000;
  const policy = () => ({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
    registered: [target, keyTarget].map(tool => ({ effect: 'tool:mcp', target: tool, consequence: 'data',
      reversibility: 'reversible', reach: 'agent', costUsd: 0, source: 'operator:proof' })),
    grants: grant ? [target, keyTarget].map(tool => ({ id: tool, browserProfile: row.id, effect: 'tool:mcp', target: tool, approves: ['scope'], source: 'operator:proof', custodian: 'owner', recovery: 'withdraw', expiresAt })) : [] });
  const append = (record: { id: string; state?: string; cause?: string }) => { rows.push(record); };
  const effects = createToolEffectOwner({ append, stopped: () => stopped, now: Date.now, prepared: (id: string) => rows.some(row => row.id === id),
    decide: (tool: string, input: unknown) => admitSessionConnector({ tool, input, config: { operations: [], effectPolicy: policy() },
      mcp: readRootMcp(root), enabled: true, now: Date.now(), decide: admitToolCallEffect }) });
  const gate = await createAdmissionGate({ append, effects, stopped: () => stopped, now: Date.now, held: (text: string) => text.includes(secret) ? 'held' : 'clear', profileBrowser: () => Boolean(readRootMcp(root)?.browserProfile) });
  cleanup.push(() => gate.stop());
  const deadline = Date.now() + 90000;
  gate.open('claim', { framework: 'claude-code', allowance: 30, edge: { id: 'proof-edge', child: 'claim', budget: { deadline } } });
  const privateDirectory = join(root, 'private'); mkdirSync(privateDirectory);
  let guestDispatched = false;
  expect((await gate.observeOwner('guest', 'guest-call', {}, { tool: 'mcp__playwright__browser_snapshot',
    browser: Object.assign(async () => { guestDispatched = true; return { status: 'observed' }; }, { binding: () => row }) })).status).toBe('refused');
  expect(guestDispatched).toBe(false);
  const port = await prepareSessionConnectors({ mcp: readRootMcp(root), privateDirectory, identity: null, workspace: root,
    check: () => 'clear', resolveSecret: () => { throw Error('no credential handoff'); }, deadline, stopped: () => stopped,
    holdBrowser: async () => ({ attach: async ({ pid }: { pid: number }) => { pids.push(pid); }, release: async () => ({ verified: true }) }),
    browserCall: (id: string, tool: string, input: unknown, browser: unknown) => gate.observeOwner('claim', id, input, { tool, browser }) });
  cleanup.push(() => port.close());
  const prepared = port.launch(), command = prepared.launch.playwright;
  const launchBytes = readFileSync(prepared.config, 'utf8');
  expect(launchBytes).not.toContain(row.userDataDir); expect(launchBytes).not.toContain(secret);
  const worker = client(command.command, command.args, command.env, root);
  expect((await worker.rpc('tools/list')).result.tools).toHaveLength(8);
  const navigation = await worker.call('browser_navigate', { url: origin });
  expect(navigation.status, navigation.reason).toBe('observed'); expect(navigation.text?.includes('Signed-in workspace'), JSON.stringify({ requests: authenticatedRequests, login: navigation.text?.includes('LOGIN') })).toBe(true);
  expect(await worker.call('browser_snapshot', {})).toMatchObject({ status: 'observed', text: expect.stringContaining('Signed-in workspace') });
  expect(await worker.call('browser_click', { selector: 'button' })).toMatchObject({ status: 'refused' }); expect(writes).toBe(0);
  expect(await worker.call('browser_navigate', { url: 'http://127.0.0.1:1/' })).toMatchObject({ status: 'refused', reason: 'site-scope' });
  expect(await worker.call('browser_snapshot', { profile: 'wrong' })).toMatchObject({ status: 'refused' });
  const overridden = JSON.parse(readFileSync(join(root, 'mcp.json'), 'utf8')); overridden.reads.push(target);
  writeFileSync(join(root, 'mcp.json'), JSON.stringify(overridden));
  expect((await worker.call('browser_click', { selector: 'button' })).status).toBe('refused'); expect(writes).toBe(0);
  const beforeSecret = rows.length;
  expect((await worker.call('browser_navigate', { url: `${origin}/?credential=${displayedToken}` })).status).toBe('refused'); expect(rows.length).toBe(beforeSecret);
  expect((await worker.call('browser_navigate', { url: `${origin}/?credential=${secret}` })).status).toBe('refused'); expect(rows.length).toBe(beforeSecret);
  expect((await worker.call('browser_type', { selector: 'textarea', text: secret })).status).toBe('refused'); expect(rows.length).toBe(beforeSecret);
  expect((await worker.call('browser_navigate', { url: `${origin}/same-site` })).status).toBe('observed');
  expect((await worker.call('browser_navigate', { url: `${origin}/escape` })).status).toBe('refused'); expect(escaped).toBe(0);
  await worker.call('browser_navigate', { url: `${origin}/override` }); expect(writes).toBe(0);
  expect((await worker.call('browser_navigate', { url: origin })).status).toBe('observed');
  grant = true;
  expect(await worker.call('browser_press_key', { key: 'ArrowDown', browserEffect: { method: 'POST', url: origin, bodyDigest: `sha256:${'0'.repeat(64)}` } })).toMatchObject({ status: 'refused', reason: 'profile-tool-scope' });
  expect(await worker.call('browser_press_key', { key: 'ArrowDown' })).toMatchObject({ status: 'observed' });
  expect(await worker.call('browser_press_key', { key: 'ArrowDown' })).toMatchObject({ status: 'observed', text: expect.stringContaining('option "Third" [selected]') });
  expect(await worker.call('browser_click', { selector: 'button' })).toMatchObject({ status: 'observed' }); expect(writes).toBe(1);
  expect(preparedAtWrite).toBe(true); expect(observedBeforeWrite).toBe(false);
  expect(await worker.call('browser_click', { selector: 'button' })).toMatchObject({ status: 'refused' }); expect(writes).toBe(1);
  expect(rows.filter(row => row.state === 'prepared' && row.cause?.includes('bodyDigest'))).toHaveLength(1);
  expect(await worker.call('browser_navigate', { url: `${origin}/leak` })).toMatchObject({ status: 'refused', reason: 'output-secret-check' });
  await worker.call('browser_navigate', { url: `${origin}/idb-leak` });
  const leaked = await worker.call('browser_wait_for', { text: 'Leak ready' });
  expect(leaked.status).toBe('refused'); expect(leaked.reason).toBe('output-secret-check');
  expect((await worker.call('browser_navigate', { url: `${origin}/new-token` })).status).toBe('refused');
  expect(JSON.stringify(rows).includes(displayedToken)).toBe(false); expect(worker.stderr().includes(displayedToken)).toBe(false);
  expect(JSON.stringify(rows).includes(indexedSecret)).toBe(false); expect(worker.stderr().includes(indexedSecret)).toBe(false);
  expect(JSON.stringify(rows).includes(secret)).toBe(false); expect(worker.stderr().includes(secret)).toBe(false);
  expect(pids).toHaveLength(1); expect(rows.some(row => row.state === 'prepared')).toBe(true);
  stopped = true; expect(await worker.call('browser_snapshot', {})).toMatchObject({ status: 'refused' });
  expect(() => prepareMcpLaunch({ mcp: readRootMcp(root), privateDirectory: root })).toThrow('host connector');

  // Existing no-selection CLI: a different, throwaway profile reaches LOGIN on the same local site.
  const unsigned = fresh(); writeFileSync(join(unsigned, 'mcp.json'), JSON.stringify(DEFAULT_MCP));
  expect(readRootMcp(unsigned).browserProfile).toBeNull();
  const unsignedPrivate = join(unsigned, 'private'); mkdirSync(unsignedPrivate);
  const defaultLaunch = prepareMcpLaunch({ mcp: readRootMcp(unsigned), privateDirectory: unsignedPrivate, workspace: unsigned });
  const definition = defaultLaunch.launch.playwright, ordinary = client(definition.command, definition.args, definition.env, unsigned);
  await ordinary.rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'local-profile-proof', version: '1' } });
  const login = await ordinary.rpc('tools/call', { name: 'browser_navigate', arguments: { url: origin } });
  expect(login.result.isError).not.toBe(true);
  const snapshots = readdirSync(join(unsigned, '.playwright-mcp')).filter(name => name.endsWith('.yml'));
  expect(snapshots.some(name => readFileSync(join(unsigned, '.playwright-mcp', name), 'utf8').includes('LOGIN'))).toBe(true);
}, 60000);

it('replays recorded summary/Jev/review/delivered/empty shapes as data, never profile or write authority', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  const root = fresh(); enroll(root, 'http://127.0.0.1:9');
  expect(fixture.otherShapes).toHaveLength(7);
  for (const row of fixture.otherShapes as { id: string; raw: string }[]) {
    expect(profileRequest('browser_snapshot', { profile: row.raw }), row.id).toBe(false);
    expect(profileRequest('browser_type', { selector: 'textarea', text: row.raw }), row.id).toBe(row.raw.length <= 2048);
    expect(admitSessionConnector({ tool: 'mcp__playwright__browser_type', input: { selector: 'textarea', text: row.raw },
      config: { operations: [] }, mcp: readRootMcp(root), enabled: false, now: 1, decide: admitToolCallEffect }).admitted, row.id).toBe(false);
  }
});

it('bounds first-call capacity waiting and releases a late reservation after stop without launching a browser', async () => {
  let stop = false, released = 0, bound = 0, stopped = () => false;
  let releaseHold: (slot: unknown) => void = () => {};
  const binding = { id: 'agent-browser' };
  const browser = createProfileBrowser({ binding: () => binding, check: () => 'clear', now: () => 5, deadline: 100000,
    stopped: () => stop, hold: (options: { timeout: number; stopped: () => boolean }) => {
      bound = options.timeout; stopped = options.stopped;
      return new Promise(resolve => { releaseHold = resolve; });
    }, call: (_id: string, _tool: string, input: unknown, adapter: (o: unknown) => Promise<unknown>) =>
      adapter({ input, stopped: () => stop, bindingSnapshot: binding }) });
  const result = browser.request('call', { name: 'browser_snapshot', arguments: {} });
  expect(bound).toBe(15000); expect(stopped()).toBe(false);
  stop = true; expect(stopped()).toBe(true);
  releaseHold({ release: async () => { released++; } });
  expect((await result).status).toBe('refused'); expect(released).toBe(1);
  await browser.close();
});
