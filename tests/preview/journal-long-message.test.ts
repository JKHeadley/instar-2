import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, OBLIGATION_FLOOR_PACKET_BYTES, openPreviewJournal, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE } from './journal.js';
import { replyReviewContext } from './reply-check.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const key = new Uint8Array(32).fill(19);
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 4096, cursor: 0 });
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-long-message-')));
const status = (dir: string) => {
  const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', dir], { cwd: process.cwd(),
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as { tooLong: { update: number; kind: string; delivery: string }[]; unknownSends: number };
};

it('records an over-maxBytes operator turn and sends one checked too-long notice across replay', async () => {
  const dir = root();
  try {
    const original = 'é'.repeat(2049); // 4098 UTF-8 bytes, though only 2049 characters.
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
    let modelCalls = 0, sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { modelCalls++; return 'should never run'; },
      replyCheck: { elapsedMs: () => 1, jev: async text => { expect(text).toBe(TOO_LONG_INPUT_NOTICE);
        return { value: { results: [] }, latencyMs: 1 }; },
        escalate: async (text, _id, prompt) => {
          const context = JSON.parse(replyReviewContext(prompt!, text));
          expect(context).toMatchObject({ candidateReply: TOO_LONG_INPUT_NOTICE,
            operatorMessage: expect.stringContaining('saved verbatim'), audience: { chat: '7654321' }, history: [] });
          return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 1, reason: 'fixed notice' };
        } },
      send: async ({ text }) => { expect(text).toBe(TOO_LONG_INPUT_NOTICE); sends++; return null; },
      checkOutbound: () => {} });
    expect(worker.intake([update(1, original)])).toBe(2);
    await worker.drain();
    expect(modelCalls).toBe(0);
    expect(sends).toBe(1);
    expect(journal.view.order[0]).toMatchObject({ text: original, noticeClass: 'too-long-input', intent: TOO_LONG_INPUT_NOTICE });
    journal.close();
    const replay = openPreviewJournal(join(dir, 'journal.encrypted'), key);
    const resumed = createJournalWorker(replay, { now: () => 1001, stopped: () => false,
      model: async () => { throw Error('duplicate model call'); }, send: async () => { throw Error('duplicate send'); },
      checkOutbound: () => {} });
    expect(resumed.intake([update(1, original)])).toBe(2);
    await resumed.drain();
    expect(replay.view.order).toHaveLength(1);
    expect(replay.view.order[0]?.text).toBe(original);
    expect(replay.view.replies).toBe(1);
    replay.close();
    expect(status(dir)).toMatchObject({ unknownSends: 1,
      tooLong: [{ update: 1, kind: 'input', delivery: 'UNKNOWN' }] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('drains a batched oversized correction and retires its stale holds across restart', async () => {
  const dir = root();
  try {
    const path = join(dir, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis());
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'First answer', send: async ({ text }) => { sent.push(text); return sent.length; },
      checkOutbound: () => {} });
    worker.intake([update(1, 'Short message'), update(2, `Actually ${'x'.repeat(4200)}`)]);
    // These holds reproduce the state left by an earlier drain before the size notice.
    journal.append({ kind: 'hold', id: journal.view.order[0]!.id, reason: 'memory correction pending', at: 1000 });
    journal.append({ kind: 'hold', id: journal.view.order[1]!.id, reason: 'summary oversized turn', at: 1000 });
    await worker.drain();
    expect(sent).toEqual(['PREVIEW — First answer', TOO_LONG_INPUT_NOTICE]);
    expect(journal.view.order.map(turn => turn.held)).toEqual([undefined, undefined]);
    journal.close();
    const replay = openPreviewJournal(path, key);
    const resumed = createJournalWorker(replay, { now: () => 1001, stopped: () => false,
      model: async () => { throw Error('duplicate model call'); },
      send: async () => { throw Error('duplicate send'); }, checkOutbound: () => {} });
    await resumed.drain();
    expect(replay.view.order.map(turn => turn.sent)).toEqual([1, 2]);
    expect(replay.view.order.map(turn => turn.held)).toEqual([undefined, undefined]);
    replay.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it.each([{ verdict: 'pass', receipt: 7 }, { verdict: 'pass', receipt: null },
  { verdict: 'violation', receipt: 7 }, { verdict: 'violation', receipt: null }] as const)(
  'reports the exact $verdict size-notice intent after send $receipt and replay', async ({ verdict, receipt }) => {
  const dir = root();
  try {
    const path = join(dir, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis());
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'Follow-up answer',
      replyCheck: { elapsedMs: () => 1, jev: async () => { throw Error('Jev unavailable'); },
        escalate: async () => ({ verdict, ruleIds: [], confidence: null, latencyMs: 1 }) },
      // Rules 77/86: a review objection never replaces the notice; it is recorded with the send.
      send: async ({ text }) => { expect(text).toBe(TOO_LONG_INPUT_NOTICE);
        return receipt; }, checkOutbound: () => {} });
    worker.intake([update(1, 'x'.repeat(4097))]);
    await worker.drain();
    expect(journal.view.order[0]?.intent).toBe(TOO_LONG_INPUT_NOTICE);
    expect(journal.view.order[0]?.release?.review).toBe(verdict === 'pass' ? undefined : 'violation');
    journal.close();
    const replay = openPreviewJournal(path, key);
    const resumed = createJournalWorker(replay, { now: () => 1001, stopped: () => false,
      model: async () => { throw Error('duplicate model call'); },
      send: async () => { throw Error('duplicate send'); }, checkOutbound: () => {} });
    await resumed.drain();
    expect(status(dir).tooLong).toEqual([{ update: 1, kind: 'input',
      delivery: receipt === null ? 'UNKNOWN' : 'Telegram API accepted' }]);
    // The next prompt must describe the exact prior intent, including after journal replay. w3-floorduty: that prompt
    // now also carries the obligation guide's floor form (Rules 3, 93), so that next turn gets those bytes beside the
    // history it is checked for; the over-limit first message above is judged at the original limit.
    replay.view.limits.maxBytes += OBLIGATION_FLOOR_PACKET_BYTES;
    const context = await (async () => {
      const next = createJournalWorker(replay, { now: () => 1002, stopped: () => false,
        model: async ({ context }) => context, send: async () => 8, checkOutbound: () => {} });
      next.intake([update(2, 'What happened?')]);
      await next.drain();
      return replay.view.order[1]?.answer ?? '';
    })();
    expect(context).toContain(receipt === null ? 'too-long notice delivery UNKNOWN' : 'too-long notice Telegram API accepted');
    replay.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('retains Telegram split parts as distinct updates and answers or explains each part', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'I can read this part.',
      send: async ({ text }) => { sent.push(text); return sent.length; }, checkOutbound: () => {} });
    const first = 'A'.repeat(3000), second = 'B'.repeat(3000);
    worker.intake([update(1, first), update(2, second)]);
    await worker.drain();
    expect(journal.view.order.map(turn => turn.text)).toEqual([first, second]);
    expect(journal.view.cursor).toBe(3);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toContain('I can read this part.');
    expect(sent[1] === TOO_LONG_INPUT_NOTICE || sent[1]?.includes('I can read this part.')).toBe(true);
    journal.close();
    const replay = openPreviewJournal(join(dir, 'journal.encrypted'), key);
    const resumed = createJournalWorker(replay, { now: () => 1001, stopped: () => false,
      model: async () => { throw Error('duplicate model call'); }, send: async () => { throw Error('duplicate send'); },
      checkOutbound: () => {} });
    resumed.intake([update(1, first), update(2, second)]);
    await resumed.drain();
    expect(replay.view.order).toHaveLength(2);
    expect(replay.view.replies).toBe(2);
    replay.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('distinguishes a measured complete-envelope overflow from a temporary preparation failure', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', 'grant:preview', 1000, 4096),
      model: async () => { calls++; return 'should never run'; }, send: async () => 7, checkOutbound: () => {} });
    worker.intake([update(1, 'x'.repeat(1800))]); await worker.drain();
    expect(calls).toBe(0);
    expect(journal.view.order[0]?.intent).toBe(TOO_LONG_INPUT_NOTICE);
    expect(journal.view.order[0]?.text).toBe('x'.repeat(1800));
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it.each(['before:intent', 'after:intent'])('recovers a too-long notice at %s without duplicate delivery', async boundary => {
  const dir = root();
  try {
    const path = join(dir, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, genesis(), stage => {
      if (stage === boundary) throw Error('simulated crash');
    });
    let sends = 0;
    const first = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('model must not run'); },
      send: async () => { sends++; return 7; }, checkOutbound: () => {} });
    first.intake([update(1, 'x'.repeat(4097))]);
    await expect(first.drain()).rejects.toThrow('simulated crash');
    journal.close();
    const replay = openPreviewJournal(path, key);
    const resumed = createJournalWorker(replay, { now: () => 1001, stopped: () => false,
      model: async () => { throw Error('model must not run'); },
      send: async ({ text }) => { expect(text).toBe(TOO_LONG_INPUT_NOTICE); sends++; return 8; }, checkOutbound: () => {} });
    await resumed.drain();
    expect(sends).toBe(boundary === 'before:intent' ? 1 : 0);
    expect(replay.view.replies).toBe(1);
    expect(replay.view.order[0]?.sent).toBe(boundary === 'before:intent' ? 8 : undefined);
    replay.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('does not prepare a too-long notice after stop, then sends it once when resumed', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
    let stopped = false, sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
      model: async () => { throw Error('model must not run'); }, send: async () => { sends++; return 7; },
      checkOutbound: () => {} });
    worker.intake([update(1, 'x'.repeat(4097))]);
    stopped = true;
    await expect(worker.drain()).rejects.toThrow('preview stopped');
    expect(journal.view.order[0]?.noticeClass).toBeUndefined();
    expect(sends).toBe(0);
    stopped = false;
    await worker.drain();
    expect(journal.view.order[0]?.sent).toBe(7);
    expect(sends).toBe(1);
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('sends a full reply at the Telegram boundary, and a longer or HTML-expanded answer whole across two messages in order', async () => {
  // Plan #466 (w4-statuslen): an answer past one Telegram message is split, never refused for its length.
  for (const answer of ['a'.repeat(4084), 'a'.repeat(4085), '<'.repeat(1200)]) {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
      const sent: string[] = [];
      let message = 7;
      const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
        model: async () => answer, send: async ({ text }) => { sent.push(text); return message++; }, checkOutbound: () => {} });
      worker.intake([update(1, 'Short question')]); await worker.drain();
      expect(journal.view.order[0]?.answer).toBe(answer);
      expect(journal.view.order[0]?.intent).toBe(`PREVIEW — ${answer}`);
      expect(sent).toHaveLength(Buffer.byteLength(`PREVIEW — ${answer}`) <= 4096 && answer[0] !== '<' ? 1 : 2);
      for (const body of sent) expect(Buffer.byteLength(body)).toBeLessThanOrEqual(4096);
      expect(status(dir).tooLong).toEqual([]);
      expect(status(dir).unknownSends).toBe(0);
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
