import { expect, it } from 'vitest';
import { explicitAgentPromises, fulfillsReminder } from './agent-commitment.js';

const at = 1790000000000;
const source = 'telegram:12345678:update:1';

it('detects only explicit first-person promises and resolves a supported due day', () => {
  const found = explicitAgentPromises('PREVIEW — I’ll remind you to call the dentist tomorrow.\nI will check the report tomorrow.',
    source, at, 'America/Los_Angeles');
  expect(found.map(item => [item.action, item.owner, item.waitsOn, item.due?.day]))
    .toEqual([['remind', 'agent', 'next-relevant-reply', '2026-09-22'],
      ['check', 'agent', 'next-relevant-reply', '2026-09-22']]);
  expect(found[0]?.quote).toBe('I’ll remind you to call the dentist tomorrow.');
});

it('ignores quoted, conditional, negated, third-person, and merely intended actions', () => {
  const reply = ['> I’ll remind you to call the dentist tomorrow.',
    '```', 'I will check the report tomorrow.', '```',
    'If I can, I’ll send the report.', 'I won’t check tomorrow.',
    'She will remind you tomorrow.', 'I might check tomorrow.',
    'I said “I’ll remind you tomorrow.”'].join('\n');
  expect(explicitAgentPromises(reply, source, at, 'UTC')).toEqual([]);
});

it('requires the exact promised reminder in a later reply', () => {
  const promise = explicitAgentPromises('I’ll remind you to call the dentist tomorrow.', source, at, 'UTC')[0]!;
  expect(fulfillsReminder(promise, 'Reminder: call the dentist.')).toBe(true);
  expect(fulfillsReminder(promise, 'I checked the dentist.')).toBe(false);
  expect(fulfillsReminder(promise, 'Reminder: call the doctor.')).toBe(false);
  expect(fulfillsReminder(explicitAgentPromises('I’ll check the report tomorrow.', source, at, 'UTC')[0]!,
    'I checked the report.')).toBe(false);
});

it('records the explicit bare reminder promise without inventing a completion target', () => {
  const found = explicitAgentPromises("I'll remind you.", source, at, 'UTC');
  expect(found).toMatchObject([{ action: 'remind', quote: "I'll remind you.", owner: 'agent' }]);
  expect(fulfillsReminder(found[0]!, 'Reminder: call the dentist.')).toBe(false);
  expect(explicitAgentPromises("I'll remind you to", source, at, 'UTC')).toEqual([]);
});

it('does not open the same exact promise twice in one reply', () => {
  expect(explicitAgentPromises("I'll check tomorrow. I'll check tomorrow.", source, at, 'UTC')).toHaveLength(1);
});

it('retains every distinct promise within the already bounded reply', () => {
  const found = explicitAgentPromises("I'll check report A. I'll check report B. I'll check report C. I'll check report D.",
    source, at, 'UTC');
  expect(found.map(item => item.quote)).toEqual(["I'll check report A.", "I'll check report B.",
    "I'll check report C.", "I'll check report D."]);
});
