// One explicit-file vitest step of the gate (`npm run test:durability`), made aware of
// INSTAR_TEST_PLATFORM_SPLIT. Under a split, vitest.config.ts narrows `include` to one half, so
// a step naming only the other half's files printed "No test files found" and exited 1. This runs
// exactly the named files that belong to this half, and skips the step, saying so, when none do;
// the other half runs the rest, so across both halves every named file runs exactly once. With
// the split unset or empty it runs `vitest run <arguments>` unchanged.
// Usage: node scripts/vitest-split-step.mjs <test files...> [vitest options...]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIST_PATH, readList } from '../tests/platform/macos-only.mjs';

const SPLITS = ['exclude-macos', 'only-macos'];

/** The vitest arguments this step runs under `split`, or a skip when none of its files is in this half. */
export function planStep(args, split, macosOnly) {
  if (split === undefined) return { runs: true, argv: ['run', ...args], files: args.filter(isTestFile), otherHalf: [] };
  if (!SPLITS.includes(split)) throw new Error(`INSTAR_TEST_PLATFORM_SPLIT must be exclude-macos or only-macos, not ${JSON.stringify(split)}`);
  const firstOption = args.findIndex(arg => arg.startsWith('-'));
  const named = firstOption === -1 ? args : args.slice(0, firstOption);
  const options = firstOption === -1 ? [] : args.slice(firstOption);
  if (named.length === 0 || !named.every(isTestFile)) throw new Error('vitest-split-step: name the test files first, then any vitest options');
  const mine = file => macosOnly.includes(file) === (split === 'only-macos');
  const files = named.filter(mine), otherHalf = named.filter(file => !mine(file));
  return { runs: files.length > 0, argv: ['run', ...files, ...options], files, otherHalf };
}

function isTestFile(arg) { return arg.endsWith('.test.ts'); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const split = process.env.INSTAR_TEST_PLATFORM_SPLIT || undefined;
  const macosOnly = split === undefined ? [] : readList(readFileSync(resolve(root, LIST_PATH), 'utf8'));
  const plan = planStep(process.argv.slice(2), split, macosOnly);
  const other = SPLITS.find(value => value !== split);
  if (plan.otherHalf.length) console.log(`vitest-split-step: ${split} leaves ${plan.otherHalf.join(', ')} to the ${other} half`);
  if (!plan.runs) {
    console.log(`vitest-split-step: step skipped under INSTAR_TEST_PLATFORM_SPLIT=${split}: none of its files is in this half`);
    process.exit(0);
  }
  const run = spawnSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), ...plan.argv], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}
