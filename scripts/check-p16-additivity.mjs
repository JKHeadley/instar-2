// Compare every pre-Part-Sixteen test file against main. New P16 fixtures are
// additive; no existing owner fixture may be rewritten to manufacture coverage.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const nulSplit = output => output.split('\0').filter(Boolean);
const tracked = nulSplit(execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', 'main'], { encoding: 'utf8' }));
const untracked = nulSplit(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }));
const changedPaths = [...new Set([...tracked, ...untracked])];
const p16SliceChanged = changedPaths.some(path => path.startsWith('src/measurement/')
  || path.startsWith('tests/measurement/')
  || /^tests\/(integration|e2e)\/measurement(?:-[^/]*)?\.test\.ts$/.test(path));

// A different feature branch re-synced onto main has no Part Sixteen additivity
// claim to prove. Part Sixteen branches still execute the original byte comparison.
if (!p16SliceChanged) {
  console.log('P16 additivity: Part Sixteen feature scope unchanged; byte-identical to main check is not applicable to this cross-feature branch.');
  process.exit(0);
}

const roots = ['tests'];
const listed = execFileSync('git', ['ls-tree', '-r', '--name-only', 'main', '--', ...roots], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const changed = [];
for (const file of listed) {
  const base = execFileSync('git', ['show', `main:${file}`]);
  let current;
  try { current = readFileSync(file); } catch { changed.push(file); continue; }
  if (!base.equals(current)) changed.push(file);
}
if (changed.length) throw new Error(`P16 additivity changed pre-existing test files: ${changed.join(', ')}`);
console.log(`P16 additivity: ${listed.length} pre-existing test files are byte-identical to main.`);
