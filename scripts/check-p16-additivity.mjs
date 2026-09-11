// Compare every pre-Part-Sixteen fixture owned by public dependencies against main.
// New P16 fixtures are additive; an existing P1/P2/P9/P10 fixture must stay byte-identical.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const roots = ['tests/types', 'tests/facts', 'tests/verification', 'tests/assembly'];
const listed = execFileSync('git', ['ls-tree', '-r', '--name-only', 'main', '--', ...roots], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const changed = [];
for (const file of listed) {
  const base = execFileSync('git', ['show', `main:${file}`]);
  let current;
  try { current = readFileSync(file); } catch { changed.push(file); continue; }
  if (!base.equals(current)) changed.push(file);
}
if (changed.length) throw new Error(`P16 additivity changed legacy dependency fixtures: ${changed.join(', ')}`);
console.log(`P16 additivity: ${listed.length} legacy P1/P2/P9/P10 fixture files are byte-identical to main.`);
