import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { changedFiles } from '../../scripts/build-register.mjs';

const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });
function repo() {
  vi.stubEnv('REGISTER_CHANGE_BASE', undefined); vi.stubEnv('CHANGE_REVIEW_BASE', undefined);
  const root = mkdtempSync(join(tmpdir(), 'register-scope-')); roots.push(root);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (path: string, text: string) => writeFileSync(join(root, path), text);
  const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  git('init', '-q'); write('feature.ts', 'base'); const base = commit();
  git('update-ref', 'refs/remotes/origin/main', base);
  const review = (boundary: string) => { mkdirSync(join(root, 'reviews'), { recursive: true }); write('reviews/own.md', `Subject base: ${boundary}\n`); };
  return { root, git, write, commit, base, review };
}
it('retains A in B -> A -> H when another unmerged remote points at A', () => {
  const r = repo(); r.write('feature.ts', 'overdue feature changed'); const a = r.commit();
  r.git('update-ref', 'refs/remotes/origin/partial', a);
  r.write('unrelated.ts', 'later unrelated change'); r.review(r.base); r.commit();
  expect(changedFiles(r.root)).toBeNull();
  vi.stubEnv('CHANGE_REVIEW_BASE', r.base);
  expect(changedFiles(r.root)).toEqual(['feature.ts', 'reviews/own.md', 'unrelated.ts']);
});
it('uses the review Subject base on a live train beyond main, even at a detached pushed head', () => {
  const r = repo(); r.write('old-train.ts', 'already in train'); const train = r.commit();
  r.write('unrelated.ts', 'own change'); r.review(train); const head = r.commit();
  r.git('update-ref', 'refs/remotes/origin/unit', head); r.git('checkout', '-q', '--detach', head);
  vi.stubEnv('CHANGE_REVIEW_BASE', train);
  expect(changedFiles(r.root)).toEqual(['reviews/own.md', 'unrelated.ts']);
});
it('returns unknown without a declared boundary or with an invalid boundary', () => {
  const r = repo(); expect(changedFiles(r.root)).toBeNull();
  r.review('0'.repeat(40)); r.commit(); expect(changedFiles(r.root)).toBeNull();
  vi.stubEnv('REGISTER_CHANGE_BASE', 'missing'); expect(changedFiles(r.root)).toBeNull();
});
it('explicit target takes precedence and uses its unique merge-base', () => {
  const r = repo(); r.write('feature.ts', 'changed'); const head = r.commit();
  r.git('checkout', '-qb', 'target', r.base); r.write('target-only.ts', 'target advanced'); const target = r.commit();
  r.git('checkout', '-q', '--detach', head); vi.stubEnv('REGISTER_CHANGE_BASE', target);
  expect(changedFiles(r.root)).toEqual(['feature.ts']);
  vi.stubEnv('REGISTER_CHANGE_BASE', head); expect(changedFiles(r.root)).toEqual([]);
});
it('retains reverted and deleted paths plus staged, unstaged and untracked files', () => {
  const r = repo(); vi.stubEnv('CHANGE_REVIEW_BASE', r.base);
  r.write('feature.ts', 'changed'); r.commit(); r.write('feature.ts', 'base'); r.commit();
  r.git('rm', 'feature.ts'); r.commit(); r.write('staged.ts', 'staged'); r.git('add', 'staged.ts');
  r.write('untracked.ts', 'untracked');
  expect(changedFiles(r.root)).toEqual(['feature.ts', 'staged.ts', 'untracked.ts']);
});
it('rejects ambiguous review bases instead of guessing a narrower range', () => {
  const r = repo(); r.write('early.ts', 'early'); const later = r.commit();
  r.review(r.base); r.write('reviews/second.md', `Subject base: ${later}\n`); r.commit();
  expect(changedFiles(r.root)).toBeNull();
});
it('does not lose the review boundary after a publication-only commit', () => {
  const r = repo(); r.write('feature.ts', 'changed'); r.review(r.base); r.commit();
  r.write('generated.json', '{}'); r.commit();
  vi.stubEnv('CHANGE_REVIEW_BASE', r.base);
  expect(changedFiles(r.root)).toEqual(['feature.ts', 'generated.json', 'reviews/own.md']);
});
it('returns unknown for shallow or unrelated target history', () => {
  const r = repo(); r.review(r.base); const head = r.commit();
  r.git('checkout', '-q', '--orphan', 'unrelated'); r.git('rm', '-rf', '.'); r.write('other.ts', 'other'); const other = r.commit();
  r.git('checkout', '-q', '--detach', head); vi.stubEnv('REGISTER_CHANGE_BASE', other);
  expect(changedFiles(r.root)).toBeNull();
  vi.stubEnv('REGISTER_CHANGE_BASE', r.base);
  writeFileSync(join(r.root, '.git/shallow'), `${r.base}\n`);
  expect(changedFiles(r.root)).toBeNull();
});

it('does not mistake a later repair record for the unit target', () => {
  const r = repo(); r.write('feature.ts', 'overdue feature changed'); r.review(r.base); const a = r.commit();
  r.write('unrelated.ts', 'repair'); r.write('reviews/repair.md', `Subject base: ${a}\n`); r.commit();
  expect(changedFiles(r.root)).toBeNull();
  vi.stubEnv('CHANGE_REVIEW_BASE', r.base);
  expect(changedFiles(r.root)).toContain('feature.ts');
});
it('returns unknown for multiple merge-bases', () => {
  const r = repo(); const tree = r.git('rev-parse', 'HEAD^{tree}');
  const a = r.git('commit-tree', tree, '-p', r.base, '-m', 'a');
  const b = r.git('commit-tree', tree, '-p', r.base, '-m', 'b');
  const head = r.git('commit-tree', tree, '-p', a, '-p', b, '-m', 'head');
  const target = r.git('commit-tree', tree, '-p', b, '-p', a, '-m', 'target');
  r.git('checkout', '-q', '--detach', head); vi.stubEnv('CHANGE_REVIEW_BASE', target);
  expect(changedFiles(r.root)).toBeNull();
});
