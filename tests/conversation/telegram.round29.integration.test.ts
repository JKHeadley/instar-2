import { expect, it } from 'vitest';
import { round29NumericBoundary } from './round29-fixture.js';

const MAX = Number.MAX_SAFE_INTEGER;

// F1 (rereview27): after receiving a valid update id at the safe-integer maximum, currentOffset()
// used to become MAX + 1 and the next poll was issued with an unsafe integer. The representability
// guard on both increment branches now refuses the unrepresentable advance and issues no such poll.
it('P12-NF-18 round29 permanently executes the numeric-update-boundary finite-bounds matrix', () => {
  const rows = round29NumericBoundary();
  expect(rows).toEqual([
    { id: 100, firstPoll: 'Success', cursor: 'Success', secondPoll: 'Success',
      nextOffset: 101, offsetSafe: true, pollOffsets: [100, 101], allPollOffsetsSafe: true },
    { id: MAX - 1, firstPoll: 'Success', cursor: 'Success', secondPoll: 'Success',
      nextOffset: MAX, offsetSafe: true, pollOffsets: [MAX - 1, MAX], allPollOffsetsSafe: true },
    { id: MAX, firstPoll: 'Refused', cursor: 'Refused', secondPoll: 'Refused',
      nextOffset: null, offsetSafe: false, pollOffsets: [MAX], allPollOffsetsSafe: true },
  ]);
  // The invariant that fails at the buggy head: no poll is ever issued with an out-of-domain offset.
  for (const row of rows) expect(row.allPollOffsetsSafe).toBe(true);
});
