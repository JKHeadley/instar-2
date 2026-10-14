import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { measuredCorpus } from './read-fixture.js';
import { recall, readExchange } from '../../src/recall/index.js';
import { rebuildConversationReadView } from '../../src/recall/read-view.js';

async function measure(fn: () => unknown | Promise<unknown>) {
  await fn(); const times: number[] = [];
  for (let i = 0; i < 7; i++) { const start = performance.now(); await fn(); times.push(performance.now() - start); }
  return Number(times.sort((a, b) => a - b)[3]!.toFixed(3));
}
// Normal gates exercise the measurement path on 200 facts. The deliberate 20k measurement
// is opt-in and runs on the assigned builder host, never the serving/gate host.
it('measures and compares whole-scan and indexed recorded-message reads', async () => {
  for (const size of process.env.INSTAR_RECORD_BENCHMARK === '1' ? [2000, 20_000] : [200]) {
    const { r, facts, store } = await measuredCorpus(size);
    let reads = 0;
    const source = { ...store, read: () => { reads++; return store.read(); } };
    const reader = { context: r.fx.c, store: source, stopped: () => false };
    const latest = () => value(source.read()).map((f, order) => ({ e: readExchange(f), order }))
      .filter(row => row.e?.conversation === 'conversation-1')
      .sort((a, b) => b.e!.at - a.e!.at || b.order - a.order).slice(0, 20).map(row => row.e);
    // The synthetic corpus contains conversation messages, not fabricated run/commitment state.
    // This times the empty open-run lookup. Nonempty owner replay is tested in rungraph/read-view.
    const open = () => value(source.read()).filter(f => f.kind === 'run-opening');
    expect(open()).toEqual([]);
    const query = { text: 'Portland weather', bounds: { maxScan: 500 } };
    const before = { latestMs: await measure(latest), openWorkEmptyMs: await measure(open),
      recallMs: await measure(() => recall(query, reader)) };
    const start = performance.now();
    const index = value(rebuildConversationReadView(source, r.fx.c, {
      fold: rows => r.fx.success(rows.filter(f => f.kind === 'run-opening')),
      conversation: () => 'conversation-1',
    }));
    const rebuildMs = Number((performance.now() - start).toFixed(3));
    expect(value(index.latest('conversation-1', 20))).toEqual(latest());
    expect(index.work('conversation-1')).toEqual(open());
    expect(value(await recall(query, { ...reader, index }))).toEqual(value(await recall(query, reader)));
    const atReads = reads;
    const after = { latestMs: await measure(() => index.latest('conversation-1', 20)),
      openWorkEmptyMs: await measure(() => index.work('conversation-1')),
      recallMs: await measure(() => recall(query, { ...reader, index })) };
    expect(reads).toBe(atReads);
    console.log(JSON.stringify({ facts: facts.length, samples: 7, statistic: 'median-ms', maxScan: 500,
      before, after, rebuildMs, hotSourceReads: reads - atReads }));
  }
}, 240_000);
