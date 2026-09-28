/** The preview's own promises. Whether a reply promises something, and whether a
 * later reply carries a promise out, is the answering model's reading (Rule 10);
 * code only checks exact values: the quoted sentence is in the reply actually
 * sent, the date phrase is inside that quote, and the counts and sizes are bounded. */
import { parseDatedItem, type DatedItem } from './dated-memory.js';

/** `promised` marks a model-proposed promise; the other actions are legacy journal rows. */
export interface AgentPromise { quote: string; action: 'promised' | 'remind' | 'check' | 'follow up' | 'send' | 'tell' | 'update' | 'keep';
  owner: 'agent'; waitsOn: 'next-relevant-reply'; due?: DatedItem }
export interface PromiseProposal { quote: string; when?: string }
export interface FulfillmentProposal { id: number; quote: string }
export const AGENT_PROMISE_LIMIT = 5;

const exactClause = (value: unknown, within: string) => typeof value === 'string' && value.trim() === value
  && value.length >= 3 && Buffer.byteLength(value) <= 500 && within.includes(value);

/** Validated promise proposals from one answer, or undefined when the proposal is malformed. */
export function promiseProposals(value: unknown, reply: string): PromiseProposal[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > AGENT_PROMISE_LIMIT) return undefined;
  const found: PromiseProposal[] = [];
  for (const item of value as { quote?: unknown; when?: unknown }[]) {
    if (!item || typeof item !== 'object' || !exactClause(item.quote, reply)) return undefined;
    const quote = item.quote as string;
    if (item.when !== undefined && !(typeof item.when === 'string' && item.when.trim() === item.when
      && item.when.length > 0 && Buffer.byteLength(item.when) <= 100 && quote.includes(item.when))) return undefined;
    if (!found.some(saved => saved.quote === quote))
      found.push({ quote, ...(typeof item.when === 'string' ? { when: item.when } : {}) });
  }
  return found;
}
/** Validated fulfillment proposals against the ids of open agent promises offered to the model. */
export function fulfillmentProposals(value: unknown, reply: string, offered: ReadonlySet<number>): FulfillmentProposal[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > AGENT_PROMISE_LIMIT) return undefined;
  const found: FulfillmentProposal[] = [];
  for (const item of value as { id?: unknown; quote?: unknown }[]) {
    if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.id) || !offered.has(item.id as number)
      || !exactClause(item.quote, reply)) return undefined;
    if (!found.some(saved => saved.id === item.id)) found.push({ id: item.id as number, quote: item.quote as string });
  }
  return found;
}
/** The promises recorded with a reply at send intent: only proposals still quoted exactly in the final reply. */
export function recordedPromises(proposals: readonly PromiseProposal[], reply: string, source: string, at: number, zone: string): AgentPromise[] {
  return proposals.filter(item => reply.includes(item.quote)).map(item => {
    const due = item.when ? parseDatedItem(source, item.quote, item.when, at, zone) : undefined;
    return { quote: item.quote, action: 'promised' as const, owner: 'agent' as const, waitsOn: 'next-relevant-reply' as const, ...(due ? { due } : {}) };
  });
}

/** Legacy replay only: journal intents recorded before model-proposed fulfillment
 * carry no `fulfills` field and keep the closure rule they were written under. */
export function legacyFulfillsReminder(promise: AgentPromise, reply: string): boolean {
  if (promise.action !== 'remind') return false;
  const target = /^(?:I’ll|I'll|I will) remind you to\s+(.+?)(?:[.!?])?$/iu.exec(promise.quote)?.[1]
    ?.replace(/\s+(?:tomorrow|today|on \d{4}-\d{2}-\d{2})\s*$/iu, '').replace(/[.!?]+$/u, '').trim();
  if (!target) return false;
  const reminder = /^Reminder:[ \t]+(.+?)(?:[.!?])?$/iu.exec(reply.replace(/^PREVIEW — /u, '').trim())?.[1]
    ?.replace(/[.!?]+$/u, '').trim();
  return reminder?.toLowerCase() === target.toLowerCase();
}
