import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { conclusionText, parseModelJson } from './model-json.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
import { OPERATOR_ROUTE_GUIDANCE, OTHER_OPERATOR_REQUEST_GUIDANCE, operatorRequestsReport, projectionDigest, raiseJournalCaps } from './journal.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY } from '../../src/assembly/production-provider.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';

// Plan row #371 (Rules 3, 42, 79, 82, 98, 106; observer #106). Live on the operator's preview (cint-L37 02203355) the desk
// asked for a raise (update 969390038, PR #146) and then a renewal (969390039, PR #147). Three defects: the renewal
// superseded the open raise, so the two could not be approved together; the pull request body said 'reply "yes"' on a
// root where only the review approves; and the raise reply opened "I still can't raise my own model-call limit" above the
// proposal. The fixture holds the journaled answers of those two turns and REAL model outputs on their recorded
// envelopes with this branch's route sentence. Every replay goes through the live port's own extraction into the wired
// P-05 review route on a root shaped like the live one: 2,500 calls after host raises, the trial ending 2026-10-05 20:40,
// the reviewed 2026-10-12 activation installed.
const FIXTURE = 'tests/preview/fixtures/yes-batch-live-2026-10-03.json';
type Output = { update: number; guidance: 'route-v1' | 'route-final'; run: string; now: number; message: string; raw: string };
type Recorded = { update: number; now: number; message: string; answer: string; operatorAction: unknown; intent: string };
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outputs: Output[]; recorded: Recorded[]; routeGuidance: string };
const output = (update: number, run: string) => fixture.outputs.find(item => item.update === update && item.run === run)!;
const RAISE = 969390038, RENEW = 969390039;
const key = new Uint8Array(32).fill(47);
const OPERATOR = 7812716706, REPO = 'JKHeadley/instar-2', TRIAL = 'grant:preview';
const installation: ExplicitYesInstallation = { adapter: 'github-api', machine: 'studio', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:chat:7812716706:message:121804'], acceptedAt: 500, withdrawn: null } } };
const RENEWAL = `sha256:${'6'.repeat(64)}`;
type Usage = { inputTokens: null; outputTokens: null; charge: null };
type Answer = { state: 'complete'; text: string; usage: Usage } | { state: 'complete'; failureClass: 'malformed'; usage: Usage };
/** What journal-agent's invokeSubscription hands the worker for a complete subscription result. */
function livePort(raw: string): Answer {
  const extracted = parseModelJson(raw, { wrapped: 'accept' });
  const decision = extracted.ok ? extracted.value as { type?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision as Parameters<typeof decisionWithinFloor>[0]) ? conclusionText(decision.conclusion.value) : null;
  const usage = { inputTokens: null, outputTokens: null, charge: null } as const;
  return value === null ? { state: 'complete', failureClass: 'malformed', usage } : { state: 'complete', text: value, usage };
}
/** The recorded turn's journaled answer and proposal, as the model returned them (the raw output is not journaled). */
const journaled = (update: number) => { const item = fixture.recorded.find(entry => entry.update === update)!;
  return JSON.stringify({ reply: item.answer, memory: [], operatorAction: item.operatorAction }); };

/** A root shaped like the live one, with a GitHub fake whose reviews are per pull request. */
function liveRoot(path: string, install: ExplicitYesInstallation = installation) {
  const g = { kind: 'genesis' as const, bot: '8820318295', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
    configurationDigest: 'sha256:offline', expires: SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY, maxCalls: 16, maxReplies: 16, maxTurns: 20,
    maxBytes: 409600, cursor: 0 };
  const journal = openPreviewJournal(path, key, g);
  const start = fixture.recorded[0]!.now;
  raiseJournalCaps(journal, { maxCalls: 2500, maxReplies: 2500, maxTurns: 2500, authority: 'operator-host:test', at: start - 3_600_000 });
  let clock = start, pull = 145, message = 1029;
  const opened: { number: number; body: string; content: string; head: string }[] = [], closed: number[] = [];
  const reviews = new Map<number, GitHubReview[]>(), sent: string[] = [], contexts: string[] = [];
  const answers = new Map<number, () => Answer | string>();
  const client: GitHubReviewClient = {
    async openRequest(input) { pull += 1; const head = String(pull % 10).repeat(40);
      opened.push({ number: pull, body: input.body, content: input.content, head }); return { number: pull, head }; },
    async pullRequest(_repository, number) { const item = opened.find(entry => entry.number === number)!; return { body: item.body, head: item.head }; },
    async reviews(_repository, number) { return [...reviews.get(number) ?? []]; },
    async closeRequest(_repository, number) { closed.push(number); } };
  const review = createReviewYesSource({ client, installation: () => install, repository: REPO, context: previewTestContext,
    now: () => clock, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
  const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false, checkOutbound: () => {},
    explicitYes: { context: previewTestContext, installation: () => install, review,
      renewalActivation: (expires: number) => expires === SUBSCRIPTION_PREVIEW_EXPIRY ? RENEWAL : null },
    model: async input => { if (!input.id.startsWith('telegram:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      contexts.push(input.context); const update = Number(/update:(\d+)$/u.exec(input.id)?.[1]);
      return (answers.get(update) ?? (() => JSON.stringify({ reply: 'ordinary answer', memory: [] })))(); },
    send: async input => { sent.push(input.expectedText); message += 1; return message; } });
  return {
    journal, worker, opened, closed, sent, contexts,
    /** One verified operator turn at its recorded time, answered by `answer`. */
    async ask(update: number, at: number, text: string, answer: () => Answer | string, replyTo?: number) {
      clock = at; answers.set(update, answer); message += 1;
      worker.intake([{ update_id: update, message: { message_id: message, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR },
        text, date: Math.floor(at / 1000), ...(replyTo === undefined ? {} : { reply_to_message: { message_id: replyTo } }) } }]);
      await worker.drain();
    },
    approve(number: number, id: string, at = clock + 60_000) {
      const item = opened.find(entry => entry.number === number)!;
      reviews.set(number, [...reviews.get(number) ?? [], { id, state: 'APPROVED', commitId: item.head, login: 'JKHeadley',
        submittedAt: new Date(at).toISOString() }]);
    },
    async poll(ms = 120_000) { clock += ms; await worker.minimal(); },
    advance(ms: number) { clock += ms; },
    request: (action: string) => journal.view.operatorRequests.filter(item => item.request.action === action).at(-1)!,
  };
}
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-yes-batch-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const recorded = (update: number) => fixture.recorded.find(item => item.update === update)!;

it('reproduces the live supersede on the base shape, and on this branch keeps the raise open beside the renewal (plan #371)', async () => {
  // The live record: the renewal's request superseded the open raise and its pull request was closed.
  expect(recorded(RAISE).operatorAction).toEqual({ action: 'raise-caps', limits: { maxCalls: 'step' } });
  expect(recorded(RENEW).operatorAction).toEqual({ action: 'renew-expiry' });
  await withRoot(async path => {
    const root = liveRoot(path);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    expect(raise.request.limits).toEqual({ maxCalls: 5000, maxReplies: 2500, maxTurns: 2500 });
    expect(renew.request.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    // Both are recorded under one-request-per-action; neither supersedes the other.
    expect([raise.scope, renew.scope]).toEqual(['action', 'action']);
    expect(raise.superseded).toBeUndefined();
    expect(renew.superseded).toBeUndefined();
    expect(root.opened.map(item => item.number)).toEqual([146, 147]);
    await root.poll(30_000);
    expect(root.closed).toEqual([]);
    expect(operatorRequestsReport(root.journal.view, root.journal.view.clockFloor).map(item => [item.id, item.state, item.closed]))
      .toEqual([[raise.request.id, 'open', false], [renew.request.id, 'open', false]]);
    root.journal.close();
  });
});

it('applies a raise and a renewal approved together, each from its own review, with one completion line each', async () => {
  await withRoot(async path => {
    const root = liveRoot(path);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => livePort(output(RAISE, 'b').raw));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => livePort(output(RENEW, 'a').raw));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    // The operator approves both pull requests, then the runner polls once: both apply.
    root.approve(146, '7001'); root.approve(147, '7002');
    await root.poll();
    expect(root.journal.view.limits).toMatchObject({ maxCalls: 5000, maxReplies: 2500, maxTurns: 2500 });
    expect(root.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    expect([raise.applied, renew.applied]).toEqual([true, true]);
    // Each approval names its own pull request's review, consumed once.
    expect(raise.approved!.reference).toContain('7001');
    expect(renew.approved!.reference).toContain('7002');
    expect(root.sent.filter(text => text.startsWith(`Request ${raise.request.id} is done: raised the model-call allowance from 2500 to 5000`))).toHaveLength(1);
    expect(root.sent.filter(text => text.startsWith(`Request ${renew.request.id} is done: extended this trial's end from 2026-10-05 20:40 UTC to 2026-10-12 20:40 UTC`))).toHaveLength(1);
    // Polling again changes nothing and sends nothing (no duplicate send).
    const before = root.sent.length; await root.poll();
    expect(root.sent).toHaveLength(before);
    // The projection reopens unchanged.
    const digest = projectionDigest(root.journal.view);
    root.journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(projectionDigest(reopened.view)).toBe(digest);
    expect(reopened.view.operatorRequests.map(item => [item.request.action, item.applied, item.scope]))
      .toEqual([['raise-caps', true, 'action'], ['renew-expiry', true, 'action']]);
    reopened.close();
  });
});

it('binds each approval only to its own request: a review id spent on one is refused on the other, and either order applies', async () => {
  await withRoot(async path => {
    const root = liveRoot(path);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => livePort(output(RAISE, 'c').raw));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => livePort(output(RENEW, 'b').raw));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    // The renewal is approved first; the raise stays open and unapplied.
    root.approve(147, '8001');
    await root.poll();
    expect(renew.applied).toBe(true);
    expect(raise.approved).toBeUndefined();
    expect(root.journal.view.limits.maxCalls).toBe(2500);
    // The same review id shown on the raise's pull request is a reused reference: refused, nothing applied.
    root.approve(146, '8001');
    await root.poll();
    expect(raise.approved).toBeUndefined();
    // (The renewal ask itself was judged as a chat answer to the open raise and refused under P-05, as live.)
    expect(raise.refusals.map(item => item.turn).filter(turn => turn.startsWith('review:'))).toEqual(['review:8001']);
    // Its own fresh review applies it.
    root.approve(146, '8002');
    await root.poll();
    expect(raise.applied).toBe(true);
    expect(root.journal.view.limits.maxCalls).toBe(5000);
    root.journal.close();
  });
});

it('a raise approved first carries the open renewal forward; a host raise still stales it', async () => {
  await withRoot(async path => {
    const root = liveRoot(path);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    root.approve(146, '9001');
    await root.poll();
    expect(raise.applied).toBe(true);
    // The renewal names only the trial's end, which the raise left unchanged: it stays approvable at the moved base.
    expect(renew.liveBase).toBeDefined();
    expect(renew.liveBase).not.toBe(renew.request.base);
    root.approve(147, '9002');
    await root.poll();
    expect(renew.applied).toBe(true);
    expect(root.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    root.journal.close();
  });
  await withRoot(async path => {
    // The other side: a host raise (not an approved request) moves the base, so the open renewal is stale and closed.
    const root = liveRoot(path);
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const renew = root.request('renew-expiry');
    raiseJournalCaps(root.journal, { maxCalls: 2600, maxReplies: 2500, maxTurns: 2500, authority: 'operator-host:test', at: recorded(RENEW).now + 1000 });
    root.approve(renew.review!.pullRequest, '9101');
    await root.poll();
    expect(renew.liveBase).toBeUndefined();
    expect(renew.approved).toBeUndefined();
    expect(root.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY);
    expect(root.closed).toEqual([renew.review!.pullRequest]);
    root.journal.close();
  });
});

it('a new request of the SAME action still supersedes the older one and closes its pull request, leaving the other action open', async () => {
  await withRoot(async path => {
    const root = liveRoot(path);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const first = root.request('raise-caps'), renew = root.request('renew-expiry');
    await root.ask(RENEW + 1, recorded(RENEW).now + 60_000, recorded(RAISE).message, () => journaled(RAISE));
    const second = root.request('raise-caps');
    expect(second.request.id).not.toBe(first.request.id);
    expect(first.superseded).toBe(true);
    expect(renew.superseded).toBeUndefined();
    await root.poll(30_000);
    expect(root.closed).toEqual([146]);
    // The superseded raise can no longer be approved; the newer raise and the renewal can.
    root.approve(146, '9201');
    await root.poll();
    expect(first.approved).toBeUndefined();
    root.approve(148, '9202'); root.approve(147, '9203');
    await root.poll();
    expect([second.applied, renew.applied]).toEqual([true, true]);
    root.journal.close();
  });
});

it('on a chat-yes root, a yes binds only the request it answers: each of two open requests is approved by its own reply', async () => {
  const chatRoot: ExplicitYesInstallation = { ...installation, agentSpeaksAsOperatorInChat: false,
    chat: { ...installation.chat, agentHoldsNoAccess: true }, github: null };
  await withRoot(async path => {
    const root = liveRoot(path, chatRoot);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    const raise = root.request('raise-caps'), renew = root.request('renew-expiry');
    expect([raise.review, renew.review, raise.superseded, renew.superseded]).toEqual([undefined, undefined, undefined, undefined]);
    expect(root.opened).toEqual([]);
    // A plain yes replying to the raise's message approves the raise only.
    await root.ask(RENEW + 1, recorded(RENEW).now + 30_000, 'yes', () => JSON.stringify({ reply: 'Done.', memory: [] }), raise.message);
    expect(raise.applied).toBe(true);
    expect(renew.approved).toBeUndefined();
    // The next message is not an answer to the renewal (another operator message came after it); a reply to it is.
    await root.ask(RENEW + 2, recorded(RENEW).now + 60_000, 'yes', () => JSON.stringify({ reply: 'Done.', memory: [] }));
    expect(renew.approved).toBeUndefined();
    await root.ask(RENEW + 3, recorded(RENEW).now + 90_000, 'yes', () => JSON.stringify({ reply: 'Done.', memory: [] }), renew.message);
    expect(renew.applied).toBe(true);
    expect(root.journal.view.limits.maxCalls).toBe(5000);
    expect(root.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    root.journal.close();
  });
});

it('the request\'s pull request names only the review route; a chat "yes" is never offered there (P-05)', async () => {
  // The live body said: To approve, reply "yes" as your next message here.
  await withRoot(async path => {
    const root = liveRoot(path);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    for (const item of root.opened) {
      for (const text of [item.body, item.content]) {
        expect(text).not.toMatch(/reply "yes"|next message/u);
        expect(text).toContain('To approve, approve this pull request (Review changes, then Approve); anything else changes nothing.');
      }
    }
    expect(root.opened[0]!.body).toContain(`raise the model-call allowance from 2500 to 5000 (2500 more model calls)`);
    expect(root.opened[1]!.body).toContain('extend this trial\'s end from 2026-10-05 20:40 UTC to 2026-10-12 20:40 UTC');
    // The chat reply keeps its direct link.
    expect(root.sent[0]).toContain(`open https://github.com/${REPO}/pull/146/files and approve the pull request`);
    root.journal.close();
  });
});

it('tells the answer that proposing is how the change is made, and the real outputs on the recorded turns propose without a cannot-do (Rule 3)', async () => {
  expect(fixture.routeGuidance).toBe(OPERATOR_ROUTE_GUIDANCE);
  // The live replies the defect came from.
  expect(recorded(RAISE).answer).toMatch(/^I still can't raise my own model-call limit/u);
  const cannot = /\b(?:can't|cannot|can not|unable to)\s+(?:raise|renew|extend|increase|do that)|not something I (?:can|have)/iu;
  const final = fixture.outputs.filter(item => item.guidance === 'route-final');
  expect(final.map(item => `${item.update}${item.run}`).sort()).toEqual(['969390038b', '969390038c', '969390039a', '969390039b']);
  for (const item of final) {
    const answer = livePort(item.raw);
    expect(answer.state === 'complete' && 'text' in answer, `${item.update}${item.run}`).toBe(true);
    const value = JSON.parse((answer as { text: string }).text) as { reply: string; operatorAction?: unknown };
    expect(value.operatorAction, `${item.update}${item.run}`).toEqual(item.update === RAISE ? { action: 'raise-caps', limits: { maxCalls: 'step' } }
      : { action: 'renew-expiry' });
    expect(value.reply, `${item.update}${item.run}`).not.toMatch(cannot);
  }
  // The first wording tried on the raise turn did not hold: it repeated the cannot-do and proposed nothing.
  const first = JSON.parse((livePort(output(RAISE, 'a').raw) as { text: string }).text) as { reply: string; operatorAction?: unknown };
  expect(first.operatorAction).toBeUndefined();
  expect(first.reply).toMatch(cannot);
  // Wired: the route sentence rides the packet on this admissible root, and the other open request is shown beside the latest.
  await withRoot(async path => {
    const root = liveRoot(path);
    await root.ask(RAISE, recorded(RAISE).now, recorded(RAISE).message, () => journaled(RAISE));
    await root.ask(RENEW, recorded(RENEW).now, recorded(RENEW).message, () => journaled(RENEW));
    expect(root.contexts[0]).toContain(OPERATOR_ROUTE_GUIDANCE.trim());
    expect(root.contexts[0]).not.toContain('otherOperatorRequest');
    await root.ask(RENEW + 1, recorded(RENEW).now + 60_000, 'What is still waiting for my approval?', () => JSON.stringify({ reply: 'Two requests.', memory: [] }));
    const context = root.contexts.at(-1)!;
    expect(context).toContain(OTHER_OPERATOR_REQUEST_GUIDANCE.trim());
    const shown = (field: string) => new RegExp(`"${field}":\\{"id":"([0-9a-f]{16})"`, 'u').exec(context)?.[1];
    expect([shown('operatorRequest'), shown('otherOperatorRequest')].sort())
      .toEqual([root.request('raise-caps').request.id, root.request('renew-expiry').request.id].sort());
    root.journal.close();
  });
});

// The live copy (optional; never the live root): INSTAR_YESBATCH_ROOT is a directory holding a COPY of
// lanes/preview-trial-root/runner-2026-09-26/journal.encrypted; INSTAR_SECRET_PREVIEW_STORAGE_KEY is bound from the vault.
const COPY = process.env.INSTAR_YESBATCH_ROOT, STORAGE = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
it.skipIf(COPY === undefined || STORAGE === undefined)('the live journal, written under supersede-all, still opens and projects as it did', () => {
  const bytes = Buffer.from(STORAGE!, /^[a-f0-9]{64}$/iu.test(STORAGE!) ? 'hex' : 'base64');
  const journal = openPreviewJournal(resolve(COPY!, 'journal.encrypted'), new Uint8Array(bytes), undefined, undefined, true);
  try {
    const requests = journal.view.operatorRequests.map(item => [item.request.id, item.request.action, item.superseded === true, item.reviewClosed === true, item.scope]);
    // Legacy rows keep the old rule: the renewal superseded the open raise, whose recorded close still replays.
    expect(requests).toEqual(expect.arrayContaining([['76d0fdb9a274138e', 'raise-caps', true, true, undefined],
      ['2582df96e288e6cd', 'renew-expiry', false, false, undefined]]));
  } finally { journal.close(); }
});
