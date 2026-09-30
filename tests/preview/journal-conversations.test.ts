import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import type { PreviewPorts } from './journal.js';
import { REPLY_RULES } from './reply-check.js';

const key = new Uint8Array(32).fill(9);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-conversations-')));
const genesis = (overrides: Partial<{ maxCalls: number; maxReplies: number; maxTurns: number; maxBytes: number }> = {}) => ({
  kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100,
  maxBytes: 262144, cursor: 0, ...overrides });
/** The operator's private chat; `thread` is one of its Telegram topics. */
const update = (id: number, text: string, thread?: number, date?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    ...(thread === undefined ? {} : { message_thread_id: thread, is_topic_message: true }),
    ...(date === undefined ? {} : { date }) } });
type Seen = { id: string; question: string; context: string };
type Sent = { chat: string; thread?: number; update: number };

function world(root: string, options: { initial?: ReturnType<typeof genesis>; send?: (input: Sent) => number | null;
  model?: (input: Seen) => string | { state: 'rejected'; failureClass: 'rejected' };
  replyCheck?: PreviewPorts['replyCheck'] } = {}) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, options.initial ?? genesis());
  const seen: Seen[] = [], sent: Sent[] = [];
  let stopped = false;
  const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => stopped,
    model: async input => { seen.push(input); return options.model?.(input) ?? 'noted'; },
    send: async input => { const { chat, thread, update: id } = input;
      sent.push({ chat, update: id, ...(thread === undefined ? {} : { thread }) });
      return options.send ? options.send(sent.at(-1)!) : sent.length; },
    checkOutbound: () => {}, ...(options.replyCheck ? { replyCheck: options.replyCheck } : {}) });
  return { journal, worker, seen, sent, stop: () => { stopped = true; } };
}

it('knows in a topic what the operator said in the main chat, labelled with where and when, and replies into that topic', async () => {
  const root = origin();
  try {
    const w = world(root);
    w.worker.intake([update(1, 'My sister is called Wren.', undefined, 1790000000)]); await w.worker.drain();
    w.worker.intake([update(2, 'What is my sister called?', 7)]); await w.worker.drain();
    const packet = JSON.parse(w.seen[1]!.context);
    expect(packet.audience).toMatchObject({ surface: 'telegram-private-chat', chat: '7654321', conversation: 'topic 7' });
    expect(packet.history).toMatchObject([{ id: 'telegram:12345678:update:1', conversation: 'main chat', date: '2026-09-21T14:13Z', user: 'My sister is called Wren.',
      answer: 'noted', outcome: 'Telegram API accepted' }]);
    expect(packet.capability).toContain('another conversation of this private chat');
    expect(w.sent).toEqual([{ chat: '7654321', update: 1 }, { chat: '7654321', thread: 7, update: 2 }]);
    expect(w.journal.view.turns.get('telegram:12345678:update:2')).toMatchObject({ thread: 7, sent: 2 });
    // A single-conversation packet needs no extra cross-conversation note.
    const first = JSON.parse(w.seen[0]!.context);
    expect(first.audience.conversation).toBeUndefined();
    expect(first.capability).not.toContain('another conversation');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('carries a topic fact to the main chat across a restart, never repeats a redelivered update, and fences an unknown topic send', async () => {
  const root = origin();
  try {
    const first = world(root, { send: input => input.thread === 7 ? null : 1 });
    first.worker.intake([update(1, 'The boat is moored at berth K4.', 7)]); await first.worker.drain();
    expect(first.journal.view.turns.get('telegram:12345678:update:1')).toMatchObject({ thread: 7, intent: 'PREVIEW — noted' });
    expect(first.journal.view.turns.get('telegram:12345678:update:1')?.sent).toBeUndefined();
    first.journal.close();
    const second = world(root);
    second.worker.intake([update(1, 'The boat is moored at berth K4.', 7), update(2, 'Where is the boat moored?')]);
    await second.worker.drain();
    expect(second.seen.map(item => item.id)).toEqual(['telegram:12345678:update:2']);
    expect(second.sent).toEqual([{ chat: '7654321', update: 2 }]);
    expect(JSON.parse(second.seen[0]!.context).history[0]).toMatchObject({ conversation: 'topic 7',
      user: 'The boat is moored at berth K4.', outcome: 'delivery UNKNOWN' });
    expect(second.journal.view.calls).toBe(2);
    expect(second.journal.view.replies).toBe(2);
    second.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('admits only the operator in their own private chat; a forum topic elsewhere or a malformed thread is kept but never read', async () => {
  const root = origin();
  try {
    const w = world(root);
    w.worker.intake([
      { update_id: 1, message: { chat: { id: -1001234, type: 'supergroup' }, from: { id: 7654321 }, text: 'GROUP-SECRET', message_thread_id: 3 } },
      { update_id: 2, message: { chat: { id: 7654321, type: 'private' }, from: { id: 111 }, text: 'FOREIGN-SECRET', message_thread_id: 3 } },
      { update_id: 3, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'THREAD-SECRET', message_thread_id: -3 } },
      update(4, 'hello')]);
    await w.worker.drain();
    expect(w.journal.view.order.map(turn => turn.accepted)).toEqual([false, false, false, true]);
    expect(w.journal.view.order.slice(0, 3).every(turn => turn.text === '' && turn.thread === undefined)).toBe(true);
    expect(w.seen).toHaveLength(1);
    expect(w.seen[0]!.context).not.toMatch(/GROUP-SECRET|FOREIGN-SECRET|THREAD-SECRET/);
    expect(w.journal.view.cursor).toBe(5);
    expect(() => w.journal.append({ kind: 'intent', id: 'telegram:12345678:update:4', text: 'PREVIEW — x', chat: '7654321',
      thread: 9, update: 4, grant: 'grant:preview', at: 1 })).toThrow('intent order');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('shares one attempt cap, one reply cap and one stop across every conversation', async () => {
  const root = origin();
  try {
    const w = world(root, { initial: genesis({ maxCalls: 2, maxReplies: 2 }) });
    w.worker.intake([update(1, 'one'), update(2, 'two', 7), update(3, 'three', 9)]); await w.worker.drain();
    expect(w.seen).toHaveLength(2);
    expect(w.journal.view.turns.get('telegram:12345678:update:3')?.held).toBe('call cap');
    // Rule 15: the ordinary caps no longer stop reading; the capped message got a limited answer.
    expect(() => w.worker.pollGate()).not.toThrow();
    expect(w.journal.view.turns.get('telegram:12345678:update:3')?.limited?.reason).toBe('calls');
    w.worker.stop('operator');
    expect(() => w.worker.intake([update(4, 'four', 7)])).toThrow('preview stopped');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('recalls a topic fact beyond the envelope into the main chat after summaries, with flat overhead across restarts', async () => {
  const root = origin(), samples: number[] = [];
  const fact = 'The spare house key is under the blue heron statue.';
  let asked: string | undefined;
  const open = () => world(root, { initial: genesis({ maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 8192 }), model: input => {
    if (input.id.startsWith('summary:')) return 'Ordinary talk about weather, errands and plans across two conversations.';
    if (input.question.includes('spare house key')) asked = input.context;
    return 'noted';
  } });
  try {
    let current = open();
    for (let i = 1; i <= 90; i++) {
      if (i === 30 || i === 60) { current.journal.close(); current = open(); }
      const thread = i % 3 === 0 ? 7 : i % 3 === 1 ? undefined : 9;
      const text = i === 4 ? fact : i === 88 ? 'Where did I say the spare house key is?'
        : `ordinary turn ${i}: weather, errands and plans ${'x'.repeat(60)}`;
      const start = performance.now();
      current.worker.intake([update(i, text, i === 4 ? 7 : thread, 1790000000 + i * 60)]);
      await current.worker.drain(); await current.worker.summarizeIfNeeded();
      samples.push(performance.now() - start);
    }
    const view = current.journal.view;
    expect(view.order.every(turn => turn.sent !== undefined)).toBe(true);
    expect(view.summaries.length).toBeGreaterThan(0);
    const packet = JSON.parse(asked!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.audience.conversation).toBe('main chat');
    expect(packet.recalled).toContainEqual(expect.objectContaining({ id: 'telegram:12345678:update:4', date: '2026-09-21T14:17Z', conversation: 'topic 7', user: fact,
      answer: 'noted', outcome: 'Telegram API accepted' }));
    expect(Buffer.byteLength(asked!)).toBeLessThanOrEqual(8192);
    const p95 = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]!;
    // Rule 37 repair (docs/defects/full-suite-load-timeouts.md): growth compares the median of the first and last
    // ten turns. A "p95" of ten samples is their maximum, so one scheduler stall under parallel load decided it —
    // the recorded diagnosis here (final-ten 1 760 ms against 168 ms, isolated 132-157 ms). A per-turn cost that
    // really grows with the journal moves the median as much as the maximum, so the 1 000 ms bound still binds.
    const median = (values: number[]) => { const sorted = values.slice().sort((a, b) => a - b); return (sorted[4]! + sorted[5]!) / 2; };
    const first = median(samples.slice(0, 10)), last = median(samples.slice(80));
    process.stdout.write(`journal conversations 90 turns / 3 conversations: non-model p95=${p95(samples).toFixed(1)} ms, first-ten median=${first.toFixed(1)} ms, `
      + `final-ten median=${last.toFixed(1)} ms, growth=${(last - first).toFixed(1)} ms, final-ten max=${Math.max(...samples.slice(80)).toFixed(1)} ms\n`);
    expect(p95(samples)).toBeLessThanOrEqual(5000);
    expect(last - first).toBeLessThanOrEqual(1000);
    current.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180_000); // Measured: 90 turns of real journal work took 25.1 s of the old 30 s budget at load 24 — the budget
// sized the host, not the work. The per-turn bounds asserted above are what hold the cost down.

it('gives the summarizer every turn\'s conversation and date, including the main chat, so the summary can keep where and when', async () => {
  const root = origin();
  try {
    const w = world(root, { initial: genesis({ maxBytes: 4096 }) });
    for (let id = 1; id <= 40; id++) {
      w.worker.intake([update(id, `Main chat fact number ${String(id)} about the garden plan.`, undefined, 1790000000 + id * 60)]);
      await w.worker.drain(); await w.worker.summarizeIfNeeded();
      if (w.seen.some(item => item.id.startsWith('summary:'))) break;
    }
    const input = w.seen.find(item => item.id.startsWith('summary:'));
    expect(input).toBeDefined();
    const packet = JSON.parse(input!.context);
    expect(packet.history.length).toBeGreaterThan(0);
    for (const item of packet.history) expect(item).toMatchObject({ conversation: 'main chat', date: expect.stringMatching(/^2026-09-21T/) });
    expect(packet.capability).toContain('Every history item names the conversation');
    // Ordinary reply packets keep their compact single-conversation form.
    const reply = JSON.parse(w.seen.find(item => !item.id.startsWith('summary:'))!.context);
    expect(reply.history.every((item: object) => !('conversation' in item))).toBe(true);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a question with an UNKNOWN send unanswered after replay without resending it', async () => {
  const root = origin();
  try {
    const first = world(root, { send: input => input.thread === 7 ? null : 1 });
    first.worker.intake([update(1, 'Ready in the main chat?'), update(2, 'Who has the map?', 7)]);
    await first.worker.drain();
    first.journal.close();
    const second = world(root);
    second.worker.intake([update(2, 'Who has the map?', 7)]);
    await second.worker.drain();
    expect(second.sent).toEqual([]);
    const packet = JSON.parse((second.worker.probe('What is open across my topics?') as { context: string }).context);
    expect(packet.history.find((item: { user: string }) => item.user === 'Who has the map?')).toMatchObject({ outcome: 'delivery UNKNOWN' });
    second.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['answered', 'rejected', 'empty', 'held'] as const)(
  'keeps delivered %s outcomes distinguishable in history after replay', async result => {
    const root = origin();
    try {
      const replyCheck: PreviewPorts['replyCheck'] = result === 'held' ? {
        elapsedMs: () => 100,
        jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
          Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: id === 'raw_path' ? 0.91 : 0.01 }])) }, latencyMs: 170 }),
        escalate: async () => ({ verdict: 'violation' as const, ruleIds: ['raw_path'], confidence: null, latencyMs: 500 }),
      } : undefined;
      // After Rules 77/86 only the credential-shape floor withholds a reply's text.
      const first = world(root, { model: input => input.question === 'When is the review?'
        ? result === 'rejected' ? { state: 'rejected', failureClass: 'rejected' }
          : result === 'empty' ? '' : result === 'held' ? 'The review key is sk-AAAAAAAAAAAAAAAAAAAAAAAA' : 'The review is tomorrow.'
        : 'The permit is ready.', ...(replyCheck ? { replyCheck } : {}) });
      first.worker.intake([update(1, 'When is the review?'), update(2, 'Permit status', 7)]);
      await first.worker.drain();
      expect(first.sent).toHaveLength(2);
      first.journal.close();

      const second = world(root);
      const packet = JSON.parse((second.worker.probe('What is open across my topics?') as { context: string }).context);
      if (result === 'answered')
        expect(packet.history[0]).toMatchObject({ answer: 'The review is tomorrow.', outcome: 'Telegram API accepted' });
      else expect(packet.history[0].outcome).toBe(result === 'held' ? 'answer withheld: credential-shaped text; notice delivered'
        : `model failure notice delivered (${result === 'empty' ? 'empty' : 'rejected'})`);
      expect(second.sent).toEqual([]);
      second.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
