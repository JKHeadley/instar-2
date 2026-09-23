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
    : { text: mutation === 'prefix' ? text.replace('PREVIEW', 'ANSWER') : text + '!' });
  expect(reply.prepare().kind).toBe('Refused'); expect(reply.calls()).toBe(0);
}, 120000);
