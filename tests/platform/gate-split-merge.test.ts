// A full test run split between a Linux host (INSTAR_TEST_PLATFORM_SPLIT=exclude-macos) and a Mac
// (only-macos) must still pass the gate's whole-suite checks. On a half each one asks a question the
// half cannot answer — `gate.log` of the real only-macos run at 59c66a48 ends `missing actual test
// for NF-01` — so under a split the gate hands them off and `npm run test:split-checks` merges the two
// halves' reports and runs them once over the whole suite.
//
// Every report here is bytes a real vitest run wrote, including a real Mac half; see
// tests/platform/fixtures/README.md for where each came from.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPORT_CHECKS, halfProvenance, planReportChecks, runCommands } from '../../scripts/gate-report-checks.mjs';
import { LOCAL_HALF_REPORT, halfSidecar, localHalfReport, mergeHalfReports, reportDigest } from '../../scripts/split-report.mjs';

interface Report {
  success: boolean; startTime: number; numTotalTests: number; numPassedTests: number;
  numTotalTestSuites: number; testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
  instarSplit?: { local: string; halves: { split: string; root: string; files: string[]; reportDigest: string }[] };
  [key: string]: unknown;
}
const fixture = (name: string): Report => JSON.parse(readFileSync(`tests/platform/fixtures/split-merge-${name}.json`, 'utf8'));
/** The capturing checkout's root, taken from the report itself — these are real absolute paths. */
const rootOf = (report: Report): string => (report.testResults[0]?.name ?? '').replace(/\/tests\/.*$/, '');
const relativeFiles = (report: Report): string[] =>
  report.testResults.map(file => file.name.slice(rootOf(report).length + 1)).sort();
/** What the whole-suite checks actually read: which identities ran in which file, and how they ended. */
const identities = (report: Report, root: string): string[] => report.testResults
  .flatMap(file => file.assertionResults.map(test => `${file.name.slice(root.length + 1)} :: ${test.fullName} :: ${test.status}`)).sort();

const REVISION = 'a'.repeat(40);
const half = (report: Report, split: string, root = rootOf(report)) =>
  ({ report, provenance: halfProvenance(split, root, REVISION, report) });

describe('a split run merges back into whole-suite evidence', () => {
  it('merges two real half reports into exactly the real unsplit report for the same files', () => {
    const [a, b, unsplit] = [fixture('half-a'), fixture('half-b'), fixture('unsplit')];
    const root = rootOf(unsplit);
    const { report: merged, localSplit } = mergeHalfReports(
      [half(a, 'only-macos', root), half(b, 'exclude-macos', root)],
      { root, revision: REVISION, expectedFiles: relativeFiles(unsplit) });

    // The identities the checks read are the unsplit run's, exactly.
    expect(identities(merged as Report, root)).toEqual(identities(unsplit, root));
    expect(relativeFiles(merged as Report)).toEqual(relativeFiles(unsplit));
    expect(merged.success).toBe(unsplit.success);
    for (const key of ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests',
      'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites'])
      expect([key, merged[key]]).toEqual([key, unsplit[key]]);
    expect(merged.snapshot).toEqual(unsplit.snapshot);
    // The one field a merge cannot inherit: two processes have two start times, so the earliest stands.
    expect(merged.startTime).toBe(Math.min(a.startTime, b.startTime));
    // Both fixture halves were captured in one checkout, so both match this root; the merge picks
    // deterministically in split order, and exclude-macos — the half that carries the per-process
    // grounding and boot artifacts in a real split — wins.
    expect(localSplit).toBe('exclude-macos');
    expect(merged.instarSplit).toEqual({ local: 'exclude-macos', halves: [
      { split: 'exclude-macos', root, revision: REVISION, reportDigest: reportDigest(b), reportStart: b.startTime,
        files: ['tests/platform/gate-split.test.ts'] },
      { split: 'only-macos', root, revision: REVISION, reportDigest: reportDigest(a), reportStart: a.startTime,
        files: ['tests/platform/macos-only.test.ts'] },
    ] });
  });

  it('merges a real Mac only-macos half with a local half, rebasing its files to this checkout', () => {
    const mac = fixture('mac-only-macos'), local = fixture('half-b');
    const root = rootOf(local), macRoot = rootOf(mac);
    expect(macRoot).not.toBe(root); // the real cross-machine case: two different checkouts
    const expectedFiles = [...relativeFiles(mac), ...relativeFiles(local)].sort();
    const { report: merged, localSplit } = mergeHalfReports(
      [half(mac, 'only-macos'), half(local, 'exclude-macos')], { root, revision: REVISION, expectedFiles });

    expect(localSplit).toBe('exclude-macos');
    expect(relativeFiles(merged as Report)).toEqual(expectedFiles);
    expect((merged as Report).testResults.every(file => file.name.startsWith(`${root}/`))).toBe(true);
    expect(merged.numTotalTests).toBe(mac.numTotalTests + local.numTotalTests);
    expect(merged.numPassedTests).toBe(mac.numPassedTests + local.numPassedTests);
    expect(merged.success).toBe(true);
    expect(merged.startTime).toBe(mac.startTime);
    expect(merged.instarSplit?.halves.map((h: { split: string; root: string }) => [h.split, h.root])).toEqual([['exclude-macos', root], ['only-macos', macRoot]]);
  });

  it('a failing half makes the merge fail: success is both halves, never the local one', () => {
    const a = fixture('half-a'), b = { ...fixture('half-b'), success: false, numFailedTests: 1 } as Report;
    const root = rootOf(a);
    const { report: merged } = mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)],
      { root, revision: REVISION, expectedFiles: relativeFiles(fixture('unsplit')) });
    expect(merged.success).toBe(false);
    expect(merged.numFailedTests).toBe(1);
  });
});

describe('the merge refuses rather than certify a partial or mismatched suite', () => {
  const unsplit = fixture('unsplit'), root = rootOf(unsplit);
  const context = { root, revision: REVISION, expectedFiles: relativeFiles(unsplit) };

  it('refuses overlapping halves', () => {
    const a = fixture('half-a');
    expect(() => mergeHalfReports([half(a, 'only-macos', root), half(fixture('half-a'), 'exclude-macos', root)], context))
      .toThrow(/both halves ran tests\/platform\/macos-only\.test\.ts/);
  });

  it('refuses halves that are not this checkout\'s commit', () => {
    const [a, b] = [fixture('half-a'), fixture('half-b')];
    const other = { ...half(b, 'exclude-macos', root) };
    other.provenance = { ...other.provenance, revision: 'b'.repeat(40) };
    expect(() => mergeHalfReports([half(a, 'only-macos', root), other], context))
      .toThrow(/halves are from different commits: the exclude-macos half ran bbbb/);
    expect(() => mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)],
      { ...context, revision: 'c'.repeat(40) })).toThrow(/halves are from different commits/);
  });

  it('refuses when a file the unsplit gate would run is in neither half', () => {
    const [a, b] = [fixture('half-a'), fixture('half-b')];
    expect(() => mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)],
      { ...context, expectedFiles: [...context.expectedFiles, 'tests/platform/absent.test.ts'] }))
      .toThrow(/neither half ran tests\/platform\/absent\.test\.ts: the merge is not the whole suite/);
  });

  it('refuses a sidecar that does not belong to the report beside it, an unlabelled half, the same half twice, a re-merge, and a foreign checkout', () => {
    const [a, b] = [fixture('half-a'), fixture('half-b')];
    const detached = half(b, 'exclude-macos', root);
    detached.provenance = { ...detached.provenance, reportDigest: reportDigest(a) };
    expect(() => mergeHalfReports([half(a, 'only-macos', root), detached], context))
      .toThrow(/the exclude-macos sidecar does not belong to the report it was given with/);
    expect(() => mergeHalfReports([half(a, 'linux', root), half(b, 'exclude-macos', root)], context))
      .toThrow(/a half must be exclude-macos or only-macos, not "linux"/);
    expect(() => mergeHalfReports([half(a, 'only-macos', root), half(b, 'only-macos', root)], context))
      .toThrow(/both inputs are the only-macos half/);
    const { report: merged } = mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)], context);
    expect(() => mergeHalfReports([half(merged as Report, 'only-macos', root), half(b, 'exclude-macos', root)], context))
      .toThrow(/already a merged report, not a half/);
    expect(() => mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)],
      { ...context, root: '/tmp/somewhere-else' })).toThrow(/neither half ran in this checkout/);
    expect(() => mergeHalfReports([half(a, 'only-macos', '/tmp/not-its-root'), half(b, 'exclude-macos', root)], context))
      .toThrow(/only-macos half ran .* outside its checkout \/tmp\/not-its-root/);
    expect(() => mergeHalfReports([half(a, 'only-macos', root)], context)).toThrow(/needs exactly two halves, not 1/);
  });

  it('refuses a report field it was never taught to combine, rather than dropping it', () => {
    const [a, b] = [{ ...fixture('half-a'), coverage: { lines: 1 } } as Report, fixture('half-b')];
    expect(() => mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)], context))
      .toThrow(/unknown report field "coverage"/);
    const c = { ...fixture('half-a'), snapshot: { ...(fixture('half-a').snapshot as object), note: 'x' } } as Report;
    expect(() => mergeHalfReports([half(c, 'only-macos', root), half(b, 'exclude-macos', root)], context))
      .toThrow(/unknown snapshot field "note"/);
  });
});

describe('the single-process arms keep reading the local half', () => {
  it('hands an unmerged report straight back with no other half, so an unsplit gate is unchanged', () => {
    const unsplit = fixture('unsplit');
    const read = (): string => { throw new Error('an unsplit gate must not read the local-half file'); };
    expect(localHalfReport(unsplit, rootOf(unsplit), read)).toEqual({ report: unsplit, otherHalfFiles: [] });
  });

  it('hands back the local half itself plus the other half\'s files rooted here', () => {
    const [a, b] = [fixture('half-a'), fixture('half-b')];
    const root = rootOf(a);
    const { report: merged } = mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)],
      { root, revision: REVISION, expectedFiles: relativeFiles(fixture('unsplit')) });
    const got = localHalfReport(merged as Report, root, (path: string) => {
      expect(path).toBe(LOCAL_HALF_REPORT);
      return JSON.stringify(b);
    });
    expect(got.report).toEqual(b);
    expect(got.otherHalfFiles).toEqual([`${root}/tests/platform/macos-only.test.ts`]);
  });

  it('refuses a local-half file that is not the half the merge was built from', () => {
    const [a, b] = [fixture('half-a'), fixture('half-b')];
    const root = rootOf(a);
    const { report: merged } = mergeHalfReports([half(a, 'only-macos', root), half(b, 'exclude-macos', root)],
      { root, revision: REVISION, expectedFiles: relativeFiles(fixture('unsplit')) });
    expect(() => localHalfReport(merged as Report, root, () => JSON.stringify(a)))
      .toThrow(/is not the exclude-macos half this merge was built from/);
  });
});

describe('the gate step', () => {
  // The whole gate as it runs today, with the report-reading step expanded. An unset split must
  // leave this byte-for-byte: the same commands in the same order, and nothing else printed.
  const UNSPLIT_GATE = [
    ['tsc', '--noEmit'],
    ['tsc', '-p', 'tsconfig.build.json'],
    ['node', 'scripts/run-kill-schedule.mjs'],
    ['node', 'scripts/warm-slice-ts-cache.mjs'],
    ['vitest', 'run', '--reporter=default', '--reporter=json', '--outputFile=.test-results.json'],
    ['node', 'scripts/vitest-split-step.mjs', 'tests/assembly/production-boot-storage.test.ts',
      'tests/assembly/production-boot-storage-crash.test.ts', 'tests/assembly/telegram-bot-api-round6.test.ts',
      'tests/e2e/session-restart-delivery.test.ts', 'tests/unit/test-tmp-redirect.test.ts'],
    ['node', 'scripts/vitest-split-step.mjs', 'tests/assembly/fixed-installation-live.test.ts', '-t',
      'native journal-sync flushes|native durable journal releases once'],
    ['node', 'scripts/check-change-review.mjs', 'check'],
    ['node', 'scripts/check-architecture.mjs'],
    ['node', 'scripts/check-register-wiring.mjs'],
    ['node', 'scripts/check-contract-map.mjs'],
    ['node', 'scripts/check-p2-contract-map.mjs'],
    ['node', 'scripts/check-register-contract-map.mjs'],
    ['node', 'scripts/check-p4-contract-map.mjs'],
    ['node', 'scripts/check-transport-contracts.mjs'],
    ['node', 'scripts/check-effect-contracts.mjs'],
    ['node', 'scripts/check-p5-contract-map.mjs'],
    ['node', 'scripts/check-judgment-contracts.mjs'],
    ['node', 'scripts/check-verification-contracts.mjs'],
    ['node', 'scripts/check-assembly-contracts.mjs'],
    ['node', 'scripts/check-p11-contract-map.mjs'],
    ['node', 'scripts/build-register.mjs', '--check'],
  ];
  const scripts: Record<string, string> = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  const words = (command: string): string[] =>
    [...command.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '');
  const commands = (name: string): string[][] => (scripts[name] ?? '').split('&&').flatMap(part => {
    const argv = words(part.trim());
    while (/^[A-Z_]+=/.test(argv[0] ?? '')) argv.shift();
    return argv[0] === 'npm' && argv[1] === 'run' ? commands(argv[2] ?? '') : [argv];
  });

  it('with the split unset, the gate runs exactly the commands it ran before, in order', () => {
    const expanded = commands('test:gate').flatMap(argv =>
      argv[1] === 'scripts/gate-report-checks.mjs' ? planReportChecks(undefined).commands : [argv]);
    expect(expanded).toEqual(UNSPLIT_GATE);
    expect(planReportChecks(undefined)).toEqual({ runs: true, handOff: null,
      commands: REPORT_CHECKS.map((name: string) => ['node', `scripts/${name}`]) });
  });

  it('under either split it runs none of them and says where they run instead', () => {
    for (const split of ['exclude-macos', 'only-macos']) {
      const plan = planReportChecks(split);
      expect(plan.runs).toBe(false);
      expect(plan.commands).toEqual([]);
      expect(plan.handOff).toMatch(/npm run test:split-checks -- <half-a\.json> <half-b\.json>/);
      expect(plan.handOff).toContain(`this ${split} half holds half the suite`);
    }
    expect(() => planReportChecks('linux')).toThrow(/must be exclude-macos or only-macos, not "linux"/);
  });

  it('runs the checks in order and stops at the first failure, which becomes its exit status', () => {
    const seen: string[] = [];
    const run = (file: string, args: string[]): { status: number } => {
      seen.push(`${file} ${args.join(' ')}`);
      return { status: args[0] === 'scripts/check-p4-contract-map.mjs' ? 3 : 0 };
    };
    expect(runCommands(planReportChecks(undefined).commands, run)).toBe(3);
    expect(seen).toEqual(REPORT_CHECKS.slice(0, 4).map((name: string) => `node scripts/${name}`));
    expect(runCommands([], run)).toBe(0);
  });

  it('is the only gate step that reads the whole run\'s report', () => {
    const readers = commands('test:gate')
      .filter(argv => argv[0] === 'node' && /^scripts\/.+\.mjs$/.test(argv[1] ?? '')
        && readFileSync(argv[1] ?? '', 'utf8').includes('.test-results.json'))
      .map(argv => argv.slice(1).join(' '));
    // check-change-review reads the report only inside its own `run` driver, which spawns the gate;
    // its `check` step here does not. Every other reader must go through the one hand-off step.
    expect(readers).toEqual(['scripts/check-change-review.mjs check', 'scripts/gate-report-checks.mjs']);
  });

  it('the half provenance binds a half to its report, its checkout and its commit', () => {
    const a = fixture('half-a');
    expect(halfProvenance('only-macos', '/checkout', REVISION, a))
      .toEqual({ split: 'only-macos', root: '/checkout', revision: REVISION, reportDigest: reportDigest(a), reportStart: a.startTime });
    expect(halfSidecar('.test-results.json')).toBe('.test-results.half.json');
    expect(halfSidecar('/lane/only-macos/test-results.json')).toBe('/lane/only-macos/test-results.half.json');
  });
});

// `npm run test:all` records its gate run in the evidence ledger as scope 'full'. The command is
// fixed but the environment is not: under a split, `npm run test:gate` runs half the suite, and now
// that the whole-suite checks hand off to the merge, that half exits 0. So the full-gate driver must
// refuse under a split rather than record half a suite as a complete, successful full gate.
describe('the full-gate driver refuses a split run', () => {
  const CHECKER = resolve('scripts/check-change-review.mjs');
  const base: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  delete base.INSTAR_TEST_PLATFORM_SPLIT;

  /**
   * `check-change-review.mjs run` with its ledger pointed at a throwaway file and an `npm` ahead of
   * the real one that exits 1. The shim matters in both directions: it keeps the test from launching
   * the hours-long real gate, and it means a refusal that stopped working would be visible here as a
   * recorded run rather than as a test that never finishes.
   */
  function runDriver(split: string | undefined): { status: number | null; stderr: string; entries: { kind: string; scope: string; complete?: boolean }[] } {
    const dir = mkdtempSync(join(tmpdir(), 'split-gate-'));
    try {
      const ledger = join(dir, 'evidence.jsonl');
      writeFileSync(join(dir, 'npm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
      const env: NodeJS.ProcessEnv = { ...base, INSTAR_CHANGE_EVIDENCE: ledger, PATH: `${dir}:${process.env.PATH ?? ''}` };
      if (split !== undefined) env.INSTAR_TEST_PLATFORM_SPLIT = split;
      const run = spawnSync(process.execPath, [CHECKER, 'run'], { encoding: 'utf8', env });
      const text = existsSync(ledger) ? readFileSync(ledger, 'utf8').trim() : '';
      return { status: run.status, stderr: run.stderr, entries: text ? text.split('\n').filter(Boolean).map(line => JSON.parse(line)) : [] };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('refuses under either split and records nothing', () => {
    for (const split of ['exclude-macos', 'only-macos']) {
      const got = runDriver(split);
      expect(got.status).toBe(2);
      expect(got.stderr).toContain(`refusing to run the whole gate under INSTAR_TEST_PLATFORM_SPLIT=${split}`);
      expect(got.stderr).toContain('npm run test:split-checks');
      expect(got.entries).toEqual([]); // the refusal comes before the run-start, so half a suite is never recorded
    }
  });

  it('the neighbour it must accept: with no split it records the run as the full gate', () => {
    const got = runDriver(undefined);
    expect(got.stderr).not.toContain('refusing to run the whole gate');
    expect(got.entries.map(entry => entry.kind)).toEqual(['run-start', 'suite']);
    expect(got.entries.every(entry => entry.scope === 'full')).toBe(true);
    expect(got.entries[1]?.complete).toBe(false); // the shimmed gate left no report
  });
});
