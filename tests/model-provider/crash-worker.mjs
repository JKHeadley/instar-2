import { providerFixture, value } from './fixture.js';
const cut = process.env.PROVIDER_TEST_CUT ?? 'before-receipt';
const kill = point => { if (point === cut) { process.stdout.write(`provider-invoked ${point}\n`); process.kill(process.pid, 'SIGKILL'); } };
const f = providerFixture({ directory: process.env.PROVIDER_TEST_DIRECTORY, endpoint: process.env.PROVIDER_TEST_ENDPOINT,
  credential: process.env.PROVIDER_TEST_CREDENTIAL,
  // This proof cuts completed HTTP, not a timeout. Owner time is the fixture's
  // injected clock; a separate finite wall bound allows a slow host to deliver.
  route: { invoke: async (bytes, bounds) => {
    const response = await fetch(process.env.PROVIDER_TEST_ENDPOINT, { method: 'POST', body: bytes, redirect: 'error',
      headers: { Authorization: `Bearer ${process.env.PROVIDER_TEST_CREDENTIAL}`, 'Content-Type': 'application/json', 'X-Operation': bounds.operation },
      signal: AbortSignal.timeout(30_000) });
    const observation = await response.json();
    if (!response.ok || observation.state !== 'complete') throw new Error('crash fixture requires completed HTTP');
    completed = true;
    kill('before-receipt');
    return observation;
  } } });
let completed = false;
const { request } = f.prepare();
const observation = value(await f.api.dispatch(request, f.fence));
// Dispatch legitimately records UNKNOWN on transport failure. It is not evidence
// that this fixture reached a post-response crash boundary.
if (!completed) throw new Error('crash fixture did not complete HTTP');
kill('before-assessment');
f.evidence(observation.operation, request.digest, 'operation-occurred');
f.evidence(observation.operation, request.digest, 'charge-settled', 3);
f.evidence(observation.operation, request.digest, 'old-executor-quiescent');
const assessment = value(f.api.assess(observation.operation));
kill('before-settlement');
const settlement = value(f.api.settle(observation.operation, assessment));
kill('before-accounting');
value(f.six.settle(f.fence, settlement));
kill('before-five');
throw new Error('crash cut was not reached');
