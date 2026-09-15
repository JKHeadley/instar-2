import assert from './assertions.mjs';
import { settledFixture, value, status } from './rereview-helpers.mjs';

// F7 — Five may consume the provider answer only after the granted transition order
// (5.7 Six accounting → 5.8 Seven resolution). The consumer must refuse the
// missing-prerequisite neighbors and accept only the fully ordered path.
export function registerCases(test) {
  test('V62', 'Five provider acceptance requires actual Six accounting before advancement', async () => {
    const { http, f, s } = await settledFixture(false);
    try {
      const sf = f.all().find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      assert.equal(f.all().filter(x => x.kind === 'transport-SettlementApplication').length, 0);
      assert.equal(f.all().filter(x => x.kind === 'judgment-provider-ProviderJudgmentResolution').length, 0);
      const before = value(f.graph.read(f.id)).pending.length;
      const r = status(f.accept(s, sf.id));
      assert.equal(r.kind, 'Refused', JSON.stringify(r));
      assert.equal(value(f.graph.read(f.id)).pending.length, before);
      assert.equal(f.all().filter(x => x.kind === 'transport-SettlementApplication').length, 0);
    } finally { await http.close(); }
  });
  test('V63', 'Provider run consumption requires Seven resolution after Six accounting', async () => {
    const { http, f, s } = await settledFixture(false);
    try {
      value(f.six.settle(f.fence, s));
      const sf = f.all().find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      const step = value(f.graph.read(f.id)).pending[0];
      assert.equal(f.all().filter(x => x.kind === 'judgment-provider-ProviderJudgmentResolution').length, 0);
      const r = status(f.api.readRunSettlement({ owner: 'part-two', name: 'FactEnvelope', id: sf.id }, step));
      assert.equal(r.kind, 'Refused', JSON.stringify(r));
    } finally { await http.close(); }
  });
  test('V64', 'Ordered accounting then resolution then Five acceptance succeeds', async () => {
    const { http, f, s, prepared } = await settledFixture(false);
    try {
      value(f.six.settle(f.fence, s));
      const answer = value(f.seven.resolve(prepared.request, s, f.fence));
      const accepted = value(f.accept(s, answer.resolution.id));
      assert.equal(accepted.pending.length, 0);
      assert.equal(f.calls(), 1);
    } finally { await http.close(); }
  });
}
