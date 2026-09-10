import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { decodeHistoricalBody } from '../../src/facts/index.js';
import { decodeOwnedBody } from '../../src/facts/owned.js';
import { decodeOutboundMessage } from '../../src/effects/index.js';
import type { Json } from '../../src/index.js';
import { effectFixture, value } from './fixture.js';

it('P8-TP-R7-LEGACY-ALL-RECORD-MUTATIONS preserves all 925 main decoder and lifecycle results byte-for-byte', () => {
  const f = effectFixture(), request = f.prepare(), observation = value(f.api.dispatch(request, f.fence));
  f.assess('happened', 3, true);
  const settlement = value(f.api.settle(observation.operation));
  const facts = value(f.store.read()), rows = value(f.api.inspect()), context = { ...f.ctx, facts };
  const output: Record<string, unknown> = { q: request, o: observation, s: settlement };
  for (const { record, fact } of rows) {
    const raw = (fact.body as { record: Record<string, unknown> }).record;
    const prefix = `${record.type}:${record.id}`;
    const run = (input: unknown): unknown => {
      try { return { ok: true, value: decodeOwnedBody('part-eight', record.type, input as Json, fact, 'historical', context) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : String(error) }; }
    };
    output[`${prefix}:valid`] = run(raw);
    output[`${prefix}:historical`] = decodeHistoricalBody(fact, context, context.decode);
    for (const key of Object.keys(raw)) {
      const missing = { ...raw }; delete missing[key];
      output[`${prefix}:missing:${key}`] = run(missing);
      output[`${prefix}:renamed:${key}`] = run({ ...missing, [`renamed_${key}`]: raw[key] });
      for (const mutation of [null, 0, false, [], {}, ''])
        output[`${prefix}:mut:${key}:${JSON.stringify(mutation)}`] = run({ ...raw, [key]: mutation });
    }
    output[`${prefix}:extra`] = run({ ...raw, extra: true });
  }
  const raw = f.message as unknown as Record<string, unknown>;
  for (const key of Object.keys(raw)) for (const mutation of [null, 0, false, [], {}, ''])
    output[`public:${key}:${JSON.stringify(mutation)}`] = decodeOutboundMessage({ ...raw, [key]: mutation }, f.host);
  const bytes = JSON.stringify(output, null, 2);
  expect(Object.keys(output)).toHaveLength(925);
  expect(Buffer.byteLength(bytes)).toBe(201438);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('5a02b796e777d5cad70348ccb6fc877d5d2e4858bc3bf6098c6ab6b047544dad');
  const settlementRow = rows.find(row => row.record.type === 'EffectSettlement')!;
  const settlementRaw = (settlementRow.fact.body as { record: Record<string, unknown> }).record;
  const [reference, captured] = Object.entries(context.captures)[0]!;
  expect(() => decodeOwnedBody('part-eight', 'EffectSettlement', { ...settlementRaw,
    evidenceCaptures: [{ reference, hash: captured.hash }],
  } as Json, settlementRow.fact, 'historical', context)).toThrow('missing or undeclared field');
});
