// On Part Sixteen's first landing, compare inherited test files against current main.
// Later changes are governed by the standing owner and contract checks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { firstLanding } from './first-landing.mjs';

const scope = firstLanding(process.cwd(), ['src/measurement/index.ts']);
if (!scope.applicable) {
  console.log(`P16 first-landing additivity inapplicable: measurement unit already present on current-main baseline ${scope.mainTip}.`);
  process.exit(0);
}

const roots = ['tests'];
const listed = execFileSync('git', ['ls-tree', '-r', '--name-only', scope.mainTip, '--', ...roots], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const changed = [];
for (const file of listed) {
  const base = execFileSync('git', ['show', `${scope.mainTip}:${file}`]);
  let current;
  try { current = readFileSync(file); } catch { changed.push(file); continue; }
  if (!base.equals(current)) changed.push(file);
}
if (changed.length) throw new Error(`P16 first-landing additivity changed pre-existing test files: ${changed.join(', ')}`);
console.log(`P16 first-landing additivity: ${listed.length} pre-existing test files are byte-identical to current main.`);
