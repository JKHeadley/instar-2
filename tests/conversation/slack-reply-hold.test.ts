import { expect, it } from 'vitest';
import { effectFixture, refused, value } from '../effects/fixture.js';
import { decodeOutboundMessage } from '../../src/effects/index.js';

it('an uninstalled Slack definition cannot pass Eight preparation or reach an external adapter', () => {
  const f = effectFixture();
  const message = value(decodeOutboundMessage({ ...f.message, id: 'slack-message:1',
    account: 'slack:v1:A12345678:T12345678',
    conversation: 'slack:v1:A12345678:T12345678:D12345678:dm' }, f.host));
  value(f.spine.append(message, [f.pending.id]));
  refused(f.api.prepare({ definition: 'slack-ordinary-reply:unadmitted', message,
    run: f.run, pending: f.pending.id, attempt: 'attempt:slack', verificationOwner: 'reply-verifier',
    obligation: f.obligation, closure: [], fence: f.fence }), 'OperationDefinition');
  expect(value(f.store.read()).some(fact => fact.kind === 'effect-OutboundMessage' &&
    (fact.body as { record?: { id?: string } }).record?.id === message.id)).toBe(true);
  expect(f.calls()).toBe(0);
});
