import { expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts, type JournalRecord } from './journal-test-worker.js';
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
const CANDIDATE = 'I set your reminder for Friday at 9.';
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
    expect(sent).toEqual([HOLDING_REPLY]);
    expect(journal.view.order[0]?.heldReview?.objections).toContain('credential');
    expect(journal.view.order[0]?.held).toBeUndefined();
    expect(reviewUnavailableReleases(journal.view).total).toBe(0);
    journal.close();
  });
});

// Build 3 (Rules 77, 95): with no Jev result and no review verdict, the reply is released once with
// the review recorded unavailable and counted even though there were no Jev flags.
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
    expect(reviewUnavailableReleases(journal.view)).toEqual({ total: 1, byRule: {} });
    journal.close();
  });
});

// Build 3 (Rules 4, 77, 86): an ordinary review objection is a signal released with the reply; only a
// review naming a credential, an untracked deferral or an unevidenced cannot-do claim holds.
it('Rule 89 X4: an ordinary review violation speaks as agent; a completed holding review speaks as infrastructure', async () => {
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
    expect(journal.view.speakers).toEqual({ agent: 1, infrastructure: 0 });
    worker.intake([update(2, 'And again on Monday')]); await worker.drain();
    expect(sent).toEqual([CANDIDATE, CANDIDATE]);
    expect(journal.view.order[1]?.release).toBeUndefined();
    expect(reviewUnavailableReleases(journal.view).total).toBe(0);
    journal.close();
  });
  await withJournal(async path => {
    const sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis());
    const before = { ...journal.view.speakers };
    // As live, the violation quotes the claim it objects to. Here that claim is the whole one-sentence answer,
    // so nothing survives the claim-scoped removal and the notice stands in for no surviving content (plan #215).
    const worker = createJournalWorker(journal, ports(sent, jevFlags('defers_work'), async () =>
      ({ verdict: 'violation' as const, ruleIds: ['defers_work'], reason: 'defers without a record', confidence: null, latencyMs: 0,
        findings: [{ rule: 'defers_work' as const, verdict: 'violation' as const,
          reason: `The reply promises "${CANDIDATE.replace(/^PREVIEW — /u, '')}" and declaredObligations.loops is empty.` }] })));
    worker.intake([update(1, 'Remind me on Friday at 9')]); await worker.drain();
    expect(sent).toEqual([HOLDING_REPLY]);
    expect(journal.view.speakers.infrastructure - before.infrastructure).toBe(1);
    expect(journal.view.speakers.agent - before.agent).toBe(0);
    expect(journal.view.order[0]?.replyChecks?.at(-1)).toMatchObject({ path: 'subscription', verdict: 'violation' });
    expect(journal.view.order[0]?.sent).toBe(1);
    expect(journal.view.order[0]?.release).toBeUndefined();
    expect(journal.view.order[0]?.heldReview?.withheld)
      .toEqual({ rules: ['defers_work'], removed: [CANDIDATE.replace(/^PREVIEW — /u, '')], unlocated: [] });
    journal.close();
    // Durable replay keeps the speaker counts and cannot dispatch the holding reply twice.
    const reopened = openPreviewJournal(path, key, genesis());
    await createJournalWorker(reopened, ports(sent, jevFlags(), async () => { throw Error('no second review'); })).drain();
    expect(sent).toEqual([HOLDING_REPLY]);
    expect(reopened.view.speakers).toEqual({ agent: 0, infrastructure: 1 });
    reopened.close();
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

// Exact answer/check/outcome rows from the live proof room, stripped only of unrelated private context.
const live = JSON.parse(readFileSync(new URL('./fixtures/review-unavailable-2026-10-09.json', import.meta.url), 'utf8')) as {
  operatorText: string; turns: { update: number;
    answer: Omit<Extract<JournalRecord, { kind: 'answer' }>, 'kind' | 'id'>;
    reviewOutcome: Extract<JournalRecord, { kind: 'call-outcome' }>['outcome'];
    reviewState: 'uncertain'; reviewDiagnostics: { outputTokens: number; thinkingPresent: 'unobservable' };
    check: Extract<JournalRecord, { kind: 'reply-check' }>['result']; delivered: null }[] };

it.each(live.turns)('live $update: rejected blocker + output-capped UNKNOWN review releases once', async captured => {
  await withJournal(async path => {
    const sent: string[] = []; let reviews = 0, jev = 0, clock = now;
    const journal = openPreviewJournal(path, key, genesis());
    const p = ports(sent, async () => { jev++; return jevFlags()(); }, async (_text, id) => {
      reviews++; clock += captured.check.latencyMs;
      journal.append({ kind: 'call-outcome', id: `${id}:reply-review`, role: 'reply-review', outcome: captured.reviewOutcome, at: now });
      journal.append({ kind: 'reply-review-state', id, state: captured.reviewState, diagnostics: captured.reviewDiagnostics, at: now });
      // The installed port throws this when the recorded result is uncertain (output null).
      throw Error('preview: reply review unavailable');
    });
    p.now = () => clock;
    p.replyCheck!.elapsedMs = () => clock;
    const worker = createJournalWorker(journal, p);
    worker.intake([update(captured.update, live.operatorText)]);
    const id = journal.view.order[0]!.id;
    journal.append({ kind: 'reserve', id, prompt: JSON.stringify({ messages: [
      { role: 'user', content: live.operatorText }, { role: 'context', content: JSON.stringify({ packet: {
        audience: { surface: 'telegram-private-chat', chat: '7654321', operator: '7654321' } } }) }] }), at: now });
    journal.append({ kind: 'answer', id, ...captured.answer });
    await worker.drain(); await worker.drain();
    expect(jev).toBe(0); // The rejected blocker takes the direct full-context review route, as live.
    expect(reviews).toBe(1);
    expect(sent).toEqual([captured.answer.text]);
    expect(journal.view.order[0]).toMatchObject({ answerRejected: { blocker: true }, reviewState: 'uncertain',
      release: { review: 'unavailable' }, sent: 1 });
    expect(journal.view.order[0]?.held).toBeUndefined();
    expect(journal.view.blockers).toEqual([]); // Release does not accept the refused blocker.
    expect(reviewUnavailableReleases(journal.view)).toEqual({ total: 1, byRule: {} });
    journal.close();
    const reopened = openPreviewJournal(path, key);
    await createJournalWorker(reopened, p).drain();
    expect(sent).toHaveLength(1); expect(reviews).toBe(1);
    expect(reviewUnavailableReleases(reopened.view).total).toBe(1);
    reopened.close();
  });
});

it.each(live.turns.flatMap(captured => [false, true].map(noticed => ({ ...captured, noticed }))))(
  'live $update: old unavailable hold recovery, prior notice=$noticed', async captured => {
  await withJournal(async path => {
    const journal = openPreviewJournal(path, key, genesis()), sent: string[] = [];
    const p = ports(sent, async () => { throw Error('must not repeat Jev'); }, async () => { throw Error('must not repeat review'); });
    const worker = createJournalWorker(journal, p);
    worker.intake([update(captured.update, live.operatorText)]);
    const id = journal.view.order[0]!.id;
    journal.append({ kind: 'reserve', id, at: now });
    journal.append({ kind: 'answer', id, ...captured.answer });
    journal.append({ kind: 'reply-review-reserve', id, candidate: captured.answer.text, at: now });
    journal.append({ kind: 'reply-review-state', id, state: captured.reviewState, diagnostics: captured.reviewDiagnostics, at: now });
    journal.append({ kind: 'reply-check', id, result: captured.check, at: now });
    journal.append({ kind: 'hold', id, reason: 'reply check unavailable', at: now });
    if (captured.noticed) {
      journal.append({ kind: 'held-notice-intent', id, text: "I'm holding my answer to your message from 12:00; it will follow or I'll tell you why",
        chat: '7654321', update: captured.update, grant: 'grant:preview', at: journal.view.order[0]!.heldSince! + 600_001 });
      journal.append({ kind: 'held-notice-sent', id, message: 7, at: journal.view.order[0]!.heldSince! + 600_002 });
    }
    const calls = journal.view.calls;
    journal.close();
    const reopened = openPreviewJournal(path, key);
    await createJournalWorker(reopened, p).drain(); await createJournalWorker(reopened, p).drain();
    expect(reopened.view.calls).toBe(calls);
    expect(sent).toEqual(captured.noticed ? [] : [captured.answer.text]);
    expect(reopened.view.order[0]?.held).toBe(captured.noticed ? 'reply check unavailable' : undefined);
    expect(reviewUnavailableReleases(reopened.view)).toEqual({ total: captured.noticed ? 0 : 1, byRule: {} });
    reopened.close();
  });
});
