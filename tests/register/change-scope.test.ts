import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFiles } from '../../scripts/build-register.mjs';

const roots: string[] = [];
const directory = () => { const root = mkdtempSync(join(tmpdir(), 'register-scope-')); roots.push(root); return root; };
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  vi.stubEnv('REGISTER_CHANGE_BASE', undefined); vi.stubEnv('CHANGE_REVIEW_BASE', undefined);
  const root = directory();
  const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  writeFileSync(join(root, 'base.ts'), 'base'); git('add', '.'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', base);
  git('update-ref', 'refs/remotes/mirror/main', base);
  writeFileSync(join(root, 'feature.ts'), 'feature'); git('add', '.'); git('commit', '-qm', 'feature');
  const head = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/feature', head);
  const child = git('commit-tree', 'HEAD^{tree}', '-p', head, '-m', 'future');
  git('update-ref', 'refs/remotes/origin/future', child);
  return { root, git, head };
}

it('keeps own commits when pushed or contained by a remote descendant, plus dirty and untracked paths', () => {
  const { root } = fixture();
  writeFileSync(join(root, 'base.ts'), 'dirty'); writeFileSync(join(root, 'untracked.ts'), 'new');
  expect(changedFiles(root)).toEqual(['base.ts', 'feature.ts', 'untracked.ts']);
});

it('uses an explicit boundary and still includes local changes', () => {
  const { root, head } = fixture();
  vi.stubEnv('REGISTER_CHANGE_BASE', head);
  expect(changedFiles(root)).toEqual([]);
  writeFileSync(join(root, 'base.ts'), 'dirty');
  expect(changedFiles(root)).toEqual(['base.ts']);
});

it('fails closed for an unreadable boundary or a directory outside Git', () => {
  const { root } = fixture();
  vi.stubEnv('REGISTER_CHANGE_BASE', 'missing-boundary');
  expect(changedFiles(root)).toBeNull();
  expect(changedFiles(directory())).toBeNull();
});
