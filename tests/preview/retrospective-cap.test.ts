import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';
import { readAnswer } from './answer-reading.js';
import type { JournalView } from './journal.js';
import { RETROSPECTIVE_QUESTION, estimatedAnswerBytes, owedCases, rowMissingReason, validateRetrospective,
  type RetroCase, type RetroPass, type RetroResult } from './retrospective.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-cap-2026-10-17.json', import.meta.url), 'utf8')) as {
  runs: { train: number; root: string; reserve: RetroPass; packet: { cases: RetroCase[] }; inputBytes: number;
    questionSha256: string; instructionSha256: string; output: string | null; terminalResult: string | null;
    usage: { outputTokens: number }; numTurns: number }[];
  replays: { call: number; questionSha256: string; output: string; outputTokens: number; numTurns: number }[];
};
const [before, failed] = fixture.runs;
// These first-pass packets have no authorization, open item or earlier grade requiring a journal lookup.
const view = { retroPasses: [], dated: [], turns: new Map() } as unknown as JournalView;
const plan = (run: typeof failed) => ({ cases: run!.packet.cases, omitted: run!.reserve.omitted });
const validate = (output: string, run = failed) => {
  const read = readAnswer(output, { wrapped: 'refuse', evidence: ['retrospective:0'] });
  if (!read.ok) throw Error(read.defect);
  return validateRetrospective(JSON.parse(read.value), plan(run), view, 0, run!.reserve.at, run!.reserve.contextDigest);
};
const owed = (result: RetroResult) => owedCases({ retroPasses: [{ ...failed!.reserve, state: 'complete', result }] } as unknown as JournalView,
  failed!.packet.cases, failed!.reserve.at).map(row => row.item.id);

it('replays the actual 12-case packet size and distinguishes workload variation from a train-60 prompt change', () => {
  expect(before!.questionSha256).toBe(failed!.questionSha256);
  expect(before!.instructionSha256).toBe(failed!.instructionSha256);
  expect(before!.reserve.contextDigest).toBe(failed!.reserve.contextDigest);
  expect(before!.packet.cases).toHaveLength(11);
  expect(failed!.packet.cases).toHaveLength(12);
  expect([before!.reserve.eligible, failed!.reserve.eligible]).toEqual([21, 23]);
  expect([estimatedAnswerBytes(before!.packet.cases), estimatedAnswerBytes(failed!.packet.cases)]).toEqual([1826, 1883]);
  expect([before!.inputBytes, failed!.inputBytes]).toEqual([25042, 25336]);
  expect(failed!.packet.cases.filter(item => item.category === 'repair')).toHaveLength(1);
  expect(failed!.packet.cases.filter(item => item.category === 'decision' || item.category === 'verdict')).toHaveLength(2);
});

it('keeps the actual truncated terminal result refused, while the earlier complete recorded answer still records work', () => {
  expect(before!.usage.outputTokens).toBe(1361);
  expect(validate(before!.output!, before).inspected.length).toBeGreaterThan(0);
  expect(failed!.usage.outputTokens).toBe(2170);
  expect(failed!.usage.outputTokens).toBeGreaterThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
  expect(failed!.output).toBeNull();
  expect(failed!.numTurns).toBe(2);
  expect(failed!.terminalResult).toContain('operator message, not a decision');
  expect(() => validate(failed!.terminalResult!)).toThrow();
});

it('the revised question completes real model replays of the recorded packet within the unchanged cap', () => {
  expect(fixture.replays.length).toBeGreaterThanOrEqual(2);
  for (const replay of fixture.replays) {
    expect(replay.questionSha256).toBe(createHash('sha256').update(RETROSPECTIVE_QUESTION).digest('hex'));
    expect(replay.numTurns).toBe(1);
    expect(replay.outputTokens).toBeLessThanOrEqual(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    const raw = JSON.parse(replay.output) as { grades: { case: string }[] };
    const graded = failed!.packet.cases.filter(item => item.category === 'decision' || item.category === 'verdict').map(item => item.id);
    expect(raw.grades.map(row => row.case).sort()).toEqual(graded.sort());
    const result = validate(replay.output);
    expect(result.inspected.length).toBeGreaterThan(0);
    expect(result.duties.find(row => row.duty === 'waste')?.disposition).toBe('inspected');
    // Every supplied case is either inspected or explicitly owed, including a row the validator refuses.
    expect([...result.inspected, ...result.omitted.map(row => row.case)].sort()).toEqual(failed!.reserve.cases.slice().sort());
    const remaining = owed(result);
    for (const row of result.omitted) {
      expect(row.reason.length).toBeGreaterThan(0);
      expect(remaining).toContain(row.case);
    }
    for (const id of result.inspected) expect(remaining).not.toContain(id);
    for (const row of failed!.reserve.omitted) expect(result.inspected).not.toContain(row.case);
  }
});

it('messages need no grade, while removing a required verdict grade still leaves that verdict named and owed', () => {
  for (const replay of fixture.replays) {
    const raw = JSON.parse(replay.output) as { inspected: string[]; grades: { case: string }[] };
    const verdict = failed!.packet.cases.find(item => item.category === 'verdict')!.id;
    const result = validateRetrospective({ ...raw, grades: raw.grades.filter(row => row.case !== verdict) }, plan(failed), view, 0);
    expect(result.omitted).toContainEqual({ case: verdict, reason: rowMissingReason('grade') });
    expect(owed(result)).toContain(verdict);
    const inspectedMessages = failed!.packet.cases.filter(item => item.category === 'message' && result.inspected.includes(item.id));
    expect(inspectedMessages.length).toBeGreaterThan(0);
    for (const item of inspectedMessages) expect(result.grades.some(grade => grade.case === item.id)).toBe(false);
  }
});
