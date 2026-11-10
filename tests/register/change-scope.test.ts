import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFiles, deadlineLines } from '../../scripts/build-register.mjs';

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
  return { root, git, head, base };
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

it('keeps an earlier own-feature commit also reachable from another unmerged remote branch (PR 199 review)', () => {
  const { root, git, head } = fixture();
  git('update-ref', 'refs/remotes/origin/partial-feature', head);
  writeFileSync(join(root, 'unrelated.ts'), 'second commit'); git('add', '.'); git('commit', '-qm', 'unrelated');
  expect(changedFiles(root)).toEqual(['feature.ts', 'unrelated.ts']);
});

it('uses the target merge-base without claiming target-only changes', () => {
  const { root, git, head, base } = fixture();
  git('checkout', '-qb', 'target', base);
  writeFileSync(join(root, 'target-only.ts'), 'target'); git('add', '.'); git('commit', '-qm', 'target');
  vi.stubEnv('CHANGE_REVIEW_BASE', 'target');
  git('checkout', '-q', '--detach', head);
  expect(changedFiles(root)).toEqual(['feature.ts']);
});

it('fails closed without the target even when unrelated remote tips exist', () => {
  const { root, git } = fixture();
  git('update-ref', '-d', 'refs/remotes/origin/main');
  expect(changedFiles(root)).toBeNull();
});

it('exposes a refusal notice on its own line for the Studio reader, and ignores other errors', () => {
  const notice = 'REGISTER-DEADLINE OVERDUE: deadline:feature:rungraph-core:1792886400000; rule 72; rungraph-core';
  expect(deadlineLines(`feature rungraph-core graduation overdue; ${notice}`)).toEqual([notice]);
  expect(deadlineLines('source pin trails')).toEqual([]);
});

it('fails closed when target history is unrelated or has multiple merge-bases', () => {
  const { root, git, head, base } = fixture();
  const unrelated = git('commit-tree', 'HEAD^{tree}', '-m', 'unrelated root');
  git('update-ref', 'refs/remotes/origin/main', unrelated);
  expect(changedFiles(root)).toBeNull();
  const sibling = git('commit-tree', 'HEAD^{tree}', '-p', base, '-m', 'sibling');
  const left = git('commit-tree', 'HEAD^{tree}', '-p', head, '-p', sibling, '-m', 'left merge');
  const right = git('commit-tree', 'HEAD^{tree}', '-p', sibling, '-p', head, '-m', 'right merge');
  git('checkout', '-q', '--detach', left); git('update-ref', 'refs/remotes/origin/main', right);
  expect(git('merge-base', '--all', left, right).split('\n')).toHaveLength(2);
  expect(changedFiles(root)).toBeNull();
});
