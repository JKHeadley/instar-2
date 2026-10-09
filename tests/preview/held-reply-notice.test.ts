import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, HELD_NOTICE_AFTER_MS, HELD_NOTICE_WINDOW_MS, openPreviewJournal, raiseJournalCaps, reportJournalCap } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(7);
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'held-reply-notice-')));
const genesis = (calls = 2, replies = 3) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: calls, maxReplies: replies, maxTurns: 3, maxBytes: 262144, cursor: 0 });
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, date: 1_600_000_000, text: `question ${id}` } });

// Rule 87: an unchanged held status is pull-only. It stays on `status` and in the mind's packet;
// it is never pushed, however long it waits. A capacity hold gets the prompt limited answer
// instead (minimal-responder.test.ts); a review outage no longer holds at all.
it('never pushes a held status: it stays visible on the pull surface', async () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis());
    let now = 1_000, sends = 0;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'UTC',
      model: async input => {
        if (input.id.startsWith('summary:')) return { state: 'rejected' as const, failureClass: 'rejected' as const };
        throw Error('held answer ran');
      }, checkOutbound: () => {}, send: async () => { sends++; return 12; } });
    worker.intake([update(1), update(2)]);
    for (const turn of journal.view.order) journal.append({ kind: 'hold', id: turn.id, reason: 'memory correction pending', at: now });
    for (const step of [HELD_NOTICE_AFTER_MS + 1, HELD_NOTICE_WINDOW_MS, 3 * HELD_NOTICE_WINDOW_MS]) {
      now += step; await worker.drain(); await worker.minimal();
    }
    expect({ sends, replies: journal.view.replies }).toEqual({ sends: 0, replies: 0 });
    expect(journal.view.order.every(turn => turn.heldNoticeIntent === undefined)).toBe(true);
    journal.close();
    const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', dir],
    { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
      encoding: 'utf8', timeout: 10000 });
    expect(status.status, status.stderr).toBe(0);
    const reported = JSON.parse(status.stdout);
    expect(reported.heldNotices).toEqual([]);
    expect(reported.holds.map((item: { update: number }) => item.update)).toEqual([1, 2]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('replays a parent-format burst, keeps both intents fenced, and applies the hour to the next counted notice', async () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    let now = 1_000, sends = 0;
    const first = openPreviewJournal(path, key, genesis(1, 4));
    const worker = createJournalWorker(first, { now: () => now, stopped: () => false,
      model: async () => { throw Error('model ran'); }, checkOutbound: () => {},
      send: async () => { sends++; return 13; } });
    worker.intake([update(1), update(2)]);
    for (const turn of first.view.order) first.append({ kind: 'hold', id: turn.id, reason: 'call cap', at: now });
    now += HELD_NOTICE_AFTER_MS + 1;
    for (const turn of first.view.order) {
      first.append({ kind: 'held-notice-intent', id: turn.id,
        text: "PREVIEW — I'm holding my answer to your message from 12:26; it will follow or I'll tell you why",
        chat: first.view.genesis.chat, update: turn.update, grant: first.view.genesis.grant, at: now });
    }
    first.append({ kind: 'held-notice-sent', id: first.view.order[0]!.id, message: 12, at: now });
    first.close();

    const reopened = openPreviewJournal(path, key);
    const resumed = createJournalWorker(reopened, { now: () => now, stopped: () => false,
      model: async () => { throw Error('model ran'); }, checkOutbound: () => {},
      send: async () => { sends++; return 13; } });
    expect(reopened.view.order.map(turn => turn.heldNoticeSent)).toEqual([12, undefined]);
    await resumed.drain();
    expect(sends).toBe(0);
    resumed.intake([update(3)]);
    reopened.append({ kind: 'hold', id: reopened.view.order[2]!.id, reason: 'memory correction pending', at: now });
    // Earlier notices replay unchanged; no new held status is pushed after them (Rule 87).
    now += HELD_NOTICE_AFTER_MS + 1 + HELD_NOTICE_WINDOW_MS;
    await resumed.drain(); await resumed.drain();
    expect(sends).toBe(0);
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const receipt of [12, null] as const) {
  it(`recovers the hour fence from an older snapshot with notice receipt ${String(receipt)}`, async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    try {
      let now = 1_000, sends = 0;
      let oldProjection: typeof first.view.awayEvents = [];
      const first = openPreviewJournal(path, key, genesis(1, 3), stage => {
        if (stage === 'compact:after-fsync') first.view.awayEvents = oldProjection;
      });
      const worker = createJournalWorker(first, { now: () => now, stopped: () => false,
        model: async () => { throw Error('model ran'); }, checkOutbound: () => {},
        send: async () => { sends++; return receipt; } });
      worker.intake([update(1)]);
      const turn = first.view.order[0]!;
      first.append({ kind: 'hold', id: turn.id, reason: 'call cap', at: now });
      now += HELD_NOTICE_AFTER_MS + 1;
      first.append({ kind: 'held-notice-intent', id: turn.id,
        text: "PREVIEW — I'm holding my answer to your message from 12:26; it will follow or I'll tell you why",
        chat: first.view.genesis.chat, update: turn.update, grant: first.view.genesis.grant, at: now });
      if (receipt !== null) first.append({ kind: 'held-notice-sent', id: turn.id, message: receipt, at: now });
      // Emulate the parent's saved view: it retained the intent but omitted its away event.
      oldProjection = first.view.awayEvents;
      first.view.awayEvents = oldProjection.filter(event => event.kind !== 'held-notice-intent');
      first.compact();
      first.close();

      const reopened = openPreviewJournal(path, key);
      expect(reopened.view.awayEvents.filter(event => event.kind === 'held-notice-intent')).toEqual([
        { kind: 'held-notice-intent', at: 1_000 + HELD_NOTICE_AFTER_MS + 1, id: turn.id }]);
      const resumed = createJournalWorker(reopened, { now: () => now, stopped: () => false,
        model: async () => { throw Error('model ran'); }, checkOutbound: () => {},
        send: async () => { sends++; return 13; } });
      resumed.intake([update(2)]);
      reopened.append({ kind: 'hold', id: reopened.view.order[1]!.id, reason: 'memory correction pending', at: now });
      now += 2 * HELD_NOTICE_WINDOW_MS;
      await resumed.drain(); await resumed.drain();
      expect(sends).toBe(0);
      reopened.compact();
      reopened.close();
      const again = openPreviewJournal(path, key);
      expect(again.view.awayEvents.filter(event => event.kind === 'held-notice-intent')).toHaveLength(1);
      again.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

it('fences an uncertain limited answer and later releases the capped answer once', async () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    const first = openPreviewJournal(path, key, genesis(1));
    let now = 1_000, sends = 0;
    const worker = createJournalWorker(first, { now: () => now, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async () => { sends++; return null; } });
    worker.intake([update(1)]);
    const id = first.view.order[0]!.id;
    first.append({ kind: 'reserve', id, at: now });
    first.append({ kind: 'answer', id, text: 'answer', state: 'complete', at: now });
    first.append({ kind: 'hold', id, reason: 'call cap', at: now });
    await worker.drain(); await worker.drain(); first.close();
    expect(sends).toBe(1);
    const second = openPreviewJournal(path, key);
    expect(second.view.order[0]?.limited?.lead).toBe(id);
    expect(second.view.order[0]?.limitedSent).toBeUndefined();
    raiseJournalCaps(second, { maxCalls: 3, maxReplies: 3, maxTurns: 3, authority: 'test operator', at: now + 1 });
    const resumed = createJournalWorker(second, { now: () => now + 2, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async input => { sends++; expect(input.expectedText).toBe('answer'); return 15; } });
    const before = resumed.probe('next');
    if (!('context' in before)) throw Error('expected a packet');
    const packet = JSON.parse(before.context);
    expect(packet.history[0]).toMatchObject({ answer: null, outcome: 'answer pending', limitedAnswer: true,
      limitedAnswerOutcome: 'limited answer (calls allowance) delivery UNKNOWN' });
    expect(packet.capability).toContain('do not narrate a past hold or repeat its notice');
    await resumed.drain(); await resumed.drain();
    expect({ sends, replies: second.view.replies, answerSent: second.view.order[0]?.sent }).toEqual({ sends: 2, replies: 1, answerSent: 15 });
    const after = resumed.probe('next');
    if ('context' in after) expect(JSON.parse(after.context).history[0]).toMatchObject({
      answer: 'answer', outcome: 'Telegram API accepted', limitedAnswer: true });
    second.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const [noticeReceipt, answerReceipt, unknownSends] of [
  [null, null, 2], [null, 15, 1], [12, 15, 0],
] as const) {
  it(`keeps notice ${String(noticeReceipt)} and answer ${String(answerReceipt)} outcomes distinct in status, history, and recall`, async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    try {
      const journal = openPreviewJournal(path, key, genesis(1));
      let now = 1_000;
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
        model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
        send: async input => input.expectedText.includes("I can't answer yet") ? noticeReceipt : answerReceipt });
      worker.intake([update(1)]);
      const id = journal.view.order[0]!.id;
      journal.append({ kind: 'reserve', id, at: now });
      journal.append({ kind: 'answer', id, text: 'answer', state: 'complete', at: now });
      journal.append({ kind: 'hold', id, reason: 'call cap', at: now });
      now += HELD_NOTICE_AFTER_MS + 1;
      await worker.drain();
      raiseJournalCaps(journal, { maxCalls: 3, maxReplies: 3, maxTurns: 3, authority: 'test operator', at: now + 1 });
      await worker.drain();
      journal.close();

      const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/journal-agent.mjs', 'status', '--root', dir],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
      expect(status.status, status.stderr).toBe(0);
      const reported = JSON.parse(status.stdout);
      expect(reported.unknownSends).toBe(unknownSends);
      expect(reported.self).toContain(`${String(unknownSends)} send(s)`);
      expect(reported.heldNotices).toEqual([]);
      expect(reported.minimalReserve.limitedAnswers).toEqual([{ update: 1, reason: 'calls', covers: [1],
        state: noticeReceipt === null ? 'UNKNOWN' : 'api-accepted' }]);

      const reopened = openPreviewJournal(path, key);
      try {
        const resumed = createJournalWorker(reopened, { now: () => now + 2, stopped: () => false,
          model: async () => { throw Error('model repeated'); }, checkOutbound: () => {}, send: async () => { throw Error('send repeated'); } });
        const expected = { limitedAnswer: true,
          limitedAnswerOutcome: `limited answer (calls allowance) ${noticeReceipt === null ? 'delivery UNKNOWN' : 'Telegram API accepted'}`,
          answer: 'answer', outcome: answerReceipt === null ? 'delivery UNKNOWN' : 'Telegram API accepted' };
        const history = resumed.probe('question 1');
        if (!('context' in history)) throw Error(`history unavailable: ${history.reason}`);
        expect(JSON.parse(history.context).history[0]).toMatchObject(expected);
        reopened.append({ kind: 'summary-reserve', through: 1, at: now + 3 });
        reopened.append({ kind: 'summary', through: 1, text: 'The operator asked question 1.', at: now + 4 });
        const compact = createJournalWorker(reopened, { now: () => now + 5, stopped: () => false,
          prepareModel: input => {
            if (JSON.parse(input.context).historyMode === 'complete') throw Error('use available summary');
            return input.context;
          }, model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
          send: async () => { throw Error('send repeated'); } });
        const recalled = compact.probe('question 1');
        if (!('context' in recalled)) throw Error(`recall unavailable: ${recalled.reason}`);
        expect(JSON.parse(recalled.context).recalled[0]).toMatchObject(expected);
      } finally { reopened.close(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

it('stop prevents every notice; the reply cap no longer silences a capped message', async () => {
  for (const limited of [false, true]) {
    const dir = root();
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(2, limited ? 1 : 3));
      let now = 1_000, sends = 0;
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => !limited,
        model: async () => 'answer', checkOutbound: () => {}, send: async () => { sends++; return 1; } });
      if (limited) {
        worker.intake([update(1)]); await worker.drain();
        worker.intake([update(2)]);
        journal.append({ kind: 'hold', id: journal.view.order[1]!.id, reason: 'call cap', at: now });
      } else {
        // Intake under an active stop is refused, so latch stop after durable intake.
        const active = createJournalWorker(journal, { now: () => now, stopped: () => false,
          model: async () => 'answer', checkOutbound: () => {}, send: async () => 1 });
        active.intake([update(1)]);
        journal.append({ kind: 'hold', id: journal.view.order[0]!.id, reason: 'memory correction pending', at: now });
      }
      now += HELD_NOTICE_AFTER_MS + 1;
      if (limited) await worker.drain(); else await expect(worker.drain()).rejects.toThrow('preview stopped');
      // Rule 15: past the reply cap the reserve still gives the capped message its limited answer.
      expect(sends).toBe(limited ? 2 : 0);
      expect(journal.view.order.at(-1)?.heldNoticeIntent).toBeUndefined();
      if (limited) expect(journal.view.order.at(-1)?.limited?.reason).toBe('calls');
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

it('answers a capped message at once from the reserve even when the update cap wins the reported reason', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, { ...genesis(1, 3), maxTurns: 1 });
    const now = 1_000; const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => { throw Error('no model slot'); },
      replyCheck: { elapsedMs: () => now, jev: async () => { throw Error('unexpected Jev'); },
        escalate: async () => { throw Error('unexpected review'); } },
      checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return 1; } });
    worker.intake([update(1)]); await worker.drain();
    expect(reportJournalCap(journal, now, () => {})).toBe('update cap reached');
    expect(journal.view.order[0]?.held).toBe('call cap');
    expect(sends).toHaveLength(1);
    expect(sends[0]).toContain("I can't answer yet");
    await worker.drain(); expect(sends).toHaveLength(1);
    // The launcher no longer ends its run at a cap: reading continues through the reserve.
    const launcher = readFileSync(join(process.cwd(), 'tests/preview/journal-agent.mjs'), 'utf8');
    expect(launcher).not.toContain('stopAtCap');
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
