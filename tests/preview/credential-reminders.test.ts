// Rules 8, 56, 100: a due credential reminder and a failing doorway check ride the next operator answer as one line.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { createSecretCustody, dueCredentialReminders, reminderSchedule } from './secret-custody.js';
import { credentialNotices, doorwayNotices, dueWithDelivery, openReplyNotices, remainingText, validAnswerNotices, type ReplyNotice } from './credential-reminders.js';
import { installDoorways, observeExchange, standingDoorwayCheck, DOORWAY_FRESH_MS } from './doorway-map.js';

const key = new Uint8Array(32).fill(41);
const T0 = 1790000000000, HOUR = 3_600_000, DAY = 24 * HOUR;
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-credential-reminders-')));
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 8000, cursor: 0 });
const ACTION = 'approve a renewed activation record';

function activation(root: string, expiresAt: number, now: () => number) {
  const custody = createSecretCustody(root, key, now);
  custody.register({ name: 'preview-activation', kind: 'activation', custody: 'activation-record', identity: 'activation act-7',
    recordedAt: T0, expiresAt, expirySource: 'activation-record', reminders: reminderSchedule(expiresAt),
    renewal: { standing: 'none', smallestHumanAction: ACTION } });
  return custody;
}

function world(root: string, notices: () => readonly ReplyNotice[], receipt: () => boolean = () => true) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  const clock = { now: T0 }, sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context, replyNotices: notices,
    model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'Small talk.', people: [], commitments: [], closed: [] }) : JSON.stringify({ reply: 'Noted.', memory: [] }),
    send: async input => { if (!receipt()) return null; sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  let next = 1;
  const say = async (text: string) => {
    worker.intake([{ update_id: next++, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  return { journal, clock, sent, say };
}

it('makes the activation reminder due exactly at 7 days before expiry, not 1 ms earlier, and escalates by stage', () => {
  const root = origin();
  try {
    const expiresAt = T0 + 7 * DAY, custody = activation(root, expiresAt, () => T0);
    expect(dueCredentialReminders(custody.records(), T0 - 1)).toEqual([]);
    const due = dueCredentialReminders(custody.records(), T0);
    expect(due).toMatchObject([{ name: 'preview-activation', stage: 0, smallestHumanAction: ACTION }]);
    expect(credentialNotices(due, T0)).toEqual([{ key: `credential:preview-activation:${expiresAt}:0`,
      line: `Reminder: the credential "preview-activation" (activation act-7) expires in 7 days. Smallest step for you: ${ACTION}.` }]);
    expect(credentialNotices(dueCredentialReminders(custody.records(), expiresAt - 3 * DAY), expiresAt - 3 * DAY)[0]!.key)
      .toBe(`credential:preview-activation:${expiresAt}:1`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('renders the remaining time bound to its subject', () => {
  expect(remainingText(6 * DAY + 23 * HOUR + 5 * 60_000)).toBe('expires in 6 days 23 h');
  expect(remainingText(DAY)).toBe('expires in 1 day');
  expect(remainingText(5 * HOUR + 30 * 60_000)).toBe('expires in 5 h 30 min');
  expect(remainingText(10_000)).toBe('expires in 1 min');
  expect(remainingText(0)).toBe('has expired');
});

it('carries one reminder line on the next answer, never repeats it, and shows the delivered stage', async () => {
  const root = origin();
  try {
    const expiresAt = T0 + 7 * DAY;
    const custody = activation(root, expiresAt, () => w.clock.now);
    const notices = () => credentialNotices(dueCredentialReminders(custody.records(), w.clock.now), w.clock.now);
    const w = world(root, () => [...notices(), { key: 'doorway:1', line: 'Model route check: x/y is stale; send "status" for detail.' }]);
    await w.say('Good morning.');
    expect(w.sent).toHaveLength(1);
    expect(w.sent[0]).toContain(`Smallest step for you: ${ACTION}.`);
    expect(w.sent[0]).not.toContain('Model route check');
    const due = dueCredentialReminders(custody.records(), w.clock.now);
    expect(dueWithDelivery(due, w.journal.view.order)).toMatchObject([{ stage: 0, delivered: { stage: 0, at: T0, current: true } }]);
    // The second answer carries the next open line (the doorway), not the same reminder again.
    w.clock.now += HOUR; await w.say('Anything else?');
    expect(w.sent[1]).not.toContain('Reminder:');
    expect(w.sent[1]).toContain('Model route check');
    w.clock.now += HOUR; await w.say('Thanks.');
    expect(w.sent[2]).not.toContain('Reminder:');
    expect(w.sent[2]).not.toContain('Model route check');
    // The next stage is a new key: it rides the next answer once.
    w.clock.now = expiresAt - 3 * DAY; await w.say('Still there?');
    expect(w.sent[3]).toContain('Reminder: the credential "preview-activation" (activation act-7) expires in 3 days.');
    expect(dueWithDelivery(dueCredentialReminders(custody.records(), w.clock.now), w.journal.view.order))
      .toMatchObject([{ stage: 1, delivered: { stage: 1, current: true } }]);
    // Replay rebuilds the same delivery from the durable journal.
    w.journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    expect(openReplyNotices(reopened.view.order, notices(), 'none')).toEqual([]);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('starts a renewed credential lifetime undelivered: its next answer carries one reminder, then none, across a restart', async () => {
  const root = origin();
  try {
    const custody = activation(root, T0 + 7 * DAY, () => w.clock.now);
    const notices = () => credentialNotices(dueCredentialReminders(custody.records(), w.clock.now), w.clock.now);
    const w = world(root, notices);
    await w.say('Hello.');
    expect(w.sent[0]).toContain('(activation act-7) expires in 7 days.');
    // Renewed under the same name with a new expiry; the journal is reopened before the next answer.
    w.clock.now = T0 + DAY;
    custody.register({ name: 'preview-activation', kind: 'activation', custody: 'activation-record', identity: 'activation act-8',
      recordedAt: w.clock.now, expiresAt: T0 + 8 * DAY, expirySource: 'activation-record', reminders: reminderSchedule(T0 + 8 * DAY),
      renewal: { standing: 'none', smallestHumanAction: ACTION } });
    expect(dueWithDelivery(dueCredentialReminders(custody.records(), w.clock.now), w.journal.view.order))
      .toMatchObject([{ identity: 'activation act-8', stage: 0, delivered: null }]);
    w.journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const clock = w.clock, sent: string[] = [];
    const worker = createJournalWorker(reopened, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
      prepareModel: input => input.context, replyNotices: notices, model: async () => JSON.stringify({ reply: 'Noted.', memory: [] }),
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    for (const [id, text] of [[2, 'Hello again.'], [3, 'And again.']] as const) {
      worker.intake([{ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
        date: Math.floor(clock.now / 1000) } }]);
      await worker.drain(); clock.now += HOUR;
    }
    expect(sent[0]).toContain('(activation act-8) expires in 7 days.');
    expect(sent[1]).not.toContain('Reminder:');
    expect(dueWithDelivery(dueCredentialReminders(custody.records(), clock.now), reopened.view.order))
      .toMatchObject([{ identity: 'activation act-8', stage: 0, delivered: { stage: 0, at: T0 + DAY, current: true } }]);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not repeat a line whose send receipt is unknown, and reports it undelivered', async () => {
  const root = origin();
  try {
    const custody = activation(root, T0 + 7 * DAY, () => T0);
    let answered = false;
    const w = world(root, () => credentialNotices(dueCredentialReminders(custody.records(), w.clock.now), w.clock.now),
      () => { const ok = answered; answered = true; return ok; });
    await w.say('First.');
    w.clock.now += HOUR; await w.say('Second.');
    expect(w.sent.some(text => text.includes('Reminder:'))).toBe(false);
    expect(dueWithDelivery(dueCredentialReminders(custody.records(), w.clock.now), w.journal.view.order))
      .toMatchObject([{ stage: 0, delivered: null }]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('offers nothing when nothing is due', async () => {
  const root = origin();
  try {
    const custody = activation(root, T0 + 7 * DAY + 1, () => T0);
    const w = world(root, () => credentialNotices(dueCredentialReminders(custody.records(), w.clock.now), w.clock.now));
    await w.say('Hello.');
    expect(w.sent[0]).not.toContain('Reminder:');
    expect(w.journal.view.order[0]!.answerNotices).toBeUndefined();
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('reports a failing doorway check once per verdict episode, and never a route the live verdict finds fresh', () => {
  const installed = installDoorways(null, [{ id: 'preview-subscription', billing: 'subscription', model: 'm1', priceReason: 'none' }], T0);
  const verified = observeExchange(installed, 'preview-subscription', 'm1', { ok: true, reportedModels: ['m1'], evidence: 'offline' }, T0);
  const fresh = standingDoorwayCheck(verified, T0 + 1);
  expect(doorwayNotices(fresh, T0 + 1)).toEqual([]);
  const stale = standingDoorwayCheck(verified, T0 + DOORWAY_FRESH_MS + 1);
  expect(doorwayNotices(stale, T0 + DOORWAY_FRESH_MS + 1)).toEqual([{ key: `doorway:${T0 + DOORWAY_FRESH_MS + 1}`,
    line: 'Model route check: preview-subscription/m1 is stale; send "status" for detail.' }]);
  // The check recorded stale, but this answer's exchange re-verified the route: nothing to report.
  const reverified = observeExchange(stale, 'preview-subscription', 'm1', { ok: true, reportedModels: ['m1'], evidence: 'offline' },
    T0 + DOORWAY_FRESH_MS + 2);
  expect(doorwayNotices(reverified, T0 + DOORWAY_FRESH_MS + 2)).toEqual([]);
  expect(doorwayNotices(null, T0)).toEqual([]);
});

it('accepts a recorded notice only when the answer says it verbatim', () => {
  const notice = { key: 'credential:preview-activation:0', line: 'Reminder: renew.' };
  expect(validAnswerNotices([notice], 'Noted.\n\nReminder: renew.')).toBe(true);
  expect(validAnswerNotices([notice], 'Noted.')).toBe(false);
  expect(validAnswerNotices([notice, notice], 'Reminder: renew.')).toBe(false);
  expect(validAnswerNotices([{ ...notice, key: 'other:1' }], 'Reminder: renew.')).toBe(false);
});
