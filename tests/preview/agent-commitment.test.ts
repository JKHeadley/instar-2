import { expect, it } from 'vitest';
import { fulfillmentProposals, legacyFulfillsReminder, promiseProposals, recordedPromises } from './agent-commitment.js';

const at = 1790000000000;
const source = 'telegram:12345678:update:1';

it('keeps a model-proposed promise whatever its wording, but only as an exact quote of the reply', () => {
  const reply = 'Sure. Tomorrow morning I will put the dentist call in front of you again.';
  // No phrase list decides this: a paraphrased promise the old "I'll remind you" pattern missed is kept.
  const proposed = promiseProposals([{ quote: 'Tomorrow morning I will put the dentist call in front of you again.', when: 'Tomorrow morning' }], reply);
  expect(proposed).toEqual([{ quote: 'Tomorrow morning I will put the dentist call in front of you again.', when: 'Tomorrow morning' }]);
  const recorded = recordedPromises(proposed!, `PREVIEW — ${reply}`, source, at, 'America/Los_Angeles');
  expect(recorded).toMatchObject([{ action: 'promised', owner: 'agent', waitsOn: 'next-relevant-reply' }]);
  expect(recorded[0]!.due?.when).toBe('Tomorrow morning');
});

it('refuses invented, oversized or unbounded proposals and a date phrase outside the quote', () => {
  const reply = 'I will check the report.';
  expect(promiseProposals([{ quote: 'I will check the invoice.' }], reply)).toBeUndefined();
  expect(promiseProposals([{ quote: reply, when: 'tomorrow' }], reply)).toBeUndefined();
  expect(promiseProposals(Array.from({ length: 6 }, () => ({ quote: reply })), reply)).toBeUndefined();
  expect(promiseProposals('I will check', reply)).toBeUndefined();
  expect(promiseProposals(undefined, reply)).toEqual([]);
  expect(promiseProposals([{ quote: reply }, { quote: reply }], reply)).toHaveLength(1);
  // A proposal that no longer appears in the reply actually sent records nothing.
  expect(recordedPromises([{ quote: reply }], 'A different final reply.', source, at, 'UTC')).toEqual([]);
});

it('accepts a fulfillment only for an offered open promise id and an exact reply excerpt', () => {
  const reply = 'Here is the dentist reminder you asked for: call them before noon.';
  const offered = new Set([4]);
  expect(fulfillmentProposals([{ id: 4, quote: 'call them before noon' }], reply, offered)).toEqual([{ id: 4, quote: 'call them before noon' }]);
  expect(fulfillmentProposals([{ id: 5, quote: 'call them before noon' }], reply, offered)).toBeUndefined();
  expect(fulfillmentProposals([{ id: 4, quote: 'call them after noon' }], reply, offered)).toBeUndefined();
  expect(fulfillmentProposals(undefined, reply, offered)).toEqual([]);
});

it('keeps the legacy closure rule only for replaying journal rows written under it', () => {
  const legacy = { quote: 'I’ll remind you to call the dentist tomorrow.', action: 'remind' as const, owner: 'agent' as const,
    waitsOn: 'next-relevant-reply' as const };
  expect(legacyFulfillsReminder(legacy, 'PREVIEW — Reminder: call the dentist.')).toBe(true);
  expect(legacyFulfillsReminder(legacy, 'Reminder: call the doctor.')).toBe(false);
  expect(legacyFulfillsReminder({ ...legacy, action: 'promised' }, 'Reminder: call the dentist.')).toBe(false);
});
