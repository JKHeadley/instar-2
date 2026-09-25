import { factsFixture, privateKey } from '../facts/fixtures.js';
import { createFactStore } from '../../src/facts/index.js';
import type { FactContext, SegmentStoragePort } from '../../src/facts/index.js';
import { recallExchangeSchema } from '../../src/recall/index.js';
import type { ExchangeInput, RecallWriter } from '../../src/recall/index.js';

/** A part-two fact context with the recall schema installed, over any segment storage. */
export function recallFixture() {
  const fx = factsFixture();
  const context: FactContext = { ...fx.ctx, schemas: [recallExchangeSchema(fx.scope)] };
  function memoryStorage(): SegmentStoragePort & { rows: string[] } {
    const rows: string[] = [];
    return { owner: 'part-ten', rows, read: () => rows.map(r => JSON.parse(r) as unknown),
      append: (bytes, head) => {
        const last = rows.at(-1);
        if ((last ? (JSON.parse(last) as { contentHash: string }).contentHash : null) !== head) throw new Error('compare-head failed');
        rows.push(bytes); return fx.success({ kind: 'local-durable' as const });
      } };
  }
  function writer(storage: SegmentStoragePort, machine = 'machine-a'): RecallWriter {
    return { context, store: createFactStore(context, storage), machine, privateKey,
      principal: fx.alice, provenance: fx.alice.provenance };
  }
  const exchange = (overrides: Partial<ExchangeInput> = {}): ExchangeInput => ({
    conversation: 'telegram:-100:42', session: 'session-a', messageId: 'm1', speakerId: 'justin', speakerName: 'Justin',
    speakerRole: 'user', text: 'hello', visibility: 'participants', audience: ['justin'], ...overrides });
  const at = (ms: number) => fx.clockRaw(ms);
  return { fx, context, memoryStorage, writer, exchange, at };
}
