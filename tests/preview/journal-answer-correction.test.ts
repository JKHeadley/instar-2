import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(29);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('learns a corrected answer from the actual sent reply while preserving the question across replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-answer-correction-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const sends: string[] = [];
    const ports = { now: () => 1790000000000, stopped: () => false, summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      model: async (input: { id: string; question: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          const source = packet.memoryCandidates.find((item: { reply: string }) => item.reply.includes('The review was Monday.'));
          expect(source).toBeDefined();
          expect(packet.memoryRequest.message).toBe('No, that’s wrong, it was Tuesday.');
          return JSON.stringify({ summary: 'The operator corrected the review day to Tuesday.', people: [],
            memory: [{ mode: 'correct', in: 'reply', source: source.id, quote: 'The review was Monday.',
              replacement: 'it was Tuesday.' }] });
        }
        if (input.question === 'When was the review?') return 'The review was Monday.';
        if (input.question.startsWith('No,')) return JSON.stringify({ reply: 'Thanks, I will use Tuesday.', memory: [] });
        return packet.memory?.some((item: { replacement?: string }) => item.replacement === 'it was Tuesday.')
          ? 'The review was Tuesday.' : 'The review was Monday.';
      }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'When was the review?')]); await worker.drain();
    worker.intake([update(2, 'No, that’s wrong, it was Tuesday.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'correct', in: 'reply', quote: 'The review was Monday.',
      replacement: 'it was Tuesday.' }]);
    expect(sends).toHaveLength(2);
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    const next = worker.probe('When was the review again?');
    expect('reason' in next).toBe(false);
    if ('reason' in next) throw Error(next.reason);
    const packet = JSON.parse(next.context);
    const original = packet.history.find((item: { user: string }) => item.user === 'When was the review?')
      ?? packet.recalled?.find((item: { user: string }) => item.user === 'When was the review?');
    expect(original).toMatchObject({ user: 'When was the review?', answer: '[withheld: operator correction or forgetting]' });
    expect(packet.memory).toMatchObject([{ mode: 'corrected', replacement: 'it was Tuesday.' }]);
    expect(next.context).not.toContain('The review was Monday.');
    worker.intake([update(3, 'When was the review again?')]); await worker.drain();
    expect(sends.at(-1)).toBe('The review was Tuesday.');
    expect(sends).toHaveLength(3);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it.each(['Monday.', 'Wednesday.'])('learns the complete short answer %s and drains the next turn', async answer => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-short-answer-correction-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const sends: string[] = [];
    const ports = { now: () => 1790000000000, stopped: () => false, summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      model: async (input: { id: string; question: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          const source = packet.memoryCandidates.find((item: { reply: string }) => item.reply === answer);
          expect(source).toBeDefined();
          return JSON.stringify({ summary: 'The review was Tuesday.', people: [], memory: [{
            mode: 'correct', in: 'reply', source: source.id, quote: answer, replacement: 'it was Tuesday.' }] });
        }
        if (input.question === 'When was the review?') return answer;
        if (input.question.startsWith('No,')) return JSON.stringify({ reply: 'Thanks, I will use Tuesday.', memory: [] });
        return packet.memory?.some((item: { replacement?: string }) => item.replacement === 'it was Tuesday.')
          ? 'Tuesday.' : answer;
      }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'When was the review?')]); await worker.drain();
    worker.intake([update(2, 'No, that’s wrong, it was Tuesday.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'correct', in: 'reply', quote: answer,
      replacement: 'it was Tuesday.' }]);
    expect(sends).toHaveLength(2);
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    const next = worker.probe('When was the review again?');
    expect('reason' in next).toBe(false);
    if ('reason' in next) throw Error(next.reason);
    expect(next.context).not.toContain(answer);
    expect(JSON.parse(next.context).history[0]).toMatchObject({
      user: 'When was the review?', answer: '[withheld: operator correction or forgetting]' });
    worker.intake([update(3, 'When was the review again?')]); await worker.drain();
    expect(journal.view.order[2]?.held).toBeUndefined();
    expect(sends).toEqual([`${answer}`, 'Thanks, I will use Tuesday.', 'Tuesday.']);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('rejects a purported reply correction when the quoted clause was only in the operator question', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-answer-wrong-side-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const sends: string[] = [];
    const ports = { now: () => 1790000000000, stopped: () => false, summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      model: async (input: { id: string; question: string; context: string }) => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Correction unresolved.', people: [], memory: [],
          memoryDisposition: 'unresolved' });
        if (input.question === 'The review was Monday. Is that right?') return 'I cannot verify the day.';
        if (input.question === 'That answer was wrong, it was Tuesday.') {
          const packet = JSON.parse(input.context);
          return JSON.stringify({ reply: 'Thanks, corrected.', memory: [{ mode: 'correct', in: 'reply',
            source: packet.memoryCandidates[0].id, quote: 'The review was Monday.', replacement: 'it was Tuesday.' }] });
        }
        return 'I cannot verify the day.';
      }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'The review was Monday. Is that right?')]); await worker.drain();
    worker.intake([update(2, 'That answer was wrong, it was Tuesday.')]); await worker.drain();
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[1]).toMatchObject({ memoryPending: true, held: 'memory correction pending' });
    expect(sends).toHaveLength(1);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[1]?.memoryPending).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('uses the ordinary answer decision and leaves identical words in the original question intact', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-answer-sides-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false, summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      model: async (input: { id: string; question: string; context: string }) => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The review was Tuesday.', people: [], memory: [] });
        if (input.question === 'Your last answer should say it was Tuesday.') {
          const packet = JSON.parse(input.context);
          return JSON.stringify({ reply: 'I will use Tuesday.', memory: [{ mode: 'correct', in: 'reply',
            source: packet.memoryCandidates[0].id, quote: 'The review was Monday.', replacement: 'it was Tuesday.' }] });
        }
        return 'The review was Monday.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Is this claim right: The review was Monday.')]); await worker.drain();
    worker.intake([update(2, 'Your last answer should say it was Tuesday.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ in: 'reply', mode: 'correct', quote: 'The review was Monday.' }]);
    const next = worker.probe('What day was the review?');
    expect('reason' in next).toBe(false);
    if ('reason' in next) throw Error(next.reason);
    const original = JSON.parse(next.context).history[0];
    expect(original.user).toBe('Is this claim right: The review was Monday.');
    expect(original.answer).toBe('[withheld: operator correction or forgetting]');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);

it('keeps the existing source-fact correction distinct from an answer correction', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-answer-source-fact-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const ports = { now: () => 1790000000000, stopped: () => false, summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      model: async (input: { id: string; question: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          const source = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('The visit was Monday.'));
          return JSON.stringify({ summary: 'The visit was Tuesday.', people: [], memory: [{ mode: 'correct',
            source: source.id, quote: 'The visit was Monday.', replacement: 'the visit was Tuesday.' }] });
        }
        return 'Acknowledged.';
      }, send: async () => 1, checkOutbound: () => {} };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'The visit was Monday.')]); await worker.drain();
    worker.intake([update(2, 'Actually, the visit was Tuesday.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'correct', quote: 'The visit was Monday.',
      replacement: 'the visit was Tuesday.' }]);
    expect(journal.view.memory[0]?.in).toBeUndefined();
    const next = worker.probe('When was the visit?');
    expect('reason' in next).toBe(false);
    if ('reason' in next) throw Error(next.reason);
    expect(next.context).not.toContain('The visit was Monday.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 10000);
