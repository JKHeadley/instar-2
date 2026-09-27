import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, deskStatusSource, readDeskStatus, sourcePacket } from './briefing.js';
import { readRuns, selfState, selfStateSource } from './self-state.js';
import { operatorDigest } from './operator-digest.js';

const key = new Uint8Array(32).fill(11);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-commitments-')));
const genesis = (maxBytes = 8000) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes, cursor: 0 });
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1790000000 + id * 60 } });
const filler = (i: number) => `ordinary turn ${i}: the garden, errands and plans ${'x'.repeat(40)}`;
const LOCKER = 'Please remember that my gym locker code is 4417.';
const DENTIST = 'Remind me to call the dentist about the crown before Friday.';
const PROMISE = 'I will keep the dentist call on my list.';
const DONE = 'I already called the dentist this morning, so you can drop that one.';
const run = (root: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', ...args, '--root', root],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
    encoding: 'utf8', timeout: 20000 });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
};

type Packet = { history: { user: string; answer: string | null }[]; openCommitments?: { id: number; quote: string }[] };
/** An honest extractor quoting exactly, plus proposals the verbatim floor must drop: a paraphrase,
 * an operator quote claimed as the agent's reply, the agent's words claimed as the operator's, and
 * an invention. It closes an open item only when a history message really says so. */
const extractor = (bad = true) => (context: string) => {
  const packet = JSON.parse(context) as Packet;
  const commitments: { in: string; quote: string; closedBy?: string }[] = [];
  for (const turn of packet.history) {
    if (/remember|remind/iu.test(turn.user)) commitments.push({ in: 'message', quote: turn.user });
    if (turn.answer?.includes(PROMISE)) commitments.push({ in: 'reply', quote: PROMISE });
  }
  const closing = packet.history.find(turn => turn.user === DONE);
  if (closing) for (const item of commitments) if (item.quote.includes('dentist')) item.closedBy = 'I already called the dentist';
  if (bad) commitments.push({ in: 'message', quote: 'Remember my locker code.' }, { in: 'reply', quote: LOCKER },
    { in: 'message', quote: PROMISE }, { in: 'message', quote: 'Remember to buy the boat on Sunday.' });
  const closed = closing ? (packet.openCommitments ?? []).filter(item => item.quote.includes('dentist'))
    .map(item => ({ id: item.id, quote: 'I already called the dentist' })) : [];
  if (bad) closed.push({ id: 0, quote: 'the locker is done' }, { id: 99, quote: 'I already called the dentist' });
  return JSON.stringify({ summary: 'Earlier turns covered a locker code, a dentist call, errands and plans.', people: [], commitments, closed });
};

function world(root: string, options: { bad?: boolean; plain?: boolean; maxBytes?: number } = {}) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(options.maxBytes));
  const asked = new Map<string, string>();
  const clock = { now: 1790172860000 };
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('summary:')) return options.plain ? 'A plain summary.' : extractor(options.bad ?? true)(input.context);
      asked.set(input.question, input.context);
      return input.question === DENTIST ? `Noted. ${PROMISE}` : 'Noted.';
    },
    send: async () => 1, checkOutbound: () => {} });
  const say = async (id: number, text: string, from?: number) => {
    worker.intake([update(id, text, from)]); await worker.drain(); await worker.summarizeIfNeeded();
  };
  /** Fillers until a question would be answered from a summary carrying open commitments. */
  const fillUntilCompacted = async (next: number, question: string) => {
    for (; next < 120; next++) {
      const probe = worker.probe(question);
      if (!('reason' in probe) && JSON.parse(probe.context).commitments) return next;
      await say(next, filler(next));
    }
    throw Error('compaction never reached');
  };
  return { journal, worker, asked, say, fillUntilCompacted, clock };
}

it('records requests and its own promises verbatim after replies, drops everything else, inside the shared attempt cap', async () => {
  const root = origin();
  try {
    const w = world(root);
    await w.say(1, LOCKER);
    await w.say(2, DENTIST);
    expect(w.journal.view.commitments).toEqual([]);
    let n = 3;
    for (; !w.journal.view.summaries.length && n < 60; n++) await w.say(n, filler(n));
    const view = w.journal.view;
    expect(view.commitments).toEqual([
      { in: 'message', source: 'telegram:12345678:update:1', quote: LOCKER },
      { in: 'message', source: 'telegram:12345678:update:2', quote: DENTIST },
      { in: 'reply', source: 'telegram:12345678:update:2', quote: PROMISE }]);
    expect(view.closed.size).toBe(0);
    expect(view.calls).toBe(n - 1 + view.summaries.length);
    expect(view.order.every(turn => turn.sent === 1)).toBe(true);
    w.journal.close();
    const status = run(root, 'status');
    expect(status.commitments).toEqual({ total: 3, open: 3 });
    expect(status.summaries[0].commitments).toBe(3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('brings open items back after compaction with who said them and when, says it cannot act, and survives restart', async () => {
  const root = origin();
  try {
    let w = world(root, { maxBytes: 4000 });
    await w.say(1, LOCKER);
    await w.say(2, DENTIST);
    const question = 'What did I ask you to remember?';
    const n = await w.fillUntilCompacted(3, question);
    w.journal.close();
    w = world(root, { maxBytes: 4000 });
    expect(w.journal.view.commitments.length).toBe(3);
    await w.say(n, question);
    const packet = JSON.parse(w.asked.get(question)!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.history.some((turn: { user: string }) => turn.user === LOCKER || turn.user === DENTIST)).toBe(false);
    expect(packet.commitments).toMatchObject([
      { source: 'telegram:12345678:update:1', from: 'the operator (verified sender)', date: '2026-09-21T14:14Z', message: LOCKER, items: [{ id: 0, quote: LOCKER }] },
      { source: 'telegram:12345678:update:2', from: 'the operator (verified sender)', date: '2026-09-21T14:15Z', message: DENTIST, items: [{ id: 1, quote: DENTIST }] },
      { source: 'telegram:12345678:update:2', from: 'you, in your own earlier reply', date: '2026-09-21T14:15Z', reply: `Noted. ${PROMISE}`, answering: DENTIST,
        delivery: 'Telegram API accepted', items: [{ id: 2, quote: PROMISE }] }]);
    expect(packet.capability).toContain('you cannot do, schedule or remind anyone of anything');
    expect(packet.capability).toContain('never add one that is not listed');
    // The sources of listed commitments are not repeated as recalled turns.
    expect((packet.recalled ?? []).some((turn: { user: string }) => turn.user === LOCKER)).toBe(false);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('surfaces only BM25-related open items with age, while an unrelated turn gets none', async () => {
  const root = origin();
  try {
    const w = world(root);
    await w.say(1, LOCKER);
    await w.say(2, DENTIST);
    await w.fillUntilCompacted(3, 'What did I ask you to remember?');
    const packet = (question: string) => {
      const probe = w.worker.probe(question);
      expect('context' in probe).toBe(true);
      return JSON.parse('context' in probe ? probe.context : '{}');
    };
    expect(packet('What about my gym locker code?').commitments.flatMap((entry: { items: { id: number }[] }) => entry.items.map(item => item.id)))
      .toEqual([0]);
    expect(packet('What about the dentist crown?').commitments.flatMap((entry: { items: { id: number }[] }) => entry.items.map(item => item.id)))
      .toEqual([1, 2]);
    expect(packet('How are the garden tomatoes?').commitments).toBeUndefined();
    expect(packet('What about my gym locker code?').commitments[0].age).toBe('2 days');
    expect(packet('What open commitments do you have?').commitments.flatMap((entry: { items: { id: number }[] }) => entry.items.map(item => item.id)))
      .toEqual([0, 1, 2]);
    w.clock.now = 1790000060000 + 2 * 60 * 60 * 1000;
    expect(packet('What about my gym locker code?').commitments[0].age).toBe('2 hours');
    w.clock.now = 1790000060000 + 2 * 60 * 1000;
    expect(packet('What about my gym locker code?').commitments[0].age).toBe('2 minutes');
    w.clock.now = 1790000060000 + 30 * 1000;
    expect(packet('What about my gym locker code?').commitments[0].age).toBe('less than 1 minute');
    w.clock.now = 1790000060000 - 1000;
    expect(packet('What about my gym locker code?').commitments[0].age).toBe('age unknown');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('closes an item only on a later message the operator verifiably sent, and never shows it again', async () => {
  const root = origin();
  try {
    const w = world(root);
    await w.say(1, LOCKER);
    await w.say(2, DENTIST);
    let n = await w.fillUntilCompacted(3, 'Anything open?');
    // Another sender's claim that the call happened closes nothing.
    w.journal.append({ kind: 'intake', id: `telegram:12345678:update:${n}`, update: n, text: DONE,
      raw: JSON.stringify(update(n, DONE, 555)), accepted: true, cursor: n + 1, at: 1790000000000 });
    await w.worker.drain(); n++;
    const through = w.journal.view.summaries.length;
    for (; w.journal.view.summaries.length === through; n++) await w.say(n, filler(n));
    expect(w.journal.view.closed.size).toBe(0);
    const doneUpdate = n;
    await w.say(n++, DONE);
    for (; (w.journal.view.summaries.at(-1)?.through ?? 0) < doneUpdate && n < 120; n++)
      await w.say(n, filler(n));
    expect([...w.journal.view.closed.entries()].map(([id, closure]) => [id, closure.quote])).toEqual([
      [1, 'I already called the dentist'], [2, 'I already called the dentist']]);
    await w.say(n, 'Anything open?');
    const packet = JSON.parse(w.asked.get('Anything open?')!);
    expect(packet.commitments.map((entry: { items: { id: number }[] }) => entry.items.map(item => item.id))).toEqual([[0]]);
    const related = w.worker.probe('What about the dentist crown?');
    expect('context' in related && JSON.parse(related.context).commitments).toBeUndefined();
    w.journal.close();
    expect(run(root, 'status').commitments).toEqual({ total: 3, open: 1 });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

it('refuses a closure for an open item omitted from the summary packet', async () => {
  const root = origin();
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(3000));
    const packets: Packet[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => input.context,
      model: async input => {
        if (!input.id.startsWith('summary:')) return 'Noted.';
        const packet = JSON.parse(input.context) as Packet;
        packets.push(packet);
        return JSON.stringify({ summary: 'The earlier request remains open.', people: [],
          commitments: packet.history.filter(turn => turn.user.includes('Please remember')).map(turn => ({ in: 'message', quote: turn.user })),
          closed: [{ id: 0, quote: 'I already called the dentist' }] });
      },
      send: async () => 1, checkOutbound: () => {} });
    let id = 1;
    const say = async (text: string) => { worker.intake([update(id++, text)]); await worker.drain(); await worker.summarizeIfNeeded(); };
    await say(`Please remember the dentist request: ${'details '.repeat(100)}`.trim());
    for (; !journal.view.summaries.length && id < 60;) await say(filler(id));
    expect(journal.view.commitments).toHaveLength(1);
    await say(DONE);
    for (; journal.view.summaries.length < 2 && id < 100;) await say(filler(id));
    expect(journal.view.summaries.length).toBeGreaterThanOrEqual(2);
    expect(packets[1]?.openCommitments ?? []).toEqual([]);
    expect(journal.view.closed.size).toBe(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('drops optional open commitments until the complete summary envelope fits and recovers the reply', async () => {
  const root = origin();
  const g = genesis(32768);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
  const seed = (id: number, text: string) => {
    const turn = `telegram:12345678:update:${id}`;
    journal.append({ kind: 'intake', id: turn, update: id, text, raw: JSON.stringify(update(id, text)),
      accepted: true, cursor: id + 1, at: 1000 });
    journal.append({ kind: 'reserve', id: turn, at: 1000 });
    journal.append({ kind: 'answer', id: turn, text: 'ok', at: 1000 });
    journal.append({ kind: 'intent', id: turn, text: 'PREVIEW — ok', chat: g.chat, update: id, grant: g.grant, at: 1000 });
    journal.append({ kind: 'sent', id: turn, message: id, at: 1000 });
    return turn;
  };
  try {
    const quotes = Array.from({ length: 30 }, (_, i) => `Remember item ${i}: ${'detail '.repeat(125)}`);
    const first = seed(1, quotes.join('\n'));
    journal.append({ kind: 'summary-reserve', through: 1, at: 1000 });
    journal.append({ kind: 'summary', through: 1, text: 'The operator gave thirty items to remember.', people: [],
      commitments: quotes.map(quote => ({ in: 'message' as const, source: first, quote })), at: 1000 });
    seed(2, `Recent discussion. ${'garden '.repeat(1300)}`);
    const calls: { id: string; context: string }[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', g.grant, 1000),
      model: async input => { calls.push({ id: input.id, context: input.context });
        return input.id.startsWith('summary:') ? 'The thirty items remain open; later discussion covered the garden.' : 'ok'; },
      send: async () => 3, checkOutbound: () => {} });
    worker.intake([update(3, `Please answer this long question: ${'question '.repeat(2700)}`)]);
    await worker.drain();
    const summaryCall = calls.find(call => call.id === 'summary:2');
    expect(summaryCall).toBeDefined();
    expect((JSON.parse(summaryCall!.context) as Packet).openCommitments?.length ?? 0).toBeLessThan(30);
    expect(journal.view.summaries.at(-1)?.through).toBe(2);
    expect(journal.view.order[2]?.sent).toBe(3);
    expect(calls.map(call => call.id)).toEqual(['summary:2', 'telegram:12345678:update:3']);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('settles an item made and closed within one summarized stretch', async () => {
  const root = origin();
  try {
    const w = world(root, { bad: false });
    await w.say(1, DENTIST);
    await w.say(2, DONE);
    for (let n = 3; !w.journal.view.summaries.length && n < 60; n++) await w.say(n, filler(n));
    expect(w.journal.view.commitments.map(note => note.in)).toEqual(['message', 'reply']);
    expect([...w.journal.view.closed.keys()]).toEqual([0, 1]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a plain summary and reports the missing commitment record in status', async () => {
  const root = origin();
  try {
    const w = world(root, { plain: true });
    await w.say(1, LOCKER);
    for (let i = 2; !w.journal.view.summaries.length && i < 60; i++) await w.say(i, filler(i));
    expect(w.journal.view.commitments).toEqual([]);
    w.journal.close();
    const status = run(root, 'status');
    expect(status.summaries.every((summary: { commitments: number | null }) => summary.commitments === null)).toBe(true);
    expect(status.commitments).toEqual({ total: 0, open: 0 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps per-turn non-model overhead flat through 200 turns with commitments and a restart', async () => {
  const root = origin(), samples: number[] = [];
  try {
    let w = world(root, { bad: false });
    for (let i = 1; i <= 200; i++) {
      if (i === 100) { w.journal.close(); w = world(root, { bad: false }); }
      const text = i % 10 === 1 ? `Please remember item ${i} for the review.` : i === 199 ? 'What did I ask you to remember?' : filler(i);
      const start = performance.now();
      await w.say(i, text);
      samples.push(performance.now() - start);
    }
    const view = w.journal.view;
    expect(view.order.every(turn => turn.sent === 1)).toBe(true);
    expect(view.commitments.length).toBeGreaterThan(10);
    expect(JSON.parse(w.asked.get('What did I ask you to remember?')!).commitments.length).toBeGreaterThan(0);
    const p95 = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]!;
    const first = p95(samples.slice(0, 10)), last = p95(samples.slice(190));
    process.stdout.write(`journal commitments 200 turns: non-model p95=${p95(samples).toFixed(1)} ms, first-ten=${first.toFixed(1)} ms, final-ten=${last.toFixed(1)} ms\n`);
    expect(p95(samples)).toBeLessThanOrEqual(5000);
    expect(last - first).toBeLessThanOrEqual(1000);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

/** The desk's live script through the real sources and real envelope at the live 32768-byte bound,
 * driven only by the read-only `inspect` command: the final question is answered from a summary
 * that carries both open items. The model and Telegram are stubs. */
it('the live script reaches compaction and the question carries the open commitments', async () => {
  const root = origin(), model = 'claude-opus-5-5';
  try {
    const g = { ...genesis(32768), maxCalls: 40, maxReplies: 40, maxTurns: 40 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
    writeFileSync(join(root, 'desk-status.md'), '# Instar 2.0 desk report\nLane commitments-memory: live proof.\n');
    const sources = sourcePacket(path => readFileSync(join(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: g.maxCalls, expiresAt: g.expires }).sources;
    const worker = createJournalWorker(journal, { now: Date.now, stopped: () => false,
      // The same sources the launcher's turnSources gives every live turn and the inspect probe.
      sources: () => {
        const now = Date.now(), runs = readRuns(join(root, 'runs.jsonl'));
        const desk = deskStatusSource(readDeskStatus(join(root, 'desk-status.md')), now, join(root, 'desk-status.md'));
        return [...sources, selfStateSource(selfState(journal.view, runs, now, 'UTC')), desk,
          operatorDigest(journal.view, runs, desk)];
      },
      prepareModel: input => prepareJournalEnvelope(input, model, g.grant, Date.now()),
      model: async ({ id, question, context }) => id.startsWith('summary:') ? extractor(false)(context)
        : question === DENTIST ? `Noted. ${PROMISE}` : 'ok',
      send: async () => 1, checkOutbound: () => {} });
    const sentence = 'The garden plan has tomatoes, beans, squash and herbs along the south fence. ';
    const LIVE_FILLER = `Filler for the memory test, just reply ok. ${sentence.repeat(50).trim()}`;
    let id = 1;
    const say = async (text: string) => { worker.intake([update(id++, text)]); await worker.drain(); await worker.summarizeIfNeeded(); };
    await say(LOCKER); await say(DENTIST);
    const question = 'What did I ask you to remember or do?';
    let fillers = 0;
    for (;;) {
      const next = run(root, 'inspect', '--text', question, '--model', model).next;
      if (next.historyMode === 'summary-plus-recent' && next.commitments.length) break;
      expect(fillers).toBeLessThan(12);
      await say(LIVE_FILLER); fillers++;
    }
    worker.intake([update(id++, question)]);
    await worker.drain();
    const last = run(root, 'inspect').last;
    expect(last.historyMode).toBe('summary-plus-recent');
    expect(last.commitments.flatMap((entry: { items: { quote: string }[] }) => entry.items.map(item => item.quote)))
      .toEqual([LOCKER, DENTIST, PROMISE]);
    process.stdout.write(`commitments live script: ${fillers} fillers; turns=${journal.view.order.length}, calls=${journal.view.calls}, summaries=${journal.view.summaries.length}\n`);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
