import { expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
import { reviewUnavailableReleases } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { HOLDING_REPLY, JEV_MODEL, REPLY_RULES, type ReplyCheckPorts, type ReplyRule } from './reply-check.js';

// Rules 4, 86: Jev may hold a reply alone only for a secret. When the full-context review gives
// no verdict, Jev's non-secret flags are a recorded signal and the reply is sent exactly once.
const key = new Uint8Array(32).fill(73);
const now = 1790000000000;
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text } });
const genesis = (maxCalls = 120) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls, maxReplies: 80, maxTurns: 80, maxBytes: 32768, cursor: 0 });
const answer = (reply: string) => JSON.stringify({ reply, memory: [] });
const CANDIDATE = 'PREVIEW — I set your reminder for Friday at 9.';
const jevFlags = (...flagged: ReplyRule[]) => async () => ({ value: { model: JEV_MODEL,
  answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id,
    { type: 'noul', noul: flagged.includes(id as ReplyRule) ? 0.93 : 0.02 }])) }, latencyMs: 0 });
type Escalate = ReplyCheckPorts['escalate'];
const malformed: Escalate = async () => { throw Error('preview: review malformed'); };

async function withJournal(run: (path: string, root: string) => Promise<void>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-unavailable-')));
  try { await run(join(root, 'journal.encrypted'), root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
const ports = (sent: string[], jev: ReplyCheckPorts['jev'], escalate: Escalate): PreviewPorts => ({
  now: () => now, stopped: () => false, model: async () => answer('I set your reminder for Friday at 9.'),
  prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
  send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {},
  replyCheck: { jev, escalate, elapsedMs: () => 0 } });

it('non-secret Jev flags + malformed review: the reply is sent once and the signal is counted by rule', async () => {
  await withJournal(async path => {
    const sent: string[] = []; let reviews = 0;
    const journal = openPreviewJournal(path, key, genesis());
    const worker = createJournalWorker(journal, ports(sent, jevFlags('claims_blocked', 'parks_on_user'),
      async (...args) => { reviews++; return malformed(...args); }));
    worker.intake([update(1, 'Remind me on Friday at 9')]);
    await worker.drain(); await worker.drain();
    expect(sent).toEqual([CANDIDATE]);
    expect(reviews).toBe(2); // the malformed verdict and its one format re-ask (Rule 116)
    const turn = journal.view.order[0]!;
    expect(turn.held).toBeUndefined();
    expect(turn.replyChecks?.map(check => [check.path, check.verdict])).toEqual([['jev', 'violation'], ['subscription', 'unavailable']]);
    expect(reviewUnavailableReleases(journal.view)).toEqual({ total: 1, byRule: { claims_blocked: 1, parks_on_user: 1 } });
    journal.close();
    // Replay: the release is a pure function of durable rows, so the counter survives and nothing repeats.
    const reopened = openPreviewJournal(path, key, genesis());
    await createJournalWorker(reopened, ports(sent, jevFlags(), async () => { throw Error('no second review'); })).drain();
    expect(sent).toHaveLength(1);
    expect(reviewUnavailableReleases(reopened.view)).toEqual({ total: 1, byRule: { claims_blocked: 1, parks_on_user: 1 } });
    reopened.close();
  });
});

it('credential among the Jev flags + malformed review: the reply stays held (secrets exception)', async () => {
  await withJournal(async path => {
    const sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis());
    const worker = createJournalWorker(journal, ports(sent, jevFlags('credential', 'claims_blocked'), malformed));
    worker.intake([update(1, 'Remind me on Friday at 9')]);
    await worker.drain(); await worker.drain();
    expect(sent).toEqual([]);
    expect(journal.view.order[0]?.held).toBe('reply check unavailable');
    expect(reviewUnavailableReleases(journal.view).total).toBe(0);
    journal.close();
  });
});

// Build 3 (Rules 77, 95): with no Jev result and no review verdict, the reply is released once with
// the review recorded unavailable; it is not counted as a release on Jev's flags, because there were none.
it('Jev itself unavailable + malformed review: no check decided, so the reply is released once, recorded unavailable', async () => {
  await withJournal(async path => {
    const sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis());
    const worker = createJournalWorker(journal, ports(sent, async () => { throw Error('Jev down'); }, malformed));
    worker.intake([update(1, 'Remind me on Friday at 9')]);
    await worker.drain(); await worker.drain();
    expect(sent).toEqual([CANDIDATE]);
    expect(journal.view.order[0]?.held).toBeUndefined();
    expect(journal.view.order[0]?.release).toMatchObject({ review: 'unavailable', revised: false });
    expect(reviewUnavailableReleases(journal.view).total).toBe(0);
    journal.close();
  });
});

// Build 3 (Rules 4, 77, 86): an ordinary review objection is a signal released with the reply; only a
// review naming a credential, an untracked deferral or an unevidenced cannot-do claim holds.
it('an ordinary review violation is released with its objection; a review naming a holding rule sends the holding reply', async () => {
  await withJournal(async path => {
    const sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis());
    const worker = createJournalWorker(journal, ports(sent, jevFlags('claims_blocked'), async (candidate: string) =>
      candidate.includes('Friday') && sent.length === 0
        ? { verdict: 'violation' as const, ruleIds: ['claims_blocked'], reason: 'claims a block untried', confidence: null, latencyMs: 0 }
        : { verdict: 'pass' as const, ruleIds: [], reason: 'fine in context', confidence: null, latencyMs: 0 }));
    worker.intake([update(1, 'Remind me on Friday at 9')]); await worker.drain();
    expect(sent).toEqual([CANDIDATE]);
    expect(journal.view.order[0]?.release).toMatchObject({ review: 'violation', objections: ['claims_blocked'], revised: false });
    worker.intake([update(2, 'And again on Monday')]); await worker.drain();
    expect(sent).toEqual([CANDIDATE, CANDIDATE]);
    expect(journal.view.order[1]?.release).toBeUndefined();
    expect(reviewUnavailableReleases(journal.view).total).toBe(0);
    journal.close();
  });
  await withJournal(async path => {
    const sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis());
    // As live, the violation quotes the claim it objects to. Here that claim is the whole one-sentence answer,
    // so nothing survives the claim-scoped removal and the notice stands in for no surviving content (plan #215).
    const worker = createJournalWorker(journal, ports(sent, jevFlags('defers_work'), async () =>
      ({ verdict: 'violation' as const, ruleIds: ['defers_work'], reason: 'defers without a record', confidence: null, latencyMs: 0,
        findings: [{ rule: 'defers_work' as const, verdict: 'violation' as const,
          reason: `The reply promises "${CANDIDATE.replace(/^PREVIEW — /u, '')}" and declaredObligations.loops is empty.` }] })));
    worker.intake([update(1, 'Remind me on Friday at 9')]); await worker.drain();
    expect(sent).toEqual([HOLDING_REPLY]);
    expect(journal.view.order[0]?.release).toBeUndefined();
    expect(journal.view.order[0]?.heldReview?.withheld)
      .toEqual({ rules: ['defers_work'], removed: [CANDIDATE.replace(/^PREVIEW — /u, '')], unlocated: [] });
    journal.close();
  });
});

// The spend floor: with no slot left for a full-context review, no answer or review call is made and
// the turn holds as `call cap` for `raise-caps`. Build 3's minimal reserve still answers the operator
// once, without a model call, that the allowance is used up (Rules 15, 77).
it('at the call cap nothing is spent: the turn holds as call cap and only the limited answer is sent', async () => {
  await withJournal(async path => {
    const sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis(1));
    const worker = createJournalWorker(journal, ports(sent, jevFlags('parks_on_user'), malformed));
    worker.intake([update(1, 'Remind me on Friday at 9')]); await worker.drain();
    expect(journal.view.calls).toBe(0);
    expect(journal.view.order[0]?.held).toBe('call cap');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('allowance of 1 model calls is used up');
    expect(reviewUnavailableReleases(journal.view).total).toBe(0);
    journal.close();
  });
});

it('an interrupted (UNKNOWN) review is never repeated; after restart the non-secret reply is sent exactly once', async () => {
  await withJournal(async (path, root) => {
    const copy = join(root, 'crashed.encrypted'), sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis());
    // Snapshot the journal while the paid review is in flight: a crash leaves only its reservation.
    const first = createJournalWorker(journal, ports([], jevFlags('claims_blocked'), async (...args) => {
      copyFileSync(path, copy); return malformed(...args); }));
    first.intake([update(1, 'Remind me on Friday at 9')]); await first.drain();
    journal.close();
    const restarted = openPreviewJournal(copy, key, genesis());
    expect(restarted.view.order[0]).toMatchObject({ reviewReserved: true });
    let reviews = 0;
    const worker = createJournalWorker(restarted, ports(sent, jevFlags(), async () => { reviews++; throw Error('repeat'); }));
    await worker.drain(); await worker.drain();
    expect(reviews).toBe(0);
    expect(sent).toEqual([CANDIDATE]);
    expect(restarted.view.order[0]?.replyChecks?.at(-1)).toMatchObject({ path: 'subscription', verdict: 'unavailable' });
    restarted.close();
  });
});
