import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, createJournalWorker, CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { credentialNotices } from './credential-reminders.js';
import { createSecretCustody, dueCredentialReminders, type CredentialRecord } from './secret-custody.js';
import { HOLDING_REPLY, PUBLIC_LABEL_MASK, REPLY_RULES, concealSecretMaterial, maskPublicLabels, publicCredentialLabels,
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
 * Plan #444 (review round 3): no reading of a VIOLATION's prose can establish that its whole allegation is public, so a
 * credential VIOLATION always holds. The record labels are masked out of the text every reviewer reads instead. The
 * replay's reviewer reproduces both recorded verdicts: the VIOLATION when it reads the label (715673352), the PASS on
 * the same reply when it does not (the neighbouring turn 715673353 read the line as a name). */
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
  /** Run without the record-label port (the runner before plan #444): the reviewer reads the label. */
  unmasked?: boolean;
}
async function replay(options: Run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-credlabel-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 9, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 };
  const clock = { now: T.answeredAt }, sends: string[] = [], jevTexts: string[] = [], reviseTexts: string[] = [], reviewTexts: string[] = [];
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
    knownNonSecrets: () => publicCredentialLabels(recorded.register, held),
    ...(options.unmasked ? {} : { credentialRecordLabels: () => publicCredentialLabels(recorded.register, held, 'record') }),
    replyCheck: { elapsedMs: () => 0,
      jev: async (text: string) => { calls.jev++; jevTexts.push(text);
        return { value: { model: 'jev-1.13.0', usage: { input_tokens: T.jev.usage.inputTokens, output_tokens: T.jev.usage.outputTokens },
          answers: Object.fromEntries(Object.entries(options.jevScores ?? T.jev.scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) } as unknown,
        latencyMs: T.jev.latencyMs }; },
      escalate: async (text: string) => { calls.review++; reviewTexts.push(text);
        // The recorded reviewer: VIOLATION on the label it read (715673352), PASS on the line without it (715673353).
        const review = options.review ?? (text.includes(LABEL) ? T.review
          : { verdict: 'pass' as const, ruleIds: [], findings: [recorded.neighbour.credentialFinding] });
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
    const result = { sends, calls, jevTexts, reviseTexts, reviewTexts, turn, release: turn.release, heldReview: turn.heldReview };
    journal.close();
    const reopened = openPreviewJournal(path, key);
    const durable = reopened.view.order[0]!;
    reopened.close();
    return { ...result, durableIntent: durable.intent };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('715673352 replayed: the tool answer naming the activation record\'s public label is sent, not held', async () => {
  const { sends, calls, jevTexts, reviewTexts, turn, release, heldReview, durableIntent } = await replay({ answer: T.answerBody });
  // The runner composed exactly the recorded answer: the model's body plus its own reminder line.
  expect(turn.answer).toBe(T.recordedAnswer);
  // Both reviewers still ran (nothing skipped), each on the text with the record labels masked.
  expect(calls).toMatchObject({ jev: 1, review: 1 });
  for (const text of [jevTexts[0]!, reviewTexts[0]!]) {
    expect(text).not.toContain(LABEL);
    expect(text).not.toContain('"preview-activation"');
    expect(text).toContain(PUBLIC_LABEL_MASK);
    expect(text).toContain('The byte count is 25');
    expect(text).toContain('approve a renewed activation record');
  }
  expect(sends).toHaveLength(1);
  expect(sends[0]).not.toBe(T.recordedIntent);
  expect(sends[0]).not.toContain('I need to check that answer');
  expect(sends[0]).toContain('The byte count is 25');
  // The operator receives the real label: the mask exists only in what a reviewer reads.
  expect(sends[0]).toContain(LABEL);
  expect(sends[0]).not.toContain(PUBLIC_LABEL_MASK);
  expect(durableIntent).toBe(sends[0]);
  expect(heldReview).toBeUndefined();
  // A clean pass: no objection to release, and the full-context review's own row records the PASS.
  expect(release).toBeUndefined();
  expect(turn.replyChecks?.find(check => check.path !== 'jev')?.verdict).toBe('pass');
});

it('the other side: the recorded VIOLATION on the label, where a reviewer does read it, still holds the whole reply', async () => {
  const { sends, calls, reviewTexts, heldReview } = await replay({ answer: T.answerBody, unmasked: true });
  expect(reviewTexts[0]).toContain(LABEL);
  expect(calls.review).toBe(1);
  expect(sends).toEqual([HOLDING_REPLY]);
  expect(heldReview?.objections).toContain('credential');
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
    // The reviewer read the password as written: only the record labels are masked.
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
  // Longest first, so a label inside a longer label is masked after it.
  expect(labels.indexOf(LABEL)).toBeLessThan(labels.indexOf('preview-activation'));
  const poisoned = [{ ...recorded.register[3]!, identity: TEST_SECRET }];
  expect(publicCredentialLabels(poisoned, [TEST_SECRET])).not.toContain(TEST_SECRET);
  // A label that is a piece of a held value would let a mask hide part of a secret: refused too.
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

it('the mask: only exact, whole record labels; a longer value carrying a label, and generic register words, stay visible', () => {
  const labels = publicCredentialLabels(recorded.register, [], 'record');
  expect(labels).toContain(LABEL);
  expect(labels).toContain('preview-activation');
  expect(labels).not.toContain('activation');
  expect(labels).not.toContain('approve a renewed activation record');
  expect(maskPublicLabels(`"preview-activation" (${LABEL})`, labels)).toBe(`"${PUBLIC_LABEL_MASK}" (${PUBLIC_LABEL_MASK})`);
  // A value joined to a label is not that label: a reviewer judges it whole.
  for (const value of [`${LABEL}x`, `preview-activation-7731`, `xpreview-activation`, `preview-activation_key`])
    expect(maskPublicLabels(`the password is ${value}.`, labels)).toBe(`the password is ${value}.`);
  expect(maskPublicLabels('the activation record needs renewal', labels)).toBe('the activation record needs renewal');
  // A held value is never hidden: a label inside one is refused (see below), and held bytes are refused before review.
});

it('the reviewer is told which labels are public, and Jev keeps its measured question while reading masked text', () => {
  const prompt = JSON.stringify({ messages: [{ role: 'user', content: T.operator },
    { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-private-chat' }, history: [] } }) }] });
  const labels = publicCredentialLabels(recorded.register, []);
  const packet = JSON.parse(replyReviewContext(prompt, T.recordedAnswer, ['credential'], undefined, labels)) as { knownNonSecrets?: string[] };
  expect(packet.knownNonSecrets).toEqual(labels);
  expect((JSON.parse(replyReviewContext(prompt, T.recordedAnswer, ['credential'])) as { knownNonSecrets?: unknown }).knownNonSecrets).toBeUndefined();
  expect(REPLY_RULES.credential).toMatch(/identity label.*never a secret/u);
  const masked = maskPublicLabels(T.recordedAnswer, publicCredentialLabels(recorded.register, [], 'record'));
  expect(masked).not.toContain(LABEL);
  expect(masked).toContain('The byte count is 25');
  // The neighbouring turn's verdict on the same line: the reviewer itself judged it public once already.
  expect(recorded.neighbour.credentialFinding.verdict).toBe('pass');
});
