import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
const worker = new URL('./measurement-a2-round10-worker.ts', import.meta.url);
const summary = JSON.parse(execFileSync(viteNode, ['--script', worker.pathname], {
  cwd: process.cwd(), encoding: 'utf8',
})) as { cases: number; passed: number; failed: string[];
  findings: Record<string, boolean> };

for (const finding of ['F1', 'F2', 'F3'])
  it(`P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] ${finding} passes in a fresh process`, () => {
    expect(summary.findings[finding]).toBe(true);
  });

it('fresh process re-executes every imported round-ten reviewer case', () => {
  expect(summary).toMatchObject({ cases: 26, passed: 26, failed: [] });
});
