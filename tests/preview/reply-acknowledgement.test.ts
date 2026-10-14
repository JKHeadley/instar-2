import { expect, it } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, unknownCallKeys,
  type PreviewPorts } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { jevQuestions } from './reply-check.js';

const key = new Uint8Array(32).fill(71);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 };
const update = (id = 1) => ({ update_id: id, message: { message_id: id + 100, chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, date: 1_600_000_000, text: 'Please look this up.' } });
const pendingResult = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function fixture(options: { tool?: boolean; receipt?: number | null; verdict?: 'pass' | 'violation'; cap?: number; replies?: number } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-ack-'))), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { ...genesis, maxCalls: options.cap ?? 20, maxReplies: options.replies ?? 10 });
  let now = 1000, stopped = false;
  const entered = pendingResult<void>(), answer = pendingResult<string>();
  const sent: Parameters<PreviewPorts['send']>[0][] = [], reviews: string[] = [];
  const ports: PreviewPorts = { now: () => now, stopped: () => stopped, toolRoute: () => options.tool === true,
    model: async () => { entered.resolve(); return answer.promise; },
    checkOutbound: () => {}, send: async input => { sent.push(input); return input.expectedText === REPLY_ACKNOWLEDGEMENT ? options.receipt === undefined ? 10 : options.receipt : 11; },
    replyCheck: { elapsedMs: () => now,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(jevQuestions).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 0 }),
      escalate: async (text, _id, _prompt, _rules, _deadline, operation) => {
        reviews.push(operation ?? 'answer');
        return { verdict: text === REPLY_ACKNOWLEDGEMENT ? options.verdict ?? 'pass' : 'pass', ruleIds: [], confidence: 1, latencyMs: 0 };
      } } };
  const worker = createJournalWorker(journal, ports);
  return { journal, worker, ports, sent, reviews, entered, answer, path, advance: (ms: number) => { now += ms; },
    stop: () => { stopped = true; }, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

for (const receipt of [10, null]) it(`slow active reply sends one fixed acknowledgement then answer; restart fences receipt ${receipt}`, async () => {
  const f = fixture({ receipt });
  try {
    f.worker.intake([update()]); const drain = f.worker.drain(); await f.entered.promise;
    f.advance(6999); await f.worker.minimal(); expect(f.sent).toHaveLength(0);
    f.advance(1); await Promise.all([f.worker.minimal(), f.worker.minimal()]);
    expect(f.sent.map(row => row.expectedText)).toEqual([REPLY_ACKNOWLEDGEMENT]);
    expect(f.sent[0]).toMatchObject({ kind: 'reply', disposition: 'result', replyTo: 101 });
    expect(f.reviews).toEqual([]);
    f.advance(9000); await f.worker.minimal(); expect(f.sent).toHaveLength(1);
    f.answer.resolve('Here is the answer.'); await drain;
    expect(f.sent.map(row => row.expectedText)).toEqual([REPLY_ACKNOWLEDGEMENT, 'Here is the answer.']);
    f.journal.compact(); f.journal.close();
    const reopened = openPreviewJournal(f.path, key);
    try { await createJournalWorker(reopened, f.ports).drain(); expect(f.sent).toHaveLength(2); }
    finally { reopened.close(); }
  } finally { f.close(); }
});

it.each([false, true])('fast reply sends no acknowledgement (tool route=%s)', async tool => {
  const f = fixture({ tool });
  try { f.worker.intake([update()]); f.answer.resolve('Done.'); await f.worker.drain(); await f.worker.minimal();
    expect(f.sent.map(row => row.expectedText)).toEqual(['Done.']); expect(f.reviews).toEqual([]);
  } finally { f.close(); }
});

it('a tool-enabled answer acknowledges only once it is slow', async () => {
  const f = fixture({ tool: true });
  try { f.worker.intake([update()]); const drain = f.worker.drain(); await f.entered.promise;
    expect(f.sent).toHaveLength(0); f.advance(10000); await f.worker.minimal();
    expect(f.sent.map(row => row.expectedText)).toEqual([REPLY_ACKNOWLEDGEMENT]);
    f.answer.resolve('Found it.'); await drain; expect(f.sent).toHaveLength(2);
  } finally { f.close(); }
});

for (const options of [{ replies: 1 }])
  it(`keeps acknowledgement within allowance floors: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    try { f.worker.intake([update()]); const drain = f.worker.drain(); await f.entered.promise;
      f.advance(10000); await f.worker.minimal(); f.answer.resolve('Done.'); await drain;
      expect(f.sent.map(row => row.expectedText)).toEqual(['Done.']);
    } finally { f.close(); }
  });

it('intake and confirmed stop remain live while acknowledgement disclosure is pending', async () => {
  const f = fixture(), checking = pendingResult<void>(), disclosure = pendingResult<boolean>();
  let hold = false;
  const originalSend = f.ports.send;
  f.ports.sendAdmits = true;
  f.ports.send = async input => {
    if (hold) { checking.resolve(); await disclosure.promise; }
    if (input.current && !input.current()) return { kind: 'refused', reason: 'acknowledgement cancelled' };
    input.admit?.(); return originalSend(input);
  };
  const worker = createJournalWorker(f.journal, f.ports);
  try {
    worker.intake([update()]); const drain = worker.drain().catch(error => error); await f.entered.promise;
    hold = true; f.advance(10000); await worker.minimal(); await checking.promise;
    worker.intake([update(2)]);
    expect(f.journal.view.order.some(turn => turn.update === 2)).toBe(true);
    worker.stop('operator'); disclosure.resolve(true);
    f.answer.resolve('Done.'); expect(await drain).toMatchObject({ message: 'preview stopped' });
    expect(f.sent).toHaveLength(0);
  } finally { f.close(); }
});

it('a detached acknowledgement failure stays observable by the ordinary drain', async () => {
  const f = fixture();
  f.ports.checkOutbound = text => { if (text === REPLY_ACKNOWLEDGEMENT) throw Error('acknowledgement boundary failed'); };
  const worker = createJournalWorker(f.journal, f.ports);
  try {
    worker.intake([update()]); const drain = worker.drain(); await f.entered.promise;
    f.advance(10000); await worker.minimal(); await new Promise<void>(done => setImmediate(done));
    await worker.minimal();
    f.answer.resolve('Done.'); await expect(drain).rejects.toThrow('acknowledgement boundary failed');
    expect(f.sent).toHaveLength(0);
  } finally { f.close(); }
});

it('restart after review reservation never repeats the unknown acknowledgement call', async () => {
  const f = fixture();
  try { f.worker.intake([update()]); const turn = f.journal.view.order[0]!;
    f.journal.append({ kind: 'reserve', id: turn.id, at: 1000 });
    f.journal.append({ kind: 'held-notice-review-reserve', id: turn.id, prompt: '{}', at: 9000 });
    f.journal.append({ kind: 'answer', id: turn.id, text: 'Done.', state: 'complete', at: 9001 });
    f.journal.close(); const reopened = openPreviewJournal(f.path, key);
    try { expect(unknownCallKeys(reopened.view).reviews).toContain(`held-notice-review:${turn.id}`);
      await createJournalWorker(reopened, f.ports).drain();
      expect(f.sent.map(row => row.expectedText)).toEqual(['Done.']); expect(f.reviews).not.toContain('acknowledgement');
    } finally { reopened.close(); }
  } finally { f.close(); }
});

it('a final answer waits for an in-flight acknowledgement send', async () => {
  const f = fixture(), send = pendingResult<number>(), sending = pendingResult<void>();
  const originalSend = f.ports.send;
  f.ports.send = async input => { if (input.expectedText === REPLY_ACKNOWLEDGEMENT) { sending.resolve(); await send.promise; } return originalSend(input); };
  const worker = createJournalWorker(f.journal, f.ports);
  try { worker.intake([update()]); const drain = worker.drain(); await f.entered.promise; f.advance(10000);
    const tick = worker.minimal(); await sending.promise; f.answer.resolve('Done.');
    await Promise.resolve(); expect(f.journal.view.order[0]?.intent).toBeUndefined();
    send.resolve(10); await Promise.all([tick, drain]);
    expect(f.sent.map(row => row.expectedText)).toEqual([REPLY_ACKNOWLEDGEMENT, 'Done.']);
  } finally { f.close(); }
});

// Observer 106: real captured bytes reach the changed worker path, including refusal/empty shapes.
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
for (const shape of shapes.otherShapes) it(`acknowledges once while replaying recorded ${shape.kind} ${shape.id}`, async () => {
  const f = fixture({ tool: true });
  f.ports.model = async () => { f.entered.resolve(); await f.answer.promise;
    return shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) as { state: 'uncertain' } : shape.raw; };
  const worker = createJournalWorker(f.journal, f.ports);
  try { worker.intake([update()]); const drain = worker.drain(); await f.entered.promise;
    f.advance(10000); await worker.minimal(); await new Promise<void>(done => setImmediate(done));
    expect(f.sent.map(row => row.expectedText)).toEqual([REPLY_ACKNOWLEDGEMENT]);
    f.answer.resolve('release recorded output'); await drain;
    expect(f.sent.filter(row => row.expectedText === REPLY_ACKNOWLEDGEMENT)).toHaveLength(1);
    expect(f.sent.every(row => row.expectedText.trim().length > 0)).toBe(true);
    expect(f.journal.view.order[0]?.heldNoticeReview).toBeUndefined();
    await worker.drain(); expect(f.sent.filter(row => row.expectedText === REPLY_ACKNOWLEDGEMENT)).toHaveLength(1);
  } finally { f.close(); }
});

it('replays live lookup 969390382 with its recorded answer, Jev and contextual review', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/reply-acknowledgement-live-2026-10-11.json', import.meta.url), 'utf8')) as {
    raw: Parameters<ReturnType<typeof createJournalWorker>['intake']>[0][number]; answer: string; reply: string;
    checks: { verdict: 'pass'; ruleIds: []; confidence: number; latencyMs: number; scores?: Record<string, number> }[] };
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-ack-live-'))), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { ...genesis, bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true });
  let now = 1000;
  const sent: Parameters<PreviewPorts['send']>[0][] = [];
  let worker: ReturnType<typeof createJournalWorker>;
  const ports: PreviewPorts = { now: () => now, stopped: () => false, groupDisclosure: async () => true,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now, genesis.maxBytes),
    model: async () => { now += 10000; await worker.minimal(); const parsed = readAnswer(captured.answer, { wrapped: 'refuse' });
      if (!parsed.ok) throw Error('recorded answer did not parse'); return parsed.value; },
    checkOutbound: () => {}, send: async input => { sent.push(input); return sent.length + 100; },
    replyCheck: { elapsedMs: () => now,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(captured.checks[0]!.scores!).map(([id, noul]) => [id, { type: 'noul', noul }])) }, latencyMs: captured.checks[0]!.latencyMs }),
      // Captured verdict replay, not a claim that a live reviewer has judged the new acknowledgement.
      escalate: async () => captured.checks[1]! } };
  try { worker = createJournalWorker(journal, ports); worker.intake([captured.raw]); await worker.drain();
    expect(sent.map(row => row.expectedText)).toEqual([REPLY_ACKNOWLEDGEMENT, captured.reply]);
    expect(sent.map(row => row.replyTo)).toEqual([105, 105]);
    expect(journal.view.order[0]?.replyChecks?.map(check => check.path)).toEqual(['jev']);
    expect(journal.view.order[0]?.heldNoticeReview).toBeUndefined();
    journal.compact(); journal.close(); const reopened = openPreviewJournal(path, key);
    try { await createJournalWorker(reopened, ports).drain(); expect(sent).toHaveLength(2); } finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('agent-initiated due work gets no acknowledgement even with a slow tool route', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/reminder-idle-live-2026-10-09.json', import.meta.url), 'utf8')) as {
    cases: { request: { update: number; text: string; at: number; output: string }; due: string }[] };
  const sample = captured.cases[0]!, f = fixture({ tool: true });
  let now = sample.request.at, due = false;
  f.ports.now = () => now; f.ports.replyCheck!.elapsedMs = () => now;
  let worker: ReturnType<typeof createJournalWorker>;
  f.ports.model = async () => { if (!due) return sample.request.output;
    now += 10000; await worker.minimal(); return JSON.stringify({ reply: 'Time for your reminder.', memory: [] }); };
  worker = createJournalWorker(f.journal, f.ports);
  try { worker.intake([{ ...update(sample.request.update), message: { ...update().message, date: Math.floor(sample.request.at / 1000), text: sample.request.text } }]);
    await worker.drain(); f.sent.length = 0; f.reviews.length = 0; due = true; now = Date.parse(sample.due) + 1000;
    await worker.sendRequested();
    expect(f.journal.view.order.some(turn => turn.requestedAction)).toBe(true);
    expect(f.sent).toHaveLength(1); expect(f.sent[0]?.expectedText).not.toBe(REPLY_ACKNOWLEDGEMENT);
    expect(f.reviews).not.toContain('acknowledgement');
  } finally { f.close(); }
});

for (const receipt of [10, null]) it(`a crash after acknowledgement intent and before final answer cannot resend it (${receipt})`, async () => {
  const f = fixture({ receipt });
  try { f.worker.intake([update()]); const drain = f.worker.drain(); await f.entered.promise;
    f.advance(10000); await f.worker.minimal();
    // minimal no longer waits for dispatch; take the crash copy after its receipt has settled.
    await new Promise<void>(done => setImmediate(done));
    expect(f.journal.view.order[0]?.heldNoticeIntent).toBeDefined();
    expect(f.journal.view.order[0]?.heldNoticeSent).toBe(receipt === null ? undefined : receipt);
    const copy = `${f.path}.crash-copy`;
    writeFileSync(copy, readFileSync(f.path));
    f.answer.resolve('Done.'); await drain;
    const reopened = openPreviewJournal(copy, key), before = f.sent.length;
    try { const worker = createJournalWorker(reopened, f.ports); await worker.drain(); await worker.minimal();
      expect(f.sent.slice(before).some(row => row.expectedText === REPLY_ACKNOWLEDGEMENT)).toBe(false);
      expect(reopened.view.order[0]?.heldNoticeSent).toBe(receipt === null ? undefined : receipt);
    } finally { reopened.close(); }
  } finally { f.close(); }
});

it('a fixed acknowledgement needs neither review availability nor a paid-call slot', async () => {
  const f = fixture({ cap: 2 });
  f.ports.replyCheck!.escalate = async () => { throw Error('review unavailable'); };
  const worker = createJournalWorker(f.journal, f.ports);
  try { worker.intake([update()]); const drain = worker.drain(); await f.entered.promise;
    f.advance(10000); await worker.minimal(); await worker.minimal();
    expect(f.journal.view.order[0]?.heldNoticeReview).toBeUndefined();
    expect(unknownCallKeys(f.journal.view).reviews).toHaveLength(0);
    f.answer.resolve('Done.'); await drain;
    expect(f.sent.map(row => row.expectedText)).toEqual([REPLY_ACKNOWLEDGEMENT, 'Done.']);
  } finally { f.close(); }
});

it('cancels an acknowledgement when the answer arrives during its disclosure check', async () => {
  const f = fixture(), checking = pendingResult<void>(), disclosure = pendingResult<boolean>();
  let hold = false;
  const originalSend = f.ports.send;
  f.ports.sendAdmits = true;
  f.ports.send = async input => {
    if (hold) { checking.resolve(); await disclosure.promise; }
    if (input.current && !input.current()) return { kind: 'refused', reason: 'acknowledgement cancelled' };
    input.admit?.(); return originalSend(input);
  };
  const worker = createJournalWorker(f.journal, f.ports);
  try { worker.intake([update()]); const drain = worker.drain(); await f.entered.promise;
    hold = true; f.advance(10000); await worker.minimal(); await checking.promise;
    f.answer.resolve('Done.'); await new Promise<void>(done => setImmediate(done));
    hold = false; disclosure.resolve(true); await drain;
    expect(f.sent.map(row => row.expectedText)).toEqual(['Done.']);
  } finally { f.close(); }
});

for (const age of [6999, 7000, 7999, 8000, 9300, 9999, 10000]) it(`new acknowledgement admission versus historical replay at ${age} ms`, async () => {
  const f = fixture();
  try {
    f.worker.intake([update()]); const turn = f.journal.view.order[0]!;
    const text = REPLY_ACKNOWLEDGEMENT, target = `held-notice:${turn.id}`;
    const row = { kind: 'held-notice-intent' as const, id: turn.id, text, chat: genesis.chat, update: turn.update,
      grant: genesis.grant, acknowledgement: true as const,
      provenance: f.journal.signOutbound('infrastructure', { target, chat: genesis.chat, body: text }), at: turn.at + age };
    if (age >= 7000) f.journal.append(row);
    else {
      expect(() => f.journal.append(row)).toThrow('fixed acknowledgement no longer due');
      // Encode an old-build frame directly: new admission must not be used to manufacture historical acceptance.
      f.journal.close();
      const offset = readFileSync(f.path).length, nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
      const body = Buffer.concat([cipher.update(JSON.stringify(row)), cipher.final()]);
      const bytes = Buffer.concat([nonce, cipher.getAuthTag(), body]), length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length); appendFileSync(f.path, Buffer.concat([length, bytes]));
    }
    f.journal.close();
    if (age < 7000) expect(() => openPreviewJournal(f.path, key)).toThrow('fixed acknowledgement no longer due');
    else {
      const reopened = openPreviewJournal(f.path, key);
      try { expect(reopened.view.order[0]?.heldNoticeIntent).toBe(text);
        await createJournalWorker(reopened, { ...f.ports, model: async () => 'Done.' }).drain();
        expect(f.sent.filter(row => row.expectedText === REPLY_ACKNOWLEDGEMENT)).toHaveLength(0);
      } finally { reopened.close(); }
    }
  } finally { f.close(); }
});
