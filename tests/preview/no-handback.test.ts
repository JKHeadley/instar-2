import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { jevQuestions, REPLY_RULES, parseReplyReviewVerdict, parseReplyRevision,
  replyReviewContext, replyRevisionQuestion, substantiveReply } from './reply-check.js';
import { splitReply } from './reply-parts.js';
import { guidanceVerdicts } from './guidance.js';

type Capture = { name: string; question: string; raw: string; answer: string; admission: string };
const captured = JSON.parse(readFileSync(new URL('./fixtures/act-first-2026-10-10.json', import.meta.url), 'utf8')) as {
  original: { update: number; answer: string }; runs: Capture[] };
const run = (name: string) => captured.runs.find(row => row.name === name)!;
const review = (name: string) => parseReplyReviewVerdict(run(name + '-review').answer);
const completed = JSON.parse(run('compare').answer).reply as string;

it('the existing questions distinguish needless work transfer from a real human decision and resource floor', () => {
  expect(REPLY_RULES.parks_on_user).toContain('unexplained technical language');
  expect(REPLY_RULES.parks_on_user).toContain('decision reserved to the operator');
  expect(jevQuestions.parks_on_user?.instructions).toContain('unexplained technical language');
  expect(REPLY_RULES.quits_on_self).toContain('fatigue');
  expect(REPLY_RULES.quits_on_self).toContain('enforced resource limit');
  const instruction = replyRevisionQuestion(['parks_on_user', 'quits_on_self']);
  expect(instruction).toContain('Complete the requested work supported by the supplied evidence');
  expect(instruction).toContain('Do not replace a handback with an unsupported completion claim');
  expect(instruction).toContain('decision only the operator can make');
});

it('the installed revision receives the same admitted investigation and tool evidence as the reviewer', () => {
  const launcher = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  const revision = launcher.slice(launcher.indexOf('revise: async ('), launcher.indexOf('summaryReview: async'));
  expect(revision).toContain('declaredObligations(journal.view, id, wallNow())');
  const question = replyRevisionQuestion(['claims_blocked']);
  expect(question).toContain('packet.declaredObligations.toolAttempts');
  expect(question).not.toContain('You have attempted nothing outside this reply');
});

it('carries real attempted reads and their outcomes into revision without turning them into new work', () => {
  const data = JSON.parse(readFileSync(new URL('./fixtures/tool-verification-2026-10-15.json', import.meta.url), 'utf8')) as {
    cases: { question: string; tools: { update: number; operation: string; calls: unknown[] }; delivered: { reply: string } }[] };
  expect(data.cases.map(row => row.tools.update)).toEqual([715676307, 46040062]);
  for (const row of data.cases) {
    const original = prepareJournalEnvelope({ question: row.question, id: row.tools.operation,
      context: JSON.stringify({ audience: 'operator', history: [] }) }, 'claude-sonnet-5', 'grant:preview', 1);
    const declared = { blocker: null, loops: [], toolAttempts: row.tools.calls };
    const packet = JSON.parse(replyReviewContext(original, row.delivered.reply, ['parks_on_user'], declared));
    expect(packet.declaredObligations.toolAttempts).toEqual(row.tools.calls);
    expect(packet.operatorMessage).toBe(row.question);
    expect(packet.candidateReply).toBe(row.delivered.reply);
    expect(packet.declaredObligations.blocker).toBeNull();
  }
});

// Real captured answers and reviewer findings, run through the journal worker with injected
// transport/model ports. This is an offline composition replay, not a fresh model-quality claim.
async function replay(draft: string, findings: ReturnType<typeof review>, revised?: string, question = run('compare').question) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'no-handback-')));
  const key = new Uint8Array(32).fill(71), path = join(root, 'journal.encrypted');
  const now = 1790000000000, sends: string[] = [];
  let revisions = 0;
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 12, maxReplies: 6, maxTurns: 3, maxBytes: 131072, cursor: 0 });
  const ports: PreviewPorts = { now: () => now, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
    model: async () => draft, checkOutbound: () => {},
    send: async input => { sends.push(input.expectedText); return 777; },
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(jevQuestions)
        .map(id => [id, { type: 'noul', noul: id === 'parks_on_user' ? 0.9 : 0.01 }])) }, latencyMs: 0 }),
      escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => ({
        ...(operation === 'revision' ? review('compare') : findings), confidence: null, latencyMs: 0 }),
      revise: async input => {
        revisions++;
        const question = replyRevisionQuestion(input.objections ?? input.ruleIds, input.reason, input.findings);
        expect(question).toContain('Complete the requested work supported by the supplied evidence');
        expect(revised).toBeDefined();
        return { state: 'complete', ...parseReplyRevision(JSON.stringify({ reply: revised,
          dispositions: Object.fromEntries((input.objections ?? input.ruleIds).map(id => [id, { decision: 'accept' }])) }),
        input.objections ?? input.ruleIds) };
      } } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: captured.original.update, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: question } }]);
    await worker.drain();
    journal.close();
    const reopened = openPreviewJournal(path, key);
    try {
      await createJournalWorker(reopened, ports).drain();
      return { sends, revisions, turn: reopened.view.order[0]!, guidance: guidanceVerdicts(reopened.view.order) };
    } finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it('replays the captured handback into one corrected answer and retains the receipt across restart', async () => {
  expect(captured.original.update).toBe(969390343);
  expect(review('original').ruleIds).toContain('parks_on_user');
  // The completed research is recorded, not inferred from its answer wording.
  expect(run('compare').admission).toContain('WebSearch');
  const result = await replay(captured.original.answer, review('original'), completed);
  expect(result.sends).toEqual(splitReply(completed));
  expect(result.revisions).toBe(1);
  expect(result.turn.sent).toBe(777);
  expect(result.guidance.find(row => row.member === 'tone-self-stop')).toMatchObject({ verdict: 'fired', landing: 'revised' });
});

it('lets the real failed-read explanation pass without manufacturing a successful result', async () => {
  expect(review('failed-read').verdict).toBe('pass');
  const result = await replay(run('failed-read').answer, review('failed-read'), undefined, run('failed-read').question);
  expect(result.sends).toEqual([run('failed-read').answer]);
  expect(result.revisions).toBe(0);
});

it('keeps a genuine operator decision after a contextual false-positive signal (constructed neighbour)', async () => {
  const text = 'The two dates are available. Which day works for you?';
  const result = await replay(text, { verdict: 'pass', ruleIds: [], reason: 'Only the operator knows their preference.',
    findings: [{ rule: 'parks_on_user', verdict: 'pass', reason: 'A necessary personal choice.' }] }, undefined,
    'Help me choose a meeting day; Tuesday and Wednesday are both available.');
  expect(result.sends).toEqual([text]);
  expect(result.revisions).toBe(0);
});

it.each([
  ['quits_on_self', 'I am exhausted and stopping here.', 'Voluntary fatigue stop on a doable calculation.'],
  ['parks_on_user', 'Apply the additive aggregation operator to the operands.', 'Makes the reader decode and do the calculation.'],
] as const)('revises %s advice into the requested result (constructed neighbour)', async (rule, draft, reason) => {
  const text = 'The total is 24.';
  const result = await replay(draft, { verdict: 'violation', ruleIds: [rule], reason,
    findings: [{ rule, verdict: 'violation', reason }] }, text, 'Add 7, 8 and 9 and tell me the total.');
  expect(result.sends).toEqual([text]);
  expect(result.revisions).toBe(1);
  expect(result.turn.release?.dispositions).toEqual([{ objection: rule, decision: 'accept' }]);
});

it('retains recorded uncertain, undecided, summary and empty-delivery shapes as non-evidence of completed work', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string }[] };
  expect(fixture.otherShapes.map(row => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of fixture.otherShapes) {
    const reading = readAnswer(row.raw, { wrapped: 'refuse', evidence: [row.id] });
    if (row.kind === 'summary-uncertain' || row.kind.startsWith('jev-')) {
      expect(() => parseReplyReviewVerdict(row.raw)).toThrow();
    } else if (row.kind === 'reply-review') {
      expect(reading.ok && parseReplyReviewVerdict(reading.value).ruleIds).toEqual(['breaks_preference']);
    } else if (row.kind === 'summary-writer') {
      expect(reading.ok && JSON.parse(reading.value).memoryItems[0].quote).toBe('my test marker is probe-5f1ba73c');
    } else {
      expect(substantiveReply(row.raw)).toBe(row.kind === 'delivered-reply');
    }
  }
});
