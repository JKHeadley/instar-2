import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, CREDENTIAL_SHAPE_NOTICE, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE,
  UNKNOWN_ANSWER_NOTICE, MODEL_FAILURE_REPLY, limitedAnswerText, reminderOverflowLine, summaryOverviewLead } from './journal-test-worker.js';
import { JEV_MODEL, LINK_SHAPE_REASON, REPLY_RULES, linkShapeRules } from './reply-check.js';
import { machineLink } from './coherence-check.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

// Rule 106: the existing link-shape predicate runs before every model-written send, as a signal.
const key = new Uint8Array(32).fill(81);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 6, maxTurns: 6, maxBytes: 32768, cursor: 0 };
const hello = [{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'where is the report?' } }];
const pass = { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0.01 }])) };
const withJournal = async (run: (journal: ReturnType<typeof openPreviewJournal>) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-links-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  try { await run(journal); } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
};

it.each([
  ['a localhost link', 'Open http://localhost:4042/view/abc to read it.', ['api_endpoint']],
  ['a machine-only path', 'It is saved at /Users/me/report.md for you.', ['raw_path']],
  ['a public link', 'It is at https://example.com/report for you.', []],
  ['no link', 'It is in your notes.', []],
] as const)('classifies %s', (_name, text, rules) => {
  expect(linkShapeRules(text)).toEqual(rules);
});

it('turns an unusable link into a revision signal before the send, then sends the revision', () => withJournal(async journal => {
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
    model: async () => 'Open http://localhost:4042/view/abc to read it.',
    replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: pass, latencyMs: 1 }),
      escalate: async () => { throw Error('no review needed'); },
      revise: async input => { expect(input.ruleIds).toEqual(['api_endpoint']); expect(input.reason).toBe(LINK_SHAPE_REASON);
        return { state: 'complete', text: 'The report is in the private view I shared in the dashboard.' }; } },
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake(hello); await worker.drain();
  expect(sent).toEqual(['PREVIEW — The report is in the private view I shared in the dashboard.']);
  expect(journal.view.order[0]?.release).toMatchObject({ objections: ['api_endpoint'], revised: true });
}));

it('never blocks on the link signal: without a reviser the reply is sent with the signal recorded', () => withJournal(async journal => {
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async () => 'It is saved at /Users/me/report.md for you.',
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake(hello); await worker.drain();
  expect(sent).toEqual(['PREVIEW — It is saved at /Users/me/report.md for you.']);
  expect(journal.view.order[0]?.release).toMatchObject({ review: 'violation', objections: ['raw_path'], reason: LINK_SHAPE_REASON,
    revised: false, final: { links: ['raw_path'] } });
}));

it('checks the final candidate: a revision that introduces a localhost link is recorded against the text actually sent', () => withJournal(async journal => {
  // The review's probe: a link-free draft draws a contextual objection, and the revision adds a
  // machine-local link. The predicate runs on the exact final text; the finding is advisory, never a hold.
  const sent: string[] = [];
  const objection = { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id =>
    [id, { type: 'noul', noul: id === 'raw_path' ? 0.99 : 0.01 }])) };
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-4-5', 'grant:preview', 1000),
    model: async () => 'Your report is ready in the usual place.',
    replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: objection, latencyMs: 1 }),
      escalate: async () => ({ verdict: 'violation', ruleIds: ['raw_path'], confidence: null, latencyMs: 1, reason: 'names a machine place' }),
      revise: async () => ({ state: 'complete', text: 'Open http://localhost:4042/new-report for your report.' }) },
    send: async input => { sent.push(input.expectedText); return sent.length; } });
  worker.intake(hello); await worker.drain();
  const final = 'PREVIEW — Open http://localhost:4042/new-report for your report.';
  expect(sent).toEqual([final]);
  const release = journal.view.order[0]?.release;
  expect(release?.revised).toBe(true);
  expect(release?.objections).toEqual(expect.arrayContaining(['raw_path', 'api_endpoint']));
  expect(release?.final).toEqual({ digest: createHash('sha256').update(final).digest('hex'), links: ['api_endpoint'] });
}));

it('builds every fixed outbound template without a link the operator cannot open', () => withJournal(async journal => {
  for (const text of [CREDENTIAL_SHAPE_NOTICE, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE, UNKNOWN_ANSWER_NOTICE, MODEL_FAILURE_REPLY,
    limitedAnswerText(journal.view, 'turns', 1), limitedAnswerText(journal.view, 'calls', 3), limitedAnswerText(journal.view, 'replies', 2),
    reminderOverflowLine(4), summaryOverviewLead]) expect(machineLink.test(text), text).toBe(false);
}));
