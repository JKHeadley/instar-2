import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function freshTree() {
  const root = mkdtempSync(join(tmpdir(), 'instar-wiring-build-'));
  roots.push(root);
  for (const path of ['scripts', 'src', 'package.json', 'tsconfig.json', 'tsconfig.build.json'])
    cpSync(resolve(path), join(root, path), { recursive: true });
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  return root;
}
function check(root: string) {
  return spawnSync(process.execPath, ['scripts/check-register-wiring.mjs'], {
    cwd: root, encoding: 'utf8', timeout: 60_000,
  });
}

test('direct wiring check builds a missing core before loading register consumers', () => {
  const root = freshTree();
  expect(existsSync(join(root, 'dist/index.js'))).toBe(false);
  const result = check(root);
  expect(result.error).toBeUndefined();
  expect(existsSync(join(root, 'dist/index.js'))).toBe(true);
  // No register is supplied: reaching its read proves module loading completed,
  // while still refusing absent evidence instead of claiming a successful check.
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('generated/register.json');
  expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
}, 60_000);

test('a failed build is a finding and does not continue into compiled imports', () => {
  const root = freshTree();
  writeFileSync(join(root, 'tsconfig.build.json'), '{ invalid json');
  const result = check(root);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('absent and could not be built');
  expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
  expect(result.stderr).not.toContain('generated/register.json');
}, 60_000);
