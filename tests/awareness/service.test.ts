import { describe, expect, it } from 'vitest';
import { createAwareness, createLabelledFakeRecall, FAKE_RECALL_LABEL, groundingDigest, type AwarenessIO, type AwarenessReceipts,
  type ConversationMessage, type ObservedSession, type OpenCommitment, type SentinelState } from '../../src/awareness/index.js';

const T = 1_790_000_000_000;
function harness() {
  let now = T;
  const files = new Map<string, string>();
  const receipts = new Map<string, { grounded: { at: number; source: string; digest: string }[]; compactions: number[]; turnsClosed: number[] }>();
  const signals: Record<string, unknown>[] = [];
  let state: SentinelState = { sessions: [] };
  const messages: ConversationMessage[] = [
    { at: T - 60_000, from: 'user', text: 'Please finish the sentinel port and tell me when tests pass.' },
    { at: T - 50_000, from: 'agent', text: 'Will do — I will report back when the suite is green.' },
    { at: T - 10_000, from: 'user', text: 'Also double-check the recall fallback.' },
  ];
  const commitments: OpenCommitment[] = [{ id: 'CMT-1', topic: '42', promise: 'report back when the suite is green', owner: 'agent', dueAt: null }];
  const sessions: ObservedSession[] = [{ session: 's-42', topic: '42', alive: true, startedAt: T, pane: 'idle', stuck: null }];
  const delivered: { session: string; text: string; operation: string }[] = [];
  const recovered: string[] = [];
  let stopped = false;
  const io: AwarenessIO = {
    writeGrounding: (claim, text) => { files.set(claim, text); return groundingDigest(text); },
    readGroundingDigest: claim => files.has(claim) ? groundingDigest(files.get(claim)!) : null,
    readReceipts: (session): AwarenessReceipts => receipts.get(session) ?? { grounded: [], compactions: [], turnsClosed: [] },
    loadState: () => state, saveState: next => { state = next; }, signal: row => { signals.push(row); },
  };
  const awareness = createAwareness({
    sources: {
      identity: () => ({ name: 'Echo', identity: 'I am Echo. I finish what I start.' }),
      topics: () => [{ id: '42', name: 'awareness', claim: 'claim-42' }, { id: '7', name: 'digest', claim: 'claim-7' }],
      conversation: topic => ({ messages: topic === '42' ? messages : [] }),
      commitments: () => commitments,
      sessions: () => [{ topic: '42', session: 's-42', running: true, focus: 'port src/awareness/sentinel.ts', updatedAt: T },
        { topic: '7', session: 's-7', running: true, focus: 'weekly digest', updatedAt: T }],
    },
    recall: createLabelledFakeRecall([{ at: T - 86_400_000, source: 'topic 9', speaker: 'Justin', text: 'the recall fallback must be labelled', topic: '9' }]),
    io, observer: { observe: () => sessions },
    actions: { deliver: input => { delivered.push(input); }, recoverContext: input => { recovered.push(input.session); } },
    now: () => now, stopped: () => stopped, sentinel: { graceMs: 1_000, verifyMs: 5_000 },
  });
  return { awareness, files, receipts, signals, delivered, recovered, sessions, messages, commitments,
    advance: (ms: number) => { now += ms; }, stop: () => { stopped = true; }, now: () => now };
}

describe('awareness service', () => {
  it('builds a topic grounding with identity, conversation, unanswered, commitments, other work and labelled recall', () => {
    const h = harness();
    const g = h.awareness.grounding('42');
    expect(g.text).toContain('I am Echo. I finish what I start.');
    expect(g.text).toMatch(/UNANSWERED[\s\S]*double-check the recall fallback/);
    expect(g.text).toContain('report back when the suite is green');
    expect(g.text).toContain('weekly digest');
    expect(g.text).toContain(FAKE_RECALL_LABEL);
    expect(g.text).toContain('the recall fallback must be labelled');
    expect(() => h.awareness.grounding('nope')).toThrow('unknown topic');
  });

  it('keeps grounding files fresh and rewrites only when content changes', () => {
    const h = harness();
    const first = h.awareness.tick();
    expect(first.actions.filter(a => a.kind === 'write-grounding').map(a => a.kind === 'write-grounding' && a.topic).sort()).toEqual(['42', '7']);
    h.advance(60_000);
    h.receipts.set('s-42', { grounded: [{ at: T + 5, source: 'startup', digest: 'x' }], compactions: [], turnsClosed: [] });
    expect(h.awareness.tick().actions.filter(a => a.kind === 'write-grounding')).toEqual([]);
    h.messages.push({ at: h.now(), from: 'user', text: 'new message arrives' });
    expect(h.awareness.tick().actions.filter(a => a.kind === 'write-grounding').map(a => a.kind === 'write-grounding' && a.topic)).toEqual(['42']);
    expect(h.files.get('claim-42')).toContain('new message arrives');
  });

  it('re-grounds a compacted session whose hook never confirmed, with the full grounding and a carry-on instruction', () => {
    const h = harness();
    h.receipts.set('s-42', { grounded: [{ at: T + 5, source: 'startup', digest: 'x' }], compactions: [], turnsClosed: [] });
    h.awareness.tick();
    h.advance(10_000);
    h.receipts.set('s-42', { grounded: [{ at: T + 5, source: 'startup', digest: 'x' }], compactions: [h.now()], turnsClosed: [] });
    h.awareness.tick();
    expect(h.delivered).toEqual([]);
    h.advance(2_000);
    const report = h.awareness.tick();
    expect(report.actions.map(a => a.kind), JSON.stringify(h.signals)).toContain('reground');
    expect(h.delivered).toHaveLength(1);
    expect(h.delivered[0]!.text).toMatch(/^\[instar awareness\] Your context was compacted/);
    expect(h.delivered[0]!.text).toContain('Carry on with the work in progress');
    expect(h.delivered[0]!.text).toContain('report back when the suite is green');
    expect(h.delivered[0]!.text).toContain('double-check the recall fallback');
    expect(h.delivered[0]!.text).toContain('Trigger: compact.');
    h.advance(1_000);
    h.awareness.tick();
    expect(h.delivered).toHaveLength(1);
    const r = h.receipts.get('s-42')!;
    h.receipts.set('s-42', { ...r, turnsClosed: [h.now()] });
    h.advance(1_000);
    h.awareness.tick();
    expect(h.signals.map(s => s.event)).toContain('recovered-after-reground');
  });

  it('hands a context wall to the driver and records failed actions as signals, never throwing', () => {
    const h = harness();
    h.receipts.set('s-42', { grounded: [{ at: T + 5, source: 'startup', digest: 'x' }], compactions: [], turnsClosed: [] });
    h.sessions[0] = { ...h.sessions[0]!, stuck: 'context-too-long' };
    h.awareness.tick();
    expect(h.recovered).toEqual(['s-42']);
  });

  it('under stop, performs nothing', () => {
    const h = harness();
    h.stop();
    h.sessions[0] = { ...h.sessions[0]!, stuck: 'context-too-long' };
    h.advance(100_000);
    const report = h.awareness.tick();
    expect(report.actions.filter(a => a.kind !== 'signal')).toEqual([]);
    expect(h.files.size).toBe(0);
    expect(h.delivered).toEqual([]);
    expect(h.recovered).toEqual([]);
  });

  it('degrades, never fails, when recall throws; the fake recall never claims assembled', () => {
    const fake = createLabelledFakeRecall([{ at: 1, source: 's', speaker: 'x', text: 'alpha bravo', topic: '1' }]);
    expect(fake.prepare({ topic: '2', query: 'bravo', now: 1, maxItems: 5 })).toMatchObject({ disposition: 'degraded', label: FAKE_RECALL_LABEL });
    expect(fake.prepare({ topic: '1', query: 'bravo', now: 1, maxItems: 5 }).items).toEqual([]);
  });
});

describe('session driver integration fragment', () => {
  it('registers the grounding hook for every SessionStart source', async () => {
    const { groundingHookSettings } = await import('../../src/awareness/index.js');
    expect(groundingHookSettings('/abs/grounding.mjs')).toEqual({ SessionStart: [{ hooks: [{ type: 'command', command: 'node "/abs/grounding.mjs"' }] }] });
    expect(() => groundingHookSettings('relative.mjs')).toThrow();
  });
});
