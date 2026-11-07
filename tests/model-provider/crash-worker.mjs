import { providerFixture, value } from './fixture.js';
const cut = process.env.PROVIDER_TEST_CUT ?? 'before-receipt';
let invoked = false;
const kill = point => {
  if (point !== cut) return;
  if (!invoked) throw new Error('crash cut requires an observed HTTP response');
  process.stdout.write(`provider-invoked ${point}\n`);
  process.kill(process.pid, 'SIGKILL');
};
const f = providerFixture({ directory: process.env.PROVIDER_TEST_DIRECTORY, endpoint: process.env.PROVIDER_TEST_ENDPOINT,
  credential: process.env.PROVIDER_TEST_CREDENTIAL, invocationTimeoutMs: 10000, timeout: Number(process.env.PROVIDER_TEST_HTTP_TIMEOUT ?? 10000),
  afterInvoke: () => { invoked = true; kill('before-receipt'); } });
const { request } = f.prepare();
const observation = value(await f.api.dispatch(request, f.fence));
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
