// Round-4 re-review regressions (V25-V64). Faithful ports of the reviewer's
// signed-record mutation cases (astra rereview1 d79f946c). Each proves the new
// signed-record decoders/consumers re-resolve copied fields against their owner
// records instead of trusting them. Add-only; every case builds its own fixture.
import { providerFixture, value, enc } from '../fixture.ts';
import { localProvider } from '../http-provider.ts';
import { consumeResult, consumeOutcome } from '../../../src/index.js';
export { providerFixture, value, enc, localProvider, consumeResult, consumeOutcome };
export const status = r => consumeResult(r, { Success: v => ({ kind: 'Success', value: v }), Refused: r => ({ kind: 'Refused', detail: r.detail }) });
export const raw = f => f.body.record;
export const settlements = f => f.all().filter(x => x.kind === 'effect-provider-ProviderEffectSettlement').length;
// Build a fully-settled provider history: dispatch once, prove occurrence/charge/
// quiescence, assess and settle. With resolve, also apply Six accounting and record
// Seven resolution. The caller closes http via the returned handle.
export async function settledFixture(resolve = false) {
  const http = await localProvider();
  const f = providerFixture(http);
  http.respond({ state: 'complete', bytes: JSON.stringify(f.decisionInput()), providerOperation: 'rereview',
    usage: { inputTokens: 1, outputTokens: 1, charge: 3, source: 'http' }, retryBlocked: false });
  const { prepared, request } = f.prepare();
  const o = value(await f.api.dispatch(request, f.fence));
  for (const p of ['operation-occurred', 'charge-settled', 'old-executor-quiescent'])
    f.evidence(o.operation, request.digest, p, p === 'charge-settled' ? 3 : undefined);
  const a = value(f.api.assess(o.operation));
  const s = value(f.api.settle(o.operation, a));
  if (resolve) { value(f.six.settle(f.fence, s)); value(f.seven.resolve(prepared.request, s, f.fence)); }
  return { http, f, prepared, request, o, a, s };
}
