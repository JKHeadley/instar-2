import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, createJournalWorker, CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { credentialNotices } from './credential-reminders.js';
import { createSecretCustody, dueCredentialReminders, type CredentialRecord } from './secret-custody.js';
import { HOLDING_REPLY, PUBLIC_LABEL_MASK, REPLY_RULES, concealSecretMaterial, credentialFindingPublic, maskPublicLabels, publicCredentialLabels, toolOutputLines,
  replyReviewContext, secretMaterialIn, type ReplyFinding, type ReplyRule } from './reply-check.js';
import { redact } from '../../src/recall/redact.js';

/** THE CREDENTIAL LABEL BOUNDARY (plan #442; Rules 4, 10, 86, 100; purpose: secrets never exposed, ability never reduced).
 *
 * Replayed shape (Rule 106): proof room group T, update 715673352, read-only from the run's encrypted journal and its
 * credential register (fixtures/credlabel-proofroom-T-2026-10-03.json). One sandboxed Bash call wrote, read and counted
 * the file (25 bytes); the runner appended its own due reminder line, which names the activation record's PUBLIC
 * identity label; Jev was unsure (credential 0.58); the full-context review called that label "an activation token";
 * the one revision came back UNKNOWN; and the operator received only the holding notice. On the very next turn the
 * same reviewer passed the same line (0.59 from Jev), so the hold was a coin flip on a public label. */
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
  const clock = { now: T.answeredAt }, sends: string[] = [], jevTexts: string[] = [], reviseTexts: string[] = [];
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
    replyCheck: { elapsedMs: () => 0,
      jev: async (text: string) => { calls.jev++; jevTexts.push(text);
        return { value: { model: 'jev-1.13.0', usage: { input_tokens: T.jev.usage.inputTokens, output_tokens: T.jev.usage.outputTokens },
          answers: Object.fromEntries(Object.entries(options.jevScores ?? T.jev.scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) } as unknown,
        latencyMs: T.jev.latencyMs }; },
      escalate: async () => { calls.review++;
        const review = options.review ?? T.review;
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
    const result = { sends, calls, jevTexts, reviseTexts, turn, release: turn.release, heldReview: turn.heldReview };
    journal.close();
    const reopened = openPreviewJournal(path, key);
    const durable = reopened.view.order[0]!;
    reopened.close();
    return { ...result, durableIntent: durable.intent };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('715673352 replayed: the tool answer naming the activation record\'s public label is sent, not held', async () => {
  const { sends, calls, jevTexts, turn, release, heldReview, durableIntent } = await replay({ answer: T.answerBody });
  // The runner composed exactly the recorded answer: the model's body plus its own reminder line.
  expect(turn.answer).toBe(T.recordedAnswer);
  // The recorded review (verbatim, credential VIOLATION quoting the label) still ran; nothing was skipped.
  expect(calls).toMatchObject({ jev: 1, review: 1 });
  expect(sends).toHaveLength(1);
  expect(sends[0]).not.toBe(T.recordedIntent);
  expect(sends[0]).not.toContain('I need to check that answer');
  expect(sends[0]).toContain('The byte count is 25');
  expect(sends[0]).toContain(LABEL);
  expect(durableIntent).toBe(sends[0]);
  // The finding stays on the record as an advisory objection (Rules 41, 86, 108): signal, never a silent pass.
  expect(heldReview).toBeUndefined();
  expect(release).toMatchObject({ review: 'violation', objections: ['credential'], revised: false });
  // Jev never read the label: the register's public labels are masked out of the only text it sees.
  expect(jevTexts[0]).not.toContain(LABEL);
  expect(jevTexts[0]).toContain(PUBLIC_LABEL_MASK);
  expect(jevTexts[0]).toContain('The byte count is 25');
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

it('the finding test: only exact register labels clear; a runner line, a fragment, a second value or tool output keeps the hold', () => {
  const labels = publicCredentialLabels(recorded.register, [TEST_SECRET]);
  const reply = `PREVIEW — ${T.recordedAnswer}`;
  const operator = T.operator;
  const tool = toolOutputLines([T.toolResult], true)!;
  expect(tool).toEqual(['hello from the tool test', '25 tools-f374b0.txt']);
  // The recorded reason, verbatim, with the recorded tool output: released.
  expect(credentialFindingPublic(T.review.findings[1]!.reason, reply, labels, [TEST_SECRET], tool, operator)).toBe(true);
  expect(credentialFindingPublic('discloses "preview-activation" (preview-s2-activation-v2-2026-09-23)', reply, labels, [], [], operator)).toBe(true);
  // Not an exact label: the runner's whole line, a fragment of a label, a label with more text, or no quote at all.
  const line = credentialNotices(dueCredentialReminders(recorded.register, T.answeredAt), T.answeredAt)[0]!.line;
  expect(credentialFindingPublic(`discloses "${line}"`, reply, labels, [], [], operator)).toBe(false);
  expect(credentialFindingPublic('discloses "s2-activation-v2"', reply, labels, [], [], operator)).toBe(false);
  expect(credentialFindingPublic(`discloses "${LABEL} hunter-77"`, `PREVIEW — ${LABEL} hunter-77`, labels, [], [], operator)).toBe(false);
  expect(credentialFindingPublic('discloses an activation token', reply, labels, [], [], operator)).toBe(false);
  expect(credentialFindingPublic(`discloses "${LABEL}" and "an activation token"`, reply, labels, [], [], operator)).toBe(false);
  // A span from tool output is never a label, and a reply repeating tool output the operator did not supply is held,
  // however the finding names it.
  expect(credentialFindingPublic('discloses "25 tools-f374b0.txt"', 'PREVIEW — wc -c printed "25 tools-f374b0.txt".', labels, [], tool, operator)).toBe(false);
  const leakTool = toolOutputLines([JSON.stringify({ stdout: 'marigold' })], true)!;
  expect(credentialFindingPublic(`"${LABEL}" is harmless, but the password printed before the reminder is live.`,
    `${reply} The vendor portal password is marigold.`, labels, [], leakTool, operator)).toBe(false);
  // An incomplete tool record (omitted calls or a clipped excerpt) cannot be checked: the hold stays.
  expect(credentialFindingPublic(T.review.findings[1]!.reason, reply, labels, [], toolOutputLines([T.toolResult], false), operator)).toBe(false);
  expect(toolOutputLines(['x'.repeat(10) + '…'], true)).toBeUndefined();
  // Held material in the reply, any length, keeps the hold.
  expect(credentialFindingPublic(T.review.findings[1]!.reason, `${reply} Code 482639.`, labels, ['482639'], tool, operator)).toBe(false);
});

it('the reviewer is told which labels are public, and Jev keeps its measured question while reading masked text', () => {
  const prompt = JSON.stringify({ messages: [{ role: 'user', content: T.operator },
    { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-private-chat' }, history: [] } }) }] });
  const labels = publicCredentialLabels(recorded.register, []);
  const packet = JSON.parse(replyReviewContext(prompt, T.recordedAnswer, ['credential'], undefined, labels)) as { knownNonSecrets?: string[] };
  expect(packet.knownNonSecrets).toEqual(labels);
  expect((JSON.parse(replyReviewContext(prompt, T.recordedAnswer, ['credential'])) as { knownNonSecrets?: unknown }).knownNonSecrets).toBeUndefined();
  expect(REPLY_RULES.credential).toMatch(/identity label.*never a secret/u);
  const masked = maskPublicLabels(T.recordedAnswer, labels);
  expect(masked).not.toContain(LABEL);
  expect(masked).toContain('The byte count is 25');
  // The neighbouring turn's verdict on the same line: the reviewer itself judged it public once already.
  expect(recorded.neighbour.credentialFinding.verdict).toBe('pass');
});
