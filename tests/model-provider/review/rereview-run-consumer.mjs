import assert from './assertions.mjs';
import { privateKey } from '../../facts/fixtures.ts';
import { signEnvelope } from '../../../src/facts/index.js';
import { settledFixture, value, enc, status } from './rereview-helpers.mjs';

// F5/F7 — the public run-settlement consumer must not return a fact whose recorded
// outcome disagrees with the Nine assessment it references. A re-signed settlement
// carrying 'did-not-happen' over an assessment that supports 'happened' must refuse.
export function registerCases(test) {
  test('V61', 'Run settlement consumption refuses a signed reference with different recorded outcome', async () => {
    const { http, f, s } = await settledFixture(true);
    try {
      const ref = id => ({ owner: 'part-two', name: 'FactEnvelope', id });
      const original = f.all().find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      const step = value(f.graph.read(f.id)).pending[0];
      const clean = value(f.api.readRunSettlement(ref(original.id), step));
      assert.equal(clean.record.id, original.id);
      const { id, type, schemaVersion, ...fields } = { ...s, outcome: { ...s.outcome, kind: 'did-not-happen' } };
      const changedRecord = { ...original.body.record, id: `settlement:${enc(fields).hash}`, outcome: fields.outcome };
      const last = f.all().at(-1), segment = { ...last.segment, position: last.segment.position + 1 };
      const changed = signEnvelope({ ...original, id: `${segment.machine}:${segment.epoch}:${segment.position}`, segment,
        prevInSegment: last.contentHash, predecessors: { ...original.predecessors, inSegment: last.id },
        body: { ...original.body, record: changedRecord, outcome: fields.outcome } }, privateKey);
      const before = f.all().filter(x => x.kind === 'effect-provider-ProviderEffectSettlement').length;
      // The store may refuse the inconsistent settlement outright (its charge/outcome is
      // not supported by the referenced Nine assessment); if it lands anyway, the run
      // consumer must STILL refuse it rather than return the wrong recorded outcome.
      const appended = status(f.store.append(changed, { peer: 'machine-a' }));
      const r = status(f.api.readRunSettlement(ref(changed.id), step));
      assert.equal(r.kind, 'Refused', JSON.stringify({ appended, r }));
    } finally { await http.close(); }
  });
}
