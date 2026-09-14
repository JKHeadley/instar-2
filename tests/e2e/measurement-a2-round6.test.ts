import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] P16-NF-36 [behavior:deterministic-historical-presentation] P16-NF-39 [behavior:all-identities-retention] P16-NF-41 [behavior:bounded-cache-eviction] P16-NF-50 [behavior:historical-restart-rebuild] fresh process re-executes every round-six A2a reviewer regression while P16-NF-37 [behavior:peer-union-window] P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge remains held', () => {
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  const worker = new URL('./measurement-a2-round6-worker.ts', import.meta.url);
  const output = execFileSync(viteNode, ['--script', worker.pathname], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  expect(JSON.parse(output)).toEqual({ cases: 18, passed: 18, failed: [], held: 4 });
}, 30_000);
