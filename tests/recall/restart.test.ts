import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { createFactStore } from '../../src/facts/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { captureExchange, groundTurn } from '../../src/recall/index.js';
// @ts-expect-error Ten physical host is JavaScript outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { recallFixture } from './fixture.js';

it('an exchange from session A (topic 7) is recalled in session B (topic 9) after a restart, with who/when, and a restricted one stays withheld', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'recall-restart-')));
  const open = (r: ReturnType<typeof recallFixture>) => value(openProductionStorage({ root, machine: 'machine-a', key: new Uint8Array(32).fill(7),
    policy: 'policy', store: 'recall', context: { ...r.context.decode, site: r.context.site, preserved: r.context.preserved }, io: productionStorageIO }));
  try {
    // ── Session A: its own fixture, store and storage handle. ──
    const a = recallFixture(); const diskA = open(a); const wA = a.writer(diskA.segment);
    const first = value(captureExchange(a.exchange({ conversation: 'telegram:-100:7', session: 'session-A', messageId: '501',
      text: 'The Lisbon conference talk is on October 12th at 3pm' }), a.at(Date.UTC(2026, 8, 20, 9, 30)), wA));
    value(captureExchange(a.exchange({ conversation: 'telegram:-100:7', session: 'session-A', messageId: '502', speakerId: 'echo',
      speakerName: 'Echo', speakerRole: 'agent', audience: ['justin'], text: 'Noted, I will prepare the Lisbon slides by the 10th.' }),
      a.at(Date.UTC(2026, 8, 20, 9, 31)), wA));
    const restricted = value(captureExchange(a.exchange({ conversation: 'telegram:-100:8', session: 'session-A', messageId: '77',
      speakerId: 'sarah', speakerName: 'Sarah', audience: ['sarah'], text: 'Between us: I might skip the Lisbon conference.' }),
      a.at(Date.UTC(2026, 8, 20, 10, 0)), wA));
    expect(first.durability).toEqual({ kind: 'local-durable' });
    diskA.close();
    // At rest the store is encrypted: no plaintext exchange on disk.
    expect(readFileSync(join(root, 'facts.encrypted'), 'utf8')).not.toContain('Lisbon');

    // ── Restart. Session B: fresh fixture, fresh store object; only the disk carries state. ──
    const b = recallFixture(); const diskB = open(b);
    const storeB = createFactStore(b.context, diskB.segment);
    const reader = { context: b.fx.c, store: storeB, stopped: () => false };
    const g = value(await groundTurn({ text: 'when is my Lisbon talk?', exclude: [{ conversation: 'telegram:-100:9', messageId: '900' }],
      audience: { conversation: 'telegram:-100:9', participants: ['justin'] } }, reader));
    expect(g.revealed.map(e => e.text)).toEqual(expect.arrayContaining(['The Lisbon conference talk is on October 12th at 3pm']));
    expect(g.revealed.find(e => e.factId === first.factId)).toMatchObject({ speakerName: 'Justin', speakerRole: 'user',
      conversation: 'telegram:-100:7', at: Date.UTC(2026, 8, 20, 9, 30) });
    expect(g.text).toContain('[2026-09-20T09:30Z · telegram:-100:7 · Justin (user)] The Lisbon conference talk is on October 12th at 3pm');
    expect(g.text).toContain('Echo (agent)] Noted, I will prepare the Lisbon slides');
    expect(g.withheld).toEqual([{ factId: restricted.factId, reason: 'outside-audience' }]);
    expect(g.text).not.toContain('skip');

    // The writer resumes the chain after restart, and a redelivery across the restart is not a duplicate.
    const wB = { ...b.writer(diskB.segment), store: storeB };
    expect(value(captureExchange(b.exchange({ conversation: 'telegram:-100:7', session: 'session-A', messageId: '501',
      text: 'The Lisbon conference talk is on October 12th at 3pm' }), b.at(Date.UTC(2026, 8, 21)), wB))).toMatchObject({ duplicate: true, factId: first.factId });
    value(captureExchange(b.exchange({ conversation: 'telegram:-100:9', session: 'session-B', messageId: '900', text: 'when is my Lisbon talk?' }),
      b.at(Date.UTC(2026, 8, 21, 8)), wB));
    expect(value(storeB.read())).toHaveLength(4);
    diskB.close();
    const c = recallFixture(); const diskC = open(c);
    expect(value(createFactStore(c.context, diskC.segment).read())).toHaveLength(4);
    diskC.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
