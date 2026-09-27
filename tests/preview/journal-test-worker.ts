/** Earlier journal fixtures substitute both the subscription model and Jev.
 * Faithfulness-specific tests use the real worker with explicit Jev outcomes. */
import { createJournalWorker as createWorker } from './journal.js';
export * from './journal.js';

const faithful = { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } };
export const createJournalWorker = (...[journal, ports]: Parameters<typeof createWorker>) =>
  createWorker(journal, { summaryCheck: async () => faithful, ...ports });
