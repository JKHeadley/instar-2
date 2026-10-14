import { readFileSync } from 'node:fs';
import { value } from '../fixtures.js';
import { recallFixture } from './fixture.js';
import { captureExchange } from '../../src/recall/index.js';
import { createFactStore } from '../../src/facts/index.js';
// Repeated recorded message shapes; unit-test signing identity, real fact-store verification.
// Memory storage is not advertised as disk durability.
function source(size: number) {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/record-read-messages.json', import.meta.url), 'utf8')) as {
    messages: { text: string; at: number; update: number }[] };
  const r = recallFixture(), storage = r.memoryStorage(), writer = r.writer(storage);
  value(captureExchange(r.exchange(), r.at(1000), writer));
  const seed = value(writer.store.read())[0]!;
  let last: { id: string; contentHash: string } | undefined;
  const raw = Array.from({ length: size }, (_, i) => {
    const message = fixture.messages[i % fixture.messages.length]!;
    const row = r.fx.wire({ kind: 'recall-exchange', at: r.at(message.at + i),
      segment: { machine: 'machine-a', epoch: 0, position: i },
      prevInSegment: last?.contentHash ?? r.context.genesis.hash,
      predecessors: { inSegment: last?.id ?? null, frontier: {}, required: [] },
      body: { ...(seed.body as object), text: message.text, conversation: `conversation-${i % 100}`,
        messageId: `recorded-${message.update}-${i}` } }, r.context);
    last = row as { id: string; contentHash: string };
    return value(r.fx.success(row));
  });
  let through = raw.length;
  const store = createFactStore(r.context, { owner: 'part-ten', read: () => through === raw.length ? raw : raw.slice(0, through),
    append: () => { throw new Error('benchmark is read only'); } });
  return { r, raw, setThrough: (n: number) => { through = n; }, store, reader: { context: r.fx.c, store, stopped: () => false } };
}

export function corpus(size: number) {
  const data = source(size);
  return { ...data, facts: value(data.store.read()) };
}
/** Yield between verification batches so the test reporter can acknowledge its RPCs. */
export async function measuredCorpus(size: number) {
  const data = source(size);
  for (let n = 1000; n < size; n += 1000) {
    data.setThrough(n); value(data.store.read());
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  data.setThrough(size);
  return { ...data, facts: value(data.store.read()) };
}
