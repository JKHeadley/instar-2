import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, declaredObligations } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { HOLDING_REPLY, parseReplyRevision, parseReplyReviewVerdict, replyReviewContext } from './reply-check.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/answer-path-userwalk-2026-10-13.json', import.meta.url), 'utf8'));
const frame = (n: number) => capture.frames.find((row: { frame: number }) => row.frame === n);

// Diagnostic replay of the combined five owning repairs, BEFORE the family redesign.
// Every provider output below is captured bytes. In particular, old false objections
// remain false objections; this does not pretend a new model saw the repaired packet.
// Clocks charge recorded provider durations and recorded intent-to-receipt transport.
// Local disk/admission overhead and acknowledgement scheduling have separate proofs.
it.each([
  { update: 6233124, intake: 399, answer: 404, jev: [415, 420], reviews: [426, 437], revision: 432, intent: 439, sent: 441, held: true },
  { update: 6233134, intake: 839, answer: 851, jev: [857], reviews: [863, 874], revision: 869, intent: 876, sent: 878, held: true },
  { update: 6233129, intake: 579, answer: 595, jev: [601], reviews: [607, 618], revision: 613, intent: 620, sent: 622, held: false },
])('replays the current journal and review chain for recorded update $update', async row => {
  const root = mkdtempSync(join(tmpdir(), 'answer-path-family-'));
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(77);
  const intake = frame(row.intake), raw = JSON.parse(intake.raw);
  let now = intake.at, jevIndex = 0, reviewIndex = 0;
  const stages: { stage: string; start: number; end: number; frame: number }[] = [];
  const charge = (stage: string, n: number) => {
    const start = now; now += frame(n).latencyMs;
    stages.push({ stage, start: start - intake.at, end: now - intake.at, frame: n });
    return frame(n).output as string;
  };
  const sent: string[] = [], evidence: ReturnType<typeof declaredObligations>[] = [];
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8989505249', chat: String(raw.message.chat.id),
    operator: String(raw.message.from.id), grant: 'grant:offline-family', configurationDigest: 'sha256:offline-family',
    expires: now + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 48000, cursor: 0 });
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
    prepareModel: (input: { question: string; context: string }) => JSON.stringify({ messages: [
      { role: 'user', content: input.question }, { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
    model: async () => charge('draft/format', row.answer),
    replyCheck: { elapsedMs: () => now,
      jev: async () => {
        const n = row.jev[jevIndex++]; expect(n).toBeDefined();
        const output = charge('jev', n!);
        // Frame 415 is the captured failed first Jev call; the separately reserved retry is 420.
        if (!output) throw Object.assign(Error('recorded Jev timeout'), { jevCause: 'timeout' });
        return { value: JSON.parse(output), latencyMs: frame(n!).latencyMs };
      },
      escalate: async (text: string, id: string, prompt?: string) => {
        const declared = declaredObligations(journal.view, id, now);
        evidence.push(JSON.parse(replyReviewContext(prompt!, text, [], declared)).declaredObligations);
        const n = row.reviews[reviewIndex++]; expect(n).toBeDefined();
        const output = charge('review', n!);
        const parsed = readAnswer(output, { wrapped: 'refuse', object: true });
        if (!parsed.ok) throw Error(parsed.defect);
        return { ...parseReplyReviewVerdict(parsed.value), confidence: null, latencyMs: frame(n!).latencyMs };
      },
      revise: async (input: { objections?: string[] }) => ({ state: 'complete' as const,
        ...parseReplyRevision(charge('revision', row.revision), input.objections ?? []) }) },
    send: async (input: { text: string }) => {
      const start = now; now += frame(row.sent).at - frame(row.intent).at;
      stages.push({ stage: 'transport', start: start - intake.at, end: now - intake.at, frame: row.sent });
      sent.push(input.text); return sent.length;
    } };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([raw]); await worker.drain();
    expect(evidence).toHaveLength(2);
    expect(sent).toHaveLength(1);
    expect(sent[0] === HOLDING_REPLY).toBe(row.held);
    if (row.update === 6233124) expect(evidence[0]!.dated).toEqual([]);
    if (row.update === 6233129) expect(evidence[0]!.dated).toHaveLength(1);
    if (row.update === 6233134) expect(evidence[1]!.blocker).toMatchObject({ constraint: 'operator-authority' });
    expect(journal.view.order[0]!.reservedAt).toBe(intake.at);
    console.log(JSON.stringify({ update: row.update, replay: 'five-owner-combination/recorded-verdicts',
      stages, terminalMs: now - intake.at, outcome: row.held ? 'holding-notice' : 'answer' }));
    worker.intake([raw]); await worker.drain(); expect(sent).toHaveLength(1);
    journal.close(); journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports); await worker.drain(); expect(sent).toHaveLength(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps a complete timing inventory for every exported turn, distinguishing receipts from answers', () => {
  const rows = capture.frames as { frame: number; kind: string; id: string; at: number; text?: string; update?: number }[];
  const turns = rows.filter(row => row.kind === 'intake' || row.kind === 'action-due');
  expect(turns).toHaveLength(16);
  for (const intake of turns) {
    const own = rows.filter(row => row.id === intake.id);
    const reserve = own.find(row => row.kind === 'reserve')!;
    const answer = own.find(row => row.kind === 'answer')!;
    const intent = own.find(row => row.kind === 'intent')!;
    const sent = own.find(row => row.kind === 'sent')!;
    expect(reserve.at).toBeGreaterThanOrEqual(intake.at);
    expect(sent.at).toBeGreaterThanOrEqual(intent.at);
    const first = own.find(row => row.kind === 'held-notice-sent') ?? sent;
    console.log(JSON.stringify({ update: intake.update ?? intake.id, replay: 'historical-receipts', queueMs: reserve.at - intake.at,
      draftMs: answer.at - reserve.at, reviewToIntentMs: intent.at - answer.at, transportMs: sent.at - intent.at,
      firstResponseMs: first.at - intake.at, terminalMs: sent.at - intake.at,
      outcome: intent.text === HOLDING_REPLY ? 'holding-notice' : 'answer' }));
  }
});
