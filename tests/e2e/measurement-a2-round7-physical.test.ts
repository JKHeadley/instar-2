import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

type WorkerResult = Readonly<{
  scenario: string;
  mode: string;
  facts: number;
  result: { kind: string; value?: { partial: boolean; rows: Array<{
    amount: number | null; state: string; evidenceManifest: Array<{ id: string }>;
  }> } };
}>;

it('P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation] physical Part Two storage preserves correction, concurrent-resolution, and mixed-freshness results across fresh readers', () => {
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  const worker = new URL('./measurement-a2-round7-physical-worker.ts', import.meta.url);
  const root = mkdtempSync(join(tmpdir(), 'measurement-a2-round7-'));
  for (const scenario of ['correction', 'concurrent', 'freshness'] as const) {
    const directory = join(root, scenario);
    const run = (mode: 'write' | 'read') => JSON.parse(execFileSync(viteNode,
      ['--script', worker.pathname, scenario, directory, mode], {
        cwd: process.cwd(), encoding: 'utf8',
      })) as WorkerResult;
    const first = run('write');
    const restarted = run('read');
    const repeated = run('read');
    for (const result of [first, restarted, repeated]) {
      expect(result.result.kind, `${scenario}:${result.mode}`).toBe('Success');
      expect(result.facts).toBe(scenario === 'freshness' ? 2 : 4);
      const row = result.result.value!.rows[0]!;
      if (scenario === 'correction') {
        expect(row).toMatchObject({ amount: 109, state: 'reported' });
      } else if (scenario === 'concurrent') {
        expect(result.result.value!.partial).toBe(true);
        expect(row).toMatchObject({ amount: null, state: 'conflicted' });
        expect(row.evidenceManifest.map(evidence => evidence.id).sort()).toEqual([
          'physical:a', 'physical:b', 'physical:resolution',
          'physical:resolution:concurrent',
        ]);
      } else {
        expect(row).toMatchObject({ amount: 101, state: 'reported' });
        expect(row.evidenceManifest.map(evidence => evidence.id).sort())
          .toEqual(['physical:a', 'physical:b']);
      }
    }
  }
}, 60_000);
