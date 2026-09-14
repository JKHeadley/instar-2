import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type ReviewRow = Readonly<{
  name: string;
  pass: boolean;
  actual?: Readonly<{ kind?: string; value?: Readonly<{
    episode?: Readonly<{ state?: string; recoveryCount?: number }>;
    coverageDebt?: readonly string[];
    state?: string;
    partial?: boolean;
  }> }>;
}>;

export type Round10ReviewSummary = Readonly<{
  cases: number;
  passed: number;
  failed: readonly string[];
  findings: Readonly<Record<'F1' | 'F2' | 'F3', boolean>>;
}>;

function execute(source: string, output: string): ReviewRow[] {
  const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
  execFileSync(viteNode, ['--script', source, output], {
    cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(readFileSync(output, 'utf8')) as ReviewRow[];
}

export function runRound10ReviewSources(): Round10ReviewSummary {
  const directory = mkdtempSync(join(tmpdir(), 'p16-a2-round10-'));
  const source = join(process.cwd(), 'tests', 'measurement', 'a2-round10-review');
  try {
    const rows = ['adversarial', 'recovery-controls', 'median'].flatMap(name =>
      execute(join(source, `${name}.ts`), join(directory, `${name}.json`)));
    const failed = rows.filter(row => !row.pass).map(row => row.name);
    const passed = (name: string) => rows.some(row => row.name === name && row.pass);
    const staleFirst = rows.find(row => row.name === 'three-vote:expired-index-1');
    const staleDebt = staleFirst?.actual?.value?.coverageDebt ?? [];
    const findings = {
      F1: passed('recovery-three:true:vote-3')
        && staleFirst?.actual?.value?.episode?.state === 'open'
        && staleFirst.actual.value.episode.recoveryCount === 2
        && staleDebt.includes('prior-recovery:control:1:evidence-no-longer-usable')
        && passed('three-vote:expired-index--1')
        && passed('three-vote:expired-index-2'),
      F2: passed('event-clock:true:resolve')
        && passed('event-clock:true:read-first-window')
        && passed('event-clock:false:resolve')
        && passed('event-clock:false:read-first-window'),
      F3: passed('median:large-true:reverse-false')
        && passed('median:large-true:reverse-true')
        && passed('median:large-false:reverse-false')
        && passed('median:large-false:reverse-true'),
    };
    return { cases: rows.length, passed: rows.length - failed.length, failed, findings };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
