import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJournalWorker, HELD_NOTICE_AFTER_MS, openPreviewJournal, raiseJournalCaps } from './journal.js';

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
        model: async () => { throw Error('held answer ran'); }, checkOutbound: () => {},
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
      answer: 'answer', outcome: 'Telegram API accepted', heldNotice: second.view.order[0]?.heldNoticeIntent });
    second.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

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
