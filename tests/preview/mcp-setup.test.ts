import { afterEach, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createSecretCustody, secretRef } from './secret-custody.js';
// @ts-expect-error Installer JavaScript.
import { installMcp, DEFAULT_MCP } from '../../scripts/mcp-setup.mjs';
// @ts-expect-error Real runtime consumer.
import { readRootMcp } from './tool-turn.mjs';
// @ts-expect-error Real effect admission consumer.
import { admitToolCallEffect } from './tool-admission.mjs';
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
  const before = bytes(p), vaultTime = statSync(join(p, 'credentials.json')).mtimeMs;
  expect(installMcp(p, { mcpServers: { account: { command: 'connector' } }, reads: ['mcp__account__read'] },
    { account: { TOKEN: 'opaque-test-only-value' } }, custody)).toBe(false);
  expect(bytes(p)).toBe(before);
  expect(statSync(join(p, 'credentials.json')).mtimeMs).toBe(vaultTime);
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
it('replays recorded model and reply shapes through the newly installed read boundary', () => {
  const p = root(); installMcp(p);
  const mcp = readRootMcp(p);
  const rows = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  for (const row of rows) {
    const config = { operations: [], mcpReads: mcp.reads };
    expect(admitToolCallEffect('mcp__playwright__browser_snapshot', { text: row.raw }, config, 1), row.id)
      .toMatchObject({ admitted: true });
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
