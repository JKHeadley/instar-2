import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { classifySlicePayload, intakeFactSchemas, intakeKinds } from '../../src/intake/index.js';
import { intakeFixture, message, refused, route, stop, value } from './fixtures.js';

const wire = (result: Result<unknown>): unknown => consumeResult<unknown, unknown>(result, {
  Success: value => ({ kind: 'Success', value }),
  Refused: refusal => ({ kind: 'Refused', reason: refusal.reason, detail: refusal.detail,
    site: refusal.site, failDirection: refusal.failDirection, preserved: refusal.preserved }),
});

it('P4-PRESERVE-01 keeps every pre-existing Part Four public behavior byte-for-byte', () => {
  const conversation = intakeFixture(), conversationPort = conversation.port();
  const preScheduledKinds = ['intake-receipt', 'intake-resolved', 'intake-admitted', 'intake-held', 'intake-expired',
    'intake-collapse', 'intake-mismatch', 'intake-stop', 'intake-stop-signal', 'intake-verified-act', 'conversation-binding'];
  expect(intakeKinds).toEqual(preScheduledKinds);
  expect(intakeFactSchemas(conversation.f.scope).map(schema => schema.kind)).toEqual(preScheduledKinds);
  const admitted = conversationPort.receive(message('baseline'), route);
  const duplicate = conversationPort.receive(message('baseline'), route);
  const mismatch = conversationPort.receive(message('changed'), route);
  const recovered = conversationPort.recover(conversation.facts().find(f => f.kind === 'intake-receipt')!.id);
  const missingEvent = conversationPort.receive(message('missing'), { ...route, eventId: null });

  const braking = intakeFixture(); braking.bind(); const brakingPort = braking.port();
  const stopped = brakingPort.receive(stop, { ...route, eventId: 'stop-baseline' });

  const expiry = intakeFixture(), expiryPort = expiry.port();
  expiryPort.receive('{"not":"classified"}', { ...route, eventId: 'hold-baseline' });
  expiry.setTime(1200); const expired = expiryPort.expireHolds();

  const approval = intakeFixture(), approvedAct = approval.verifiedAct();
  const approved = approval.port().admitVerifiedAct(approvedAct.input);
  const replay = approval.port().admitVerifiedAct(approvedAct.input);
  const decline = intakeFixture(), declinedAct = decline.verifiedAct({ decision: 'decline' });
  const declined = decline.port().admitVerifiedAct(declinedAct.input);

  const transcript = {
    classified: [
      classifySlicePayload(JSON.parse(message('baseline'))),
      classifySlicePayload(JSON.parse(stop)),
      classifySlicePayload({ schemaVersion: 1, kind: 'message', text: '' }),
      classifySlicePayload('not-json'),
    ],
    conversation: { admitted: wire(admitted), duplicate: wire(duplicate), mismatch: wire(mismatch),
      recovered: wire(recovered), missingEvent: wire(missingEvent), facts: conversation.facts() },
    braking: { stopped: wire(stopped), facts: braking.facts() },
    expiry: { expired: wire(expired), facts: expiry.facts() },
    verifiedActs: { approved: wire(approved), replay: wire(replay), facts: approval.facts(),
      declined: wire(declined), declinedFacts: decline.facts() },
  };
  const encoded = value(canonical(transcript));
  expect(encoded.hash).toBe('sha256:24592c925169b89b306f1c42376ed44de7c53ad8d2384e27500512cb49d583aa');
  expect(refused(mismatch).detail).toContain('different arrival bytes');
});
