import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

// Additive row-127 lifecycle evidence: the exclusive `validUntil` precondition executed end to end
// over the production assembly composition and the real physical file adapter, across two fresh
// worker processes (attempt then durable re-read). A bound below the commit clock accepts; a bound
// equal to the commit clock refuses and persists nothing; an omitted bound keeps legacy behavior.

const worker = './tests/e2e/assembly-conditional-append-validuntil-worker.ts';
const args = ['--loader', './scripts/slice-ts-loader.mjs', worker];

function lastJson(stdout: string): { kind?: string; detail?: string; rows?: readonly unknown[] } {
  const line = stdout.trim().split('\n').filter(row => row.startsWith('{')).at(-1);
  if (!line) throw new Error(`worker produced no JSON: ${stdout}`);
  return JSON.parse(line) as { kind?: string; detail?: string; rows?: readonly unknown[] };
}

function runWorker(directory: string, mode: 'attempt' | 'read', options: Readonly<Record<string, unknown>> = {}) {
  const child = spawnSync(process.execPath, [...args, mode, directory, JSON.stringify(options)], { encoding: 'utf8', timeout: 30_000 });
  expect(child.status, child.stderr).toBe(0);
  return lastJson(child.stdout);
}

it.each([
  ['below-bound', 149, 149, 150, 'Success', 1],
  ['at-bound', 149, 150, 150, 'Refused', 0],
  ['no-bound-legacy', 149, 150, undefined, 'Success', 1],
] as const)(
  'P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] lifecycle %s',
  (_caseId, startClock, appendClock, validUntil, expectedKind, expectedRows) => {
    const directory = mkdtempSync(join(tmpdir(), `p10-conditional-validity-lifecycle-${_caseId}-`));
    const result = runWorker(directory, 'attempt', {
      startClock, appendClock, ...(validUntil === undefined ? {} : { validUntil }),
    });
    expect(result.kind).toBe(expectedKind);
    expect(result.rows).toHaveLength(expectedRows);
    if (expectedKind === 'Refused') {
      expect(result.detail).toBe('evidence-expired: validUntil=150; commitClock=150');
    }
    expect(runWorker(directory, 'read').rows).toHaveLength(expectedRows);
  },
  30_000,
);
