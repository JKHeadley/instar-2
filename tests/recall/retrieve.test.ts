import { describe, expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { refused } from '../facts/fixtures.js';
import { captureExchange, recall, stem, terms } from '../../src/recall/index.js';
import type { RecallReader, RecallRerankPort } from '../../src/recall/index.js';
import { recallFixture } from './fixture.js';
import { corpus, lexicalQueries, paraphraseQueries, testConcepts } from './corpus.js';

function loaded() {
  const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
  corpus.forEach((c, i) => value(captureExchange(r.exchange({ messageId: c.id, conversation: c.conversation, session: c.session,
    speakerId: c.speaker.toLowerCase(), speakerName: c.speaker, speakerRole: c.speaker === 'Echo' ? 'agent' : 'user', text: c.text }), r.at(1000 + i * 1000), w)));
  const reader = (extra: Partial<RecallReader> = {}): RecallReader => ({ context: r.fx.c, store: w.store, stopped: () => false, ...extra });
  return { r, w, storage, reader };
}
const ids = (result: Awaited<ReturnType<typeof recall>>) => value(result).hits.map(h => h.exchange.messageId);
// Test-only stand-in for a semantic model: ranks candidates by concept overlap with the query.
function conceptReranker(calls: string[][] = []): RecallRerankPort & { calls: string[][] } {
  return { id: 'test-concepts', chargePerCall: 1, calls, rerank(query, candidates) {
    calls.push([...candidates]);
    const wanted = terms(query).flatMap(t => testConcepts[t] ?? []).map(stem);
    const scored = candidates.map((c, i) => ({ i, s: terms(c).filter(t => wanted.includes(t)).length })).filter(x => x.s > 0);
    return { kind: 'Success', value: scored.sort((a, b) => b.s - a.s).map(x => x.i) } as never;
  } };
}

describe('recall — retrieval by meaning, bounded and offline', () => {
  it('stems consistently across inflections', () => {
    for (const [a, b] of [['meeting', 'meets'], ['deployed', 'deploys'], ['running', 'runs'], ['lighthouses', 'lighthouse'], ['boxes', 'box'], ['stopped', 'stop']] as const)
      expect(stem(a), `${a}/${b}`).toBe(stem(b));
  });

  it('lexical quality on the fixture set: every expected exchange in the top 3 (recall@3 = 1.0)', async () => {
    const { reader } = loaded();
    let found = 0, wanted = 0;
    for (const q of lexicalQueries) {
      const top = ids(await recall({ text: q.query, bounds: { maxResults: 3 } }, reader()));
      for (const e of q.expect) { wanted++; if (top.includes(e)) found++; else console.log('missed', q.query, e, top); }
      expect(top[0], q.query).toBe(q.expect[0]);
    }
    expect(found / wanted).toBe(1);
  });

  it('reports the strategy honestly: strict, loose widening, or none', async () => {
    const { reader } = loaded();
    expect(value(await recall({ text: 'staging deploy' }, reader())).manifest.strategy).toBe('lexical-strict');
    const loose = value(await recall({ text: 'database zebra' }, reader()));
    expect(loose.manifest.strategy).toBe('lexical-loose');
    expect(loose.hits[0]!.exchange.messageId).toBe('c1');
    const none = value(await recall({ text: 'quantum zebra' }, reader()));
    expect(none).toMatchObject({ hits: [], manifest: { strategy: 'none', rerank: 'not-configured', stored: 16, scanned: 16, charge: 0 } });
  });

  it('recalls across conversations and sessions, carrying who and when', async () => {
    const { reader } = loaded();
    const hit = value(await recall({ text: 'marketing budget' }, reader())).hits.find(h => h.exchange.messageId === 'c5')!;
    expect(hit.exchange).toMatchObject({ speakerName: 'Sarah', speakerRole: 'user', conversation: 'telegram:1:12', session: 's3', at: 5000 });
  });

  it('paraphrases: lexical alone misses them; a semantic reranker over padded candidates recovers them', async () => {
    const { reader } = loaded();
    let spent = 0;
    const spend = { reserve: (n: number) => { spent += n; return true; } };
    for (const q of paraphraseQueries) {
      expect(ids(await recall({ text: q.query, bounds: { maxResults: 3 } }, reader())), q.query).not.toContain(q.expect);
      const reranked = value(await recall({ text: q.query, bounds: { maxResults: 3 } }, reader({ reranker: conceptReranker(), spend })));
      expect(reranked.manifest.rerank).toBe('used');
      expect(reranked.hits[0]!.exchange.messageId, q.query).toBe(q.expect);
    }
    expect(spent).toBe(paraphraseQueries.length);
  });

  it('paraphrase reaches older zero-overlap evidence even when lexical matches fill every rerank slot', async () => {
    const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
    // The oldest exchange is the paraphrase target; 30 newer exchanges all match the query's words.
    value(captureExchange(r.exchange({ messageId: 'old', conversation: 'telegram:1', session: 's', speakerId: 'justin',
      speakerName: 'Justin', speakerRole: 'user', text: 'My daughter has a piano recital on Friday.' }), r.at(1000), w));
    for (let i = 0; i < 30; i++) value(captureExchange(r.exchange({ messageId: `n${i}`, conversation: 'telegram:1', session: 's',
      speakerId: 'justin', speakerName: 'Justin', speakerRole: 'user', text: `Another kid performance note number ${i}.` }), r.at(2000 + i * 1000), w));
    const rr = conceptReranker();
    const out = value(await recall({ text: 'kid performance', bounds: { maxRerankCandidates: 10, maxResults: 3 } },
      { context: r.fx.c, store: w.store, stopped: () => false, reranker: rr, spend: { reserve: () => true } }));
    expect(rr.calls[0]).toHaveLength(10);
    expect(rr.calls[0]!.some(text => text.includes('piano recital'))).toBe(true);
    expect(out.hits[0]!.exchange.messageId).toBe('old');
  });

  it('spend floor: no spend port or a refused reservation means no model call, lexical stands', async () => {
    const { reader } = loaded();
    const noPort = conceptReranker();
    const a = value(await recall({ text: 'staging deploy' }, reader({ reranker: noPort })));
    expect(a.manifest).toMatchObject({ rerank: 'over-budget', charge: 0 });
    expect(noPort.calls).toHaveLength(0);
    const capped = conceptReranker(); let budget = 1;
    const spend = { reserve: (n: number) => { if (budget < n) return false; budget -= n; return true; } };
    expect(value(await recall({ text: 'kid performance' }, reader({ reranker: capped, spend }))).manifest.rerank).toBe('used');
    expect(value(await recall({ text: 'kid performance' }, reader({ reranker: capped, spend }))).manifest.rerank).toBe('over-budget');
    expect(capped.calls).toHaveLength(1);
  });

  it('stop floor: no rerank spend while stopped', async () => {
    const { reader } = loaded(); const rr = conceptReranker();
    const out = value(await recall({ text: 'database' }, reader({ reranker: rr, spend: { reserve: () => true }, stopped: () => true })));
    expect(out.manifest.rerank).toBe('stopped'); expect(rr.calls).toHaveLength(0);
    expect(out.hits[0]!.exchange.messageId).toBe('c1');
  });

  it('a failing or malformed reranker never loses the lexical result', async () => {
    const { reader } = loaded(); const spend = { reserve: () => true };
    for (const rerank of [() => { throw new Error('provider down'); }, async () => ({ kind: 'Success', value: [99] }) as never,
      () => ({ kind: 'Success', value: [0, 0] }) as never]) {
      const out = value(await recall({ text: 'staging deploy' }, reader({ reranker: { id: 'bad', chargePerCall: 1, rerank }, spend })));
      expect(out.manifest.rerank).toBe('failed'); expect(out.hits[0]!.exchange.messageId).toBe('c1');
    }
  });

  it('bounds: scan only the most recent maxScan, return at most maxResults, rerank at most maxRerankCandidates', async () => {
    const { reader } = loaded();
    // c1/c2 are the two oldest; a scan of the newest 14 cannot see them.
    const narrow = value(await recall({ text: 'staging migration', bounds: { maxScan: 14 } }, reader()));
    expect(narrow.manifest.scanned).toBe(14); expect(narrow.hits).toHaveLength(0);
    expect(value(await recall({ text: 'Justin', bounds: { maxResults: 2 } }, reader())).hits).toHaveLength(2);
    const rr = conceptReranker();
    await recall({ text: 'kid', bounds: { maxRerankCandidates: 5 } }, reader({ reranker: rr, spend: { reserve: () => true } }));
    expect(rr.calls[0]).toHaveLength(5);
    refused(await recall({ text: 'x', bounds: { maxScan: 10_000_000 } }, reader()), 'maxScan');
    refused(await recall({ text: 'x'.repeat(5000) }, reader()), 'query');
  });

  it('excludes the message being answered, by (conversation, messageId)', async () => {
    const { reader } = loaded();
    const c8 = corpus.find(c => c.id === 'c8')!;
    expect(ids(await recall({ text: 'hero image lighthouse', exclude: [{ conversation: c8.conversation, messageId: 'c8' }] }, reader()))).not.toContain('c8');
    refused(await recall({ text: 'x', exclude: ['c8'] as never }, reader()), 'exclude');
  });

  it('an exclusion in one conversation never hides the same provider id in another conversation', async () => {
    const r = recallFixture(); const w = r.writer(r.memoryStorage());
    value(captureExchange(r.exchange({ conversation: 'telegram:-100:A', messageId: '42', text: 'the Lisbon talk is on Friday' }), r.at(1000), w));
    value(captureExchange(r.exchange({ conversation: 'telegram:-100:B', messageId: '42', text: 'when is the Lisbon talk?' }), r.at(2000), w));
    const reader: RecallReader = { context: r.fx.c, store: w.store, stopped: () => false };
    const out = value(await recall({ text: 'Lisbon talk', exclude: [{ conversation: 'telegram:-100:B', messageId: '42' }] }, reader));
    expect(out.hits.map(h => h.exchange.conversation)).toEqual(['telegram:-100:A']);
  });

  it('secrets floor: the query and candidate metadata reach the reranker redacted', async () => {
    const r = recallFixture(); const w = r.writer(r.memoryStorage());
    value(captureExchange(r.exchange({ messageId: 'n1', speakerName: 'bot xoxb-1234567890-abcdefghij', text: 'deploy at noon' }), r.at(1000), w));
    const seen: string[] = [];
    const rr: RecallRerankPort = { id: 'spy', chargePerCall: 1, rerank(query, candidates) {
      seen.push(query, ...candidates); return { kind: 'Success', value: [0] } as never; } };
    const secret = 'sk-ant-' + 'k'.repeat(30);
    const out = value(await recall({ text: `deploy ${secret}` }, { context: r.fx.c, store: w.store, stopped: () => false, reranker: rr, spend: { reserve: () => true } }));
    expect(out.manifest.rerank).toBe('used');
    expect(seen.join(' ')).not.toContain(secret); expect(seen.join(' ')).not.toContain('abcdefghij');
    expect(seen[0]).toContain('deploy');
  });

  it('newer exchange wins an exact tie', async () => {
    const r = recallFixture(); const w = r.writer(r.memoryStorage());
    value(captureExchange(r.exchange({ messageId: 'old', text: 'the gate code is blue' }), r.at(1000), w));
    value(captureExchange(r.exchange({ messageId: 'new', text: 'the gate code is blue' }), r.at(2000), w));
    expect(ids(await recall({ text: 'gate code' }, { context: r.fx.c, store: w.store, stopped: () => false }))).toEqual(['new', 'old']);
  });
});
