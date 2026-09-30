import type { JournalView, Turn } from './journal.js';

export interface AuditReport {
  update: number | null;
  modelCall?: 'answer' | 'summary' | null;
  items: { kind: string; at: string; chain: { kind: string; id?: string; ref?: string; update?: number | null; through?: number | null; source?: string }[] }[];
  findings: { code: string; at: string }[];
}

export function auditPacket(view: JournalView, turn: Turn, packet: unknown, memoryCount?: number,
  summaryCount?: number, closedCount?: number): AuditReport;
export function auditJournal(view: JournalView): AuditReport;
export function auditActiveMemory(view: JournalView): Pick<AuditReport, 'items' | 'findings'>;
export function requestedActionSources(view: JournalView, turn: Turn): Turn[] | null;
