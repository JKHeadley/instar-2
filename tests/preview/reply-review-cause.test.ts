import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
import { replyCheckCauses, unavailableChecks } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { checkReply, JEV_MODEL, REPLY_RULES, REVIEW_MALFORMED, reviewReply, reviewResultFailure, type ReplyCheckPorts, type ReplyCheckResult,
  type ReplyRule } from './reply-check.js';

// Rules 2, 9, 39: an unavailable check says why, durably. Content-free: no provider text, no exception message.
const launcher = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const slice = (from: string, to: string) => {
  const start = launcher.indexOf(from), end = launcher.indexOf(to, start);
  if (start < 0 || end < 0) throw Error(`shipped source absent: ${from}`);
  return launcher.slice(start, end);
};
const SECRET = 'sk-ant-TEST-must-not-escape';
type Provider = { state: string; bytes?: string | null; failure?: { failureClass: string; resetHint: null; resetAt: null }; usage?: object };
/** The shipped result handling, from the provider's return to escalate's refusal. */
function shippedEscalate(provider: () => Promise<Provider>) {
  const escalate = slice('escalate: async (text, id, originalPrompt', '// The mind\'s one response').trim().replace(/^escalate: /u, '').replace(/,\s*$/u, '');
  return runInNewContext(`${slice('const invokeSubscription = async', '// Part Thirteen §9')}\n(${escalate});`, {
    doorway: { policyFor: () => ({ timeout: 1000, maxOutputBytes: 1000, maxTokens: 10 }), conversationFraming: 'conversation' },
    required: () => 'model', options: {}, journal: { view: { expires: 9e15 }, append: () => {}, systemWriter: () => null },
    wallNow: () => 1000, performance, callSubscription: provider, judgmentOf: () => 'reply-review',
    replyReviewDiagnostics: () => null, roleOf: () => 'reply-review', replyReviewRules: () => ({}), replyReviewQuestion: () => 'q',
    replyReviewContext: () => 'context', declaredObligations: () => [], credentialRegister: () => [], envelopeWriter: () => null,
    modelEnvelope: () => 'prepared', reviewDefects: new Map(), withFormatReminder: (text: string) => text, REVIEW_FORMAT_REMINDER: 'r',
    REVIEW_MALFORMED, reviewResultFailure, recordedUsage: (usage: object) => usage,
  }) as ReplyCheckPorts['escalate'];
}
const reviewed = async (escalate: ReplyCheckPorts['escalate'], extra: Partial<ReplyCheckPorts> = {}) => {
  const rows: ReplyCheckResult[] = [];
  await reviewReply('reply', 'id', { elapsedMs: () => 0, record: row => rows.push(row), reserveEscalation: () => true,
    jev: async () => { throw Error('unused'); }, escalate, ...extra }, [], 'prompt');
  return rows;
};
const failure = (failureClass: string) => ({ failureClass, resetHint: null, resetAt: null });

describe('the shipped review path records why it read unavailable', () => {
  it.each([
    ['limit', { state: 'rejected', failure: failure('limit') }, 'rate-limited', 'rejected:limit'],
    ['policy', { state: 'rejected', failure: failure('policy') }, 'provider-refused', 'rejected:policy'],
    ['bare rejection', { state: 'rejected' }, 'provider-refused', 'rejected:rejected'],
    ['timeout', { state: 'uncertain', failure: failure('timeout') }, 'timeout', 'uncertain:timeout'],
    ['process exit', { state: 'uncertain', failure: failure('transport') }, 'process-exit', 'uncertain:transport'],
    ['unknown outcome', { state: 'uncertain' }, 'other', 'uncertain:none'],
    ['empty output', { state: 'complete', bytes: '' }, 'malformed-output', 'complete:empty'],
  ] as const)('%s', async (_name, provider, cause, causeDetail) => {
    const rows = await reviewed(shippedEscalate(async () => ({ usage: {}, ...provider })));
    expect(rows).toEqual([expect.objectContaining({ verdict: 'unavailable', path: 'subscription', cause, causeDetail })]);
  });

  it('a pool with no usable login, a thrown budget and a thrown secret each stay bounded', async () => {
    const noAccount = Object.assign(Error('preview: harness login pool has no reviewed login'), { reviewCause: 'no-account' });
    expect((await reviewed(shippedEscalate(async () => { throw noAccount; })))[0]).toMatchObject({ cause: 'no-account' });
    const secret = (await reviewed(shippedEscalate(async () => { throw Error(`upstream said ${SECRET}`); })))[0]!;
    expect(secret).toMatchObject({ cause: 'other', causeDetail: 'error:Error' });
    expect(JSON.stringify(secret)).not.toContain(SECRET);
    const forged = await reviewed(async () => { throw Object.assign(Error('x'), { reviewCause: SECRET, causeDetail: `${SECRET} extra words` }); });
    expect(forged[0]).toMatchObject({ cause: 'other' });
    expect(JSON.stringify(forged)).not.toContain(SECRET);
  });

  it('a second malformed verdict is malformed-output; the first re-ask is unchanged', async () => {
    let calls = 0;
    const rows = await reviewed(async () => { calls++; throw Error(REVIEW_MALFORMED); }, { reserveFormatRetry: () => true });
    expect(calls).toBe(2);
    expect(rows[0]).toMatchObject({ verdict: 'unavailable', cause: 'malformed-output' });
  });
});

it('the holding path says cap or budget, and a real verdict carries no cause', async () => {
  expect((await reviewed(async () => { throw Error('unused'); }, { reserveEscalation: () => false }))[0])
    .toMatchObject({ path: 'holding', verdict: 'unavailable', cause: 'call-cap' });
  expect((await reviewed(async () => { throw Error('unused'); }, { now: () => 2, deadlineAt: 1 }))[0])
    .toMatchObject({ path: 'holding', verdict: 'unavailable', cause: 'timeout', causeDetail: 'budget' });
  const passed = await reviewed(async () => ({ verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 1 }));
  expect(passed[0]).toMatchObject({ verdict: 'pass' });
  expect(passed[0]).not.toHaveProperty('cause');
});

it('a Jev admission refusal is told apart from a provider failure; a timeout carries only its cause', async () => {
  const rows: ReplyCheckResult[] = [];
  let calls = 0;
  await checkReply('reply', 'id', { elapsedMs: () => 0, record: row => rows.push(row), reserveJevRetry: () => true, reserveEscalation: () => false,
    jev: async () => { throw calls++ ? Object.assign(Error('preview: Jev unavailable'), { jevCause: 'timeout' })
      : Object.assign(Error(`preview: ${SECRET}`), { causeDetail: 'admission' }); },
    escalate: async () => { throw Error('unused'); } });
  expect(rows[0]).toMatchObject({ path: 'jev', cause: 'other', causeDetail: 'admission' });
  expect(rows[1]).toMatchObject({ path: 'jev', cause: 'timeout' });
  expect(rows[1]).not.toHaveProperty('causeDetail');
  expect(JSON.stringify(rows)).not.toContain(SECRET);
});

const key = new Uint8Array(32).fill(41);
const now = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 120, maxReplies: 80, maxTurns: 80, maxBytes: 32768, cursor: 0 };
const update = { update_id: 1, message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text: 'Remind me on Friday at 9' } };
const jevDown: ReplyCheckPorts['jev'] = async () => { throw Object.assign(Error('preview: Jev unavailable'), { jevCause: 'http-503' }); };
const jevFlags = (...flagged: ReplyRule[]): ReplyCheckPorts['jev'] => async () => ({ value: { model: JEV_MODEL,
  answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: flagged.includes(id as ReplyRule) ? 0.93 : 0.02 }])) }, latencyMs: 0 });
const refused = async () => { throw reviewResultFailure({ state: 'rejected', providerFailure: 'limit' }); };
const worldPorts = (sent: string[], replyCheck: Partial<NonNullable<PreviewPorts['replyCheck']>>, extra: Partial<PreviewPorts> = {}): PreviewPorts => ({
  now: () => now, stopped: () => false, model: async () => JSON.stringify({ reply: 'I set your reminder for Friday at 9.', memory: [] }),
  prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
  send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {},
  replyCheck: { jev: jevDown, escalate: refused, elapsedMs: () => 0, ...replyCheck }, ...extra });
async function withJournal(run: (path: string) => Promise<void>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-cause-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
}

describe('durable journal', () => {
  it.each(['before-send', 'after-send'] as const)('%s review: causes survive replay, and the reply goes out exactly as before', async timing => {
    await withJournal(async path => {
      const sent: string[] = [];
      const journal = openPreviewJournal(path, key, genesis);
      const worker = createJournalWorker(journal, worldPorts(sent, {}, { replyReviewTiming: timing }));
      worker.intake([update]);
      await worker.drain(); await worker.drain(); await worker.reviewReplies();
      expect(sent).toEqual(['I set your reminder for Friday at 9.']);
      journal.close();
      const reopened = openPreviewJournal(path, key, genesis);
      // Only the before-send path has a reserved Jev retry.
      expect(replyCheckCauses(reopened.view)).toEqual({ 'jev:http-503': timing === 'before-send' ? 2 : 1, 'subscription:rate-limited': 1 });
      expect(unavailableChecks(reopened.view.order[0]!).at(-1)).toMatchObject({ path: 'subscription', cause: 'rate-limited', causeDetail: 'rejected:limit' });
      reopened.close();
    });
  });

  it('a failed review of a revised reply records its cause too', async () => {
    await withJournal(async path => {
      const sent: string[] = []; let reviews = 0;
      const journal = openPreviewJournal(path, key, genesis);
      const worker = createJournalWorker(journal, worldPorts(sent, {
        jev: jevFlags('defers_work'),
        escalate: async () => { if (reviews++) return refused();
          return { verdict: 'violation', ruleIds: ['defers_work'], confidence: null, latencyMs: 1, reason: 'defers' }; },
        revise: async () => ({ state: 'complete', text: 'Your reminder is set for Friday at 9.',
          dispositions: [{ objection: 'defers_work', decision: 'accept', reason: 'Do it now.' }] }),
      } as Partial<NonNullable<PreviewPorts['replyCheck']>>));
      worker.intake([update]);
      await worker.drain(); await worker.drain();
      expect(journal.view.order[0]?.revisionReview).toMatchObject({ verdict: 'unavailable', cause: 'rate-limited' });
      expect(replyCheckCauses(journal.view)).toMatchObject({ 'revision:rate-limited': 1 });
      journal.close();
    });
  });

  // Recorded live rows: 2026-10-11's carry no cause, 2026-10-12's carry Jev's existing one.
  it('recorded rows replay: a row without the field counts as unrecorded, never as a guess', () => {
    const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
    const admission = fixture('jev-admission-2026-10-12.json');
    const samples = admission.cases as { checks: ReplyCheckResult[] }[];
    const live = fixture('jev-unavailable-2026-10-11.json').rows as { jev: ReplyCheckResult[]; otherChecks: ReplyCheckResult[] }[];
    const order = [...samples.map(sample => ({ replyChecks: sample.checks })), ...live.map(row => ({ replyChecks: [...row.jev, ...row.otherChecks] }))];
    const counts = replyCheckCauses({ order } as never);
    expect(counts['jev:other']).toBeGreaterThan(0);
    expect(counts['jev:timeout']).toBeGreaterThan(0);
    expect(counts['jev:unrecorded']).toBeGreaterThan(0);
    expect(Object.keys(counts).every(name => /^[a-z-]+:[a-z0-9-]+$/u.test(name))).toBe(true);
  });
});
