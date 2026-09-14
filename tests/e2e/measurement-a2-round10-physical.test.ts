import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

type WorkerResult = Readonly<{
  scenario: string;
  facts: number;
  result: Array<Readonly<{ kind: string; value?: Readonly<{
    partial?: boolean;
    rows?: Array<Readonly<{ amount: number | null; state: string }>>;
    coverageDebt?: readonly string[];
    episode?: Readonly<{ state: string; recoveryCount: number }>;
  }> }>>;
}>;

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] re-derives recovery chains and event clocks after physical persistence and two fresh-process reopens', () => {
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  const worker = new URL('./measurement-a2-round10-physical-worker.ts', import.meta.url);
  const root = mkdtempSync(join(tmpdir(), 'measurement-a2-round10-'));
  for (const scenario of ['recovery-fresh', 'recovery-expired',
    'clock-same', 'clock-different'] as const) {
    const directory = join(root, scenario);
    const run = (mode: 'write' | 'read') => JSON.parse(execFileSync(viteNode,
      ['--script', worker.pathname, scenario, directory, mode], {
        cwd: process.cwd(), encoding: 'utf8',
      })) as WorkerResult;
    for (const result of [run('write'), run('read'), run('read')]) {
      expect(result.result.every(row => row.kind === 'Success'), scenario).toBe(true);
      if (scenario.startsWith('recovery')) {
        const final = result.result[2]!.value!;
        if (scenario === 'recovery-fresh') {
          expect(final.episode).toMatchObject({ state: 'closed', recoveryCount: 0 });
          expect(final.coverageDebt).toEqual([]);
        } else {
          expect(final.episode).toMatchObject({ state: 'open', recoveryCount: 2 });
          expect(final.coverageDebt).toContain(
            'prior-recovery:disk:1:evidence-no-longer-usable');
        }
      } else {
        const [first, second] = result.result.map(row => row.value!);
        if (scenario === 'clock-same') {
          expect(first!).toMatchObject({ partial: false });
          expect(first!.rows?.[0]).toMatchObject({ amount: 7, state: 'reported' });
          expect(second!.rows).toEqual([]);
        } else {
          expect(first!).toMatchObject({ partial: true });
          expect(second!).toMatchObject({ partial: true });
          expect(first!.rows?.[0]).toMatchObject({ amount: null, state: 'conflicted' });
          expect(second!.rows?.[0]).toMatchObject({ amount: null, state: 'conflicted' });
        }
      }
    }
  }
}, 90_000);
