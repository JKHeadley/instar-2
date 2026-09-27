import { expect, it } from 'vitest';
import { fixtures, runCase, runClarificationBinding, runControl, terse } from './clarification-binding.js';

const homonym = fixtures[0]!, disagreement = fixtures[1]!;
const second = terse.homonym[1]!, dentist = terse.homonym[0]!;

it('keeps the compacted question beside a terse answer sent after one unrelated message', async () => {
  const result = await runCase(homonym, second, 'interleaved-summary', true);
  expect(result.historyMode).toBe('summary-plus-recent');
  expect(result.pendingRecalled).toBe(true);
  expect(result.binding).toBe('bound-correct');
}, 120000);

it('does not duplicate a question that is still in recent history', async () => {
  const result = await runCase(homonym, second, 'next-turn', true);
  expect(result.historyMode).toBe('summary-plus-recent');
  expect(result.pendingVisible).toBe(true);
  expect(result.pendingRecalled).toBe(false);
  expect(result.binding).toBe('bound-correct');
}, 120000);

it('carries only the two turns just before the message: a question three turns back stays a recall miss', async () => {
  const ordinal = await runCase(homonym, second, 'interleaved-twice-summary', true);
  expect(ordinal.pendingVisible).toBe(false);
  expect(ordinal.binding).toBe('dropped');
  // A reply that shares a word with the question is still found by the ordinary recall.
  const named = await runCase(homonym, dentist, 'interleaved-twice-summary', true);
  expect(named.binding).toBe('bound-correct');
}, 120000);

it('controls: a terse reply after a newer question or an answered clarification is not bound to the old one', async () => {
  for (const long of [false, true]) {
    expect(await runControl('later-question', long)).toMatchObject({ ok: true });
    expect(await runControl('already-answered', long)).toMatchObject({ ok: true });
  }
}, 240000);

it('measures every fixture, terse reply and condition over the real journal', async () => {
  const result = await runClarificationBinding();
  // Baseline at 3695117d with this harness: bound-correct 43, dropped 11 (8 lost their question,
  // 3 held on a refused correction), no wrong binding, controls 4/4.
  expect(result.cases).toHaveLength(54);
  expect(result.binding).toEqual({ 'bound-correct': 47, dropped: 7 });
  expect(result.controlsPassed).toBe(4);
  const dropped = result.cases.filter(item => item.binding === 'dropped');
  // Remaining: three refused disagreement corrections, and four replies whose question is three turns back.
  expect(dropped.filter(item => item.held === 'memory correction pending').map(item => item.condition).sort())
    .toEqual(['interleaved-summary', 'interleaved-twice-summary', 'rolling-summary']);
  expect(dropped.filter(item => item.held === null).map(item => item.condition))
    .toEqual(Array(4).fill('interleaved-twice-summary'));
  expect(result.cases.filter(item => item.followUp === 'asks-again')
    .every(item => item.fixture === disagreement.id && item.held === 'memory correction pending')).toBe(true);
  expect(result.cases.some(item => item.followUp === 'free-standing')).toBe(false);
}, 900000);
