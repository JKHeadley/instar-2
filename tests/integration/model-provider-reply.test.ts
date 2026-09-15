import { expect, it } from 'vitest';
import { createEffectDoorway, createEffectSpine, decodeOutboundMessage, installOperationDefinition } from '../../src/effects/index.js';
import { json, privateKey } from '../facts/fixtures.js';
import { providerFixture, value, enc } from '../model-provider/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';

// @ts-expect-error Native assertion execution receipt.
import assert, { runAssertions } from '../model-provider/review/assertions.mjs';
it('MODEL-PROVIDER-PATH REVIEW F6 accepted judgment produces a separately settled ordinary reply', () => runAssertions('F6-reply', async () => {
  const http = await localProvider();
  try {
    const f = providerFixture(http);
    http.respond({ state: 'complete', bytes: JSON.stringify(f.decisionInput()), providerOperation: 'provider-before-reply',
      usage: { inputTokens: 1, outputTokens: 1, charge: 3, source: 'local HTTP' }, retryBlocked: false });
    const { request, prepared } = f.prepare();
    const observed = value(await f.api.dispatch(request, f.fence));
    for (const predicate of ['operation-occurred', 'charge-settled', 'old-executor-quiescent'])
      f.evidence(observed.operation, request.digest, predicate, predicate === 'charge-settled' ? 3 : undefined);
    const assessment = value(f.api.assess(observed.operation)), settlement = value(f.api.settle(observed.operation, assessment));
    value(f.six.settle(f.fence, settlement));
    const answer = value(f.seven.resolve(prepared.request, settlement, f.fence));
    const accepted = value(f.accept(settlement, answer.resolution.id));
    expect(accepted.pending).toHaveLength(0);

    const oldCurrent = f.host.current;
    const originalDefinition = oldCurrent().versions[0]!;
    const definition = { ...originalDefinition.content as object, id: 'ordinary-reply-definition', feature: 'ordinary-reply',
      version: 'ordinary-reply-v1', adapter: 'reply-route', account: 'test-reply-account', conversation: 'test-reply-conversation', maxCharge: 2 };
    const approval = f.authorize({ id: 'reply-approved', artifact: f.capture(enc(definition).bytes), base: 'reply-base' });
    const version = { ...originalDefinition, id: 'ordinary-reply-v1', subject: 'ordinary-reply', content: json(definition),
      contentHash: enc(definition).hash, approvedIn: approval, base: approval.base };
    f.host.current = () => ({ ...oldCurrent(), versions: [...oldCurrent().versions, version] });
    const spine = createEffectSpine(f.host, { context: f.context, privateKey }, f.store);
    const installed = value(installOperationDefinition(definition, f.host, spine));
    const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1, id: 'ordinary-reply-message',
      semanticMessage: 'ordinary-reply:1', run: f.id, speaker: f.host.principal.id, account: 'test-reply-account',
      conversation: 'test-reply-conversation', text: enc(answer.decision).bytes, purpose: 'ordinary-reply', sourceResult: answer.resolution.id }, f.host));
    const ground = value(f.graph.ground(f.id, 'w', 'h', 'resume', f.lease));
    const start = f.start(accepted, ground, message.semanticMessage);
    const running = value(f.graph.transition({ ...start, step: { ...start.step, operation: { ...start.step.operation, digest: enc(message).hash } } }));
    const pending = f.all().find(fact => fact.kind === 'run-transition' && (fact.body as { record: { id: string } }).record.id === running.head)!;
    const deliveries: string[] = [];
    const reply = createEffectDoorway({ host: f.host, spine, transport: f.six, durability: f.dependencies.durability,
      custody: f.dependencies.custody, assessment: null, adapter: { owner: 'part-ten', id: 'reply-route',
        describe: () => ({ contract: 'local-reply-test', account: message.account, conversation: message.conversation,
          maxCharge: 2, timeout: 100, hiddenRetries: 0 }),
        invoke: input => { deliveries.push(input.message.text); return f.success(JSON.stringify({ delivered: true, id: 'reply-receipt' })); },
        observe: () => f.success('unknown') } });
    const q = value(reply.prepare({ definition: installed.id, message, run: f.question.run, pending: pending.id,
      attempt: 'reply-attempt:1', verificationOwner: 'independent-probe', obligation: request.obligation,
      closure: [answer.resolution.id], fence: f.fence }));
    const o = value(reply.dispatch(q, f.fence));
    for (const predicate of ['operation-occurred', 'charge-settled', 'old-executor-quiescent'])
      f.evidence(o.operation, q.digest, predicate, predicate === 'charge-settled' ? 1 : undefined);
    const a = value(f.api.assess(o.operation)), s = value(f.api.settle(o.operation, a));
    expect(value(f.six.settle(f.fence, s))).toMatchObject({ actualCharge: 1, released: 1, unresolved: 0 });
    expect([q.id, q.attempt, o.operation, o.claim, o.id, a.id, s.id].every((id, i) => id !==
      [request.id, request.attempt, observed.operation, observed.claim, observed.id, assessment.id, settlement.id][i])).toBe(true);
    assert.notEqual(q.id, request.id); assert.notEqual(o.claim, observed.claim);
    assert.notEqual(a.id, assessment.id); assert.notEqual(s.id, settlement.id);
    assert.equal(deliveries.length, 1);
    expect(deliveries).toEqual([enc(answer.decision).bytes]);
    expect(http.requests).toHaveLength(1);
    expect(f.all().filter(fact => fact.kind === 'effect-EffectSettlement')).toHaveLength(1);
    expect(f.all().filter(fact => fact.kind === 'effect-provider-ProviderEffectSettlement')).toHaveLength(1);
    expect(f.all().filter(fact => fact.kind === 'transport-SettlementApplication')).toHaveLength(2);
  } finally { await http.close(); }
}), 180000);
