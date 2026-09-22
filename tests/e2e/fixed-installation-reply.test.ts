import { expect, it } from 'vitest';
import { createProviderEffectDoorway } from '../../src/effects/index.js';
import { createProviderResponseAssessmentPort } from '../../src/verification/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { providerFixture, value } from '../model-provider/fixture.js';
import { runProviderAnswerReplyScenario } from '../rungraph/provider-answer-reply.test.js';

it('P10-SI-17 P10-SI-18 P10-SI-24 P10-SI-37 rebuilds the same accepted reply without another model or reply operation', async () => {
  const first = await runProviderAnswerReplyScenario();
  const before = first.f.all();
  let modelCalls = 0;
  const rebuilt = providerFixture({ directory: first.f.directory, route: { invoke: async () => {
    modelCalls++; throw new Error('restart must not call the model');
  } } });
  const responseAssessment = createProviderResponseAssessmentPort(rebuilt.vh, rebuilt.runtime, rebuilt.store, rebuilt.seven);
  const effects = createProviderEffectDoorway({ ...rebuilt.dependencies, responseAssessment, plan: 'provider-response-plan' });
  const acceptance = { owner: 'part-seven' as const, name: 'ProviderAnswerAcceptance' as const, id: first.acceptance.id };
  const accepted = value(effects.consumeAcceptedProviderAnswer(acceptance, view => view));
  expect(accepted.answerDigest).toBe(first.accepted.answerDigest);
  expect(accepted.retainedExposure).toBe(first.accepted.retainedExposure);

  const graph = value(createRunGraph({ ...rebuilt.deps, acceptedAnswer: effects }));
  rebuilt.time(1000);
  rebuilt.stop();
  const recovered = value(graph.openAcceptedProviderReply({ ...first.replyInput, acceptance, reply: first.reply }));
  expect(recovered.run.id).toBe(first.reply.id);
  expect(modelCalls).toBe(0);
  const after = rebuilt.all();
  for (const kind of ['verification-VerificationAssessment', 'judgment-provider-ProviderAnswerAcceptance', 'run-opening'])
    expect(after.filter((fact: FactEnvelope) => fact.kind === kind)).toHaveLength(
      before.filter((fact: FactEnvelope) => fact.kind === kind).length);
  expect(after.filter((fact: FactEnvelope) => fact.kind === 'effect-provider-ProviderEffectRequest')).toHaveLength(
    before.filter((fact: FactEnvelope) => fact.kind === 'effect-provider-ProviderEffectRequest').length);
});
