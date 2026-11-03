import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
// @ts-expect-error physical checkpoint
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error plain hook
import { admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error physical connector composition
import { prepareSessionConnectors, admitSessionConnector } from './session-connectors.mjs';
// @ts-expect-error plain fixed contract
import { OWNER_BROWSER_TOOL } from './owner-browser-contract.mjs';
const close: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of close.splice(0).reverse()) await fn(); });
const input = { page: 'account-profile' };
const observation = { status: 'observed', page: 'account-profile', account: 'EchoOfDawn', title: 'Your profile', observedAt: 10, truncated: false };
async function world() {
  let stopped = false, owner = true, time = 10, failAppend = false, failObserved = false, granted = true, check = 'clear';
  let dispatches = 0, block = false, release = () => {};
  const rows: { id: string; state?: string; cause?: string }[] = [];
  const policy = () => ({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
    registered: [{ effect: 'tool:mcp', target: OWNER_BROWSER_TOOL, consequence: 'data', reversibility: 'reversible', reach: 'agent', costUsd: 0, source: 'operator:read' }],
    grants: granted ? [{ id: 'read', effect: 'tool:mcp', target: OWNER_BROWSER_TOOL, approves: ['scope'], source: 'operator:read', custodian: 'owner', recovery: 'withdraw', expiresAt: 100 }] : [] });
  const append = (row: { id: string; state?: string }) => { if (failAppend || (failObserved && row.state === 'observed')) throw Error('disk unavailable'); rows.push(row); };
  const effects = createToolEffectOwner({ append, stopped: () => stopped || !owner, now: () => time,
    prepared: (id: string) => rows.some(row => row.id === id),
    decide: (tool: string, value: unknown) => admitSessionConnector({ tool, input: value, config: { operations: [], effectPolicy: policy() }, mcp: null,
      enabled: false, now: time, decide: admitToolCallEffect }) });
  const gate = await createAdmissionGate({ append, effects, stopped: () => stopped || !owner, now: () => time, held: () => check,
    ownerBrowser: Object.assign(async () => { dispatches++; if (block) await new Promise<void>(resolve => { release = resolve; }); return observation; },
      { binding: () => ({ profileId: 'echoofdawn-github', account: 'EchoOfDawn', ownership: 'agent' }) }) });
  close.push(() => gate.stop());
  const edge = { id: 'session-work-edge:test:1', child: 'claim', budget: { deadline: 100 } };
  const open = () => gate.open('claim', { framework: 'claude-code', allowance: 2, edge }); open();
  return { gate, rows, effects, edge, open, count: () => dispatches, release: () => release(),
    set: (patch: { stop?: boolean; owner?: boolean; now?: number; append?: boolean; observed?: boolean; grant?: boolean; held?: string; block?: boolean }) => {
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
  expect((await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools).toHaveLength(1);
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
