import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { REPLY_RULES } from './reply-check.js';

const corpus = [
  ['chat', 'Good morning.', 'Good morning!'],
  ['chat', 'Can you explain why the sky looks blue?', 'Short wavelengths scatter more in the atmosphere.'],
  ['chat', 'Thanks, that helps.', 'You are welcome.'],
  ['chat', 'What is a useful way to plan my week?', 'Pick three priorities and put them on your calendar.'],
  ['chat', 'Tell me a short joke.', 'Why did the book go outside? It needed fresh air.'],
  ['chat', 'How should I start a difficult email?', 'Begin with the purpose in one sentence.'],
  ['code', 'Show a Python function that adds two numbers.', 'def add(a, b): return a + b'],
  ['code', 'What does `git status` show?', '`git status` shows changed files and staging state.'],
  ['code', 'Explain this config key: app.cache.size.', 'It controls the cache size.'],
  ['code', 'Why does /tmp/example.txt appear in this error?', 'The program tried to read /tmp/example.txt.'],
  ['note', 'My garden has two lemon trees.', 'I will remember that you have two lemon trees.'],
  ['note', 'My friend Mira likes chess.', 'I will remember that Mira likes chess.'],
  ['note', 'I moved my desk near the window.', 'I will remember where you moved your desk.'],
  ['note', 'The blue notebook is for travel ideas.', 'I will remember the notebook purpose.'],
  ['memory', 'What do you remember about my garden?', 'You said your garden has two lemon trees.'],
  ['memory', 'What did I tell you about Mira?', 'You said Mira likes chess.'],
  ['memory', 'Do you recall where I moved my desk?', 'You moved it near the window.'],
  ['memory', 'What was the blue notebook for?', 'You said it is for travel ideas.'],
] as const;

const key = new Uint8Array(32).fill(61);
const now = 1_790_000_000_000;
const update = (id: number, message: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: message,
    date: Math.floor(now / 1000) + id * 60 } });

it('measures first-attempt held replies on a mixed conversation corpus', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-hold-rate-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis',
    bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
    configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
  let reviews = 0;
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator chatted, asked for code help, and supplied personal notes.', people: [], memory: [] })
      : JSON.stringify({ reply: corpus.find(item => item[1] === input.question)?.[2] ?? 'Okay.',
        // The ordinary structured reply shape observed from model stubs can omit
        // an optional memory decision. Explicit empty decisions cover the neighbor.
        ...(input.question.includes('notebook') || input.question.includes('plan my week') ? { memory: [] } : {}) }),
    send: async () => 1, checkOutbound: () => {}, replyCheck: {
      elapsedMs: () => 0,
      jev: async text => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
        Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: id === 'cli_command' && text.includes('git status')
          || id === 'raw_path' && text.includes('/tmp/') ? 0.91 : 0.01 }])) }, latencyMs: 1 }),
      escalate: async () => { reviews++; return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1,
        reason: 'The requested technical explanation is appropriate in this private chat.' }; },
    } });
  try {
    const reasons: Record<string, number> = {};
    const categories: Record<string, { total: number; held: number }> = {};
    for (const [index, [category, question]] of corpus.entries()) {
      worker.intake([update(index + 1, question)]);
      await worker.drain();
      const turn = journal.view.order[index]!;
      const held = !turn.intent;
      categories[category] ??= { total: 0, held: 0 };
      categories[category]!.total++;
      categories[category]!.held += Number(held);
      if (held) reasons[turn.held ?? 'unknown'] = (reasons[turn.held ?? 'unknown'] ?? 0) + 1;
    }
    const totalHeld = Object.values(reasons).reduce((sum, count) => sum + count, 0);
    console.info('hold-rate corpus', JSON.stringify({ total: corpus.length, held: totalHeld,
      rate: totalHeld / corpus.length, reasons, categories, reviews }));
    expect(totalHeld / corpus.length).toBeLessThanOrEqual(0.1);
    expect(reviews).toBe(2);
    expect(journal.view.replyCheckPaths.subscription).toBe(2);
    expect(journal.view.order.filter(turn => turn.intent)).toHaveLength(corpus.length);
    expect(journal.view.memory).toEqual([]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('holds an unresolved direct forget request before answering', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-hold-forget-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis',
    bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
    configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => input.id.startsWith('summary:')
      ? '{"summary":"A forget request has no known target.","people":[],"memory":[],"memoryDisposition":"unresolved"}'
      : '{"reply":"I forgot it."}',
    send: async () => 1, checkOutbound: () => {} });
  try {
    worker.intake([update(1, 'Forget my old address.')]); await worker.drain();
    expect(journal.view.order[0]?.held).toBe('memory correction pending');
    expect(journal.view.order[0]?.intent).toBeUndefined();
    expect(journal.view.memory).toEqual([]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps an explicit invalid memory action held while an omitted decision on ordinary chat can send', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-hold-memory-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis',
    bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
    configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
    maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 16000, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => input.question === 'Good morning.' ? '{"reply":"Good morning!"}'
      : '{"reply":"I saved it.","memory":[{"mode":"forget","source":"invented","quote":"invented"}]}',
    send: async () => 1, checkOutbound: () => {} });
  try {
    worker.intake([update(1, 'Good morning.')]); await worker.drain();
    expect(journal.view.order[0]?.sent).toBe(1);
    worker.intake([update(2, 'What do you remember?')]); await worker.drain();
    expect(journal.view.order[1]).toMatchObject({ held: 'memory correction pending', memoryPending: true });
    expect(journal.view.order[1]?.intent).toBeUndefined();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
