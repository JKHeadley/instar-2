// Fill the slice loader's transpile cache once, before the gate runs any test.
//
// The launcher and fixture tests boot the slice's TypeScript graph in child processes, and each
// cold boot costs ~20 CPU-seconds of ts.transpileModule. A bounded test case that boots several
// children (the preview pause cases boot six) then spends its whole wall clock on transpiling
// rather than on the behaviour it asserts, which is how the SIGINT/SIGTERM/SIGHUP pause cases
// failed on a host with slower or busier cores. Warming the cache up front pays that cost once,
// outside any case's clock, so the first run of a fresh checkout behaves like every later run.
//
// This calls the loader's own load hook, so the cache key and the emitted bytes are the loader's,
// never a second copy of that logic that could drift from it.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { load } from './slice-ts-loader.mjs';

const roots = ['src', 'tests', 'register-source'];
const files = [];
const walk = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(path); }
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(path);
  }
};
for (const root of roots) { try { walk(root); } catch { /* a root this checkout does not carry */ } }

const unreachable = () => { throw Error('warm-slice-ts-cache: the loader delegated a .ts module'); };
let warmed = 0;
for (const file of files) {
  // A module the loader cannot read or transpile is left for its consumer to report; warming is an
  // optimization and must never be the thing that fails the gate.
  try { await load(pathToFileURL(file).href, { format: 'module' }, unreachable); warmed++; } catch { /* skipped */ }
}
process.stdout.write(`slice-ts transpile cache warmed: ${warmed}/${files.length} modules\n`);
