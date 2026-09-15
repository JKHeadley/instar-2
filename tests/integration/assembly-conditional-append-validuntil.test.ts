import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

// Additive row-127 integration evidence: the exclusive `validUntil` precondition executed over the
// real physical file adapter in a fresh worker process, with the commit clock advanced at append
// time. A bound below the commit clock accepts; a bound equal to the commit clock refuses and
// leaves nothing durable; an omitted bound keeps the legacy no-expiry append.

const worker = './tests/integration/assembly-conditional-append-validuntil-worker.ts';
const args = ['--loader', './scripts/slice-ts-loader.mjs', worker];

function lastJson(stdout: string): Record<string, unknown> {
  const line = stdout.trim().split('\n').filter(row => row.startsWith('{')).at(-1);
  if (!line) throw new Error(`worker produced no JSON: ${stdout}`);
  return JSON.parse(line) as Record<string, unknown>;
}

function runCase(directory: string, options: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  const child = spawnSync(process.execPath, [...args, 'case', directory, JSON.stringify(options)], { encoding: 'utf8', timeout: 30_000 });
  expect(child.status, child.stderr).toBe(0);
  return lastJson(child.stdout);
}

it.each([
  ['below-bound', 149, 149, 150, 'Success', 1],
  ['at-bound', 149, 150, 150, 'Refused', 0],
  ['no-bound-legacy', 149, 150, undefined, 'Success', 1],
] as const)(
  'P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] integration %s',
  (_caseId, startClock, appendClock, validUntil, expectedKind, expectedRows) => {
    const result = runCase(mkdtempSync(join(tmpdir(), `p10-conditional-validity-integration-${_caseId}-`)), {
      startClock, appendClock, ...(validUntil === undefined ? {} : { validUntil }),
    });
    expect(result.kind).toBe(expectedKind);
    expect(result.rows).toHaveLength(expectedRows);
    if (expectedKind === 'Refused') {
      expect(result).toMatchObject({ reason: 'decode', detail: 'evidence-expired: validUntil=150; commitClock=150' });
    }
  },
  30_000,
);
