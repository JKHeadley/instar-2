import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';

const { createJournalWorker, openPreviewJournal, openQuestionCandidates, projectMemoryText } =
  await import(process.env.PREVIEW_JOURNAL_MODULE ?? './journal.js');

const [root, phase] = process.argv.slice(2);
const key = new Uint8Array(32).fill(7);
const path = join(root, 'journal.encrypted');
const genesis = { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 30, maxTurns: 30, maxBytes: 262144, cursor: 0 };
const id = n => `telegram:12345678:update:${n}`;
const update = (n, text) => ({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text } });
const journal = openPreviewJournal(path, key, phase.startsWith('seed') ? genesis : undefined, undefined, false, 1_000_000);
const at = 1790000000000;
const add = (n, text) => {
  const raw = JSON.stringify(update(n, text));
  journal.append({ kind: 'intake', id: id(n), update: n, text, raw, accepted: true, cursor: n + 1, at });
};
const worker = createJournalWorker(journal, {
  now: () => at, stopped: () => false,
  model: async input => {
    appendFileSync(join(root, 'models.log'), `${input.id}\n`);
    return JSON.stringify({ reply: `Answer for ${input.id}`, memory: [] });
  },
  replyCheck: { jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(
    [...Object.keys(REPLY_RULES), 'summary_integrity'].map(rule => [rule, { type: 'noul', noul: 0.01 }])) }, latencyMs: 0 }),
    escalate: async () => { throw Error('unexpected escalation'); }, elapsedMs: () => 0 },
  send: async input => {
    appendFileSync(join(root, 'sends.log'), `${JSON.stringify({ update: input.update, text: input.expectedText })}\n`);
    return input.update + 100;
  },
  checkOutbound: () => {},
});

if (phase.startsWith('seed')) {
  add(1, 'Remember the silver key; I prefer short replies.');
  journal.append({ kind: 'reserve', id: id(1), at });
  journal.append({ kind: 'answer', id: id(1), text: 'I will remember the silver key.', state: 'complete',
    memory: [{ mode: 'prefer', source: id(1), quote: 'I prefer short replies', trigger: id(1) }], at });
  journal.append({ kind: 'intent', id: id(1), text: 'PREVIEW — I will remember the silver key.',
    chat: genesis.chat, update: 1, grant: genesis.grant, at });
  journal.append({ kind: 'sent', id: id(1), message: 101, at });
  add(2, 'Where is the silver key?');
  journal.append({ kind: 'reserve', id: id(2), at });
  journal.append({ kind: 'answer', id: id(2), text: "I don't know.", state: 'complete', at });
  journal.append({ kind: 'intent', id: id(2), text: "PREVIEW — I don't know.",
    chat: genesis.chat, update: 2, grant: genesis.grant, at });
  journal.append({ kind: 'sent', id: id(2), message: 102, at });
  journal.append({ kind: 'summary-reserve', through: 2, at });
  journal.append({ kind: 'summary', through: 2, text: 'The silver key is in the old drawer.',
    people: [{ name: 'the operator', source: id(1), quote: 'silver key' }],
    commitments: [{ in: 'reply', source: id(1), quote: 'I will remember the silver key.' }],
    questions: [{ source: id(2), quote: 'Where is the silver key?', reason: 'unanswered-reply' }],
    questionsReviewed: [id(2)], memory: [{ mode: 'correct', source: id(1),
      quote: 'silver key', trigger: id(2), replacement: 'brass key' }], state: 'complete', at });
  add(3, 'Please check the drawer.');
  journal.append({ kind: 'hold', id: id(3), reason: 'reply check unavailable', at });
  add(4, 'What happens next?');
  add(5, 'A reserved call should not repeat.');
  journal.append({ kind: 'reserve', id: id(5), at });
  add(6, 'A send intent should not repeat.');
  journal.append({ kind: 'reserve', id: id(6), at });
  journal.append({ kind: 'answer', id: id(6), text: 'Already prepared.', state: 'complete', at });
  journal.append({ kind: 'intent', id: id(6), text: 'PREVIEW — Already prepared.',
    chat: genesis.chat, update: 6, grant: genesis.grant, at });
  if (phase === 'seed-kill') process.kill(process.pid, 'SIGKILL');
}
if (phase === 'resume') {
  worker.intake([update(1, 'Remember the silver key; I prefer short replies.'), update(4, 'What happens next?')]);
  await worker.drain();
  worker.checkCoherence();
}
if (phase === 'compact') journal.compact();
if (phase === 'after-compact') {
  worker.intake([update(7, 'What is still open?')]);
  await worker.drain();
  worker.checkCoherence();
}
const view = journal.view;
const state = {
  cursor: view.cursor, calls: view.calls, replies: view.replies,
  turns: view.order.map(turn => ({ id: turn.id, update: turn.update, answer: turn.answer ?? null,
    held: turn.held ?? null, heldSince: turn.heldSince ?? null, reserved: turn.reserved,
    intent: turn.intent ?? null, sent: turn.sent ?? null, modelState: turn.modelState ?? null })),
  pending: view.order.filter(turn => turn.accepted && !turn.sent && !turn.intent).map(turn => turn.id),
  held: view.order.filter(turn => turn.held).map(turn => turn.id),
  summaries: view.summaries, reservations: [...view.summaryReservations],
  people: view.people, commitments: view.commitments, closed: [...view.closed],
  questions: openQuestionCandidates(view), reviewed: [...view.questionsReviewed],
  memory: view.memory, projected: projectMemoryText(view, 'silver key; I prefer short replies'),
  probe: worker.probe('Where is the key and what is still open?'),
};
process.stdout.write(JSON.stringify(state));
journal.close();
