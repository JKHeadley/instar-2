import { describe, expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { refused } from '../facts/fixtures.js';
import { createFactStore } from '../../src/facts/index.js';
import { rebuildFactReadView } from '../../src/facts/read-view.js';
import { captureExchange, groundTurn, readExchange, recall } from '../../src/recall/index.js';
import { rebuildConversationReadView } from '../../src/recall/read-view.js';
import { recallFixture } from './fixture.js';
import { corpus } from './read-fixture.js';
import type { FactEnvelope } from '../../src/facts/index.js';

const noWork = (r: ReturnType<typeof recallFixture>) => ({
  fold: () => r.fx.success([] as readonly string[]), conversation: (s: string) => s,
});
describe('pinned conversation read indexes', () => {
  it('equals the full scan across deterministic generated queries, recency windows and exclusions', async () => {
    const { r, store, facts, reader } = corpus(240);
    const index = value(rebuildConversationReadView(store, r.fx.c, noWork(r)));
    // Fixed seeds generate differing bounds, zero limits, exclusions and missing conversations.
    for (let seed = 0; seed < 50; seed++) {
      const conversation = `conversation-${seed * 17 % 107}`;
      const n = seed * 7 % 31;
      const full = facts.map((fact, order) => ({ e: readExchange(fact), order }))
        .filter(row => row.e?.conversation === conversation)
        .sort((a, b) => b.e!.at - a.e!.at || b.order - a.order).slice(0, n).map(row => row.e);
      expect(value(index.latest(conversation, n))).toEqual(full);
      const e = readExchange(facts[seed * 13 % facts.length]!)!;
      const query = { text: ['Portland weather', 'kids Saturday', 'opening hours', 'zebra', ''][seed % 5]!,
        exclude: [{ conversation: e.conversation, messageId: e.messageId }],
        bounds: { maxScan: seed * 19 % 250, maxResults: seed % 9, maxRerankCandidates: seed % 15 } };
      expect(value(await recall(query, { ...reader, index }))).toEqual(value(await recall(query, reader)));
    }
  });

  it('preserves tie order, unreadable counts, repeated identities, cross-conversation exclusions and unknown visibility', async () => {
    const { r, facts, store } = corpus(8);
    const rows: FactEnvelope[] = facts.map((f, i) => ({ ...f, at: facts[0]!.at,
      body: { ...(f.body as object), conversation: i % 2 ? 'other' : 'same', messageId: 'shared', visibility: i === 0 ? 'future' : 'public' },
    }) as FactEnvelope);
    rows.push({ ...facts[0]!, id: 'unreadable', schemaVersion: 999 });
    const source = { ...store, read: () => r.fx.success(rows) };
    const index = value(rebuildConversationReadView(source, r.fx.c, noWork(r)));
    const reader = { context: r.fx.c, store: source, stopped: () => false };
    for (const maxScan of [0, 1, 3, 50]) {
      const query = { text: 'weather', bounds: { maxScan }, exclude: [{ conversation: 'same', messageId: 'shared' }] };
      expect(value(await recall(query, { ...reader, index }))).toEqual(value(await recall(query, reader)));
    }
    expect(value(index.latest('same', 10)).map(e => e.factId)).toEqual([rows[6]!.id, rows[4]!.id, rows[2]!.id, rows[0]!.id]);
    expect(value(index.latest('same', 10)).at(-1)?.visibility).toBe('private');
    expect(value(index.select(20, [])).unreadable).toBe(1);
  });

  it('does no source reads or work folding on hot queries, and exposes its pinned source', async () => {
    const { r, store, reader } = corpus(120);
    let reads = 0, folds = 0;
    const source = { ...store, read: () => { reads++; return store.read(); } };
    const index = value(rebuildConversationReadView(source, r.fx.c, {
      fold: () => { folds++; return r.fx.success([{ topic: 'c', id: 'open' }]); }, conversation: row => row.topic,
    }));
    const builtReads = reads;
    for (let i = 0; i < 10; i++) {
      expect(index.work('c')).toEqual([{ topic: 'c', id: 'open' }]);
      expect(index.work('absent')).toEqual([]);
      value(index.latest('conversation-1', 2));
      value(await recall({ text: 'weather', bounds: { maxScan: 20 } }, { ...reader, store: source, index }));
    }
    expect(reads).toBe(builtReads); expect(folds).toBe(1);
    expect(index.source.count).toBe(120);
    expect(() => (index.work('c') as unknown[]).push('forged')).toThrow();
    expect(() => (index.work('c')[0] as { id: string }).id = 'changed').toThrow();
    refused(await recall({ text: 'weather' }, { ...reader, index }), 'another store');
    for (const limit of [-1, 1.5, 50001, NaN]) refused(index.latest('c', limit));
    refused(index.select(1, Array.from({ length: 65 }, () => ({ conversation: 'c', messageId: 'm' }))));
  });

  it('rebuilds from durable facts after a lost index and refuses an interrupted or corrupt rebuild', () => {
    const r = recallFixture(), storage = r.memoryStorage(), w = r.writer(storage);
    value(captureExchange(r.exchange({ text: 'first weather report' }), r.at(1000), w));
    const first = value(rebuildConversationReadView(w.store, r.fx.c, noWork(r)));
    value(captureExchange(r.exchange({ messageId: 'm2', text: 'second weather report' }), r.at(2000), w));
    const restarted = createFactStore(r.context, storage);
    const second = value(rebuildConversationReadView(restarted, r.fx.c, noWork(r)));
    expect(first.source.count).toBe(1); expect(second.source.count).toBe(2);
    expect(value(first.latest(r.exchange().conversation, 20))).toHaveLength(1);
    expect(value(second.latest(r.exchange().conversation, 20))).toHaveLength(2);
    refused(rebuildConversationReadView(restarted, r.fx.c, { fold: () => { throw new Error('interrupted rebuild'); }, conversation: (s: string) => s }), 'interrupted');
    const wire = JSON.parse(storage.rows[0]!); wire.body.text = 'tampered'; storage.rows[0] = JSON.stringify(wire);
    refused(rebuildConversationReadView(restarted, r.fx.c, noWork(r)), 'changed');
    expect(second.source.count).toBe(2); // Existing as-of product remains complete, never relabelled current.
    refused(rebuildConversationReadView(createFactStore(r.context, storage), r.fx.c, noWork(r)));
  });

  it('keeps spend, stop, redaction and audience floors on the indexed grounding path', async () => {
    const r = recallFixture(), w = r.writer(r.memoryStorage());
    value(captureExchange(r.exchange({ text: 'Portland weather', audience: ['elsewhere'] }), r.at(1000), w));
    const index = value(rebuildConversationReadView(w.store, r.fx.c, noWork(r)));
    let calls = 0;
    const reader = { context: r.fx.c, store: w.store, index, stopped: () => true,
      reranker: { id: 'test', chargePerCall: 1, rerank: () => { calls++; return r.fx.success([0]); } } };
    expect(value(await recall({ text: 'weather' }, reader)).manifest.rerank).toBe('stopped');
    expect(value(await recall({ text: 'weather' }, { ...reader, stopped: () => false })).manifest.rerank).toBe('over-budget');
    const g = value(await groundTurn({ text: 'weather', audience: { conversation: 'c', participants: ['justin'] } }, { ...reader, stopped: () => false }));
    expect(g.revealed).toEqual([]); expect(g.withheld).toHaveLength(1); expect(calls).toBe(0);
  });

  it('offers exactly the same recorded-message candidates to a paid reranker', async () => {
    const { r, store, reader } = corpus(30);
    const index = value(rebuildConversationReadView(store, r.fx.c, noWork(r)));
    const calls: string[][] = []; let charged = 0;
    const extra = { spend: { reserve: (amount: number) => { charged += amount; return true; } },
      reranker: { id: 'recorded-shape-candidates', chargePerCall: 1,
        rerank: (_q: string, candidates: readonly string[]) => { calls.push([...candidates]); return r.fx.success([1, 0]); } } };
    const q = { text: 'Portland opening', bounds: { maxRerankCandidates: 4 } };
    expect(value(await recall(q, { ...reader, ...extra, index }))).toEqual(value(await recall(q, { ...reader, ...extra })));
    expect(calls[0]).toEqual(calls[1]); expect(charged).toBe(2);
  });

  it('kind/id indexes are exact immutable source subsets and failed owner folds never publish', () => {
    const { r, store, facts } = corpus(10);
    const view = value(rebuildFactReadView(store, r.fx.c, () => r.fx.success('projected')));
    expect(view.byKind('recall-exchange')).toEqual(facts);
    expect(view.byKind('missing')).toEqual([]); expect(view.byId('missing')).toBeUndefined();
    expect(view.byId(facts[3]!.id)).toBe(facts[3]);
    refused(rebuildFactReadView(store, r.fx.c, () => { throw new Error('owner unavailable'); }), 'owner unavailable');
  });
});
