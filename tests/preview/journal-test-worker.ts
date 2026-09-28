/** Earlier journal fixtures substitute both the subscription model and Jev.
 * Faithfulness-specific tests use the real worker with explicit Jev outcomes. The fixture also stands
 * in for the host's installed join: every minimal-path dependency is observed as admitted unless a
 * test supplies its own observation (the real runner observes each one). */
import { createJournalWorker as createWorker } from './journal.js';
import type { BoundaryContext } from '../../src/index.js';
import type { MinimalDependency } from '../../src/operator/contracts.js';
export * from './journal.js';

const faithful = { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } };
export const previewTestContext = { site: 'preview.journal', preserved: 'preview:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} } as unknown as BoundaryContext;
export const admittedDependencies = (): Record<MinimalDependency, boolean> => ({ 'local-facts': true, register: true,
  'identity-keys': true, clock: true, lease: true, fence: true, 'replication-peer': true, 'conversation-binding': true,
  route: true, 'delivery-evidence': true });
export const createJournalWorker = (...[journal, ports]: Parameters<typeof createWorker>) =>
  createWorker(journal, { summaryCheck: async () => faithful, minimal: { context: previewTestContext, dependencies: admittedDependencies },
    ...ports });
