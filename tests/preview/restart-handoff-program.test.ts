import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';
import { activationMatchesJournal, createJournalWorker, HELD_NOTICE_AFTER_MS, openPreviewJournal,
  renewJournalExpiry } from './journal.js';

const key = new Uint8Array(32).fill(7);
const start = 1_790_000_000_000;
const priorExpiry = start + 86_400_000;
const renewedExpiry = SUBSCRIPTION_PREVIEW_EXPIRY;
const rootFor = () => realpathSync(mkdtempSync(join(tmpdir(), 'restart-handoff-program-')));
const pathFor = (root: string) => join(root, 'journal.encrypted');
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: priorExpiry,
  maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
} });
const sends = (root: string) => existsSync(join(root, 'sends.log'))
  ? readFileSync(join(root, 'sends.log'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { update: number; text: string }) : [];
const calls = (root: string) => existsSync(join(root, 'calls.log'))
  ? readFileSync(join(root, 'calls.log'), 'utf8').trim().split('\n').filter(Boolean) : [];
const workerFor = (journal: ReturnType<typeof openPreviewJournal>, root: string, now: () => number,
  stopped: () => boolean = () => false) => createJournalWorker(journal, {
    now, stopped,
    model: async ({ id, context }) => {
      writeFileSync(join(root, 'calls.log'), `${id}\n`, { flag: 'a' });
      return context.includes('Silver otter 731') ? 'Silver otter 731' : 'I remember.';
    },
    send: async ({ update: id, expectedText }) => {
      writeFileSync(join(root, 'sends.log'), `${JSON.stringify({ update: id, text: expectedText })}\n`, { flag: 'a' });
      return sends(root).length;
    },
    checkOutbound: () => {},
  });

async function fixture(root: string) {
  let now = start;
  const clock = () => now;
  const journal = openPreviewJournal(pathFor(root), key, genesis);
  const worker = workerFor(journal, root, clock);
  worker.intake([update(1, 'The code is Silver otter 731.')]);
  await worker.drain();
  worker.intake([update(2, 'Hold this answer while the reply check is unavailable.')]);
  const held = journal.view.order[1]!;
  journal.append({ kind: 'hold', id: held.id, reason: 'reply check unavailable', at: now });
  now += HELD_NOTICE_AFTER_MS + 1;
  await worker.drain();
  worker.intake([update(3, 'A model call whose outcome may be lost.'), update(4, 'A send whose receipt may be lost.')]);
  const call = journal.view.order[2]!.id, send = journal.view.order[3]!.id;
  journal.append({ kind: 'reserve', id: call, at: now });
  journal.append({ kind: 'reserve', id: send, at: now });
  journal.append({ kind: 'answer', id: send, text: 'Silver otter 731', at: now });
  journal.append({ kind: 'intent', id: send, text: 'PREVIEW — Silver otter 731', chat: genesis.chat,
    update: 4, grant: genesis.grant, at: now });
  // The transport may have accepted this send before its receipt was lost.
  writeFileSync(join(root, 'sends.log'), `${JSON.stringify({ update: 4, text: 'PREVIEW — Silver otter 731' })}\n`, { flag: 'a' });
  expect(sends(root).map(sent => sent.update)).toEqual([1, 2, 4]);
  expect(journal.view.order[1]?.heldNoticeSent).toBeDefined();
  const before = worker.probe('What was the code?');
  journal.close();
  return { clock, before };
}

async function assertReopened(root: string, clock: () => number, before: unknown) {
  const journal = openPreviewJournal(pathFor(root), key);
  try {
    const worker = workerFor(journal, root, clock);
    expect(worker.probe('What was the code?')).toEqual(before);
    await worker.drain();
    expect(journal.view.order.map(turn => turn.update)).toEqual([1, 2, 3, 4]);
    expect(journal.view.cursor).toBe(5);
    expect(sends(root).map(sent => sent.update)).toEqual([1, 2, 4]);
    expect(new Set(calls(root)).size).toBe(calls(root).length);
    expect(calls(root)).not.toContain(journal.view.order[2]!.id);
    expect(journal.view.order[2]?.answer).toBeUndefined();
    expect(journal.view.order[3]?.intent).toBe('PREVIEW — Silver otter 731');
    expect(journal.view.order[3]?.sent).toBeUndefined();
    expect(journal.view.order[1]?.intent).toBeUndefined();
    expect(journal.view.order[1]?.heldNoticeSent).toBeDefined();
    expect(worker.probe('What was the code?')).toEqual(before);
  } finally { journal.close(); }
}

it('graceful close and reopen preserve intake, recall and the one held notice', async () => {
  const root = rootFor();
  try { const { clock, before } = await fixture(root); await assertReopened(root, clock, before); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

it('operator stop stays latched across reopen without losing recorded memory', async () => {
  const root = rootFor();
  try {
    const { clock, before } = await fixture(root);
    const journal = openPreviewJournal(pathFor(root), key);
    workerFor(journal, root, clock).stop('operator');
    journal.close();
    const reopened = openPreviewJournal(pathFor(root), key);
    try {
      const worker = workerFor(reopened, root, clock);
      expect(reopened.view.stop).toBe('operator');
      expect(worker.probe('What was the code?')).toEqual(before);
      expect(() => worker.gate()).toThrow('preview stopped');
      expect(sends(root).map(send => send.update)).toEqual([1, 2, 4]);
    } finally { reopened.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['after:reserve:5', 'after:intent:5'])('crash %s keeps uncertain work fenced', async cut => {
  const root = rootFor();
  try {
    const { clock, before } = await fixture(root);
    const journal = openPreviewJournal(pathFor(root), key);
    const id = 'telegram:12345678:update:5';
    journal.append({ kind: 'intake', id, update: 5, text: 'What was the code?', raw: JSON.stringify(update(5, 'What was the code?')),
      accepted: true, cursor: 6, at: clock() });
    if (cut === 'after:reserve:5') journal.append({ kind: 'reserve', id, at: clock() });
    else {
      journal.append({ kind: 'reserve', id, at: clock() });
      journal.append({ kind: 'answer', id, text: 'Silver otter 731', at: clock() });
      journal.append({ kind: 'intent', id, text: 'PREVIEW — Silver otter 731', chat: genesis.chat,
        update: 5, grant: genesis.grant, at: clock() });
      // Telegram may already have accepted this physical send. The absent receipt is UNKNOWN.
      writeFileSync(join(root, 'sends.log'), `${JSON.stringify({ update: 5, text: 'PREVIEW — Silver otter 731' })}\n`, { flag: 'a' });
    }
    const atCut = workerFor(journal, root, clock).probe('What was the code?');
    journal.close();
    const reopened = openPreviewJournal(pathFor(root), key);
    try {
      const worker = workerFor(reopened, root, clock);
      await worker.drain();
      expect(reopened.view.order.map(turn => turn.update)).toEqual([1, 2, 3, 4, 5]);
      expect(reopened.view.cursor).toBe(6);
      expect(reopened.view.order[4]?.reserved).toBe(true);
      expect(reopened.view.order[4]?.sent).toBeUndefined();
      expect(sends(root).filter(sent => sent.update === 5)).toHaveLength(cut.includes('intent') ? 1 : 0);
      expect(calls(root)).not.toContain(id);
      expect(reopened.view.order[1]?.heldNoticeSent).toBeDefined();
      expect(worker.probe('What was the code?')).toEqual(atCut);
      expect(JSON.stringify(before)).toContain('Silver otter 731');
    } finally { reopened.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('a crash after a held-notice intent leaves UNKNOWN and never dispatches it again', async () => {
  const root = rootFor();
  try {
    const journal = openPreviewJournal(pathFor(root), key, genesis);
    let now = start;
    const worker = workerFor(journal, root, () => now);
    worker.intake([update(1, 'Please hold this answer.')]);
    const id = journal.view.order[0]!.id;
    journal.append({ kind: 'hold', id, reason: 'reply check unavailable', at: start });
    const notice = "PREVIEW — I'm holding my answer to your message from 00:00; it will follow or I'll tell you why";
    journal.append({ kind: 'held-notice-intent', id, text: notice, chat: genesis.chat,
      update: 1, grant: genesis.grant, at: start + HELD_NOTICE_AFTER_MS + 1 });
    now = start + HELD_NOTICE_AFTER_MS + 2;
    const atCut = worker.probe('What did I ask?');
    journal.close();
    const reopened = openPreviewJournal(pathFor(root), key);
    try {
      const resumed = workerFor(reopened, root, () => start + HELD_NOTICE_AFTER_MS + 2);
      expect(resumed.probe('What did I ask?')).toEqual(atCut);
      await resumed.drain();
      expect(reopened.view.order[0]?.heldNoticeIntent).toBe(notice);
      expect(reopened.view.order[0]?.heldNoticeSent).toBeUndefined();
      expect(reopened.view.replies).toBe(1);
      expect(sends(root)).toEqual([]);
      expect(calls(root)).toEqual([]);
    } finally { reopened.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('renewal changes expiry only and preserves recall and one-shot effects', async () => {
  const root = rootFor();
  try {
    const { clock, before } = await fixture(root);
    const journal = openPreviewJournal(pathFor(root), key);
    try {
      const activation = { trial: genesis.grant, baseConfigurationDigest: genesis.configurationDigest, expiresAt: renewedExpiry };
      expect(activationMatchesJournal(journal.view, activation)).toBe(false);
      renewJournalExpiry(journal, { expires: renewedExpiry, activation: `sha256:${'a'.repeat(64)}`,
        authority: 'reviewed offline renewal', at: clock() });
      expect(activationMatchesJournal(journal.view, activation)).toBe(true);
    } finally { journal.close(); }
    await assertReopened(root, clock, before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('the frozen14 reader and candidate reader agree on recall and effect fences across a build switch', async () => {
  const root = rootFor();
  const baselineModule = join(process.cwd(), 'tests/preview', `.frozen14-${String(process.pid)}.ts`);
  try {
    const { clock, before } = await fixture(root);
    const baselineSource = execFileSync('git', ['show', '7d824d64:tests/preview/journal.ts'], { encoding: 'utf8' });
    writeFileSync(baselineModule, baselineSource);
    const old = await import(pathToFileURL(baselineModule).href) as typeof import('./journal.js');
    const previous = old.openPreviewJournal(pathFor(root), key);
    try {
      expect(old.createJournalWorker(previous, { now: clock, stopped: () => false,
        model: async () => { throw Error('read only'); }, send: async () => { throw Error('read only'); }, checkOutbound: () => {} })
        .probe('What was the code?')).toEqual(before);
      expect(previous.view.order[1]?.heldNoticeSent).toBeDefined();
    } finally { previous.close(); }
    await assertReopened(root, clock, before);
  } finally { rmSync(baselineModule, { force: true }); rmSync(root, { recursive: true, force: true }); }
});
