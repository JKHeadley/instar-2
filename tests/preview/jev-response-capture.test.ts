import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { interpretJev, JEV_MODEL, JEV_RESPONSE_MAX_BYTES, parseJevResponse } from './reply-check.js';

// Rule 36: the Jev response reader runs on genuine bytes from TypeSafe System One (jev-response.json,
// captured 2026-09-29 for one reply-check request; see tests/fixtures/captures/README.md).
const captured = readFileSync(new URL('../fixtures/captures/jev-response.json', import.meta.url), 'utf8');

describe('Jev response reader on the genuine capture', () => {
  it('reads every reply-check question, its score and the reported usage', () => {
    const value = parseJevResponse(captured) as { model: string; answers: Record<string, { type: string; noul: number }> };
    expect(value.model).toBe(JEV_MODEL);
    const result = interpretJev(value, 42);
    expect(result).toMatchObject({ verdict: 'pass', ruleIds: [], path: 'jev', latencyMs: 42,
      usage: { inputTokens: 702, outputTokens: 184, charge: null } });
    expect(result.scores).toEqual(Object.fromEntries(Object.entries(value.answers).map(([id, answer]) => [id, answer.noul])));
    expect(Object.keys(result.scores ?? {})).toHaveLength(10);
  });

  it('turns the same genuine answer into a violation when one score crosses its line', () => {
    const flagged = JSON.parse(captured) as { answers: Record<string, { noul: number }> };
    flagged.answers.credential!.noul = 0.93;
    expect(interpretJev(parseJevResponse(JSON.stringify(flagged)), 1)).toMatchObject({ verdict: 'violation', ruleIds: ['credential'] });
  });

  it('refuses the genuine shape when the model or a question is missing', () => {
    const wrongModel = JSON.parse(captured) as { model: string };
    wrongModel.model = 'jev-0';
    expect(() => interpretJev(parseJevResponse(JSON.stringify(wrongModel)), 1)).toThrow(/wrong model/u);
    const missing = JSON.parse(captured) as { answers: Record<string, unknown> };
    delete missing.answers.defers_work;
    expect(() => interpretJev(parseJevResponse(JSON.stringify(missing)), 1)).toThrow(/malformed/u);
  });

  it('refuses a response past the size bound before parsing it', () => {
    expect(() => parseJevResponse(captured + ' '.repeat(JEV_RESPONSE_MAX_BYTES))).toThrow(/too large/u);
  });
});
