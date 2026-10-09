import { expect, it } from 'vitest';
import { acceptedReplyPreviewText } from '../../src/rungraph/index.js';
import { pair, outbound } from '../preview/stage2-fixture.js';
import { value } from '../facts/fixtures.js';

it('reserves, claims and dispatches the exact signed preview projection once through genuine Six', async () => {
  const s = await pair(); value(s.admit());
  const text = acceptedReplyPreviewText(s.f.all(), s.reply.id);
  const reply = outbound(s, { text }); const request = value(reply.prepare());
  value(reply.api.dispatch(request, s.f.fence));
  expect(reply.calls()).toBe(1);
  value(reply.api.dispatch(request, s.f.fence));
  expect(reply.calls()).toBe(1);
  expect(s.accounting).toMatchObject({ actualCharge: -1, unresolved: 1, released: 0, retryEligible: 0 });
}, 120000);
for (const mutation of ['prefix', 'value', 'acceptance']) it(`refuses altered preview ${mutation} at genuine Six reservation`, async () => {
  const s = await pair(); value(s.admit());
  const text = acceptedReplyPreviewText(s.f.all(), s.reply.id);
  const reply = outbound(s, mutation === 'acceptance' ? { text, sourceResult: s.f.opening.id }
    : { text: mutation === 'prefix' ? `ANSWER — ${text}` : text + '!' });
  expect(reply.prepare().kind).toBe('Refused'); expect(reply.calls()).toBe(0);
}, 120000);

for (const change of ['stale-source', 'conflicted-source', 'unsigned-decision', 'mismatched-decision'] as const)
  it(`refuses preview projection from ${change} at genuine owner use`, async () => {
    const s = await pair(); value(s.admit());
    const text = acceptedReplyPreviewText(s.f.all(), s.reply.id);
    if (change === 'stale-source') {
      s.f.time(2000);
      expect(outbound(s, { text }).prepare().kind).toBe('Refused');
    } else if (change === 'conflicted-source') {
      const capture = s.subject.response.capture;
      s.f.metadata[capture.reference] = { ...s.f.metadata[capture.reference], bytes: 'conflicting bytes under the signed source hash' };
      const answer = s.api.consumeAcceptedProviderAnswer(s.acceptance, (v: unknown) => v);
      expect(answer.kind).toBe('Refused');
      expect(outbound(s, { text }).prepare().kind).toBe('Refused');
    } else {
      const fact = s.f.all().find((row: any) => row.id === s.acceptance.id);
      const copied = JSON.parse(JSON.stringify(fact));
      copied.body.decision.conclusion.value = 'unsigned replacement';
      if (change === 'unsigned-decision') copied.signature = 'unsigned';
      expect(s.f.store.append(copied).kind).toBe('Refused');
      expect(outbound(s, { text: text.replace('A real synthetic answer:', 'unsigned replacement:') }).prepare().kind).toBe('Refused');
    }
  }, 120000);
