import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openQuestionCandidates } from './journal-test-worker.js';
import { CREDENTIAL_SHAPE_NOTICE, MEMORY_UNDECIDED_REPLY, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE,
  withDisclosure, raiseSubject, approvalRequestText, approvalBase } from './journal.js';
import { proposeOperatorRequest, operatorRequestText } from './operator-yes.js';
import { HOLDING_REPLY } from './reply-check.js';
import { HOST_OUTAGE_TEXT, isHostOutageText } from './state.js';
import { splitReply } from './reply-parts.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY as end, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY as prior,
  subscriptionActivationEndAllowed } from '../../src/assembly/subscription-window.js';

const key = new Uint8Array(32).fill(17);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'trial', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

it('accepts the reviewed November end and the October predecessor only before renewal', () => {
  expect(end).toBe(Date.parse('2026-11-12T21:40:00Z'));
  expect(prior).toBe(Date.parse('2026-10-12T20:40:00Z'));
  expect(subscriptionActivationEndAllowed(end)).toBe(true);
  expect(subscriptionActivationEndAllowed(prior, prior)).toBe(true);
  expect(subscriptionActivationEndAllowed(prior)).toBe(false);
  expect(subscriptionActivationEndAllowed(prior, end)).toBe(false);
  expect(subscriptionActivationEndAllowed(Date.parse('2026-10-05T20:40:00Z'), prior)).toBe(false);
  expect(subscriptionActivationEndAllowed(end + 1, end)).toBe(false);
});

it('keeps honest notices and split positions without the preview label', () => {
  for (const text of [CREDENTIAL_SHAPE_NOTICE, MEMORY_UNDECIDED_REPLY, TOO_LONG_INPUT_NOTICE,
    TOO_LONG_REPLY_NOTICE, HOLDING_REPLY, HOST_OUTAGE_TEXT]) {
    expect(text.length).toBeGreaterThan(30);
    expect(text).not.toMatch(/PREVIEW|this trial/u);
  }
  const parts = splitReply('An answer. '.repeat(800))!;
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every(text => !text.includes('PREVIEW'))).toBe(true);
  expect(parts[1]).toMatch(/^\(2\/\d+\) — /u);
  expect(withDisclosure('PREVIEW — Answer.', 'Earlier context was summarized.'))
    .toBe('Earlier context was summarized. Answer.');
  expect(isHostOutageText('PREVIEW — experimental test agent; production safeguards incomplete.\nPreview host watcher: The agent did not recover after a restart attempt. Replies are unavailable right now. Messages already admitted to this trial remain preserved.')).toBe(true);
  expect(isHostOutageText('Unrelated notice.')).toBe(false);
});

for (const prefix of ['', 'PREVIEW — ']) it(`replays ${prefix ? 'legacy' : 'current'} sent answers without resending, then sends an unlabelled reply`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'agentready-'));
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    const id = 'telegram:12345678:update:1';
    journal.append({ kind: 'intake', id, update: 1, text: 'Where is the plan?', raw: JSON.stringify(update(1, 'Where is the plan?')),
      accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1001 });
    journal.append({ kind: 'answer', id, text: 'The plan is in the blue folder.', at: 1002 });
    journal.append({ kind: 'intent', id, text: `${prefix}The plan is in the blue folder.`, chat: genesis.chat, update: 1, grant: genesis.grant, at: 1003 });
    journal.append({ kind: 'sent', id, message: 1, at: 1004 });
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.order[0]!.intent).toBe(`${prefix}The plan is in the blue folder.`);
    expect(openQuestionCandidates(journal.view)).toEqual([]);
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false, checkOutbound: () => {},
      model: async () => 'The plan is in the blue folder.', send: async input => { sent.push(input.expectedText); return 2; } });
    await worker.drain(); expect(sent).toEqual([]);
    worker.intake([update(2, 'Remind me where the plan is.')]); await worker.drain();
    expect(sent).toEqual(['The plan is in the blue folder.']);
    const limits = { maxCalls: 40, maxReplies: 20, maxTurns: 20 };
    const current = raiseSubject(journal.view, 'request', 'base', 'calls', limits);
    const legacy = raiseSubject(journal.view, 'request', 'base', 'calls', limits, true);
    expect(current.requestDigest).toBe(legacy.requestDigest);
    expect(current.renderingDigest).not.toBe(legacy.renderingDigest);
    expect(approvalRequestText(journal.view, 'calls')).not.toContain('this trial');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const legacy of [false, true]) it(`reopens ${legacy ? 'legacy' : 'current'} phone renewal wording without changing the approved subject`, () => {
  const root = mkdtempSync(join(tmpdir(), 'agentready-renew-'));
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, { ...genesis, expires: prior });
    const id = 'telegram:12345678:update:1';
    journal.append({ kind: 'intake', id, update: 1, text: 'Please renew.', raw: JSON.stringify(update(1, 'Please renew.')),
      accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1001 });
    journal.append({ kind: 'answer', id, text: 'I can ask.', operatorAction: { action: 'renew-expiry' }, at: 1002 });
    const current = { limits: journal.view.limits, expires: prior };
    const proposal = proposeOperatorRequest({ ...current, used: { maxCalls: 1, maxReplies: 0, maxTurns: 1 },
      step: journal.view.limits, governedExpiry: end, renewalActivation: 'sha256:installed', unknownCalls: 0,
      stopped: false, grant: genesis.grant, base: approvalBase(journal.view) }, { action: 'renew-expiry' }, id, 1002);
    expect(proposal.kind).toBe('request');
    if (proposal.kind !== 'request') throw Error('renewal proposal refused');
    const text = operatorRequestText(proposal.request, current, null)
      .replace("this installation's end", legacy ? "this trial's end" : "this installation's end");
    const intent = { kind: 'intent' as const, id, text, chat: genesis.chat, update: 1, grant: genesis.grant,
      operatorRequest: proposal.request, at: 1003 };
    expect(() => journal.append({ ...intent, text: 'A different request.' })).toThrow('operator request refused');
    journal.append(intent);
    journal.append({ kind: 'sent', id, message: 1, at: 1004 });
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.operatorRequests[0]!.request).toEqual(proposal.request);
    expect(journal.view.order[0]!.intent).toBe(text);
    expect(journal.view.expires).toBe(prior);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
