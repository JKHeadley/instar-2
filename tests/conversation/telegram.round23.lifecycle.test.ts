import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

interface AdmissionResult {
  readonly mode: 'long-poll' | 'webhook';
  readonly kind: 'Success' | 'Refused';
  readonly detail: string;
  readonly rows: readonly Readonly<{ mode: string; disposition: string; taint: readonly unknown[]; conflicts: readonly unknown[] }>[];
}

interface AdmissionCase {
  readonly concurrent: boolean;
  readonly expectedSuccesses: number;
  readonly actualSuccesses: number;
  readonly results: readonly AdmissionResult[];
  readonly restartResults?: readonly AdmissionResult[];
}

function run(script: string): Readonly<{ status: string; cases: readonly AdmissionCase[] }> {
  const result = spawnSync('python3', [`tests/conversation/held/${script}`], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout) as Readonly<{ status: string; cases: readonly AdmissionCase[] }>;
}

function expectOneDurableWinner(row: AdmissionCase): void {
  expect(row.actualSuccesses).toBe(row.expectedSuccesses);
  expect(row.actualSuccesses).toBe(1);
  const winner = row.results.find(result => result.kind === 'Success')!;
  const loser = row.results.find(result => result.kind === 'Refused')!;
  expect(winner.rows).toHaveLength(1);
  expect(loser.rows).toHaveLength(1);
  expect(winner.rows[0]).toMatchObject({ mode: winner.mode, disposition: 'passed', taint: [], conflicts: [] });
  expect(loser.rows[0]).toMatchObject({ mode: winner.mode, disposition: 'passed', taint: [], conflicts: [] });
  if (row.concurrent) expect(loser.detail).toContain('conditional append subject frontier changed; current=');
}

it('P12-NF-16 P12-NF-18 P12-NF-46 round23 executes both competing-process orders through appendIfSubjectFrontier', () => {
  const report = run('run-admission-matrix.py');
  expect(report.status).toBe('EXECUTABLE-row-99-ten-conditional-append');
  expect(report.cases).toHaveLength(4);
  for (const row of report.cases) expectOneDurableWinner(row);
}, 30_000);

it('P12-NF-16 P12-NF-18 P12-NF-46 round23 keeps the admitted winner usable after fresh-process restart', () => {
  const report = run('admission-restart-matrix.py');
  expect(report.status).toBe('EXECUTABLE-row-99-ten-conditional-append');
  expect(report.cases).toHaveLength(4);
  for (const row of report.cases) {
    expectOneDurableWinner(row);
    const winner = row.results.find(result => result.kind === 'Success')!;
    const loser = row.results.find(result => result.kind === 'Refused')!;
    const restarted = new Map(row.restartResults!.map(result => [result.mode, result]));
    expect(restarted.get(winner.mode)?.kind).toBe('Success');
    expect(restarted.get(loser.mode)?.kind).toBe('Refused');
    for (const result of restarted.values()) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({ mode: winner.mode, disposition: 'passed', taint: [], conflicts: [] });
    }
  }
}, 30_000);
