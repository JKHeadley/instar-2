import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal, PROBE_TAG, probeTurn, type Turn } from './journal.js';
import { probeHits, QUESTIONS, runProbeTrafficReplay } from './probe-traffic-replay.js';

it('keeps desk probes auditable in the journal but out of every later memory surface, across summaries and restarts', async () => {
  const result = await runProbeTrafficReplay();
  expect(result.rows.map(row => row.question)).toEqual(QUESTIONS.map(question => question.id));
  // All eight probes were answered and stay verbatim in the journal.
  expect(result.journal).toEqual({ turns: 29, probeTurns: 8, auditable: true });
  expect(result.sends).toBe(29);
  expect(result.restarts).toBe(3);
  expect(result.replayStable).toBe(true);
  for (const row of result.rows) expect({ question: row.question, probeHits: row.probeHits, blocks: row.blocks })
    .toEqual({ question: row.question, probeHits: 0, blocks: {} });
  const row = (id: string) => result.rows.find(item => item.question === id)!;
  // Week recap and inventory counts: 29 and 32 before the fix; the difference is exactly the eight probes.
  expect(row('week').periodTotal).toBe(21);
  expect(row('inventory').inventoryTotal).toBe(24);
  // The failed canary is no longer an open operator question.
  expect(row('open').openQuestions).toBeUndefined();
  expect(result.summaries).toMatchObject({ withProbe: 0, probeHits: 0, controlJuniper: true });
  expect(result.summaries.count).toBeGreaterThan(5);
  // A canary saying "I prefer short replies" sets no preference; the operator's own statement does.
  expect(result.preferences).toEqual({ active: 1, fromProbe: 0, control: true });
  expect(result.people).toMatchObject({ fromProbe: 0, control: true });
  expect(result.commitments.fromProbe).toBe(0);
  // Controls: the operator genuinely talking about Juniper, juniper shrubs and a marker still surfaces.
  for (const id of ['week', 'inventory', 'juniper', 'shrubs', 'marker']) expect(row(id).control).toBe(true);
}, 180_000);

it('recognizes only the exact desk probe form from the verified operator', () => {
  const view = { genesis: { operator: '7654321' } } as Parameters<typeof probeTurn>[0];
  const turn = (text: string, from = 7654321) => ({ text, raw: JSON.stringify({ message: { from: { id: from } } }) }) as Turn;
  for (const text of ['Build check 3695117d: my test marker is Juniper. What is my test marker?',
    'Renewal check 7d824d64: my test marker is Juniper. What is my test marker?',
    'Canary check a1ecddb7: my test marker is Juniper and I prefer short replies. What is my test marker?',
    'Build check 3695117d0a1b2c3d4e5f60718293a4b5c6d7e8f9: hello']) expect(probeTurn(view, turn(text))).toBe(true);
  for (const text of ['my test marker is Juniper. What is my test marker?', // no desk tag
    'The build check 3695117d: passed, right?', // the words mid-sentence
    'build check 3695117d: lower-case is not the desk form',
    'Build check: no commit', 'Build check 3695117d without the colon',
    'Build check XYZ12345: not a commit id', 'My niece Juniper visits on Saturday October 3.'])
    expect(probeTurn(view, turn(text))).toBe(false);
  // Another authenticated sender cannot make a desk probe.
  expect(probeTurn(view, turn('Build check 3695117d: hi', 999))).toBe(false);
  expect(PROBE_TAG.test('Canary check 3695117d: x')).toBe(true);
  expect(probeHits('Build check 3695117d: my test marker is Juniper. Your marker is Juniper.')).toBe(3);
  expect(probeHits('My niece Juniper and the whiteboard marker.')).toBe(0);
});

it('answers a probe from its own message and keeps its reply, while dropping its memory and date decisions', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-probe-turn-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(71);
  let clock = Date.parse('2026-09-27T17:00:00Z'), sends = 0;
  const contexts: { question: string; context: string }[] = [];
  const ports = { now: () => clock, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: { id: string; question: string; context: string }) => {
      contexts.push({ question: input.question, context: input.context });
      // An eager model proposes a preference and a date from whatever it is shown.
      const prefer = /I prefer short replies/u.exec(input.question)?.[0];
      const clause = /[Gg]utters on (Friday October 2)/u.exec(input.question);
      return JSON.stringify({ reply: { answer: /test marker/u.test(input.question) ? 'Your marker is Juniper.' : 'Noted.' },
        memory: prefer ? [{ mode: 'prefer', source: input.id, quote: prefer }] : [],
        dated: clause ? [{ quote: clause[0], when: clause[1] }] : [] });
    },
    checkOutbound: () => {}, send: async () => ++sends };
  const message = (update: number, text: string) => ({ update_id: update, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text, date: Math.floor(clock / 1000) } });
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.parse('2026-10-05T00:00:00Z'),
    maxCalls: 20, maxReplies: 20, maxTurns: 10, maxBytes: 12000, cursor: 0 });
  try {
    const worker = createJournalWorker(journal, ports);
    const probeText = 'Canary check a1ecddb7: my test marker is Juniper and I prefer short replies; gutters on Friday October 2. What is my test marker?';
    worker.intake([message(1, probeText)]); await worker.drain();
    const probe = journal.view.order[0]!;
    // Answered from its own message, sent once, kept verbatim for audit.
    expect(contexts[0]!.question).toBe(probeText);
    expect(probe).toMatchObject({ text: probeText, intent: 'PREVIEW — Your marker is Juniper.', sent: 1 });
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.dated).toEqual([]);
    expect(probe.datedPending).toBeUndefined();
    // The operator's own message with the same clauses is decided as before.
    clock += 60_000;
    worker.intake([message(2, 'Gutters on Friday October 2 please.')]); await worker.drain();
    expect(journal.view.dated.map(item => item.when)).toEqual(['Friday October 2']);
    expect(journal.view.order[1]!.intent).toMatch(/^PREVIEW — Noted\. Date 1: /u); // the existing date receipt
    // The later packet no longer carries the probe as history.
    expect(probeHits(contexts[1]!.context)).toBe(0);
    expect((JSON.parse(contexts[1]!.context) as { history: unknown[] }).history).toEqual([]);
    expect(sends).toBe(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
