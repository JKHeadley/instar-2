import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createBoundedDueScanPort } from '../../src/transport/index.js';
import { validateTransition } from '../../src/transport/records.js';
import type { ScanCursor, TransportFact } from '../../src/transport/index.js';
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

it('P6-NF-20 P6-NF-33 C1 restart plus generation churn refuses instead of starving pending key identities', () => {
  const f = transportFixture();
  const first = value(createBoundedDueScanPort(f.host, f.spine, f.c).page(input({ generation: 'g0', orderedKeys: ['a', 'b', 'c', 'd'] })));
  expect(first.selected).toEqual(['a', 'b']);
  const before = value(f.api.inspect()).filter(row => row.record.type === 'ScanCursor').length;
  for (let i = 1; i < 8; i++) {
    const restarted = transportFixture(f.directory, `worker:${i}`, `authority:${i}`);
    const orderedKeys = i % 2 ? ['c', 'd', 'e', 'f'] : ['a', 'b', 'c', 'd'];
    refused(createBoundedDueScanPort(restarted.host, restarted.spine, restarted.c).page(input({
      generation: `g${i}`, orderedKeys, cursor: first.cursor,
    })), 'generation change is unsupported');
    expect(value(restarted.api.inspect()).filter(row => row.record.type === 'ScanCursor')).toHaveLength(before);
  }

  const control = transportFixture(), controlPort = createBoundedDueScanPort(control.host, control.spine, control.c);
  const controlFirst = value(controlPort.page(input({ orderedKeys: ['a', 'b', 'c', 'd'] })));
  const controlRestart = transportFixture(control.directory, 'worker:restart', 'authority:restart');
  expect(value(createBoundedDueScanPort(controlRestart.host, controlRestart.spine, controlRestart.c).page(input({
    orderedKeys: ['a', 'b', 'c', 'd'], cursor: controlFirst.cursor,
  })))).toMatchObject({ selected: ['c', 'd'], wrapped: true });
});

it('P6-NF-20 P6-NF-33 C2 durable admission refuses a signed progress reset and preserves valid replay', () => {
  const f = transportFixture(), port = createBoundedDueScanPort(f.host, f.spine, f.c);
  const request = input({ orderedKeys: ['a', 'b', 'c', 'd'] });
  const first = value(port.page(request));
  const last = value(f.api.inspect()).at(-1)!;
  if (last.record.type !== 'ScanCursor') throw new Error('scan cursor missing');
  const forged = { ...last.record, command: 'scan:forged-progress-reset', predecessor: last.fact.id, previous: last.fact.id,
    selectedFrom: 0, selectedCount: 2, nextIndex: 2, wrapped: 0 } as ScanCursor;
  refused(f.spine.append(forged, [last.fact.id]), 'progress reset');
  const second = value(port.page({ ...request, cursor: first.cursor }));
  expect(second.selected).toEqual(['c', 'd']);
  expect(value(port.page({ ...request, cursor: first.cursor }))).toEqual(second);
});

it('P6-NF-17 P6-NF-33 C3 durable admission refuses selection under a zero-duration page', () => {
  const f = transportFixture(), port = createBoundedDueScanPort(f.host, f.spine, f.c);
  const first = value(port.page(input({ orderedKeys: ['a', 'b', 'c', 'd'] })));
  const last = value(f.api.inspect()).at(-1)!;
  if (last.record.type !== 'ScanCursor') throw new Error('scan cursor missing');
  const forged = { ...last.record, command: 'scan:forged-zero-duration', predecessor: last.fact.id, previous: last.fact.id,
    selectedFrom: 2, selectedCount: 2, nextIndex: 0, maxDuration: 0, elapsed: 0, wrapped: 1 } as ScanCursor;
  refused(f.spine.append(forged, [last.fact.id]), 'zero-duration');
  expect(value(port.page(input({ orderedKeys: ['a', 'b', 'c', 'd'], cursor: first.cursor, maxDuration: 0 })))).toMatchObject({
    selected: [], wrapped: false,
  });
});

it('P6-NF-20 P6-NF-33 C4 historical transition validation binds a reused generation to its original keys', () => {
  const f = transportFixture(), port = createBoundedDueScanPort(f.host, f.spine, f.c);
  value(port.page(input({ generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'] })));
  const all = value(f.api.inspect()), first = all.at(-1)!;
  if (first.record.type !== 'ScanCursor') throw new Error('scan cursor missing');
  const g2 = { ...first.record, command: 'scan:legacy-g2', predecessor: first.fact.id, previous: first.fact.id,
    generation: 'g2', orderedKeysDigest: value(canonical(['c', 'd', 'e', 'f'])).hash,
    selectedFrom: 2, selectedCount: 2, nextIndex: 0, wrapped: 1 } as ScanCursor;
  const g2Fact = { ...first.fact, id: 'legacy-g2-fact' };
  const legacyHistory = [...all, { fact: g2Fact, record: g2 } as TransportFact];
  const reused = { ...g2, command: 'scan:reused-g1-mutated', predecessor: g2Fact.id, previous: g2Fact.id,
    generation: 'g1', orderedKeysDigest: value(canonical(['a', 'c', 'b', 'd'])).hash,
    selectedFrom: 0, selectedCount: 2, nextIndex: 2, wrapped: 0 } as ScanCursor;
  expect(() => validateTransition(reused, legacyHistory, f.host)).toThrow('original ordered keys');
  refused(port.page(input({ generation: 'g2', orderedKeys: ['c', 'd', 'e', 'f'],
    cursor: { owner: 'part-six', name: 'ScanCursor', id: first.fact.id } })), 'generation change is unsupported');
});
