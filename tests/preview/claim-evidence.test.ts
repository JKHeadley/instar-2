import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { REPLY_RULES, replyRevisionQuestion, parseReplyReviewVerdict, type ReplyRule } from './reply-check.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { guidanceVerdicts } from './guidance.js';
import { conclusionText } from './model-json.js';
import { readAnswer } from './answer-reading.js';
import type { Turn } from './journal.js';

const envelope = (id: string, context = '{}') => JSON.parse(prepareJournalEnvelope(
  { id, question: 'Has the requested work finished?', context }, 'sonnet', 'offline', 1000));

it('grounds each answer in evidence, including after compaction, without changing the recorded packet', () => {
  for (const packet of [{}, { continuity: { through: 7, lastInbound: 'turn:7' } }]) {
    const messages = envelope('turn:8', JSON.stringify(packet)).messages;
    expect(messages.find((m: { role: string }) => m.role === 'instructions').content).toContain('not verified');
    expect(JSON.parse(messages.find((m: { role: string }) => m.role === 'context').content).packet).toEqual(packet);
  }
});

it('uses the existing contextual claim question and revision, without a new review question', () => {
  expect(REPLY_RULES.self_state_claim).toContain('unsupported');
  const revision = prepareJournalEnvelope({ id: 'turn:8:reply-revision',
    question: replyRevisionQuestion(['self_state_claim']), context: '{}' }, 'sonnet', 'offline', 1000);
  expect(revision).toContain('not verified');
  expect(revision.match(/Ground completion and factual claims/gu)).toHaveLength(1);
});

it('does not add answer instructions to summary or review tasks', () => {
  for (const id of ['summary:7', 'turn:7:reply-review'])
    expect(envelope(id).messages.some((m: { role: string }) => m.role === 'instructions')).toBe(false);
});

// Constructed model responses test the existing answer/revision/send integration;
// they do not claim a real model followed the new wording. Recorded replays follow.
async function deliver(draft: string, revision?: string, review?: ReturnType<typeof parseReplyReviewVerdict>, evidence?: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'claim-evidence-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(39);
  const journal = openPreviewJournal(path, key, {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'offline',
    configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 12, maxReplies: 4, maxTurns: 4, maxBytes: 131072, cursor: 0 });
  const sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, {
      now: () => 1790000000000, stopped: () => false, checkOutbound: () => {},
      sources: () => evidence ? [{ id: 'operation-outcome', title: 'Recorded result', text: evidence }] : [],
      prepareModel: input => {
        const prompt = prepareJournalEnvelope(input, 'sonnet', 'offline', 1790000000000);
        expect(prompt).toContain('not verified');
        return prompt;
      },
      model: async () => draft,
      send: async input => { sent.push(input.expectedText); return sent.length; },
      replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: null, latencyMs: 0 }),
        escalate: async (_text, _id, _prompt, rules, _deadline, operation) => {
          if (operation !== 'revision') expect(rules).toContain('self_state_claim');
          return operation !== 'revision' && revision !== undefined
            ? { ...(review ?? { verdict: 'violation' as const, ruleIds: ['self_state_claim' as const] }), confidence: null, latencyMs: 0 }
            : { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 };
        },
        ...(revision === undefined ? {} : { revise: async () => {
          return { state: 'complete' as const, text: revision,
            dispositions: [{ objection: 'self_state_claim', decision: 'accept' as const }] };
        } }) },
    });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'What is the outcome?' } }]);
    await worker.drain();
    await worker.drain();
    journal.close();
    const reopened = openPreviewJournal(path, key);
    const turn = reopened.view.order[0]!;
    reopened.close();
    if (revision !== undefined) expect(turn.revision, JSON.stringify({ checks: turn.replyChecks, release: turn.release, held: turn.held })).toBeDefined();
    return { sent, turn };
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it.each([
  ['Done.', 'Done as far as I can tell, not verified.', undefined],
  ['The backup finished.', 'I am not sure whether the backup finished.', 'Backup result: uncertain; no completion receipt.'],
])('sends the evidence-qualified revision once, preserving the original draft: %s', async (draft, revision, evidence) => {
  const result = await deliver(draft!, revision, undefined, evidence);
  expect(result.sent).toEqual([revision]);
  expect(result.turn.answer).toBe(draft);
  expect(guidanceVerdicts([result.turn]).find(row => row.member === 'claim-verification'))
    .toMatchObject({ verdict: 'fired', landing: 'revised', decisions: ['accept'] });
});

it.each(['You are welcome!', 'Did it finish?', 'Suppose someone said “done”.'])(
  'leaves supported claims and ordinary conversation unchanged: %s', async draft => {
    expect((await deliver(draft)).sent).toEqual([draft]);
  });

it('states a recorded successful outcome plainly', async () => {
  const text = 'The backup finished and all files passed verification.';
  expect((await deliver(text, undefined, undefined, 'Backup result: complete; every requested file copied and verified.')).sent).toEqual([text]);
});

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

it('replays the recorded claim finding through revision/send, and keeps supported neighbours clear', async () => {
  const recorded = fixture('guidance-live-2026-10-03.json') as {
    turns: Turn[]; samples: { update: number; raw: string; rules: ReplyRule[] }[] };
  for (const update of [969389926, 969390016, 969389883]) {
    const sample = recorded.samples.find(row => row.update === update)!;
    const review = parseReplyReviewVerdict(conclusionText(JSON.parse(sample.raw).conclusion.value)!, sample.rules);
    expect(review.findings!.find(row => row.rule === 'self_state_claim')!.verdict)
      .toBe(update === 969389926 ? 'violation' : 'pass');
    if (update !== 969389926) continue;
    const turn = recorded.turns.find(row => row.update === update)!;
    // Exact captured draft and reviewer bytes; the revision alone is constructed.
    const result = await deliver(turn.answer!, 'I am not sure that nothing is overdue; that claim is not verified.', review);
    expect(result.sent).toEqual(['I am not sure that nothing is overdue; that claim is not verified.']);
    expect(guidanceVerdicts([result.turn]).find(row => row.member === 'claim-verification')?.landing).toBe('revised');
  }
});

it('carries real uncertain/undecided worker shapes as evidence without promoting them to verified facts', () => {
  const shapes = fixture('retrospective-duty-followup-train-1-2026-10-08.json').otherShapes as
    { kind: string; id: string; raw: string }[];
  expect(shapes.map(row => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of shapes) {
    const packet = { history: [{ id: row.id, sourceLabel: row.kind, answer: row.raw }] };
    const messages = envelope('turn:8', JSON.stringify(packet)).messages;
    expect(JSON.parse(messages.find((m: { role: string }) => m.role === 'context').content).packet).toEqual(packet);
    const instructions = messages.find((m: { role: string }) => m.role === 'instructions').content;
    expect(instructions).toContain('when the record is uncertain say you are not sure');
    expect(instructions).toContain('source label or completed model call alone is not proof');
    if (row.kind === 'summary-writer' || row.kind === 'reply-review')
      expect(readAnswer(row.raw, { wrapped: 'accept', evidence: [row.id] }).ok).toBe(true);
  }
  expect(JSON.parse(shapes.find(row => row.kind === 'summary-uncertain')!.raw).state).toBe('uncertain');
  expect(JSON.parse(shapes.find(row => row.kind === 'jev-undecided')!.raw).verdict).toBe('undecided');
  expect(shapes.find(row => row.kind === 'empty-reply-in-recorded-context')!.raw).toBe('');
});
