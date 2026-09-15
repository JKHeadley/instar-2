import { expect, it } from 'vitest';
import { createProviderEffectDoorway } from '../../src/effects/provider-api.js';
import { providerFixture, value, refused } from '../model-provider/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';

it('provider consumed-request refusal avoids preparation reads; copied requests and fresh doorways still refuse durably', async () => {
  const http = await localProvider();
  try {
    const f = providerFixture(http), { request } = f.prepare();
    let reads = 0;
    const dependencies = { ...f.dependencies, judgment: { ...f.seven,
      readPrepared: (...args: Parameters<typeof f.seven.readPrepared>) => { reads++; return f.seven.readPrepared(...args); } } };
    const api = createProviderEffectDoorway(dependencies);
    value(await api.dispatch(request, f.fence));
    expect(reads).toBeGreaterThan(0);
    reads = 0;
    refused(await api.dispatch(request, f.fence));
    expect(reads).toBe(0);
    expect(http.requests).toHaveLength(1);
    // Discarding process-local acceleration cannot resurrect a consumed claim.
    refused(await api.dispatch({ ...request }, f.fence));
    expect(reads).toBeGreaterThan(0);
    reads = 0;
    refused(await createProviderEffectDoorway(dependencies).dispatch(request, f.fence));
    expect(reads).toBeGreaterThan(0);
    expect(http.requests).toHaveLength(1);
    expect(f.all().filter(fact => fact.kind === 'transport-AdmissionReservation'
      && (fact.body as { record: { state: string } }).record.state === 'consumed')).toHaveLength(1);
  } finally { await http.close(); }
}, 120000);
