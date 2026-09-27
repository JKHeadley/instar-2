import { describe, expect, it } from 'vitest';
// @ts-expect-error The supervised Node script is intentionally an untyped .mjs entry.
import { resultSince } from './live-test-suite.mjs';

const before = { order: [{ update: 1, intake: true, answered: true, sent: true, held: null }] };
const turn = (update: number, changes: Record<string, unknown> = {}) =>
  ({ update, intake: true, answered: true, sent: true, held: null, ...changes });

describe('supervised live suite classification', () => {
  it('counts only new answered, Telegram accepted turns', () => {
    expect(resultSince(before, { order: [...before.order, turn(2), turn(3, { answered: false })] }))
      .toEqual({ answered: 1, held: 0, reason: '', unresolved: 0 });
  });

  it('keeps the first hold reason even when a candidate answer exists', () => {
    expect(resultSince(before, { order: [...before.order, turn(2, { sent: false, held: 'reply check unavailable' }),
      turn(3, { sent: false, held: 'call cap' })] }))
      .toEqual({ answered: 0, held: 1, reason: 'reply check unavailable', unresolved: 0 });
  });

  it('does not count a pending or UNKNOWN send as answered', () => {
    expect(resultSince(before, { order: [...before.order, turn(2, { sent: false })] }))
      .toEqual({ answered: 0, held: 0, reason: '', unresolved: 1 });
  });

  it('notices an older accepted turn that becomes held during the procedure', () => {
    expect(resultSince(before, { order: [turn(1, { held: 'memory correction pending' })] }))
      .toEqual({ answered: 0, held: 1, reason: 'memory correction pending', unresolved: 0 });
  });
});
