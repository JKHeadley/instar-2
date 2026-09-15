import { expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { operatorFixture } from './fixture.js';

it('R8-F4 rereview6 V39/V76 present empty requester prose renders and completes through real Part Four intake', () => {
  const f = operatorFixture();
  const verified = f.verifiedAct({ surface: 'phone-surface', request: { requestId: 'empty-prose', requesterProse: '' } });
  const rendering = value(f.surface().render(verified.request.id));
  const admission = value(f.port().admitVerifiedAct(verified.input));
  expect(rendering.requesterText).toEqual({ label: 'UNTRUSTED REQUESTER TEXT', text: '' });
  expect(admission.kind).toBe('approved');
});

it('R8-F4 rereview6 V77 nonempty requester prose remains unchanged', () => {
  const f = operatorFixture();
  const verified = f.verifiedAct({ surface: 'phone-surface', request: { requestId: 'nonempty-prose', requesterProse: 'Please proceed' } });
  expect(value(f.surface().render(verified.request.id)).requesterText.text).toBe('Please proceed');
  expect(value(f.port().admitVerifiedAct(verified.input)).kind).toBe('approved');
});
