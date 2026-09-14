import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { consumeOutcome } from '../../src/index.js';
import { providerFixture, value, enc, refused } from '../model-provider/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';
it('P7-NF-09 P7-NF-10 P8-NF-21 P9-NF-04 MODEL-PROVIDER-PATH integration real owners settle original object-valued Evidence and accept once', async () => {
  const http = await localProvider();
  try {
    const f = providerFixture(http);
    http.respond({ state: 'complete', bytes: JSON.stringify(f.decisionInput()), providerOperation: 'test-operation:1',
      usage: { inputTokens: 11, outputTokens: 9, charge: 3, source: 'authenticated local provider receipt' }, retryBlocked: false });
    const { prepared, request } = f.prepare();
    const observed = value(await f.api.dispatch(request, f.fence));
    expect(http.requests).toHaveLength(1);
    expect(hashBytes(http.requests[0]!.bytes)).toBe(request.payload.submitted.hash);
    expect(enc(http.requests[0]!.bytes).hash).toBe(request.digest);
    const source = f.evidence(observed.operation, request.digest, 'operation-occurred');
    const original = enc(source).bytes;
    f.evidence(observed.operation, request.digest, 'charge-settled', 3);
    f.evidence(observed.operation, request.digest, 'old-executor-quiescent');
    const assessment = value(f.api.assess(observed.operation));
    const settlement = value(f.api.settle(observed.operation, assessment));
    expect(consumeOutcome(settlement.outcome, { happened: () => true, 'did-not-happen': () => false, uncertain: () => false })).toBe(true);
    expect(enc(source).bytes).toBe(original);
    const accounting = value(f.six.settle(f.fence, settlement));
    expect(accounting).toMatchObject({ actualCharge: 3, exposure: 3, released: 17, unresolved: 0, retryEligible: 0 });
    const answer = value(f.seven.resolve(prepared.request, settlement, f.fence));
    expect(value(f.accept(settlement, answer.resolution.id)).pending).toHaveLength(0);
    refused(await f.api.dispatch(request, f.fence));
    expect(http.requests).toHaveLength(1);
  } finally { await http.close(); }
}, 60000);
