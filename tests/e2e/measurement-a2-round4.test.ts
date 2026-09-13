import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation] P16-NF-38 [behavior:peer-completeness-clock] fresh process re-executes all 76 round-four owner-bound cases', () => {
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  const worker = new URL('./measurement-a2-round4-worker.ts', import.meta.url);
  const output = execFileSync(viteNode, ['--script', worker.pathname], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  expect(JSON.parse(output)).toEqual({ cases: 76, passed: 76, failed: [] });
}, 30_000);
