import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, HELD_NOTICE_AFTER_MS, openPreviewJournal, raiseJournalCaps, reportJournalCap } from './journal.js';

const key = new Uint8Array(32).fill(7);
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'held-reply-notice-')));
const genesis = (calls = 2, replies = 3) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: calls, maxReplies: replies, maxTurns: 3, maxBytes: 262144, cursor: 0 });
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, date: 1_600_000_000, text: `question ${id}` } });

for (const reason of ['reply check unavailable', 'call cap', 'memory correction pending']) {
  it(`sends one fixed notice only after ten minutes of ${reason}`, async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    try {
      const journal = openPreviewJournal(path, key, genesis());
      let now = 1_000, sends = 0;
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'UTC',
        model: async input => {
          if (reason === 'memory correction pending' && input.id.startsWith('summary:'))
            return { state: 'rejected' as const, failureClass: 'rejected' as const };
          throw Error('held answer ran');
        }, checkOutbound: () => {},
        send: async input => { sends++; expect(input.expectedText).toBe("PREVIEW — I'm holding my answer to your message from 12:26; it will follow or I'll tell you why");
          return 12; } });
      worker.intake([update(1)]);
      const turn = journal.view.order[0]!;
      journal.append({ kind: 'hold', id: turn.id, reason, at: now });
      expect(worker.nextHeldNoticeAt()).toBe(now + HELD_NOTICE_AFTER_MS + 1);
      now += HELD_NOTICE_AFTER_MS;
      await worker.drain(); expect(sends).toBe(0);
      now++;
      await worker.drain(); await worker.drain();
      expect({ sends, replies: journal.view.replies, held: turn.held, answer: turn.answer, sent: turn.heldNoticeSent })
        .toEqual({ sends: 1, replies: 1, held: reason, answer: undefined, sent: 12 });
      if (reason === 'call cap') {
        const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
          'tests/preview/journal-agent.mjs', 'status', '--root', dir],
        { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
          encoding: 'utf8', timeout: 10000 });
        expect(status.status, status.stderr).toBe(0);
        expect(JSON.parse(status.stdout).heldNotices).toEqual([{ update: 1, state: 'api-accepted' }]);
      }
      journal.close();
      const reopened = openPreviewJournal(path, key);
      const resumed = createJournalWorker(reopened, { now: () => now + 1_000_000, stopped: () => false,
        model: async () => { throw Error('held answer ran'); }, checkOutbound: () => {},
        send: async () => { sends++; return 13; } });
      await resumed.drain();
      expect(sends).toBe(1);
      expect(resumed.nextHeldNoticeAt()).toBeNull();
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

it('fences an uncertain notice send and later releases the held answer once', async () => {
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
    await worker.drain();
    expect(first.view.order[0]?.held).toBe('call cap');
    now += HELD_NOTICE_AFTER_MS + 1;
    await worker.drain(); first.close();
    expect(sends).toBe(1);
    const second = openPreviewJournal(path, key);
    expect(second.view.order[0]?.heldNoticeIntent).toContain("I'm holding my answer");
    expect(second.view.order[0]?.heldNoticeSent).toBeUndefined();
    raiseJournalCaps(second, { maxCalls: 3, maxReplies: 3, maxTurns: 3, authority: 'test operator', at: now + 1 });
    const resumed = createJournalWorker(second, { now: () => now + 2, stopped: () => false,
      model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
      send: async input => { sends++; expect(input.expectedText).toBe('PREVIEW — answer'); return 15; } });
    const before = resumed.probe('next');
    if ('context' in before) expect(JSON.parse(before.context).history[0]).toMatchObject({
      answer: null, outcome: 'held notice delivery UNKNOWN; answer pending' });
    await resumed.drain(); await resumed.drain();
    expect({ sends, replies: second.view.replies, answerSent: second.view.order[0]?.sent }).toEqual({ sends: 2, replies: 2, answerSent: 15 });
    const after = resumed.probe('next');
    if ('context' in after) expect(JSON.parse(after.context).history[0]).toMatchObject({
      answer: 'answer', outcome: 'Telegram API accepted', heldNotice: second.view.order[0]?.heldNoticeIntent,
      heldNoticeOutcome: 'delivery UNKNOWN' });
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
        send: async input => input.expectedText.includes("I'm holding my answer") ? noticeReceipt : answerReceipt });
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
      expect(reported.heldNotices).toEqual([{ update: 1, state: noticeReceipt === null ? 'UNKNOWN' : 'api-accepted' }]);

      const reopened = openPreviewJournal(path, key);
      try {
        const resumed = createJournalWorker(reopened, { now: () => now + 2, stopped: () => false,
          model: async () => { throw Error('model repeated'); }, checkOutbound: () => {}, send: async () => { throw Error('send repeated'); } });
        const expected = { heldNotice: reopened.view.order[0]?.heldNoticeIntent,
          heldNoticeOutcome: noticeReceipt === null ? 'delivery UNKNOWN' : 'Telegram API accepted',
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

it('stop and reply cap prevent a due notice', async () => {
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
        journal.append({ kind: 'hold', id: journal.view.order[0]!.id, reason: 'call cap', at: now });
      }
      now += HELD_NOTICE_AFTER_MS + 1;
      if (limited) await worker.drain(); else await expect(worker.drain()).rejects.toThrow('preview stopped');
      expect(sends).toBe(limited ? 1 : 0);
      expect(journal.view.order.at(-1)?.heldNoticeIntent).toBeUndefined();
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

it('starts the ten-minute clock at an eligible hold and refuses an expired send', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
    let now = 1_000, sends = 0;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => { throw Error('held answer ran'); }, checkOutbound: () => {},
      send: async () => { sends++; return 1; } });
    worker.intake([update(1)]);
    const id = journal.view.order[0]!.id;
    journal.append({ kind: 'hold', id, reason: 'prompt overflow', at: now });
    now += HELD_NOTICE_AFTER_MS + 1;
    expect(worker.nextHeldNoticeAt()).toBeNull();
    journal.append({ kind: 'hold', id, reason: 'reply check unavailable', at: now });
    expect(worker.nextHeldNoticeAt()).toBe(now + HELD_NOTICE_AFTER_MS + 1);
    journal.append({ kind: 'hold', id, reason: 'call cap', at: now + 1 });
    expect(worker.nextHeldNoticeAt()).toBe(now + HELD_NOTICE_AFTER_MS + 1);
    now = journal.view.genesis.expires;
    await expect(worker.drain()).rejects.toThrow('preview stopped');
    expect(sends).toBe(0);
    expect(journal.view.order[0]?.heldNoticeIntent).toBeUndefined();
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('waits for an eligible held notice even when the update cap wins the reported reason', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, { ...genesis(1, 3), maxTurns: 1 });
    let now = 1_000; const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => { throw Error('no model slot'); },
      replyCheck: { elapsedMs: () => now, jev: async () => { throw Error('unexpected Jev'); },
        escalate: async () => { throw Error('unexpected review'); } },
      checkOutbound: () => {}, send: async input => { sends.push(input.expectedText); return 1; } });
    worker.intake([update(1)]); await worker.drain();
    const cap = reportJournalCap(journal, now, () => {});
    expect(cap).toBe('update cap reached');
    expect(journal.view.order[0]?.held).toBe('call cap');
    const due = worker.nextHeldNoticeAt();
    expect(due).toBe(now + HELD_NOTICE_AFTER_MS + 1);
    const launcher = readFileSync(join(process.cwd(), 'tests/preview/journal-agent.mjs'), 'utf8');
    const source = launcher.slice(launcher.indexOf('    const waitHeldNotices ='), launcher.indexOf('    for (let i = 0; i < cycles'));
    const stopAtCap = new Function('reportCap', 'worker', 'summarizeLater', 'signalled', 'workerStop', 'existsSync', 'stopPath', 'Date', 'journal', 'delay',
      `let endReason; ${source}; return stopAtCap;`)(() => cap, worker, () => {}, false, { value: false }, () => false, 'offline',
      { now: () => now }, journal, async (ms: number) => { now += ms; }) as () => Promise<boolean>;
    expect(await stopAtCap()).toBe(true);
    expect(now).toBeGreaterThanOrEqual(due!);
    expect(sends).toHaveLength(1);
    await worker.drain(); expect(sends).toHaveLength(1);
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
