import { join } from 'node:path';
import { openPreviewJournal } from './journal.js';

const [root, stage] = process.argv.slice(2);
const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(7), undefined,
  point => { if (point === stage) process.kill(process.pid, 'SIGKILL'); });
journal.compact();
journal.close();
