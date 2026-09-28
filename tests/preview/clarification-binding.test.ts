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

it('a question three turns back stays visible in int12\'s full original history, so its terse answer binds', async () => {
  // int12 keeps full original history for short conversations (PREVIEW_FULL_HISTORY_BYTES), so the
  // question is in history rather than recalled; the two-turn carry only matters past that bound.
  const ordinal = await runCase(homonym, second, 'interleaved-twice-summary', true);
  expect(ordinal.pendingVisible).toBe(true);
  expect(ordinal.binding).toBe('bound-correct');
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
  // 3 held on a refused correction), no wrong binding, controls 4/4. On the piece's base: 47/7.
  // Integrated with int12 the three disagreement cases ask again rather than hold.
  // Integrated with int12 (three-turn follow-up context, full original history): 51/3.
  expect(result.cases).toHaveLength(54);
  expect(result.binding).toEqual({ 'bound-correct': 51, dropped: 3 });
  expect(result.controlsPassed).toBe(4);
  const dropped = result.cases.filter(item => item.binding === 'dropped');
  // Remaining: the three disagreement cases. Under int12's conflict handling (M1) the reply is not
  // held; the model asks again instead of binding. No reply loses its question.
  expect(dropped.map(item => [item.fixture, item.held, item.followUp])).toEqual(Array(3).fill([disagreement.id, null, 'asks-again']));
  expect(dropped.map(item => item.condition).sort()).toEqual(['interleaved-summary', 'interleaved-twice-summary', 'rolling-summary']);
  expect(result.cases.filter(item => item.followUp === 'asks-again').every(item => item.fixture === disagreement.id)).toBe(true);
  expect(result.cases.some(item => item.followUp === 'free-standing')).toBe(false);
}, 900000);
