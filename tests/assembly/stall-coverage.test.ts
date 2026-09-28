import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { admitStallCoverage, createNativeHarnessAdapter, HARNESS_STALL_CLASSES, stallCoverageGaps,
  unresolvedStallCases } from '../../src/assembly/index.js';
import type { HarnessStallCoverage } from '../../src/assembly/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { stallCoverageFixture } from './stall-coverage-fixture.js';
import { admitPreviewHarness, PREVIEW_JOURNAL_STALL_COVERAGE, SELF_HOST_STALL_COVERAGE } from '../preview/stall-coverage.js';

const read = (file: string) => { try { return readFileSync(file, 'utf8'); } catch { return null; } };

it('P10-NF-15 refuses onboarding with one stall class missing and admits the complete neighbor (Rule 59)', () => {
  const f = factsFixture(); const complete = stallCoverageFixture('native');
  expect(value(admitStallCoverage(complete, f.c)).rows).toHaveLength(HARNESS_STALL_CLASSES.length);
  const missing = { ...complete, rows: complete.rows.filter(row => row.stall !== 'alive-without-progress') };
  refused(admitStallCoverage(missing, f.c), 'alive-without-progress: not enumerated');
  refused(admitStallCoverage({ ...complete, rows: [...complete.rows, complete.rows[0]!] }, f.c), 'declared twice');
  refused(admitStallCoverage({ ...complete, rows: complete.rows.map((row, index) => index ? row : { ...row, detection: '' }) }, f.c), 'no detection evidence');
  refused(admitStallCoverage({ ...complete, rows: complete.rows.map((row, index) => index ? row : { ...row, failing: row.positive }) }, f.c), 'same case');
  refused(admitStallCoverage({ ...complete, rows: complete.rows.map((row, index) => index ? row
    : { ...row, positive: { file: '../outside.test.ts', title: row.positive.title } }) }, f.c), 'no captured positive case');
  expect(stallCoverageGaps(undefined)).toEqual(['stall coverage declaration missing']);
});

it('P10-NF-16 an adapter constructor refuses a harness whose silent-stop table is incomplete', () => {
  const f = factsFixture();
  const input = { id: 'native', artifact: assemblyInput('HarnessLaunchSpec').artifactDigest, platform: 'darwin-arm64', conformance: 'conformance:1',
    context: f.c, clock: () => 20, generation: () => 'generation:fixture',
    driver: { owner: 'part-eight' as const, launch: () => f.success('pid:1'), deliver: () => f.success('accepted'),
      observe: () => f.success({ phase: 'launched' as const, evidence: 'pid:1', detail: 'fixture' }) } };
  expect(() => createNativeHarnessAdapter({ ...input, stallCoverage: { ...stallCoverageFixture('native'), rows: [] } }))
    .toThrow('harness stall coverage incomplete');
  expect(() => createNativeHarnessAdapter({ ...input, stallCoverage: stallCoverageFixture('another-harness') })).toThrow('another harness');
  expect(createNativeHarnessAdapter({ ...input, stallCoverage: stallCoverageFixture('native') }).id).toBe('native');
});

it('the live runner declares all nine silent-stop classes and every captured case resolves to a shipped test', () => {
  expect(stallCoverageGaps(PREVIEW_JOURNAL_STALL_COVERAGE)).toEqual([]);
  expect(unresolvedStallCases(PREVIEW_JOURNAL_STALL_COVERAGE, read)).toEqual([]);
  const renamed: HarnessStallCoverage = { ...PREVIEW_JOURNAL_STALL_COVERAGE, rows: PREVIEW_JOURNAL_STALL_COVERAGE.rows.map((row, index) => index
    ? row : { ...row, positive: { ...row.positive, title: 'a case that was deleted from the suite' } }) };
  expect(unresolvedStallCases(renamed, read)).toEqual([
    'launch-rejected-or-answer-lost: positive case "a case that was deleted from the suite" not found in tests/preview/journal-obligations.test.ts']);
  // The runner's launch admission refuses when a captured case can no longer be read, and passes the shipped tree.
  expect(() => admitPreviewHarness(file => file.endsWith('journal-handoff.test.ts') ? null : read(file)))
    .toThrow('worker-exit-or-process-reuse: positive case');
  expect(() => admitPreviewHarness(read)).not.toThrow();
});

it('the self-hosting harness declares all nine silent-stop classes and every captured case resolves to a shipped test', () => {
  expect(stallCoverageGaps(SELF_HOST_STALL_COVERAGE)).toEqual([]);
  expect(unresolvedStallCases(SELF_HOST_STALL_COVERAGE, read)).toEqual([]);
  expect(() => admitPreviewHarness(read, SELF_HOST_STALL_COVERAGE)).not.toThrow();
});
