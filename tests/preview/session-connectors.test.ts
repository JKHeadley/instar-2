import { afterEach, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error physical host boundary
import { prepareSessionConnectors } from './session-connectors.mjs';
// @ts-expect-error physical host boundary
import { readRootMcp } from './tool-turn.mjs';
// @ts-expect-error physical host boundary
import { grantAcl, harnessAcl, HARNESS_TURNS, HARNESS_USER } from './harness-user.mjs';
const roots: string[] = [];
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
