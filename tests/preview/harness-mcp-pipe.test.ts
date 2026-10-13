// Linux /dev/fd opens must reach a real pipe; credentials remain one-use descriptors.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
it.each([false, true])('hands MCP bytes off once without argv/environment disclosure (login=%s)', login => {
  const root = mkdtempSync(join(tmpdir(), 'mcp-pipe-')); roots.push(root);
  const launcher = join(root, 'launch.mjs'), reader = join(root, 'reader');
  copyFileSync('tests/preview/harness-launch.mjs', launcher);
  writeFileSync(reader, '#!/bin/sh\ncat /dev/fd/4 > "$OUT/mcp"\ncat /dev/fd/4 > "$OUT/again"\n'
    + (login ? 'cat <&3 > "$OUT/login"\ncat <&3 > "$OUT/login-again"\n' : '')
    + 'env > "$OUT/env"\nprintf "%s\\n" "$@" > "$OUT/argv"\ncat > "$OUT/prompt"\n', { mode: 0o755 });
  const mcp = JSON.stringify({ mcpServers: { fixture: { command: 'fixture', env: { KEY: 'fixture-mcp-value' } } } });
  const header = { mcp, ...(login ? { login: 'fixture-login-value' } : {}) };
  const result = spawnSync(process.execPath, [launcher, '--handoff', `OUT=${root}`, '--', reader, '--mcp-config', '/dev/fd/4'],
    { input: `${JSON.stringify(header)}\nprompt remainder`, encoding: 'utf8', timeout: 5000, env: { PATH: '/usr/bin:/bin' } });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(readFileSync(join(root, 'mcp'), 'utf8')).toBe(mcp);
  expect(readFileSync(join(root, 'again'), 'utf8')).toBe('');
  expect(readFileSync(join(root, 'prompt'), 'utf8')).toBe('prompt remainder');
  if (login) {
    expect(readFileSync(join(root, 'login'), 'utf8')).toBe('fixture-login-value\n');
    expect(readFileSync(join(root, 'login-again'), 'utf8')).toBe('');
  }
  const exposed = readFileSync(join(root, 'env'), 'utf8') + readFileSync(join(root, 'argv'), 'utf8') + result.stderr;
  expect(exposed).not.toContain('fixture-login-value');
  expect(exposed).not.toContain('fixture-mcp-value');
  for (const input of ['bad\n', '{"mcp":4}\n', '{"login":"has space"}\n', '']) {
    const refusal = spawnSync(process.execPath, [launcher, '--handoff', '--', reader], { input, encoding: 'utf8', timeout: 5000 });
    expect(refusal.status).toBe(125);
  }
});
