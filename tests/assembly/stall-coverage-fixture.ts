import { HARNESS_STALL_CLASSES } from '../../src/assembly/stall-coverage.js';
import type { HarnessStallCoverage } from '../../src/assembly/stall-coverage.js';

/** A complete Rule 59 stall table for adapter fixtures that exercise other contracts. */
export function stallCoverageFixture(harness: string): HarnessStallCoverage {
  return { type: 'HarnessStallCoverage', harness, rows: HARNESS_STALL_CLASSES.map(stall => ({ stall,
    detection: `fixture detection evidence for ${stall}`, recovery: `fixture permitted recovery for ${stall}`,
    positive: { file: 'tests/assembly/stall-coverage.test.ts', title: `fixture positive case ${stall}` },
    failing: { file: 'tests/assembly/stall-coverage.test.ts', title: `fixture failing case ${stall}` } })) };
}
