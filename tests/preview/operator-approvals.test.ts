import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, independentSurface, openPreviewJournal, raiseJournalCaps, approvalRequestText, limitedAnswerText, RAISE_LINK_HINT,
  RAISE_NEEDS_SURFACE, proposedLimits } from './journal-test-worker.js';
import { STOP_CONFIRM_TEXT } from './status-command.js';

// Rules 79/82/98 and the Purpose's "the agent never administers its own safeguards": a cap raise
// completes only with the independently administered verifier's one-use proof for the exact current
// challenge. A Telegram press, a fabricated journal row, an expired or changed proof never raise.
const key = new Uint8Array(32).fill(91);
const genesis = (limits: Partial<{ maxCalls: number; maxReplies: number; maxTurns: number }> = {}) => ({ kind: 'genesis' as const,
  bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
  expires: 9999999999999, maxCalls: 1, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0, ...limits });
const message = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const press = (id: number, data: string, from = 7654321) => ({ update_id: id,
  callback_query: { id: `cb-${id}`, from: { id: from }, data, message: { message_id: 900, chat: { id: 7654321, type: 'private' } } } });
type Button = { text: string; callback_data?: string; url?: string };
type Sent = { text: string; markup?: { inline_keyboard: Button[][] }; kind?: string; disposition?: string };

const harness = (path: string, options: { limits?: object; surface?: boolean; boundary?: (stage: string) => void } = {}) => {
  const sent: Sent[] = [], toasts: string[] = [], calls: string[] = [];
  let clock = 1000;
  const surface = independentSurface(() => clock);
  const journal = openPreviewJournal(path, key, genesis(options.limits ?? {}), options.boundary);
  const ports = { now: () => clock, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string }) => { calls.push(input.id); return 'ordinary answer'; },
    acknowledge: (_id: string, text: string) => { toasts.push(text); },
    ...(options.surface === false ? {} : { approvalSurface: surface.port }),
    send: async (input: { expectedText: string; replyMarkup?: unknown; kind?: string; disposition?: string }) => {
      const item: Sent = { text: input.expectedText };
      if (input.replyMarkup) item.markup = input.replyMarkup as NonNullable<Sent['markup']>;
      if (input.kind) item.kind = input.kind;
      if (input.disposition) item.disposition = input.disposition;
      sent.push(item);
      return sent.length; } };
  return { journal, worker: createJournalWorker(journal, ports), sent, toasts, calls, ports, surface,
    tick: (ms: number) => { clock += ms; } };
};
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-approvals-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const buttons = (item: Sent | undefined) => item?.markup?.inline_keyboard[0] ?? [];
const challengeOf = (journal: ReturnType<typeof openPreviewJournal>) =>
  journal.view.order.find(turn => turn.approval?.action === 'raise-caps' && turn.approval.decision === undefined)?.approval?.challenge;

it('raises only on the verified surface; a chat press and silence never raise, and a replayed proof decides nothing', () => withRoot(async path => {
  const { journal, worker, sent, toasts, calls, surface } = harness(path);
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'two')]); await worker.drain();
  const offer = sent.at(-1)!;
  expect(offer.text).toContain(limitedAnswerText(journal.view, 'calls', 1));
  expect(offer.text).toContain(`${approvalRequestText(journal.view, 'calls')} ${RAISE_LINK_HINT}`);
  expect(offer.text).toContain('from 1 to 2');
  expect(offer.disposition).toBe('action-needed');
  // Approve first: the link to the independent page, then Decline; no chat Approve button exists.
  const [approve, decline] = buttons(offer);
  const challenge = challengeOf(journal)!;
  expect(approve?.url).toBe(`https://approve.example.org/c/${challenge.id.replace(':', '-')}`);
  expect(decline?.callback_data).toMatch(/^dc:[0-9a-f]{16}$/u);
  expect(challenge.operator).toBe('telegram:7654321');
  // Silence is never consent (Rule 98).
  await worker.drain(); await worker.minimal();
  expect(journal.view.limits.maxCalls).toBe(1);
  // Channel attestation alone: the verified operator's own Approve press (forged callback data) decides nothing.
  worker.intake([press(3, decline!.callback_data!.replace('dc:', 'ap:'))]);
  expect(journal.view.limits.maxCalls).toBe(1);
  expect(toasts).toEqual([RAISE_NEEDS_SURFACE]);
  expect(journal.view.order.find(turn => turn.approval)?.approval?.decision).toBeUndefined();
  // The operator approves on the independent surface: the raise completes with its receipt.
  surface.operatorActs(challenge.id, 'approve');
  await worker.minimal();
  expect(journal.view.limits.maxCalls).toBe(2);
  expect(journal.view.capAuthority).toBe(`verified-approval:${journal.view.order.find(turn => turn.approval)!.approval!.id}:${challenge.id}`);
  expect(journal.view.order.find(turn => turn.approval)?.approval?.verified?.challenge).toBe(challenge.id);
  await worker.drain();
  expect(calls).toHaveLength(2);
  expect(sent.at(-1)?.text).toBe('PREVIEW — ordinary answer');
  // The same proof again (replay) and a second pass decide nothing more.
  await worker.minimal(); await worker.minimal();
  expect(journal.view.limits.maxCalls).toBe(2);
  journal.close();
  // The raise survives replay; the journal rows alone never raise again.
  const replay = openPreviewJournal(path, key);
  expect(replay.view.limits.maxCalls).toBe(2);
  replay.close();
}));

it('refuses a fabricated approval row, a wrong or expired proof, and a proof for a moved base', () => withRoot(async path => {
  const { journal, worker, sent, surface, tick } = harness(path);
  worker.intake([message(1, 'one'), message(2, 'two')]); await worker.drain();
  const lead = journal.view.order.find(turn => turn.approval)!, challenge = challengeOf(journal)!;
  // An agent-written decision with no verifier receipt cannot even be recorded for a raise...
  expect(() => journal.append({ kind: 'approval-decision', id: lead.id, request: lead.approval!.id, decision: 'approve',
    outcome: 'approved', update: 3, raw: '{}', cursor: 4, at: 1000 })).toThrow('approval decision order');
  // ...and one carrying an invented receipt is only a row: nothing raises from journal data.
  journal.append({ kind: 'approval-decision', id: lead.id, request: lead.approval!.id, decision: 'approve', outcome: 'approved',
    verified: { challenge: challenge.id, principal: 'telegram:7654321', receipt: 'sha256:invented' }, at: 1000 });
  await worker.drain(); await worker.minimal();
  expect(journal.view.limits.maxCalls).toBe(1);
  journal.close();
  // A fresh root: a wrong proof and an expired challenge are refused by the verifier and record nothing.
  const next = path.replace('journal.encrypted', 'second.encrypted');
  const second = harness(next);
  second.worker.intake([message(1, 'one'), message(2, 'two')]); await second.worker.drain();
  const pending = challengeOf(second.journal)!;
  second.surface.acts.push({ challenge: pending.id, proof: 'not-the-proof', decision: 'approve' });
  await second.worker.minimal();
  expect(second.journal.view.limits.maxCalls).toBe(1);
  expect(second.journal.view.order.find(turn => turn.approval)?.approval?.decision).toBeUndefined();
  second.tick(3_600_001);
  second.surface.operatorActs(pending.id, 'approve');
  await second.worker.minimal();
  expect(second.journal.view.limits.maxCalls).toBe(1);
  // The expired request no longer blocks a fresh one: the next capped message gets a new challenge.
  second.worker.intake([message(3, 'three')]); await second.worker.drain();
  const challenges = second.journal.view.order.flatMap(turn => turn.approval?.challenge ? [turn.approval.challenge.id] : []);
  expect(challenges).toHaveLength(2);
  expect(challenges[1]).not.toBe(pending.id);
  // A proof for a request whose base moved (a desk raise in between) is recorded stale, not applied.
  const third = harness(path.replace('journal.encrypted', 'third.encrypted'));
  third.worker.intake([message(1, 'one'), message(2, 'two')]); await third.worker.drain();
  const moved = challengeOf(third.journal)!;
  raiseJournalCaps(third.journal, { maxCalls: 1, maxReplies: 9, maxTurns: 8, authority: 'test: other raise', at: 1000 });
  third.surface.operatorActs(moved.id, 'approve');
  await third.worker.minimal();
  expect(third.journal.view.limits.maxCalls).toBe(1);
  expect(third.journal.view.order.find(turn => turn.approval)?.approval?.decision).toBe('stale');
  // The next capped answer offers a fresh request with a fresh challenge.
  third.worker.intake([message(3, 'three')]); await third.worker.drain();
  expect(challengeOf(third.journal)?.id).not.toBe(moved.id);
  expect(sent).toHaveLength(2);
  second.journal.close(); third.journal.close();
}));

it('declines from the phone without change; a crash after a verified decision leaves the raise unapplied', () => withRoot(async path => {
  const { journal, worker, sent, toasts } = harness(path);
  worker.intake([message(1, 'one'), message(2, 'two')]); await worker.drain();
  const [, decline] = buttons(sent.at(-1));
  worker.intake([press(3, decline!.callback_data!)]);
  expect(journal.view.limits.maxCalls).toBe(1);
  expect(toasts).toEqual(['Declined. Nothing changed.']);
  expect(journal.view.order.find(turn => turn.approval)?.approval?.decision).toBe('declined');
  journal.close();
  let crash = true;
  const other = harness(path.replace('journal.encrypted', 'crash.encrypted'),
    { boundary: stage => { if (crash && stage === 'after:approval-decision') { crash = false; throw Error('crash'); } } });
  other.worker.intake([message(1, 'one'), message(2, 'two')]); await other.worker.drain();
  other.surface.operatorActs(challengeOf(other.journal)!.id, 'approve');
  await expect(other.worker.minimal()).rejects.toThrow('crash');
  other.journal.close();
  const reopened = openPreviewJournal(path.replace('journal.encrypted', 'crash.encrypted'), key);
  const resumed = createJournalWorker(reopened, { ...other.ports });
  await resumed.minimal(); await resumed.drain();
  // Fail closed: the one-use proof was consumed but the raise never landed, so nothing is raised
  // from the recorded row; the operator is offered a fresh request instead.
  expect(reopened.view.limits.maxCalls).toBe(1);
  expect(reopened.view.order.find(turn => turn.approval)?.approval?.decision).toBe('approved');
  reopened.close();
}));

it('offers no raise to approve when no independent surface is installed; the limited answer still goes', () => withRoot(async path => {
  const { journal, worker, sent } = harness(path, { surface: false });
  worker.intake([message(1, 'one'), message(2, 'two')]); await worker.drain();
  expect(sent.at(-1)?.text).toBe(limitedAnswerText(journal.view, 'calls', 1));
  expect(sent.at(-1)?.markup).toBeUndefined();
  expect(journal.view.order.some(turn => turn.approval)).toBe(false);
  journal.close();
}));

it('confirms /stop with prefilled buttons and latches the stop only on the operator press', () => withRoot(async path => {
  const { journal, worker, sent, toasts, calls } = harness(path, { limits: { maxCalls: 4 } });
  worker.intake([message(1, '/stop')]); await worker.drain();
  expect(calls).toHaveLength(0);
  expect(sent.at(-1)?.text).toBe(`PREVIEW — ${STOP_CONFIRM_TEXT}`);
  expect(sent.at(-1)?.kind).toBe('approval');
  const [approve] = buttons(sent.at(-1));
  expect(journal.view.stop).toBeNull();
  worker.intake([press(2, approve!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  expect(toasts).toEqual(['Stopped. Nothing more will be sent or spent.']);
  expect(() => worker.gate()).toThrow('preview stopped');
  expect(() => worker.intake([message(3, 'hello?')])).toThrow('preview stopped');
  expect(sent).toHaveLength(1);
  journal.close();
}));

it('keeps the phone stop reachable past the ordinary turn allowance', () => withRoot(async path => {
  const { journal, worker, sent } = harness(path, { limits: { maxCalls: 4, maxTurns: 1 } });
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, '/stop')]); await worker.minimal();
  expect(journal.view.order[1]?.reserve).toBe(true);
  expect(sent.at(-1)?.text).toBe(`PREVIEW — ${STOP_CONFIRM_TEXT}`);
  worker.intake([press(3, buttons(sent.at(-1))[0]!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  journal.close();
}));

it('raises the turn allowance to cover every reserve turn when the operator approves on the surface', () => withRoot(async path => {
  const { journal, worker, sent, calls, surface } = harness(path, { limits: { maxCalls: 16, maxTurns: 1 } });
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'a'), message(3, 'b'), message(4, 'c'), message(5, 'd')]); await worker.drain();
  expect(sent.at(-1)!.text).toContain('from 1 to 6');
  surface.operatorActs(challengeOf(journal)!.id, 'approve');
  await worker.minimal();
  expect(journal.view.limits.maxTurns).toBe(6);
  await worker.drain();
  expect(calls).toHaveLength(5);
  journal.close();
}));

it('a genuine proof cannot authorize different limits substituted into agent-owned journal data', () => withRoot(async path => {
  // Review round 2 (MF2): the challenge binds call allowance 1 -> 2; a valid turn proposal 8 -> 16 is
  // substituted at the agent-writable journal boundary, keeping the genuine challenge, id and base.
  const { journal, worker, surface } = harness(path);
  const append = journal.append;
  journal.append = row => {
    if (row.kind === 'limited-intent' && row.approval?.action === 'raise-caps') {
      const text = `${limitedAnswerText(journal.view, 'turns', 1)}\n\n${approvalRequestText(journal.view, 'turns')}`;
      // The agent that writes the journal also holds the outbound signer (Rule 89 proves who spoke, not
      // what was authorized), so the forged row is re-signed; only the verified proof binding refuses it.
      row = { ...row, reason: 'turns', text, approval: { ...row.approval, limits: proposedLimits(journal.view, 'turns') },
        provenance: journal.signOutbound('infrastructure', { target: `limited:${row.id}`, chat: row.chat,
          ...(row.thread === undefined ? {} : { thread: row.thread }), body: text }) };
    }
    append(row);
  };
  worker.intake([message(1, 'one'), message(2, 'two')]); await worker.drain();
  const challenge = challengeOf(journal)!;
  expect(surface.issued.get(challenge.id)).toEqual(challenge);
  journal.close();
  const reopened = openPreviewJournal(path, key);
  const resumed = createJournalWorker(reopened, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => 'answer', send: async () => 1, approvalSurface: surface.port });
  surface.operatorActs(challenge.id, 'approve');
  await resumed.minimal();
  // Refused, visibly, before the one-use proof is spent; nothing is raised.
  expect([reopened.view.limits.maxCalls, reopened.view.limits.maxTurns]).toEqual([1, 8]);
  expect(reopened.view.order.find(turn => turn.approval)?.approval?.decision).toBe('refused');
  expect(reopened.view.capAuthority).toBeNull();
  reopened.close();
  // The unsubstituted neighbor with the same proof path raises exactly the verified proposal.
  const clean = harness(path.replace('journal.encrypted', 'clean.encrypted'));
  clean.worker.intake([message(1, 'one'), message(2, 'two')]); await clean.worker.drain();
  clean.surface.operatorActs(challengeOf(clean.journal)!.id, 'approve');
  await clean.worker.minimal();
  expect([clean.journal.view.limits.maxCalls, clean.journal.view.limits.maxTurns]).toEqual([2, 8]);
  clean.journal.close();
}));
