import { expect, it } from 'vitest';
import { createBoundedDueScanPort } from '../../src/transport/index.js';
import type { OwnedReference } from '../../src/index.js';
import { transportFixture, value, refused } from './fixture.js';

const input = (overrides: Partial<Parameters<ReturnType<typeof createBoundedDueScanPort>['page']>[0]> = {}) => ({
  scan: 'verification-due', generation: 'due:g1', orderedKeys: ['a', 'b', 'c'] as readonly string[],
  cursor: null, maxItems: 2, maxDuration: 100, ...overrides,
});

it('P6-NF-20 P6-NF-33 owner-branded due pages advance fairly through durably admitted cursors', () => {
  const f = transportFixture();
  const port = createBoundedDueScanPort(f.host, f.spine, f.c);
  expect(port.owner).toBe('part-six');

  const first = value(port.page(input()));
  expect(first).toMatchObject({ selected: ['a', 'b'], wrapped: false });
  const firstRecord = value(f.api.inspect()).at(-1)!;
  expect(first.cursor).toEqual({ owner: 'part-six', name: 'ScanCursor', id: firstRecord.fact.id });
  expect(firstRecord.record).toMatchObject({ type: 'ScanCursor', scan: 'verification-due', generation: 'due:g1',
    selectedFrom: 0, selectedCount: 2, nextIndex: 2, wrapped: 0 });

  const second = value(port.page(input({ cursor: first.cursor })));
  expect(second).toMatchObject({ selected: ['c', 'a'], wrapped: true });
  const records = value(f.api.inspect()).filter(entry => entry.record.type === 'ScanCursor');
  expect(records).toHaveLength(2);
  expect(records[1]!.record).toMatchObject({ previous: first.cursor.id, selectedFrom: 2, nextIndex: 1, wrapped: 1 });
  expect(value(port.page(input({ cursor: first.cursor })))).toEqual(second);
  refused(port.page(input()), 'stale');
});

it('P6-NF-17 P6-NF-33 item and duration bounds are finite and zero means zero', () => {
  const f = transportFixture();
  const timedHost = { ...f.host, monotonic: () => { f.advance(1); return f.host.monotonic(); } };
  const port = createBoundedDueScanPort(timedHost, f.spine, f.c);
  const timed = value(port.page(input({ scan: 'timed', maxItems: 3, maxDuration: 2 })));
  expect(timed.selected).toEqual(['a']);
  expect(value(f.api.inspect()).at(-1)!.record).toMatchObject({ type: 'ScanCursor', selectedCount: 1, elapsed: 2 });

  const zero = value(port.page(input({ scan: 'zero', maxItems: 0, maxDuration: 100 })));
  expect(zero.selected).toEqual([]);
  expect(zero.wrapped).toBe(false);
  refused(port.page(input({ scan: 'negative', maxItems: -1 })), 'nonnegative');
});

it('P6-NF-02 P6-NF-33 missing, foreign, changed, and synthetic cursor inputs refuse without mutation', () => {
  const f = transportFixture();
  const port = createBoundedDueScanPort(f.host, f.spine, f.c);
  const missing = { owner: 'part-six', name: 'ScanCursor', id: 'missing' } as const;
  const before = value(f.api.inspect()).length;
  refused(port.page(input({ cursor: missing })), 'absent');
  refused(port.page(input({ cursor: { ...missing, owner: 'part-nine' } as unknown as OwnedReference<'part-six', 'ScanCursor'> })), 'owner');
  expect(value(f.api.inspect())).toHaveLength(before);

  const admitted = value(port.page(input()));
  refused(port.page(input({ cursor: admitted.cursor, orderedKeys: ['a', 'c', 'b'] })), 'generation changed');
  refused(port.page(input({ cursor: { ...admitted.cursor, id: 'synthetic' } })), 'absent');
  expect(value(f.api.inspect()).filter(entry => entry.record.type === 'ScanCursor')).toHaveLength(1);
});
