import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] fresh process re-executes every round-eight current-support regression', () => {
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  const worker = new URL('./measurement-a2-round8-worker.ts', import.meta.url);
  const output = execFileSync(viteNode, ['--script', worker.pathname], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  expect(JSON.parse(output)).toEqual({ cases: 8, passed: 8, failed: [] });
}, 30_000);
