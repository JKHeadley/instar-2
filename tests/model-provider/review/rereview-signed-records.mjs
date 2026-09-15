import assert from './assertions.mjs';
import { privateKey } from '../../facts/fixtures.ts';
import { signEnvelope, prepareSnapshot } from '../../../src/facts/index.js';
import { settledFixture, value } from './rereview-helpers.mjs';

// A signed record whose copied field disagrees with the owner record it references
// must decode tainted/conflicted. Each case signs exactly one altered field onto an
// otherwise genuine settled history and re-decodes it against the real prior facts.
function mutationCase(test, id, kind, field, pick, change, { resolve = false } = {}) {
  test(id, kind + ' rejects signed mismatched ' + field, async () => {
    const { http, f, request, s } = await settledFixture(resolve);
    try {
      const all = f.all();
      const sf = all.find(x => x.kind === kind && pick(x));
      assert.ok(sf, 'fixture missing ' + kind + ' (' + field + ')');
      const ctx = { ...f.context, facts: all.slice(0, all.findIndex(x => x.id === sf.id)) };
      const baseline = value(prepareSnapshot([sf], ctx)).entries[0];
      assert.equal(baseline.taint.length, 0, 'positive control fixture must decode clean');
      const changed = signEnvelope({ ...sf, body: { ...sf.body, record: change(sf.body.record, { f, request, s }) } }, privateKey);
      const entry = value(prepareSnapshot([changed], ctx)).entries[0];
      const detail = JSON.stringify({ taint: entry.taint, conflicts: entry.conflicts, record: changed.body.record });
      assert.ok(entry.taint.length > 0 || entry.conflicts.length > 0, 'inconsistent signed record decoded clean: ' + detail);
      return detail;
    } finally { await http.close(); }
  });
}
const anyPhase = () => true;
const responseObservation = x => x.body.record.stage === 'response';
const responseAttempt = x => x.body.record.phase === 'response-observed';

export function registerCases(test) {
  const R = 'effect-provider-ProviderEffectRequest', O = 'effect-provider-ProviderOperationObservation';
  const A = 'judgment-provider-ProviderJudgmentAttemptRecord', S = 'effect-provider-ProviderEffectSettlement';
  const JR = 'judgment-provider-ProviderJudgmentRequest', JRes = 'judgment-provider-ProviderJudgmentResolution';
  const payload = v => (r, ctx) => ({ ...r, payload: { ...r.payload, ...v(ctx) } });
  const set = v => (r, ctx) => ({ ...r, ...v(ctx) });
  // F1 — Eight provider request payload fields must equal Seven's preparation.
  mutationCase(test, 'V25', R, 'payload.model', anyPhase, payload(() => ({ model: 'foreign-model' })));
  mutationCase(test, 'V26', R, 'payload.settingsDigest', anyPhase, payload(() => ({ settingsDigest: 'foreign-settings' })));
  mutationCase(test, 'V27', R, 'payload.submitted', anyPhase, payload(({ request }) => ({ submitted: { reference: 'missing:submission', hash: request.payload.submitted.hash } })));
  mutationCase(test, 'V28', R, 'payload.maxCharge', anyPhase, payload(() => ({ maxCharge: 19 })));
  mutationCase(test, 'V29', R, 'payload.request', anyPhase, payload(({ request }) => ({ request: { ...request.payload.request, owner: 'part-nine' } })));
  mutationCase(test, 'V30', R, 'payload.definition', anyPhase, payload(() => ({ definition: 'foreign-definition' })));
  // F4 — Eight observation account/destination/capture/stage must equal request + receipt.
  mutationCase(test, 'V31', O, 'account', responseObservation, set(() => ({ account: 'foreign-account' })));
  mutationCase(test, 'V32', O, 'conversation', responseObservation, set(() => ({ conversation: 'foreign-destination' })));
  mutationCase(test, 'V33', O, 'capture', responseObservation, set(({ request }) => ({ capture: request.payload.submitted })));
  mutationCase(test, 'V34', O, 'stage', responseObservation, set(() => ({ stage: 'invented-stage' })));
  // F3 — Seven receipt (attempt record) references must resolve by kind.
  mutationCase(test, 'V35', A, 'submittedDigest', responseAttempt, set(() => ({ submittedDigest: 'foreign-digest' })));
  mutationCase(test, 'V36', A, 'observation', responseAttempt, set(({ f }) => ({ observation: f.opening.id })));
  mutationCase(test, 'V37', A, 'claim', responseAttempt, set(({ f }) => ({ claim: f.opening.id })));
  mutationCase(test, 'V38', A, 'phase', responseAttempt, set(() => ({ phase: 'invented-phase' })));
  // F5 — Eight settlement amount/outcome must agree with Nine's assessment.
  mutationCase(test, 'V39', S, 'finalCharge', anyPhase, set(() => ({ finalCharge: '0' })));
  mutationCase(test, 'V40', S, 'retainedExposure', anyPhase, set(() => ({ retainedExposure: 0 })));
  mutationCase(test, 'V41', S, 'delayedExecutionExcluded', anyPhase, set(() => ({ delayedExecutionExcluded: false })));
  mutationCase(test, 'V42', S, 'outcome', anyPhase, set(({ s }) => ({ outcome: { ...s.outcome, kind: 'did-not-happen' } })));
  // F2 — Seven request fields must equal the captured submission + pending transition.
  mutationCase(test, 'V47', JR, 'model', anyPhase, set(() => ({ model: 'foreign-model' })));
  mutationCase(test, 'V48', JR, 'point', anyPhase, set(() => ({ point: 'foreign-point' })));
  mutationCase(test, 'V49', JR, 'predecessor', anyPhase, set(() => ({ predecessor: 'missing' })));
  mutationCase(test, 'V50', JR, 'run', anyPhase, set(() => ({ run: 'foreign-run' })));
  mutationCase(test, 'V51', JR, 'maxCharge', anyPhase, set(() => ({ maxCharge: -1 })));
  mutationCase(test, 'V52', JR, 'evidence', anyPhase, set(() => ({ evidence: ['missing-evidence'] })));
  // F3 — Seven resolution references must resolve by kind.
  mutationCase(test, 'V53', JRes, 'response', anyPhase, set(() => ({ response: 'missing-response' })), { resolve: true });
  mutationCase(test, 'V54', JRes, 'settlement', anyPhase, set(({ f }) => ({ settlement: f.opening.id })), { resolve: true });
  mutationCase(test, 'V55', JRes, 'accounting', anyPhase, set(() => ({ accounting: 'missing-accounting' })), { resolve: true });
}
