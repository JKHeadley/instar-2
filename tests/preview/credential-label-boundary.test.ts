import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, createJournalWorker, CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { credentialNotices } from './credential-reminders.js';
import { createSecretCustody, dueCredentialReminders, type CredentialRecord } from './secret-custody.js';
import { HOLDING_REPLY, PUBLIC_LABEL_MASK, REPLY_RULES, credentialFindingPublic, maskPublicLabels, publicCredentialLabels,
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
}
async function replay(options: Run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-credlabel-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 9, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 };
  const clock = { now: T.answeredAt }, sends: string[] = [], jevTexts: string[] = [], reviseTexts: string[] = [];
  const calls = { jev: 0, review: 0, revision: 0 };
  const custody = createSecretCustody(root, key, () => clock.now);
  const held = options.holdSecret ? [custody.resolve(custody.store({ value: TEST_SECRET, kind: 'test-secret', source: 'this test' }))] : [];
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) =>
      prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
    model: async () => options.answer,
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

it('secret material: exact bytes and derived encodings match; a near miss and a short value do not', () => {
  const bytes = Buffer.from(TEST_SECRET);
  for (const form of [TEST_SECRET, bytes.toString('base64'), bytes.toString('base64url'), bytes.toString('hex'), encodeURIComponent(TEST_SECRET)])
    expect(secretMaterialIn(`x ${form} y`, [TEST_SECRET])).toBe(true);
  expect(secretMaterialIn(`x ${TEST_SECRET.slice(0, -1)} y`, [TEST_SECRET])).toBe(false);
  expect(secretMaterialIn('pin 4826', ['4826'])).toBe(false);
});

it('the finding test: public quotes (label, runner line, secret-free tool output) clear; anything else keeps the hold', () => {
  const known = [...publicCredentialLabels(recorded.register, [TEST_SECRET]),
    ...credentialNotices(dueCredentialReminders(recorded.register, T.answeredAt), T.answeredAt).map(notice => notice.line)];
  const reply = `PREVIEW — ${T.recordedAnswer}`;
  // The recorded reason, verbatim.
  expect(credentialFindingPublic(T.review.findings[1]!.reason, reply, known, [], [TEST_SECRET])).toBe(true);
  // The reviewer quoting the whole runner line, or the label with its name around it.
  const line = known.find(item => item.startsWith('Reminder:'))!;
  expect(credentialFindingPublic(`discloses "${line}"`, reply, known, [], [])).toBe(true);
  expect(credentialFindingPublic('discloses "preview-activation" (preview-s2-activation-v2-2026-09-23)', reply, known, [], [])).toBe(true);
  // Tool output with no secret material: the wc -c line quoted from the admitted Bash call.
  const toolReply = 'PREVIEW — wc -c printed "25 tools-f374b0.txt".';
  expect(credentialFindingPublic('discloses "25 tools-f374b0.txt"', toolReply, [], [T.toolResult], [])).toBe(true);
  expect(credentialFindingPublic('discloses "25 tools-f374b0.txt"', toolReply, [], [], [])).toBe(false);
  // Tool output that carries a held secret is not public, nor is a quote mixing a label with other text.
  const leaky = `PREVIEW — the tool printed "${TEST_SECRET}".`;
  expect(credentialFindingPublic(`discloses "${TEST_SECRET}"`, leaky, known, [`{"stdout":"${TEST_SECRET}"}`], [TEST_SECRET])).toBe(false);
  expect(credentialFindingPublic(`discloses "${LABEL} hunter-77"`, `PREVIEW — ${LABEL} hunter-77`, known, [], [])).toBe(false);
  // A quote that is not in the reply, or no quote at all, cannot be checked: the hold stays.
  expect(credentialFindingPublic('discloses "an activation token"', reply, known, [], [])).toBe(false);
  expect(credentialFindingPublic('discloses an activation token', reply, known, [], [])).toBe(false);
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
