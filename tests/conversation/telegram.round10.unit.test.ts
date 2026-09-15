import { expect, it } from 'vitest';
import { countTelegramHtmlEntities } from '../../src/conversation/index.js';

it('P12-NF-29 P12-NF-30 round10 counts each rendered Telegram HTML entity once', () => {
  expect(countTelegramHtmlEntities('Hello')).toBe(0);
  expect(countTelegramHtmlEntities('&lt;b&gt;Hello&lt;/b&gt;')).toBe(0);
  expect(countTelegramHtmlEntities('<b>Hello</b>')).toBe(1);
  expect(countTelegramHtmlEntities('<b>Hello</b> <i>World</i>')).toBe(2);
  expect(countTelegramHtmlEntities(Array.from({ length: 101 }, (_, index) =>
    index % 2 ? '<i>x</i>' : '<b>x</b>').join(' '))).toBe(101);
});
