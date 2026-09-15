import assert from './assertions.mjs';
import { privateKey } from '../../facts/fixtures.ts';
import { signEnvelope, prepareSnapshot } from '../../../src/facts/index.js';
import { settlementMatches, checkApplicationEvidence, accounting } from '../../../src/transport/settlement.js';
import { settledFixture, value, enc, status, consumeResult } from './rereview-helpers.mjs';

// F5 — a provider settlement's charge/retained-exposure must equal what its referenced
// Nine assessment supports, at BOTH the live matcher (Six) and the historical accounting
// boundary. The genuine settlement matches; a re-signed unwitnessed zero charge does not.
export function registerCases(test) {
  test('V45', 'Six live matcher refuses provider charge unsupported by referenced Nine assessment', async () => {
    const { http, f, s } = await settledFixture(true);
    try {
      const all = f.all(), sf = all.find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      const changed = signEnvelope({ ...sf, body: { ...sf.body, record: { ...sf.body.record, finalCharge: '0', retainedExposure: 0 } } }, privateKey);
      const ctx = { ...f.context, facts: all.slice(0, all.findIndex(x => x.id === sf.id)).concat(changed) };
      assert.equal(settlementMatches(s, sf, { ...f.context, facts: all }), true);
      // The unwitnessed-charge fact is rejected by Eight's owner decoder (delegating the
      // Nine-support check), so Six's live matcher THROWS rather than silently matching.
      assert.throws(() => settlementMatches({ ...s, finalCharge: 0, retainedExposure: 0 }, changed, ctx));
    } finally { await http.close(); }
  });
  test('V46', 'Six historical accounting refuses provider charge unsupported by referenced Nine assessment', async () => {
    const { http, f, s } = await settledFixture(true);
    try {
      const all = f.all(), sf = all.find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      const rows = value(f.six.inspect()), application = rows.find(r => r.record.type === 'SettlementApplication').record;
      const op = rows.find(r => r.fact.id === s.reservation).record;
      const changed = signEnvelope({ ...sf, body: { ...sf.body, record: { ...sf.body.record, finalCharge: '0', retainedExposure: 0 } } }, privateKey);
      const ctx = { ...f.context, facts: all.slice(0, all.findIndex(x => x.id === sf.id)).concat(changed) };
      assert.doesNotThrow(() => checkApplicationEvidence(application, all, rows, { ...f.context, facts: all }));
      const altered = { ...application, settlementHash: changed.contentHash, ...accounting({ ...s, finalCharge: 0, retainedExposure: 0 }, op) };
      assert.throws(() => checkApplicationEvidence(altered, ctx.facts, rows, ctx));
    } finally { await http.close(); }
  });
  test('V58', 'recomputed settlement identity does not allow unwitnessed zero charge', async () => {
    const { http, f, s } = await settledFixture(true);
    try {
      const all = f.all(), sf = all.find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      const { type, schemaVersion, id, ...fields } = { ...s, finalCharge: 0, retainedExposure: 0 };
      const changedValue = { type, schemaVersion, id: `settlement:${enc(fields).hash}`, ...fields };
      const changed = signEnvelope({ ...sf, body: { ...sf.body, record: { ...sf.body.record, id: changedValue.id, finalCharge: '0', retainedExposure: 0 } } }, privateKey);
      const before = all.slice(0, all.findIndex(x => x.id === sf.id));
      const ctx = { ...f.context, facts: before.concat(changed) };
      // Even with a recomputed content-derived id, the unwitnessed zero charge does not
      // decode clean (Eight's Nine-support check taints it) and Six's matcher refuses it
      // (throws rather than matching) — an id-checksum-only patch would be insufficient.
      const checked = value(prepareSnapshot([changed], { ...f.context, facts: before })).entries[0];
      assert.ok(checked.taint.length || checked.conflicts.length, 're-signed changed charge decoded clean');
      assert.throws(() => settlementMatches(changedValue, changed, ctx));
    } finally { await http.close(); }
  });
  test('V59', 'historical accounting rejects zero charge even with fresh matching settlement identity', async () => {
    const { http, f, s } = await settledFixture(true);
    try {
      const all = f.all(), sf = all.find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      const rows = value(f.six.inspect()), app = rows.find(r => r.record.type === 'SettlementApplication').record;
      const op = rows.find(r => r.fact.id === s.reservation).record;
      const { type, schemaVersion, id, ...fields } = { ...s, finalCharge: 0, retainedExposure: 0 };
      const changedValue = { type, schemaVersion, id: `settlement:${enc(fields).hash}`, ...fields };
      const changed = signEnvelope({ ...sf, body: { ...sf.body, record: { ...sf.body.record, id: changedValue.id, finalCharge: '0', retainedExposure: 0 } } }, privateKey);
      const ctx = { ...f.context, facts: all.slice(0, all.findIndex(x => x.id === sf.id)).concat(changed) };
      const altered = { ...app, settlement: changedValue.id, settlementHash: changed.contentHash, ...accounting(changedValue, op) };
      assert.throws(() => checkApplicationEvidence(altered, ctx.facts, rows, ctx));
    } finally { await http.close(); }
  });
  test('V60', 'public Six accounting still refuses a caller-fabricated settlement handle', async () => {
    const { http, f, s } = await settledFixture(true);
    try {
      const all = f.all(), sf = all.find(x => x.kind === 'effect-provider-ProviderEffectSettlement');
      const { type, schemaVersion, id, ...fields } = { ...s, finalCharge: 0, retainedExposure: 0 };
      const changedValue = { type, schemaVersion, id: `settlement:${enc(fields).hash}`, ...fields };
      const before = f.all().filter(x => x.kind === 'transport-SettlementApplication').length;
      const r = status(f.six.settle(f.fence, changedValue));
      assert.equal(r.kind, 'Refused');
      assert.equal(f.all().filter(x => x.kind === 'transport-SettlementApplication').length, before);
    } finally { await http.close(); }
  });
}
