/** Carryover row 88: verbatim 1.x wire vocabulary; aliases are explicit API tokens, never intent inference. */
export interface AttentionItem {
  id: string; title: string; summary: string; description?: string; category: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'DONE' | 'WONT_DO';
  sourceContext?: string; createdAt: number; updatedAt: number;
  lane?: 'agent-health'; healthKey?: string; silent?: boolean; machineId?: string;
  revision: number;
}

export const ATTENTION_STATUSES: readonly AttentionItem['status'][] = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'DONE',
  'WONT_DO',
];

export const ATTENTION_PRIORITIES: readonly AttentionItem['priority'][] = [
  'URGENT',
  'HIGH',
  'NORMAL',
  'LOW',
];

const STATUS_ALIASES: Record<string, AttentionItem['status']> = {
  open: 'OPEN',
  reopen: 'OPEN',
  reopened: 'OPEN',
  acknowledged: 'ACKNOWLEDGED',
  acknowledge: 'ACKNOWLEDGED',
  ack: 'ACKNOWLEDGED',
  in_progress: 'IN_PROGRESS',
  'in-progress': 'IN_PROGRESS',
  inprogress: 'IN_PROGRESS',
  working: 'IN_PROGRESS',
  done: 'DONE',
  resolved: 'DONE',
  complete: 'DONE',
  completed: 'DONE',
  wont_do: 'WONT_DO',
  'wont-do': 'WONT_DO',
  wontdo: 'WONT_DO',
  declined: 'WONT_DO',
};

const PRIORITY_ALIASES: Record<string, AttentionItem['priority']> = {
  urgent: 'URGENT',
  critical: 'URGENT',
  high: 'HIGH',
  normal: 'NORMAL',
  medium: 'NORMAL',
  low: 'LOW',
};

function normalizeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return token ? token : null;
}

export function normalizeAttentionStatus(value: unknown): AttentionItem['status'] | null {
  const token = normalizeToken(value);
  if (!token) return null;
  if ((ATTENTION_STATUSES as readonly string[]).includes(token)) {
    return token as AttentionItem['status'];
  }
  return STATUS_ALIASES[token.toLowerCase()] ?? null;
}

export function normalizeAttentionPriority(value: unknown): AttentionItem['priority'] | null {
  if (value === undefined || value === null || value === '') return 'NORMAL';
  const token = normalizeToken(value);
  if (!token) return null;
  if ((ATTENTION_PRIORITIES as readonly string[]).includes(token)) {
    return token as AttentionItem['priority'];
  }
  return PRIORITY_ALIASES[token.toLowerCase()] ?? null;
}

