import { afterEach, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createSecretCustody, dueCredentialReminders, REMINDER_OFFSETS_MS, secretRef } from './secret-custody.js';
// @ts-expect-error Installer JavaScript.
import { installMcp, DEFAULT_MCP } from '../../scripts/mcp-setup.mjs';
// @ts-expect-error Real runtime consumer.
import { readRootMcp, prepareMcpLaunch } from './tool-turn.mjs';
// @ts-expect-error Real effect admission consumer.
import { admitToolCallEffect, admitToolCall } from './tool-admission.mjs';
// @ts-expect-error Release migration manifest.
import { migrations } from '../../scripts/update-release.mjs';
// @ts-expect-error Real npm installer.
import { updateRoot } from '../../scripts/update.mjs';
const roots: string[] = [];
const root = () => { const p = mkdtempSync(join(tmpdir(), 'mcp-setup-')); roots.push(p); return p; };
afterEach(() => roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })));
const bytes = (p: string) => readFileSync(join(p, 'mcp.json'), 'utf8');

it('installs the 1.x default through the real reader and repeats without writing', () => {
  const p = root(); installMcp(p);
  expect(readRootMcp(p).servers).toEqual(DEFAULT_MCP.mcpServers);
  const before = bytes(p), time = statSync(join(p, 'mcp.json')).mtimeMs;
  expect(installMcp(p)).toBe(false);
  expect(bytes(p)).toBe(before); expect(statSync(join(p, 'mcp.json')).mtimeMs).toBe(time);
});
it('preserves operator servers, read scopes, metadata and a customised default', () => {
  const p = root(), prior = { mcpServers: { playwright: { command: 'custom' }, mine: { command: 'mine' } }, reads: ['mcp__mine__read'], note: 'kept' };
  writeFileSync(join(p, 'mcp.json'), JSON.stringify(prior));
  installMcp(p);
  expect(JSON.parse(bytes(p))).toEqual(prior);
});
it('stores opaque secret env values in real encrypted custody before publishing only references', () => {
  const p = root(), custody = createSecretCustody(p, new Uint8Array(32).fill(7), () => 1);
  installMcp(p, { mcpServers: { account: { command: 'connector' } }, reads: ['mcp__account__read'] },
    { account: { TOKEN: 'opaque-test-only-value' } }, custody);
  const ref = readRootMcp(p).servers.account.env.TOKEN;
  expect(custody.resolve(secretRef(ref.secretRef))).toBe('opaque-test-only-value');
  expect(bytes(p)).not.toContain('opaque-test-only-value');
  expect(custody.records()).toMatchObject([{ kind: 'mcp', expiresAt: null, expirySource: 'unknown', reminders: [] }]);
  const before = bytes(p), vaultTime = statSync(join(p, 'credentials.json')).mtimeMs;
  expect(installMcp(p, { mcpServers: { account: { command: 'connector' } }, reads: ['mcp__account__read'] },
    { account: { TOKEN: 'opaque-test-only-value' } }, custody)).toBe(false);
  expect(bytes(p)).toBe(before);
  expect(statSync(join(p, 'credentials.json')).mtimeMs).toBe(vaultTime);
});
it('preserves JWT expiry and due reminders through encrypted custody and repeat installation', () => {
  const p = root(), expiry = 1792866600000;
  let now = expiry - 8 * 24 * 60 * 60 * 1000;
  const custody = createSecretCustody(p, new Uint8Array(32).fill(7), () => now);
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: expiry / 1000 })).toString('base64url')}.test-only-signature`;
  const config = { mcpServers: { account: { command: 'connector' } }, reads: ['mcp__account__read'] };
  const secrets = { account: { TOKEN: token } };
  expect(installMcp(p, config, secrets, custody)).toBe(true);
  const ref = readRootMcp(p).servers.account.env.TOKEN;
  expect(custody.resolve(secretRef(ref.secretRef))).toBe(token);
  expect(bytes(p)).not.toContain(token);
  expect(custody.records()).toMatchObject([{ name: ref.secretRef, kind: 'jwt', expiresAt: expiry,
    expirySource: 'jwt-exp', reminders: [...REMINDER_OFFSETS_MS.map(offset => expiry - offset), expiry] }]);
  expect(dueCredentialReminders(custody.records(), now)).toEqual([]);
  now = expiry - REMINDER_OFFSETS_MS[0]!;
  expect(dueCredentialReminders(custody.records(), now)).toMatchObject([{ name: ref.secretRef, stage: 0, expiresAt: expiry }]);
  const before = bytes(p), registry = readFileSync(join(p, 'credentials.json'), 'utf8');
  expect(installMcp(p, config, secrets, custody)).toBe(false);
  expect(bytes(p)).toBe(before);
  expect(readFileSync(join(p, 'credentials.json'), 'utf8')).toBe(registry);
  expect(dueCredentialReminders(custody.records(), expiry)).toMatchObject([{ stage: REMINDER_OFFSETS_MS.length }]);
});
it('refuses an invalid list or conflicting account without changing the old file', () => {
  const p = root(); installMcp(p); const before = bytes(p);
  for (const config of [{ mcpServers: { bad: { args: [] } } }, { mcpServers: {}, reads: ['foreign'] }, { mcpServers: { bad: { command: 'x' } }, reads: ['foreign'] }])
    expect(() => installMcp(p, config)).toThrow();
  expect(() => installMcp(p, { mcpServers: { playwright: { command: 'replacement' } } })).toThrow();
  expect(bytes(p)).toBe(before);
});
it('preserves corrupt existing bytes and refuses competing merge writers', () => {
  const p = root(); writeFileSync(join(p, 'mcp.json'), 'null');
  expect(() => installMcp(p)).toThrow(); expect(bytes(p)).toBe('null');
  mkdirSync(join(p, '.mcp-setup-lock'));
  expect(() => installMcp(p)).toThrow(); expect(bytes(p)).toBe('null');
});
it('refuses malformed env before secret injection can turn it into an object', () => {
  const p = root(); installMcp(p); const before = bytes(p);
  const custody = createSecretCustody(p, new Uint8Array(32).fill(3), () => 1);
  expect(() => installMcp(p, { mcpServers: { account: { command: 'connector', env: 'malformed' } } },
    { account: { TOKEN: 'opaque-test-value' } }, custody)).toThrow();
  expect(bytes(p)).toBe(before); expect(custody.records()).toEqual([]);
});
it('refuses even an opaque inline env value instead of relying on token recognition', () => {
  const p = root(); installMcp(p); const before = bytes(p);
  expect(() => installMcp(p, { mcpServers: { account: { command: 'connector', env: { TOKEN: 'opaque-test-value' } } } }))
    .toThrow();
  expect(bytes(p)).toBe(before);
});
it('secret injection requires an own server entry, not an inherited object property', () => {
  const p = root(); installMcp(p); const before = bytes(p);
  const custody = createSecretCustody(p, new Uint8Array(32).fill(3), () => 1);
  expect(() => installMcp(p, { mcpServers: { account: { command: 'connector' } } },
    JSON.parse('{"__proto__":{"TOKEN":"opaque-test-value"}}'), custody)).toThrow();
  expect(bytes(p)).toBe(before); expect(custody.records()).toEqual([]);
});
it('replays recorded model and reply shapes through the newly installed read boundary', () => {
  const p = root(); installMcp(p);
  const mcp = readRootMcp(p);
  const rows = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  for (const row of rows) {
    const config = { operations: [], mcpReads: mcp.reads };
    for (const tool of mcp.reads)
      expect(admitToolCallEffect(tool, { text: row.raw, action: 'list', url: 'about:blank' }, config, 1), row.id)
        .toMatchObject({ admitted: true, consequential: false });
    // Recorded model/reply bytes are inert payload: executable URL classification still reaches the effect boundary.
    const tool = 'mcp__playwright__browser_navigate';
    const input = { url: `JaVa\tScRiPt:void(${JSON.stringify(row.raw)})` };
    expect(admitToolCallEffect(tool, input, config, 1), row.id).toMatchObject({ admitted: false, consequential: true });
    expect(admitToolCall({ tool_name: tool, tool_input: input }, { ...config, maxCalls: 100 }, 1,
      { exists: () => true, realpath: (path: string) => path }), row.id).toMatchObject({ decision: 'deny' });
    expect(admitToolCallEffect('mcp__playwright__browser_click', { text: row.raw }, config, 1), row.id)
      .toMatchObject({ admitted: false });
  }
});
it('the registered release migration reaches an existing root with no MCP file', async () => {
  const p = root(); writeFileSync(join(p, 'operator.json'), 'untouched');
  const migration = migrations.find((m: { id: string }) => m.id === 'mcp-defaults-1024');
  expect(migration).toBeDefined(); await migration.run(p);
  expect(readRootMcp(p).servers).toEqual(DEFAULT_MCP.mcpServers);
  const before = bytes(p); await migration.run(p); expect(bytes(p)).toBe(before);
  expect(readFileSync(join(p, 'operator.json'), 'utf8')).toBe('untouched');
});
it('the production npm install carries the loader dependency and migrates before switching', async () => {
  const p = root(), cache = process.env.npm_config_cache;
  process.env.npm_config_cache = root();
  try {
    const result = await updateRoot(p, { release: 'mcp-connect-proof', source: `file:${process.cwd()}` });
    expect(result.status).toBe('updated');
    expect(readRootMcp(p).servers).toEqual(DEFAULT_MCP.mcpServers);
    expect(JSON.parse(readFileSync(join(p, 'version.json'), 'utf8')).migrations).toContain('mcp-defaults-1024');
  } finally {
    if (cache === undefined) delete process.env.npm_config_cache; else process.env.npm_config_cache = cache;
  }
}, 120000);
it('real setup installs defaults and the add CLI consumes secrets only from stdin', () => {
  const p = root();
  const setup = spawnSync(process.execPath, ['bin/instar2.mjs', 'setup', p],
    { input: 'Help with drafts\nWork within the role\n0\nnone\n', encoding: 'utf8', timeout: 30000 });
  expect(setup.status, setup.stderr).toBe(0); expect(readRootMcp(p).servers).toEqual(DEFAULT_MCP.mcpServers);
  const input = JSON.stringify({ mcpServers: { account: { command: 'connector' } }, reads: ['mcp__account__read'],
    secretEnv: { account: { TOKEN: 'opaque-cli-test-value' } } });
  const add = spawnSync(process.execPath, ['bin/instar2.mjs', 'mcp-add', p], { input, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.alloc(32, 8).toString('hex') } });
  expect(add.status, add.stderr).toBe(0);
  expect(add.stdout + add.stderr + bytes(p)).not.toContain('opaque-cli-test-value');
  expect(readRootMcp(p).secrets.account.TOKEN).toBeTruthy();
});

it('starts a bare MCP command beside installation node under a minimal harness PATH', () => {
  const p = root(), bin = join(p, 'installation-bin'); mkdirSync(bin);
  symlinkSync(process.execPath, join(bin, 'node'));
  writeFileSync(join(bin, 'mcp-path-proof'), '#!/usr/bin/env node\nprocess.stdout.write("connector-started");\n', { mode: 0o700 });
  const mcp = { servers: { proof: { command: 'mcp-path-proof' } }, reads: [], secrets: {} };
  const launch = prepareMcpLaunch({ mcp, privateDirectory: p, socket: '/unused', node: join(bin, 'node') });
  const server = JSON.parse(readFileSync(launch.config, 'utf8')).mcpServers.proof;
  const result = spawnSync(server.command, server.args ?? [], { env: { PATH: '/usr/bin:/bin', ...server.env }, encoding: 'utf8' });
  expect(result.error).toBeUndefined(); expect(result.status).toBe(0); expect(result.stdout).toBe('connector-started');
  expect(mcp.servers.proof).toEqual({ command: 'mcp-path-proof' });
});
it('migrates the shipped snapshot-only default and admits browser reads but not actions', async () => {
  const p = root();
  writeFileSync(join(p, 'mcp.json'), JSON.stringify({ mcpServers: DEFAULT_MCP.mcpServers, reads: ['mcp__playwright__browser_snapshot'] }));
  const migration = migrations.find((m: { id: string }) => m.id === 'mcp-browser-reads-1024');
  expect(migration).toBeDefined(); await migration.run(p);
  const before = bytes(p); await migration.run(p); expect(bytes(p)).toBe(before);
  const config = { workspace: p, tmp: p, maxCalls: 100, operations: [], mcpReads: readRootMcp(p).reads };
  const fs = { exists: () => true, realpath: (path: string) => path };
  for (const name of ['navigate', 'snapshot', 'take_screenshot', 'wait_for', 'console_messages', 'network_requests', 'tabs']) {
    const tool = `mcp__playwright__browser_${name}`, input = { action: 'list', url: 'https://example.com' };
    expect(admitToolCallEffect(tool, input, config, 1), name).toMatchObject({ admitted: true, consequential: false });
    expect(admitToolCall({ tool_name: tool, tool_input: input }, config, 1, fs), name).toMatchObject({ decision: 'allow' });
  }
  for (const name of ['click', 'type', 'fill_form', 'evaluate', 'file_upload', 'tabs']) {
    const tool = `mcp__playwright__browser_${name}`;
    for (const action of ['new', 'close', 'select', undefined]) {
      expect(admitToolCallEffect(tool, { action }, config, 1), name).toMatchObject({ admitted: false });
      expect(admitToolCall({ tool_name: tool, tool_input: { action } }, config, 1, fs), name).toMatchObject({ decision: 'deny' });
    }
  }
});

it('preserves an explicit server PATH and adds no other runner environment to the launch', () => {
  const p = root(), servers = { plain: { command: 'connector', env: { PATH: '/operator/bin', LOG: 'debug' } },
    keyed: { command: 'connector', env: { TOKEN: { secretRef: 'key' } } } };
  const launch = prepareMcpLaunch({ mcp: { servers, secrets: { keyed: { TOKEN: 'key' } } }, privateDirectory: p, socket: '/unused' });
  expect(launch.launch.plain).toEqual(servers.plain);
  expect(Object.keys(launch.launch.keyed.env)).toEqual(['PATH']);
  expect(launch.launch.keyed.env.PATH).toContain(process.execPath.slice(0, process.execPath.lastIndexOf('/')));
  expect(readFileSync(launch.config, 'utf8')).not.toContain('secretRef');
});
it('replays the proof-room failed-server record and admits its requested browser navigation', () => {
  const proof = JSON.parse(readFileSync(new URL('./fixtures/mcp-connect-1024-tools-m2.json', import.meta.url), 'utf8'));
  expect(proof.update).toBe(840343944);
  expect(JSON.parse(proof.calls[0].result).failed_mcp_servers).toMatchObject([{ name: 'playwright', errorCode: 'ENOENT' }]);
  const p = root(); installMcp(p);
  expect(admitToolCallEffect('mcp__playwright__browser_navigate', { url: 'https://example.com' },
    { operations: [], mcpReads: readRootMcp(p).reads }, 1)).toMatchObject({ admitted: true, consequential: false });
});
