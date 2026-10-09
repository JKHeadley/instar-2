import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
import { operatorRequestsReport, raiseJournalCaps } from './journal.js';
import { OPERATOR_REQUEST_MAX_MS, OPERATOR_REQUEST_MS, operatorLapseDetail, operatorRequestText, operatorReviewBodyText,
  proposeOperatorRequest, wellFormedRequest, type ProposalState } from './operator-yes.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY } from '../../src/assembly/production-provider.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';

// Plan row #373 (observer #143; Purpose lines 85 and 101 require only an "unexpired" request). Live on the operator's
// preview the requests lapsed one hour after issue: raise 2a9e7a52e98077e6 (opened 01:33, lapsed 02:33) and renewal
// 2582df96e288e6cd (opened 04:02, lapsing 05:02), both at night, unseen. A request now stays answerable for 18 hours by
// default (configurable on the root), never past the trial's current end, and its lapse is stated in UTC and, where the
// root knows the operator's time zone, in local time. Replays the recorded request turns of 2026-10-03 (updates
// 969390038 and 969390039, their journaled answers and proposals) on a root shaped like the live one (P-05 review route,
// 2,500 calls after host raises, trial ending 2026-10-05 20:40 UTC, the reviewed 2026-10-12 activation installed).
const HOUR = 3_600_000, ZONE = 'America/Los_Angeles';
type Recorded = { update: number; now: number; message: string; answer: string; operatorAction: unknown };
const fixture = JSON.parse(readFileSync('tests/preview/fixtures/yes-batch-live-2026-10-03.json', 'utf8')) as { recorded: Recorded[] };
const recorded = (update: number) => fixture.recorded.find(item => item.update === update)!;
const journaled = (update: number) => JSON.stringify({ reply: recorded(update).answer, memory: [], operatorAction: recorded(update).operatorAction });
const RAISE = 969390038, RENEW = 969390039;
const key = new Uint8Array(32).fill(53);
const OPERATOR = 7812716706, REPO = 'JKHeadley/instar-2', TRIAL = 'grant:preview', RENEWAL = `sha256:${'6'.repeat(64)}`;
const reviewInstall: ExplicitYesInstallation = { adapter: 'github-api', machine: 'studio', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:chat:7812716706:message:121804'], acceptedAt: 500, withdrawn: null } } };
const chatInstall: ExplicitYesInstallation = { ...reviewInstall, agentSpeaksAsOperatorInChat: false, github: null,
  chat: { ...reviewInstall.chat, agentHoldsNoAccess: true } };

function liveRoot(path: string, options: { install?: ExplicitYesInstallation; timeZone?: string; windowMs?: number } = {}) {
  const install = options.install ?? reviewInstall;
  const journal = openPreviewJournal(path, key, { kind: 'genesis' as const, bot: '8820318295', chat: String(OPERATOR), operator: String(OPERATOR),
    grant: TRIAL, configurationDigest: 'sha256:offline', expires: SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY, maxCalls: 16, maxReplies: 16,
    maxTurns: 20, maxBytes: 409600, cursor: 0 });
  raiseJournalCaps(journal, { maxCalls: 2500, maxReplies: 2500, maxTurns: 2500, authority: 'operator-host:test', at: recorded(RAISE).now - HOUR });
  let clock = recorded(RAISE).now, pull = 145, message = 1029;
  const opened: { number: number; body: string; content: string; head: string }[] = [], closed: number[] = [];
  const reviews = new Map<number, GitHubReview[]>(), sent: { text: string; id: number }[] = [], answers = new Map<number, () => string>();
  const client: GitHubReviewClient = {
    async openRequest(input) { pull += 1; const head = String(pull % 10).repeat(40);
      opened.push({ number: pull, body: input.body, content: input.content, head }); return { number: pull, head }; },
    async pullRequest(_repository, number) { const item = opened.find(entry => entry.number === number)!; return { body: item.body, head: item.head }; },
    async reviews(_repository, number) { return [...reviews.get(number) ?? []]; },
    async closeRequest(_repository, number) { closed.push(number); } };
  const review = createReviewYesSource({ client, installation: () => install, repository: REPO, context: previewTestContext,
    now: () => clock, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
  const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false, checkOutbound: () => {},
    ...(options.timeZone === undefined ? {} : { timeZone: options.timeZone }),
    explicitYes: { context: previewTestContext, installation: () => install, review,
      ...(options.windowMs === undefined ? {} : { requestWindowMs: options.windowMs }),
      renewalActivation: (expires: number) => expires === SUBSCRIPTION_PREVIEW_EXPIRY ? RENEWAL : null },
    model: async input => { if (!input.id.startsWith('telegram:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      const update = Number(/update:(\d+)$/u.exec(input.id)?.[1]);
      return (answers.get(update) ?? (() => JSON.stringify({ reply: 'ordinary answer', memory: [] })))(); },
    send: async input => { message += 1; sent.push({ text: input.expectedText, id: message }); return message; } });
  return { journal, opened, closed, sent,
    async ask(update: number, at: number, text: string, answer?: () => string, replyTo?: number) {
      clock = at; if (answer) answers.set(update, answer); message += 1;
      worker.intake([{ update_id: update, message: { message_id: message, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR },
        text, date: Math.floor(at / 1000), ...(replyTo === undefined ? {} : { reply_to_message: { message_id: replyTo } }) } }]);
      await worker.drain();
    },
    approve(number: number, id: string, at: number) {
      const item = opened.find(entry => entry.number === number)!;
      reviews.set(number, [...reviews.get(number) ?? [], { id, state: 'APPROVED', commitId: item.head, login: 'JKHeadley', submittedAt: new Date(at).toISOString() }]);
    },
    async pollAt(at: number) { clock = at; await worker.minimal(); },
    request: (action: string) => journal.view.operatorRequests.filter(item => item.request.action === action).at(-1)! };
}
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-yes-window-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const state = (over: Partial<ProposalState> = {}): ProposalState => ({ limits: { maxCalls: 2500, maxReplies: 2500, maxTurns: 2500 },
  used: { maxCalls: 10, maxReplies: 5, maxTurns: 5 }, step: { maxCalls: 2500, maxReplies: 2500, maxTurns: 2500 },
  expires: SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY, governedExpiry: SUBSCRIPTION_PREVIEW_EXPIRY, renewalActivation: RENEWAL,
  unknownCalls: 0, stopped: false, grant: TRIAL, base: 'base:test', ...over });

it('defaults to an 18-hour window, takes a configured one, and never outlives the trial\'s current end', () => {
  expect(OPERATOR_REQUEST_MS).toBe(18 * HOUR);
  const now = recorded(RENEW).now;
  for (const proposal of [{ action: 'raise-caps' as const }, { action: 'renew-expiry' as const }]) {
    const made = proposeOperatorRequest(state(), proposal, 'turn-1', now);
    expect(made.kind === 'request' && made.request.expiresAt).toBe(now + 18 * HOUR);
    const six = proposeOperatorRequest(state(), proposal, 'turn-1', now, 6 * HOUR);
    expect(six.kind === 'request' && six.request.expiresAt).toBe(now + 6 * HOUR);
    // Three hours before the governing deadline (the current end, for a raise and for a renewal alike), it lapses there.
    const near = SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY - 3 * HOUR;
    const clamped = proposeOperatorRequest(state(), proposal, 'turn-1', near);
    expect(clamped.kind === 'request' && clamped.request.expiresAt).toBe(SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY);
    for (const bad of [0, -1, 1.5, OPERATOR_REQUEST_MAX_MS + 1])
      expect(() => proposeOperatorRequest(state(), proposal, 'turn-1', now, bad)).toThrow('window out of bounds');
    if (made.kind !== 'request') continue;
    // Replay admits the recorded one-hour shape and the new windows up to the maximum, never beyond it.
    expect(wellFormedRequest(made.request, 'turn-1', TRIAL)).toBe(true);
    const legacy = proposeOperatorRequest(state(), proposal, 'turn-1', now, HOUR);
    expect(legacy.kind === 'request' && wellFormedRequest(legacy.request, 'turn-1', TRIAL)).toBe(true);
    const longest = proposeOperatorRequest(state({ expires: now + 100 * HOUR }), proposal, 'turn-1', now, OPERATOR_REQUEST_MAX_MS);
    expect(longest.kind === 'request' && wellFormedRequest(longest.request, 'turn-1', TRIAL)).toBe(true);
    expect(wellFormedRequest({ ...made.request, expiresAt: now + OPERATOR_REQUEST_MAX_MS + 1 }, 'turn-1', TRIAL)).toBe(false);
  }
});

it('states the lapse in UTC, in the operator\'s local time where known, and names the trial end when it cut the window', () => {
  const now = recorded(RENEW).now, current = { limits: state().limits, expires: state().expires };
  const made = proposeOperatorRequest(state(), { action: 'renew-expiry' }, 'turn-1', now);
  if (made.kind !== 'request') throw Error('no request');
  // 04:01 PDT + 18 h: 22:01 PDT the same evening, 05:01 UTC the next day.
  const utcOnly = operatorRequestText(made.request, current);
  expect(utcOnly.endsWith('This request lapses at 2026-10-04 05:01 UTC.')).toBe(true);
  const local = operatorRequestText(made.request, current, ZONE);
  expect(local.endsWith('This request lapses at 2026-10-04 05:01 UTC. That is Sat, Oct 3, 22:01 PDT your time (America/Los_Angeles).')).toBe(true);
  expect(operatorRequestText(made.request, current, 'UTC')).toBe(utcOnly);
  // The replayed form (no detail) is a prefix of every issued form, so earlier recorded requests replay unchanged.
  expect(local.startsWith(operatorRequestText(made.request, current, null))).toBe(true);
  expect(operatorReviewBodyText(made.request, current, ZONE)).toContain('05:01 UTC. That is Sat, Oct 3, 22:01 PDT your time');
  const clamped = proposeOperatorRequest(state(), { action: 'raise-caps' }, 'turn-1', SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY - 3 * HOUR);
  if (clamped.kind !== 'request') throw Error('no request');
  expect(operatorLapseDetail(clamped.request, current, ZONE))
    .toBe(' That is Mon, Oct 12, 13:40 PDT your time (America/Los_Angeles), and the trial\'s current end, which a request cannot outlast.');
  expect(operatorLapseDetail(clamped.request, current)).toBe(' That is the trial\'s current end, which a request cannot outlast.');
  expect(operatorLapseDetail(made.request, current)).toBe('');
});

it('replays the recorded raise and renewal: both open 18 hours, and both approvals after the old one-hour mark apply', async () => {
  await withRoot(async path => {
    const root = liveRoot(path, { timeZone: ZONE });
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    expect(raise.request.expiresAt).toBe(recorded(RAISE).now + 18 * HOUR);
    expect(renew.request.expiresAt).toBe(recorded(RENEW).now + 18 * HOUR);
    // The reply and both pull request bodies carry the lapse in UTC and Pacific time.
    expect(root.sent.some(item => item.text.includes(`Request ${renew.request.id}:`)
      && item.text.includes('This request lapses at 2026-10-04 05:01 UTC. That is Sat, Oct 3, 22:01 PDT your time (America/Los_Angeles).'))).toBe(true);
    expect(root.opened.map(item => item.body.includes('UTC. That is Sat, Oct 3, 22:0'))).toEqual([true, true]);
    // An hour and five minutes after issue: under the old window both would have lapsed; now both apply.
    const late = recorded(RENEW).now + HOUR + 5 * 60_000;
    root.approve(146, '7101', late); root.approve(147, '7102', late);
    await root.pollAt(late + 60_000);
    expect(root.journal.view.limits.maxCalls).toBe(5000);
    expect(root.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    expect([raise.applied, renew.applied]).toEqual([true, true]);
    root.journal.close();
  });
});

it('refuses an approval that arrives after the new lapse, and closes the lapsed pull requests', async () => {
  await withRoot(async path => {
    const root = liveRoot(path, { timeZone: ZONE });
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    const after = renew.request.expiresAt + 60_000;
    root.approve(146, '7201', after); root.approve(147, '7202', after);
    await root.pollAt(after + 60_000);
    expect(root.journal.view.limits.maxCalls).toBe(2500);
    expect(root.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY);
    expect([raise.approved, renew.approved]).toEqual([undefined, undefined]);
    expect(operatorRequestsReport(root.journal.view, after + 60_000).map(item => item.state)).toEqual(['lapsed', 'lapsed']);
    expect(root.closed.sort()).toEqual([146, 147]);
    root.journal.close();
  });
});

it('cuts the window at the trial\'s current end when that is nearer, says so, and still applies an approval before it', async () => {
  await withRoot(async path => {
    const root = liveRoot(path, { timeZone: ZONE });
    const near = SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY - 3 * HOUR;
    await root.ask(RAISE, near, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, near + 60_000, recorded(RENEW).message, () => journaled(RENEW));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    expect([raise.request.expiresAt, renew.request.expiresAt]).toEqual([SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY]);
    const stated = 'This request lapses at 2026-10-12 20:40 UTC. That is Mon, Oct 12, 13:40 PDT your time (America/Los_Angeles), and the trial\'s current end, which a request cannot outlast.';
    for (const id of [raise.request.id, renew.request.id])
      expect(root.sent.some(item => item.text.includes(`Request ${id}:`) && item.text.includes(stated))).toBe(true);
    expect(root.opened.map(item => item.body.includes(`${stated}\n\nMerging is not needed.`) && item.content.includes(stated))).toEqual([true, true]);
    root.approve(146, '7301', near + 2 * HOUR); root.approve(147, '7302', near + 2 * HOUR);
    await root.pollAt(near + 2 * HOUR + 60_000);
    expect([raise.applied, renew.applied]).toEqual([true, true]);
    expect(root.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    root.journal.close();
  });
});

it('keeps UTC alone where the root has no time zone, and honours a window configured on the root', async () => {
  await withRoot(async path => {
    const root = liveRoot(path, { windowMs: 6 * HOUR });
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const renew = root.request('renew-expiry');
    expect(renew.request.expiresAt).toBe(recorded(RENEW).now + 6 * HOUR);
    expect(root.sent.some(item => item.text.includes('This request lapses at 2026-10-03 17:01 UTC.') && !item.text.includes('your time'))).toBe(true);
    expect(root.opened[0]!.body).toContain('This request lapses at 2026-10-03 17:01 UTC.\n\nMerging is not needed.');
    root.journal.close();
  });
});

it('on the chat route, a yes two hours after the request applies and a yes after the lapse does not (both replayed)', async () => {
  for (const [delay, applies] of [[2 * HOUR, true], [18 * HOUR + 60_000, false]] as const) {
    await withRoot(async path => {
      const root = liveRoot(path, { install: chatInstall, timeZone: ZONE });
      await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
      const raise = root.request('raise-caps');
      expect(raise.via === undefined || raise.review === undefined).toBe(true);
      expect(root.sent.at(-1)!.text).toContain('To approve, reply "yes" as your next message here');
      await root.ask(RAISE + 10, recorded(RAISE).now + delay, 'yes', undefined, raise.message);
      expect(root.journal.view.limits.maxCalls).toBe(applies ? 5000 : 2500);
      if (!applies) expect(raise.refusals.at(-1)?.detail).toBe('this request has lapsed');
      root.journal.close();
    });
  }
});

// The live copy (optional; never the live root): INSTAR_YESWINDOW_ROOT is a directory holding a COPY of
// lanes/preview-trial-root/runner-2026-09-26/journal.encrypted; INSTAR_SECRET_PREVIEW_STORAGE_KEY is bound from the vault.
const COPY = process.env.INSTAR_YESWINDOW_ROOT, STORAGE = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
it.skipIf(COPY === undefined || STORAGE === undefined)('the live journal\'s one-hour requests, with UTC-only text, replay unchanged', () => {
  const bytes = Buffer.from(STORAGE!, /^[a-f0-9]{64}$/iu.test(STORAGE!) ? 'hex' : 'base64');
  const journal = openPreviewJournal(join(COPY!, 'journal.encrypted'), new Uint8Array(bytes), undefined, undefined, true);
  try {
    const lifetimes = new Map(journal.view.operatorRequests.map(item => [item.request.id, item.request.expiresAt - item.request.issuedAt]));
    expect(lifetimes.get('2a9e7a52e98077e6')).toBe(HOUR);
    expect(lifetimes.get('2582df96e288e6cd')).toBe(HOUR);
  } finally { journal.close(); }
});
