/** The runner refuses to start when its briefed copy of the constitution no longer matches the
 * repository (verifyMindRules, sourcePacket). An amendment that rewords a briefed rule or a quoted
 * purpose section must update the briefing in the same change, or every candidate refuses at launch
 * (2026-10-10 18:47: rule 18 and the coherency section after PR #154). This fails it in unit tests first. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_PINS, sourcePacket, verifyMindRules } from './briefing.js';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the briefed constitution matches the repository', () => {
  it('every briefed mind rule is stated exactly in the rule book', () => {
    expect(() => verifyMindRules(read)).not.toThrow();
  });
  it('every quoted purpose excerpt matches its pinned digest', () => {
    expect(() => sourcePacket(read, SOURCE_PINS, { providerAttempts: 1, expiresAt: Date.now() + 60_000 })).not.toThrow();
  });
});
