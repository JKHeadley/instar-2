import { describe, expect, it } from 'vitest';
import { rosterOnlyEnrollmentFixture } from './register-roster-only-enrollment-round8.test.js';

describe.skip('round-twelve shipped normal build retained enrollment SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-09 P3-NF-21 reviewer case normal-build-invalid-retained-enrollment refuses a signed repeated part-14 introduction', () => {
    expect(() => rosterOnlyEnrollmentFixture(true))
      .toThrow('P3-NF-09: shape-change document does not name the exact shape entries changed');
  }, 60_000);
});
