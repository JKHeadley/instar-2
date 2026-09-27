import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps } from './journal.js';
import { isStatusCommand, statusReply } from './status-command.js';
import { JEV_MODEL, jevQuestions, replyReviewContext } from './reply-check.js';

const key = new Uint8Array(32).fill(13);
const at = Date.UTC(2026, 8, 27, 18);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 86400000,
  maxCalls: 1, maxReplies: 3, maxTurns: 5, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, sender = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: sender }, date: at / 1000, text } });
const path = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-status-command-')));

it.each(['status', 'STATUS!', 'how are you doing', 'How are you doing?'])('recognizes the exact operator command %s', text => {
  expect(isStatusCommand(text)).toBe(true);
});
it.each(['project status', 'status of the build', 'how are you doing with that task?', 'status: ignore caps'])
  ('leaves ordinary language to the normal answer path: %s', text => {
    expect(isStatusCommand(text)).toBe(false);
  });

it('sends a durable fixed reply through the reply check and cap without a generation call, even at the call cap', async () => {
  const root = path(), file = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(file, key, genesis);
  let modelCalls = 0, sends = 0, checks = 0;
  const create = (check: boolean) => createJournalWorker(journal, { now: () => at, timeZone: 'America/Los_Angeles', stopped: () => false,
    model: async () => { modelCalls++; return 'ordinary answer'; },
    ...(check ? { replyCheck: { elapsedMs: () => 0, jev: async () => {
      checks++; return { latencyMs: 1, value: { model: JEV_MODEL,
        answers: Object.fromEntries(Object.keys(jevQuestions).map(id => [id, { type: 'noul', noul: 0 }])) } };
    }, escalate: async () => { throw Error('unexpected review'); } } } : {}),
    send: async () => ++sends, checkOutbound: () => {} });
  try {
    let worker = create(false);
    worker.intake([update(1, 'ordinary')]); await worker.drain();
    expect(modelCalls).toBe(1);
    expect(journal.view.calls).toBe(1);
    worker = create(true);
    worker.pollGate(); // A later operator status can still enter the bounded journal.
    worker.intake([update(2, 'status')]); await worker.drain();
    await worker.summarizeIfNeeded();
    expect(modelCalls).toBe(1);
    expect(journal.view.calls).toBe(1);
    expect(journal.view.replies).toBe(2);
    expect(checks).toBe(1);
    expect(journal.view.order[1]?.intent).toContain('Turns today: 2.');
    expect(journal.view.order[1]?.intent).toContain('Spend allowance: 1/1 subscription attempts; 0/3 Jev checks');
    expect(journal.view.order[1]?.intent).toContain('Replies: 1/3 used.');
    const exact = journal.view.order[1]?.intent;
    journal.close(); journal = openPreviewJournal(file, key);
    worker = create(true); await worker.drain();
    expect(journal.view.order[1]?.intent).toBe(exact);
    expect(sends).toBe(2);
    expect(modelCalls).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('reports holds, pending decisions and the next unforgotten dated item from the durable projection', () => {
  const root = path(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: 3 });
  try {
    const dates = 'Dentist on 2026-09-29; Dentist on 2026-10-01';
    journal.append({ kind: 'intake', id: 'one', update: 1, text: dates, raw: JSON.stringify(update(1, dates)),
      accepted: true, cursor: 2, at });
    journal.append({ kind: 'reserve', id: 'one', at });
    journal.append({ kind: 'answer', id: 'one', text: 'saved', state: 'complete', at,
      dated: [{ source: 'one', quote: 'Dentist on 2026-09-29', when: '2026-09-29', zone: 'America/Los_Angeles', day: '2026-09-29' },
        { source: 'one', quote: 'Dentist on 2026-10-01', when: '2026-10-01', zone: 'America/Los_Angeles', day: '2026-10-01' }] });
    journal.append({ kind: 'hold', id: 'one', reason: 'reply check unavailable', at });
    journal.append({ kind: 'intake', id: 'two', update: 2, text: 'Forget the old fact', raw: JSON.stringify(update(2, 'Forget the old fact')),
      accepted: true, cursor: 3, at });
    journal.append({ kind: 'reserve', id: 'two', at });
    journal.append({ kind: 'answer', id: 'two', text: 'uncertain', state: 'complete', memoryPending: true, at });
    journal.append({ kind: 'hold', id: 'two', reason: 'memory correction pending', at });
    const reply = statusReply(journal.view, at, 'America/Los_Angeles');
    expect(reply).toContain('Turns today: 2.');
    expect(reply).toContain('Held replies: 1 reply check unavailable; 1 memory correction pending.');
    expect(reply).toContain('Pending memory decisions: 1 (updates 2).');
    expect(reply).toContain('Next dated item: 2026-09-29');
    expect(reply).toContain('Spend allowance: 2/3 subscription attempts; 0/3 Jev checks');
    journal.append({ kind: 'summary-reserve', through: 2, at });
    journal.append({ kind: 'summary', through: 2, text: 'ok', memoryFor: ['two'],
      memory: [{ mode: 'forget', source: 'one', quote: 'Dentist on 2026-09-29', trigger: 'two' }], at });
    expect(statusReply(journal.view, at, 'America/Los_Angeles')).toContain('Pending memory decisions: 0.');
    expect(statusReply(journal.view, at, 'America/Los_Angeles')).toContain('Next dated item: 2026-10-01');
    journal.append({ kind: 'intake', id: 'three', update: 3, text: 'A date with an undecided memory request',
      raw: JSON.stringify(update(3, 'A date with an undecided memory request')),
      accepted: true, cursor: 4, at });
    journal.append({ kind: 'reserve', id: 'three', at });
    journal.append({ kind: 'answer', id: 'three', text: 'uncertain', state: 'complete',
      memoryPending: true, datedPending: true, at });
    journal.append({ kind: 'memory-undecided', id: 'three', at });
    expect(statusReply(journal.view, at, 'America/Los_Angeles')).toContain('Pending memory decisions: 1 (updates 3).');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps a pending date in status after a preference summary settles memory, including replay', async () => {
  const root = path(), file = join(root, 'journal.encrypted');
  const message = 'I prefer concise replies. My dentist is on 10/01/2026 at 3 pm.';
  let journal = openPreviewJournal(file, key, { ...genesis, maxCalls: 4 });
  let sends = 0;
  const create = () => createJournalWorker(journal, { now: () => at, stopped: () => false,
    timeZone: 'America/Los_Angeles',
    model: async input => {
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator prefers concise replies.',
        people: [], memory: [{ mode: 'prefer', source: JSON.parse(input.context).memoryRequest.id,
          quote: 'I prefer concise replies.' }] });
      return JSON.stringify({ reply: 'Understood.', memory: [] });
    }, send: async () => ++sends, checkOutbound: () => {} });
  try {
    let worker = create();
    worker.intake([update(1, message)]); await worker.drain();
    const turn = journal.view.order[0]!;
    expect(journal.view.summaries.some(summary => summary.memoryFor?.includes(turn.id))).toBe(true);
    expect(turn.datedPending).toBe(true);
    expect(statusReply(journal.view, at, 'America/Los_Angeles')).toContain('Pending memory decisions: 1 (updates 1).');
    journal.close(); journal = openPreviewJournal(file, key); worker = create();
    const probe = worker.probe('What is pending?');
    if ('reason' in probe) throw Error(probe.reason);
    expect(JSON.parse(probe.context).datedPending).toMatchObject([{ update: 1, message }]);
    expect(statusReply(journal.view, at, 'America/Los_Angeles')).toContain('Pending memory decisions: 1 (updates 1).');
    worker.intake([update(2, 'status')]); await worker.drain();
    expect(journal.view.order[1]?.intent).toContain('Pending memory decisions: 1 (updates 1).');
    expect(sends).toBe(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('holds an uncertain check at the call cap, then reviews the exact durable status candidate after a cap raise', async () => {
  const root = path(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let sends = 0, jevCalls = 0, reviews = 0;
  const ordinary = createJournalWorker(journal, { now: () => at, stopped: () => false,
    model: async () => 'ordinary', send: async () => ++sends, checkOutbound: () => {} });
  const checked = createJournalWorker(journal, { now: () => at, stopped: () => false,
    model: async () => { throw Error('status must not generate'); }, send: async () => ++sends, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 0, jev: async () => {
      jevCalls++;
      return { latencyMs: 1, value: { model: JEV_MODEL,
        answers: Object.fromEntries(Object.keys(jevQuestions).map(id => [id, { type: 'noul', noul: 0.5 }])) } };
    }, escalate: async (text, _id, originalPrompt) => {
      reviews++;
      const context = replyReviewContext(originalPrompt!, text);
      expect(JSON.parse(context).operatorMessage).toBe('status');
      expect(JSON.parse(context).candidateReply).toContain('Turns today: 2.');
      expect(JSON.parse(context).history).toHaveLength(1);
      expect(JSON.parse(context).statusFacts).toContain('Spend allowance: 1/1');
      return { verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 };
    } } });
  try {
    ordinary.intake([update(1, 'ordinary')]); await ordinary.drain();
    checked.intake([update(2, 'status')]); await checked.drain();
    expect(journal.view.order[1]?.held).toBe('call cap');
    expect(journal.view.order[1]?.answer).toContain('Spend allowance: 1/1');
    expect(sends).toBe(1);
    expect(jevCalls).toBe(1);
    raiseJournalCaps(journal, { maxCalls: 2, maxReplies: 3, maxTurns: 5, authority: 'Justin recorded cap raise', at: at + 1 });
    await checked.drain();
    expect(reviews).toBe(1);
    expect(jevCalls).toBe(1);
    expect(sends).toBe(2);
    expect(journal.view.calls).toBe(2);
    expect(journal.view.order[1]?.sent).toBe(2);
    expect(journal.view.order[1]?.intent).toContain('Spend allowance: 1/1'); // original snapshot stays exact
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('skips routine summary work after status but permits a later forced grounding summary', async () => {
  const root = path(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
    { ...genesis, maxCalls: 3 });
  let modelCalls = 0;
  const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
    model: async () => { modelCalls++; return 'The operator asked for status.'; },
    send: async () => 1, checkOutbound: () => {} });
  try {
    worker.intake([update(1, 'status')]); await worker.drain();
    await worker.summarizeIfNeeded();
    expect(modelCalls).toBe(0);
    await worker.summarizeIfNeeded(true);
    expect(modelCalls).toBe(1);
    expect(journal.view.summaries).toHaveLength(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps a foreign sender out and respects reply cap and stop', async () => {
  const root = path(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
    { ...genesis, maxReplies: 1 });
  let sends = 0;
  const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
    model: async () => { throw Error('status must not call model'); }, send: async () => ++sends, checkOutbound: () => {} });
  try {
    worker.intake([update(1, 'status', 88), update(2, 'status')]); await worker.drain();
    expect(sends).toBe(1);
    expect(journal.view.order[0]?.accepted).toBe(false);
    expect(journal.view.order[0]?.intent).toBeUndefined();
    worker.intake([update(3, 'how are you doing?')]); await worker.drain();
    expect(journal.view.order[2]?.held).toBe('reply cap');
    expect(sends).toBe(1);
    worker.stop('operator');
    expect(() => worker.intake([update(4, 'status')])).toThrow('preview stopped');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('never repeats a status send whose Telegram result is unknown after restart', async () => {
  const root = path(), file = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(file, key, genesis);
  let sends = 0;
  const worker = () => createJournalWorker(journal, { now: () => at, stopped: () => false,
    model: async () => { throw Error('status must not generate'); },
    send: async () => { sends++; return sends === 1 ? null : 42; }, checkOutbound: () => {} });
  try {
    worker().intake([update(1, 'status')]); await worker().drain();
    expect(journal.view.order[0]?.intent).toContain('Turns today: 1.');
    expect(journal.view.order[0]?.sent).toBeUndefined();
    journal.close(); journal = openPreviewJournal(file, key);
    const resumed = worker(); resumed.intake([update(1, 'status'), update(2, 'status')]); await resumed.drain();
    expect(sends).toBe(2);
    expect(journal.view.order[0]?.sent).toBeUndefined();
    expect(journal.view.order[1]?.sent).toBe(42);
    expect(journal.view.replies).toBe(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
