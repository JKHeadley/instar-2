import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { auditP15ArchitectureRows, auditP15CoverageRows, p15Dispositions } from '../../scripts/check-p15-contract-map.mjs';
// @ts-expect-error The executable additivity checker intentionally ships as an ESM script without declarations.
import { checkP15InheritedScopeTest, p15AdditivityApplies, p15AdditivityBaseline } from '../../scripts/check-p15-additivity.mjs';

const result = (run: () => unknown) => {
  try { return { accepted: true, value: run() }; }
  catch (error) { return { accepted: false, detail: error instanceof Error ? error.message : String(error) }; }
};

it('P15 round-fifteen F1 every contract-map entry point refuses stale request-only deferral evidence', () => {
  const rows = p15Dispositions();
  for (const number of [6, 13, 22]) {
    const row = rows.find((candidate: { number: number }) => candidate.number === number)!;
    const stale = `NON-EXECUTABLE-UNTIL-UNGRANTED-REQUEST-design-19-scheduled-work-seam-request-${number === 13 ? 'calendar-adapter' : 'run-admission-production'}.md`;
    const staleRow = { ...row, held: stale, status: stale, reason: stale };
    const architecture = result(() => auditP15ArchitectureRows([staleRow]));
    const coverage = result(() => auditP15CoverageRows({ success: true, testResults: [] }, [staleRow]));
    expect(architecture).toMatchObject({ accepted: false });
    expect(coverage).toMatchObject({ accepted: false });
    expect(architecture.detail).toMatch(/consistent disposition/);
    expect(coverage.detail).toBe(architecture.detail);
    expect(() => auditP15ArchitectureRows([row])).not.toThrow();
    expect(() => auditP15CoverageRows({ success: true, testResults: [] }, [row])).not.toThrow();
  }
  const grantedControl = rows.find((candidate: { number: number }) => candidate.number === 4)!;
  expect(() => auditP15ArchitectureRows([grantedControl])).not.toThrow();
  expect(() => auditP15CoverageRows({ success: true, testResults: [] }, [grantedControl])).not.toThrow();
});

it('P15 round-fifteen F2 validates inherited assertions from the actual HEAD report without a baseline checkout', () => {
  const checker = readFileSync('scripts/check-p15-additivity.mjs', 'utf8');
  expect(checker).not.toMatch(/git', \['(?:clone|checkout)'/);
  const packageOnMain = execFileSync('git', ['show', 'main:package.json'], { encoding: 'utf8' });
  if (p15AdditivityApplies(p15AdditivityBaseline()))
    expect(readFileSync('package.json', 'utf8')).toBe(packageOnMain);
  expect(packageOnMain).not.toContain('--exclude tests/harness-adapters/contract-map.test.ts');

  const name = resolve('tests/harness-adapters/contract-map.test.ts');
  const passingReport = {
    success: true,
    testResults: [{ name, assertionResults: Array.from({ length: 6 }, () => ({ status: 'passed' })) }],
  };
  expect(checkP15InheritedScopeTest(passingReport)).toMatchObject({
    file: 'tests/harness-adapters/contract-map.test.ts',
    passed: 6,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  });
  expect(() => checkP15InheritedScopeTest({
    success: true,
    testResults: [{ name, assertionResults: [
      ...Array.from({ length: 5 }, () => ({ status: 'passed' })),
      { status: 'failed' },
    ] }],
  })).toThrow(/did not pass all 6 assertions on HEAD/);
});
