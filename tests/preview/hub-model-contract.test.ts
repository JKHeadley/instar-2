import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { hubIntentRequest, hubIntentDecision, briefRequest, conversationBrief } from './hub-model-contract.js';
const topics = [{ topicId: 42, topicName: 'Build' }];
const messages = [{ direction: 'in' as const, text: 'Please review the build', remoteAgentName: 'Codey', timestamp: '' },
  { direction: 'out' as const, text: 'Review underway', remoteAgentName: 'Echo', timestamp: '' }];
const input = { threadId: 'thread-1', conversation: { remoteAgent: 'Codey', messageCount: 2 }, messages };
it('preserves the exact 1.x prompts and tuned request bounds', () => {
  const intent = hubIntentRequest('open this', [], topics).request;
  const brief = briefRequest(messages);
  expect(intent).toMatchObject({ maxTokens: 200, timeoutMs: 4000, temperature: 0, model: 'fast' });
  expect(brief).toMatchObject({ maxTokens: 320, timeoutMs: 15000, model: 'fast' });
  expect(createHash('sha256').update(intent.prompt).digest('hex')).toBe('d1feb47066efc807cb52ea30b50ccabe5335326da8a4d5b43a39dbfe5ebd1ac1');
  expect(createHash('sha256').update(brief.prompt).digest('hex')).toBe('458ed7eb9463accbf9b8e02bdd203a8838216b45218042fff05a2bb226c9a2c6');
  const bounded = hubIntentRequest('latest', Array.from({ length: 9 }, (_, i) => ({ fromUser: true, text: `${i}:` + 'z'.repeat(500) })),
    Array.from({ length: 45 }, (_, i) => ({ topicId: i + 1, topicName: `t${i}` })));
  expect(bounded.topics).toHaveLength(40);
  expect(bounded.request.prompt).not.toContain('User: 2:');
  expect(bounded.request.prompt).toContain('User: 3:');
  expect(bounded.request.prompt).not.toContain('z'.repeat(401));
  const long = briefRequest(Array.from({ length: 20 }, (_, i) => ({ ...messages[0]!, text: `${i}:` + 'x'.repeat(900) })));
  expect(long.prompt).not.toContain('Codey: 9:'); expect(long.prompt).toContain('Codey: 10:');
  expect(long.prompt).not.toContain('x'.repeat(801));
});
it('uses the original parser and 0.85 threshold; uncertainty never consumes a message', () => {
  expect(hubIntentDecision('{"intent":"open","confidence":0.85}', topics)).toEqual({ action: 'open' });
  expect(hubIntentDecision('prose {"intent":"tie","targetTopicId":42,"confidence":0.9}', topics)).toEqual({ action: 'tie', targetTopicId: 42 });
  for (const raw of [null, '', 'uncertain', 'undecided', '{}', '{"intent":"open","confidence":0.849}',
    '{"intent":null,"confidence":1}', '{"intent":"tie","targetTopicId":99,"confidence":1}'])
    expect(hubIntentDecision(raw, topics)).toBeNull();
});
it('preserves PURPOSE/body parsing and independent secret/empty fallbacks with nonempty bounded fields', () => {
  expect(conversationBrief({ ...input, raw: 'PURPOSE: Build review pending\n\nCodey awaits the review.' }))
    .toMatchObject({ topicName: 'Build review pending', summary: 'Codey awaits the review.', nameSource: 'llm', summarySource: 'llm' });
  expect(conversationBrief({ ...input, raw: 'PURPOSE: Build review pending' })).toMatchObject({ nameSource: 'llm', summarySource: 'template' });
  expect(conversationBrief({ ...input, raw: 'A plain body.' })).toMatchObject({ nameSource: 'slug', summarySource: 'llm' });
  expect(conversationBrief({ ...input, raw: 'PURPOSE: sk-secret-key-leak\n\nSafe summary.' })).toMatchObject({ nameSource: 'slug', summarySource: 'llm' });
  expect(conversationBrief({ ...input, raw: 'PURPOSE: Safe topic title\n\nxoxb-1234567890-abcdefghij' })).toMatchObject({ nameSource: 'llm', summarySource: 'template' });
  expect(conversationBrief({ ...input, raw: 'PURPOSE: Token refresh and API key rotation\n\nToken refresh discussion.' })).toMatchObject({ nameSource: 'llm', summarySource: 'llm' });
  for (const raw of [null, '', '  ', 'PURPOSE: ' + 'Long title '.repeat(20) + '\n\n' + 'Body text '.repeat(100)]) {
    const brief = conversationBrief({ ...input, raw });
    expect(brief.topicName.length).toBeGreaterThan(0); expect(brief.topicName.length).toBeLessThanOrEqual(40);
    expect(brief.summary.length).toBeGreaterThan(0); expect(brief.summary.length).toBeLessThanOrEqual(600);
  }
});
