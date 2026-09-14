import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type ResultValue = Readonly<{
  readonly kind: string;
  readonly value?: Readonly<{ readonly amount?: number }>;
}>;

export type Round9ReviewSummary = Readonly<{
  readonly cases: number;
  readonly passed: number;
  readonly failed: readonly string[];
  readonly findings: Readonly<Record<'F1' | 'F2' | 'F3' | 'F4', boolean>>;
}>;

function execute(source: string, output: string): unknown {
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  execFileSync(viteNode, ['--script', source, output], {
    cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(readFileSync(output, 'utf8')) as unknown;
}

export function runRound9ReviewSources(): Round9ReviewSummary {
  const directory = mkdtempSync(join(tmpdir(), 'p16-a2-round9-'));
  const source = join(process.cwd(), 'tests', 'measurement', 'a2-round9-review');
  try {
    const newCases = execute(join(source, 'new-cases.ts'),
      join(directory, 'new-cases.json')) as Array<{ name: string; pass: boolean }>;
    const aggregate = execute(join(source, 'aggregate-currency.ts'),
      join(directory, 'aggregate-currency.json')) as Readonly<{
        sameQuantityBytes: boolean;
        sameRequestBytes: boolean;
        earlier: ResultValue;
        later: ResultValue;
      }>;
    const burn = execute(join(source, 'burn-sum.ts'),
      join(directory, 'burn-sum.json')) as Array<Readonly<{
        large: boolean;
        reverse: boolean;
        pass: boolean;
        actual: ResultValue;
      }>>;
    const failed = newCases.filter(row => !row.pass).map(row => row.name);
    const aggregatePass = aggregate.sameQuantityBytes && aggregate.sameRequestBytes
      && aggregate.earlier.kind === 'Success' && aggregate.later.kind === 'Success'
      && aggregate.earlier.value?.amount === 17 && aggregate.later.value?.amount === 17;
    if (!aggregatePass) failed.push('aggregate-currency:byte-equal-current-selection');
    for (const row of burn)
      if (!row.pass || row.large && row.actual.kind !== 'Refused')
        failed.push(`burn-sum:${row.large}:${row.reverse}`);
    const cases = newCases.length + 1 + burn.length;
    const passed = (name: string) => newCases.some(row => row.name === name && row.pass);
    const findings = {
      F1: passed('omitted-event:true:retains-open-debt'),
      F2: passed('prior-recovery:true:stale-support-cannot-close'),
      F3: aggregatePass,
      F4: burn.filter(row => row.large).length === 2
        && burn.filter(row => row.large).every(row => row.pass && row.actual.kind === 'Refused'),
    };
    return { cases, passed: cases - failed.length, failed, findings };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
