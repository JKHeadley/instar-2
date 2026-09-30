// Rule 40: designed trimming/compaction is recorded as success with the applied
// bound, distinct from no trimming and from a refusal to admit work.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { journalCapacity, packetCapacity } from './capacity-outcome.js';
import { openPreviewJournal } from './journal.js';

it('reports trimmed packet evidence as capacity applied, and an untrimmed packet as no capacity', () => {
  expect(packetCapacity([{ kind: 'recent', source: 'telegram:1:update:2', reason: 'context bound' }], 32768)).toEqual({
    outcome: 'success', capacity: 'applied', bound: 'context-bytes:32768',
    action: 'kept the packet within bound by omitting 1 optional item(s)' });
  expect(packetCapacity([], 32768)).toEqual({ outcome: 'success', capacity: 'none' });
  // An earlier reservation without the durable drop record is unknown, not a success claim.
  expect(packetCapacity(undefined, 32768)).toBeNull();
});

it('reports a compacted journal as capacity applied after it crosses its threshold', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'capacity-journal-')));
  try {
    const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(3);
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 30, maxReplies: 30, maxTurns: 30, maxBytes: 262144, cursor: 0 }, undefined, false, 4096);
    expect(journalCapacity(journal.compacted, 4096)).toEqual({ outcome: 'success', capacity: 'none' });
    journal.append({ kind: 'intake', id: 'telegram:12345678:update:1', update: 1, text: 'q', raw: '{}', accepted: true, cursor: 2, at: 1000 });
    for (let i = 0; i < 80; i++) journal.append({ kind: 'hold', id: 'telegram:12345678:update:1', reason: 'waiting', at: 1001 + i });
    expect(journal.compacted).toBe(true);
    journal.close();
    const reader = openPreviewJournal(path, key, undefined, undefined, true, 4096);
    try {
      expect(journalCapacity(reader.compacted, 4096)).toMatchObject({ outcome: 'success', capacity: 'applied', bound: 'journal-bytes:4096' });
      expect(reader.view.order).toHaveLength(1);
    } finally { reader.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
