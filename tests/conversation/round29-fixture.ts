// Permanent import of rereview27's numeric-boundary.ts three-case finite-bounds matrix.
// P12-NF-18 finite bounds: an update id at the safe-integer maximum must never advance the
// Telegram cursor to an unrepresentable offset, and no poll may ever be issued with one. The
// ordinary 100 control and the adjacent (MAX_SAFE_INTEGER - 1) control still advance normally.
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';

type Disposition = 'Success' | 'Refused';
const kind = (result: Result<unknown>): Disposition =>
  consumeResult(result, { Success: () => 'Success', Refused: () => 'Refused' });

export type Round29BoundaryRow = {
  id: number; firstPoll: Disposition; cursor: Disposition; secondPoll: Disposition;
  nextOffset: number | null; offsetSafe: boolean; pollOffsets: number[]; allPollOffsetsSafe: boolean;
};

export function round29NumericBoundary(): Round29BoundaryRow[] {
  const rows: Round29BoundaryRow[] = [];
  for (const id of [100, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER]) {
    const f = conversationFixture({ initialOffset: id });
    const w = wireTelegram(f);
    f.queue(telegramUpdate(id));
    const first = w.ingress.pollOnce();
    const cursor = w.ingress.currentOffset();
    const second = w.ingress.pollOnce();
    const pollOffsets = (f.calls.poll as Array<{ offset: number }>).map(call => call.offset);
    rows.push({
      id, firstPoll: kind(first), cursor: kind(cursor), secondPoll: kind(second),
      nextOffset: consumeResult(first, {
        Success: value => (value as { nextOffset: number }).nextOffset, Refused: () => null,
      }),
      offsetSafe: consumeResult(cursor, {
        Success: value => Number.isSafeInteger(value), Refused: () => false,
      }),
      pollOffsets, allPollOffsetsSafe: pollOffsets.every(offset => Number.isSafeInteger(offset)),
    });
  }
  return rows;
}
