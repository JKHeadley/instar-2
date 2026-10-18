import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openQuestionCandidates, projectMemoryText, raiseJournalCaps,
  UNKNOWN_ANSWER_NOTICE } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(11);
const genesis = (calls = 12) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'trial', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: calls, maxReplies: 12, maxTurns: 12, maxBytes: 32768, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-question-')));

it('keeps a cap-held operator question in the journal, then closes it only after its reply is accepted', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis(1));
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'The answer is 42.', send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'What is two plus two?')]); await worker.drain();
    worker.intake([update(2, 'What is the project code?')]); await worker.drain();
    expect(openQuestionCandidates(journal.view)).toMatchObject([{ quote: 'What is the project code?' }]);
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    expect(openQuestionCandidates(reopened.view)).toHaveLength(1);
    raiseJournalCaps(reopened, { maxCalls: 3, maxReplies: 12, maxTurns: 12, authority: 'Justin test cap raise', at: 1001 });
    expect(openQuestionCandidates(reopened.view)).toHaveLength(1);
    const resumed = createJournalWorker(reopened, { now: () => 1002, stopped: () => false,
      model: async () => "The project code is 71. I don't know who set it.", send: async () => 2, checkOutbound: () => {} });
    await resumed.drain();
    expect(reopened.view.order[1]?.sent).toBe(2);
    expect(openQuestionCandidates(reopened.view)).toEqual([]);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('keeps a cap-held question open across an UNKNOWN resumed send and replay', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis(1));
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'First answer.', send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'First question?'), update(2, 'Where is the project code?')]);
    await worker.drain();
    expect(openQuestionCandidates(journal.view)).toHaveLength(1);
    raiseJournalCaps(journal, { maxCalls: 3, maxReplies: 12, maxTurns: 12, authority: 'Justin test cap raise', at: 1001 });
    expect(openQuestionCandidates(journal.view)).toHaveLength(1);
    const resumed = createJournalWorker(journal, { now: () => 1002, stopped: () => false,
      model: async () => 'The project code is 71.', send: async () => null, checkOutbound: () => {} });
    await resumed.drain();
    expect(journal.view.order[1]?.intent).toBe('The project code is 71.');
    expect(journal.view.order[1]?.sent).toBeUndefined();
    expect(openQuestionCandidates(journal.view)).toHaveLength(1);
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    expect(openQuestionCandidates(reopened.view)).toHaveLength(1);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('keeps a lost answer open and closes it only when a listed model decision is actually sent', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
    const contexts: object[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => { const packet = JSON.parse(input.context); contexts.push(packet);
        if (input.question === 'Where is the launch plan?') return { state: 'uncertain' as const };
        const listed = packet.openQuestions?.[0]?.id;
        return JSON.stringify({ reply: 'The launch plan is in the shared folder.', memory: [], closedQuestions: [listed] }); },
      send: async () => contexts.length, checkOutbound: () => {} });
    worker.intake([update(1, 'Where is the launch plan?')]); await worker.drain();
    expect(journal.view.order[0]?.intent).toBe(`${UNKNOWN_ANSWER_NOTICE}`);
    expect(openQuestionCandidates(journal.view)).toHaveLength(1);
    worker.intake([update(2, 'I found a folder; can you answer the launch-plan question now?')]);
    await worker.drain();
    expect((contexts[1] as { openQuestions?: unknown[] }).openQuestions).toHaveLength(1);
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    expect(openQuestionCandidates(reopened.view)).toEqual([]);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('offers a durable held question to a later related turn without treating the hold as an answer', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
    let packet: { openQuestions?: { question: string }[] } = {};
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => { packet = JSON.parse(input.context); return 'I can look at the launch plan.'; },
      send: async () => 2, checkOutbound: () => {} });
    worker.intake([update(1, 'Where is the launch plan?')]);
    journal.append({ kind: 'hold', id: journal.view.order[0]!.id, reason: 'reply check unavailable', at: 1000 });
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    const resumed = createJournalWorker(reopened, { now: () => 1001, stopped: () => false,
      model: async input => { packet = JSON.parse(input.context); return 'I can look at the launch plan.'; },
      send: async () => 2, checkOutbound: () => {} });
    resumed.intake([update(2, 'Did you find that launch plan?')]); await resumed.drain();
    expect(packet.openQuestions?.[0]?.question).toBe('Where is the launch plan?');
    expect(openQuestionCandidates(reopened.view)).toHaveLength(1);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it.each([true, false])('uses a capped model decision for an uncertain reply cue (open=%s)', async shouldOpen => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
    let summaryCalls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => {
        if (!input.id.startsWith('summary:')) return "I don't know where the file is.";
        summaryCalls++;
        const packet = JSON.parse(input.context);
        expect(packet.unansweredCandidates).toHaveLength(1);
        return JSON.stringify({ summary: 'The file location remains uncertain.', people: [], memory: [],
          questions: shouldOpen ? [{ source: packet.unansweredCandidates[0].id, quote: 'Where is the file?' }] : [] });
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Where is the file?')]); await worker.drain();
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    await worker.summarizeIfNeeded();
    expect(summaryCalls).toBe(1);
    expect(journal.view.calls).toBe(2);
    expect(openQuestionCandidates(journal.view)).toHaveLength(shouldOpen ? 1 : 0);
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    expect(openQuestionCandidates(reopened.view)).toHaveLength(shouldOpen ? 1 : 0);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('leaves an uncertainty cue pending when the shared call cap cannot run its model review', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis(1));
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => "I don't know that answer.", send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Where is the file?')]); await worker.drain();
    await worker.summarizeIfNeeded();
    expect(journal.view.calls).toBe(1);
    expect(journal.view.questionsReviewed.size).toBe(0);
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('keeps an ungrounded model question decision pending instead of opening an invented item', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The file location is unknown.', people: [], memory: [],
          questions: [{ source: 'not-offered', quote: 'Where is the file?' }] })
        : "I don't know that answer.", send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Where is the file?')]); await worker.drain();
    await worker.summarizeIfNeeded();
    expect(journal.view.summaryFailures.size).toBe(1);
    expect(journal.view.questionsReviewed.size).toBe(0);
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    journal.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('does not close a lost question when the later answering send is UNKNOWN', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.question === 'Where is the plan?' ? { state: 'uncertain' as const }
        : JSON.stringify({ reply: 'The plan is in the folder.', memory: [],
          closedQuestions: [JSON.parse(input.context).openQuestions[0].id] }),
      send: async input => input.update === 1 ? 1 : null, checkOutbound: () => {} });
    worker.intake([update(1, 'Where is the plan?'), update(2, 'Tell me where the plan is now.')]);
    await worker.drain();
    expect(journal.view.order[1]?.intent).toBe('The plan is in the folder.');
    expect(journal.view.order[1]?.sent).toBeUndefined();
    expect(openQuestionCandidates(journal.view)).toHaveLength(1);
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    expect(openQuestionCandidates(reopened.view)).toHaveLength(1);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('accepts model closure of an offered question in a mixed-certainty reply', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.question === 'Where is the plan?' ? { state: 'uncertain' as const }
        : JSON.stringify({ reply: "The plan is in the cedar drawer. I don't know who put it there.", memory: [],
          closedQuestions: [JSON.parse(input.context).openQuestions[0].id] }),
      send: async input => input.update, checkOutbound: () => {} });
    worker.intake([update(1, 'Where is the plan?'), update(2, 'Tell me where the plan is now.')]);
    await worker.drain();
    expect(journal.view.order[1]?.sent).toBe(2);
    expect(journal.view.order[1]?.closedQuestions).toEqual(['telegram:12345678:update:1']);
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    expect(openQuestionCandidates(reopened.view)).toEqual([]);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});

it('applies correction and forgetting to an open question, and refuses an unlisted closure', async () => {
  const path = root();
  try {
    const journal = openPreviewJournal(join(path, 'journal.encrypted'), key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async input => input.question.includes('later')
        ? JSON.stringify({ reply: 'I still cannot answer it.', memory: [], closedQuestions: ['not-offered'] })
        : { state: 'uncertain' as const }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'What is my private phrase blue lantern?')]); await worker.drain();
    worker.intake([update(2, 'Can you answer it later?')]); await worker.drain();
    expect(openQuestionCandidates(journal.view)).toHaveLength(1);
    const source = 'telegram:12345678:update:1', correction = 'telegram:12345678:update:3';
    worker.intake([update(3, 'Actually my private phrase is green lantern, not blue lantern.')]);
    journal.append({ kind: 'reserve', id: correction, at: 1000 });
    journal.append({ kind: 'answer', id: correction, text: 'I corrected it.', memory: [{ mode: 'correct', source,
      quote: 'my private phrase blue lantern', trigger: correction, replacement: 'my private phrase is green lantern' }], at: 1000 });
    expect(openQuestionCandidates(journal.view)).toHaveLength(1);
    expect(projectMemoryText(journal.view, openQuestionCandidates(journal.view)[0]!.quote)).not.toContain('blue lantern');
    const proposed = worker.probe('Can you answer that question?');
    const projected = 'context' in proposed ? JSON.parse(proposed.context) : {};
    expect(projected.openQuestions?.[0]?.question).not.toContain('blue lantern');
    expect(projected.history?.[0]?.user).not.toContain('blue lantern');
    const forget = 'telegram:12345678:update:4';
    worker.intake([update(4, 'Forget my private phrase is green lantern.')]);
    journal.append({ kind: 'reserve', id: forget, at: 1000 });
    journal.append({ kind: 'answer', id: forget, text: 'I will forget it.',
      memory: [{ mode: 'forget', source, quote: 'my private phrase blue lantern', trigger: forget }], at: 1000 });
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    journal.close();
    const reopened = openPreviewJournal(join(path, 'journal.encrypted'), key);
    expect(openQuestionCandidates(reopened.view)).toEqual([]);
    reopened.close();
  } finally { rmSync(path, { recursive: true, force: true }); }
});
