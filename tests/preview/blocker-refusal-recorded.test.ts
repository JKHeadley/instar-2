import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createJournalWorker, openPreviewJournal, openBlockers, BLOCKER_RECHECK_MAX_MS } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { HOLDING_REPLY, REPLY_CHECK_BUDGET_MS, parseReplyReviewVerdict, REPLY_RULES, DECLARED_OBLIGATIONS_GUIDE } from './reply-check.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/blocker-refusal-recorded-46039927.json', import.meta.url), 'utf8'));
const writer = JSON.parse(capture.writer);
const readReview = readAnswer(capture.review, { wrapped: 'refuse', evidence: [capture.sent.id + ':reply-review'], object: true });
if (!readReview.ok) throw Error(readReview.defect);
const recordedReview = parseReplyReviewVerdict(readReview.value);
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function world(options: { evidence?: string; constraint?: string; revise?: boolean; invalidRevision?: boolean; revisionText?: string; withdrawBlocker?: boolean; maxCalls?: number;
  recheck?: string; reviewUnavailable?: boolean; reviewDelay?: number; credentialViolation?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'blocker-replay-')); roots.push(root);
  const key = new Uint8Array(32).fill(23), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: capture.at + BLOCKER_RECHECK_MAX_MS,
    maxCalls: options.maxCalls ?? 20, maxReplies: 20, maxTurns: 20, maxBytes: 48000, cursor: 0 });
  const answer = structuredClone(writer);
  if (options.constraint) answer.blocker.constraint = options.constraint;
  if (options.recheck) answer.blocker.recheck = options.recheck;
  if (options.evidence) for (const avenue of answer.blocker.avenues) avenue.evidence = options.evidence;
  let revisions = 0, answers = 0, now = capture.at;
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, timeZone: 'UTC', stopped: () => false,
    prepareModel: input => JSON.stringify({ messages: [{ role: 'user', content: input.question },
      { role: 'context', content: JSON.stringify({ packet: JSON.parse(input.context) }) }] }),
    model: async () => { answers++; return JSON.stringify(answers === 1 ? answer : { reply: writer.reply }); },
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES)
        .map(rule => [rule, { type: 'noul', noul: rule === 'unrecorded_blocker' ? 0.98 : 0.01 }])) }, latencyMs: 0 }),
      escalate: async () => {
        now += options.reviewDelay ?? 0;
        if (options.reviewUnavailable) throw Error('recorded unavailable-review neighbour');
        return options.credentialViolation
          ? { verdict: 'violation' as const, ruleIds: ['credential' as const], confidence: null, latencyMs: 0 }
          : { ...recordedReview, confidence: null, latencyMs: 0 };
      },
      ...(options.revise ? { revise: async () => { revisions++;
        return { state: 'complete' as const, text: options.revisionText ?? writer.reply,
          dispositions: [{ objection: 'unrecorded_blocker', decision: 'accept' as const, reason: 'Record the limit.' }],
          ...(options.withdrawBlocker ? {} : { blocker: { ...answer.blocker,
            constraint: options.invalidRevision ? 'reply-only-grant' : 'no-tools' } }) }; } } : {}) },
    checkOutbound: () => {}, send: async input => { sent.push(input.text); return sent.length; } });
  const say = async (update = 1) => { worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'Renew my library card on the city library website.', date: Math.floor(capture.at / 1000) } }]); await worker.drain(); };
  return { journal, worker, say, sent, revisions: () => revisions, path, key };
}

it('replays D4 writer and passing review: records the unique supported constraint before sending once', async () => {
  const w = world();
  await w.say();
  expect(w.sent).toHaveLength(1);
  expect(w.sent[0]).toContain(writer.reply);
  expect(openBlockers(w.journal.view)).toHaveLength(1);
  const note = openBlockers(w.journal.view)[0]!.note;
  expect(note.constraint).toBe('no-tools');
  expect(note.avenues).toEqual(writer.blocker.avenues);
  expect(note.recheckAt).toBeGreaterThan(capture.at);
  expect(note.recheckAt).toBeLessThanOrEqual(capture.at + BLOCKER_RECHECK_MAX_MS);
  await w.say(); await w.worker.drain();
  expect(w.sent).toHaveLength(1);
  w.journal.close();
  const reopened = openPreviewJournal(w.path, w.key);
  expect(openBlockers(reopened.view)).toHaveLength(1); reopened.close();
});

it.each([false, true])('ambiguous accounts evidence uses one revision and an admitted record (changed text %s)', async changed => {
  const w = world({ evidence: 'accounts', revise: true,
    ...(changed ? { revisionText: `${writer.reply} Please use the library website directly.` } : {}) });
  await w.say();
  expect(w.revisions()).toBe(1);
  expect(openBlockers(w.journal.view)).toHaveLength(1);
  expect(w.sent[0]).toContain(writer.reply);
  expect(w.journal.view.calls).toBeLessThanOrEqual(4);
  await w.worker.drain(); expect(w.revisions()).toBe(1); expect(w.sent).toHaveLength(1);
  w.journal.close();
});

it('a changed refusal with a rejected revision record stays held despite the recorded PASS', async () => {
  const text = `${writer.reply} Please use the library website directly.`;
  const w = world({ evidence: 'accounts', revise: true, invalidRevision: true, revisionText: text });
  await w.say();
  expect(w.revisions()).toBe(1);
  expect(openBlockers(w.journal.view)).toHaveLength(0);
  expect(w.journal.view.order[0]!.revisionReview?.verdict).toBe('pass');
  expect(w.sent).toEqual([HOLDING_REPLY]);
  expect(w.journal.view.order[0]!.revision).toMatchObject({ text, rejectedBlocker: true });
  expect(w.journal.view.calls).toBeLessThanOrEqual(4);
  await w.worker.drain(); expect(w.sent).toHaveLength(1); expect(w.revisions()).toBe(1);
  w.journal.close();
  const reopened = openPreviewJournal(w.path, w.key);
  expect(reopened.view.order[0]!.revision).toMatchObject({ text, rejectedBlocker: true });
  expect(openBlockers(reopened.view)).toHaveLength(0); reopened.close();
});

it('a revision withdrawing the refusal can still be released by contextual review', async () => {
  const text = 'Which city library is this for?';
  const w = world({ evidence: 'accounts', revise: true, withdrawBlocker: true, revisionText: text });
  await w.say();
  expect(w.revisions()).toBe(1);
  expect(openBlockers(w.journal.view)).toHaveLength(0);
  expect(w.journal.view.order[0]!.revisionReview?.verdict).toBe('pass');
  expect(w.sent).toEqual([text]);
  expect(w.journal.view.order[0]!.revision?.blocker).toBeUndefined();
  w.journal.close();
});

it.each([false, true])('unresolved ambiguous declaration holds despite the recorded PASS (revision %s)', async revise => {
  const w = world({ evidence: 'accounts', revise, invalidRevision: true });
  await w.say();
  expect(openBlockers(w.journal.view)).toHaveLength(0);
  expect(w.sent).toEqual([HOLDING_REPLY]);
  expect(w.revisions()).toBe(revise ? 1 : 0);
  w.journal.close();
});

it('call cap holds the unresolved declaration without spending a revision', async () => {
  const w = world({ evidence: 'accounts', revise: true, maxCalls: 2 });
  await w.say();
  expect(w.revisions()).toBe(0); expect(w.journal.view.calls).toBe(2);
  expect(w.sent).toEqual([HOLDING_REPLY]); w.journal.close();
});

it.each([
  { constraint: 'unknown-boundary' },
  { evidence: 'unsupported-evidence' },
  { recheck: '2027-10-12' },
  { recheck: '2026-10-11' },
])('never repairs another invalid field or an invented constraint: %j', async options => {
  const w = world(options); await w.say();
  expect(openBlockers(w.journal.view)).toHaveLength(0);
  expect(w.sent).toEqual([HOLDING_REPLY]); w.journal.close();
});

it('a slow review consumes the existing deadline; no correction runs outside it', async () => {
  const w = world({ evidence: 'accounts', revise: true, reviewDelay: REPLY_CHECK_BUDGET_MS + 1 });
  await w.say(); expect(w.revisions()).toBe(0);
  expect(w.sent).toEqual([HOLDING_REPLY]); w.journal.close();
});

it('an unavailable review cannot erase a refused declaration with no current record', async () => {
  const w = world({ evidence: 'accounts', reviewUnavailable: true });
  await w.say(); expect(w.sent).toEqual([HOLDING_REPLY]);
  expect(openBlockers(w.journal.view)).toHaveLength(0); w.journal.close();
});

it('the missing record never replaces a credential violation', async () => {
  const w = world({ evidence: 'accounts', credentialViolation: true });
  await w.say(); expect(w.sent).toEqual([HOLDING_REPLY]);
  expect(w.journal.view.order[0]!.heldReview?.objections).toContain('credential'); w.journal.close();
});

it('an already open blocker permits a restatement without another record or duplicate send', async () => {
  const w = world({ constraint: 'no-tools' });
  await w.say(); await w.say(2);
  expect(openBlockers(w.journal.view)).toHaveLength(1);
  expect(w.sent).toHaveLength(2); expect(w.sent[1]).toContain(writer.reply);
  await w.worker.drain(); expect(w.sent).toHaveLength(2); w.journal.close();
});

it('the review instruction distinguishes capability descriptions from refusals of asked work', () => {
  expect(DECLARED_OBLIGATIONS_GUIDE).toContain('A capability note alone never records a refusal');
});
