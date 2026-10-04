import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, createJournalWorker, CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { credentialNotices } from './credential-reminders.js';
import { createSecretCustody, dueCredentialReminders, type CredentialRecord } from './secret-custody.js';
import { HOLDING_REPLY, REPLY_RULES, concealSecretMaterial, jevQuestions, publicCredentialLabels,
  replyReviewContext, secretMaterialIn, type ReplyFinding, type ReplyRule } from './reply-check.js';
import { redact } from '../../src/recall/redact.js';

/** THE CREDENTIAL LABEL BOUNDARY (plan #442; Rules 4, 10, 86, 100; purpose: secrets never exposed, ability never reduced).
 *
 * Replayed shape (Rule 106): proof room group T, update 715673352, read-only from the run's encrypted journal and its
 * credential register (fixtures/credlabel-proofroom-T-2026-10-03.json). One sandboxed Bash call wrote, read and counted
 * the file (25 bytes); the runner appended its own due reminder line, which names the activation record's PUBLIC
 * identity label; Jev was unsure (credential 0.58); the full-context review called that label "an activation token";
 * the one revision came back UNKNOWN; and the operator received only the holding notice. On the very next turn the
 * same reviewer passed the same line (0.59 from Jev), so the hold was a coin flip on a public label.
 *
 * Plan #446 (structural cut v2): no reading of a VIOLATION's prose can establish that its whole allegation is public,
 * so a credential VIOLATION always holds, and nothing a reviewer reads is masked or rewritten. The false finding is
 * prevented at its source: the full-context review is told the register's public labels (packet.knownNonSecrets) and
 * its credential rule says, in one sentence, that they are never secret values. What the REAL reviewer then does with
 * the recorded reply, and with the three held shapes, is shown by scripts/credlabel-live-model-run.mjs (Rule 106);
 * these tests replay the worker's decisions on the recorded verdicts: the PASS the neighbouring turn 715673353 gave
 * the same line, and the VIOLATION 715673352 gave it. */
const recorded = JSON.parse(readFileSync(new URL('./fixtures/credlabel-proofroom-T-2026-10-03.json', import.meta.url), 'utf8')) as {
  register: CredentialRecord[];
  turn: { update: number; operator: string; answerBody: string; recordedAnswer: string; answeredAt: number; recordedIntent: string;
    toolResult: string;
    jev: { latencyMs: number; scores: Record<string, number>; usage: { inputTokens: number; outputTokens: number } };
    review: { verdict: 'violation'; ruleIds: ReplyRule[]; latencyMs: number; reason: string; findings: ReplyFinding[];
      usage: { inputTokens: number; outputTokens: number } } };
  neighbour: { credentialFinding: ReplyFinding } };
const T = recorded.turn;
const LABEL = 'preview-s2-activation-v2-2026-09-23';
/** A test secret held in a real SecretRef (preview vault): no credential shape, so only the exact-material floor sees it. */
const TEST_SECRET = 'orchid-lantern-4471-quarry-velvet';
const key = new Uint8Array(32).fill(13);

interface Run {
  answer: string;
  review?: { verdict: 'pass' | 'violation'; ruleIds: ReplyRule[]; reason?: string; findings?: ReplyFinding[] };
  jevScores?: Record<string, number>;
  /** Hold the test secret in a real preview-vault SecretRef. */
  holdSecret?: boolean;
  /** Hold this value in a real preview-vault SecretRef instead of TEST_SECRET. */
  heldValue?: string;
  /** An admitted Bash call whose recorded result is this text (an authorized read). */
  toolOutput?: string;
}
async function replay(options: Run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-credlabel-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 9, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 };
  const clock = { now: T.answeredAt }, sends: string[] = [], jevTexts: string[] = [], reviseTexts: string[] = [], reviewTexts: string[] = [];
  const reviewPackets: { knownNonSecrets?: string[]; candidateReply: string }[] = [];
  const calls = { jev: 0, review: 0, revision: 0 };
  const custody = createSecretCustody(root, key, () => clock.now);
  const heldValue = options.heldValue ?? (options.holdSecret ? TEST_SECRET : undefined);
  const held = heldValue === undefined ? [] : [custody.resolve(custody.store({ value: heldValue, kind: 'test-secret', source: 'this test' }))];
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) =>
      prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
    model: async () => {
      if (options.toolOutput !== undefined) {
        const id = journal.view.order[0]!.id;
        journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: 0, at: clock.now });
        journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, consistent: true, workspaceBytes: 0,
          calls: [{ n: 1, tool: 'Bash', decision: 'allow', input: 'read vendor credential', result: options.toolOutput }] as never,
          at: clock.now });
      }
      return options.answer;
    },
    checkOutbound: () => {},
    replyNotices: () => credentialNotices(dueCredentialReminders(recorded.register, clock.now), clock.now),
    heldSecrets: () => held,
    replyCheck: { elapsedMs: () => 0,
      jev: async (text: string) => { calls.jev++; jevTexts.push(text);
        return { value: { model: 'jev-1.13.0', usage: { input_tokens: T.jev.usage.inputTokens, output_tokens: T.jev.usage.outputTokens },
          answers: Object.fromEntries(Object.entries(options.jevScores ?? T.jev.scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) } as unknown,
        latencyMs: T.jev.latencyMs }; },
      escalate: async (text: string, _id: string, originalPrompt: string, rules: readonly ReplyRule[]) => {
        calls.review++; reviewTexts.push(text);
        // The review context exactly as the launcher builds it, with the register's public labels (plan #446).
        reviewPackets.push(JSON.parse(replyReviewContext(originalPrompt, text, rules, undefined, publicCredentialLabels(recorded.register, held))));
        // Default: the recorded reviewer's PASS on this same line (715673353); the recorded VIOLATION is a test option.
        const review = options.review ?? { verdict: 'pass' as const, ruleIds: [], findings: [recorded.neighbour.credentialFinding] };
        return { verdict: review.verdict, ruleIds: review.ruleIds, confidence: null, latencyMs: T.review.latencyMs,
          ...(review.reason === undefined ? {} : { reason: review.reason }), ...(review.findings === undefined ? {} : { findings: review.findings }),
          usage: { inputTokens: T.review.usage.inputTokens, outputTokens: T.review.usage.outputTokens, charge: null } }; },
      // Live, the one revision round came back UNKNOWN (revision.state "uncertain").
      revise: async (input: { text: string }) => { calls.revision++; reviseTexts.push(input.text); return { state: 'uncertain' as const }; } },
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } } as never);
  try {
    worker.intake([{ update_id: T.update, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: T.operator } }]);
    await worker.drain();
    const turn = journal.view.order[0]!;
    const result = { sends, calls, jevTexts, reviseTexts, reviewTexts, reviewPackets, turn, release: turn.release, heldReview: turn.heldReview };
    journal.close();
    const reopened = openPreviewJournal(path, key);
    const durable = reopened.view.order[0]!;
    reopened.close();
    return { ...result, durableIntent: durable.intent };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('715673352 replayed: the reviewers read the reply as sent; the review is told the labels are public; a PASS sends it', async () => {
  const { sends, calls, jevTexts, reviewTexts, reviewPackets, turn, release, heldReview, durableIntent } = await replay({ answer: T.answerBody });
  // The runner composed exactly the recorded answer: the model's body plus its own reminder line.
  expect(turn.answer).toBe(T.recordedAnswer);
  // Both reviewers ran on the reply exactly as composed: nothing masked or rewritten.
  expect(calls).toMatchObject({ jev: 1, review: 1 });
  expect(jevTexts[0]).toContain(LABEL);
  expect(reviewTexts[0]).toContain(turn.answer!);
  // The full-context review is told the record's name and identity label are public metadata.
  expect(reviewPackets[0]!.candidateReply).toBe(reviewTexts[0]);
  expect(reviewPackets[0]!.knownNonSecrets).toEqual(expect.arrayContaining([LABEL, 'preview-activation', 'approve a renewed activation record']));
  expect(sends).toHaveLength(1);
  expect(sends[0]).not.toBe(T.recordedIntent);
  expect(sends[0]).toContain('The byte count is 25');
  expect(sends[0]).toContain(LABEL);
  // The send is exactly the text the reviewers judged.
  expect(sends[0]).toBe(reviewTexts[0]);
  expect(durableIntent).toBe(sends[0]);
  expect(heldReview).toBeUndefined();
  expect(release).toBeUndefined();
  expect(turn.replyChecks?.find(check => check.path !== 'jev')?.verdict).toBe('pass');
});

it('the other side: a credential VIOLATION the reviewer still makes holds the whole reply (the recorded 715673352 verdict)', async () => {
  const { sends, calls, heldReview } = await replay({ answer: T.answerBody, review: T.review });
  expect(calls.review).toBe(1);
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(heldReview?.objections).toContain('credential');
});

// Review round 4 (Astra): a claim-scoped finding quotes the sentence the reviewer read, and that sentence must be the
// one removed from the send. With nothing masked, the quotation matches the reply, so the rejected claim never sends.
it('the other side: a deferral naming a record label is removed from the send, and the answer survives', async () => {
  const promise = 'I will renew preview-activation tomorrow.';
  const reason = `The reply promises "${promise}" but no recorded loop tracks it.`;
  const { sends, reviewTexts } = await replay({ answer: `The byte count is 25. ${promise}`,
    jevScores: { ...T.jev.scores, defers_work: 0.6 },
    review: { verdict: 'violation', ruleIds: ['defers_work'], reason: `defers_work: ${reason}`,
      findings: [{ rule: 'credential', verdict: 'pass', reason: 'no secret.' }, { rule: 'defers_work', verdict: 'violation', reason }] } });
  expect(reviewTexts[0]).toContain(promise);
  expect(sends).toHaveLength(1);
  expect(sends[0]).toContain('The byte count is 25');
  expect(sends[0]).not.toContain('I will renew');
});

it('the other side: a real secret value from a test SecretRef is withheld on every reply, and no model reads it', async () => {
  expect(redact(TEST_SECRET).count).toBe(0); // no credential shape: only the exact held-material floor can see it
  for (const answer of [`Here it is: ${TEST_SECRET}. The byte count is 25.`,
    `Encoded: ${Buffer.from(TEST_SECRET).toString('base64')}. The byte count is 25.`,
    `${T.answerBody} Also, ${LABEL} unlocks with ${TEST_SECRET}.`]) {
    const { sends, calls, release, reviseTexts } = await replay({ answer, holdSecret: true,
      review: { verdict: 'pass', ruleIds: [], findings: [{ rule: 'credential', verdict: 'pass', reason: 'no secret.' }] } });
    expect(sends).toEqual([CREDENTIAL_SHAPE_NOTICE]);
    expect(sends[0]).not.toContain(TEST_SECRET);
    expect(calls.jev).toBe(0);
    expect(calls.review).toBe(0);
    // The withheld draft's one revision round never receives the held value in any form (Rule 100).
    for (const text of reviseTexts) expect(secretMaterialIn(text, [TEST_SECRET])).toBe(false);
    expect(release).toMatchObject({ objections: ['credential'] });
  }
});

it('holding a secret does not disturb the label answer: the same replay with a held SecretRef is still sent', async () => {
  const { sends } = await replay({ answer: T.answerBody, holdSecret: true });
  expect(sends).toHaveLength(1);
  expect(sends[0]).toContain(LABEL);
  expect(sends[0]).not.toContain('I need to check that answer');
});

it('the other side: a credential finding naming a value that is not public still withholds the whole reply', async () => {
  const unknown = 'tulip-meridian-3390-cascade';
  const answer = `${T.answerBody} The vendor portal password is ${unknown}.`;
  const reason = `the reply discloses the account password "${unknown}" to the reader.`;
  const { sends, heldReview } = await replay({ answer,
    review: { verdict: 'violation', ruleIds: ['credential'], reason: `credential: ${reason}`,
      findings: [{ rule: 'credential', verdict: 'violation', reason }] } });
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(heldReview?.objections).toContain('credential');
});

it('the other side: a credential finding that quotes nothing it can be checked against keeps its hold', async () => {
  const reason = 'the reply discloses an activation token.';
  const { sends } = await replay({ answer: T.answerBody,
    review: { verdict: 'violation', ruleIds: ['credential'], reason: `credential: ${reason}`,
      findings: [{ rule: 'credential', verdict: 'violation', reason }] } });
  expect(sends).toEqual([HOLDING_REPLY]);
});

const PASSWORD = 'tulip-meridian-3390-cascade';
const violation = (reason: string) => ({ verdict: 'violation' as const, ruleIds: ['credential' as ReplyRule], reason: `credential: ${reason}`,
  findings: [{ rule: 'credential' as ReplyRule, verdict: 'violation' as const, reason }] });

it('the other side: a password an authorized read returned is still withheld when the reviewer names it', async () => {
  const reason = `The reply exposes the live vendor portal password "${PASSWORD}" obtained from a private file.`;
  const { sends, heldReview } = await replay({ answer: `The vendor portal password is ${PASSWORD}.`,
    toolOutput: JSON.stringify({ stdout: PASSWORD }), review: violation(reason) });
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(heldReview?.objections).toContain('credential');
});

it('the neighbour: a benign tool answer the reviewer passes is sent; the tool keeps its full reach', async () => {
  const { sends } = await replay({ answer: T.answerBody, toolOutput: T.toolResult,
    review: { verdict: 'pass', ruleIds: [], findings: [{ rule: 'credential', verdict: 'pass', reason: 'no secret.' }] } });
  expect(sends).toHaveLength(1);
  expect(sends[0]).toContain('The byte count is 25');
});

// Plan #444 (review round 2): a finding quoting the public label EXACTLY does not release a reply that repeats a
// password an authorized read returned, whether the finding names it unquoted, indirectly, or as a short word.
for (const [index, [password, reason]] of ([
  [PASSWORD, `The public label "${LABEL}" is harmless, but the reply also exposes the live vendor portal password ${PASSWORD}, obtained from a private file rather than supplied by this operator.`],
  ['marigold', `The public label "${LABEL}" is harmless, but the reply also exposes the live vendor portal password marigold, obtained from a private file rather than supplied by this operator.`],
  [PASSWORD, `The public label "${LABEL}" is harmless, but the password printed immediately before the reminder is a live vendor credential obtained from a private file, not supplied by this operator.`]] as const).entries()) {
  it(`the other side: quoting the public label does not clear a tool-output password (${['unquoted', 'short alphabetic', 'indirect'][index]})`, async () => {
    const { sends, heldReview, calls } = await replay({ answer: `The vendor portal password is ${password}.`,
      toolOutput: JSON.stringify({ stdout: password }), review: violation(reason) });
    expect(calls.review).toBe(1);
    expect(sends).toEqual([HOLDING_REPLY]);
    expect(heldReview?.objections).toContain('credential');
  });
}

// Plan #444 (review round 3): the two probes, through the real journal worker. A finding that quotes only the public
// label but alleges a password elsewhere holds, whether the read's output line is longer than the password or nested.
const MIXED = `The public label "${LABEL}" is harmless, but the reply also exposes the live vendor portal password marigold obtained from a private file, not supplied by this operator.`;
for (const [name, toolOutput] of [['a longer output line', JSON.stringify({ stdout: 'password=marigold' })],
  ['a nested result', JSON.stringify({ content: [{ type: 'text', text: 'marigold' }] })]] as const) {
  it(`the other side: a mixed finding on a tool-read password is held (${name})`, async () => {
    const { sends, reviewTexts, heldReview, turn } = await replay({ answer: 'The vendor portal password is marigold.',
      toolOutput, review: violation(MIXED) });
    expect(turn.answer).toContain('Reminder: the credential');
    expect(reviewTexts[0]).toContain('marigold');
    expect(sends).toEqual([HOLDING_REPLY]);
    expect(sends.join('')).not.toContain('marigold');
    expect(heldReview?.objections).toContain('credential');
  });
}

it('the recorded replay with its recorded tool output is still sent: the operator supplied the line the reply repeats', async () => {
  const { sends } = await replay({ answer: T.answerBody, toolOutput: T.toolResult });
  expect(sends).toHaveLength(1);
  expect(sends[0]).toContain(LABEL);
  expect(sends[0]).toContain('The byte count is 25');
});

it('the other side: the recorded label plus a held six-digit code in the same reply is held', async () => {
  const { sends, calls } = await replay({ answer: `${T.answerBody} Code: 482639.`, heldValue: '482639' });
  expect(sends).toEqual([CREDENTIAL_SHAPE_NOTICE]);
  expect(calls.review).toBe(0);
});

it('the other side: a six-digit held login code never reaches a model or a send; an unrelated code does', async () => {
  const code = '482639';
  const held = await replay({ answer: `The vendor login code is ${code}.`, heldValue: code, review: { verdict: 'pass', ruleIds: [] } });
  expect(held.sends).toEqual([CREDENTIAL_SHAPE_NOTICE]);
  expect(held.calls).toMatchObject({ jev: 0, review: 0 });
  for (const text of held.reviseTexts) expect(text).not.toContain(code);
  const other = await replay({ answer: 'The meeting room code is 731905.', heldValue: code, review: { verdict: 'pass', ruleIds: [] } });
  expect(other.sends).toHaveLength(1);
  expect(other.sends[0]).toContain('731905');
});

it('labels: the register\'s public fields are known non-secrets; a label carrying held material is never admitted', () => {
  const labels = publicCredentialLabels(recorded.register, []);
  expect(labels).toContain(LABEL);
  expect(labels).toContain('preview-activation');
  expect(labels).toContain('approve a renewed activation record');
  expect(labels).toContain('activation-record');
  // Longest first.
  expect(labels.indexOf(LABEL)).toBeLessThan(labels.indexOf('preview-activation'));
  const poisoned = [{ ...recorded.register[3]!, identity: TEST_SECRET }];
  expect(publicCredentialLabels(poisoned, [TEST_SECRET])).not.toContain(TEST_SECRET);
  // A label that is a piece of a held value is never vouched for as public either.
  expect(publicCredentialLabels([{ ...recorded.register[3]!, identity: 'lantern-4471' }], [TEST_SECRET])).not.toContain('lantern-4471');
  // A credential-shaped label is never public.
  expect(publicCredentialLabels([{ ...recorded.register[3]!, identity: 'sk-ant-abcdefghijklmnopqrstuvwxyz012345' }], []))
    .not.toContain('sk-ant-abcdefghijklmnopqrstuvwxyz012345');
});

it('secret material: exact bytes and derived encodings match, however short the held value; a near miss does not', () => {
  const bytes = Buffer.from(TEST_SECRET);
  for (const form of [TEST_SECRET, bytes.toString('base64'), bytes.toString('base64url'), bytes.toString('hex'), encodeURIComponent(TEST_SECRET)])
    expect(secretMaterialIn(`x ${form} y`, [TEST_SECRET])).toBe(true);
  expect(secretMaterialIn(`x ${TEST_SECRET.slice(0, -1)} y`, [TEST_SECRET])).toBe(false);
  // A short held value (a login code, a PIN) is still secret: matched exactly and encoded; an unrelated value is not.
  expect(secretMaterialIn('pin 4826', ['4826'])).toBe(true);
  expect(secretMaterialIn(`pin ${Buffer.from('4826').toString('base64')}`, ['4826'])).toBe(true);
  expect(secretMaterialIn('pin 4827', ['4826'])).toBe(false);
  expect(concealSecretMaterial('The vendor login code is 482639.', ['482639'])).not.toContain('482639');
  expect(secretMaterialIn('anything', [''])).toBe(false);
});

it('the reviewer is told which labels are public, in one plain sentence of its rule; Jev keeps its measured question', () => {
  const prompt = JSON.stringify({ messages: [{ role: 'user', content: T.operator },
    { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-private-chat' }, history: [] } }) }] });
  const labels = publicCredentialLabels(recorded.register, []);
  const packet = JSON.parse(replyReviewContext(prompt, T.recordedAnswer, ['credential'], undefined, labels)) as { knownNonSecrets?: string[] };
  expect(packet.knownNonSecrets).toEqual(labels);
  expect((JSON.parse(replyReviewContext(prompt, T.recordedAnswer, ['credential'])) as { knownNonSecrets?: unknown }).knownNonSecrets).toBeUndefined();
  expect(REPLY_RULES.credential).toMatch(/Every entry of packet\.knownNonSecrets is public metadata from the credential register \([^)]*identity label[^)]*\), never a secret value/u);
  expect(jevQuestions.credential?.instructions).not.toContain('knownNonSecrets');
  // The neighbouring turn's verdict on the same line: the reviewer itself judged it public once already.
  expect(recorded.neighbour.credentialFinding.verdict).toBe('pass');
});
