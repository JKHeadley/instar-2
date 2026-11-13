import { afterEach, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { runInNewContext } from 'node:vm';
import { spawn, spawnSync } from 'node:child_process';
// @ts-expect-error physical checkpoint
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error plain hook
import { admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error physical connector composition
import { prepareSessionConnectors, admitSessionConnector } from './session-connectors.mjs';
// @ts-expect-error plain fixed contract
import { OWNER_BROWSER_TOOL } from './owner-browser-contract.mjs';
// @ts-expect-error physical owner adapter
import { createOwnerBrowser, readOwnerBrowserBinding } from './owner-browser.mjs';
// @ts-expect-error existing installer writer
import { configureTrust, setupTrustPolicy } from './trust-setup.mjs';
// @ts-expect-error the runner's own policy reader
import { currentEffectPolicy } from './effect-doorway.mjs';
const close: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of close.splice(0).reverse()) await fn(); });
const input = { page: 'account-profile' };
const observation = { status: 'observed', page: 'account-profile', account: 'EchoOfDawn', title: 'Your profile', observedAt: 10, truncated: false };
async function world(options: { browser?: ReturnType<typeof createOwnerBrowser>; disabled?: boolean; pages?: string[]; policy?: () => unknown } = {}) {
  let stopped = false, owner = true, time = 10, failAppend = false, failObserved = false, granted = true, check = 'clear';
  let grantId = 'read';
  let dispatches = 0, block = false, release = () => {};
  const rows: { id: string; state?: string; cause?: string }[] = [];
  const policy = options.policy ?? (() => ({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
    registered: [{ effect: 'tool:mcp', target: OWNER_BROWSER_TOOL, consequence: 'data', reversibility: 'reversible', reach: 'agent', costUsd: 0, source: 'operator:read' }],
    grants: granted ? [{ id: grantId, ...(options.pages ? { ownerBrowserPages: options.pages } : {}), effect: 'tool:mcp', target: OWNER_BROWSER_TOOL, approves: ['scope'], source: 'operator:read', custodian: 'owner', recovery: 'withdraw', expiresAt: 100 }] : [] }));
  const append = (row: { id: string; state?: string }) => { if (failAppend || (failObserved && row.state === 'observed')) throw Error('disk unavailable'); rows.push(row); };
  const effects = createToolEffectOwner({ append, stopped: () => stopped || !owner, now: () => time,
    prepared: (id: string) => rows.some(row => row.id === id),
    decide: (tool: string, value: unknown) => admitSessionConnector({ tool, input: value, config: { operations: [], effectPolicy: policy() }, mcp: null,
      enabled: false, now: time, decide: admitToolCallEffect }) });
  const gate = await createAdmissionGate({ append, effects, stopped: () => stopped || !owner, now: () => time, held: () => check,
    ownerBrowser: options.disabled ? null : options.browser ?? Object.assign(async () => { dispatches++; if (block) await new Promise<void>(resolve => { release = resolve; }); return observation; },
      { binding: () => ({ profileId: 'echoofdawn-github', account: 'EchoOfDawn', ownership: 'agent' }) }) });
  close.push(() => gate.stop());
  const edge = { id: 'session-work-edge:test:1', child: 'claim', budget: { deadline: 100 } };
  const open = () => gate.open('claim', { framework: 'claude-code', allowance: 2, edge }); open();
  return { gate, rows, effects, edge, open, count: () => dispatches, release: () => release(),
    set: (patch: { grantId?: string; stop?: boolean; owner?: boolean; now?: number; append?: boolean; observed?: boolean; grant?: boolean; held?: string; block?: boolean }) => {
      grantId = patch.grantId ?? grantId;
      stopped = patch.stop ?? stopped; owner = patch.owner ?? owner; time = patch.now ?? time; failAppend = patch.append ?? failAppend;
      failObserved = patch.observed ?? failObserved; granted = patch.grant ?? granted; check = patch.held ?? check; block = patch.block ?? block;
    } };
}
it('records exact cause before execution, observes completion, and refuses replay including a reopened claim', async () => {
  const w = await world();
  expect(await w.gate.observeOwner('claim', 'one', input)).toEqual(observation);
  expect(w.rows.map(row => row.state)).toEqual(['prepared', 'observed']);
  expect(JSON.parse(w.rows[0]!.cause!)).toMatchObject({ authorization: { tool: OWNER_BROWSER_TOOL, input, configuration: { effectPolicy: { grants: [{ id: 'read' }] } } }, ownerBrowser: { account: 'EchoOfDawn' } });
  expect(w.gate.state('claim').uncertainEffects).toBe(0);
  expect(await w.gate.observeOwner('claim', 'one', input)).toMatchObject({ status: 'refused' });
  w.open(); expect(await w.gate.observeOwner('claim', 'one', input)).toMatchObject({ status: 'refused' });
  expect(w.count()).toBe(1);
});
it('refuses malformed request, unknown/closed/expired claim, owner loss, stop, grant withdrawal and failed durable append before dispatch', async () => {
  for (const patch of [{ stop: true }, { owner: false }, { now: 100 }, { grant: false }, { append: true }]) {
    const w = await world(); w.set(patch);
    expect(await w.gate.observeOwner('claim', 'one', input)).toMatchObject({ status: 'refused' }); expect(w.count()).toBe(0);
  }
  const w = await world();
  for (const id of [null, undefined, 17, {}, '', 'x'.repeat(201)])
    expect(await w.gate.observeOwner('claim', id, input)).toMatchObject({ status: 'refused' });
  for (const value of [{ page: 'account-profile', url: 'https://evil.test' }, {}, null])
    expect(await w.gate.observeOwner('claim', 'one', value)).toMatchObject({ status: 'refused' });
  expect(await w.gate.observeOwner('missing', 'one', input)).toMatchObject({ status: 'refused' });
  w.gate.close('claim'); expect(await w.gate.observeOwner('claim', 'one', input)).toMatchObject({ status: 'refused' }); expect(w.count()).toBe(0);
});
it('a hook allow is not dispatch, a forged post cannot consume the preparation, and socket execution rechecks the grant', async () => {
  const w = await world();
  const hook = async (phase: string) => (await fetch(`${w.gate.base('claim')}/admit`, { method: 'POST', body: JSON.stringify({
    kind: 'effect', phase, tool_name: OWNER_BROWSER_TOOL, tool_use_id: 'hook-one', tool_input: input }) })).json();
  expect(await hook('pre')).toMatchObject({ decision: 'allow' }); expect(w.rows).toEqual([]); expect(w.count()).toBe(0);
  expect(await hook('post')).toMatchObject({ decision: 'allow' }); expect(w.rows).toEqual([]);
  w.set({ grant: false }); expect(await w.gate.observeOwner('claim', 'hook-one', input)).toMatchObject({ status: 'refused' }); expect(w.count()).toBe(0);
});
it('concurrent delivery dispatches once and withdrawal during the read withholds content', async () => {
  for (const patch of [{ stop: true }, { owner: false }, { grant: false }, { now: 100 }]) {
    const w = await world(); w.set({ block: true });
    const pending = w.gate.observeOwner('claim', 'one', input);
    expect(await w.gate.observeOwner('claim', 'one', input)).toMatchObject({ status: 'refused' });
    w.set(patch); w.release(); expect(await pending).toMatchObject({ status: 'refused' }); expect(w.count()).toBe(1);
    expect(w.gate.state('claim').uncertainEffects).toBe(1);
  }
});
it('failed outcome persistence and unavailable held-secret check withhold content and leave honest uncertainty', async () => {
  for (const patch of [{ observed: true }, { held: 'unavailable' }]) {
    const w = await world(); w.set(patch);
    expect((await w.gate.observeOwner('claim', 'one', input)).status).not.toBe('observed');
    expect(w.gate.state('claim').uncertainEffects).toBe(1);
  }
});
it('the installed thin MCP launch reaches its claim through the real connector socket; generic frames cannot request scripts', async () => {
  const w = await world(), root = mkdtempSync(join(tmpdir(), 'owner-connector-'));
  close.push(async () => { rmSync(root, { recursive: true, force: true }); });
  const port = await prepareSessionConnectors({ mcp: null, privateDirectory: root, identity: null, check: () => 'clear',
    ownerRead: (id: string, value: unknown) => w.gate.observeOwner('claim', id, value) });
  close.push(() => port.close());
  const prepared = port.launch(), server = prepared.launch.owner_github;
  expect(readFileSync(prepared.config, 'utf8')).not.toMatch(/userDataDir|81453|cookies|osascript/u);
  const child = spawn(server.command, server.args, { stdio: ['pipe', 'pipe', 'pipe'] });
  close.push(async () => { if (child.exitCode === null) { child.kill('SIGKILL'); await new Promise(resolve => child.once('exit', resolve)); } });
  let buffer = ''; const answers: { id: number; result: { content?: { text: string }[]; tools?: unknown[] } }[] = [];
  child.stdout.on('data', chunk => { buffer += chunk; let end; while ((end = buffer.indexOf('\n')) >= 0) { answers.push(JSON.parse(buffer.slice(0, end))); buffer = buffer.slice(end + 1); } });
  const call = async (row: unknown) => { child.stdin.write(`${JSON.stringify(row)}\n`); const n = answers.length;
    for (let i = 0; i < 100 && answers.length === n; i++) await new Promise(resolve => setTimeout(resolve, 5)); return answers.at(-1)!; };
  const listed = (await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools as { inputSchema: Record<string, unknown> }[];
  expect(listed).toHaveLength(1);
  expect(listed[0]!.inputSchema).not.toHaveProperty('oneOf');
  const row = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'observe', arguments: input } };
  expect(JSON.parse((await call(row)).result.content![0]!.text)).toEqual(observation);
  expect(JSON.parse((await call(row)).result.content![0]!.text)).toMatchObject({ status: 'refused' }); expect(w.count()).toBe(1);
  const socket = server.args[1];
  const arbitrary = await new Promise<string>(resolve => { let text = ''; const link = connect(socket);
    link.on('connect', () => link.end('owner-read {"id":"evil","input":{"page":"account-profile"},"script":"anything"}\n'));
    link.on('data', chunk => { text += chunk; }); link.on('end', () => resolve(text)); });
  expect(JSON.parse(arbitrary)).toMatchObject({ status: 'refused' });
  w.gate.close('claim');
  expect(JSON.parse((await call({ ...row, id: 3 })).result.content![0]!.text)).toMatchObject({ status: 'refused' });
});

it('the owner socket cannot exceed the claim call ceiling even when the worker omits hooks', async () => {
  const w = await world();
  expect((await w.gate.observeOwner('claim', 'one', input)).status).toBe('observed');
  expect((await w.gate.observeOwner('claim', 'two', input)).status).toBe('observed');
  expect(await w.gate.observeOwner('claim', 'three', input)).toEqual({ status: 'refused', reason: 'claim-read-budget' });
  expect(w.count()).toBe(2);
});

it('a forged post under another tool cannot complete an in-flight owner observation', async () => {
  const w = await world(); w.set({ block: true });
  const pending = w.gate.observeOwner('claim', 'one', input);
  const response = await fetch(`${w.gate.base('claim')}/admit`, { method: 'POST', body: JSON.stringify({
    kind: 'effect', phase: 'post', tool_name: 'mcp__unrelated__read', tool_use_id: 'one', result_bytes: 100 }) });
  expect(await response.json()).toMatchObject({ decision: 'deny' });
  expect(w.rows.map(row => row.state)).toEqual(['prepared']);
  w.release(); expect(await pending).toEqual(observation);
  expect(w.rows.map(row => row.state)).toEqual(['prepared', 'observed']);
});
it('the reserved owner connector never inherits a configured MCP credential or arbitrary command', async () => {
  const root = mkdtempSync(join(tmpdir(), 'owner-namespace-'));
  close.push(async () => { rmSync(root, { recursive: true, force: true }); });
  const port = await prepareSessionConnectors({ privateDirectory: root, identity: null, check: () => 'clear', ownerRead: async () => observation,
    mcp: { servers: { owner_github: { command: '/arbitrary/command', env: { COOKIE: { secretRef: 'browser-cookie' } } } },
      secrets: { owner_github: { COOKIE: 'browser-cookie' } } },
    resolveSecret: () => { throw Error('must not resolve owner credential for the worker'); } });
  close.push(() => port.close());
  const prepared = port.launch();
  expect(prepared.launch.owner_github.command).toBe(process.execPath);
  expect(prepared.launch.owner_github.args[0]).toMatch(/owner-browser-client.mjs$/u);
  expect(prepared.launch.owner_github.env).toBeUndefined();
  expect(prepared.nonces).toBeUndefined();
  expect(readFileSync(prepared.config, 'utf8')).not.toMatch(/COOKIE|browser-cookie|arbitrary/u);
});

it('executes an authorized sequence through the real MCP socket, admission and DOM; a disabled bridge cannot pass', async () => {
  for (const [disabled, count] of [[false, 2], [true, 2], [false, 4]] as const) {
    const pages = Array.from({ length: count }, (_, i) => i % 2 ? 'account-repositories' : 'account-profile');
    let url = new URL('https://github.com/settings/profile'), evaluations = 0;
    const browser = createOwnerBrowser({ binding: () => ({ profileId: 'echoofdawn-github', userDataDir: '/owned/chrome' }),
      platform: 'darwin', uid: 501, now: () => 10, hold: async () => ({ release: async () => {} }), wait: async () => {},
      scrub: (s: string) => s, held: () => 'clear', execute: async (command: string, args: string[]) => {
        if (command === '/bin/ps') return '81453 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/owned/chrome';
        evaluations++;
        return runInNewContext(args.at(-1)!, { location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search,
          assign: (target: string) => { url = new URL(target); } }, document: { readyState: 'complete', title: count === 4 ? '\ud800'.repeat(256) : `Title ${url.pathname}`,
          querySelector: (selector: string) => selector.startsWith('form') ? null : { content: 'EchoOfDawn' } } });
      } });
    const w = await world({ browser, disabled, pages }), root = mkdtempSync(join(tmpdir(), 'owner-sequence-'));
    close.push(async () => { rmSync(root, { recursive: true, force: true }); });
    const port = await prepareSessionConnectors({ mcp: null, privateDirectory: root, identity: null, check: () => 'clear',
      ownerRead: (id: string, value: unknown) => w.gate.observeOwner('claim', id, value) });
    close.push(() => port.close());
    const server = port.launch().launch.owner_github;
    const child = spawn(server.command, server.args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const reply = new Promise<string>((resolve, reject) => { let text = ''; child.stdout.on('data', chunk => { text += chunk; });
      child.on('error', reject); child.on('exit', code => code === 0 ? resolve(text) : reject(Error(`client exit ${code}`))); });
    child.stdin.end(`${JSON.stringify({ jsonrpc: '2.0', id: 41, method: 'tools/call', params: { name: 'observe', arguments: { pages } } })}\n`);
    const result = JSON.parse(JSON.parse(await reply).result.content[0].text);
    if (disabled) { expect(result.status).toBe('refused'); expect(evaluations).toBe(0); expect(w.rows).toEqual([]); }
    else {
      expect(result.status).toBe('observed'); expect(result.observations.map((row: { page: string }) => row.page)).toEqual(pages);
      expect(evaluations).toBe(count * 2 - 1);
      if (count === 4) expect(Buffer.byteLength(JSON.stringify(result))).toBeGreaterThan(4096);
      expect(w.rows.map(row => row.state)).toEqual(['prepared', 'observed']);
      expect(JSON.parse(w.rows[0]!.cause!).authorization.input).toEqual({ pages });
    }
  }
});

it('refuses ungranted, expired and stopped sequences and withholds observations when the exact grant is replaced', async () => {
  const pages = ['account-profile', 'account-repositories'];
  const uncovered = await world();
  expect((await uncovered.gate.observeOwner('claim', 'sequence', { pages })).status).toBe('refused'); expect(uncovered.count()).toBe(0);
  for (const patch of [{ now: 100 }, { stop: true }, { grant: false }]) {
    const w = await world({ pages }); w.set(patch);
    expect((await w.gate.observeOwner('claim', 'sequence', { pages })).status).toBe('refused'); expect(w.count()).toBe(0);
  }
  const w = await world({ pages }); w.set({ block: true });
  const result = w.gate.observeOwner('claim', 'sequence', { pages });
  w.set({ grantId: 'replacement-read' }); w.release();
  expect((await result).status).toBe('refused'); expect(w.rows.map(row => row.state)).toEqual(['prepared']);
});

// Rules 18/100/103: authority comes from the operator's recorded connection through the existing writer; the runner's
// own policy reader, connector admission, gate and fixed DOM adapter are what the installed record must satisfy.
const REVIEWED_PAGES = ['account-profile', 'account-repositories'];
const connection = { service: 'github', account: 'EchoOfDawn', ownership: 'agent', recovery: 'Withdraw this connection' };
const operatorRequest = (extra: object = {}) => ({ source: 'operator:connection:1', custodian: 'installation-owner', recovery: 'Revoke standing trust',
  resourceLevelUsd: 0, effects: [], mcp: { mcpServers: {}, reads: [] },
  role: { description: 'Keep my repositories tidy', accounts: ['github:EchoOfDawn'], channels: [], trust: 'Read my own account' }, ...extra });
function installRoot() {
  const root = mkdtempSync(join(tmpdir(), 'owner-install-')); mkdirSync(join(root, 'chrome'));
  close.push(async () => { rmSync(root, { recursive: true, force: true }); });
  writeFileSync(join(root, 'owner-browser.json'), JSON.stringify({ profileId: 'echoofdawn-github', service: 'github', account: 'EchoOfDawn', ownership: 'agent', userDataDir: realpathSync(join(root, 'chrome')) }));
  return root;
}
const standingTrust = (root: string, action: string, request?: object) => {
  const path = join(root, 'operator-request.json');
  if (request) writeFileSync(path, JSON.stringify(request));
  return spawnSync(process.execPath, ['scripts/setup-standing-trust.mjs', action, root, ...(request ? [path] : [])], { encoding: 'utf8', timeout: 60000 });
};
/** One claim's read of the pages under whatever the installation's effect-policy file says at this moment. */
async function installedRead(root: string, value: object) {
  let url = new URL('https://github.com/settings/profile'), evaluations = 0;
  const browser = createOwnerBrowser({ binding: () => readOwnerBrowserBinding(root), platform: 'darwin', uid: 501, now: () => 10,
    hold: async () => ({ release: async () => {} }), wait: async () => {}, scrub: (s: string) => s, held: () => 'clear',
    execute: async (command: string, args: string[]) => {
      if (command === '/bin/ps') return `81453 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=${realpathSync(join(root, 'chrome'))}`;
      evaluations++;
      return runInNewContext(args.at(-1)!, { location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search,
        assign: (target: string) => { url = new URL(target); } }, document: { readyState: 'complete', title: `Title ${url.pathname}`,
        querySelector: (selector: string) => selector.startsWith('form') ? null : { content: 'EchoOfDawn' } } });
    } });
  const w = await world({ browser, policy: () => currentEffectPolicy(() => readFileSync(join(root, 'effect-policy.json'), 'utf8')) });
  const result = await w.gate.observeOwner('claim', 'install-read', value);
  return { result, evaluations: () => evaluations };
}
const twoPages = { pages: REVIEWED_PAGES };

it('a fresh install reads both reviewed pages only under the operator connection grant, and withdrawal refuses', async () => {
  const root = installRoot();
  const fresh = spawnSync(process.execPath, ['bin/instar2.mjs', 'setup', root], { encoding: 'utf8', timeout: 60000,
    input: 'Keep my repositories tidy\nRead my own account\n0\nnone\n' });
  expect(fresh.status, fresh.stderr).toBe(0);
  const ungranted = await installedRead(root, twoPages);
  expect(ungranted.result.status).toBe('refused'); expect(ungranted.evaluations()).toBe(0);

  const granted = standingTrust(root, 'revise', operatorRequest({ agentGitHubConnection: connection }));
  expect(granted.status, granted.stderr).toBe(0);
  const read = await installedRead(root, twoPages);
  expect(read.result).toMatchObject({ status: 'observed' });
  expect(read.result.observations.map((row: { page: string }) => row.page)).toEqual(REVIEWED_PAGES);
  expect(JSON.parse(readFileSync(join(root, 'effect-policy.json'), 'utf8')).onboarding).toBeDefined();

  expect(standingTrust(root, 'tighten', operatorRequest({ agentGitHubConnection: connection })).status).toBe(0);
  expect((await installedRead(root, twoPages)).result.status).toBe('observed');
  expect(standingTrust(root, 'tighten', operatorRequest()).status).toBe(0);
  const narrowed = await installedRead(root, twoPages);
  expect(narrowed.result.status).toBe('refused'); expect(narrowed.evaluations()).toBe(0);
  expect((await installedRead(root, input)).result.status).toBe('refused');

  expect(standingTrust(root, 'revise', operatorRequest({ agentGitHubConnection: connection })).status).toBe(0);
  expect((await installedRead(root, twoPages)).result.status).toBe('observed');
  expect(standingTrust(root, 'revoke').status).toBe(0);
  const revoked = await installedRead(root, twoPages);
  expect(revoked.result.status).toBe('refused'); expect(revoked.evaluations()).toBe(0);
}, 120000);

it('mints nothing beyond the exact agent-owned connection and leaves unrelated and older grants as they were', async () => {
  for (const wrong of [{ ...connection, ownership: 'operator' }, { ...connection, account: 'SomeoneElse' }, { ...connection, service: 'gitlab' },
    { ...connection, pages: ['account-profile', 'account-repositories'] }, { ...connection, token: 'x' }, { ...connection, recovery: '' }, null]) {
    const root = installRoot();
    expect(() => configureTrust(root, 'setup', operatorRequest({ agentGitHubConnection: wrong }))).toThrow('agent-owned GitHub connection');
    expect(existsSync(join(root, 'effect-policy.json'))).toBe(false);
  }
  const draft = { effect: 'tool:mcp', target: 'mcp__drafts__edit', recovery: 'Restore the draft',
    registration: { consequence: 'data', reversibility: 'reversible', costUsd: 0 } };
  const unrelated = setupTrustPolicy(operatorRequest({ effects: [draft], agentGitHubConnection: connection }));
  expect(unrelated.grants.find((row: { target: string }) => row.target === 'mcp__drafts__edit')).not.toHaveProperty('ownerBrowserPages');
  expect(unrelated.grants.find((row: { target: string }) => row.target === OWNER_BROWSER_TOOL)).toMatchObject({ ownerBrowserPages: REVIEWED_PAGES, approves: ['scope'], source: 'operator:connection:1' });
  expect(() => setupTrustPolicy(operatorRequest({ effects: [{ ...draft, target: OWNER_BROWSER_TOOL }], agentGitHubConnection: connection }))).toThrow('agent-owned GitHub connection');
  // A grant recorded before the page scope stays a one-page grant on every path that is not a new operator choice.
  const older = installRoot();
  configureTrust(older, 'setup', operatorRequest({ agentGitHubConnection: connection }));
  const path = join(older, 'effect-policy.json'), recorded = JSON.parse(readFileSync(path, 'utf8'));
  delete recorded.grants[0].ownerBrowserPages;
  writeFileSync(path, JSON.stringify(recorded)); const bytes = readFileSync(path, 'utf8');
  expect((await installedRead(older, twoPages)).result.status).toBe('refused');
  expect((await installedRead(older, input)).result).toMatchObject({ status: 'observed', page: 'account-profile' });
  expect(() => configureTrust(older, 'setup', operatorRequest({ agentGitHubConnection: connection }))).toThrow('different operator choices');
  expect(() => configureTrust(older, 'tighten', operatorRequest({ agentGitHubConnection: connection }))).toThrow('cannot widen');
  expect(readFileSync(path, 'utf8')).toBe(bytes);
});

it('keeps the no-answer reason in the agent result through the exact-grant effect owner', async () => {
  let calls = 0;
  const browser = createOwnerBrowser({ binding: () => ({ userDataDir: '/owned/chrome' }), platform: 'darwin', uid: 501, now: () => 10,
    hold: async () => ({ release: async () => {} }), scrub: (s: string) => s, held: () => 'clear', wait: async () => {},
    execute: async (command: string) => {
      if (command === '/bin/ps') return '81453 501 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/owned/chrome';
      calls++; return '{}';
    } });
  const w = await world({ browser });
  expect(await w.gate.observeOwner('claim', 'timeout', input)).toEqual({ status: 'unavailable', reason: 'browser-did-not-answer-in-time' });
  expect(calls).toBe(40);
  expect(w.rows.map(row => row.state)).toEqual(['prepared', 'observed']);
  expect(await w.gate.observeOwner('claim', 'timeout', input)).toMatchObject({ status: 'refused' });
  expect(calls).toBe(40);
});
