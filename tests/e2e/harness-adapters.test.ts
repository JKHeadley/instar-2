import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('A1-E2E R5-F4 R5-F5 R5-F6 R5-F7 R5-F8 R6-F1 R6-F2 R6-F3 R6-F4 R6-F6 P13-NF-01 P13-NF-05 P13-NF-15 P13-NF-25 P13-NF-29 P13-NF-31 P13-NF-34 P13-NF-39 fresh process preserves the structural Slice A1 boundary', () => {
  const output = execFileSync('node_modules/.bin/vite-node', ['tests/harness-adapters/fresh-process-probe.ts'],
    { cwd: process.cwd(), encoding: 'utf8' });
  const result = JSON.parse(output) as Record<string, any>;
  expect(result).toMatchObject({
    matchingGeneration: 'recorded', obsoleteGeneration: 'refused', malformedAttempt: 'refused',
    contradictoryOperation: 'refused', emptyFinish: 'refused', repeatedOutput: 'duplicate', removed: [],
    disputedDuplicate: 'refused', obsoleteDuplicate: 'refused', foreignDuplicate: 'refused',
    unwitnessedOutputDuplicate: 'refused', distinctWorkIdentity: 'advancing',
    nestedMigration: 'Success', nestedV1: 'Success', snapshotClockControl: 'Success',
    snapshotClockRefusal: 'Refused', repeatedOwnerLaunch: true, repeatedHandleDigests: 'Success',
    conflictingHandleSnapshot: 'Refused', conflictingStateSnapshot: 'Refused',
    distinctHandleSnapshot: 'Success', distinctStateSnapshot: 'Success',
    contractMapRequiredPairs: 25,
  });
  expect(result.outputCustody).toMatchObject({
    disposition: 'refused', reason: expect.stringContaining('NON-EXECUTABLE-UNTIL-slice-A2'),
  });
});
