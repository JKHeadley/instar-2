import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';

const [root, killAt = 'none', probe = ''] = process.argv.slice(2);
const seen = new Map();
const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(7), {
  kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0,
}, point => {
  const count = (seen.get(point) ?? 0) + 1;
  seen.set(point, count);
  const boundary = `${point}:${count}`;
  appendFileSync(join(root, 'boundaries.log'), `${boundary}\n`);
  if (boundary === killAt) process.kill(process.pid, 'SIGKILL');
});
const worker = createJournalWorker(journal, {
  now: () => 1790000000000, stopped: () => false,
  summaryCheck: async () => ({ model: JEV_MODEL, answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
  model: async input => {
    appendFileSync(join(root, 'models.log'), `${input.id}\n`);
    if (input.id.startsWith('summary:')) return JSON.stringify({
      summary: 'The operator gave the code Silver otter 731.', people: [], memory: [],
    });
    if (input.question === 'What was the code I gave earlier?' || input.question === 'Again, what was that code?')
      return input.context.includes('Silver otter 731') ? 'Silver otter 731' : 'forgot';
    return 'I will remember that.';
  },
  replyCheck: {
    jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(
      [...Object.keys(REPLY_RULES), 'summary_integrity'].map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 0 }),
    escalate: async () => { throw Error('unexpected escalation'); }, elapsedMs: () => 0,
  },
  send: async input => {
    appendFileSync(join(root, 'sends.log'), `${JSON.stringify({ update: input.update, text: input.expectedText })}\n`);
    return input.update;
  },
  checkOutbound: () => {},
});
const update = (id, value) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: value,
} });
worker.intake([update(1, 'The code is Silver otter 731.')]);
await worker.drain();
worker.checkCoherence();
await worker.summarizeIfNeeded(true);
worker.intake([update(2, 'Please keep that code in mind.')]);
await worker.drain();
worker.checkCoherence();
worker.intake([update(3, 'What was the code I gave earlier?')]);
await worker.drain();
worker.checkCoherence();
if (probe === 'probe') {
  worker.intake([update(4, 'Again, what was that code?')]);
  await worker.drain();
  worker.checkCoherence();
}
journal.close();
