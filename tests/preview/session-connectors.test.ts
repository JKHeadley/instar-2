import { afterEach, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error physical host boundary
import { prepareSessionConnectors, admitSessionConnector } from './session-connectors.mjs';
// @ts-expect-error physical host boundary
import { createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error physical host boundary
import { admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error physical host boundary
import { readRootMcp } from './tool-turn.mjs';
// @ts-expect-error physical host boundary
import { grantAcl, harnessAcl, HARNESS_TURNS, HARNESS_USER } from './harness-user.mjs';
const roots: string[] = [];
it('admits two granted reversible ArrowDown presses while refusing a duplicate consequential write', () => {
  const key = 'mcp__playwright__browser_press_key', write = 'mcp__playwright__browser_click';
  let grant = true, stop = false, costUsd = 0, sensitive = false;
  const rows: { id: string; state: string }[] = [];
  const owner = createToolEffectOwner({ append: (row: { id: string; state: string }) => rows.push(row),
    prepared: (id: string) => rows.some(row => row.id === id && row.state === 'prepared'), stopped: () => stop, now: () => 10,
    decide: (tool: string, input: unknown) => admitSessionConnector({ tool, input, enabled: true, now: 10,
      mcp: { servers: { playwright: {} }, reads: [], browserProfile: { id: 'agent-browser' } },
      config: { operations: [], effectPolicy: { type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: sensitive ? [key] : [],
        registered: [key, write].map(target => ({ effect: 'tool:mcp', target, consequence: 'data',
          reversibility: target === key ? 'reversible' : 'irreversible', reach: 'agent', costUsd, source: 'operator:proof' })),
        grants: grant ? [key, write].map(target => ({ id: target, effect: 'tool:mcp', target, browserProfile: 'agent-browser', browserOrigin: 'https://site.test',
          approves: ['scope'], source: 'operator:proof', custodian: 'owner', recovery: 'withdraw', expiresAt: 100 })) : [] } },
      decide: admitToolCallEffect }) });
  const parent = { id: 'edge', child: 'claim' };
  const press = (call: string) => owner.admit({ parent, tool: key, input: { key: 'ArrowDown' }, call });
  const first = press('key-1'), second = press('key-2');
  expect(first.admitted).toBe(true); expect(second.admitted).toBe(true);
  expect(first.identity).not.toBe(second.identity);
  expect(press('key-1')).toMatchObject({ admitted: false, reason: expect.stringContaining('already prepared') });
  const send = (call: string) => owner.admit({ parent, tool: write, input: { selector: 'button' }, call });
  expect(send('write-1').admitted).toBe(true);
  expect(send('write-retry')).toMatchObject({ admitted: false, reason: expect.stringContaining('already prepared') });
  const network = (call: string) => owner.admit({ parent, tool: key,
    input: { key: 'ArrowDown', browserEffect: { method: 'POST', url: 'https://site.test/', bodyDigest: `sha256:${'0'.repeat(64)}` } }, call });
  costUsd = 1; expect(network('over-cap').admitted).toBe(false); costUsd = 0;
  sensitive = true; expect(network('sensitive').admitted).toBe(false); sensitive = false;
  expect(network('network-1').admitted).toBe(true);
  expect(network('network-retry')).toMatchObject({ admitted: false, reason: expect.stringContaining('already prepared') });
  grant = false; expect(press('key-3').admitted).toBe(false);
  grant = true; stop = true; expect(press('key-4').admitted).toBe(false);
  expect(rows).toHaveLength(4);
});
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const run = (command: string, args: string[]) => new Promise<{ code: number | null; out: string }>((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', data => { out += data; });
  child.on('error', reject); child.on('exit', code => resolve({ code, out }));
});
it('hands a synthetic credential to the fake connector once, keeps it out of files, and rearms only for a replacement launch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'session-connectors-')); roots.push(root);
  const token = 'synthetic-session-secret-123456';
  const mcp = readRootMcp(root, () => JSON.stringify({ mcpServers: { mail: { command: process.execPath,
    args: ['-e', 'process.stdout.write(process.env.TEST_CONNECTOR_KEY)'], env: { TEST_CONNECTOR_KEY: { secretRef: 'mail-key' } } } },
    reads: ['mcp__mail__read'] }));
  const port = await prepareSessionConnectors({ mcp, privateDirectory: root, identity: null,
    resolveSecret: () => token, check: () => 'clear' });
  try {
    const first = port.launch();
    expect(first.servers).toEqual(['mail']);
    expect(readFileSync(first.config, 'utf8')).not.toContain(token);
    expect(JSON.stringify(first)).not.toContain(token);
    const server = first.launch.mail;
    expect(await run(server.command, server.args)).toEqual({ code: 0, out: token });
    expect((await run(server.command, server.args)).code).not.toBe(0);
    const second = port.launch();
    expect(second.nonces.mail).not.toBe(first.nonces.mail);
    expect((await run(server.command, server.args)).code).not.toBe(0);
    expect(await run(second.launch.mail.command, second.launch.mail.args)).toEqual({ code: 0, out: token });
  } finally { await port.close(); }
});
it('missing custody refuses before a connector can launch; no configuration remains an empty set', async () => {
  const root = mkdtempSync(join(tmpdir(), 'session-connectors-')); roots.push(root);
  await expect(prepareSessionConnectors({ mcp: { secrets: { mail: { KEY: 'ref' } } }, privateDirectory: root,
    resolveSecret: () => { throw Error('missing custody'); } })).rejects.toThrow('missing custody');
  const port = await prepareSessionConnectors({ mcp: null });
  expect(port.launch()).toBeUndefined(); await port.close();
});
it('keeps the default browser home on the continuing session workspace', async () => {
  const root = mkdtempSync(join(tmpdir(), 'session-browser-')); roots.push(root);
  const mcp = readRootMcp(root, () => JSON.stringify({ mcpServers: { playwright: { command: 'npx',
    args: ['-y', '@playwright/mcp@latest', '--headless', '--user-data-dir', '.instar-browser-profile'] } } }));
  const port = await prepareSessionConnectors({ mcp, privateDirectory: root, workspace: root, identity: null,
    resolveSecret: () => { throw Error('no secret expected'); }, check: () => 'clear' });
  try {
    expect(port.launch().launch.playwright.env.CFFIXED_USER_HOME).toBe(root);
    expect(port.launch().launch.playwright.env.CFFIXED_USER_HOME).toBe(root);
  } finally { await port.close(); }
});
const nativeHarness = process.platform === 'darwin' && spawnSync('sudo', ['-n', '-u', '_instarharness', 'true']).status === 0;
it.skipIf(!nativeHarness)('opens the exact MCP launch file to the worker account before a continuing session starts', async () => {
  const root = mkdtempSync(join(HARNESS_TURNS, 'session-mcp-read-')); roots.push(root);
  grantAcl([root], [harnessAcl.search(HARNESS_USER)]);
  const port = await prepareSessionConnectors({ mcp: null, privateDirectory: root, identity: { user: HARNESS_USER },
    ownerRead: async () => ({ status: 'unavailable' }), resolveSecret: () => { throw Error('no secret expected'); }, check: () => 'clear' });
  try {
    const launch = port.launch();
    expect(launch.servers).toEqual(['owner_github']);
    const read = spawnSync('sudo', ['-n', '-u', HARNESS_USER, '/bin/cat', launch.config], { encoding: 'utf8' });
    expect(read.status).toBe(0);
    expect(Object.keys(JSON.parse(read.stdout).mcpServers)).toEqual(['owner_github']);
  } finally { await port.close(); }
});
