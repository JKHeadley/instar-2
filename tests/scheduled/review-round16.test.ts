import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { checkP15Architecture, checkP15Coverage, p15Dispositions } from '../../scripts/check-p15-contract-map.mjs';
import { scheduledFixture } from './fixture.js';
import { recurringScheduledManifest } from './round16-proof.js';

const capture = (run: () => unknown) => {
  try { return { status: 'accepted' as const, value: run() }; }
  catch (error) { return { status: 'refused' as const, detail: error instanceof Error ? error.message : String(error) }; }
};

function completePassingReport() {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.test.ts')) files.push(path);
    }
  };
  walk('tests');
  return { success: true, testResults: files.map(file => {
    const source = readFileSync(file, 'utf8'); const titles: string[] = [];
    for (const match of source.matchAll(/\b(?:it|test)\(\s*(['"])(.*?)\1/gms)) titles.push(match[2]!);
    for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])(.*?)\2/gms)) {
      if (new RegExp(`\\b(?:it|test)\\(\\s*${match[1]}\\s*,`).test(source)) titles.push(match[3]!);
    }
    return { name: resolve(file), assertionResults: [...new Set(titles)].map(title => ({ title, status: 'passed' })) };
  }) };
}

it('P15 round-sixteen F1 refuses all 12 identifier/status mismatch probes and the 52-row donor substitution', () => {
  const rows = p15Dispositions();
  const ordinary = rows.find((row: { number: number }) => row.number === 4)!;
  const cases = [
    ['consistent-control', ordinary, 'accepted'],
    ['NF06-id-with-NF04-number-and-grant', { ...ordinary, id: 'P15-NF-06' }, 'refused'],
    ['NF13-id-with-NF04-number-and-grant', { ...ordinary, id: 'P15-NF-13' }, 'refused'],
    ['NF22-id-with-NF04-number-and-grant', { ...ordinary, id: 'P15-NF-22' }, 'refused'],
    ['held-boolean-but-EXECUTABLE-status', { ...ordinary, status: 'EXECUTABLE' }, 'refused'],
    ['unknown-check-id', { ...ordinary, id: 'P15-NF-99' }, 'refused'],
  ] as const;
  for (const [id, row, expected] of cases) for (const [entry, run] of [
    ['architecture', () => checkP15Architecture([row])],
    ['coverage', () => checkP15Coverage({ success: true, testResults: [] }, [row])],
  ] as const) expect(capture(run), `${id}/${entry}`).toMatchObject({ status: expected });

  const donor = rows.find((row: { number: number }) => row.number === 4)!;
  const substituted = rows.map((row: { number: number; id: string }) => [6, 13, 22].includes(row.number)
    ? { ...donor, id: row.id } : row);
  expect(new Set(substituted.map((row: { id: string }) => row.id)).size).toBe(52);
  expect(() => checkP15Architecture(substituted)).toThrow(/check identity/);
  expect(() => checkP15Coverage(completePassingReport(), substituted)).toThrow(/check identity/);
  expect(() => checkP15Architecture(rows)).not.toThrow();
  expect(() => checkP15Coverage(completePassingReport(), rows)).not.toThrow();
});

it('P15 round-sixteen F2 resolves only the exact row-83 and row-84 granted dependency names', () => {
  const rows = p15Dispositions();
  for (const number of [6, 22]) expect(rows.find((row: { number: number }) => row.number === number)?.held)
    .toBe('NON-EXECUTABLE-UNTIL-row-83-run-admission-production');
  expect(rows.find((row: { number: number }) => row.number === 13)?.held)
    .toBe('NON-EXECUTABLE-UNTIL-row-84-calendar-adapter');
  for (const number of [7, 9, 13, 14, 19, 20, 24, 25, 26, 27, 28, 52]) {
    expect(rows.find((row: { number: number }) => row.number === number)?.held)
      .toContain('NON-EXECUTABLE-UNTIL-row-84-calendar-adapter');
  }
  expect(rows.some((row: { held?: string }) => row.held?.includes('UNGRANTED-REQUEST'))).toBe(false);
  const nf13 = rows.find((row: { number: number }) => row.number === 13)!;
  const misspelled = 'NON-EXECUTABLE-UNTIL-row-84-calendar-expansion-adapter';
  expect(() => checkP15Architecture([{ ...nf13, held: misspelled, status: misspelled, reason: misspelled }]))
    .toThrow(/consistent disposition/);
  expect(() => checkP15Architecture(rows)).not.toThrow();
});

it('P15-NF-09 round-sixteen F3 manifest decode refuses Mars/Olympus_Mons and accepts America/New_York', () => {
  const fixture = scheduledFixture(); const port = createScheduledWorkPackagePort();
  const status = (timeZone: string) => consumeResult(port.decode(recurringScheduledManifest(timeZone), fixture.context), {
    Success: () => 'accepted' as const, Refused: () => 'refused' as const,
  });
  expect(status('Mars/Olympus_Mons')).toBe('refused');
  expect(status('America/New_York')).toBe('accepted');
});
