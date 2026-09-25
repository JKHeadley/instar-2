import { execFileSync } from 'node:child_process';

// A scope proof concerns the first landing of one unit, never later owner work.
export function firstLanding(root, evidence, mainRef = 'main', headRef = 'HEAD') {
  const git = args => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const mainTip = git(['rev-parse', '--verify', mainRef]);
  const mergeBase = git(['merge-base', mainTip, headRef]);
  if (mergeBase !== mainTip) throw new Error(`first landing: stale ${mainRef} baseline ${mainTip}; ${headRef} descends from ${mergeBase}`);
  const landed = evidence.every(path => git(['ls-tree', '-r', '--name-only', mainTip, '--', path]) === path);
  return { mainTip, mergeBase, applicable: !landed };
}
