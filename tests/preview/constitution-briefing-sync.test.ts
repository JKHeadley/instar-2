/** The runner refuses to start when its briefed copy of the constitution no longer matches the
 * repository (verifyMindRules, sourcePacket). An amendment that rewords a briefed rule or a quoted
 * purpose section must update the briefing in the same change, or every candidate refuses at launch
 * (2026-10-10 18:47: rule 18 and the coherency section after PR #154). This fails it in unit tests first. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_PINS, sourcePacket, verifyMindRules } from './briefing.js';

const acknowledgement = "A brief acknowledgement in reply to the person's own message, when the answer will take more than a few seconds, is part of the answer, not a notification.";
const limits = { providerAttempts: 1, expiresAt: 9999999999999 };
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the briefed constitution matches the repository', () => {
  it('every briefed mind rule is stated exactly in the rule book', () => {
    expect(() => verifyMindRules(read)).not.toThrow();
  });
  it('delivers Rule 87 with both the status restriction and the approved acknowledgement clarification', () => {
    const rule = sourcePacket(read, SOURCE_PINS, limits).sources.find(source => source.id === 'rules:87');
    expect(rule?.text).toBe(read('docs/01-the-rules.md').split('\n').find(line => line.startsWith('| 87 |')));
    expect(rule?.text).toContain('Only messages that need action or carry a result push to the user. Status and churn go to a pull surface.');
    expect(rule?.text).toContain(acknowledgement);
    expect(rule?.provenance.path).toBe('docs/01-the-rules.md');
  });
  it('refuses both a stale Rule 87 without the clarification and a missing Rule 87', () => {
    const stale = (path: string) => read(path).replace(' ' + acknowledgement, '');
    expect(() => sourcePacket(stale, SOURCE_PINS, limits)).toThrow('source excerpt rules:87 changed');
    const missing = (path: string) => read(path).split('\n').filter(line => !line.startsWith('| 87 |')).join('\n');
    expect(() => sourcePacket(missing, SOURCE_PINS, limits)).toThrow('source excerpt rules:87 absent');
  });
  it('every quoted constitutional excerpt matches its pinned digest', () => {
    expect(() => sourcePacket(read, SOURCE_PINS, { providerAttempts: 1, expiresAt: Date.now() + 60_000 })).not.toThrow();
  });
});
