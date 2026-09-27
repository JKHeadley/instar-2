import type { openPreviewJournal } from './journal.js';

export function agentState(root: string): { root: string; agent: string };
export function importStorePass(
  journal: ReturnType<typeof openPreviewJournal>,
  state: { root: string; agent: string },
  source: 'telegram' | 'slack',
  now: number,
  stopped: () => boolean,
): { source: string; absent?: boolean; scanned?: number; imported?: number; cursor?: number };
