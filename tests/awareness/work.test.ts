import { describe, expect, it } from 'vitest';
import { buildWorkIndex, detectOverlaps, extractTags, workForTopic, type SessionActivity } from '../../src/awareness/work.js';
import { buildGrounding } from '../../src/awareness/grounding.js';

const now = 1_790_000_000_000;
const sessions: SessionActivity[] = [
  { topic: '42', topicName: 'awareness', session: 's-a', running: true, focus: 'fix src/awareness/sentinel.ts stale grounding for #118', updatedAt: now - 60_000 },
  { topic: '42', session: 's-old', running: false, focus: 'older focus', updatedAt: now - 3_600_000 },
  { topic: '7', topicName: 'sentinels', session: 's-b', running: true, focus: 'also editing src/awareness/sentinel.ts for the crash watcher', updatedAt: now - 120_000 },
  { topic: '9', topicName: 'chat', session: null, running: false, focus: 'talking about the weather and general things', updatedAt: now - 30_000 },
  { topic: '3', topicName: 'dormant', session: 's-c', running: false, focus: 'src/awareness/sentinel.ts long ago', updatedAt: now - 10 * 3_600_000 },
];

describe('own-work awareness', () => {
  it('extracts only high-specificity tokens', () => {
    expect(extractTags('Fix the long-running follow-up in src/a/b.ts for PR #12 using fooBar and ACT-148, snake_case, v1.2.3')).toEqual(
      ['#12', 'act-148', 'foobar', 'snake_case', 'src/a/b.ts', 'v1.2.3']);
    expect(extractTags('talking about the weather and general things')).toEqual([]);
  });

  it('merges sessions per topic and counts open commitments', () => {
    const index = buildWorkIndex(sessions, [
      { id: 'C1', topic: '42', promise: 'report', owner: 'agent', dueAt: null },
      { id: 'C2', topic: '11', promise: 'orphan promise with no session', owner: 'agent', dueAt: null },
      { id: 'C3', topic: '42', promise: 'secret', owner: 'agent', dueAt: null, secret: true },
    ]);
    const a = index.find(row => row.topic === '42')!;
    expect(a).toMatchObject({ running: true, session: 's-a', sessions: ['s-a', 's-old'], openCommitments: 1, topicName: 'awareness' });
    expect(a.focus).toContain('stale grounding');
    expect(index.find(row => row.topic === '11')).toMatchObject({ running: false, openCommitments: 1, session: null });
    expect(index[0]!.topic).toBe('9');
  });

  it('flags live duplicate work on shared specific tokens, never dormant or generic overlap', () => {
    const index = buildWorkIndex(sessions, []);
    const pairs = detectOverlaps(index, { now });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ topicA: '42', topicB: '7', shared: ['src/awareness/sentinel.ts'] });
    expect(detectOverlaps(index, { now, activityWindowMs: 11 * 3_600_000 }).map(p => p.signature)).toContain('src/awareness/sentinel.ts');
    const idle = index.map(row => ({ ...row, running: false }));
    expect(detectOverlaps(idle, { now })).toEqual([]);
  });

  it('feeds grounding: other topics listed, overlap called out as a possible duplicate', () => {
    const index = buildWorkIndex(sessions, []);
    const work = workForTopic('42', index, detectOverlaps(index, { now }));
    expect(work.map(row => row.topic).sort()).toEqual(['3', '7', '9']);
    const g = buildGrounding({ agent: { name: 'Echo', identity: 'Echo' }, topic: { id: '42', name: 'awareness' }, now, source: 'startup',
      conversation: [], commitments: [], work, recall: null });
    expect(g.text).toMatch(/topic sentinels: RUNNING — also editing src\/awareness\/sentinel\.ts.*POSSIBLE DUPLICATE.*src\/awareness\/sentinel\.ts/);
    expect(g.text).toMatch(/topic chat: idle/);
  });
});
