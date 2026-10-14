// /dev/fd opens and EOF rereads must work on every host; credentials remain one-use descriptors.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
it.each([
  { login: false, mcpPresent: false }, { login: true, mcpPresent: false },
  { login: false, mcpPresent: true }, { login: true, mcpPresent: true },
])('hands bytes off once without argv/environment disclosure ($login, $mcpPresent)', ({ login, mcpPresent }) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mcp-pipe-'))); roots.push(root);
  const launcher = join(root, 'launch.mjs'), reader = join(root, 'reader');
  copyFileSync('tests/preview/harness-launch.mjs', launcher);
  writeFileSync(reader, '#!/bin/sh\n'
    + (mcpPresent ? 'cat /dev/fd/4 > "$OUT/mcp"\ncat /dev/fd/4 > "$OUT/again"\n' : '')
    + (login ? 'cat <&3 > "$OUT/login"\ncat <&3 > "$OUT/login-again"\n' : '')
    + 'env > "$OUT/env"\nprintf "%s\\n" "$@" > "$OUT/argv"\ncat > "$OUT/prompt"\n', { mode: 0o755 });
  const mcp = JSON.stringify({ mcpServers: { fixture: { command: 'fixture', env: { KEY: 'fixture-mcp-value' } } } });
  const header = { ...(mcpPresent ? { mcp } : {}), ...(login ? { login: 'fixture-login-value' } : {}) };
  const result = spawnSync(process.execPath, [launcher, '--handoff', `OUT=${root}`, '--', reader,
    ...(mcpPresent ? ['--mcp-config', '/dev/fd/4'] : [])],
    { input: `${JSON.stringify(header)}\nprompt remainder`, encoding: 'utf8', timeout: 5000, env: { PATH: '/usr/bin:/bin' } });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  if (mcpPresent) {
    expect(readFileSync(join(root, 'mcp'), 'utf8')).toBe(mcp);
    expect(readFileSync(join(root, 'again'), 'utf8')).toBe('');
  } else expect(existsSync(join(root, 'mcp'))).toBe(false);
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
