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
    const orderedKeys = i % 2 ? ['c', 'd', 'e', 'f'] : ['b', 'c', 'd', 'e'];
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

it('P6-NF-20 P6-NF-33 N1 safe generation transitions preserve a remainder or begin after completed and empty snapshots', () => {
  const mid = transportFixture();
  const midFirst = value(createBoundedDueScanPort(mid.host, mid.spine, mid.c).page(input({
    generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'],
  })));
  const midRestart = transportFixture(mid.directory, 'worker:mid-restart', 'authority:mid-restart');
  expect(value(createBoundedDueScanPort(midRestart.host, midRestart.spine, midRestart.c).page(input({
    generation: 'g2', orderedKeys: ['a', 'b', 'c', 'd'], cursor: midFirst.cursor,
  })))).toMatchObject({ selected: ['c', 'd'], wrapped: true });

  const completed = transportFixture(), completedPort = createBoundedDueScanPort(completed.host, completed.spine, completed.c);
  const completedFirst = value(completedPort.page(input({ generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'] })));
  const completedRound = value(completedPort.page(input({
    generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'], cursor: completedFirst.cursor,
  })));
  const sameRestart = transportFixture(completed.directory, 'worker:same-restart', 'authority:same-restart');
  expect(value(createBoundedDueScanPort(sameRestart.host, sameRestart.spine, sameRestart.c).page(input({
    generation: 'g2', orderedKeys: ['a', 'b', 'c', 'd'], cursor: completedRound.cursor,
  })))).toMatchObject({ selected: ['a', 'b'], wrapped: false });

  const changed = transportFixture(), changedPort = createBoundedDueScanPort(changed.host, changed.spine, changed.c);
  const changedFirst = value(changedPort.page(input({ generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'] })));
  const changedRound = value(changedPort.page(input({
    generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'], cursor: changedFirst.cursor,
  })));
  const changedRestart = transportFixture(changed.directory, 'worker:changed-restart', 'authority:changed-restart');
  expect(value(createBoundedDueScanPort(changedRestart.host, changedRestart.spine, changedRestart.c).page(input({
    generation: 'g2', orderedKeys: ['e', 'f'], cursor: changedRound.cursor,
  })))).toMatchObject({ selected: ['e', 'f'], wrapped: true });

  const empty = transportFixture();
  const emptyFirst = value(createBoundedDueScanPort(empty.host, empty.spine, empty.c).page(input({
    generation: 'g1', orderedKeys: [],
  })));
  const emptyRestart = transportFixture(empty.directory, 'worker:empty-restart', 'authority:empty-restart');
  expect(value(createBoundedDueScanPort(emptyRestart.host, emptyRestart.spine, emptyRestart.c).page(input({
    generation: 'g2', orderedKeys: ['a'], cursor: emptyFirst.cursor,
  })))).toMatchObject({ selected: ['a'], wrapped: true });
});

it.each([
  ['zero items', { maxItems: 0, maxDuration: 100 }, false],
  ['zero duration', { maxItems: 2, maxDuration: 0 }, false],
  ['elapsed duration', { maxItems: 2, maxDuration: 1 }, true],
] as const)('P6-NF-17 P6-NF-20 P6-NF-33 N3 completed rounds survive %s pages without blessing initial zero work', (_name, zeroBounds, elapsed) => {
  const completed = transportFixture();
  const completedHost = elapsed ? { ...completed.host, monotonic: () => { completed.advance(1); return completed.host.monotonic(); } } : completed.host;
  const port = createBoundedDueScanPort(completedHost, completed.spine, completed.c);
  const request = input({ generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'] });
  const first = value(port.page(request));
  const round = value(port.page({ ...request, cursor: first.cursor }));
  expect(round).toMatchObject({ selected: ['c', 'd'], wrapped: true });
  const zero = value(port.page({ ...request, cursor: round.cursor, ...zeroBounds }));
  expect(zero).toMatchObject({ selected: [], wrapped: false });
  const admitted = value(port.page(input({
    generation: 'g2', orderedKeys: ['x', 'y'], cursor: zero.cursor,
  })));
  expect(admitted).toMatchObject({ selected: ['x', 'y'], wrapped: true });
  refused(port.page(input({ generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'], cursor: admitted.cursor })), 'supersession');

  const initial = transportFixture();
  const initialHost = elapsed ? { ...initial.host, monotonic: () => { initial.advance(1); return initial.host.monotonic(); } } : initial.host;
  const initialPort = createBoundedDueScanPort(initialHost, initial.spine, initial.c);
  const initialZero = value(initialPort.page(input({
    generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'], ...zeroBounds,
  })));
  expect(initialZero).toMatchObject({ selected: [], wrapped: false });
  refused(initialPort.page(input({
    generation: 'g2', orderedKeys: ['x', 'y'], cursor: initialZero.cursor,
  })), 'generation change is unsupported');
});

it('P6-NF-20 P6-NF-33 N3 positive selection after preserved completion starts a new unfinished round', () => {
  const f = transportFixture(), port = createBoundedDueScanPort(f.host, f.spine, f.c);
  const request = input({ generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'] });
  const first = value(port.page(request));
  const completed = value(port.page({ ...request, cursor: first.cursor }));
  const zero = value(port.page({ ...request, cursor: completed.cursor, maxItems: 0 }));
  const started = value(port.page({ ...request, cursor: zero.cursor }));
  expect(started).toMatchObject({ selected: ['a', 'b'], wrapped: false });
  refused(port.page(input({
    generation: 'g2', orderedKeys: ['x', 'y'], cursor: started.cursor,
  })), 'generation change is unsupported');
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
  const originalDigest = first.record.orderedKeysDigest;
  const g2 = { ...first.record, command: 'scan:legacy-g2', predecessor: first.fact.id, previous: first.fact.id,
    generation: 'g2', orderedKeysDigest: value(canonical(['c', 'd', 'e', 'f'])).hash,
    selectedFrom: 2, selectedCount: 2, nextIndex: 0, wrapped: 1 } as ScanCursor;
  const g2Fact = { ...first.fact, id: 'legacy-g2-fact' };
  const legacyHistory = [...all, { fact: g2Fact, record: g2 } as TransportFact];
  const reused = { ...g2, command: 'scan:reused-g1-mutated', predecessor: g2Fact.id, previous: g2Fact.id,
    generation: 'g1', orderedKeysDigest: value(canonical(['a', 'c', 'b', 'd'])).hash,
    selectedFrom: 0, selectedCount: 2, nextIndex: 2, wrapped: 0 } as ScanCursor;
  expect(() => validateTransition(reused, legacyHistory, f.host)).toThrow('original ordered keys');
  expect(() => validateTransition({ ...reused, command: 'scan:reused-g1-original',
    orderedKeysDigest: originalDigest } as ScanCursor, legacyHistory, f.host)).toThrow('supersession');
  refused(port.page(input({ generation: 'g2', orderedKeys: ['c', 'd', 'e', 'f'],
    cursor: { owner: 'part-six', name: 'ScanCursor', id: first.fact.id } })), 'generation change is unsupported');
});
