import { describe, expect, it } from 'vitest';
// @ts-expect-error -- host-only continuation projection is JavaScript, exercised at runtime.
import { boundedContinuationGrounding } from './continuation-grounding.mjs';

describe('journal continuation grounding', () => {
  it('shrinks a large prior context to the summary and recent user messages', () => {
    const turn = { prompt: JSON.stringify({ messages: [
      { role: 'user', content: 'Continue issue #2282' },
      { role: 'context', content: 'old context '.repeat(15000) },
    ] }), intentBody: 'The previous reply' };
    const text = boundedContinuationGrounding('Remember the working branch.', [turn]);
    expect(text).toContain('Continue issue #2282');
    expect(text).toContain('Remember the working branch');
    expect(text).toContain('The previous reply');
    expect(text).not.toContain('old context');
    expect(Buffer.byteLength(text)).toBeLessThan(128000);
  });

  it('uses recent messages before the first summary and refuses missing user history', () => {
    const turn = { prompt: JSON.stringify({ messages: [{ role: 'context', content: 'context' }] }), intent: 'reply' };
    expect(boundedContinuationGrounding('', [{ prompt: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }), intent: 'reply' }])).toContain('hello');
    expect(() => boundedContinuationGrounding('', [])).toThrow('history unavailable');
    expect(() => boundedContinuationGrounding('summary', [turn])).toThrow('user message unavailable');
  });
});
