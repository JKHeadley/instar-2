import { expect, it } from 'vitest';
import { acceptedReplyPreviewText } from '../../src/rungraph/index.js';
import { pair } from '../preview/stage2-fixture.js';

it('projects the exact signed Decision with fixed label, Unicode and HTML escaping', async () => {
  const s = await pair();
  expect(acceptedReplyPreviewText(s.f.all(), s.reply.id)).toBe(
    'PREVIEW — experimental test agent; production safeguards incomplete.\nA real synthetic answer: café &lt;世界&gt; &amp; ready.');
}, 120000);
for (const [name, options] of [
  ['wrong subject', { subject: 'different' }], ['wrong predicate', { predicate: 'different' }],
  ['wrong value type', { answerText: 42 }], ['controls', { answerText: 'unsafe\u0001' }],
  ['rendered overflow', { answerText: '&'.repeat(820) }],
] as const) it(`refuses ${name} from a genuine signed acceptance`, async () => {
  const s = await pair(options);
  expect(() => acceptedReplyPreviewText(s.f.all(), s.reply.id)).toThrow();
}, 120000);
