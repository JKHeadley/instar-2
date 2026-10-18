import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createJournalWorker, openPreviewJournal, openBlockers, declaredObligations,
  PREVIEW_REPLY_BOUND_BYTES } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { HOLDING_REPLY, parseReplyRevision, parseReplyReviewVerdict, replyReviewContext } from './reply-check.js';

// Real update 6233134, authenticated physical frames 839–878. Outputs/verdicts are unedited.
// The final review port is explicitly controlled: the recorded objection requires an absent
// blocker. Only when the real validator supplies that exact record does this test return PASS.
// This proves admission -> reviewer packet -> durable send, not a fresh provider's judgment.
const capture = JSON.parse(readFileSync(new URL('./fixtures/refusal-withheld-6233134.json', import.meta.url), 'utf8'));
const frame = (n: number) => capture.frames.find((row: { frame: number }) => row.frame === n);
const revision = JSON.parse(frame(869).output);
const at = frame(839).at;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function verdict(n: number) {
  const read = readAnswer(frame(n).output, { wrapped: 'refuse', object: true });
  if (!read.ok) throw Error(read.defect);
  return { ...parseReplyReviewVerdict(read.value), confidence: null, latencyMs: 0 };
}
async function replay(options: { constraint?: string; claim?: string; noBlocker?: boolean;
  keepRecordedReview?: boolean; passRejected?: boolean; maxCalls?: number; stopBeforeSend?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'refusal-withheld-')); roots.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(19);
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 90 * 86400000,
    maxCalls: options.maxCalls ?? 8, maxReplies: 4, maxTurns: 4, maxBytes: 48000, cursor: 0 });
  const sent: string[] = [], packets: ReturnType<typeof declaredObligations>[] = [];
  let stopped = false, calls = 0;
  const corrected = structuredClone(revision);
  if (options.constraint) corrected.blocker.constraint = options.constraint;
  if (options.claim) { corrected.reply = options.claim; corrected.blocker.claim = options.claim; }
  if (options.noBlocker) delete corrected.blocker;
  const ports = { now: () => at, stopped: () => stopped, timeZone: 'America/Los_Angeles',
    toolRoute: () => true,
    prepareModel: (input: { question: string; context: string }) => JSON.stringify({ messages: [
      { role: 'user', content: input.question }, { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
    model: async () => { calls++; return frame(851).output as string; },
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: JSON.parse(frame(857).output) as unknown, latencyMs: 0 }),
      escalate: async (text: string, id: string, prompt?: string) => {
        const declared = declaredObligations(journal.view, id, at);
        const packet = JSON.parse(replyReviewContext(prompt!, text, [], declared));
        packets.push(packet.declaredObligations);
        if (packets.length === 1) return verdict(863);
        if (options.stopBeforeSend) stopped = true;
        if (options.keepRecordedReview || !declared.blocker && !options.passRejected) return verdict(874);
        if (declared.blocker) expect(packet.declaredObligations.blocker).toMatchObject({
          constraint: 'operator-authority', claim: corrected.blocker.claim, avenues: revision.blocker.avenues });
        return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 0,
          reason: 'Controlled review: the exact governed refusal now has its admitted investigation record.' };
      },
      revise: async () => ({ state: 'complete' as const,
        ...parseReplyRevision(JSON.stringify(corrected), ['claims_blocked', 'unrecorded_blocker']) }) },
    checkOutbound: () => {}, send: async (input: { text: string }) => { sent.push(input.text); return sent.length; } };
  const worker = createJournalWorker(journal, ports);
  const update = { update_id: 6233134, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
    text: frame(839).text as string, date: Math.floor(at / 1000) } };
  worker.intake([update]);
  if (options.stopBeforeSend) await expect(worker.drain()).rejects.toThrow('preview stopped');
  else await worker.drain();
  return { journal, worker, sent, packets, corrected, path, key, ports, update, calls: () => calls };
}

it('F3 recorded refusal reaches review with its real blocker and is delivered once across duplicate intake/restart', async () => {
  expect(Buffer.byteLength(revision.blocker.claim)).toBe(522);
  const w = await replay();
  expect(w.journal.view.order[0]!.revision?.rejectedBlocker).toBeUndefined();
  expect(w.packets[1]!.blocker).toMatchObject({ constraint: 'operator-authority', claim: revision.blocker.claim });
  expect(w.sent).toEqual([revision.reply]);
  expect(openBlockers(w.journal.view)).toHaveLength(1);
  expect(w.journal.view.order[0]!.toolAttempts ?? []).toHaveLength(0);
  w.worker.intake([w.update]); await w.worker.drain(); expect(w.sent).toHaveLength(1);
  w.journal.close();
  const reopened = openPreviewJournal(w.path, w.key);
  const worker = createJournalWorker(reopened, w.ports);
  worker.intake([w.update]); await worker.drain(); expect(w.sent).toHaveLength(1); expect(w.calls()).toBe(1);
  expect(openBlockers(reopened.view)[0]!.note.constraint).toBe('operator-authority'); reopened.close();
});

it('never turns the unchanged recorded review objection into PASS', async () => {
  const w = await replay({ keepRecordedReview: true });
  expect(w.sent).toEqual([HOLDING_REPLY]);
  expect(w.journal.view.order[0]!.revisionReview?.verdict).toBe('violation'); w.journal.close();
});

it('a cannot-do reply with no blocker still stays held', async () => {
  const w = await replay({ noBlocker: true }); expect(w.sent).toEqual([HOLDING_REPLY]);
  expect(openBlockers(w.journal.view)).toHaveLength(0); w.journal.close();
});

it('an invented constraint stays rejected with its reason, even when the controlled reviewer passes', async () => {
  const w = await replay({ constraint: 'invented-privacy-boundary', passRejected: true });
  expect(w.sent).toEqual([HOLDING_REPLY]);
  expect(w.packets[1]!.rejected).toMatchObject({ blocker: true, blockerReason: 'unknown governing constraint' });
  w.journal.close(); const reopened = openPreviewJournal(w.path, w.key);
  expect(reopened.view.order[0]!.revision).toMatchObject({ rejectedBlocker: true, blockerReason: 'unknown governing constraint' });
  expect(openBlockers(reopened.view)).toHaveLength(0); reopened.close();
});

it.each([0, 1])('retains a finite UTF-8 claim bound: limit + %i bytes', async extra => {
  const claim = 'é'.repeat(PREVIEW_REPLY_BOUND_BYTES / 2) + 'x'.repeat(extra);
  const w = await replay({ claim, passRejected: true });
  expect(Boolean(w.journal.view.order[0]!.revision?.blocker)).toBe(extra === 0);
  if (extra) expect(w.journal.view.order[0]!.revision?.blockerReason).toContain('UTF-8 bytes');
  w.journal.close();
});

it('preserves the call cap and stop gate around the repaired admission', async () => {
  const capped = await replay({ maxCalls: 2 });
  expect(capped.journal.view.calls).toBe(2); expect(capped.sent).toEqual([HOLDING_REPLY]); capped.journal.close();
  const stopped = await replay({ stopBeforeSend: true });
  expect(stopped.sent).toHaveLength(0); stopped.journal.close();
});
