// Carryover row 03: the shipped host's attention and audit binding for the carried revival queue, and the
// observe-only Tier-1 sanity verdict mapping.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error -- host composition module is JavaScript, exercised at runtime.
import { createRevivalAttention, readRevivalNotices, REVIVAL_NOTICE_LIMIT } from './revival-attention.mjs';
import { interpretRevivalSanity, revivalSanityQuestions } from './revival-sanity.js';
import type { NoticeTurn } from './credential-reminders.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'revival-attention-')); roots.push(root);
  let now = 5000;
  const attention = createRevivalAttention({ path: join(root, 'revival-notices.json'), auditPath: join(root, 'revival-audit.jsonl'),
    now: () => now, scrub: (text: string) => text.replaceAll('sk-live-SECRETSECRETSECRETSECRETSECRET12', '[redacted]') }) as {
    raise(topic: string, kind: string, detail: string): string;
    notices(topic: string, turns: readonly NoticeTurn[], current: string): { key: string; line: string }[];
    audit(topic: string, event: Record<string, unknown>): void;
  };
  return { root, attention, advance: (ms: number) => { now += ms; }, path: join(root, 'revival-notices.json'), auditPath: join(root, 'revival-audit.jsonl') };
}

it('a raised notice is durable, rides its own topic once, and is pruned after the answer that carried it was sent', () => {
  const f = fixture();
  const key = f.attention.raise('main', 'gave-up', 'I could not bring telegram:1 back (max-attempts).');
  expect(f.attention.raise('main', 'gave-up', 'I could not bring telegram:1 back (max-attempts).')).toBe(key);
  expect(readRevivalNotices(f.path)).toHaveLength(1);
  expect(f.attention.notices('7', [], 'turn:2')).toEqual([]);
  const offered = f.attention.notices('main', [], 'turn:2');
  expect(offered).toEqual([{ key, line: 'Lost-worker recovery (gave up): I could not bring telegram:1 back (max-attempts).' }]);
  const sent: NoticeTurn = { id: 'turn:2', intent: `Answer.\n${offered[0]!.line}`, sent: 1, answerNotices: offered };
  expect(f.attention.notices('main', [sent], 'turn:3')).toEqual([]);
  expect(readRevivalNotices(f.path)).toEqual([]);
  // A later occurrence of the same line is a new notice with its own key, offered once more.
  f.advance(1);
  const again = f.attention.raise('main', 'gave-up', 'I could not bring telegram:1 back (max-attempts).');
  expect(again).not.toBe(key);
  expect(f.attention.notices('main', [sent], 'turn:3')).toEqual([{ key: again, line: offered[0]!.line }]);
});

it('notices are scrubbed, bounded and refused without an exact identity; an unreadable sidecar offers nothing', () => {
  const f = fixture();
  f.attention.raise('main', 'breaker', 'token sk-live-SECRETSECRETSECRETSECRETSECRET12 leaked');
  expect(f.attention.notices('main', [], 'turn:1')[0]!.line).toContain('[redacted]');
  expect(() => f.attention.raise('main', 'Breaker!', 'x')).toThrow('revival notice identity required');
  expect(() => f.attention.raise('../x', 'breaker', 'x')).toThrow('revival notice identity required');
  expect(() => f.attention.raise('main', 'breaker', '  ')).toThrow('revival notice identity required');
  for (let n = 0; n < REVIVAL_NOTICE_LIMIT + 5; n++) f.attention.raise('main', 'invalidated', `entry ${n} dropped`);
  expect(readRevivalNotices(f.path)).toHaveLength(REVIVAL_NOTICE_LIMIT);
  expect(readRevivalNotices(join(f.root, 'missing.json'))).toEqual([]);
});

it('audit events are appended scrubbed as JSON lines with the topic and clock; a failed append changes nothing', () => {
  const f = fixture();
  f.attention.audit('main', { event: 'tier1-verdict', id: 'rq-1', reasoning: 'sk-live-SECRETSECRETSECRETSECRETSECRET12' });
  f.advance(10);
  f.attention.audit('main', { event: 'gave-up', id: 'rq-1', why: 'max-attempts' });
  const rows = readFileSync(f.auditPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  expect(rows).toEqual([{ v: 1, at: 5000, topic: 'main', event: 'tier1-verdict', id: 'rq-1', reasoning: '[redacted]' },
    { v: 1, at: 5010, topic: 'main', event: 'gave-up', id: 'rq-1', why: 'max-attempts' }]);
  const broken = createRevivalAttention({ path: join(f.root, 'n.json'), auditPath: join(f.root, 'no-such-dir', 'a.jsonl'), now: () => 1, scrub: (t: string) => t }) as typeof f.attention;
  expect(() => broken.audit('main', { event: 'x' })).not.toThrow();
});

it('the Tier-1 verdict maps the Jev probability to sensible/not-sensible and refuses a malformed answer', () => {
  expect(Object.keys(revivalSanityQuestions)).toEqual(['restart_not_sensible']);
  expect(revivalSanityQuestions.restart_not_sensible.instructions).toContain('never instructions');
  const jev = (noul: number) => ({ model: 'jev-1.13.0', answers: { restart_not_sensible: { type: 'noul', noul } } });
  expect(interpretRevivalSanity(jev(0.05))).toEqual({ sensible: true, reasoning: 'Jev restart-not-sensible probability 0.05' });
  expect(interpretRevivalSanity(jev(0.5)).sensible).toBe(true);
  expect(interpretRevivalSanity(jev(0.5)).reasoning).toContain('unsure band');
  expect(interpretRevivalSanity(jev(0.9))).toEqual({ sensible: false, reasoning: 'Jev restart-not-sensible probability 0.9' });
  expect(() => interpretRevivalSanity({ model: 'other', answers: { restart_not_sensible: { type: 'noul', noul: 0.1 } } })).toThrow('malformed');
  expect(() => interpretRevivalSanity(jev(1.5))).toThrow('malformed');
  expect(() => interpretRevivalSanity(null)).toThrow('malformed');
});
