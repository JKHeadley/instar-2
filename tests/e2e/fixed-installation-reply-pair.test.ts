import { afterEach, expect, it } from 'vitest';
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
import { createEffectDoorway, createEffectSpine, createProviderEffectDoorway } from '../../src/effects/index.js';
import { createProviderResponseAssessmentPort } from '../../src/verification/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { admitAcceptedProviderReply } from '../../src/transport/index.js';
import { pair, outbound } from '../transport/pair-fixture.js';
import { providerFixture } from '../model-provider/fixture.js';
import { value, refused, privateKey } from '../facts/fixtures.js';

it('P10-SI-17 P10-SI-18 P10-SI-24 P10-SI-37 SIX-PAIR T4 reconstructs the reply-owned outbound operation while provider work and exposure stay pending', async () => {
  const s = await pair(); value(s.admit());
  const send = outbound(s), request = value(send.prepare());
  const observation = value(send.api.dispatch(request, s.f.fence));
  const before = s.f.all();
  const pending = (value(s.f.graph.read(s.f.id)) as any).pending;
  expect(pending).toHaveLength(1);
  let models = 0, sends = 0;
  const f = providerFixture({ directory: s.f.directory, route: { invoke: async () => {
    models++; throw Error('restart must not call the model');
  } } });
  const responseAssessment = createProviderResponseAssessmentPort(f.vh, f.runtime, f.store, f.seven);
  const provider = createProviderEffectDoorway({ ...f.dependencies, responseAssessment, plan: 'provider-response-plan' });
  const graph = value(createRunGraph({ ...f.deps, acceptedAnswer: provider }));
  const recovered = value(graph.openAcceptedProviderReply(s.replyInput));
  expect(recovered.run.id).toBe(s.reply.id);
  value(admitAcceptedProviderReply(f.six, graph, 'pair:restart', f.fence, s.run, s.policy, f.host.boundary));
  const effect = createEffectDoorway({ host: f.host,
    spine: createEffectSpine(f.host, { context: f.context, privateKey }, f.store), transport: f.six,
    durability: f.dependencies.durability, custody: f.dependencies.custody, assessment: null,
    adapter: { owner: 'part-ten', id: 'route', describe: () => ({ contract: 'reply-route-v1', account: 'test-provider',
      conversation: 'local-test', maxCharge: 20, timeout: 100, hiddenRetries: 0 }),
    invoke: () => f.result(() => { sends++; throw Error('restart must not send again'); }),
    observe: () => f.result(() => JSON.stringify({ status: 'unknown' })) } });
  f.stop();
  expect(value(effect.dispatch(request, f.fence)).id).toBe(observation.id);
  expect(models).toBe(0); expect(sends).toBe(0); expect(send.calls()).toBe(1); expect(s.modelCalls()).toBe(1);
  expect(value(graph.read(f.id)).pending).toEqual(pending);
  refused(f.seven.prepare({ ...f.question, run: s.run }, f.fence));
  const after = f.all();
  for (const kind of ['run-opening', 'judgment-provider-ProviderAnswerAcceptance', 'effect-provider-ProviderEffectRequest',
    'transport-RunPairAdmission', 'transport-AdmissionReservation', 'effect-EffectRequest', 'effect-OperationObservation'])
    expect(after.filter(fact => fact.kind === kind)).toHaveLength(before.filter((fact: any) => fact.kind === kind).length);
  const rows = value(f.six.inspect());
  expect(rows.filter(row => row.record.type === 'SettlementApplication').at(-1)?.record)
    .toMatchObject({ unresolved: 1, exposure: 20, released: 0, actualCharge: -1 });
  expect(rows.filter(row => row.record.type === 'AdmissionReservation' && row.record.run === s.reply.id).at(-1)?.record)
    .toMatchObject({ state: 'consumed', request: request.id, charge: 20 });
}, 60_000);
