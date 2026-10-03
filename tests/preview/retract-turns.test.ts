// Plan #389, observer note #146, Rule 35 (Test Identity Never Enters Production State); Rules 7, 28, 82, 89, 98.
// The desk proposes the exact turns it sent through the operator's own account; the runner renders that exact list and
// opens the same explicit-yes approval a raise uses; only the operator's yes applies it, as one `retract` row at its
// journal position. From there every store treats those turns as never the operator's. Nothing is deleted.
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, previewTestContext, commitmentOpen, liveSummaries, openBlockers, openDirectives,
  openQuestionCandidates, probeTurn, projectionDigest, retractCarrier, retractedTurn, retractRefusal, withinOperatorHours,
  type RetractProposal } from './journal-test-worker.js';
import { operatorYesAuthority, parseOperatorAction, proposeRetractRequest, wellFormedRequest } from './operator-yes.js';
import { memoryReport } from './memory-export.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient, type ReviewYesSource } from './review-yes-source.js';
import { SHARED_ACCESS_NOTE, type ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';

const key = new Uint8Array(32).fill(41);
const OPERATOR = 7654321, CHAT = String(OPERATOR);
/** 18:00 UTC: inside the operator hours in the trial's zone (UTC here). */
const T0 = Date.UTC(2026, 9, 3, 18, 0), HOUR = 3_600_000, DAY = 24 * HOUR;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: CHAT, operator: CHAT, grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 32768, cursor: 0 };
const installation = (over: Partial<ExplicitYesInstallation> = {}): ExplicitYesInstallation => ({ adapter: 'telegram-bot-api', machine: 'laptop',
  chat: { method: 'telegram-sender', boundChatId: CHAT, operatorAccountId: CHAT, agentHoldsNoAccess: true },
  github: null, agentSpeaksAsOperatorInChat: false, ...over });
const id = (update: number) => `telegram:12345678:update:${update}`;
const raw = (update: number, text: string) => JSON.stringify({ update_id: update, message: { message_id: update,
  chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR }, text } });

// The recorded shapes of the residue audit (lanes/residue-audit-PROGRESS.md): a reply-style preference, a dated reminder, a
// people note, a remember-request, a held question, a standing list instruction and a settled website blocker, all
// desk traffic; and one message of the operator's own, which carries a commitment and a people note of its own.
const SEED = {
  prefer: 'Your replies are too long — keep them to two sentences.',
  dated: 'Remind me on 2026-10-05 to take a short walk.',
  person: 'My cofounder Sam thinks we should delay the launch to November.',
  remember: 'Please remember my bike lock combination is 7734.',
  question: 'What was the code for my padlock P-123450 before?',
  own: 'great! Please remember my dentist is Dr. Lee.',
  directive: 'From now on, end every picnic list with "— 1FB".',
  blocker: 'Can you pay my water bill on the website for me?',
};
const CLAIM = 'I have no tools in this preview, so I can’t pay a water bill on any website.';
const blocker = { kind: 'cannot-do', claim: CLAIM, avenues: [{ avenue: 'utility website', disposition: 'outside-standing', evidence: 'externalTools' }],
  constraint: 'no-tools', outsideAction: 'Pay it on the utility site.', recheck: new Date(T0 + 30 * DAY).toISOString().slice(0, 10) };
/** Every seeded update except the operator's own message (6): exactly what the desk would propose. */
const DESK = [1, 2, 3, 4, 5, 7, 8];

function world(path: string, options: { install?: ExplicitYesInstallation; reopen?: boolean; review?: (now: () => number) => ReviewYesSource } = {}) {
  const journal = openPreviewJournal(path, key, options.reopen ? undefined : genesis);
  const clock = { now: T0 }, sent: { text: string; id: number }[] = [], summaryPackets: string[] = [], answerPackets: string[] = [];
  let message = 100, proposal: RetractProposal | undefined;
  const review = options.review?.(() => clock.now);
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC', checkOutbound: () => {},
    explicitYes: { context: previewTestContext, installation: options.install ?? installation(), retractProposal: () => proposal,
      ...(review ? { review } : {}) },
    model: async input => {
      if (input.id.startsWith('summary:')) {
        summaryPackets.push(input.context);
        return JSON.stringify({ summary: 'The operator asked who I am, and asked me to remember their dentist is Dr. Lee.',
          people: [], commitments: [], closed: [], memory: [], questions: [], memoryItems: [] });
      }
      answerPackets.push(input.context);
      if (input.question === SEED.directive) return JSON.stringify({ memory: [], reply: 'Got it.', directives: [{ quote: SEED.directive }] });
      if (input.question === SEED.blocker) return JSON.stringify({ memory: [], reply: CLAIM, blocker });
      return JSON.stringify({ memory: [], reply: 'Noted.' });
    },
    send: async input => { message += 1; sent.push({ text: input.expectedText, id: message }); return message; } });
  const say = async (update: number, text: string, over: object = {}) => {
    message += 1;
    worker.intake([{ update_id: update, message: { message_id: message, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR }, text,
      date: Math.floor(clock.now / 1000), ...over } }]);
    await worker.drain();
  };
  return { journal, worker, clock, sent, summaryPackets, answerPackets, say, propose: (value: RetractProposal | undefined) => { proposal = value; },
    nextMessage: () => message + 1 };
}

/** Seeds every store: direct rows for the memory side (as recorded), then the live worker path for the directive and blocker. */
async function seeded(path: string, options: Parameters<typeof world>[1] = {}) {
  const w = world(path, options);
  const rows = [SEED.prefer, SEED.dated, SEED.person, SEED.remember, SEED.question, SEED.own];
  rows.forEach((text, index) => {
    const update = index + 1, at = T0 - DAY + update * 60_000, turn = id(update);
    w.journal.append({ kind: 'intake', id: turn, update, text, raw: raw(update, text), accepted: true, cursor: update + 1, at });
    w.journal.append({ kind: 'reserve', id: turn, at });
    w.journal.append({ kind: 'answer', id: turn, text: 'Noted.', at,
      ...(update === 1 ? { memory: [{ mode: 'prefer' as const, source: turn, quote: text, trigger: turn }] } : {}),
      ...(update === 2 ? { dated: [{ source: turn, quote: text, when: '2026-10-05', zone: 'UTC', day: '2026-10-05' }] } : {}) });
    w.journal.append({ kind: 'intent', id: turn, text: 'PREVIEW — Noted.', chat: CHAT, update, grant: genesis.grant, at });
    w.journal.append({ kind: 'sent', id: turn, message: update, at });
  });
  const at = T0 - DAY + 10 * 60_000;
  w.journal.append({ kind: 'summary-reserve', through: 6, at });
  w.journal.append({ kind: 'summary', through: 6, at, text: 'Operator said Sam wants to delay the launch, bike lock 7734, replies two sentences, dentist Dr. Lee.',
    people: [{ name: 'Sam', source: id(3), quote: SEED.person }, { name: 'Dr. Lee', source: id(6), quote: SEED.own }],
    commitments: [{ in: 'message', source: id(4), quote: SEED.remember }, { in: 'message', source: id(6), quote: SEED.own }],
    questions: [{ source: id(5), quote: SEED.question, reason: 'unanswered-reply' }] });
  await w.say(7, SEED.directive);
  await w.say(8, SEED.blocker);
  return w;
}

const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-retract-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const stores = (w: Awaited<ReturnType<typeof seeded>>) => {
  const view = w.journal.view, report = memoryReport(view);
  return { directives: openDirectives(view).length, blockers: openBlockers(view).length, preferences: view.memory.filter(item => item.mode === 'prefer').length,
    dated: view.dated.length, sam: report.includes('**Sam**'), lee: report.includes('**Dr. Lee**'),
    commitments: view.commitments.map((_, index) => commitmentOpen(view, index)),
    questions: openQuestionCandidates(view).map(item => item.source), liveSummaries: liveSummaries(view).length };
};
const BEFORE = { directives: 1, blockers: 1, preferences: 1, dated: 1, sam: true, lee: true, commitments: [true, true],
  questions: [id(5)], liveSummaries: 1 };
const AFTER = { directives: 0, blockers: 0, preferences: 0, dated: 0, sam: false, lee: true, commitments: [false, true],
  questions: [], liveSummaries: 0 };

it('binds the exact list and reason in the request digest, and the model can never propose one', () => {
  const state = { expires: T0 + DAY, stopped: false, grant: 'grant:preview', base: 'b'.repeat(16) };
  const made = proposeRetractRequest(state, [1, 2, 3], 'desk test traffic', 'retract:abc', T0);
  expect(made.kind).toBe('request');
  if (made.kind !== 'request') return;
  expect(made.request).toMatchObject({ action: 'retract-turns', updates: [1, 2, 3], reason: 'desk test traffic', expiresAt: T0 + HOUR });
  expect(wellFormedRequest(made.request, 'retract:abc', 'grant:preview')).toBe(true);
  // A different list or reason under the same digest is not the approved request.
  expect(wellFormedRequest({ ...made.request, updates: [1, 2] }, 'retract:abc', 'grant:preview')).toBe(false);
  expect(wellFormedRequest({ ...made.request, reason: 'something else' }, 'retract:abc', 'grant:preview')).toBe(false);
  for (const bad of [[], [2, 1], [1, 1], [0], [-3], [Number.NaN]])
    expect(proposeRetractRequest(state, bad, 'desk test traffic', 'c', T0).kind, JSON.stringify(bad)).toBe('refused');
  expect(proposeRetractRequest(state, [1], 'short', 'c', T0).kind).toBe('refused');
  expect(proposeRetractRequest({ ...state, stopped: true }, [1], 'desk test traffic', 'c', T0).kind).toBe('refused');
  // Rule 10/82: a model's operatorAction cannot name a retraction; only the host's proposal can.
  expect(parseOperatorAction({ action: 'retract-turns', updates: [1] })).toBeUndefined();
  expect(parseOperatorAction({ action: 'retract-turns' })).toBeUndefined();
  // Operator hours, in the trial's zone: 09:00 to 21:00.
  expect(withinOperatorHours(Date.UTC(2026, 9, 3, 9, 0), 'UTC')).toBe(true);
  expect(withinOperatorHours(Date.UTC(2026, 9, 3, 20, 59), 'UTC')).toBe(true);
  expect(withinOperatorHours(Date.UTC(2026, 9, 3, 21, 0), 'UTC')).toBe(false);
  expect(withinOperatorHours(Date.UTC(2026, 9, 3, 3, 0), 'UTC')).toBe(false);
  expect(withinOperatorHours(Date.UTC(2026, 9, 3, 18, 0), 'America/Los_Angeles')).toBe(true);
});

it('an approved retraction hides exactly the listed turns from every store, keeps the rest, and replays and compacts the same', () => withRoot(async path => {
  const w = await seeded(path);
  expect(stores(w)).toEqual(BEFORE);
  expect(retractRefusal(w.journal.view, [...DESK, 99])).toContain('update 99 is not an accepted message');
  w.propose({ updates: DESK, reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now });
  await w.worker.minimal();
  const request = w.journal.view.operatorRequests.at(-1)!;
  expect(request).toMatchObject({ via: 'retract', request: { action: 'retract-turns', updates: DESK } });
  // The exact rendering the operator reads: the count, the first and last listed message, the rule, and how to approve.
  const text = w.sent.at(-1)!.text;
  expect(text).toContain(`Request ${request.request.id}: treat 7 messages sent through your account as test traffic, never as yours`);
  expect(text).toContain('Rule 35');
  expect(text).toContain(`The first is update 1: "${SEED.prefer}"; the last is update 8: "${SEED.blocker}".`);
  expect(text).toContain('To approve, reply "yes" as your next message here');
  expect(request.message).toBe(w.sent.at(-1)!.id);
  // Re-reading the same proposal never issues a second request (one carrier, one request).
  await w.worker.minimal();
  expect(w.journal.view.operatorRequests.filter(item => item.via === 'retract')).toHaveLength(1);
  expect(stores(w)).toEqual(BEFORE);
  await w.say(9, 'yes');
  const applied = w.journal.view.operatorRequests.at(-1)!;
  expect(applied.applied).toBe(true);
  expect(w.journal.view.retracted).toEqual(DESK.map(id));
  expect(stores(w)).toEqual(AFTER);
  // Exactly the listed turns, and the operator's own message and the approving yes, untouched.
  for (const turn of w.journal.view.order) expect(retractedTurn(w.journal.view, turn.id), turn.id).toBe(DESK.includes(turn.update));
  expect(probeTurn(w.journal.view, w.journal.view.turns.get(id(6))!)).toBe(false);
  // Rule 7: every row stays; the turns and their records are hidden, never deleted.
  expect(w.journal.view.order).toHaveLength(9);
  expect(w.journal.view.directives).toHaveLength(1);
  expect(w.journal.view.blockers).toHaveLength(1);
  expect(w.journal.view.summaries).toHaveLength(1);
  // A later answer's packet carries none of the retracted content, and still the operator's own.
  const probe = w.worker.probe('What do you know about me?');
  if ('reason' in probe) throw Error(probe.reason);
  for (const gone of ['two sentences', '7734', 'Sam', '1FB', 'water bill', 'P-123450', '2026-10-05']) expect(probe.context, gone).not.toContain(gone);
  expect(probe.context).toContain('Dr. Lee');
  const digest = projectionDigest(w.journal.view);
  w.journal.close();
  const replay = openPreviewJournal(path, key);
  expect(projectionDigest(replay.view)).toBe(digest);
  expect(replay.view.retracted).toEqual(DESK.map(id));
  replay.compact(); replay.close();
  const snapshot = openPreviewJournal(path, key);
  expect(projectionDigest(snapshot.view)).toBe(digest);
  // The consumed yes cannot apply the same retraction twice, nor any other list.
  expect(() => snapshot.append({ kind: 'retract', request: applied.request.id, updates: DESK, reason: applied.request.reason!,
    authority: operatorYesAuthority(applied.request.id, applied.approved!.reference), at: T0 + 2 * HOUR })).toThrow('retract refused');
  snapshot.close();
}));

it('a later summary pass rebuilds without the retracted turns or the retired summary text', () => withRoot(async path => {
  const w = await seeded(path);
  w.propose({ updates: DESK, reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now });
  await w.worker.minimal();
  await w.say(9, 'yes');
  expect(liveSummaries(w.journal.view)).toEqual([]);
  await w.worker.summarizeIfNeeded(true);
  // One call: a span never ends on a retracted turn, so the rebuild does not step through them a few at a time.
  expect(w.summaryPackets).toHaveLength(1);
  for (const packet of w.summaryPackets)
    for (const gone of ['two sentences', '7734', 'Sam', '1FB', 'water bill', 'P-123450']) expect(packet, gone).not.toContain(gone);
  expect(w.summaryPackets.join('\n')).toContain('Dr. Lee');
  const rebuilt = liveSummaries(w.journal.view).at(-1)!;
  expect(rebuilt.text).toContain('Dr. Lee');
  expect(w.journal.view.retiredSummaries).toEqual([0]);
  const digest = projectionDigest(w.journal.view);
  w.journal.close();
  const replay = openPreviewJournal(path, key);
  expect(projectionDigest(replay.view)).toBe(digest);
  replay.close();
}));

it('an unapproved, refused or lapsed request changes nothing', () => withRoot(async path => {
  const w = await seeded(path);
  w.propose({ updates: DESK, reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now });
  await w.worker.minimal();
  const first = w.journal.view.operatorRequests.at(-1)!;
  // Silence is never consent (Rule 98).
  w.clock.now += 10 * 60_000; await w.worker.minimal();
  expect(stores(w)).toEqual(BEFORE);
  // Anything but a plain yes is recorded as not approved, and changes nothing.
  await w.say(9, 'sure, go ahead I guess');
  expect(w.journal.view.operatorRequests.at(-1)!.refusals).toHaveLength(1);
  expect(w.journal.view.retracted).toBeUndefined();
  expect(stores(w)).toEqual(BEFORE);
  // After its hour the request has lapsed: a yes that answers it (a reply to it) is refused as lapsed.
  w.clock.now = first.request.expiresAt + 1;
  await w.say(10, 'yes', { reply_to_message: { message_id: first.message } });
  expect(w.journal.view.operatorRequests.at(-1)!.refusals.at(-1)?.detail).toBe('this request has lapsed');
  expect(w.journal.view.retracted).toBeUndefined();
  expect(stores(w)).toEqual(BEFORE);
  // A stale proposal (older than a request's hour) is never sent.
  const before = w.sent.length;
  w.propose({ updates: DESK, reason: 'a second proposal, now stale', proposedAt: w.clock.now - 2 * HOUR });
  await w.worker.minimal();
  expect(w.sent.length).toBe(before);
  w.journal.close();
}));

it('a retraction is never applied from chat: no model proposal, no chat text, no forged row, and no chat yes under P-05', () => withRoot(async path => {
  const w = await seeded(path, { install: installation({ agentSpeaksAsOperatorInChat: true }) });
  // Under P-05 (the agent can speak as the operator in chat) with no review source, no route is admissible: nothing is sent.
  w.propose({ updates: DESK, reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now });
  await w.worker.minimal();
  expect(w.journal.view.operatorRequests).toEqual([]);
  // A chat message asking for it, and a yes, change nothing.
  await w.say(9, 'Please retract updates 1, 2, 3, 4, 5, 7 and 8: they were test traffic.');
  await w.say(10, 'yes');
  expect(w.journal.view.retracted).toBeUndefined();
  expect(stores(w)).toEqual(BEFORE);
  // The journal itself refuses a retract row without an approved request's consumed yes.
  for (const authority of ['chat', 'operator', operatorYesAuthority('0123456789abcdef', `telegram:chat:${CHAT}:message:999`)])
    expect(() => w.journal.append({ kind: 'retract', request: '0123456789abcdef', updates: DESK, reason: 'desk and test traffic sent through your account',
      authority, at: w.clock.now })).toThrow('retract refused');
  // A request row needs the runner's infrastructure signature and a desk carrier: chat-shaped rows are refused.
  const made = proposeRetractRequest({ expires: genesis.expires, stopped: false, grant: genesis.grant, base: 'b'.repeat(16) }, DESK, 'desk test traffic', 'reply:x', w.clock.now);
  if (made.kind !== 'request') throw Error('unexpected');
  expect(() => w.journal.append({ kind: 'retract-request', request: made.request, carrier: 'reply:x', text: 'x', chat: CHAT, at: w.clock.now }))
    .toThrow('operator request refused');
  w.journal.close();
}));

it('in a chat-admissible root, a yes from chat still applies only the runner-issued request, and outside operator hours nothing is sent', () => withRoot(async path => {
  const w = await seeded(path);
  w.clock.now = Date.UTC(2026, 9, 4, 2, 0);
  w.propose({ updates: DESK, reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now });
  const before = w.sent.length;
  await w.worker.minimal();
  expect(w.sent.length).toBe(before);
  expect(w.journal.view.operatorRequests).toEqual([]);
  // A list naming the operator's own message is refusable by construction: they decline, and nothing changes.
  w.clock.now = Date.UTC(2026, 9, 4, 10, 0);
  const withOwn = [...DESK, 6].sort((a, b) => a - b);
  w.propose({ updates: withOwn, reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now });
  await w.worker.minimal();
  expect(w.journal.view.operatorRequests.at(-1)!.request.updates).toEqual(withOwn);
  expect(w.journal.view.operatorRequests.at(-1)!.carrier).toBe(retractCarrier({ updates: withOwn,
    reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now }));
  await w.say(9, 'no, update 6 was mine');
  expect(w.journal.view.retracted).toBeUndefined();
  expect(stores(w)).toEqual(BEFORE);
  w.journal.close();
}));

it('on the GitHub-review route (P-05) the page lists every id, a chat yes changes nothing, and only the pinned review applies it', () => withRoot(async path => {
  const REPO = 'JKHeadley/instar-2', HEAD = 'a'.repeat(40), opened: string[] = [], reviews: GitHubReview[] = [];
  const client: GitHubReviewClient = { async openRequest(input) { opened.push(input.body); return { number: 41, head: HEAD }; },
    async pullRequest() { return { body: opened.at(-1) ?? '', head: HEAD }; }, async reviews() { return [...reviews]; }, async closeRequest() {} };
  const install = installation({ agentSpeaksAsOperatorInChat: true, installation: genesis.grant, adapter: 'github-api',
    chat: { method: 'telegram-sender', boundChatId: CHAT, operatorAccountId: CHAT, agentHoldsNoAccess: false },
    github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
      acceptance: { account: 'JKHeadley', installation: genesis.grant, operatorMessages: ['telegram:chat:7654321:message:1'], acceptedAt: 500, withdrawn: null } } });
  const w = await seeded(path, { install, review: now => createReviewYesSource({ client, installation: install, repository: REPO,
    context: previewTestContext, now, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } }) });
  w.propose({ updates: DESK, reason: 'desk and test traffic sent through your account', proposedAt: w.clock.now });
  await w.worker.minimal();
  const request = w.journal.view.operatorRequests.at(-1)!;
  expect(request.review).toEqual({ repository: REPO, pullRequest: 41, head: HEAD });
  expect(opened[0]).toContain(`Approval request ${request.request.id}`);
  expect(opened[0]).toContain('The exact update ids (7): 1, 2, 3, 4, 5, 7, 8');
  expect(w.sent.at(-1)!.text).toContain(`open https://github.com/${REPO}/pull/41/files and approve the pull request`);
  // A chat yes from the operator's account is exactly what the desk could forge: it is refused and changes nothing.
  await w.say(9, 'yes');
  expect(w.journal.view.retracted).toBeUndefined();
  expect(stores(w)).toEqual(BEFORE);
  // A review by another login changes nothing; the pinned operator's approval applies it once, with the disclosure.
  reviews.push({ id: 900, state: 'APPROVED', commitId: HEAD, login: 'EchoOfDawn', submittedAt: new Date(w.clock.now + 30_000).toISOString() });
  w.clock.now += 60_000; await w.worker.minimal();
  expect(w.journal.view.retracted).toBeUndefined();
  reviews.push({ id: 901, state: 'APPROVED', commitId: HEAD, login: 'JKHeadley', submittedAt: new Date(w.clock.now).toISOString() });
  w.clock.now += 60_000; await w.worker.minimal();
  expect(w.journal.view.retracted).toEqual(DESK.map(id));
  expect(stores(w)).toEqual(AFTER);
  expect(w.sent.at(-1)!.text).toBe(`Request ${request.request.id} is done: 7 messages sent through your account are no longer treated as yours, `
    + `approved through your GitHub account; note: ${SHARED_ACCESS_NOTE}.`);
  w.journal.close();
}));

it('propose-retract leaves one exact proposal for the runner during operator hours, and refuses outside them or for an unknown id', () => withRoot(async path => {
  const w = await seeded(path);
  w.journal.close();
  const root = path.slice(0, -'/journal.encrypted'.length), list = join(root, 'list.txt'), proposal = join(root, 'preview-retract-proposal.json');
  // Fixed-offset zones, one inside and one outside 09:00-21:00 for this very moment (the command reads the real clock).
  const zones = Array.from({ length: 24 }, (_, hours) => `Etc/GMT${hours - 12 >= 0 ? '+' : '-'}${Math.abs(hours - 12)}`).filter(zone => zone !== 'Etc/GMT-0');
  const now = Date.now(), inside = zones.find(zone => withinOperatorHours(now + 60_000, zone) && withinOperatorHours(now, zone))!;
  const outside = zones.find(zone => !withinOperatorHours(now + 60_000, zone) && !withinOperatorHours(now, zone))!;
  const propose = (zone: string) => spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'propose-retract', '--root', root, '--updates-file', list, '--time-zone', zone],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') }, encoding: 'utf8', timeout: 20000 });
  writeFileSync(list, `# desk list\n${[...DESK].reverse().join('\n')}\n`);
  const late = propose(outside);
  expect(late.status).not.toBe(0);
  expect(late.stdout).toContain('only during operator hours');
  expect(existsSync(proposal)).toBe(false);
  writeFileSync(list, `${DESK.join('\n')}\n99\n`);
  const unknown = propose(inside);
  expect(unknown.status).not.toBe(0);
  expect(unknown.stdout).toContain('update 99 is not an accepted message');
  expect(existsSync(proposal)).toBe(false);
  writeFileSync(list, `${[...DESK].reverse().join('\n')}\n`);
  const made = propose(inside);
  expect(made.status, made.stderr).toBe(0);
  expect(JSON.parse(made.stdout)).toMatchObject({ proposed: 7, first: { update: 1 }, last: { update: 8 } });
  const saved = JSON.parse(readFileSync(proposal, 'utf8')) as RetractProposal & { version: number };
  expect(saved).toMatchObject({ version: 1, updates: DESK });
  // Proposing changed no journal state: nothing is retracted until the operator approves the runner's request.
  const reopened = openPreviewJournal(path, key);
  expect(reopened.view.retracted).toBeUndefined();
  expect(reopened.view.operatorRequests).toEqual([]);
  reopened.close();
}));
