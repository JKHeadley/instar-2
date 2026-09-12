// Compare every pre-Part-Sixteen test file against main. New P16 fixtures are
// additive; no existing owner fixture may be rewritten to manufacture coverage.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
