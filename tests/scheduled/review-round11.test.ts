import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { auditP15CoverageRows, p15Dispositions } from '../../scripts/check-p15-contract-map.mjs';
import { activeScheduledFixture } from './fixture.js';

const title = 'P15-NF-10 package validation remains usable without claiming service continuation';

it(title, () => {
  const fixture = activeScheduledFixture();
  const port = createScheduledWorkPackagePort();
  let driverCalls = 0;
  const unavailable = () => {
    driverCalls += 1;
    throw new Error('execution driver unavailable');
  };
  for (const harness of fixture.assembly.composition.harnesses) {
    Object.assign(harness, { launch: unavailable, deliver: unavailable, observe: unavailable });
  }
  Object.assign(fixture.assembly.composition.model, { prepare: unavailable, exchange: unavailable });
  const status = <T>(result: Parameters<typeof consumeResult<T, 'accepted' | 'refused'>>[0]) => consumeResult(result, {
    Success: () => 'accepted' as const,
    Refused: () => 'refused' as const,
  });

  expect(status(port.decode({ ...fixture.manifest, surprise: true }, fixture.context))).toBe('refused');
  expect(status(port.admitPackageResource({
    package: fixture.package,
    archive: fixture.archive,
    manifestPath: 'scheduled/manifest.json',
    manifestBytes: fixture.manifestBytes,
    existingManifests: [],
  }, fixture.context))).toBe('accepted');
  expect(status(fixture.assembly.runtime.inspectCurrent())).toBe('accepted');
  expect(driverCalls).toBe(0);
});

it('P15-CONTRACT-MAP rejects the reviewer NF-10 evidence when the service-continuation arm is not held', () => {
  const complete = p15Dispositions().find((row: { number: number }) => row.number === 10)!;
  expect(complete).toMatchObject({
    executable: true,
    held: 'NON-EXECUTABLE-UNTIL-impl-part-eleven-and-Part-Ten-production-minimal-plane-wiring; NON-EXECUTABLE-UNTIL-row-83-run-admission-production',
  });
  const partial = [{ ...complete, held: undefined, status: 'EXECUTABLE' }];
  const report = { success: true, testResults: [{
    name: `${process.cwd()}/tests/scheduled/review-round11.test.ts`,
    assertionResults: [{ fullName: title, title, status: 'passed' }],
  }] };
  expect(() => auditP15CoverageRows(report, [complete])).not.toThrow();
  expect(() => auditP15CoverageRows(report, partial)).toThrow(/consistent disposition/);
});
