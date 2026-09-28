import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';

const [root, cut = 'none', phase = 'first'] = process.argv.slice(2);
const seen = new Map();
const point = stage => {
  const count = (seen.get(stage) ?? 0) + 1;
  seen.set(stage, count);
  const label = `${stage}:${count}`;
  appendFileSync(join(root, 'points.log'), `${label}\n`);
  if (label === cut) process.kill(process.pid, 'SIGKILL');
};
const key = new Uint8Array(32).fill(7);
const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, {
  kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0,
}, stage => point(`journal:${stage}`));
const now = phase === 'resume' ? 1790000200000 : 1790000100000;
const factIn = value => /Maya has the ORCHID key \d+\./u.exec(value)?.[0];
const sourceFact = packet => factIn([
  packet.summary?.text ?? '', ...(packet.history ?? []).map(item => item.user ?? ''),
  ...(packet.recalled ?? []).map(item => item.user ?? ''),
].join(' '));
const summaryFaithful = state => {
  const value = JSON.parse(state);
  const packet = value.packet ?? value;
  const fact = value.priorSummary ? factIn([
    value.priorSummary, ...(value.history ?? []).map(item => item.user ?? ''),
  ].join(' ')) : sourceFact(packet);
  return Boolean(fact && (value.candidateSummary ?? value.proposed?.summary)?.includes(fact));
};
const worker = createJournalWorker(journal, {
  now: () => now, stopped: () => false,
  model: async input => {
    const summary = input.id.startsWith('summary:');
    point(`${summary ? 'summary' : 'answer'}:call:entered:${input.id}`);
    const remembering = !summary && input.question.startsWith('Remember:');
    const packet = JSON.parse(phase === 'missing-context' ? '{}' : input.context);
    const fact = remembering ? undefined : sourceFact(packet);
    if (!remembering && !fact) throw Error('required ORCHID source fact absent from model packet');
    const original = (packet.history ?? []).find(item => item.user?.includes(fact))?.user;
    const result = summary
      ? JSON.stringify({ summary: fact,
        people: original ? [{ name: 'Maya', quote: original }] : [],
        commitments: original ? [{ in: 'message', quote: original }] : [], memory: [] })
      // "From your note:" is not operator wording, so the answer stays on the reply-review path under test.
      : remembering ? 'I will remember that.' : `From your note: ${fact}`;
    point(`${summary ? 'summary' : 'answer'}:call:returning:${input.id}`);
    return result;
  },
  summaryCheck: async evidence => {
    point('summary:faithfulness:entered');
    point('summary:faithfulness:returning');
    return { model: JEV_MODEL, answers: { lost_memory: { type: 'noul', noul: summaryFaithful(evidence) ? 0.01 : 0.99 } } };
  },
  replyCheck: {
    jev: async (state, question) => {
      const summary = question !== undefined && 'summary_integrity' in question;
      point(`${summary ? 'summary' : 'reply'}:jev:entered`);
      point(`${summary ? 'summary' : 'reply'}:jev:returning`);
      return { value: { model: JEV_MODEL, answers: Object.fromEntries(
        Object.keys(question ?? REPLY_RULES).map(id => [id, { type: 'noul', noul: summary
          ? summaryFaithful(state) ? 0.5 : 0.99
          : !state.includes('I will remember that') ? 0.5 : 0.01 }])) }, latencyMs: 1 };
    },
    summaryReview: async state => {
      point('summary:review:entered');
      point('summary:review:returning');
      return { verdict: summaryFaithful(state) ? 'pass' : 'violation', reason: 'fixture checked packet fact', latencyMs: 1 };
    },
    escalate: async () => {
      point('reply:review:entered');
      point('reply:review:returning');
      return { verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 };
    },
    elapsedMs: () => 1,
  },
  send: async input => {
    point(`send:entered:${input.update}`);
    appendFileSync(join(root, 'sends.log'), `${JSON.stringify({ update: input.update, text: input.expectedText })}\n`);
    point(`send:returning:${input.update}`);
    return input.update;
  },
  checkOutbound: () => {},
});
const update = (id, text) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
} });
worker.intake([update(1, 'Remember: Maya has the ORCHID key 731.')]);
if (phase !== 'resume') await worker.drain();
worker.intake([update(2, 'What is the ORCHID key?')]);
await worker.summarizeIfNeeded(true);
journal.compact();
await worker.drain();
await worker.summarizeIfNeeded(true);
journal.close();
