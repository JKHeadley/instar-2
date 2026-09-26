import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const [root, stage] = process.argv.slice(2), key = new Uint8Array(32).fill(7);
const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, {
  kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0,
}, point => { if (point === stage) process.kill(process.pid, 'SIGKILL'); });
const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
  model: async () => { appendFileSync(join(root, 'models.log'), '1\n'); return 'answer'; },
  send: async () => { appendFileSync(join(root, 'sends.log'), '1\n'); return 1; },
  checkOutbound: () => {} });
worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'question' } }]);
await worker.drain();
journal.close();
