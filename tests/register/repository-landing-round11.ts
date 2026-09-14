import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LandingReadPort } from '../../src/facts/index.js';

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Build and then re-resolve a real repository merge through Part Ten's public landing port. */
export function realRepositoryLanding(root: string): Readonly<{ base: string; commit: string; landing: LandingReadPort }> {
  git(root, 'init', '-b', 'main');
  writeFileSync(join(root, 'base.txt'), 'reviewed base\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'reviewed base');
  const base = git(root, 'rev-parse', 'HEAD');
  git(root, 'switch', '-qc', 'approved-owner-change');
  writeFileSync(join(root, 'approved.txt'), 'approved owner change\n');
  git(root, 'add', 'approved.txt');
  git(root, 'commit', '-qm', 'approved owner change');
  git(root, 'switch', '-q', 'main');
  git(root, 'merge', '--no-ff', '-qm', 'land approved owner change', 'approved-owner-change');

  const commit = git(root, 'rev-parse', 'HEAD');
  const parents = git(root, 'show', '-s', '--format=%P', commit).split(/\s+/).filter(Boolean);
  const main = git(root, 'rev-parse', 'main');
  execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', commit, main], { stdio: 'ignore' });
  if (parents.length < 2 || parents[0] !== base) throw new Error('fixture did not create the reviewed merge landing');
  return Object.freeze({ base, commit, landing: Object.freeze({ owner: 'part-ten', merges: [Object.freeze({
    commit, onMain: true, parentCount: parents.length, reviewedBase: parents[0],
  })] }) });
}
