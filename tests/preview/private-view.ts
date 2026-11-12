/** Row 90: 1.x PrivateViewer create/get, adapted to the owning conversation's durable intent.
 * Rules 28/123: team of one; a group, member or guest never inherits the operator dashboard PIN. */
import { createHash } from 'node:crypto';
import { verifiedOperatorTurn, type JournalView, type Turn } from './journal.js';

export const PRIVATE_VIEW_MS = 7 * 24 * 60 * 60 * 1000;
export interface PrivateView {
  id: string; owner: string; conversation: string; source: string; update: number;
  title: string; markdown: string; createdAt: number; expiresAt: number;
}
export const privateViewId = (view: JournalView, turn: Turn): string => createHash('sha256')
  .update(`${view.genesis.bot}:${view.genesis.chat}:${turn.id}`).digest('hex');
export const privateViewOwner = (view: JournalView, turn: Turn): boolean => {
  if (!verifiedOperatorTurn(view, turn) || turn.thread !== undefined || turn.requestedAction) return false;
  try { return JSON.parse(turn.raw).message?.chat?.type === 'private'; } catch { return false; }
};
export const privateViewTitle = (value: unknown): value is string => typeof value === 'string'
  && value.trim().length > 0 && value.length <= 256 && !/[\u0000-\u001f]/u.test(value);
export function createPrivateView(view: JournalView, turn: Turn, title: unknown, markdown: string, at: number): PrivateView | null {
  if (!privateViewOwner(view, turn) || !privateViewTitle(title) || !markdown.trim()
    || Buffer.byteLength(markdown) > 20480 || !Number.isSafeInteger(at)) return null;
  return { id: privateViewId(view, turn), owner: view.genesis.operator, conversation: view.genesis.chat,
    source: turn.id, update: turn.update, title, markdown, createdAt: at, expiresAt: at + PRIVATE_VIEW_MS };
}
/** No files or raw journal are exposed. Missing, expired and wrong-owner records share one plain refusal. */
export function getPrivateView(view: JournalView, id: string, principal: string, now: number): PrivateView | null {
  if (principal !== view.genesis.operator || !/^[a-f0-9]{64}$/u.test(id)) return null;
  const turn = view.order.find(item => item.privateView?.id === id), report = turn?.privateView;
  return turn && report && privateViewOwner(view, turn) && report.owner === principal
    && report.conversation === view.genesis.chat && report.createdAt <= now && now < report.expiresAt ? report : null;
}
/** Rules 106/120: derive from the existing dashboard's configured private listener, never model text. */
export function privateViewDelivery(report: PrivateView, address: string | null): string {
  const match = /^100\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/u.exec(address ?? '');
  const usable = match && Number(match[1]) >= 64 && Number(match[1]) <= 127
    && Number(match[2]) <= 255 && Number(match[3]) <= 255 && Number(match[4]) > 0 && Number(match[4]) <= 65535;
  return usable ? `Your private report (available for seven days): http://${address}/dashboard/reports/${report.id}`
    : 'Your private report page is saved for seven days, but it cannot be opened from your phone yet.';
}
