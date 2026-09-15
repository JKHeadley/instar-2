import { expect, it } from 'vitest';
import { extractTelegramUpdate } from '../../src/conversation/index.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

it.each(['inline_query', 'poll', 'chosen_inline_result'])(
  'P12-NF-16 P12-NF-17 round5 contradictory-%s refuses the two supplied update variants',
  variant => {
    const f = conversationFixture();
    const raw = telegramUpdate(100, update => {
      update[variant] = { id: 'another-event', from: { id: 8, is_bot: false }, query: 'other payload' };
    });
    expect(() => extractTelegramUpdate(raw, f.declaration)).toThrow('exactly one routed variant');
  },
);
