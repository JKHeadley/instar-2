import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { measuredCorpus } from './read-fixture.js';
import { recall, readExchange } from '../../src/recall/index.js';
import { rebuildConversationReadView } from '../../src/recall/read-view.js';
import { openRunWorkProjection } from '../../src/rungraph/read-view.js';
import { ref } from '../rungraph/fixtures.js';

async function measure(fn: () => unknown | Promise<unknown>, samples = 7) {
  if (samples > 1) await fn(); const times: number[] = [];
  for (let i = 0; i < samples; i++) { const start = performance.now(); await fn(); times.push(performance.now() - start); }
  return Number(times.sort((a, b) => a - b)[Math.floor(samples / 2)]!.toFixed(3));
}
// Normal gates exercise the measurement path on 200 facts. The deliberate 20k measurement
// is opt-in and runs on the assigned builder host, never the serving/gate host.
it('measures and compares whole-scan and indexed recorded-message reads', async () => {
  for (const size of process.env.INSTAR_RECORD_BENCHMARK === '1' ? [2000, 20_000] : [200]) {
    const coldStart = performance.now();
    console.log(JSON.stringify({ phase: 'verify-start', conversationFacts: size }));
    const { r, facts, store, context, runFixture } = await measuredCorpus(size);
    console.log(JSON.stringify({ phase: 'verify-finished', conversationFacts: size, ms: performance.now() - coldStart }));
    await new Promise<void>(resolve => setImmediate(resolve));
    let reads = 0;
    const source = { ...store, read: () => { reads++; return store.read(); } };
    const reader = { context: r.fx.c, store: source, stopped: () => false };
    const latest = () => value(source.read()).map((f, order) => ({ e: readExchange(f), order }))
      .filter(row => row.e?.conversation === 'conversation-1')
      .sort((a, b) => b.e!.at - a.e!.at || b.order - a.order).slice(0, 20).map(row => row.e);
    const f = runFixture!;
    const snapshotStart = performance.now();
    const snapshot = value(store.readForProjection());
    console.log(JSON.stringify({ phase: 'work-snapshot-finished', conversationFacts: size, ms: performance.now() - snapshotStart }));
    await new Promise<void>(resolve => setImmediate(resolve));
    const projection = openRunWorkProjection({ snapshot,
      generation: { reference: f.ctx.decode.register.generation, kinds: context.schemas.map(s => s.kind),
        lineages: { 'machine-a': { head: facts.at(-1)!.segment, observedAt: f.now.value, closed: false } } },
      context: { ...f.c, facts: { ...context, facts } }, now: f.now,
      witnesses: { verify: fact => f.deps.admission.verify(ref(fact)) }, conversation: () => 'conversation-1' });
    const open = () => value(projection.fold(value(source.read())));
    let openReference: ReturnType<typeof open> = [];
    const openSamples = size > 2000 ? 1 : 7;
    const query = { text: 'Portland weather', bounds: { maxScan: 500 } };
    const before = { latestMs: await measure(latest), openWorkMs: await measure(() => { openReference = open(); }, openSamples),
      recallMs: await measure(() => recall(query, reader)) };
    expect(openReference.map(work => work.state)).toEqual(['ready']);
    console.log(JSON.stringify({ phase: 'before-measured', conversationFacts: size, before }));
    await new Promise<void>(resolve => setImmediate(resolve));
    const start = performance.now();
    const index = value(rebuildConversationReadView(source, r.fx.c, projection));
    const rebuildMs = Number((performance.now() - start).toFixed(3));
    expect(value(index.latest('conversation-1', 20))).toEqual(latest());
    expect(index.work('conversation-1')).toEqual(openReference);
    expect(value(await recall(query, { ...reader, index }))).toEqual(value(await recall(query, reader)));
    const atReads = reads;
    const after = { latestMs: await measure(() => index.latest('conversation-1', 20)),
      openWorkMs: await measure(() => index.work('conversation-1')),
      recallMs: await measure(() => recall(query, { ...reader, index })) };
    expect(reads).toBe(atReads);
    console.log(JSON.stringify({ facts: facts.length, conversationFacts: size, openRuns: 1, samples: { latest: 7, recall: 7, openBefore: openSamples, openAfter: 7 }, statistic: 'median-ms', maxScan: 500,
      before, after, rebuildMs, hotSourceReads: reads - atReads }));
  }
}, process.env.INSTAR_RECORD_BENCHMARK === '1' ? 2_400_000 : 30_000);
