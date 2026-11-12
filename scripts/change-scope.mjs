// Rules 72/95: only the caller knows the change's target (on the live line this
// is the unit review's Subject base, not origin/main). Remote reachability or
// the latest repair review cannot establish that boundary. Unknown fails closed.
import { execFileSync } from 'node:child_process';

export function scopeGit(root, args, input) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    ...(input === undefined ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input, stdio: ['pipe', 'pipe', 'pipe'] }) });
}
export function changeCommits(root, target) {
  if (target === undefined || target === '') throw Error('Rule 95: change boundary unknown; supply CHANGE_REVIEW_BASE (the unit Subject base or target)');
  const git = (...args) => scopeGit(root, args).trim();
  if (git('rev-parse', '--is-shallow-repository') !== 'false') throw Error('Rule 95: shallow change boundary is unknown');
  const resolved = git('rev-parse', '--verify', `${target}^{commit}`);
  const boundaries = git('merge-base', '--all', 'HEAD', resolved).split('\n').filter(Boolean);
  if (boundaries.length !== 1) throw Error('Rule 95: change has no unique merge-base');
  return git('rev-list', 'HEAD', '--not', boundaries[0]);
}
